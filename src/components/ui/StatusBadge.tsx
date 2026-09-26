import React from 'react';
import { OperationStatus } from '../../types';

interface StatusBadgeProps {
  status: OperationStatus | 'In Stock' | 'Low Stock' | 'Out of Stock' | 'In stock' | 'Low' | 'Out' | 'Picked' | 'Packed' | 'Validated' | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const normalized = status.toLowerCase();

  let dotColor = 'bg-[var(--text-secondary)]';
  let textColor = 'text-[var(--text-secondary)]';
  let bgColor = 'bg-[var(--surface-secondary)]';

  if (
    normalized === 'in stock' ||
    normalized === 'done' ||
    normalized === 'validated' ||
    normalized === 'normal'
  ) {
    dotColor = 'bg-[var(--success)]';
    textColor = 'text-[var(--success)]';
    bgColor = 'bg-[var(--success-subtle)]';
  } else if (
    normalized === 'low stock' ||
    normalized === 'low' ||
    normalized === 'waiting' ||
    normalized === 'packed'
  ) {
    dotColor = 'bg-[var(--warning)]';
    textColor = 'text-[var(--warning)]';
    bgColor = 'bg-[var(--warning-subtle)]';
  } else if (
    normalized === 'out of stock' ||
    normalized === 'out' ||
    normalized === 'canceled'
  ) {
    dotColor = 'bg-[var(--danger)]';
    textColor = 'text-[var(--danger)]';
    bgColor = 'bg-[var(--danger-subtle)]';
  } else if (
    normalized === 'ready' ||
    normalized === 'picked'
  ) {
    dotColor = 'bg-[var(--accent)]';
    textColor = 'text-[var(--accent)]';
    bgColor = 'bg-[var(--accent-subtle)]';
  }

  const paddingClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded ${paddingClass} ${bgColor} ${textColor}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span>{status}</span>
    </span>
  );
};
