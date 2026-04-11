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
import RunHistory from './components/testrunner/RunHistory'
import DefectList from './components/defects/DefectList'
import Settings from './components/settings/Settings'
import UserManagement from './components/users/UserManagement'
import LoginPage from './components/auth/LoginPage'
import AIAssistant from './components/ai/AIAssistant'
import { ToastProvider, useToast } from './components/common/Toast'
import { FlaskConical } from 'lucide-react'
import type { TestCase, TestSuite, UserRole, TestStatus, TestRun } from './types'

type AuthState = Session | null | undefined

// ── Inner app (inside ToastProvider so useToast works) ────────────────────────
function AppContent({ session }: { session: Session }) {
  const store = useTestStore()
  const [currentView, setCurrentView] = useState<View>('dashboard')
  const { theme, toggleTheme } = useTheme()
  const { toast } = useToast()

  const [tcModalOpen, setTcModalOpen] = useState(false)
  const [editingCase, setEditingCase] = useState<TestCase | null>(null)
  const [rerunFrom, setRerunFrom] = useState<TestRun | null>(null)

  const currentUser = store.users.find(u => u.email === session.user.email) ?? null
  const isBSA = currentUser?.roles.includes('BSA') ?? false

  // ── Handlers ────────────────────────────────────────────────────────────────
  function handleAddCase() { setEditingCase(null); setTcModalOpen(true) }
  function handleEditCase(tc: TestCase) { setEditingCase(tc); setTcModalOpen(true) }

  async function handleSaveCase(tc: TestCase, _propagate: boolean) {
    try {
      if (editingCase) await store.updateTestCase(editingCase.id, tc)
      else             await store.addTestCase(tc)
      toast(editingCase ? 'Test case updated' : 'Test case created', 'success')
    } catch { toast('Failed to save test case', 'error') }
    setTcModalOpen(false)
    setEditingCase(null)
  }

  async function handleDeleteCase(id: string) {
    const children = store.testCases.filter(t => t.parentId === id)
    if (children.length > 0) {
      const names = children.slice(0, 3).map(c => c.testCaseId).join(', ')
      const extra = children.length > 3 ? ` + ${children.length - 3} more` : ''
      if (!window.confirm(`This test case is a parent of ${children.length} child(ren): ${names}${extra}.\n\nDeleting it will unlink all children. Continue?`)) return
    }
    try {
      await store.deleteTestCase(id)
      toast('Test case deleted', 'success')
    } catch { toast('Failed to delete test case', 'error') }
  }

  async function handleBulkDelete(ids: string[]) {
    try {
      await store.bulkDeleteTestCases(ids)
      toast(`${ids.length} test case${ids.length !== 1 ? 's' : ''} deleted`, 'success')
    } catch { toast('Failed to delete test cases', 'error') }
  }

  function handleBulkUpdateStatus(ids: string[], field: 'qaStatus' | 'uatStatus' | 'batStatus', status: TestStatus) {
    void store.bulkUpdateTestCases(ids, { [field]: status })
    toast(`Updated ${ids.length} case${ids.length !== 1 ? 's' : ''}`, 'success')
  }

  function handleBulkMove(ids: string[], suiteId: string) {
    void store.bulkUpdateTestCases(ids, { testSuiteId: suiteId })
    toast(`Moved ${ids.length} case${ids.length !== 1 ? 's' : ''}`, 'success')
  }

  async function handleImportCSV(cases: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt'>[]) {
    try {
      for (const tc of cases) await store.addTestCase(tc)
      toast(`Imported ${cases.length} test case${cases.length !== 1 ? 's' : ''}`, 'success')
    } catch { toast('Import failed', 'error') }
  }

  async function handleSaveSuite(suite: TestSuite) {
    try {
      if (store.testSuites.some(s => s.id === suite.id)) await store.updateTestSuite(suite.id, suite)
      else                                                 await store.addTestSuite(suite)
      toast('Suite saved', 'success')
    } catch { toast('Failed to save suite', 'error') }
  }

  function handleSaveUser(user: { id: string; name: string; email: string; roles: UserRole[] }) {
    if (store.users.some(u => u.id === user.id))
      void store.updateUser(user.id, { name: user.name, email: user.email, roles: user.roles })
    else
      void store.addUser({ name: user.name, email: user.email, roles: user.roles })
  }

  async function handleInviteUser(email: string, name: string, roles: UserRole[]) {
    const { data: { session: s } } = await supabase.auth.getSession()
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${s?.access_token ?? ''}` },
      body: JSON.stringify({ email, name, roles }),
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Unknown error' }))
      toast((err as { error?: string }).error ?? 'Failed to invite user', 'error')
      throw new Error('invite failed')
    }
    toast(`Invite sent to ${email}`, 'success')
  }

  function handleRerunFailed(run: TestRun) {
    setRerunFrom(run)
    setCurrentView('testrunner')
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
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

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <Sidebar
        currentView={currentView}
        onNavigate={setCurrentView}
        testCaseCount={store.testCases.length}
        testSuiteCount={store.testSuites.length}
        defectCount={store.defects.filter(d => d.status === 'Open').length}
        isBSA={isBSA}
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
              defects={store.defects}
              onNavigateToDefects={() => setCurrentView('defects')}
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
              onDuplicate={(tc) => {
                void store.copyTestCase(tc.id)
                toast('Test case duplicated', 'success')
              }}
              onImportCSV={handleImportCSV}
              onBulkDelete={handleBulkDelete}
              onBulkUpdateStatus={handleBulkUpdateStatus}
              onBulkMove={handleBulkMove}
              onUpdateStatus={(id, field, value) => {
                void store.updateTestCase(id, { [field]: value })
                toast('Status updated', 'success')
              }}
            />
          )}

          {currentView === 'testsuites' && (
            <TestSuiteList
              testSuites={store.testSuites}
              testCases={store.testCases}
              users={store.users}
              onSave={handleSaveSuite}
              onDelete={(id) => {
                void store.deleteTestSuite(id)
                toast('Suite deleted', 'success')
              }}
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
              defects={store.defects}
              onUpdateTestCase={(id, changes) => void store.updateTestCase(id, changes)}
              onCreateRun={store.createTestRun}
              onUpsertRunResult={store.upsertRunResult}
              onCompleteRun={store.completeTestRun}
              onUploadAttachment={store.uploadRunAttachment}
              onAddDefect={store.addDefect}
              onRerunFailed={handleRerunFailed}
              rerunFrom={rerunFrom}
              onRerunFromConsumed={() => setRerunFrom(null)}
            />
          )}

          {currentView === 'history' && (
            <RunHistory
              testRuns={store.testRuns}
              testCases={store.testCases}
              testSuites={store.testSuites}
              users={store.users}
              onDelete={async (id) => {
                await store.deleteTestRun(id)
                toast('Run deleted', 'success')
              }}
              onRerunFailed={handleRerunFailed}
            />
          )}

          {currentView === 'defects' && (
            <DefectList
              defects={store.defects}
              testCases={store.testCases}
              users={store.users}
              onUpdateDefect={store.updateDefect}
              onDeleteDefect={store.deleteDefect}
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
                for (const tc of cases) await store.addTestCase({ ...tc, testSuiteId: suiteId })
                toast(`Imported ${cases.length} AI-generated cases`, 'success')
              }}
              onImportToSuite={async (suiteId, cases) => {
                await store.addTestCasesToSuite(suiteId, cases)
                toast(`Added ${cases.length} AI-generated case${cases.length !== 1 ? 's' : ''} to suite`, 'success')
              }}
              onNavigate={(view) => setCurrentView(view)}
            />
          )}

          {currentView === 'settings' && (
            <Settings
              currentUser={currentUser}
              users={store.users}
              onUpdateUser={store.updateUser}
              onSetUserActive={store.setUserActive}
              onInviteUser={handleInviteUser}
              theme={theme}
              onToggleTheme={toggleTheme}
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
        onFetchComments={store.fetchComments}
        onAddComment={store.addComment}
        users={store.users}
      />
    </div>
  )
}

// ── Root component ─────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState<AuthState>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (session === null) return <LoginPage />

  return (
    <ToastProvider>
      <AppContent session={session} />
    </ToastProvider>
  )
}
