import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type {
  User, TestSuite, TestCase, TestStep, TestRun,
  UserRole, TestStatus, Priority, TesterRole, AttributeDef,
} from '../types'

// ── DB row types (Supabase returns snake_case) ────────────────────────────────

interface DbUser {
  id: string
  name: string
  email: string
  roles: string[]
}

interface DbTestSuite {
  id: string
  name: string
  description: string
  owner_id: string | null
  jira_number: string
  is_hidden: boolean
  attributes: AttributeDef[]
  created_at: string
}

interface DbTestCase {
  id: string
  test_case_id: string
  title: string
  description: string
  preconditions: string
  test_data: string
  steps: TestStep[]
  qa_status: string
  uat_status: string
  bat_status: string
  priority: string
  test_suite_id: string | null
  attribute_values: Record<string, string | boolean>
  created_at: string
  updated_at: string
}

interface DbTestRun {
  id: string
  name: string
  suite_ids: string[]
  executor_id: string | null
  tester_role: string
  created_at: string
}

interface DbRunResult {
  id: string
  run_id: string
  test_case_id: string
  status: string
  notes: string
}

// ── Mappers: DB row → TypeScript type ────────────────────────────────────────

function toUser(row: DbUser): User {
  return { id: row.id, name: row.name, email: row.email, roles: row.roles as UserRole[] }
}

function toTestSuite(row: DbTestSuite): TestSuite {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    ownerId: row.owner_id ?? '',
    jiraNumber: row.jira_number,
    isHidden: row.is_hidden,
    attributes: row.attributes ?? [],
    createdAt: row.created_at,
  }
}

