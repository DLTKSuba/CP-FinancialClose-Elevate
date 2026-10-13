import { useState } from 'react'
import { Icon } from './Icon'
import { Badge } from './Badge'
import {
  CLOSE_RUN_BADGE_VARIANT,
  formatAskedOn,
  nextChatStatus,
  readRunningTasks,
  setChatStatus,
} from './DelaChatHistory'
import type { DelaChatHistoryEntry } from './DelaChatHistory'
import './DelaChatHistory.css'
import './DelaRunningTasks.css'

export interface DelaRunningTasksProps {
  onBack: () => void
  /** Called when a task is opened to show its close-run conversation. */
  onSelect?: (entry: DelaChatHistoryEntry) => void
  /** Fires after a task's status changes so callers can refresh the running count. */
  onTasksChange?: () => void
}

export function DelaRunningTasks({ onBack, onSelect, onTasksChange }: DelaRunningTasksProps) {
  const [tasks, setTasks] = useState<DelaChatHistoryEntry[]>(readRunningTasks)

  /* Stepping a task to Complete hands it back to Chat History. */
  const advanceStatus = (task: DelaChatHistoryEntry) => {
    if (!task.status) return
    setChatStatus(task.id, nextChatStatus(task.status))
    setTasks(readRunningTasks())
    onTasksChange?.()
  }

  return (
    <div className="dela-history">
      <div className="dela-history__header">
        <button
          type="button"
          className="dela-history__back"
          aria-label="Back to chat"
          onClick={onBack}
        >
          <Icon name="chevron-left" size="md" />
        </button>
        <h3 className="dela-history__title">Running Tasks</h3>
      </div>

      <div className="dela-history__scroll">
        {tasks.length > 0 ? (
          <section className="dela-history__group" aria-label="Tasks running in background">
            {tasks.map((task) => (
              <div key={task.id} className="dela-history__card">
                {task.status === 'Needs Review' ? (
                  <Icon
                    name="exclamation-triangle"
                    size="sm"
                    className="dela-running-tasks__review-icon"
                  />
                ) : (
                  <Icon
                    name="arrow-path"
                    size="sm"
                    className="dela-running-tasks__spinner"
                  />
                )}
                <div className="dela-history__card-body">
                  {task.status && (
                    <button
                      type="button"
                      className="dela-history__status"
                      aria-label={`Task status: ${task.status}. Tap to change.`}
                      onClick={() => advanceStatus(task)}
                    >
                      <Badge variant={CLOSE_RUN_BADGE_VARIANT[task.status]} size="medium">
                        {task.status}
                      </Badge>
                    </button>
                  )}
                  <button
                    type="button"
                    className="dela-history__card-main"
                    onClick={() => onSelect?.(task)}
                  >
                    <span className="dela-history__card-title">{task.title}</span>
                    <span className="dela-history__card-meta">
                      Started {formatAskedOn(task.askedOn)}
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </section>
        ) : (
          <p className="dela-history__empty">No tasks are running in the background.</p>
        )}
      </div>
    </div>
  )
}
