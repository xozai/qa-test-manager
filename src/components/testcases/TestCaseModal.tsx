import { useState, useEffect } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import Modal from '../common/Modal'
import type { TestCase, TestStep, TestSuite, Priority, TestStatus } from '../../types'

interface TestCaseModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (tc: TestCase) => void
  testCase?: TestCase | null
  testSuites: TestSuite[]
  existingIds: string[]
}

function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function suggestCaseId(existingIds: string[]): string {
  const nums = existingIds
    .map(id => {
      const m = id.match(/^TC-?(\d+)$/i)
      return m ? parseInt(m[1], 10) : null
    })
    .filter((n): n is number => n !== null)
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
  return `TC-${String(next).padStart(3, '0')}`
}

const PRIORITIES: Priority[] = ['High', 'Med', 'Low']
const STATUSES: TestStatus[] = ['Not Run', 'Pass', 'Fail', 'Blocked', 'Skipped']

const EMPTY_STEP: TestStep = { action: '', expectedResult: '' }

export default function TestCaseModal({
  isOpen,
  onClose,
  onSave,
  testCase,
  testSuites,
  existingIds,
}: TestCaseModalProps) {
  const isEdit = !!testCase

  const [testCaseId, setTestCaseId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [preconditions, setPreconditions] = useState('')
  const [testData, setTestData] = useState('')
  const [priority, setPriority] = useState<Priority>('Med')
  const [testSuiteId, setTestSuiteId] = useState('')
  const [qaStatus, setQaStatus] = useState<TestStatus>('Not Run')
  const [uatStatus, setUatStatus] = useState<TestStatus>('Not Run')
  const [batStatus, setBatStatus] = useState<TestStatus>('Not Run')
  const [steps, setSteps] = useState<TestStep[]>([{ ...EMPTY_STEP }])
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isOpen) return
    if (testCase) {
      setTestCaseId(testCase.testCaseId)
      setTitle(testCase.title)
      setDescription(testCase.description)
      setPreconditions(testCase.preconditions)
      setTestData(testCase.testData)
      setPriority(testCase.priority)
      setTestSuiteId(testCase.testSuiteId)
      setQaStatus(testCase.qaStatus)
      setUatStatus(testCase.uatStatus)
      setBatStatus(testCase.batStatus)
      setSteps(testCase.steps.length > 0 ? testCase.steps : [{ ...EMPTY_STEP }])
    } else {
      const othersIds = existingIds
      setTestCaseId(suggestCaseId(othersIds))
      setTitle('')
      setDescription('')
      setPreconditions('')
      setTestData('')
      setPriority('Med')
      setTestSuiteId(testSuites.find(s => !s.isHidden)?.id ?? testSuites[0]?.id ?? '')
      setQaStatus('Not Run')
      setUatStatus('Not Run')
      setBatStatus('Not Run')
      setSteps([{ ...EMPTY_STEP }])
    }
    setErrors({})
  }, [isOpen, testCase])

  function validate() {
    const e: Record<string, string> = {}
    if (!testCaseId.trim()) e.testCaseId = 'Required'
    if (!title.trim()) e.title = 'Required'
    if (!testSuiteId) e.testSuiteId = 'Required'
    const hasDuplicateId =
      !isEdit
        ? existingIds.includes(testCaseId.trim())
        : existingIds.filter(id => id !== testCase?.testCaseId).includes(testCaseId.trim())
    if (hasDuplicateId) e.testCaseId = 'ID already exists'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSave() {
    if (!validate()) return
    const now = new Date().toISOString()
    const saved: TestCase = {
      id: testCase?.id ?? genId(),
      testCaseId: testCaseId.trim(),
      title: title.trim(),
      description: description.trim(),
      preconditions: preconditions.trim(),
      testData: testData.trim(),
      priority,
      testSuiteId,
      qaStatus,
      uatStatus,
      batStatus,
      steps: steps.filter(s => s.action.trim() || s.expectedResult.trim()),
      createdAt: testCase?.createdAt ?? now,
      updatedAt: now,
    }
    onSave(saved)
    onClose()
  }

  // Steps management
  function addStep() {
    setSteps(prev => [...prev, { ...EMPTY_STEP }])
  }

  function removeStep(i: number) {
    setSteps(prev => prev.length === 1 ? [{ ...EMPTY_STEP }] : prev.filter((_, idx) => idx !== i))
  }

  function updateStep(i: number, field: keyof TestStep, value: string) {
    setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }

  function moveStep(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= steps.length) return
    setSteps(prev => {
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  const visibleSuites = testSuites.filter(s => !s.isHidden)

  const fieldCls = (err?: string) =>
    `w-full bg-zinc-800 border ${err ? 'border-red-500' : 'border-zinc-700'} rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 ${err ? 'focus:ring-red-500' : 'focus:ring-indigo-500'} focus:border-transparent transition-colors`

  const labelCls = 'block text-xs font-medium text-zinc-400 mb-1'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Test Case' : 'New Test Case'}
      size="xl"
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
            {isEdit ? 'Save Changes' : 'Create Test Case'}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Row 1: ID + Title */}
        <div className="grid grid-cols-[140px_1fr] gap-4">
          <div>
            <label className={labelCls}>
              Case ID <span className="text-red-400">*</span>
            </label>
            <input
              value={testCaseId}
              onChange={e => setTestCaseId(e.target.value)}
              placeholder="TC-001"
              className={fieldCls(errors.testCaseId)}
            />
            {errors.testCaseId && (
              <p className="text-xs text-red-400 mt-1">{errors.testCaseId}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>
              Title <span className="text-red-400">*</span>
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Brief description of what is being tested"
              className={fieldCls(errors.title)}
            />
            {errors.title && (
              <p className="text-xs text-red-400 mt-1">{errors.title}</p>
            )}
          </div>
        </div>

        {/* Row 2: Suite + Priority */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>
              Test Suite <span className="text-red-400">*</span>
            </label>
            <select
              value={testSuiteId}
              onChange={e => setTestSuiteId(e.target.value)}
              className={fieldCls(errors.testSuiteId)}
            >
              <option value="">— Select suite —</option>
              {visibleSuites.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {errors.testSuiteId && (
              <p className="text-xs text-red-400 mt-1">{errors.testSuiteId}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Priority</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as Priority)}
              className={fieldCls()}
            >
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {/* Row 3: Status row */}
        <div className="grid grid-cols-3 gap-4">
          {([
            ['QA Status', qaStatus, setQaStatus],
            ['UAT Status', uatStatus, setUatStatus],
            ['BAT Status', batStatus, setBatStatus],
          ] as [string, TestStatus, (v: TestStatus) => void][]).map(([label, val, setter]) => (
            <div key={label}>
              <label className={labelCls}>{label}</label>
              <select
                value={val}
                onChange={e => setter(e.target.value as TestStatus)}
                className={fieldCls()}
              >
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          ))}
        </div>

        {/* Description */}
        <div>
          <label className={labelCls}>Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            placeholder="What does this test case verify?"
            className={`${fieldCls()} resize-none`}
          />
        </div>

        {/* Preconditions + Test Data */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Preconditions</label>
            <textarea
              value={preconditions}
              onChange={e => setPreconditions(e.target.value)}
              rows={2}
              placeholder="Required state before execution"
              className={`${fieldCls()} resize-none`}
            />
          </div>
          <div>
            <label className={labelCls}>Test Data</label>
            <textarea
              value={testData}
              onChange={e => setTestData(e.target.value)}
              rows={2}
              placeholder="Inputs, credentials, or fixtures needed"
              className={`${fieldCls()} resize-none`}
            />
          </div>
        </div>

        {/* Steps */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-medium text-zinc-400">
              Test Steps
              <span className="ml-1.5 text-zinc-600">({steps.length})</span>
            </label>
            <button
              onClick={addStep}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Step
            </button>
          </div>

          <div className="space-y-2">
            {steps.map((step, i) => (
              <div
                key={i}
                className="flex gap-2 p-3 bg-zinc-800/60 border border-zinc-700/60 rounded-lg group/step"
              >
                {/* Step number + reorder */}
                <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-1">
                  <span className="text-xs font-mono text-zinc-600 w-5 text-center">{i + 1}</span>
                  <button
                    onClick={() => moveStep(i, -1)}
                    disabled={i === 0}
                    className="p-0.5 text-zinc-600 hover:text-zinc-300 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => moveStep(i, 1)}
                    disabled={i === steps.length - 1}
                    className="p-0.5 text-zinc-600 hover:text-zinc-300 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Action + Expected */}
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Action</p>
                    <textarea
                      value={step.action}
                      onChange={e => updateStep(i, 'action', e.target.value)}
                      rows={2}
                      placeholder="What to do..."
                      className="w-full bg-zinc-700/60 border border-zinc-600/60 rounded-md px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent resize-none transition-colors"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Expected Result</p>
                    <textarea
                      value={step.expectedResult}
                      onChange={e => updateStep(i, 'expectedResult', e.target.value)}
                      rows={2}
                      placeholder="What should happen..."
                      className="w-full bg-zinc-700/60 border border-zinc-600/60 rounded-md px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent resize-none transition-colors"
                    />
                  </div>
                </div>

                {/* Delete step */}
                <button
                  onClick={() => removeStep(i)}
                  className="flex-shrink-0 self-start mt-1 p-1 text-zinc-600 hover:text-red-400 opacity-0 group-hover/step:opacity-100 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