function toTestCase(row: DbTestCase): TestCase {
  return {
    id: row.id,
    testCaseId: row.test_case_id,
    title: row.title,
    description: row.description,
    preconditions: row.preconditions,
    testData: row.test_data,
    steps: row.steps,
    qaStatus: row.qa_status as TestStatus,
    uatStatus: row.uat_status as TestStatus,
    batStatus: row.bat_status as TestStatus,
    priority: row.priority as Priority,
    testSuiteId: row.test_suite_id ?? '',
    attributeValues: row.attribute_values ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toTestRun(row: DbTestRun, allResults: DbRunResult[]): TestRun {
  return {
    id: row.id,
    name: row.name,
    suiteIds: row.suite_ids,
    executorId: row.executor_id ?? '',
    testerRole: row.tester_role as TesterRole,
    createdAt: row.created_at,
    results: allResults
      .filter(r => r.run_id === row.id)
      .map(r => ({ testCaseId: r.test_case_id, status: r.status as TestStatus, notes: r.notes })),
  }
}

// ── Mapper: TypeScript type → DB insert/update shape ─────────────────────────

function fromTestCase(tc: Omit<TestCase, 'id'>): Omit<DbTestCase, 'id' | 'created_at' | 'updated_at'> {
  return {
    test_case_id: tc.testCaseId,
    title: tc.title,
    description: tc.description,
    preconditions: tc.preconditions,
    test_data: tc.testData,
    steps: tc.steps,
    qa_status: tc.qaStatus,
    uat_status: tc.uatStatus,
    bat_status: tc.batStatus,
    priority: tc.priority,
    test_suite_id: tc.testSuiteId || null,
    attribute_values: tc.attributeValues ?? {},
  }
}

// ── Store Hook ────────────────────────────────────────────────────────────────

export function useTestStore() {
  const [users, setUsers]           = useState<User[]>([])
  const [testSuites, setTestSuites] = useState<TestSuite[]>([])
  const [testCases, setTestCases]   = useState<TestCase[]>([])
  const [testRuns, setTestRuns]     = useState<TestRun[]>([])
  const [loading, setLoading]       = useState(true)

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadAll() {
      const [usersRes, suitesRes, casesRes, runsRes, resultsRes] = await Promise.all([
        supabase.from('users').select('*').order('name'),
        supabase.from('test_suites').select('*').order('created_at'),
        supabase.from('test_cases').select('*').order('created_at'),
        supabase.from('test_runs').select('*').order('created_at', { ascending: false }),
        supabase.from('run_results').select('*'),
      ])
      if (usersRes.data)  setUsers(usersRes.data.map(toUser))
      if (suitesRes.data) setTestSuites(suitesRes.data.map(toTestSuite))
      if (casesRes.data)  setTestCases(casesRes.data.map(toTestCase))
      if (runsRes.data && resultsRes.data) {
        const results = resultsRes.data as DbRunResult[]
        setTestRuns((runsRes.data as DbTestRun[]).map(r => toTestRun(r, results)))
      }
      setLoading(false)
    }
    loadAll()
  }, [])

  // ── Realtime subscriptions ────────────────────────────────────────────────
  // Changes by any collaborator are reflected instantly for all connected users.
  useEffect(() => {
    async function refetchCore() {
      const [u, s, c] = await Promise.all([
        supabase.from('users').select('*').order('name'),
        supabase.from('test_suites').select('*').order('created_at'),
        supabase.from('test_cases').select('*').order('created_at'),
      ])
      if (u.data) setUsers(u.data.map(toUser))
      if (s.data) setTestSuites(s.data.map(toTestSuite))
      if (c.data) setTestCases(c.data.map(toTestCase))
    }

    async function refetchRuns() {
      const [runsRes, resultsRes] = await Promise.all([
        supabase.from('test_runs').select('*').order('created_at', { ascending: false }),
        supabase.from('run_results').select('*'),
      ])
      if (runsRes.data && resultsRes.data) {
        const results = resultsRes.data as DbRunResult[]
        setTestRuns((runsRes.data as DbTestRun[]).map(r => toTestRun(r, results)))
      }
    }

    const channel = supabase
      .channel('qa-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' },       refetchCore)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'test_suites' }, refetchCore)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'test_cases' },  refetchCore)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'test_runs' },   refetchRuns)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'run_results' }, refetchRuns)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // ── Users ─────────────────────────────────────────────────────────────────
  const addUser = useCallback(async (user: Omit<User, 'id'>) => {
    await supabase.from('users').insert({ name: user.name, email: user.email, roles: user.roles })
  }, [])

  const updateUser = useCallback(async (id: string, data: Partial<Omit<User, 'id'>>) => {
    const patch: Partial<DbUser> = {}
    if (data.name  !== undefined) patch.name  = data.name
    if (data.email !== undefined) patch.email = data.email
    if (data.roles !== undefined) patch.roles = data.roles
    await supabase.from('users').update(patch).eq('id', id)
  }, [])

  const deleteUser = useCallback(async (id: string) => {
    await supabase.from('users').delete().eq('id', id)
  }, [])

  // ── Test Suites ───────────────────────────────────────────────────────────
  const addTestSuite = useCallback(async (suite: Omit<TestSuite, 'id'>) => {
    await supabase.from('test_suites').insert({
      name: suite.name,
      description: suite.description,
      owner_id: suite.ownerId || null,
      jira_number: suite.jiraNumber,
      is_hidden: suite.isHidden,
      attributes: suite.attributes ?? [],
    })
  }, [])

  const updateTestSuite = useCallback(async (id: string, data: Partial<Omit<TestSuite, 'id'>>) => {
    const patch: Partial<Omit<DbTestSuite, 'id' | 'created_at'>> = {}
    if (data.name        !== undefined) patch.name        = data.name
    if (data.description !== undefined) patch.description = data.description
    if (data.ownerId     !== undefined) patch.owner_id    = data.ownerId || null
    if (data.jiraNumber  !== undefined) patch.jira_number = data.jiraNumber
    if (data.isHidden    !== undefined) patch.is_hidden   = data.isHidden
    if (data.attributes  !== undefined) patch.attributes  = data.attributes
    await supabase.from('test_suites').update(patch).eq('id', id)
  }, [])

  const deleteTestSuite = useCallback(async (id: string) => {
    // test_cases under this suite are cascade-deleted by the DB foreign key
    await supabase.from('test_suites').delete().eq('id', id)
  }, [])

  // ── Test Cases ────────────────────────────────────────────────────────────
  const addTestCase = useCallback(async (tc: Omit<TestCase, 'id'>) => {
    await supabase.from('test_cases').insert(fromTestCase(tc))
  }, [])

  const updateTestCase = useCallback(async (id: string, data: Partial<Omit<TestCase, 'id'>>) => {
    const patch: Partial<Omit<DbTestCase, 'id' | 'created_at' | 'updated_at'>> = {}
    if (data.testCaseId    !== undefined) patch.test_case_id  = data.testCaseId
    if (data.title         !== undefined) patch.title         = data.title
    if (data.description   !== undefined) patch.description   = data.description
    if (data.preconditions !== undefined) patch.preconditions = data.preconditions
    if (data.testData      !== undefined) patch.test_data     = data.testData
    if (data.steps         !== undefined) patch.steps         = data.steps
    if (data.qaStatus      !== undefined) patch.qa_status     = data.qaStatus
    if (data.uatStatus     !== undefined) patch.uat_status    = data.uatStatus
    if (data.batStatus     !== undefined) patch.bat_status    = data.batStatus
    if (data.priority      !== undefined) patch.priority      = data.priority
    if (data.testSuiteId     !== undefined) patch.test_suite_id  = data.testSuiteId || null
    if (data.attributeValues !== undefined) patch.attribute_values = data.attributeValues
    await supabase.from('test_cases').update(patch).eq('id', id)
  }, [])

  const deleteTestCase = useCallback(async (id: string) => {
    await supabase.from('test_cases').delete().eq('id', id)
  }, [])

  const copyTestCase = useCallback(async (sourceId: string, targetSuiteId?: string) => {
    const source = testCases.find(t => t.id === sourceId)
    if (!source) return
    const maxNum = Math.max(0, ...testCases.map(t => {
      const m = t.testCaseId.match(/TC-(\d+)/)
      return m ? parseInt(m[1], 10) : 0
    }))
    await supabase.from('test_cases').insert({
      ...fromTestCase(source),
      test_case_id: `TC-${String(maxNum + 1).padStart(3, '0')}`,
      title: `${source.title} (Copy)`,
      qa_status: 'Not Run',
      uat_status: 'Not Run',
      bat_status: 'Not Run',
      test_suite_id: targetSuiteId ?? source.testSuiteId ?? null,
    })
  }, [testCases])

  // ── Test Runs ─────────────────────────────────────────────────────────────
  const saveRun = useCallback(async (run: TestRun) => {
    const { data: existing } = await supabase
      .from('test_runs').select('id').eq('id', run.id).maybeSingle()

    if (existing) {
      await supabase.from('test_runs').update({
        name: run.name,
        suite_ids: run.suiteIds,
        executor_id: run.executorId || null,
        tester_role: run.testerRole,
      }).eq('id', run.id)
      await supabase.from('run_results').delete().eq('run_id', run.id)
    } else {
      await supabase.from('test_runs').insert({
        id: run.id,
        name: run.name,
        suite_ids: run.suiteIds,
        executor_id: run.executorId || null,
        tester_role: run.testerRole,
        created_at: run.createdAt,
      })
    }

    if (run.results.length > 0) {
      await supabase.from('run_results').insert(
        run.results.map(r => ({
          run_id: run.id,
          test_case_id: r.testCaseId,
          status: r.status,
          notes: r.notes,
        }))
      )
    }
  }, [])

  return {
    users,
    testSuites,
    testCases,
    testRuns,
    loading,
    addUser,
    updateUser,
    deleteUser,
    addTestSuite,
    updateTestSuite,
    deleteTestSuite,
    addTestCase,
    updateTestCase,
    deleteTestCase,
    copyTestCase,
    saveRun,
  }
}
