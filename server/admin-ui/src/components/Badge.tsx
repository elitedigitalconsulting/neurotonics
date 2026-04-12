import React from 'react';

interface Props {
  children: React.ReactNode;
  variant?: 'green' | 'yellow' | 'red' | 'blue' | 'gray';
}

const variants = {
  green:  'bg-green-100 text-green-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  red:    'bg-red-100 text-red-800',
  blue:   'bg-blue-100 text-blue-800',
  gray:   'bg-gray-100 text-gray-800',
};

export function Badge({ children, variant = 'gray' }: Props) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}

export function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: Props['variant'] }> = {
    pending:    { label: 'Pending',    variant: 'yellow' },
    processing: { label: 'Processing', variant: 'blue'   },
    fulfilled:  { label: 'Fulfilled',  variant: 'green'  },
    refunded:   { label: 'Refunded',   variant: 'gray'   },
    failed:     { label: 'Failed',     variant: 'red'    },
  };
  const { label, variant } = map[status] ?? { label: status, variant: 'gray' };
  return <Badge variant={variant}>{label}</Badge>;
}
