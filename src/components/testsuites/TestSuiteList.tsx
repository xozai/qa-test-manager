import { useState } from 'react'
import { Plus, Pencil, Trash2, Eye, EyeOff, FolderOpen } from 'lucide-react'
import type { TestSuite, TestCase, User } from '../../types'
import TestSuiteModal from './TestSuiteModal'
import ConfirmDialog from '../common/ConfirmDialog'
import Badge from '../common/Badge'

interface TestSuiteListProps {
  testSuites: TestSuite[]
  testCases: TestCase[]
  users: User[]
  onSave: (suite: TestSuite) => void
  onDelete: (id: string) => void
  onToggleHidden: (id: string) => void
}

export default function TestSuiteList({ testSuites, testCases, users, onSave, onDelete, onToggleHidden }: TestSuiteListProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSuite, setEditingSuite] = useState<TestSuite | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TestSuite | null>(null)
  const [showHidden, setShowHidden] = useState(false)

  function openCreate() { setEditingSuite(null); setModalOpen(true) }
  function openEdit(suite: TestSuite) { setEditingSuite(suite); setModalOpen(true) }
  function confirmDelete(suite: TestSuite) { setDeleteTarget(suite) }
  function handleDelete() { if (deleteTarget) { onDelete(deleteTarget.id); setDeleteTarget(null) } }

  const displayed = showHidden ? testSuites : testSuites.filter(s => !s.isHidden)
  const hiddenCount = testSuites.filter(s => s.isHidden).length

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Test Suites</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {testSuites.filter(s => !s.isHidden).length} active
            {hiddenCount > 0 && `, ${hiddenCount} hidden`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hiddenCount > 0 && (
            <button
              onClick={() => setShowHidden(v => !v)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
            >
              {showHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showHidden ? 'Hide hidden' : `Show hidden (${hiddenCount})`}
            </button>
          )}
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Suite
          </button>
        </div>
      </div>

      {/* Table */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FolderOpen className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-4" />
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">No test suites yet</p>
          <p className="text-sm text-zinc-400 dark:text-zinc-600 mt-1">Create your first suite to start organizing test cases</p>
          <button
            onClick={openCreate}
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
          >
            Create Suite
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Suite</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Owner</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Jira</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Cases</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Pass</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Fail</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Pass Rate</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Visibility</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {displayed.map(suite => {
                  const cases = testCases.filter(tc => tc.testSuiteId === suite.id)
                  const sPass = cases.filter(tc => tc.qaStatus === 'Pass').length
                  const sFail = cases.filter(tc => tc.qaStatus === 'Fail').length
                  const sRan = cases.filter(tc => tc.qaStatus !== 'Not Run').length
                  const sRate = sRan > 0 ? Math.round((sPass / sRan) * 100) : null
                  const owner = users.find(u => u.id === suite.ownerId)
                  return (
                    <tr
                      key={suite.id}
                      className={`border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group ${suite.isHidden ? 'opacity-50' : ''}`}
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium text-zinc-800 dark:text-zinc-200">{suite.name}</p>
                        {suite.description && (
                          <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{suite.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 text-xs">{owner?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        {suite.jiraNumber
                          ? <span className="text-xs font-mono text-indigo-500 dark:text-indigo-400">{suite.jiraNumber}</span>
                          : <span className="text-zinc-400 dark:text-zinc-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-zinc-700 dark:text-zinc-300">{cases.length}</td>
                      <td className="px-4 py-3 text-center text-emerald-600 dark:text-emerald-400 font-medium">{sPass}</td>
                      <td className="px-4 py-3 text-center text-red-500 dark:text-red-400 font-medium">{sFail}</td>
                      <td className="px-4 py-3 text-center">
                        {sRate !== null ? (
                          <span className={`text-xs font-semibold ${sRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : sRate >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-500 dark:text-red-400'}`}>
                            {sRate}%
                          </span>
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {suite.isHidden
                          ? <Badge variant="status" value="Skipped">Hidden</Badge>
                          : <Badge variant="status" value="Pass">Visible</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => onToggleHidden(suite.id)} title={suite.isHidden ? 'Show suite' : 'Hide suite'}
                            className="p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md transition-colors">
                            {suite.isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => openEdit(suite)}
                            className="p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => confirmDelete(suite)}
                            className="p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors">
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
        </div>
      )}

      <TestSuiteModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSave={onSave} testSuite={editingSuite} users={users} />
      <ConfirmDialog
        isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Test Suite"
        message={`Delete "${deleteTarget?.name}"? Test cases in this suite will not be deleted but will lose their suite association.`}
        confirmLabel="Delete Suite" danger
      />
    </div>
  )
}
