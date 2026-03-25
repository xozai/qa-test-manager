import { useState, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { useTestStore } from './store'
import { useTheme } from './hooks/useTheme'
import Sidebar, { type View } from './components/layout/Sidebar'
import Dashboard from './components/dashboard/Dashboard'
import TestCaseGrid from './components/testcases/TestCaseGrid'
import TestCaseModal from './components/testcases/TestCaseModal'
import TestSuiteList from './components/testsuites/TestSuiteList'
import TestRunner from './components/testrunner/TestRunner'
import UserManagement from './components/users/UserManagement'
import LoginPage from './components/auth/LoginPage'
import AIAssistant from './components/ai/AIAssistant'
import { FlaskConical } from 'lucide-react'
import type { TestCase, TestSuite, UserRole, TestStatus } from './types'

// undefined = not yet checked; null = not logged in; Session = logged in
type AuthState = Session | null | undefined

export default function App() {
  const [session, setSession] = useState<AuthState>(undefined)
  const store = useTestStore()
  const [currentView, setCurrentView] = useState<View>('dashboard')
  const { theme, toggleTheme } = useTheme()

  // Test Case modal state
  const [tcModalOpen, setTcModalOpen] = useState(false)
  const [editingCase, setEditingCase] = useState<TestCase | null>(null)

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleAddCase() {
    setEditingCase(null)
    setTcModalOpen(true)
  }

  function handleEditCase(tc: TestCase) {
    setEditingCase(tc)
    setTcModalOpen(true)
  }

  function handleSaveCase(tc: TestCase, _propagate: boolean) {
    if (editingCase) void store.updateTestCase(editingCase.id, tc)
    else             void store.addTestCase(tc)
    setTcModalOpen(false)
    setEditingCase(null)
  }

  function handleBulkDelete(ids: string[]) {
    void store.bulkDeleteTestCases(ids)
  }

  function handleBulkUpdateStatus(ids: string[], field: 'qaStatus' | 'uatStatus' | 'batStatus', status: TestStatus) {
    void store.bulkUpdateTestCases(ids, { [field]: status })
  }

  function handleBulkMove(ids: string[], suiteId: string) {
    void store.bulkUpdateTestCases(ids, { testSuiteId: suiteId })
  }

  async function handleImportCSV(cases: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt'>[]) {
    for (const tc of cases) {
      await store.addTestCase(tc)
    }
  }

  function handleDeleteCase(id: string) {
    const children = store.testCases.filter(t => t.parentId === id)
    if (children.length > 0) {
      const names = children.slice(0, 3).map(c => c.testCaseId).join(', ')
      const extra = children.length > 3 ? ` + ${children.length - 3} more` : ''
      if (!window.confirm(`This test case is a parent of ${children.length} child(ren): ${names}${extra}.\n\nDeleting it will unlink all children (they keep their current values). Continue?`)) return
    }
    void store.deleteTestCase(id)
  }

  function handleSaveSuite(suite: TestSuite) {
    if (store.testSuites.some(s => s.id === suite.id)) void store.updateTestSuite(suite.id, suite)
    else                                                 void store.addTestSuite(suite)
  }

  function handleSaveUser(user: { id: string; name: string; email: string; roles: UserRole[] }) {
    if (store.users.some(u => u.id === user.id))
      void store.updateUser(user.id, { name: user.name, email: user.email, roles: user.roles })
    else
      void store.addUser({ name: user.name, email: user.email, roles: user.roles })
  }

  // ── Auth loading ──────────────────────────────────────────────────────────
  if (session === undefined) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── Not authenticated ─────────────────────────────────────────────────────
  if (session === null) {
    return <LoginPage />
  }

  // ── Data loading ──────────────────────────────────────────────────────────
  if (store.loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
          <FlaskConical className="w-5 h-5 text-white" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-zinc-500">Loading workspace…</span>
        </div>
      </div>
    )
  }

  // ── Main app ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <Sidebar
        currentView={currentView}
        onNavigate={setCurrentView}
        testCaseCount={store.testCases.length}
        testSuiteCount={store.testSuites.length}
        onSignOut={() => supabase.auth.signOut()}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="pl-64 min-h-screen">
        <div className="min-h-screen bg-zinc-100/50 dark:bg-zinc-900/50">

          {currentView === 'dashboard' && (
            <Dashboard
              testCases={store.testCases}
              testSuites={store.testSuites}
              users={store.users}
            />
          )}

          {currentView === 'testcases' && (
            <TestCaseGrid
              testCases={store.testCases}
              testSuites={store.testSuites}
              users={store.users}
              onAdd={handleAddCase}
              onEdit={handleEditCase}
              onDelete={handleDeleteCase}
              onDuplicate={(tc) => void store.copyTestCase(tc.id)}
              onImportCSV={handleImportCSV}
              onBulkDelete={handleBulkDelete}
              onBulkUpdateStatus={handleBulkUpdateStatus}
              onBulkMove={handleBulkMove}
            />
          )}

          {currentView === 'testsuites' && (
            <TestSuiteList
              testSuites={store.testSuites}
              testCases={store.testCases}
              users={store.users}
              onSave={handleSaveSuite}
              onDelete={(id) => void store.deleteTestSuite(id)}
              onToggleHidden={(id) => {
                const suite = store.testSuites.find(s => s.id === id)
                if (suite) void store.updateTestSuite(id, { isHidden: !suite.isHidden })
              }}
            />
          )}

          {currentView === 'testrunner' && (
            <TestRunner
              testCases={store.testCases}
              testSuites={store.testSuites}
              users={store.users}
              onUpdateTestCase={(id, changes) => void store.updateTestCase(id, changes)}
            />
          )}

          {currentView === 'users' && (
            <UserManagement
              users={store.users}
              onSave={handleSaveUser}
              onDelete={(id) => void store.deleteUser(id)}
            />
          )}

          {currentView === 'ai' && (
            <AIAssistant
              testSuites={store.testSuites}
              existingTestCaseIds={store.testCases.map(tc => tc.testCaseId)}
              onImport={async (suite, cases) => {
                const suiteId = await store.addTestSuite(suite)
                if (!suiteId) return
                for (const tc of cases) {
                  await store.addTestCase({ ...tc, testSuiteId: suiteId })
                }
              }}
              onNavigate={(view) => setCurrentView(view)}
            />
          )}

        </div>
      </main>

      <TestCaseModal
        isOpen={tcModalOpen}
        onClose={() => { setTcModalOpen(false); setEditingCase(null) }}
        onSave={handleSaveCase}
        onLinkChild={(childId, parentId, cfg) => void store.linkChildToParent(childId, parentId, cfg)}
        onUpdateInheritance={(childId, cfg, parentId) => void store.updateInheritance(childId, cfg, parentId)}
        onUnlinkChild={(childId) => void store.unlinkChild(childId)}
        testCase={editingCase}
        testSuites={store.testSuites}
        allTestCases={store.testCases}
        existingIds={store.testCases.map(tc => tc.testCaseId)}
      />
    </div>
  )
}
