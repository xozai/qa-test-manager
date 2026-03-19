import { useState, useMemo } from 'react'
import { CheckCircle, ChevronRight, Download, RotateCcw, Play } from 'lucide-react'
import type { TestCase, TestSuite, TestRun, RunResult, User, TesterRole, TestStatus } from '../../types'
import Badge from '../common/Badge'

interface TestRunnerProps {
  testCases: TestCase[]
  testSuites: TestSuite[]
  users: User[]
  testRuns: TestRun[]
  onSaveRun: (run: TestRun) => void
}

function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

const TESTER_ROLES: TesterRole[] = ['QA', 'UAT', 'BAT']
const STATUSES: TestStatus[] = ['Not Run', 'Pass', 'Fail', 'Blocked', 'Skipped']

const STATUS_COLOR: Record<TestStatus, string> = {
  Pass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  Fail: 'text-red-400 bg-red-500/10 border-red-500/30',
  Blocked: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  Skipped: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30',
  'Not Run': 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700',
  Untested: 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700',
}

function exportRunCsv(run: TestRun, testCases: TestCase[], testSuites: TestSuite[]) {
  const suiteMap = Object.fromEntries(testSuites.map(s => [s.id, s.name]))
  const caseMap = Object.fromEntries(testCases.map(tc => [tc.testCaseId, tc]))

  const rows = [
    ['Test Case ID', 'Title', 'Suite', 'Priority', 'Status', 'Notes'],
    ...run.results.map(r => {
      const tc = caseMap[r.testCaseId]
      return [
        r.testCaseId,
        tc?.title ?? '',
        suiteMap[tc?.testSuiteId ?? ''] ?? '',
        tc?.priority ?? '',
        r.status,
        r.notes,
      ]
    }),
  ]

  const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${run.name.replace(/\s+/g, '_')}_${run.createdAt.slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function TestRunner({ testCases, testSuites, users, testRuns: _testRuns, onSaveRun }: TestRunnerProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedSuiteIds, setSelectedSuiteIds] = useState<string[]>([])
  const [runName, setRunName] = useState('')
  const [executorId, setExecutorId] = useState(users[0]?.id ?? '')
  const [testerRole, setTesterRole] = useState<TesterRole>('QA')
  const [results, setResults] = useState<RunResult[]>([])
  const [savedRun, setSavedRun] = useState<TestRun | null>(null)

  const visibleSuites = testSuites.filter(s => !s.isHidden)

  const selectedCases = useMemo(
    () => testCases.filter(tc => selectedSuiteIds.includes(tc.testSuiteId)),
    [testCases, selectedSuiteIds]
  )

  function toggleSuite(id: string) {
    setSelectedSuiteIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  function goToStep2() {
    if (selectedSuiteIds.length === 0) return
    const defaultName = `Run ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    setRunName(defaultName)
    setStep(2)
  }

  function goToStep3() {
    if (!executorId || !runName.trim()) return
    setResults(selectedCases.map(tc => ({ testCaseId: tc.testCaseId, status: 'Not Run', notes: '' })))
    setStep(3)
  }

  function updateResult(testCaseId: string, field: keyof RunResult, value: string) {
    setResults(prev =>
      prev.map(r => r.testCaseId === testCaseId ? { ...r, [field]: value } : r)
    )
  }

  function setAllStatus(status: TestStatus) {
    setResults(prev => prev.map(r => ({ ...r, status })))
  }

  function handleSave() {
    const run: TestRun = {
      id: genId(),
      name: runName.trim(),
      suiteIds: selectedSuiteIds,
      executorId,
      testerRole,
      results,
      createdAt: new Date().toISOString(),
    }
    onSaveRun(run)
    setSavedRun(run)
  }

  function handleReset() {
    setStep(1)
    setSelectedSuiteIds([])
    setRunName('')
    setExecutorId(users[0]?.id ?? '')
    setTesterRole('QA')
    setResults([])
    setSavedRun(null)
  }

  const passed = results.filter(r => r.status === 'Pass').length
  const failed = results.filter(r => r.status === 'Fail').length
  const notRun = results.filter(r => r.status === 'Not Run').length
  const ran = results.filter(r => r.status !== 'Not Run').length
  const passRate = ran > 0 ? Math.round((passed / ran) * 100) : 0

  const suiteMap = Object.fromEntries(testSuites.map(s => [s.id, s.name]))

  // ── Saved run summary ─────────────────────────────────────────────────────
  if (savedRun) {
    return (
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Run Saved</h1>
            <p className="text-sm text-zinc-500 mt-0.5">{savedRun.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => exportRunCsv(savedRun, testCases, testSuites)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
            >
              <Play className="w-4 h-4" />
              New Run
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {([
            ['Total', savedRun.results.length, 'text-zinc-700 dark:text-zinc-300'],
            ['Pass', passed, 'text-emerald-400'],
            ['Fail', failed, 'text-red-400'],
            ['Pass Rate', `${passRate}%`, passRate >= 80 ? 'text-emerald-400' : passRate >= 50 ? 'text-yellow-400' : 'text-red-400'],
          ] as [string, string | number, string][]).map(([label, val, cls]) => (
            <div key={label} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-center">
              <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">{label}</p>
              <p className={`text-2xl font-bold ${cls}`}>{val}</p>
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">ID</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Suite</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Notes</th>
                </tr>
              </thead>
              <tbody>
                {savedRun.results.map(r => {
                  const tc = testCases.find(c => c.testCaseId === r.testCaseId)
                  return (
                    <tr key={r.testCaseId} className="border-b border-zinc-100 dark:border-zinc-800/60">
                      <td className="px-5 py-3 font-mono text-xs text-indigo-400">{r.testCaseId}</td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300 text-xs">{tc?.title ?? '—'}</td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">{suiteMap[tc?.testSuiteId ?? ''] ?? '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="status" value={r.status}>{r.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">{r.notes || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header + stepper */}
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Test Runner</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Execute a test run across one or more suites</p>
      </div>

      <div className="flex items-center gap-2">
        {(['Select Suites', 'Configure Run', 'Execute'] as const).map((label, idx) => {
          const n = idx + 1
          const active = step === n
          const done = step > n
          return (
            <div key={label} className="flex items-center gap-2">
              {idx > 0 && <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-600" />}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                active ? 'bg-indigo-600 text-white' :
                done ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300' :
                'bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-600'
              }`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                  active ? 'bg-white/20' : done ? 'bg-emerald-500 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'
                }`}>
                  {done ? '✓' : n}
                </span>
                {label}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Step 1: Select suites ─────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Select one or more test suites to include in this run.</p>

          {visibleSuites.length === 0 ? (
            <div className="py-16 text-center text-zinc-500 text-sm">No visible test suites available.</div>
          ) : (
            <div className="space-y-2">
              {visibleSuites.map(suite => {
                const cases = testCases.filter(tc => tc.testSuiteId === suite.id)
                const selected = selectedSuiteIds.includes(suite.id)
                const owner = users.find(u => u.id === suite.ownerId)
                return (
                  <button
                    key={suite.id}
                    onClick={() => toggleSuite(suite.id)}
                    className={`w-full text-left flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-colors ${
                      selected
                        ? 'bg-indigo-500/10 border-indigo-500/40 text-zinc-900 dark:text-zinc-100'
                        : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border ${
                      selected ? 'bg-indigo-600 border-indigo-600' : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600'
                    }`}>
                      {selected && <span className="text-white text-xs">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{suite.name}</p>
                      {suite.description && (
                        <p className="text-xs text-zinc-500 mt-0.5 truncate">{suite.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-zinc-500 flex-shrink-0">
                      {owner && <span>{owner.name}</span>}
                      {suite.jiraNumber && <span className="font-mono text-indigo-400">{suite.jiraNumber}</span>}
                      <span>{cases.length} cases</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={goToStep2}
              disabled={selectedSuiteIds.length === 0}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Configure ─────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Run Name</label>
              <input
                value={runName}
                onChange={e => setRunName(e.target.value)}
                placeholder="e.g. Sprint 12 Regression"
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Executor</label>
                <select
                  value={executorId}
                  onChange={e => setExecutorId(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent transition-colors"
                >
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Testing Phase</label>
                <select
                  value={testerRole}
                  onChange={e => setTesterRole(e.target.value as TesterRole)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent transition-colors"
                >
                  {TESTER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-3">Selected suites ({selectedSuiteIds.length})</p>
            <div className="space-y-2">
              {selectedSuiteIds.map(id => {
                const suite = testSuites.find(s => s.id === id)
                const count = testCases.filter(tc => tc.testSuiteId === id).length
                return (
                  <div key={id} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-700 dark:text-zinc-300">{suite?.name}</span>
                    <span className="text-zinc-500 text-xs">{count} cases</span>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-zinc-500 mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              {selectedCases.length} total test cases will be executed
            </p>
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
            >
              Back
            </button>
            <button
              onClick={goToStep3}
              disabled={!executorId || !runName.trim()}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Start Run
              <Play className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Execute ───────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Progress bar */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-600 dark:text-zinc-400">{ran} of {results.length} executed</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-emerald-400">{passed} pass</span>
                <span className="text-red-400">{failed} fail</span>
                <span className="text-zinc-500">{notRun} not run</span>
              </div>
            </div>
            <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: `${results.length > 0 ? (ran / results.length) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Bulk actions */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Set all:</span>
            {STATUSES.filter(s => s !== 'Not Run').map(s => (
              <button
                key={s}
                onClick={() => setAllStatus(s)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${STATUS_COLOR[s]}`}
              >
                {s}
              </button>
            ))}
            <button
              onClick={() => setAllStatus('Not Run')}
              className="px-2.5 py-1 text-xs font-medium rounded-md border text-zinc-500 bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
            >
              Reset
            </button>
          </div>

          {/* Execution table */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide w-24">ID</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Title</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide w-28">Priority</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide w-40">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => {
                    const tc = testCases.find(c => c.testCaseId === r.testCaseId)
                    return (
                      <tr key={r.testCaseId} className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/20">
                        <td className="px-4 py-2.5 font-mono text-xs text-indigo-400">{r.testCaseId}</td>
                        <td className="px-4 py-2.5">
                          <p className="text-zinc-800 dark:text-zinc-200 text-xs font-medium">{tc?.title}</p>
                          {tc?.preconditions && (
                            <p className="text-zinc-400 dark:text-zinc-600 text-xs mt-0.5 truncate max-w-xs">{tc.preconditions}</p>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {tc && <Badge variant="priority" value={tc.priority}>{tc.priority}</Badge>}
                        </td>
                        <td className="px-4 py-2.5">
                          <select
                            value={r.status}
                            onChange={e => updateResult(r.testCaseId, 'status', e.target.value)}
                            className={`w-full text-xs font-medium border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer transition-colors ${STATUS_COLOR[r.status]}`}
                          >
                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            value={r.notes}
                            onChange={e => updateResult(r.testCaseId, 'notes', e.target.value)}
                            placeholder="Optional notes..."
                            className="w-full bg-transparent border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-zinc-400 dark:focus:border-zinc-600 rounded-md px-2 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none transition-colors"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
            >
              Back
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Discard
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                Save Run
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
