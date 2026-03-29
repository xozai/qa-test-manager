import { useState } from 'react'
import { Users, User as UserIcon, Palette } from 'lucide-react'
import type { User, UserRole } from '../../types'
import UserManagementPanel from './UserManagementPanel'

interface SettingsProps {
  currentUser?: User | null
  users: User[]
  onUpdateUser: (id: string, data: Partial<Omit<User, 'id'>>) => Promise<void>
  onSetUserActive: (id: string, isActive: boolean) => Promise<void>
  onInviteUser: (email: string, name: string, roles: UserRole[]) => Promise<void>
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

type Tab = 'users' | 'profile' | 'appearance'

export default function Settings({
  currentUser, users, onUpdateUser, onSetUserActive, onInviteUser, theme, onToggleTheme,
}: SettingsProps) {
  const [tab, setTab] = useState<Tab>('users')
  const [profileName, setProfileName] = useState(currentUser?.name ?? '')
  const [profileSaving, setProfileSaving] = useState(false)

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'users',      label: 'Users',      icon: Users },
    { id: 'profile',    label: 'Profile',    icon: UserIcon },
    { id: 'appearance', label: 'Appearance', icon: Palette },
  ]

  async function handleSaveProfile() {
    if (!currentUser || !profileName.trim()) return
    setProfileSaving(true)
    await onUpdateUser(currentUser.id, { name: profileName.trim() })
    setProfileSaving(false)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Settings</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Manage your workspace configuration</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === id
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {tab === 'users' && (
        <UserManagementPanel
          users={users}
          onUpdateUser={onUpdateUser}
          onSetUserActive={onSetUserActive}
          onInviteUser={onInviteUser}
        />
      )}

      {/* Profile tab */}
      {tab === 'profile' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 max-w-md space-y-4">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Your Profile</h2>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Display Name</label>
            <input
              type="text"
              value={profileName}
              onChange={e => setProfileName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Email</label>
            <p className="text-sm text-zinc-500">{currentUser?.email ?? '—'}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Roles</label>
            <div className="flex flex-wrap gap-1.5">
              {(currentUser?.roles ?? []).map(r => (
                <span key={r} className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-500">{r}</span>
              ))}
            </div>
          </div>
          <button
            onClick={() => void handleSaveProfile()}
            disabled={!profileName.trim() || profileSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-lg transition-colors"
          >
            {profileSaving ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      )}

      {/* Appearance tab */}
      {tab === 'appearance' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 max-w-md space-y-4">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Appearance</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Theme</p>
              <p className="text-xs text-zinc-500">Currently: {theme === 'dark' ? 'Dark' : 'Light'} mode</p>
            </div>
            <button
              onClick={onToggleTheme}
              className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
            >
              Switch to {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
