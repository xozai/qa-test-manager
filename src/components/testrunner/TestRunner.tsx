import { useState, useMemo, useCallback } from 'react'
import {
  Play, ChevronLeft, ChevronRight, CheckCircle2, XCircle,
  Download, Eye, ChevronUp, ChevronDown, ChevronsUpDown,
  FolderOpen, User as UserIcon,
} from 'lucide-react'
import Papa from 'papaparse'
import type { TestCase, TestSuite, User, TesterRole, TestStatus, AttributeDef } from '../../types'
import Badge from '../common/Badge'

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'suites' | 'executor' | 'grid' | 'view' | 'execute'

interface RunnerSortConfig {
  key: string
  direction: 'asc' | 'desc'
  priority: number
}

interface TestRunnerProps {
  testSuites: TestSuite[]
  testCases: TestCase[]
  users: User[]
  onUpdateTestCase: (id: string, changes: Partial<TestCase>) => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PRIORITY_RANK: Record<string, number> = { High: 3, Med: 2, Low: 1 }
const STATUS_RANK: Record<string, number> = { Fail: 5, Blocked: 4, Skipped: 3, 'Not Run': 2, Untested: 1, Pass: 0 }
const TESTER_ROLES: TesterRole[] = ['QA', 'UAT', 'BAT']

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStatus(tc: TestCase, role: TesterRole): TestStatus {
  return role === 'QA' ? tc.qaStatus : role === 'UAT' ? tc.uatStatus : tc.batStatus
}

function getStatusField(role: TesterRole): 'qaStatus' | 'uatStatus' | 'batStatus' {
  return role === 'QA' ? 'qaStatus' : role === 'UAT' ? 'uatStatus' : 'batStatus'
}

function getSortValue(tc: TestCase, key: string, suiteMap: Record<string, TestSuite>, role: TesterRole): string | number {
  switch (key) {
    case 'testCaseId': return tc.testCaseId
    case 'title': return tc.title.toLowerCase()
    case 'suite': return suiteMap[tc.testSuiteId]?.name?.toLowerCase() ?? ''
    case 'priority': return PRIORITY_RANK[tc.priority] ?? 0
    case 'status': return STATUS_RANK[getStatus(tc, role)] ?? 0
    default:
      if (key.startsWith('attr_')) {
        const val = tc.attributeValues?.[key.slice(5)]
        return typeof val === 'boolean' ? (val ? 1 : 0) : ((val as string) ?? '').toLowerCase()
      }
      return ''
  }
}

function exportRunCSV(
  cases: TestCase[],
  executor: User | undefined,
  role: TesterRole,
  suiteMap: Record<string, TestSuite>,
  allAttrs: AttributeDef[],
) {
  const rows = cases.map(tc => {
    const row: Record<string, string> = {
      ID: tc.testCaseId,
      Title: tc.title,
      Suite: suiteMap[tc.testSuiteId]?.name ?? '',
      Executor: executor?.name ?? '',
      Role: role,
      Priority: tc.priority,
      Status: getStatus(tc, role),
    }
    for (const attr of allAttrs) {
      const val = tc.attributeValues?.[attr.id]
      row[attr.name || attr.id] = typeof val === 'boolean' ? (val ? 'Yes' : 'No') : ((val as string) ?? '')
    }
    return row
  })
  const csv = Papa.unparse(rows)
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `test-run-${role}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── SortIcon ──────────────────────────────────────────────────────────────────

function SortIcon({ colKey, sorts }: { colKey: string; sorts: RunnerSortConfig[] }) {
  const cfg = sorts.find(s => s.key === colKey)
  if (!cfg) return <ChevronsUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
  return (
    <span className="inline-flex items-center gap-0.5">
      {cfg.direction === 'asc'
        ? <ChevronUp className="w-3 h-3 text-indigo-400" />
        : <ChevronDown className="w-3 h-3 text-indigo-400" />}
      {sorts.length > 1 && (
        <span className="text-[9px] font-bold text-indigo-400 leading-none">{cfg.priority}</span>
      )}
    </span>
  )
}

// ── SuiteCard ─────────────────────────────────────────────────────────────────

function SuiteCard({ suite, caseCount, selected, onToggle }: {
  suite: TestSuite
  caseCount: number
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
        selected
          ? 'border-indigo-500 bg-indigo-500/10'
          : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-600'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors ${
          selected
            ? 'bg-indigo-600 border-indigo-600'
            : 'border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800'
        }`}>
          {selected && <span className="text-white text-xs font-bold">✓</span>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-zinc-900 dark:text-zinc-100 text-sm truncate">{suite.name}</p>
          {suite.description && (
            <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{suite.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            {suite.jiraNumber && (
              <span className="text-xs font-mono text-indigo-500 dark:text-indigo-400">{suite.jiraNumber}</span>
            )}
            <span className="text-xs text-zinc-500">{caseCount} case{caseCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>
    </button>
  )
}

// ── CaseView (read-only) ──────────────────────────────────────────────────────

function CaseView({ tc, suite, executor, testerRole, onBack, onExecute }: {
  tc: TestCase
  suite: TestSuite | undefined
  executor: User | undefined
  testerRole: TesterRole
  onBack: () => void
  onExecute: () => void
}) {
  const currentStatus = getStatus(tc, testerRole)
  const suiteAttrs = suite?.attributes ?? []

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors mb-3">
            <ChevronLeft className="w-4 h-4" />Back to Grid
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm text-indigo-500 dark:text-indigo-400 font-medium">{tc.testCaseId}</span>
            <Badge variant="priority" value={tc.priority}>{tc.priority}</Badge>
            <Badge variant="status" value={currentStatus}>{currentStatus}</Badge>
          </div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-1">{tc.title}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {suite?.name ?? '—'} · Executor: {executor?.name ?? '—'} · Role: {testerRole}
          </p>
        </div>
        <button onClick={onExecute} className="flex-shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors">
          <Play className="w-4 h-4" />Execute
        </button>
      </div>

      {(tc.preconditions || tc.testData) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tc.preconditions && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">Preconditions</p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{tc.preconditions}</p>
            </div>
          )}
          {tc.testData && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">Test Data</p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{tc.testData}</p>
            </div>
          )}
        </div>
      )}

