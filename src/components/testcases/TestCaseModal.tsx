import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, GitBranch, CornerDownRight, Link, Unlink, Lock, Search, X, AlertTriangle, Sparkles, RefreshCw, Check } from 'lucide-react'
import Modal from '../common/Modal'
import type { TestCase, TestStep, TestSuite, Priority, TestStatus, AttributeDef, InheritanceConfig, User, Comment, ActivityEvent } from '../../types'
import { useEdgeCaseSuggestions } from '../../hooks/useAIAgent'
import CommentsPanel from './CommentsPanel'

interface TestCaseModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (tc: TestCase, propagate: boolean) => void
  onLinkChild: (childId: string, parentId: string, config: Omit<InheritanceConfig, 'id' | 'childId' | 'parentId'>) => void
  onUpdateInheritance: (childId: string, config: Omit<InheritanceConfig, 'id' | 'childId' | 'parentId'>, parentId: string) => void
  onUnlinkChild: (childId: string) => void
  onFetchComments?: (testCaseId: string) => Promise<{ comments: Comment[]; activity: ActivityEvent[] }>
  onAddComment?: (testCaseId: string, body: string) => Promise<void>
  testCase?: TestCase | null
  testSuites: TestSuite[]
  allTestCases: TestCase[]
  existingIds: string[]
  users?: User[]
}

function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function suggestCaseId(existingIds: string[]): string {
  const nums = existingIds
    .map(id => { const m = id.match(/^TC-?(\d+)$/i); return m ? parseInt(m[1], 10) : null })
    .filter((n): n is number => n !== null)
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
  return `TC-${String(next).padStart(3, '0')}`
}

const PRIORITIES: Priority[] = ['High', 'Med', 'Low']
const STATUSES: TestStatus[] = ['Not Run', 'Pass', 'Fail', 'Blocked', 'Skipped']
const EMPTY_STEP: TestStep = { action: '', expectedResult: '' }

type Tab = 'details' | 'steps' | 'attributes' | 'relationships' | 'comments'

// ── InheritedBadge ────────────────────────────────────────────────────────────
function InheritedBadge({ parentTitle }: { parentTitle: string }) {
  return (
    <span
      title={`Inherited from "${parentTitle}". Edit the parent to change it, or update your inheritance settings.`}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-500/15 text-violet-500 dark:text-violet-400 ml-2 cursor-help"
    >
      <Lock className="w-2.5 h-2.5" />
      Inherited
    </span>
  )
}

// ── InheritanceConfigPanel ────────────────────────────────────────────────────
interface InheritancePanelProps {
  config: Omit<InheritanceConfig, 'id' | 'childId' | 'parentId'>
  onChange: (c: Omit<InheritanceConfig, 'id' | 'childId' | 'parentId'>) => void
}
function InheritanceConfigPanel({ config, onChange }: InheritancePanelProps) {
  const fields: [keyof typeof config, string][] = [
    ['inheritPreconditions', 'Inherit Preconditions'],
    ['inheritTestData',      'Inherit Test Data'],
    ['inheritSteps',         'Inherit Steps'],
    ['inheritAttributes',    'Inherit Attribute Values'],
  ]
  return (
    <div className="mt-3 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20 space-y-2">
      {fields.map(([key, label]) => (
        <label key={key} className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={config[key]}
            onChange={e => onChange({ ...config, [key]: e.target.checked })}
            className="w-3.5 h-3.5 rounded border-zinc-400 dark:border-zinc-600 text-violet-600 focus:ring-violet-500"
          />
          <span className="text-xs text-zinc-700 dark:text-zinc-300">{label}</span>
        </label>
      ))}
      <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-1.5 mt-2 pt-2 border-t border-violet-500/20">
        <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
        Inherited fields will be overwritten by the parent's current values immediately and on every future parent update.
      </p>
    </div>
  )
}

