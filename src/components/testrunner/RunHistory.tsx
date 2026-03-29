import { useState } from 'react'
import { Clock, ChevronLeft, Trash2, RotateCcw, CheckCircle2, XCircle, Minus, Paperclip, History } from 'lucide-react'
import type { TestRun, TestCase, TestSuite, User } from '../../types'
import Badge from '../common/Badge'
import ConfirmDialog from '../common/ConfirmDialog'

interface RunHistoryProps {
  testRuns: TestRun[]
  testCases: TestCase[]
  testSuites: TestSuite[]
  users: User[]
  onDelete: (runId: string) => Promise<void>
  onRerunFailed: (run: TestRun) => void
}

function passRate(run: TestRun): number | null {
  if (run.results.length === 0) return null
  const ran = run.results.filter(r => r.status !== 'Not Run' && r.status !== 'Untested')
  if (ran.length === 0) return null
  const passed = ran.filter(r => r.status === 'Pass').length
  return Math.round((passed / ran.length) * 100)
}

function RateChip({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-xs text-zinc-400">—</span>
  const cls = rate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : rate >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500 dark:text-red-400'
  return <span className={`text-sm font-bold ${cls}`}>{rate}%</span>
}

export default function RunHistory({ testRuns, testCases, testSuites, users, onDelete, onRerunFailed }: RunHistoryProps) {
  const [selectedRun, setSelectedRun] = useState<TestRun | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const suiteMap = Object.fromEntries(testSuites.map(s => [s.id, s.name]))
const userMap  = Object.fromEntries(users.map(u => [u.id, u.name]))

  const completed = testRuns.filter(r => r.status === 'completed')

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    await onDelete(deleteId)
    setDeleting(false)
    setDeleteId(null)
    if (selectedRun?.id === deleteId) setSelectedRun(null)
  }

  // ── Detail view ───────────────────────────────────────────────────────────
  if (selectedRun) {
    const rate = passRate(selectedRun)
    const suiteNames = selectedRun.suiteIds.map(id => suiteMap[id] ?? id).join(', ')

    return (
      <div className="p-6 space-y-5 max-w-5xl mx-auto">
        <div>
          <button
            onClick={() => setSelectedRun(null)}
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors mb-3"
          >
            <ChevronLeft className="w-4 h-4" />Back to History
          </button>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{selectedRun.name}</h1>
              <p className="text-sm text-zinc-500 mt-0.5">
                {selectedRun.testerRole} · {userMap[selectedRun.executorId] ?? '—'} · {new Date(selectedRun.createdAt).toLocaleDateString()}
              </p>
              <p className="text-xs text-zinc-400 mt-0.5">{suiteNames}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-zinc-500">Pass Rate</p>
                <RateChip rate={rate} />
              </div>
              <button
                onClick={() => onRerunFailed(selectedRun)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />Rerun Failed
              </button>
            </div>
          </div>
        </div>

        {selectedRun.results.length === 0 ? (
          <p className="text-sm text-zinc-500 py-8 text-center">No results recorded for this run.</p>
        ) : (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60">
                <tr>
                  {['ID', 'Title', 'Status', 'Notes', 'Attachments'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {selectedRun.results.map(r => {
                  const tc = testCases.find(t => t.id === r.testCaseId)
                  return (
                    <tr key={r.testCaseId} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                      <td className="px-4 py-3 font-mono text-xs text-indigo-400">{tc?.testCaseId ?? r.testCaseId.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-200 max-w-xs truncate">{tc?.title ?? '—'}</td>
                      <td className="px-4 py-3"><Badge variant="status" value={r.status}>{r.status}</Badge></td>
                      <td className="px-4 py-3 text-xs text-zinc-500 max-w-xs truncate">{r.notes || '—'}</td>
                      <td className="px-4 py-3">
                        {(r.attachments ?? []).length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {(r.attachments ?? []).map((att, i) => (
                              <a
                                key={i}
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:underline"
                              >
                                <Paperclip className="w-3 h-3" />{att.name}
                              </a>
                            ))}
                          </div>
                        ) : <span className="text-zinc-400 text-xs">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Run History</h1>
        <p className="text-sm text-zinc-500 mt-0.5">{completed.length} completed run{completed.length !== 1 ? 's' : ''}</p>
      </div>

      {completed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <History className="w-8 h-8 text-zinc-300 dark:text-zinc-600" />
          </div>
          <p className="text-zinc-500 font-medium">No completed runs yet</p>
          <p className="text-sm text-zinc-400">Completed test runs will appear here</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60">
              <tr>
                {['Run Name', 'Date', 'Role', 'Executor', 'Suites', 'Results', 'Pass %', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {completed.map(run => {
                const rate = passRate(run)
                const passed  = run.results.filter(r => r.status === 'Pass').length
                const failed  = run.results.filter(r => r.status === 'Fail' || r.status === 'Blocked').length
                const suiteNames = run.suiteIds.slice(0, 2).map(id => suiteMap[id] ?? '?').join(', ')
                const extra = run.suiteIds.length > 2 ? ` +${run.suiteIds.length - 2}` : ''

                return (
                  <tr
                    key={run.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer group"
                    onClick={() => setSelectedRun(run)}
                  >
                    <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200">{run.name}</td>
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{new Date(run.createdAt).toLocaleDateString()}</span>
                    </td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-500">{run.testerRole}</span></td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{userMap[run.executorId] ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500 max-w-[140px] truncate">{suiteNames}{extra}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="w-3 h-3" />{passed}</span>
                        <span className="inline-flex items-center gap-0.5 text-red-500 dark:text-red-400"><XCircle className="w-3 h-3" />{failed}</span>
                        <span className="inline-flex items-center gap-0.5 text-zinc-400"><Minus className="w-3 h-3" />{run.results.length - passed - failed}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><RateChip rate={rate} /></td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onRerunFailed(run)}
                          title="Rerun failed cases"
                          className="p-1.5 rounded-md text-zinc-400 hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteId(run.id)}
                          title="Delete run"
                          className="p-1.5 rounded-md text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => void handleDelete()}
        title="Delete Run"
        message="Delete this run and all its results? This cannot be undone."
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        danger
      />
    </div>
  )
}