      {suiteAttrs.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">Custom Attributes</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {suiteAttrs.map(attr => {
              const val = tc.attributeValues?.[attr.id]
              return (
                <div key={attr.id}>
                  <p className="text-xs text-zinc-500 mb-0.5">{attr.name}</p>
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    {attr.type === 'boolean' ? (val ? 'Yes' : 'No') : ((val as string) || '—')}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {tc.steps.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Test Steps ({tc.steps.length})</p>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {tc.steps.map((step, i) => (
              <div key={i} className="px-4 py-3 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-zinc-400 dark:text-zinc-600 mb-1">Step {i + 1} · Action</p>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">{step.action || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400 dark:text-zinc-600 mb-1">Expected Result</p>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">{step.expectedResult || '—'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── CaseExecution ─────────────────────────────────────────────────────────────

function calcStatus(stepResults: Record<number, 'Pass' | 'Fail'>, totalSteps: number): TestStatus | 'In Progress' | null {
  if (totalSteps === 0) return null
  const marked = Object.keys(stepResults).length
  if (marked === 0) return null
  const values = Object.values(stepResults)
  if (values.includes('Fail')) return 'Fail'
  if (marked < totalSteps) return 'In Progress'
  return 'Pass'
}

const CALC_STATUS_STYLE: Record<string, string> = {
  Pass:        'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  Fail:        'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  'In Progress':'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
}

function CaseExecution({ tc, suite, testerRole, onBack, onSave }: {
  tc: TestCase
  suite: TestSuite | undefined
  testerRole: TesterRole
  onBack: () => void
  onSave: (status: TestStatus) => void
}) {
  const [stepResults, setStepResults] = useState<Record<number, 'Pass' | 'Fail'>>({})
  const [overrideStatus, setOverrideStatus] = useState<TestStatus | null>(null)
  const suiteAttrs = suite?.attributes ?? []
  const hasSteps = tc.steps.length > 0

  function toggleStep(i: number, result: 'Pass' | 'Fail') {
    setStepResults(prev => {
      if (prev[i] === result) {
        const next = { ...prev }
        delete next[i]
        return next
      }
      return { ...prev, [i]: result }
    })
    // Clear override when steps are changed so auto-calc takes over
    setOverrideStatus(null)
  }

  const calculatedStatus = hasSteps ? calcStatus(stepResults, tc.steps.length) : null
  const effectiveStatus: TestStatus | null = overrideStatus ?? (
    calculatedStatus === 'In Progress' || calculatedStatus === null ? null : calculatedStatus
  )
  const canSave = effectiveStatus !== null

  const STATUS_BTNS: { status: TestStatus; activeCls: string; hoverCls: string }[] = [
    { status: 'Pass',    activeCls: 'bg-emerald-600 border-emerald-600 text-white', hoverCls: 'hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400' },
    { status: 'Fail',    activeCls: 'bg-red-600 border-red-600 text-white',         hoverCls: 'hover:border-red-400 hover:text-red-600 dark:hover:text-red-400' },
    { status: 'Blocked', activeCls: 'bg-orange-500 border-orange-500 text-white',   hoverCls: 'hover:border-orange-400 hover:text-orange-500 dark:hover:text-orange-400' },
    { status: 'Skipped', activeCls: 'bg-zinc-500 border-zinc-500 text-white',       hoverCls: 'hover:border-zinc-400' },
  ]

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      <div>
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors mb-3">
          <ChevronLeft className="w-4 h-4" />Back to Grid
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm text-indigo-500 dark:text-indigo-400 font-medium">{tc.testCaseId}</span>
          <Badge variant="priority" value={tc.priority}>{tc.priority}</Badge>
          <span className="text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">{testerRole} Execution</span>
        </div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-1">{tc.title}</h1>
      </div>

      {(tc.preconditions || tc.testData) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tc.preconditions && (
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1.5">Preconditions</p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{tc.preconditions}</p>
            </div>
          )}
          {tc.testData && (
            <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl p-4">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-1.5">Test Data</p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{tc.testData}</p>
            </div>
          )}
        </div>
      )}

      {suiteAttrs.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">Custom Attributes</p>
          <div className="flex flex-wrap gap-6">
            {suiteAttrs.map(attr => {
              const val = tc.attributeValues?.[attr.id]
              return (
                <div key={attr.id}>
                  <p className="text-xs text-zinc-500 mb-0.5">{attr.name}</p>
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    {attr.type === 'boolean' ? (val ? 'Yes' : 'No') : ((val as string) || '—')}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {hasSteps && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Test Steps</p>
            <span className="text-xs text-zinc-500">{Object.keys(stepResults).length}/{tc.steps.length} marked</span>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {tc.steps.map((step, i) => {
              const result = stepResults[i]
              return (
                <div key={i} className={`px-4 py-3 transition-colors ${
                  result === 'Pass' ? 'bg-emerald-50 dark:bg-emerald-500/5' :
                  result === 'Fail' ? 'bg-red-50 dark:bg-red-500/5' : ''
                }`}>
                  <div className="flex items-start gap-4">
                    <span className="text-xs font-mono text-zinc-400 dark:text-zinc-600 w-5 text-center pt-0.5 flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 grid grid-cols-2 gap-4 min-w-0">
                      <div>
                        <p className="text-xs text-zinc-400 dark:text-zinc-600 mb-1">Action</p>
                        <p className="text-sm text-zinc-700 dark:text-zinc-300">{step.action || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400 dark:text-zinc-600 mb-1">Expected</p>
                        <p className="text-sm text-zinc-700 dark:text-zinc-300">{step.expectedResult || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => toggleStep(i, 'Pass')}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                          result === 'Pass'
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-zinc-300 dark:border-zinc-600 text-zinc-500 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400'
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3" />Pass
                      </button>
                      <button
                        onClick={() => toggleStep(i, 'Fail')}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                          result === 'Fail'
                            ? 'bg-red-600 border-red-600 text-white'
                            : 'border-zinc-300 dark:border-zinc-600 text-zinc-500 hover:border-red-400 hover:text-red-600 dark:hover:text-red-400'
                        }`}
                      >
                        <XCircle className="w-3 h-3" />Fail
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Calculated result display */}
      {hasSteps && calculatedStatus && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${CALC_STATUS_STYLE[calculatedStatus] ?? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500'}`}>
          <span className="text-xs font-semibold uppercase tracking-wide opacity-70">Calculated Result</span>
          <span className="text-sm font-bold">{calculatedStatus}</span>
          {overrideStatus && (
            <span className="ml-auto text-[11px] opacity-60">(overridden → {overrideStatus})</span>
          )}
        </div>
      )}

      {/* Override / manual status */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">
          {hasSteps ? 'Override Result' : 'Overall Result'}
        </p>
        {hasSteps && (
          <p className="text-xs text-zinc-400 dark:text-zinc-600 mb-3">
            Auto-calculated from step results. Select below to override.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {STATUS_BTNS.map(({ status, activeCls, hoverCls }) => (
            <button
              key={status}
              onClick={() => setOverrideStatus(overrideStatus === status ? null : status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                overrideStatus === status
                  ? activeCls
                  : `bg-transparent border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 ${hoverCls}`
              }`}
            >
              {status}
            </button>
          ))}
        </div>
        {!canSave && (
          <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-2">
            {hasSteps ? 'Mark all steps or select an override to save.' : 'Select an overall result to save.'}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => effectiveStatus && onSave(effectiveStatus)}
          disabled={!canSave}
          className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          <CheckCircle2 className="w-4 h-4" />Save Result
        </button>
      </div>
    </div>
  )
}

// ── Main TestRunner ────────────────────────────────────────────────────────────

export default function TestRunner({ testSuites, testCases, users, onUpdateTestCase }: TestRunnerProps) {
  const [step, setStep] = useState<Step>('suites')
  const [selectedSuiteIds, setSelectedSuiteIds] = useState<string[]>([])
  const [executorId, setExecutorId] = useState<string>(users[0]?.id ?? '')
  const [testerRole, setTesterRole] = useState<TesterRole>('QA')
  const [sorts, setSorts] = useState<RunnerSortConfig[]>([])
  const [viewingCase, setViewingCase] = useState<TestCase | null>(null)
  const [executingCase, setExecutingCase] = useState<TestCase | null>(null)

  const visibleSuites = useMemo(() => testSuites.filter(s => !s.isHidden), [testSuites])

  const suiteMap = useMemo(
    () => Object.fromEntries(testSuites.map(s => [s.id, s])),
    [testSuites]
  )

  const executor = useMemo(() => users.find(u => u.id === executorId), [users, executorId])

  const allAttrs = useMemo(() => {
    const seen = new Set<string>()
    const attrs: AttributeDef[] = []
    for (const suite of testSuites.filter(s => selectedSuiteIds.includes(s.id))) {
      for (const attr of suite.attributes ?? []) {
        if (!seen.has(attr.id)) { seen.add(attr.id); attrs.push(attr) }
      }
    }
    return attrs
  }, [testSuites, selectedSuiteIds])

  const selectedCases = useMemo(
    () => testCases.filter(tc => selectedSuiteIds.includes(tc.testSuiteId)),
    [testCases, selectedSuiteIds]
  )

  const sortedCases = useMemo(() => {
    if (sorts.length === 0) return selectedCases
    return [...selectedCases].sort((a, b) => {
      for (const s of sorts) {
        const av = getSortValue(a, s.key, suiteMap, testerRole)
        const bv = getSortValue(b, s.key, suiteMap, testerRole)
        let cmp = 0
        if (typeof av === 'number' && typeof bv === 'number') {
          cmp = av - bv
        } else {
          cmp = String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0
        }
        if (cmp !== 0) return s.direction === 'asc' ? cmp : -cmp
      }
      return 0
    })
  }, [selectedCases, sorts, suiteMap, testerRole])

  const gridStats = useMemo(() => {
    const total = sortedCases.length
    const passed = sortedCases.filter(tc => getStatus(tc, testerRole) === 'Pass').length
    const failed = sortedCases.filter(tc => getStatus(tc, testerRole) === 'Fail').length
    const notRun = sortedCases.filter(tc => ['Not Run', 'Untested'].includes(getStatus(tc, testerRole))).length
    const ran = total - notRun
    const rate = ran > 0 ? Math.round((passed / ran) * 100) : null
    return { total, passed, failed, rate }
  }, [sortedCases, testerRole])

  const handleSort = useCallback((key: string, e: React.MouseEvent) => {
    setSorts(prev => {
      if (e.shiftKey) {
        const existing = prev.find(s => s.key === key)
        if (existing) {
          if (existing.direction === 'asc') return prev.map(s => s.key === key ? { ...s, direction: 'desc' as const } : s)
          const removed = prev.filter(s => s.key !== key)
          return removed.map((s, i) => ({ ...s, priority: i + 1 }))
        }
        return [...prev, { key, direction: 'asc' as const, priority: prev.length + 1 }]
      } else {
        const existing = prev.length === 1 && prev[0].key === key ? prev[0] : null
        if (existing) return existing.direction === 'asc' ? [{ key, direction: 'desc' as const, priority: 1 }] : []
        return [{ key, direction: 'asc' as const, priority: 1 }]
      }
    })
  }, [])

  function handleSaveResult(status: TestStatus) {
    if (!executingCase) return
    onUpdateTestCase(executingCase.id, { [getStatusField(testerRole)]: status, updatedAt: new Date().toISOString() })
    setExecutingCase(null)
    setStep('grid')
  }

  function toggleSuite(id: string) {
    setSelectedSuiteIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const WIZARD_STEPS = [
    { key: 'suites', label: 'Select Suites' },
    { key: 'executor', label: 'Assign Executor' },
    { key: 'grid', label: 'Run Tests' },
  ] as const

  const stepIdx = step === 'suites' ? 0 : step === 'executor' ? 1 : 2

  // ── View step ────────────────────────────────────────────────────────────────
  if (step === 'view' && viewingCase) {
    return (
      <CaseView
        tc={viewingCase}
        suite={suiteMap[viewingCase.testSuiteId]}
        executor={executor}
        testerRole={testerRole}
        onBack={() => { setViewingCase(null); setStep('grid') }}
        onExecute={() => { setExecutingCase(viewingCase); setViewingCase(null); setStep('execute') }}
      />
    )
  }

  // ── Execute step ──────────────────────────────────────────────────────────────
  if (step === 'execute' && executingCase) {
    const liveCase = testCases.find(tc => tc.id === executingCase.id) ?? executingCase
    return (
      <CaseExecution
        tc={liveCase}
        suite={suiteMap[liveCase.testSuiteId]}
        testerRole={testerRole}
        onBack={() => { setExecutingCase(null); setStep('grid') }}
        onSave={handleSaveResult}
      />
    )
  }

  // ── Wizard ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Test Runner</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Execute test cases with role-based status tracking</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1">
        {WIZARD_STEPS.map(({ key, label }, idx) => {
          const active = stepIdx === idx
          const done = stepIdx > idx
          return (
            <div key={key} className="flex items-center gap-1">
              {idx > 0 && <div className={`h-px w-6 ${done ? 'bg-indigo-400' : 'bg-zinc-300 dark:bg-zinc-700'}`} />}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                active ? 'bg-indigo-600 text-white' :
                done ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300' :
                'bg-zinc-50 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-600'
              }`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                  active ? 'bg-white/20' :
                  done ? 'bg-emerald-500 text-white' :
                  'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'
                }`}>
                  {done ? '✓' : idx + 1}
                </span>
                {label}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Step 1: Suites ──────────────────────────────────────────────────── */}
      {step === 'suites' && (
        <div className="space-y-5">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Select one or more test suites to include in this run.</p>

          {visibleSuites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FolderOpen className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-4" />
              <p className="text-zinc-500 dark:text-zinc-400 font-medium">No visible test suites</p>
              <p className="text-sm text-zinc-400 dark:text-zinc-600 mt-1">Create suites in the Test Suites view</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {visibleSuites.map(suite => (
                <SuiteCard
                  key={suite.id}
                  suite={suite}
                  caseCount={testCases.filter(tc => tc.testSuiteId === suite.id).length}
                  selected={selectedSuiteIds.includes(suite.id)}
                  onToggle={() => toggleSuite(suite.id)}
                />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-zinc-500">
              {selectedSuiteIds.length > 0
                ? `${selectedSuiteIds.length} suite${selectedSuiteIds.length > 1 ? 's' : ''} · ${selectedCases.length} test case${selectedCases.length !== 1 ? 's' : ''}`
                : 'No suites selected'}
            </p>
            <button
              onClick={() => setStep('executor')}
              disabled={selectedSuiteIds.length === 0}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Executor ────────────────────────────────────────────────── */}
      {step === 'executor' && (
        <div className="space-y-5 max-w-lg">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-5">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Executor</label>
              {users.length === 0 ? (
                <p className="text-sm text-zinc-500 italic">No users found. Add users in Team Members.</p>
              ) : (
                <select
                  value={executorId}
                  onChange={e => setExecutorId(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent transition-colors"
                >
                  <option value="">— Select executor —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Testing Phase</label>
              <div className="flex gap-2">
                {TESTER_ROLES.map(role => (
                  <button
                    key={role}
                    onClick={() => setTesterRole(role)}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg border-2 transition-colors ${
                      testerRole === role
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-1.5">
                Results will update the {testerRole} status field on each test case.
              </p>
            </div>
          </div>

          {executorId && (
            <div className="bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 text-sm space-y-1">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">Summary</p>
              {[
                ['Executor', executor?.name ?? '—'],
                ['Role', testerRole],
                ['Suites', `${selectedSuiteIds.length} selected`],
                ['Cases', `${selectedCases.length} test cases`],
              ].map(([label, val]) => (
                <p key={label} className="text-zinc-700 dark:text-zinc-300">
                  <span className="text-zinc-500">{label}: </span>{val}
                </p>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep('suites')}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />Back
            </button>
            <button
              onClick={() => setStep('grid')}
              disabled={!executorId}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              <Play className="w-4 h-4" />Start Execution
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Grid ────────────────────────────────────────────────────── */}
      {step === 'grid' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep('executor')}
                className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />Back
              </button>
              <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700" />
              <div className="flex items-center gap-2 text-sm">
                <UserIcon className="w-4 h-4 text-zinc-400" />
                <span className="text-zinc-700 dark:text-zinc-300 font-medium">{executor?.name ?? '—'}</span>
                <span className="text-xs text-zinc-400">·</span>
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">{testerRole}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {sorts.length > 0 && (
                <button onClick={() => setSorts([])} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                  Clear sort
                </button>
              )}
              <button
                onClick={() => exportRunCSV(sortedCases, executor, testerRole, suiteMap, allAttrs)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />Export CSV
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {([
              ['Total', gridStats.total, 'text-zinc-700 dark:text-zinc-300'],
              ['Pass', gridStats.passed, 'text-emerald-600 dark:text-emerald-400'],
              ['Fail', gridStats.failed, 'text-red-500 dark:text-red-400'],
              ['Pass Rate', gridStats.rate !== null ? `${gridStats.rate}%` : '—',
                gridStats.rate !== null
                  ? (gridStats.rate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : gridStats.rate >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-500 dark:text-red-400')
                  : 'text-zinc-500'],
            ] as [string, string | number, string][]).map(([label, val, cls]) => (
              <div key={label} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 text-center">
                <p className="text-xs text-zinc-500 mb-0.5">{label}</p>
                <p className={`text-lg font-bold ${cls}`}>{val}</p>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    {([
                      { key: 'testCaseId', label: 'ID' },
                      { key: 'title', label: 'Title' },
                      { key: 'suite', label: 'Suite' },
                      { key: 'priority', label: 'Priority' },
                      { key: 'status', label: `${testerRole} Status` },
                      ...allAttrs.map(a => ({ key: `attr_${a.id}`, label: a.name || 'Attr' })),
                    ]).map(col => (
                      <th
                        key={col.key}
                        onClick={e => handleSort(col.key, e)}
                        className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide select-none cursor-pointer group hover:text-zinc-700 dark:hover:text-zinc-300 whitespace-nowrap"
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          <SortIcon colKey={col.key} sorts={sorts} />
                        </span>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {sortedCases.length === 0 ? (
                    <tr>
                      <td colSpan={6 + allAttrs.length} className="px-4 py-16 text-center text-sm text-zinc-500">
                        No test cases in the selected suites.
                      </td>
                    </tr>
                  ) : sortedCases.map(tc => {
                    const status = getStatus(tc, testerRole)
                    const suite = suiteMap[tc.testSuiteId]
                    return (
                      <tr key={tc.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-indigo-500 dark:text-indigo-400 font-medium">{tc.testCaseId}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-zinc-800 dark:text-zinc-200 max-w-xs truncate">{tc.title}</p>
                          {tc.description && <p className="text-xs text-zinc-500 truncate max-w-xs mt-0.5">{tc.description}</p>}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400 max-w-[120px] truncate">{suite?.name ?? '—'}</td>
                        <td className="px-4 py-3"><Badge variant="priority" value={tc.priority}>{tc.priority}</Badge></td>
                        <td className="px-4 py-3"><Badge variant="status" value={status}>{status}</Badge></td>
                        {allAttrs.map(attr => {
                          const val = tc.attributeValues?.[attr.id]
                          return (
                            <td key={attr.id} className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                              {attr.type === 'boolean' ? (val ? 'Yes' : 'No') : ((val as string) || '—')}
                            </td>
                          )
                        })}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => { setViewingCase(tc); setStep('view') }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />View
                            </button>
                            <button
                              onClick={() => { setExecutingCase(tc); setStep('execute') }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md transition-colors"
                            >
                              <Play className="w-3.5 h-3.5" />Execute
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