export default function TestCaseModal({
  isOpen, onClose, onSave,
  onLinkChild, onUpdateInheritance, onUnlinkChild,
  onFetchComments, onAddComment,
  testCase, testSuites, allTestCases, existingIds, users = [],
}: TestCaseModalProps) {
  const isEdit = !!testCase
  const edgeCases = useEdgeCaseSuggestions()

  const [activeTab, setActiveTab] = useState<Tab>('details')
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
  const [attributeValues, setAttributeValues] = useState<Record<string, string | boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showPropagateConfirm, setShowPropagateConfirm] = useState(false)
  const pendingSaveRef = useRef<TestCase | null>(null)

  // Relationship tab state
  const [parentSearch, setParentSearch] = useState('')
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null)
  const [inhConfig, setInhConfig] = useState<Omit<InheritanceConfig, 'id' | 'childId' | 'parentId'>>({
    inheritPreconditions: false, inheritTestData: false, inheritSteps: false, inheritAttributes: false,
  })
  const [editingChildId, setEditingChildId] = useState<string | null>(null)
  const [editingChildConfig, setEditingChildConfig] = useState<Omit<InheritanceConfig, 'id' | 'childId' | 'parentId'>>({
    inheritPreconditions: false, inheritTestData: false, inheritSteps: false, inheritAttributes: false,
  })
  const [addChildSearch, setAddChildSearch] = useState('')
  const [addChildId, setAddChildId] = useState<string | null>(null)
  const [addChildConfig, setAddChildConfig] = useState<Omit<InheritanceConfig, 'id' | 'childId' | 'parentId'>>({
    inheritPreconditions: false, inheritTestData: false, inheritSteps: false, inheritAttributes: false,
  })
  const [showAddChild, setShowAddChild] = useState(false)

  const inh = testCase?.inheritanceConfig ?? null
  const parentTc = inh ? allTestCases.find(t => t.id === inh.parentId) : null
  const children = testCase ? allTestCases.filter(t => t.parentId === testCase.id) : []

  useEffect(() => {
    if (!isOpen) return
    setActiveTab('details')
    setShowPropagateConfirm(false)
    setSelectedParentId(null)
    setParentSearch('')
    setInhConfig({ inheritPreconditions: false, inheritTestData: false, inheritSteps: false, inheritAttributes: false })
    setEditingChildId(null)
    setShowAddChild(false)
    setAddChildSearch('')
    setAddChildId(null)
    setAddChildConfig({ inheritPreconditions: false, inheritTestData: false, inheritSteps: false, inheritAttributes: false })

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
      setAttributeValues(testCase.attributeValues ?? {})
    } else {
      setTestCaseId(suggestCaseId(existingIds))
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
      setAttributeValues({})
    }
    setErrors({})
  }, [isOpen, testCase])

  function validate() {
    const e: Record<string, string> = {}
    if (!testCaseId.trim()) e.testCaseId = 'Required'
    if (!title.trim()) e.title = 'Required'
    if (!testSuiteId) e.testSuiteId = 'Required'
    const hasDup = !isEdit
      ? existingIds.includes(testCaseId.trim())
      : existingIds.filter(id => id !== testCase?.testCaseId).includes(testCaseId.trim())
    if (hasDup) e.testCaseId = 'ID already exists'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function buildSaved(): TestCase {
    const now = new Date().toISOString()
    return {
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
      attributeValues,
      parentId: testCase?.parentId ?? null,
      createdAt: testCase?.createdAt ?? now,
      updatedAt: now,
    }
  }

  function handleSave() {
    if (!validate()) return
    const saved = buildSaved()
    // If this is a parent with children and editable inherited fields changed → confirm
    if (isEdit && children.length > 0) {
      const hasInheritedEdits = children.some(c => {
        const cfg = c.inheritanceConfig
        if (!cfg) return false
        return (
          (cfg.inheritPreconditions && preconditions.trim() !== testCase?.preconditions) ||
          (cfg.inheritTestData      && testData.trim()      !== testCase?.testData) ||
          (cfg.inheritSteps         && JSON.stringify(steps) !== JSON.stringify(testCase?.steps)) ||
          (cfg.inheritAttributes    && JSON.stringify(attributeValues) !== JSON.stringify(testCase?.attributeValues))
        )
      })
      if (hasInheritedEdits) {
        pendingSaveRef.current = saved
        setShowPropagateConfirm(true)
        return
      }
    }
    onSave(saved, false)
    onClose()
  }

  function confirmPropagate(propagate: boolean) {
    if (pendingSaveRef.current) {
      onSave(pendingSaveRef.current, propagate)
      pendingSaveRef.current = null
    }
    setShowPropagateConfirm(false)
    onClose()
  }

  // Steps
  function addStep() { setSteps(prev => [...prev, { ...EMPTY_STEP }]) }
  function removeStep(i: number) { setSteps(prev => prev.length === 1 ? [{ ...EMPTY_STEP }] : prev.filter((_, idx) => idx !== i)) }
  function updateStep(i: number, field: keyof TestStep, value: string) {
    setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }
  function moveStep(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= steps.length) return
    setSteps(prev => { const next = [...prev]; [next[i], next[j]] = [next[j], next[i]]; return next })
  }

  const visibleSuites = testSuites.filter(s => !s.isHidden)
  const selectedSuite = testSuites.find(s => s.id === testSuiteId)
  const suiteAttrs: AttributeDef[] = selectedSuite?.attributes ?? []

  function setAttrValue(id: string, value: string | boolean) {
    setAttributeValues(prev => ({ ...prev, [id]: value }))
  }

  const fieldCls = (err?: string, locked = false) =>
    `w-full border rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 transition-colors ${
      locked
        ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-300 dark:border-violet-700 cursor-not-allowed opacity-75'
        : `bg-zinc-50 dark:bg-zinc-800 ${err ? 'border-red-500 focus:ring-red-500' : 'border-zinc-300 dark:border-zinc-700 focus:ring-indigo-500'} focus:border-transparent`
    }`

  const labelCls = 'block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1'

  // Eligibility for parent search (flat hierarchy: no chaining)
  function eligibleParents(query: string) {
    const q = query.toLowerCase()
    return allTestCases.filter(t => {
      if (t.id === testCase?.id) return false        // not itself
      if (t.parentId)            return false        // already a child
      if (testCase && t.parentId === testCase.id) return false // already our child
      return t.testCaseId.toLowerCase().includes(q) || t.title.toLowerCase().includes(q)
    }).slice(0, 8)
  }

  // Eligibility for adding a child
  function eligibleChildren(query: string) {
    const q = query.toLowerCase()
    return allTestCases.filter(t => {
      if (t.id === testCase?.id) return false
      if (t.parentId && t.parentId !== testCase?.id) return false // already a child of another
      if (t.isParent) return false                                 // is itself a parent
      if (children.some(c => c.id === t.id)) return false         // already our child
      return t.testCaseId.toLowerCase().includes(q) || t.title.toLowerCase().includes(q)
    }).slice(0, 8)
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'details',       label: 'Details' },
    { id: 'steps',         label: `Steps (${steps.filter(s => s.action.trim()).length || steps.length})` },
    { id: 'attributes',    label: 'Attributes' },
    { id: 'relationships', label: children.length > 0 ? `Relationships (${children.length})` : inh ? 'Relationships ↑' : 'Relationships' },
    ...(isEdit && onFetchComments ? [{ id: 'comments' as Tab, label: 'Comments & Activity' }] : []),
  ]

  return (
    <>
      <Modal
        isOpen={isOpen && !showPropagateConfirm}
        onClose={onClose}
        title={isEdit ? 'Edit Test Case' : 'New Test Case'}
        size="xl"
        footer={
          <>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
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
        {/* Tab bar */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 -mx-6 px-6 mb-6">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── DETAILS TAB ── */}
        {activeTab === 'details' && (
          <div className="space-y-5">
            <div className="grid grid-cols-[140px_1fr] gap-4">
              <div>
                <label className={labelCls}>Case ID <span className="text-red-400">*</span></label>
                <input value={testCaseId} onChange={e => setTestCaseId(e.target.value)} placeholder="TC-001" className={fieldCls(errors.testCaseId)} />
                {errors.testCaseId && <p className="text-xs text-red-400 mt-1">{errors.testCaseId}</p>}
              </div>
              <div>
                <label className={labelCls}>Title <span className="text-red-400">*</span></label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Brief description of what is being tested" className={fieldCls(errors.title)} />
                {errors.title && <p className="text-xs text-red-400 mt-1">{errors.title}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Test Suite <span className="text-red-400">*</span></label>
                <select value={testSuiteId} onChange={e => setTestSuiteId(e.target.value)} className={fieldCls(errors.testSuiteId)}>
                  <option value="">— Select suite —</option>
                  {visibleSuites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {errors.testSuiteId && <p className="text-xs text-red-400 mt-1">{errors.testSuiteId}</p>}
              </div>
              <div>
                <label className={labelCls}>Priority</label>
                <select value={priority} onChange={e => setPriority(e.target.value as Priority)} className={fieldCls()}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {([['QA Status', qaStatus, setQaStatus], ['UAT Status', uatStatus, setUatStatus], ['BAT Status', batStatus, setBatStatus]] as [string, TestStatus, (v: TestStatus) => void][]).map(([lbl, val, setter]) => (
                <div key={lbl}>
                  <label className={labelCls}>{lbl}</label>
                  <select value={val} onChange={e => setter(e.target.value as TestStatus)} className={fieldCls()}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div>
              <label className={labelCls}>Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="What does this test case verify?" className={`${fieldCls()} resize-none`} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  Preconditions
                  {inh?.inheritPreconditions && parentTc && <InheritedBadge parentTitle={parentTc.title} />}
                </label>
                <textarea
                  value={preconditions}
                  onChange={e => setPreconditions(e.target.value)}
                  rows={2}
                  placeholder="Required state before execution"
                  disabled={!!inh?.inheritPreconditions}
                  className={`${fieldCls(undefined, !!inh?.inheritPreconditions)} resize-none`}
                />
              </div>
              <div>
                <label className={labelCls}>
                  Test Data
                  {inh?.inheritTestData && parentTc && <InheritedBadge parentTitle={parentTc.title} />}
                </label>
                <textarea
                  value={testData}
                  onChange={e => setTestData(e.target.value)}
                  rows={2}
                  placeholder="Inputs, credentials, or fixtures needed"
                  disabled={!!inh?.inheritTestData}
                  className={`${fieldCls(undefined, !!inh?.inheritTestData)} resize-none`}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── STEPS TAB ── */}
        {activeTab === 'steps' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Test Steps
                <span className="ml-1.5 text-zinc-400 dark:text-zinc-600">({steps.length})</span>
                {inh?.inheritSteps && parentTc && <InheritedBadge parentTitle={parentTc.title} />}
              </label>
              {!inh?.inheritSteps && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => edgeCases.suggest(title, description, steps)}
                    disabled={edgeCases.loading || !title.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-500 bg-violet-500/10 hover:bg-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                    title="Ask AI to suggest edge case steps"
                  >
                    {edgeCases.loading
                      ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      : <Sparkles className="w-3.5 h-3.5" />}
                    {edgeCases.loading ? 'Suggesting…' : 'Suggest Edge Cases'}
                  </button>
                  <button onClick={addStep} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg transition-colors">
                    <Plus className="w-3.5 h-3.5" />Add Step
                  </button>
                </div>
              )}
            </div>
            {inh?.inheritSteps && (
              <p className="text-xs text-violet-600 dark:text-violet-400 mb-3 flex items-center gap-1.5">
                <Lock className="w-3 h-3" />
                Steps are inherited from "{parentTc?.title}". Edit the parent to modify steps.
              </p>
            )}
            <div className="space-y-2">
              {steps.map((step, i) => (
                <div key={i} className={`flex gap-2 p-3 border rounded-lg group/step ${inh?.inheritSteps ? 'bg-violet-50/50 dark:bg-violet-900/10 border-violet-200 dark:border-violet-700/40' : 'bg-zinc-100/60 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700/60'}`}>
                  <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-1">
                    <span className="text-xs font-mono text-zinc-400 dark:text-zinc-600 w-5 text-center">{i + 1}</span>
                    {!inh?.inheritSteps && <>
                      <button onClick={() => moveStep(i, -1)} disabled={i === 0} className="p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"><ChevronUp className="w-3.5 h-3.5" /></button>
                      <button onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1} className="p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"><ChevronDown className="w-3.5 h-3.5" /></button>
                    </>}
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">Action</p>
                      <textarea value={step.action} onChange={e => updateStep(i, 'action', e.target.value)} rows={2} placeholder="What to do..." disabled={!!inh?.inheritSteps} className={`w-full border rounded-md px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none transition-colors ${inh?.inheritSteps ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700 cursor-not-allowed' : 'bg-white dark:bg-zinc-700/60 border-zinc-300 dark:border-zinc-600/60'}`} />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">Expected Result</p>
                      <textarea value={step.expectedResult} onChange={e => updateStep(i, 'expectedResult', e.target.value)} rows={2} placeholder="What should happen..." disabled={!!inh?.inheritSteps} className={`w-full border rounded-md px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none transition-colors ${inh?.inheritSteps ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700 cursor-not-allowed' : 'bg-white dark:bg-zinc-700/60 border-zinc-300 dark:border-zinc-600/60'}`} />
                    </div>
                  </div>
                  {!inh?.inheritSteps && (
                    <button onClick={() => removeStep(i)} className="flex-shrink-0 self-start mt-1 p-1 text-zinc-400 hover:text-red-400 opacity-0 group-hover/step:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              ))}
            </div>

            {/* AI Edge Case Suggestions */}
            {edgeCases.error && (
              <p className="mt-3 text-xs text-red-500 dark:text-red-400">{edgeCases.error}</p>
            )}
            {edgeCases.suggestions.length > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" />
                    AI Suggested Edge Cases ({edgeCases.suggestions.length})
                  </p>
                  <button onClick={edgeCases.clearSuggestions} className="text-[10px] text-violet-500 hover:text-violet-400">Dismiss</button>
                </div>
                <div className="space-y-2">
                  {edgeCases.suggestions.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded bg-white dark:bg-zinc-800 border border-violet-200 dark:border-violet-700/40">
                      <div className="flex-1 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-zinc-400 mb-0.5">Action</p>
                          <p className="text-zinc-700 dark:text-zinc-300">{s.action}</p>
                        </div>
                        <div>
                          <p className="text-zinc-400 mb-0.5">Expected Result</p>
                          <p className="text-zinc-700 dark:text-zinc-300">{s.expectedResult}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSteps(prev => [...prev, { action: s.action, expectedResult: s.expectedResult }])
                          edgeCases.clearSuggestions()
                        }}
                        title="Add this step"
                        className="flex-shrink-0 p-1 rounded text-violet-500 hover:text-violet-400 hover:bg-violet-500/10 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      setSteps(prev => [...prev, ...edgeCases.suggestions.map(s => ({ action: s.action, expectedResult: s.expectedResult }))])
                      edgeCases.clearSuggestions()
                    }}
                    className="w-full mt-1 py-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 rounded-lg transition-colors"
                  >
                    Add All {edgeCases.suggestions.length} Steps
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ATTRIBUTES TAB ── */}
        {activeTab === 'attributes' && (
          <div>
            {suiteAttrs.length === 0 ? (
              <p className="text-sm text-zinc-500 py-8 text-center">No custom attributes defined for the selected suite.</p>
            ) : (
              <>
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-3">
                  Custom Attributes
                  {inh?.inheritAttributes && parentTc && <InheritedBadge parentTitle={parentTc.title} />}
                </p>
                {inh?.inheritAttributes && (
                  <p className="text-xs text-violet-600 dark:text-violet-400 mb-3 flex items-center gap-1.5">
                    <Lock className="w-3 h-3" />Attribute values are inherited from "{parentTc?.title}".
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {suiteAttrs.map(attr => {
                    const val = attributeValues[attr.id]
                    const locked = !!inh?.inheritAttributes
                    return (
                      <div key={attr.id}>
                        <label className={labelCls}>{attr.name || <span className="italic text-zinc-400">Unnamed</span>}</label>
                        {attr.type === 'text' && (
                          <input value={(val as string) ?? ''} onChange={e => setAttrValue(attr.id, e.target.value)} disabled={locked} className={fieldCls(undefined, locked)} placeholder={`Enter ${attr.name || 'value'}`} />
                        )}
                        {attr.type === 'select' && (
                          <select value={(val as string) ?? ''} onChange={e => setAttrValue(attr.id, e.target.value)} disabled={locked} className={fieldCls(undefined, locked)}>
                            <option value="">— Select —</option>
                            {(attr.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        )}
                        {attr.type === 'boolean' && (
                          <label className={`flex items-center gap-3 mt-1.5 ${locked ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'} select-none`}>
                            <div className="relative">
                              <input type="checkbox" checked={!!val} onChange={e => !locked && setAttrValue(attr.id, e.target.checked)} className="sr-only" />
                              <div className={`w-9 h-5 rounded-full transition-colors ${val ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700'}`} />
                              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${val ? 'translate-x-4' : 'translate-x-0'}`} />
                            </div>
                            <span className="text-sm text-zinc-600 dark:text-zinc-400">{val ? 'Yes' : 'No'}</span>
                          </label>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── RELATIONSHIPS TAB ── */}
        {activeTab === 'relationships' && (
          <div className="space-y-5">

            {/* ── IS A CHILD: show parent ── */}
            {inh && parentTc && (
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Parent Test Case</p>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
                  <GitBranch className="w-4 h-4 text-violet-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{parentTc.title}</p>
                    <p className="text-xs text-zinc-500">{parentTc.testCaseId}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {inh.inheritPreconditions && <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-600 dark:text-violet-400">Preconditions</span>}
                    {inh.inheritTestData      && <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-600 dark:text-violet-400">Test Data</span>}
                    {inh.inheritSteps         && <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-600 dark:text-violet-400">Steps</span>}
                    {inh.inheritAttributes    && <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-600 dark:text-violet-400">Attributes</span>}
                  </div>
                </div>

                {/* Edit inheritance config */}
                {editingChildId === 'self' ? (
                  <>
                    <InheritanceConfigPanel config={editingChildConfig} onChange={setEditingChildConfig} />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => { onUpdateInheritance(testCase!.id, editingChildConfig, inh.parentId); setEditingChildId(null) }}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors"
                      >Save Inheritance</button>
                      <button onClick={() => setEditingChildId(null)} className="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">Cancel</button>
                    </div>
                  </>
                ) : (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => { setEditingChildId('self'); setEditingChildConfig({ inheritPreconditions: inh.inheritPreconditions, inheritTestData: inh.inheritTestData, inheritSteps: inh.inheritSteps, inheritAttributes: inh.inheritAttributes }) }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-500 bg-violet-500/10 hover:bg-violet-500/20 rounded-lg transition-colors"
                    >
                      <Link className="w-3.5 h-3.5" />Edit Inheritance
                    </button>
                    <button
                      onClick={() => { if (testCase) onUnlinkChild(testCase.id) }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                    >
                      <Unlink className="w-3.5 h-3.5" />Unlink from Parent
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── IS A PARENT: show children ── */}
            {testCase && children.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Child Test Cases ({children.length})</p>
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-zinc-50 dark:bg-zinc-800/60">
                      <tr>
                        <th className="px-3 py-2 text-left text-zinc-500 font-medium">ID</th>
                        <th className="px-3 py-2 text-left text-zinc-500 font-medium">Title</th>
                        <th className="px-3 py-2 text-left text-zinc-500 font-medium">Inherited</th>
                        <th className="px-3 py-2 text-right text-zinc-500 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                      {children.map(child => {
                        const cfg = child.inheritanceConfig
                        const inherited = [cfg?.inheritPreconditions && 'Preconditions', cfg?.inheritTestData && 'Test Data', cfg?.inheritSteps && 'Steps', cfg?.inheritAttributes && 'Attributes'].filter(Boolean).join(', ') || '—'
                        return (
                          <tr key={child.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                            <td className="px-3 py-2 font-mono text-indigo-400">{child.testCaseId}</td>
                            <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300 max-w-[160px] truncate">{child.title}</td>
                            <td className="px-3 py-2 text-violet-600 dark:text-violet-400">{inherited}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-end gap-1">
                                {editingChildId === child.id ? (
                                  <div className="w-full">
                                    <InheritanceConfigPanel config={editingChildConfig} onChange={setEditingChildConfig} />
                                    <div className="flex gap-2 mt-2">
                                      <button onClick={() => { onUpdateInheritance(child.id, editingChildConfig, testCase.id); setEditingChildId(null) }} className="px-2 py-1 text-[11px] font-medium text-white bg-violet-600 hover:bg-violet-500 rounded transition-colors">Save</button>
                                      <button onClick={() => setEditingChildId(null)} className="px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => { setEditingChildId(child.id); setEditingChildConfig({ inheritPreconditions: cfg?.inheritPreconditions ?? false, inheritTestData: cfg?.inheritTestData ?? false, inheritSteps: cfg?.inheritSteps ?? false, inheritAttributes: cfg?.inheritAttributes ?? false }) }}
                                      className="p-1 text-violet-500 hover:text-violet-400 hover:bg-violet-500/10 rounded transition-colors"
                                      title="Edit inheritance"
                                    ><Link className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => onUnlinkChild(child.id)} className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors" title="Unlink"><Unlink className="w-3.5 h-3.5" /></button>
                                  </>
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

            {/* ── ADD CHILD ── */}
            {testCase && !inh && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Add Child Test Case</p>
                  {!showAddChild && (
                    <button
                      onClick={() => setShowAddChild(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 rounded-lg transition-colors"
                    >
                      <CornerDownRight className="w-3.5 h-3.5" />Add Child
                    </button>
                  )}
                </div>
                {showAddChild && (
                  <div className="p-3 rounded-lg border border-violet-500/20 bg-violet-500/5 space-y-3">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                      <input
                        value={addChildSearch}
                        onChange={e => { setAddChildSearch(e.target.value); setAddChildId(null) }}
                        placeholder="Search by ID or title…"
                        className="w-full pl-8 pr-3 py-2 text-xs bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                    </div>
                    {addChildSearch && !addChildId && (
                      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800 max-h-40 overflow-y-auto">
                        {eligibleChildren(addChildSearch).length === 0
                          ? <p className="px-3 py-2 text-xs text-zinc-400">No eligible test cases found</p>
                          : eligibleChildren(addChildSearch).map(t => (
                            <button key={t.id} onClick={() => { setAddChildId(t.id); setAddChildSearch(`${t.testCaseId}: ${t.title}`) }} className="w-full text-left px-3 py-2 text-xs hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors">
                              <span className="font-mono text-indigo-400">{t.testCaseId}</span>
                              <span className="ml-2 text-zinc-700 dark:text-zinc-300">{t.title}</span>
                            </button>
                          ))
                        }
                      </div>
                    )}
                    {addChildId && (
                      <InheritanceConfigPanel config={addChildConfig} onChange={setAddChildConfig} />
                    )}
                    <div className="flex gap-2">
                      <button
                        disabled={!addChildId}
                        onClick={() => { if (addChildId && testCase) { onLinkChild(addChildId, testCase.id, addChildConfig); setShowAddChild(false); setAddChildSearch(''); setAddChildId(null) } }}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
                      >Link as Child</button>
                      <button onClick={() => { setShowAddChild(false); setAddChildSearch(''); setAddChildId(null) }} className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── LINK TO PARENT (standalone only) ── */}
            {!inh && (!testCase || children.length === 0) && (
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Link to Parent Test Case</p>
                <p className="text-xs text-zinc-500 mb-3">Select a standalone test case to inherit fields from. This test case will become its child.</p>
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                  <input
                    value={parentSearch}
                    onChange={e => { setParentSearch(e.target.value); setSelectedParentId(null) }}
                    placeholder="Search by ID or title…"
                    className="w-full pl-8 pr-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                  {parentSearch && <button onClick={() => { setParentSearch(''); setSelectedParentId(null) }} className="absolute right-2.5 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-zinc-400 hover:text-zinc-600" /></button>}
                </div>
                {parentSearch && !selectedParentId && (
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800 max-h-40 overflow-y-auto mb-3">
                    {eligibleParents(parentSearch).length === 0
                      ? <p className="px-3 py-2 text-xs text-zinc-400">No eligible test cases found</p>
                      : eligibleParents(parentSearch).map(t => (
                        <button key={t.id} onClick={() => { setSelectedParentId(t.id); setParentSearch(`${t.testCaseId}: ${t.title}`) }} className="w-full text-left px-3 py-2 text-xs hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors">
                          <span className="font-mono text-indigo-400">{t.testCaseId}</span>
                          <span className="ml-2 text-zinc-700 dark:text-zinc-300">{t.title}</span>
                        </button>
                      ))
                    }
                  </div>
                )}
                {selectedParentId && (
                  <>
                    <InheritanceConfigPanel config={inhConfig} onChange={setInhConfig} />
                    <button
                      onClick={() => { if (testCase && selectedParentId) { onLinkChild(testCase.id, selectedParentId, inhConfig); setSelectedParentId(null); setParentSearch('') } }}
                      disabled={!testCase}
                      className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                      <Link className="w-3.5 h-3.5" />Link to Parent
                    </button>
                    {!testCase && <p className="text-xs text-amber-500 mt-1">Save this test case first before linking.</p>}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── COMMENTS & ACTIVITY TAB ── */}
        {activeTab === 'comments' && isEdit && testCase && onFetchComments && onAddComment && (
          <div className="h-96 flex flex-col">
            <CommentsPanel
              testCaseId={testCase.id}
              users={users}
              onFetchComments={onFetchComments}
              onAddComment={onAddComment}
            />
          </div>
        )}
      </Modal>

      {/* ── Propagation confirm ── */}
      {showPropagateConfirm && (
        <Modal
          isOpen
          onClose={() => setShowPropagateConfirm(false)}
          title="Update children?"
          size="sm"
          footer={
            <>
              <button onClick={() => confirmPropagate(false)} className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                Save Parent Only
              </button>
              <button onClick={() => confirmPropagate(true)} className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors">
                Save & Propagate
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              This test case has <strong>{children.length}</strong> child{children.length !== 1 ? 'ren' : ''} that inherit fields from it. Propagating will overwrite their inherited fields with the new values.
            </p>
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 space-y-1 max-h-40 overflow-y-auto">
              {children.slice(0, 5).map(c => (
                <div key={c.id} className="flex items-center gap-2 text-xs">
                  <CornerDownRight className="w-3 h-3 text-violet-500 flex-shrink-0" />
                  <span className="font-mono text-indigo-400">{c.testCaseId}</span>
                  <span className="text-zinc-600 dark:text-zinc-400 truncate">{c.title}</span>
                </div>
              ))}
              {children.length > 5 && <p className="text-xs text-zinc-400 pl-5">+ {children.length - 5} more</p>}
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
