import { useState } from 'react'
import { FlaskConical, FolderOpen, AlertTriangle, Clock, TrendingUp, Activity, GitCompare } from 'lucide-react'
import type { TestCase, TestSuite, User } from '../../types'
import Badge from '../common/Badge'
import type { Priority, TestStatus } from '../../types'

interface DashboardProps {
  testCases: TestCase[]
  testSuites: TestSuite[]
  users: User[]
}

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  iconBg: string
  iconColor: string
}

function StatCard({ label, value, sub, icon: Icon, iconBg, iconColor }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function Dashboard({ testCases, testSuites, users }: DashboardProps) {
  const [comparisonSuiteId, setComparisonSuiteId] = useState('')
  const total = testCases.length
  const visibleSuites = testSuites.filter(s => !s.isHidden)

  const ran = testCases.filter(tc => tc.qaStatus !== 'Not Run')
  const passed = testCases.filter(tc => tc.qaStatus === 'Pass')
  const passRate = ran.length > 0 ? Math.round((passed.length / ran.length) * 100) : 0

  const priorityCounts: Record<Priority, number> = { High: 0, Med: 0, Low: 0 }
  testCases.forEach(tc => { priorityCounts[tc.priority]++ })

  const qaStatusCounts: Record<TestStatus, number> = {
    Pass: 0, Fail: 0, Blocked: 0, Skipped: 0, 'Not Run': 0, Untested: 0,
  }
  testCases.forEach(tc => { qaStatusCounts[tc.qaStatus]++ })

  const recent = [...testCases]
    .filter(tc => tc.updatedAt)
    .sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime())
    .slice(0, 5)

  const suiteMap = Object.fromEntries(testSuites.map(s => [s.id, s.name]))

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Overview of your test management workspace</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Test Cases" value={total} sub={`${ran.length} executed`}
          icon={FlaskConical} iconBg="bg-indigo-500/15" iconColor="text-indigo-400" />
        <StatCard label="Test Suites" value={visibleSuites.length} sub={`${testSuites.filter(s => s.isHidden).length} hidden`}
          icon={FolderOpen} iconBg="bg-purple-500/15" iconColor="text-purple-400" />
        <StatCard label="QA Pass Rate" value={`${passRate}%`} sub={`${passed.length} of ${ran.length} passed`}
          icon={TrendingUp} iconBg="bg-emerald-500/15" iconColor="text-emerald-400" />
        <StatCard label="Team Members" value={users.length} sub="active users"
          icon={Activity} iconBg="bg-cyan-500/15" iconColor="text-cyan-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* QA Status Breakdown */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-zinc-400" />
            QA Status Breakdown
          </h2>
          <div className="space-y-3">
            {(Object.entries(qaStatusCounts) as [TestStatus, number][]).map(([status, count]) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={status} className="flex items-center gap-3">
                  <div className="w-28 flex-shrink-0">
                    <Badge variant="status" value={status}>{status}</Badge>
                  </div>
                  <div className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        status === 'Pass' ? 'bg-emerald-500' :
                        status === 'Fail' ? 'bg-red-500' :
                        status === 'Blocked' ? 'bg-orange-500' : 'bg-zinc-400 dark:bg-zinc-600'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-500 w-8 text-right">{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Priority Distribution */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-zinc-400" />
            Priority Distribution
          </h2>
          <div className="space-y-4">
            {(['High', 'Med', 'Low'] as Priority[]).map(p => {
              const count = priorityCounts[p]
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={p}>
                  <div className="flex justify-between items-center mb-1.5">
                    <Badge variant="priority" value={p}>{p}</Badge>
                    <span className="text-xs text-zinc-500">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        p === 'High' ? 'bg-red-500' : p === 'Med' ? 'bg-yellow-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-400" />
            Recently Updated
          </h2>
          {recent.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-6">No test cases yet</p>
          ) : (
            <div className="space-y-3">
              {recent.map(tc => (
                <div key={tc.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                  <div className="flex-shrink-0 mt-0.5">
                    <Badge variant="status" value={tc.qaStatus}>{tc.qaStatus}</Badge>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">{tc.testCaseId}: {tc.title}</p>
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">{suiteMap[tc.testSuiteId] ?? '—'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* QA vs UAT vs BAT Comparison */}
      {testCases.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-zinc-400" />
              QA vs UAT vs BAT Results
            </h2>
            <select
              value={comparisonSuiteId}
              onChange={e => setComparisonSuiteId(e.target.value)}
              className="px-2 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All Suites</option>
              {visibleSuites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto">
            {(() => {
              const compareCases = comparisonSuiteId
                ? testCases.filter(tc => tc.testSuiteId === comparisonSuiteId)
                : testCases
              const conflicts = compareCases.filter(tc =>
                new Set([tc.qaStatus, tc.uatStatus, tc.batStatus]).size > 1 &&
                !['Not Run', 'Untested'].includes(tc.qaStatus) &&
                !['Not Run', 'Untested'].includes(tc.uatStatus) &&
                !['Not Run', 'Untested'].includes(tc.batStatus)
              )
              return (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800">
                      <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Test Case</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Suite</th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-indigo-500 uppercase tracking-wide">QA</th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-violet-500 uppercase tracking-wide">UAT</th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-cyan-500 uppercase tracking-wide">BAT</th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Conflict</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareCases.length === 0 ? (
                      <tr><td colSpan={6} className="px-5 py-8 text-center text-xs text-zinc-500">No test cases found.</td></tr>
                    ) : (
                      compareCases.map(tc => {
                        const statuses = [tc.qaStatus, tc.uatStatus, tc.batStatus]
                        const executed = statuses.filter(s => s !== 'Not Run' && s !== 'Untested')
                        const hasConflict = executed.length > 1 && new Set(executed).size > 1
                        return (
                          <tr key={tc.id} className={`border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors ${hasConflict ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''}`}>
                            <td className="px-5 py-2.5">
                              <span className="font-mono text-xs text-indigo-400 mr-2">{tc.testCaseId}</span>
                              <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate max-w-[200px] inline-block align-middle">{tc.title}</span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-zinc-500 truncate max-w-[120px]">{suiteMap[tc.testSuiteId] ?? '—'}</td>
                            <td className="px-4 py-2.5 text-center"><Badge variant="status" value={tc.qaStatus}>{tc.qaStatus}</Badge></td>
                            <td className="px-4 py-2.5 text-center"><Badge variant="status" value={tc.uatStatus}>{tc.uatStatus}</Badge></td>
                            <td className="px-4 py-2.5 text-center"><Badge variant="status" value={tc.batStatus}>{tc.batStatus}</Badge></td>
                            <td className="px-4 py-2.5 text-center">
                              {hasConflict && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                  <AlertTriangle className="w-2.5 h-2.5" />Conflict
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                  {conflicts.length > 0 && (
                    <tfoot>
                      <tr className="border-t border-zinc-200 dark:border-zinc-800">
                        <td colSpan={6} className="px-5 py-2.5 text-xs text-amber-600 dark:text-amber-400">
                          {conflicts.length} test case{conflicts.length !== 1 ? 's' : ''} have conflicting QA/UAT/BAT results
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              )
            })()}
          </div>
        </div>
      )}

      {/* Suite Summary Table */}
      {visibleSuites.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-zinc-400" />
              Suite Overview
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Suite</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Cases</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Pass</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Fail</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Not Run</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Pass Rate</th>
                </tr>
              </thead>
              <tbody>
                {visibleSuites.map(suite => {
                  const cases = testCases.filter(tc => tc.testSuiteId === suite.id)
                  const sPass = cases.filter(tc => tc.qaStatus === 'Pass').length
                  const sFail = cases.filter(tc => tc.qaStatus === 'Fail').length
                  const sNotRun = cases.filter(tc => tc.qaStatus === 'Not Run').length
                  const sRan = cases.filter(tc => tc.qaStatus !== 'Not Run').length
                  const sRate = sRan > 0 ? Math.round((sPass / sRan) * 100) : 0
                  const owner = users.find(u => u.id === suite.ownerId)
                  return (
                    <tr key={suite.id} className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-zinc-800 dark:text-zinc-200">{suite.name}</p>
                        {owner && <p className="text-xs text-zinc-500">{owner.name}</p>}
                      </td>
                      <td className="px-4 py-3 text-center text-zinc-700 dark:text-zinc-300">{cases.length}</td>
                      <td className="px-4 py-3 text-center text-emerald-600 dark:text-emerald-400 font-medium">{sPass}</td>
                      <td className="px-4 py-3 text-center text-red-500 dark:text-red-400 font-medium">{sFail}</td>
                      <td className="px-4 py-3 text-center text-zinc-500">{sNotRun}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-semibold ${sRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : sRate >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-500 dark:text-red-400'}`}>
                          {sRan > 0 ? `${sRate}%` : '—'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
