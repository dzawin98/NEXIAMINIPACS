import React from 'react';
import { cn } from '@/lib/utils';

type Status = 'new' | 'in-progress' | 'completed' | 'urgent';

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusConfig: Record<Status, { label: string; className: string }> = {
  new: {
    label: 'New',
    className: 'status-new',
  },
  'in-progress': {
    label: 'In Progress',
    className: 'status-in-progress',
  },
  completed: {
    label: 'Completed',
    className: 'status-completed',
  },
  urgent: {
    label: 'Urgent',
    className: 'status-urgent',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const config = statusConfig[status];

  return (
    <span className={cn('status-badge', config.className, className)}>
      {status === 'urgent' && (
        <span className="mr-1 h-1.5 w-1.5 rounded-full bg-current animate-pulse-subtle" />
      )}
      {config.label}
    </span>
  );
};
