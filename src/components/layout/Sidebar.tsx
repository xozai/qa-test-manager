import { LayoutDashboard, FlaskConical, FolderOpen, Play, Users, ChevronRight, LogOut, Sun, Moon } from 'lucide-react'
import { cn } from '../../utils/cn'

export type View = 'dashboard' | 'testcases' | 'testsuites' | 'testrunner' | 'users'

interface NavItem {
  id: View
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}

interface SidebarProps {
  currentView: View
  onNavigate: (view: View) => void
  testCaseCount: number
  testSuiteCount: number
  onSignOut?: () => void
  theme?: 'light' | 'dark'
  onToggleTheme?: () => void
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',  label: 'Dashboard',   icon: LayoutDashboard },
  { id: 'testcases',  label: 'Test Cases',  icon: FlaskConical },
  { id: 'testsuites', label: 'Test Suites', icon: FolderOpen },
  { id: 'testrunner', label: 'Test Runner', icon: Play },
  { id: 'users',      label: 'Users',       icon: Users },
]

export default function Sidebar({
  currentView, onNavigate, testCaseCount, testSuiteCount, onSignOut, theme, onToggleTheme,
}: SidebarProps) {
  const getBadge = (id: View) => {
    if (id === 'testcases')  return testCaseCount
    if (id === 'testsuites') return testSuiteCount
    return undefined
  }

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col z-20">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-zinc-200 dark:border-zinc-800">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
          <FlaskConical className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">QA Manager</p>
          <p className="text-xs text-zinc-500 truncate">Test Management</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-2 mb-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">Navigation</p>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = currentView === item.id
          const badge = getBadge(item.id)

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
              )}
            >
              <Icon className={cn(
                'w-4 h-4 flex-shrink-0',
                isActive ? 'text-white' : 'text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-300'
              )} />
              <span className="flex-1 text-left">{item.label}</span>
              {badge !== undefined && badge > 0 && (
                <span className={cn(
                  'text-xs font-semibold px-1.5 py-0.5 rounded-full',
                  isActive
                    ? 'bg-indigo-500 text-white'
                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                )}>
                  {badge}
                </span>
              )}
              {isActive && <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-60" />}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-zinc-200 dark:border-zinc-800 space-y-1">
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {theme === 'dark'
              ? <Sun className="w-4 h-4 flex-shrink-0" />
              : <Moon className="w-4 h-4 flex-shrink-0" />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        )}
        {onSignOut && (
          <button
            onClick={onSignOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span>Sign Out</span>
          </button>
        )}
        <p className="px-3 text-xs text-zinc-400 dark:text-zinc-600">v0.1.0 &mdash; Supabase</p>
      </div>
    </aside>
  )
}
