import { useState, useMemo, useCallback } from 'react'
import { Plus, Search, Copy, Pencil, Trash2, ChevronUp, ChevronDown, ChevronsUpDown, X, Upload, Download } from 'lucide-react'
import type { TestCase, TestSuite, User, SortConfig, Priority, TestStatus } from '../../types'
import Badge from '../common/Badge'
import ConfirmDialog from '../common/ConfirmDialog'

interface TestCaseGridProps {
  testCases: TestCase[]
  testSuites: TestSuite[]
  users: User[]
  onAdd: () => void
  onEdit: (tc: TestCase) => void
  onDelete: (id: string) => void
  onDuplicate: (tc: TestCase) => void
  onImportCSV: () => void
  onExportCSV: () => void
}

type ColumnKey = keyof TestCase

interface ColumnDef {
  key: ColumnKey
  label: string
  sortable?: boolean
  width?: string
}

const COLUMNS: ColumnDef[] = [
  { key: 'testCaseId', label: 'ID', sortable: true, width: 'w-24' },
  { key: 'title', label: 'Title', sortable: true },
  { key: 'testSuiteId', label: 'Suite', sortable: true, width: 'w-36' },
  { key: 'priority', label: 'Priority', sortable: true, width: 'w-24' },
  { key: 'qaStatus', label: 'QA', sortable: true, width: 'w-28' },
  { key: 'uatStatus', label: 'UAT', sortable: true, width: 'w-28' },
  { key: 'batStatus', label: 'BAT', sortable: true, width: 'w-28' },
  { key: 'updatedAt', label: 'Updated', sortable: true, width: 'w-32' },
]

const PRIORITY_OPTIONS: Priority[] = ['High', 'Med', 'Low']
const STATUS_OPTIONS: TestStatus[] = ['Pass', 'Fail', 'Blocked', 'Skipped', 'Not Run']

function SortIcon({ col, sorts }: { col: ColumnKey; sorts: SortConfig[] }) {
  const cfg = sorts.find(s => s.key === col)
  if (!cfg) return <ChevronsUpDown className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400" />
  return (
    <span className="inline-flex items-center gap-0.5">
      {cfg.direction === 'asc'
        ? <ChevronUp className="w-3 h-3 text-indigo-400" />
        : <ChevronDown className="w-3 h-3 text-indigo-400" />}
      {sorts.length > 1 && (
        <span className="text-[10px] font-bold text-indigo-400 leading-none">{cfg.priority}</span>
      )}
    </span>
  )
}

interface Filters {
  testSuiteId: string
  priority: string
  qaStatus: string
  uatStatus: string
  batStatus: string
}

const EMPTY_FILTERS: Filters = {
  testSuiteId: '',
  priority: '',
  qaStatus: '',
  uatStatus: '',
  batStatus: '',
}

