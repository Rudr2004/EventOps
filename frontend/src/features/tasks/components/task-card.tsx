import { motion } from 'framer-motion';
import { Badge } from '../../../components/ui/badge';
import { TASK_PRIORITY_LABELS, type TaskItem } from '../../../types/task';
import { priorityTone } from '../utils/task-tone';

interface TaskCardProps {
  task: TaskItem;
  onClick: () => void;
  index: number;
}

export function TaskCard({ task, onClick, index }: TaskCardProps) {
  return (
    <motion.button
      type="button"
      className={`task-card ${task.isOverdue ? 'task-card-overdue' : ''}`}
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.02 }}
      whileHover={{ y: -2 }}
    >
      <div className="task-card-header">
        <Badge tone={priorityTone(task.priority)}>{TASK_PRIORITY_LABELS[task.priority]}</Badge>
        {task.isOverdue && <Badge tone="danger">Overdue</Badge>}
      </div>
      <p className="task-card-title">{task.title}</p>
      {task.dueDate && (
        <p className="task-card-due">Due {new Date(task.dueDate).toLocaleDateString()}</p>
      )}
    </motion.button>
  );
}
