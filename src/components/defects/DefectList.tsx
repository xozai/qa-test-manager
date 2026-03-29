import { useState, useMemo } from 'react'
import { Bug, ChevronDown, Trash2, X } from 'lucide-react'
import type { Defect, DefectSeverity, DefectStatus, TestCase, User } from '../../types'
import ConfirmDialog from '../common/ConfirmDialog'

interface DefectListProps {
  defects: Defect[]
  testCases: TestCase[]
  users: User[]
  onUpdateDefect: (id: string, patch: Partial<Pick<Defect, 'status' | 'title' | 'severity' | 'description'>>) => Promise<void>
  onDeleteDefect: (id: string) => Promise<void>
}

const SEVERITIES: DefectSeverity[] = ['Critical', 'High', 'Med', 'Low']
const STATUSES: DefectStatus[] = ['Open', 'Fixed', 'Closed']

const SEVERITY_BADGE: Record<DefectSeverity, string> = {
  Critical: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  High:     'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
  Med:      'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  Low:      'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700',
}

const STATUS_BADGE: Record<DefectStatus, string> = {
  Open:   'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  Fixed:  'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  Closed: 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700',
}

const STATUS_NEXT: Record<DefectStatus, DefectStatus> = {
  Open: 'Fixed', Fixed: 'Closed', Closed: 'Open',
}

