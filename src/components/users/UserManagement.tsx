import { useState } from 'react'
import { Plus, Pencil, Trash2, Users, Clock, CheckCircle2, MailOpen } from 'lucide-react'
import type { User, UserRole } from '../../types'
import Badge from '../common/Badge'
import Modal from '../common/Modal'
import ConfirmDialog from '../common/ConfirmDialog'

interface UserManagementProps {
  users: User[]
  currentUserEmail?: string
  onSave: (user: { id: string; name: string; email: string; roles: UserRole[] }) => void
  onRemoveAccess: (authId: string) => Promise<void>
  onInvite: (email: string, name: string, roles: UserRole[]) => Promise<void>
}

function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

const ALL_ROLES: UserRole[] = ['BSA', 'Dev', 'QA', 'UAT', 'BAT']

function formatDate(iso?: string | null) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function UserManagement({
  users, currentUserEmail, onSave, onRemoveAccess, onInvite,
}: UserManagementProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'invite' | 'edit'>('invite')
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [roles, setRoles] = useState<UserRole[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  function openInvite() {
    setModalMode('invite'); setEditingUser(null)
    setName(''); setEmail(''); setRoles([]); setErrors({})
    setModalOpen(true)
  }

  function openEdit(user: User) {
    setModalMode('edit'); setEditingUser(user)
    setName(user.name); setEmail(user.email); setRoles([...user.roles]); setErrors({})
    setModalOpen(true)
  }

  function toggleRole(role: UserRole) {
    setRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role])
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Required'
    if (!email.trim()) e.email = 'Required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Invalid email'
    if (modalMode === 'invite') {
      const conflict = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase())
      if (conflict) e.email = 'User already exists'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    try {
      if (modalMode === 'invite') {
        await onInvite(email.trim().toLowerCase(), name.trim(), roles)
      } else if (editingUser) {
        onSave({ id: editingUser.id ?? genId(), name: name.trim(), email: email.trim().toLowerCase(), roles })
      }
      setModalOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const fieldCls = (err?: string) =>
    `w-full bg-zinc-50 dark:bg-zinc-800 border ${err ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700'} rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 ${err ? 'focus:ring-red-500' : 'focus:ring-indigo-500'} focus:border-transparent transition-colors`

  const labelCls = 'block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1'

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Team Members</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{users.length} member{users.length !== 1 ? 's' : ''} with app access</p>
        </div>
        <button onClick={openInvite}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          Invite Member
        </button>
      </div>

      {users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-4" />
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">No team members yet</p>
          <p className="text-sm text-zinc-400 dark:text-zinc-600 mt-1">Invite members to give them access to this workspace</p>
          <button onClick={openInvite}
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors">
            Invite Member
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Roles</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Last Sign-in</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map(user => {
                  const isCurrentUser = user.email === currentUserEmail
                  const isPending = !user.confirmedAt
                  return (
                    <tr key={user.id} className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-zinc-800 dark:text-zinc-200">{user.name}</span>
                          {isCurrentUser && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500">You</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">{user.email}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {user.roles.length > 0 ? (
                            user.roles.map(role => <Badge key={role} variant="role" value={role}>{role}</Badge>)
                          ) : (
                            <span className="text-zinc-400 dark:text-zinc-600 text-xs">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                            <MailOpen className="w-3 h-3" />
                            Invite Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            Confirmed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                          <Clock className="w-3 h-3" />
                          {formatDate(user.lastSignIn)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(user)}
                            className="p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md transition-colors"
                            title="Edit roles">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {!isCurrentUser && (
                            <button onClick={() => setDeleteTarget(user)}
                              className="p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                              title="Remove access">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}
        title={modalMode === 'invite' ? 'Invite Team Member' : 'Edit Member'}
        size="sm"
        footer={
          <>
            <button onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors">
              Cancel
            </button>
            <button onClick={() => void handleSave()} disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg transition-colors">
              {saving ? 'Saving…' : modalMode === 'invite' ? 'Send Invite' : 'Save Changes'}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <label className={labelCls}>Name <span className="text-red-400">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Jane Smith" className={fieldCls(errors.name)} />
            {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className={labelCls}>Email <span className="text-red-400">*</span></label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" type="email"
              disabled={modalMode === 'edit'}
              className={fieldCls(errors.email) + (modalMode === 'edit' ? ' opacity-50 cursor-not-allowed' : '')} />
            {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}
          </div>
          <div>
            <label className={labelCls}>Roles</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {ALL_ROLES.map(role => {
                const checked = roles.includes(role)
                return (
                  <button key={role} type="button" onClick={() => toggleRole(role)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      checked
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500'
                    }`}>
                    {role}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-2">Select all that apply</p>
          </div>
          {modalMode === 'invite' && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3">
              An invitation email will be sent. The user must accept it to gain access.
            </p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget?.authId) {
            await onRemoveAccess(deleteTarget.authId)
          }
          setDeleteTarget(null)
        }}
        title="Remove Access"
        message={`Remove "${deleteTarget?.name}" (${deleteTarget?.email}) from this workspace? They will no longer be able to sign in.`}
        confirmLabel="Remove Access" danger
      />
    </div>
  )
}
