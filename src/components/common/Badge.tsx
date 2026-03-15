import { cn } from '../../utils/cn'
import type { Priority, TestStatus } from '../../types'

type BadgeVariant = 'priority' | 'status' | 'role'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  value?: Priority | TestStatus | string
  className?: string
}

const PRIORITY_STYLES: Record<Priority, string> = {
  High: 'bg-red-500/15 text-red-400 border-red-500/30',
  Med:  'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  Low:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
}

const STATUS_STYLES: Record<TestStatus, string> = {
  Pass:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Fail:    'bg-red-500/15 text-red-400 border-red-500/30',
  Blocked: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  Skipped: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  'Not Run': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Untested: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
}

const ROLE_STYLES: Record<string, string> = {
  BSA: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  Dev: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  QA:  'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  UAT: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
  BAT: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
}

export default function Badge({ children, variant, value, className }: BadgeProps) {
  let colorClass = 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'

  if (variant === 'priority' && value) {
    colorClass = PRIORITY_STYLES[value as Priority] ?? colorClass
  } else if (variant === 'status' && value) {
    colorClass = STATUS_STYLES[value as TestStatus] ?? colorClass
  } else if (variant === 'role' && value) {
    colorClass = ROLE_STYLES[value] ?? colorClass
  }

  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border', colorClass, className)}>
      {children}
    </span>
  )
}