function SeverityDot({ severity }: { severity: DefectSeverity }) {
  const cls = severity === 'Critical' ? 'bg-red-500' : severity === 'High' ? 'bg-orange-500' : severity === 'Med' ? 'bg-amber-400' : 'bg-zinc-400'
  return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${cls}`} />
}

export default function DefectList({ defects, testCases, users, onUpdateDefect, onDeleteDefect }: DefectListProps) {
  const [filterSeverity, setFilterSeverity] = useState('')
  const [filterStatus, setFilterStatus] = useState<DefectStatus | ''>('Open')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const caseMap = useMemo(() => Object.fromEntries(testCases.map(tc => [tc.id, tc])), [testCases])
  const userMap = useMemo(() => Object.fromEntries(users.map(u => [u.id, u.name])), [users])

  const filtered = useMemo(() => {
    let list = defects
    if (filterSeverity) list = list.filter(d => d.severity === filterSeverity)
    if (filterStatus)   list = list.filter(d => d.status === filterStatus)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(d =>
        d.title.toLowerCase().includes(q) ||
        (caseMap[d.testCaseId]?.title ?? '').toLowerCase().includes(q) ||
        (caseMap[d.testCaseId]?.testCaseId ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [defects, filterSeverity, filterStatus, search, caseMap])

  const counts = useMemo(() => ({
    open:   defects.filter(d => d.status === 'Open').length,
    fixed:  defects.filter(d => d.status === 'Fixed').length,
    closed: defects.filter(d => d.status === 'Closed').length,
  }), [defects])

  async function handleAdvanceStatus(defect: Defect) {
    setUpdatingId(defect.id)
    await onUpdateDefect(defect.id, { status: STATUS_NEXT[defect.status] })
    setUpdatingId(null)
  }

  async function handleDelete() {
    if (!deleteId) return
    await onDeleteDefect(deleteId)
    setDeleteId(null)
    if (expandedId === deleteId) setExpandedId(null)
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Bug className="w-5 h-5 text-red-400" />Defects
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">{defects.length} total · {counts.open} open</p>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex items-center gap-3">
        {([
          ['Open',   counts.open,   'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20'],
          ['Fixed',  counts.fixed,  'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'],
          ['Closed', counts.closed, 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'],
        ] as [DefectStatus, number, string][]).map(([status, count, cls]) => (
          <button
            key={status}
            onClick={() => setFilterStatus(filterStatus === status ? '' : status)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${cls} ${filterStatus === status ? 'ring-2 ring-offset-1 ring-indigo-400 dark:ring-offset-zinc-950' : 'opacity-80 hover:opacity-100'}`}
          >
            {status} · {count}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <input
            type="text"
            placeholder="Search defects…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-3 pr-8 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" />
            </button>
          )}
        </div>

        <select
          value={filterSeverity}
          onChange={e => setFilterSeverity(e.target.value)}
          className="px-2 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Severities</option>
          {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as DefectStatus | '')}
          className="px-2 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {(filterSeverity || filterStatus || search) && (
          <button
            onClick={() => { setFilterSeverity(''); setFilterStatus(''); setSearch('') }}
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Bug className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-4" />
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">
            {defects.length === 0 ? 'No defects logged yet' : 'No defects match your filters'}
          </p>
          <p className="text-sm text-zinc-400 dark:text-zinc-600 mt-1">
            {defects.length === 0 ? 'Log defects from failed test cases in the Test Runner' : 'Try clearing your filters'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide w-8" />
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">Title</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide w-24">Severity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide w-28">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide w-40">Test Case</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide w-28">Logged</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {filtered.map(defect => {
                const tc = caseMap[defect.testCaseId]
                const isExpanded = expandedId === defect.id
                return [
                  <tr
                    key={defect.id}
                    className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group cursor-pointer ${isExpanded ? 'bg-zinc-50 dark:bg-zinc-800/20' : ''}`}
                    onClick={() => setExpandedId(isExpanded ? null : defect.id)}
                  >
                    <td className="px-4 py-3">
                      <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <SeverityDot severity={defect.severity} />
                        <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-xs">{defect.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium ${SEVERITY_BADGE[defect.severity]}`}>
                        {defect.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => void handleAdvanceStatus(defect)}
                        disabled={updatingId === defect.id}
                        title={`Advance to ${STATUS_NEXT[defect.status]}`}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium transition-opacity hover:opacity-70 ${STATUS_BADGE[defect.status]} ${updatingId === defect.id ? 'opacity-50' : ''}`}
                      >
                        {defect.status}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {tc ? (
                        <span className="text-xs text-zinc-600 dark:text-zinc-400 truncate block max-w-[160px]">
                          <span className="font-mono text-indigo-400 mr-1">{tc.testCaseId}</span>{tc.title}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-zinc-500">
                        {new Date(defect.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setDeleteId(defect.id)}
                        className="p-1.5 rounded opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>,

                  // Expanded detail row
                  ...(isExpanded ? [
                    <tr key={`${defect.id}-detail`} className="bg-zinc-50 dark:bg-zinc-800/20 border-b border-zinc-200 dark:border-zinc-800">
                      <td colSpan={7} className="px-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Description</p>
                              <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                                {defect.description || <span className="text-zinc-400 italic">No description</span>}
                              </p>
                            </div>
                            {defect.reporterId && (
                              <div>
                                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Reporter</p>
                                <p className="text-sm text-zinc-700 dark:text-zinc-300">{userMap[defect.reporterId] ?? defect.reporterId}</p>
                              </div>
                            )}
                          </div>
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">Change Status</p>
                              <div className="flex gap-2">
                                {STATUSES.map(s => (
                                  <button
                                    key={s}
                                    onClick={() => void onUpdateDefect(defect.id, { status: s })}
                                    disabled={defect.status === s || updatingId === defect.id}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                      defect.status === s
                                        ? 'bg-indigo-600 border-indigo-600 text-white'
                                        : 'border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:border-indigo-400'
                                    }`}
                                  >
                                    {s}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">Change Severity</p>
                              <div className="flex gap-2">
                                {SEVERITIES.map(s => (
                                  <button
                                    key={s}
                                    onClick={() => void onUpdateDefect(defect.id, { severity: s })}
                                    disabled={defect.severity === s || updatingId === defect.id}
                                    className={`px-2 py-1 rounded-md text-xs font-medium border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                      defect.severity === s
                                        ? SEVERITY_BADGE[s] + ' ring-1 ring-offset-1 ring-current'
                                        : 'border-zinc-300 dark:border-zinc-600 text-zinc-500 hover:border-zinc-400'
                                    }`}
                                  >
                                    {s}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ] : []),
                ]
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteId}
        title="Delete defect"
        message="This will permanently remove the defect record."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onClose={() => setDeleteId(null)}
      />
    </div>
  )
}
