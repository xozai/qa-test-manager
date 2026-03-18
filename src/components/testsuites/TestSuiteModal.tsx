import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import Modal from '../common/Modal'
import type { TestSuite, User, AttributeDef } from '../../types'

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
  const [attributes, setAttributes] = useState<AttributeDef[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isOpen) return
    if (testSuite) {
      setName(testSuite.name)
      setDescription(testSuite.description)
      setOwnerId(testSuite.ownerId)
      setJiraNumber(testSuite.jiraNumber)
      setIsHidden(testSuite.isHidden)
      setAttributes(testSuite.attributes ?? [])
    } else {
      setName('')
      setDescription('')
      setOwnerId(users[0]?.id ?? '')
      setJiraNumber('')
      setIsHidden(false)
      setAttributes([])
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
      attributes,
      createdAt: testSuite?.createdAt ?? new Date().toISOString(),
    }
    onSave(saved)
    onClose()
  }

  // Attribute management
  function addAttr() {
    setAttributes(prev => [...prev, { id: genId(), name: '', type: 'text' }])
  }

  function removeAttr(i: number) {
    setAttributes(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateAttr(i: number, patch: Partial<AttributeDef>) {
    setAttributes(prev => prev.map((a, idx) => idx === i ? { ...a, ...patch } : a))
  }

  const fieldCls = (err?: string) =>
    `w-full bg-zinc-800 border ${err ? 'border-red-500' : 'border-zinc-700'} rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 ${err ? 'focus:ring-red-500' : 'focus:ring-indigo-500'} focus:border-transparent transition-colors`

  const labelCls = 'block text-xs font-medium text-zinc-400 mb-1'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Test Suite' : 'New Test Suite'}
      size="lg"
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

        {/* Custom Attribute Definitions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs font-medium text-zinc-400">Custom Attributes</p>
              <p className="text-xs text-zinc-600 mt-0.5">Applied to all test cases in this suite</p>
            </div>
            <button
              type="button"
              onClick={addAttr}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Attribute
            </button>
          </div>

          {attributes.length === 0 ? (
            <p className="text-xs text-zinc-600 py-3 text-center border border-dashed border-zinc-700 rounded-lg">
              No custom attributes yet
            </p>
          ) : (
            <div className="space-y-2">
              {attributes.map((attr, i) => (
                <div
                  key={attr.id}
                  className="flex gap-2 items-start p-3 bg-zinc-800/60 border border-zinc-700/60 rounded-lg"
                >
                  {/* Name */}
                  <input
                    value={attr.name}
                    onChange={e => updateAttr(i, { name: e.target.value })}
                    placeholder="Attribute name"
                    className="flex-1 bg-zinc-700 border border-zinc-600 rounded-md px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent transition-colors"
                  />

                  {/* Type */}
                  <select
                    value={attr.type}
                    onChange={e => updateAttr(i, { type: e.target.value as AttributeDef['type'], options: undefined })}
                    className="bg-zinc-700 border border-zinc-600 rounded-md px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent transition-colors"
                  >
                    <option value="text">Text</option>
                    <option value="select">Select</option>
                    <option value="boolean">Boolean</option>
                  </select>

                  {/* Options (only for select type) */}
                  {attr.type === 'select' && (
                    <input
                      value={attr.options?.join(', ') ?? ''}
                      onChange={e => updateAttr(i, {
                        options: e.target.value.split(',').map(o => o.trim()).filter(Boolean),
                      })}
                      placeholder="opt1, opt2, opt3"
                      className="flex-1 bg-zinc-700 border border-zinc-600 rounded-md px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent transition-colors"
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => removeAttr(i)}
                    className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
