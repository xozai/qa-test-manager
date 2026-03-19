import { useState } from 'react'
import { Plus, Pencil, Trash2, Users } from 'lucide-react'
import type { User, UserRole } from '../../types'
import Badge from '../common/Badge'
import Modal from '../common/Modal'
import ConfirmDialog from '../common/ConfirmDialog'

interface UserManagementProps {
  users: User[]
  onSave: (user: User) => void
  onDelete: (id: string) => void
}

function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

const ALL_ROLES: UserRole[] = ['BSA', 'Dev', 'QA', 'UAT', 'BAT']

export default function UserManagement({ users, onSave, onDelete }: UserManagementProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [roles, setRoles] = useState<UserRole[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  function openCreate() { setEditingUser(null); setName(''); setEmail(''); setRoles([]); setErrors({}); setModalOpen(true) }
  function openEdit(user: User) { setEditingUser(user); setName(user.name); setEmail(user.email); setRoles([...user.roles]); setErrors({}); setModalOpen(true) }
  function toggleRole(role: UserRole) { setRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]) }

  function validate() {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Required'
    if (!email.trim()) e.email = 'Required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Invalid email'
    const conflict = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase() && u.id !== editingUser?.id)
    if (conflict) e.email = 'Email already in use'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSave() {
    if (!validate()) return
    onSave({ id: editingUser?.id ?? genId(), name: name.trim(), email: email.trim().toLowerCase(), roles })
    setModalOpen(false)
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
          <p className="text-sm text-zinc-500 mt-0.5">{users.length} member{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          Add Member
        </button>
      </div>

      {users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-4" />
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">No team members yet</p>
          <p className="text-sm text-zinc-400 dark:text-zinc-600 mt-1">Add members to assign ownership and track test runs</p>
          <button onClick={openCreate}
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors">
            Add Member
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
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group">
                    <td className="px-5 py-3 font-medium text-zinc-800 dark:text-zinc-200">{user.name}</td>
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
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(user)}
                          className="p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteTarget(user)}
                          className="p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}
        title={editingUser ? 'Edit Member' : 'Add Team Member'} size="sm"
        footer={
          <>
            <button onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors">
              Cancel
            </button>
            <button onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors">
              {editingUser ? 'Save Changes' : 'Add Member'}
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
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" type="email" className={fieldCls(errors.email)} />
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
                        : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                    }`}>
                    {role}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-2">Select all that apply</p>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) { onDelete(deleteTarget.id); setDeleteTarget(null) } }}
        title="Remove Team Member"
        message={`Remove "${deleteTarget?.name}"? Suite ownership and run assignments referencing this user will show as unassigned.`}
        confirmLabel="Remove Member" danger
      />
    </div>
  )
}
