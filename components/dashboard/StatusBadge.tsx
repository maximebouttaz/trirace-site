interface StatusBadgeProps {
  status: 'published' | 'pending' | 'draft'
}

const CONFIG = {
  published: {
    label: 'Publié',
    className: 'bg-emerald-500/20 text-emerald-400',
  },
  pending: {
    label: 'En attente',
    className: 'bg-amber-500/20 text-amber-400',
  },
  draft: {
    label: 'Brouillon',
    className: 'bg-gray-200 text-zinc-500',
  },
} as const

export default function StatusBadge({ status }: StatusBadgeProps) {
  const { label, className } = CONFIG[status]
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${className}`}
    >
      {label}
    </span>
  )
}