export default function TestCaseGrid({
  testCases, testSuites, users: _users,
  onAdd, onEdit, onDelete, onDuplicate, onImportCSV, onExportCSV,
}: TestCaseGridProps) {
  const [sorts, setSorts] = useState<SortConfig[]>([])
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const suiteMap = useMemo(
    () => Object.fromEntries(testSuites.map(s => [s.id, s.name])),
    [testSuites]
  )

  const handleSort = useCallback((key: ColumnKey, e: React.MouseEvent) => {
    setSorts(prev => {
      if (e.shiftKey) {
        const existing = prev.find(s => s.key === key)
        if (existing) {
          if (existing.direction === 'asc') {
            return prev.map(s => s.key === key ? { ...s, direction: 'desc' } : s)
          }
          const removed = prev.filter(s => s.key !== key)
          return removed.map((s, i) => ({ ...s, priority: i + 1 }))
        }
        return [...prev, { key, direction: 'asc', priority: prev.length + 1 }]
      } else {
        const existing = prev.length === 1 && prev[0].key === key ? prev[0] : null
        if (existing) {
          return existing.direction === 'asc'
            ? [{ key, direction: 'desc', priority: 1 }]
            : []
        }
        return [{ key, direction: 'asc', priority: 1 }]
      }
    })
  }, [])

  const filtered = useMemo(() => {
    let result = testCases

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(tc =>
        tc.testCaseId.toLowerCase().includes(q) ||
        tc.title.toLowerCase().includes(q) ||
        tc.description.toLowerCase().includes(q)
      )
    }
    if (filters.testSuiteId) result = result.filter(tc => tc.testSuiteId === filters.testSuiteId)
    if (filters.priority) result = result.filter(tc => tc.priority === filters.priority)
    if (filters.qaStatus) result = result.filter(tc => tc.qaStatus === filters.qaStatus)
    if (filters.uatStatus) result = result.filter(tc => tc.uatStatus === filters.uatStatus)
    if (filters.batStatus) result = result.filter(tc => tc.batStatus === filters.batStatus)

    if (sorts.length === 0) return result

    return [...result].sort((a, b) => {
      for (const s of sorts) {
        const av = a[s.key] as string
        const bv = b[s.key] as string
        const cmp = av < bv ? -1 : av > bv ? 1 : 0
        if (cmp !== 0) return s.direction === 'asc' ? cmp : -cmp
      }
      return 0
    })
  }, [testCases, search, filters, sorts])

  const activeFilterCount = Object.values(filters).filter(Boolean).length

  const handleSetFilter = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS)
    setSearch('')
  }

  const toDeleteCase = testCases.find(tc => tc.id === deleteId)

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-zinc-800 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Test Cases</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {filtered.length} of {testCases.length} cases
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onImportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import
            </button>
            <button
              onClick={onExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={onAdd}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Case
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search ID, title, description…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters(v => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              showFilters || activeFilterCount > 0
                ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                : 'text-zinc-400 bg-zinc-800 hover:bg-zinc-700 border border-transparent'
            }`}
          >
            Filters
            {activeFilterCount > 0 && (
              <span className="text-xs font-bold bg-indigo-500 text-white rounded-full w-4 h-4 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {(activeFilterCount > 0 || search) && (
            <button onClick={clearFilters} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              Clear all
            </button>
          )}

          {sorts.length > 0 && (
            <button onClick={() => setSorts([])} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              Clear sort
            </button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            <select
              value={filters.testSuiteId}
              onChange={e => handleSetFilter('testSuiteId', e.target.value)}
              className="px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All Suites</option>
              {testSuites.filter(s => !s.isHidden).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <select
              value={filters.priority}
              onChange={e => handleSetFilter('priority', e.target.value)}
              className="px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All Priorities</option>
              {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            <select
              value={filters.qaStatus}
              onChange={e => handleSetFilter('qaStatus', e.target.value)}
              className="px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">QA: All</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <select
              value={filters.uatStatus}
              onChange={e => handleSetFilter('uatStatus', e.target.value)}
              className="px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">UAT: All</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <select
              value={filters.batStatus}
              onChange={e => handleSetFilter('batStatus', e.target.value)}
              className="px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">BAT: All</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="sticky top-0 z-10 bg-zinc-950 border-b border-zinc-800">
            <tr>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide select-none ${col.width ?? ''} ${col.sortable ? 'cursor-pointer group hover:text-zinc-300' : ''}`}
                  onClick={col.sortable ? (e) => handleSort(col.key, e) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && <SortIcon col={col.key} sorts={sorts} />}
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide w-24 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-4 py-16 text-center text-sm text-zinc-500">
                  {testCases.length === 0 ? 'No test cases yet. Create your first one.' : 'No results match your filters.'}
                </td>
              </tr>
            ) : (
              filtered.map(tc => (
                <tr
                  key={tc.id}
                  className="hover:bg-zinc-800/30 transition-colors group"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-indigo-400">{tc.testCaseId}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-200 truncate max-w-xs">{tc.title}</p>
                    {tc.description && (
                      <p className="text-xs text-zinc-500 truncate max-w-xs mt-0.5">{tc.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-zinc-400 truncate block max-w-[130px]">
                      {suiteMap[tc.testSuiteId] ?? <span className="text-zinc-600">—</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="priority" value={tc.priority}>{tc.priority}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="status" value={tc.qaStatus}>{tc.qaStatus}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="status" value={tc.uatStatus}>{tc.uatStatus}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="status" value={tc.batStatus}>{tc.batStatus}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-zinc-500">
                      {tc.updatedAt ? new Date(tc.updatedAt).toLocaleDateString() : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onDuplicate(tc)}
                        title="Duplicate"
                        className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onEdit(tc)}
                        title="Edit"
                        className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteId(tc.id)}
                        title="Delete"
                        className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) { onDelete(deleteId); setDeleteId(null) } }}
        title="Delete Test Case"
        message={`Delete "${toDeleteCase?.testCaseId}: ${toDeleteCase?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}
