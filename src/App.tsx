import { useState, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { useTestStore } from './store'
import Sidebar, { type View } from './components/layout/Sidebar'
import Dashboard from './components/dashboard/Dashboard'
import TestCaseGrid from './components/testcases/TestCaseGrid'
import TestCaseModal from './components/testcases/TestCaseModal'
import TestSuiteList from './components/testsuites/TestSuiteList'
import TestRunner from './components/testrunner/TestRunner'
import UserManagement from './components/users/UserManagement'
import LoginPage from './components/auth/LoginPage'
import { FlaskConical } from 'lucide-react'
import type { TestCase, TestSuite, UserRole } from './types'

// undefined = not yet checked; null = not logged in; Session = logged in
type AuthState = Session | null | undefined

export default function App() {
  const [session, setSession] = useState<AuthState>(undefined)
  const store = useTestStore()
  const [currentView, setCurrentView] = useState<View>('dashboard')

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

  function handleSaveCase(tc: TestCase) {
    if (editingCase) void store.updateTestCase(editingCase.id, tc)
    else             void store.addTestCase(tc)
    setTcModalOpen(false)
    setEditingCase(null)
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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
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
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4">
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Sidebar
        currentView={currentView}
        onNavigate={setCurrentView}
        testCaseCount={store.testCases.length}
        testSuiteCount={store.testSuites.length}
        onSignOut={() => supabase.auth.signOut()}
      />

      <main className="pl-64 min-h-screen">
        <div className="min-h-screen bg-zinc-900/50">

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
              onDelete={(id) => void store.deleteTestCase(id)}
              onDuplicate={(tc) => void store.copyTestCase(tc.id)}
              onImportCSV={() => {}}
              onExportCSV={() => {}}
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
              testRuns={store.testRuns}
              onSaveRun={(run) => void store.saveRun(run)}
            />
          )}

          {currentView === 'users' && (
            <UserManagement
              users={store.users}
              onSave={handleSaveUser}
              onDelete={(id) => void store.deleteUser(id)}
            />
          )}

        </div>
      </main>

      <TestCaseModal
        isOpen={tcModalOpen}
        onClose={() => { setTcModalOpen(false); setEditingCase(null) }}
        onSave={handleSaveCase}
        testCase={editingCase}
        testSuites={store.testSuites}
        existingIds={store.testCases.map(tc => tc.testCaseId)}
      />
    </div>
  )
}
