import { useState, useEffect } from 'react'
import Modal from '../common/Modal'
import type { TestSuite, User } from '../../types'

interface TestSuiteModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (suite: TestSuite) => void
  testSuite?: TestSuite | null
  users: User[]
}

function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export default function TestSuiteModal({
  isOpen,
  onClose,
  onSave,
  testSuite,
  users,
}: TestSuiteModalProps) {
  const isEdit = !!testSuite

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [jiraNumber, setJiraNumber] = useState('')
  const [isHidden, setIsHidden] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isOpen) return
    if (testSuite) {
      setName(testSuite.name)
      setDescription(testSuite.description)
      setOwnerId(testSuite.ownerId)
      setJiraNumber(testSuite.jiraNumber)
      setIsHidden(testSuite.isHidden)
    } else {
      setName('')
      setDescription('')
      setOwnerId(users[0]?.id ?? '')
      setJiraNumber('')
      setIsHidden(false)
    }
    setErrors({})
  }, [isOpen, testSuite])

  function validate() {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSave() {
    if (!validate()) return
    const saved: TestSuite = {
      id: testSuite?.id ?? genId(),
      name: name.trim(),
      description: description.trim(),
      ownerId,
      jiraNumber: jiraNumber.trim(),
      isHidden,
      createdAt: testSuite?.createdAt ?? new Date().toISOString(),
    }
    onSave(saved)
    onClose()
  }

  const fieldCls = (err?: string) =>
    `w-full bg-zinc-800 border ${err ? 'border-red-500' : 'border-zinc-700'} rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 ${err ? 'focus:ring-red-500' : 'focus:ring-indigo-500'} focus:border-transparent transition-colors`

  const labelCls = 'block text-xs font-medium text-zinc-400 mb-1'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Test Suite' : 'New Test Suite'}
      size="md"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
          >
            {isEdit ? 'Save Changes' : 'Create Suite'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <label className={labelCls}>
            Name <span className="text-red-400">*</span>
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Authentication & Login"
            className={fieldCls(errors.name)}
          />
          {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
        </div>

        <div>
          <label className={labelCls}>Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="What does this suite cover?"
            className={`${fieldCls()} resize-none`}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Owner</label>
            <select
              value={ownerId}
              onChange={e => setOwnerId(e.target.value)}
              className={fieldCls()}
            >
              <option value="">— No owner —</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Jira Number</label>
            <input
              value={jiraNumber}
              onChange={e => setJiraNumber(e.target.value)}
              placeholder="e.g. PROJ-123"
              className={fieldCls()}
            />
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div className="relative">
            <input
              type="checkbox"
              checked={isHidden}
              onChange={e => setIsHidden(e.target.checked)}
              className="sr-only"
            />
            <div className={`w-9 h-5 rounded-full transition-colors ${isHidden ? 'bg-indigo-600' : 'bg-zinc-700'}`} />
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isHidden ? 'translate-x-4' : 'translate-x-0'}`} />
          </div>
          <span className="text-sm text-zinc-300">Hide suite from test case views</span>
        </label>
      </div>
    </Modal>
  )
}
