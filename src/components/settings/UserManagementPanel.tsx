import { useState } from 'react'
import { UserPlus, Pencil, Check, X, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react'
import type { User, UserRole } from '../../types'

interface UserManagementPanelProps {
  users: User[]
  onUpdateUser: (id: string, data: Partial<Omit<User, 'id'>>) => Promise<void>
  onSetUserActive: (id: string, isActive: boolean) => Promise<void>
  onInviteUser: (email: string, name: string, roles: UserRole[]) => Promise<void>
}

const ALL_ROLES: UserRole[] = ['BSA', 'Dev', 'QA', 'UAT', 'BAT']

function RoleCheckboxes({ roles, onChange }: { roles: UserRole[]; onChange: (r: UserRole[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ALL_ROLES.map(r => {
        const on = roles.includes(r)
        return (
          <button
            key={r}
            onClick={() => onChange(on ? roles.filter(x => x !== r) : [...roles, r])}
            className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
              on ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-zinc-300 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400 hover:border-indigo-400'
            }`}
          >
            {r}
          </button>
        )
      })}
    </div>
  )
}

export default function UserManagementPanel({ users, onUpdateUser, onSetUserActive, onInviteUser }: UserManagementPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRoles, setEditRoles] = useState<UserRole[]>([])
  const [editSaving, setEditSaving] = useState(false)

  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRoles, setInviteRoles] = useState<UserRole[]>(['QA'])
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')

  function startEdit(user: User) {
    setEditingId(user.id)
    setEditRoles([...user.roles])
  }

  async function saveEdit(id: string) {
    setEditSaving(true)
    await onUpdateUser(id, { roles: editRoles })
    setEditSaving(false)
    setEditingId(null)
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteError('')
    try {
      await onInviteUser(inviteEmail.trim(), inviteName.trim() || inviteEmail.split('@')[0], inviteRoles)
      setInviteEmail('')
      setInviteName('')
      setInviteRoles(['QA'])
      setShowInvite(false)
    } catch (err) {
      setInviteError((err as Error).message)
    }
    setInviting(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{users.length} team member{users.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowInvite(v => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
        >
          <UserPlus className="w-4 h-4" />Invite User
        </button>
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-5 space-y-3">
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Invite new team member</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Email <span className="text-red-400">*</span></label>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="user@company.com"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Name</label>
              <input
                type="text"
                value={inviteName}
                onChange={e => setInviteName(e.target.value)}
                placeholder="Full name"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Roles</label>
            <RoleCheckboxes roles={inviteRoles} onChange={setInviteRoles} />
          </div>
          {inviteError && <p className="text-xs text-red-500">{inviteError}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleInvite()}
              disabled={!inviteEmail.trim() || inviting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-lg transition-colors"
            >
              {inviting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Send Invite
            </button>
            <button onClick={() => setShowInvite(false)} className="px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* User list */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60">
            <tr>
              {['Name', 'Email', 'Roles', 'Status', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 group">
                <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200">{user.name}</td>
                <td className="px-4 py-3 text-zinc-500">{user.email}</td>
                <td className="px-4 py-3">
                  {editingId === user.id ? (
                    <RoleCheckboxes roles={editRoles} onChange={setEditRoles} />
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map(r => (
                        <span key={r} className="px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-500/10 text-indigo-500">{r}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => void onSetUserActive(user.id, !(user.isActive ?? true))}
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full transition-colors ${
                      (user.isActive ?? true)
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'
                    }`}
                  >
                    {(user.isActive ?? true)
                      ? <><ToggleRight className="w-3.5 h-3.5" />Active</>
                      : <><ToggleLeft className="w-3.5 h-3.5" />Inactive</>}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {editingId === user.id ? (
                      <>
                        <button
                          onClick={() => void saveEdit(user.id)}
                          disabled={editSaving}
                          className="p-1.5 rounded-md text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                        >
                          {editSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1.5 rounded-md text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => startEdit(user)}
                        className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
