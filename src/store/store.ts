import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type {
  User, TestSuite, TestCase, TestStep, TestRun, RunAttachment,
  Defect, DefectSeverity, DefectStatus, Comment, ActivityEvent, ActivityAction,
  UserRole, TestStatus, Priority, TesterRole, AttributeDef, InheritanceConfig,
} from '../types'

// ── DB row types (Supabase returns snake_case) ────────────────────────────────

interface DbUser {
  id: string
  name: string
  email: string
  roles: string[]
  is_active?: boolean
  auth_id?: string
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
  parent_id: string | null
  created_at: string
  updated_at: string
}

interface DbInheritance {
  id: string
  child_id: string
  parent_id: string
  inherit_preconditions: boolean
  inherit_test_data: boolean
  inherit_steps: boolean
  inherit_attributes: boolean
  inherited_attribute_ids: string[]
}

interface DbTestRun {
  id: string
  name: string
  suite_ids: string[]
  executor_id: string | null
  tester_role: string
  status: string
  created_at: string
  completed_at: string | null
}

interface DbRunResult {
  id: string
  run_id: string
  test_case_id: string
  status: string
  notes: string
  attachments: RunAttachment[]
  updated_at: string
}

interface DbDefect {
  id: string
  run_result_id: string | null
  test_case_id: string
  title: string
  severity: string
  description: string
  reporter_id: string | null
  status: string
  created_at: string
}

interface DbComment {
  id: string
  test_case_id: string
  author_id: string | null
  body: string
  created_at: string
}

interface DbActivityEvent {
  id: string
  test_case_id: string
  actor_id: string | null
  action: string
  metadata: Record<string, unknown>
  created_at: string
}

// ── Mappers: DB row → TypeScript type ────────────────────────────────────────

function toUser(row: DbUser & { authId?: string; confirmedAt?: string; lastSignIn?: string }): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    roles: row.roles as UserRole[],
    isActive: row.is_active ?? true,
    authId: row.authId ?? row.auth_id,
    confirmedAt: row.confirmedAt,
    lastSignIn: row.lastSignIn,
  }
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

function toTestCase(row: DbTestCase, inheritanceRows: DbInheritance[] = [], allCases: DbTestCase[] = []): TestCase {
  const inheritRow = inheritanceRows.find(r => r.child_id === row.id)
  const isParent = allCases.some(c => c.parent_id === row.id)
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
    parentId: row.parent_id ?? null,
    isParent,
    inheritanceConfig: inheritRow ? {
      id: inheritRow.id,
      childId: inheritRow.child_id,
      parentId: inheritRow.parent_id,
      inheritPreconditions: inheritRow.inherit_preconditions,
      inheritTestData: inheritRow.inherit_test_data,
      inheritSteps: inheritRow.inherit_steps,
      inheritAttributes: inheritRow.inherit_attributes,
      inheritedAttributeIds: inheritRow.inherited_attribute_ids ?? [],
    } : null,
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
    status: (row.status ?? 'completed') as 'in_progress' | 'completed',
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
    results: allResults
      .filter(r => r.run_id === row.id)
      .map(r => ({
        testCaseId: r.test_case_id,
        status: r.status as TestStatus,
        notes: r.notes,
        attachments: r.attachments ?? [],
      })),
  }
}

function toDefect(row: DbDefect): Defect {
  return {
    id: row.id,
    runResultId: row.run_result_id,
    testCaseId: row.test_case_id,
    title: row.title,
    severity: row.severity as DefectSeverity,
    description: row.description,
    reporterId: row.reporter_id,
    status: row.status as DefectStatus,
    createdAt: row.created_at,
  }
}

function toComment(row: DbComment): Comment {
  return {
    id: row.id,
    testCaseId: row.test_case_id,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at,
  }
}

function toActivityEvent(row: DbActivityEvent): ActivityEvent {
  return {
    id: row.id,
    testCaseId: row.test_case_id,
    actorId: row.actor_id,
    action: row.action as ActivityAction,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
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
    parent_id: tc.parentId ?? null,
  }
}

// ── Store Hook ────────────────────────────────────────────────────────────────

export function useTestStore() {
  const [users, setUsers]           = useState<User[]>([])
  const [testSuites, setTestSuites] = useState<TestSuite[]>([])
  const [testCases, setTestCases]   = useState<TestCase[]>([])
  const [testRuns, setTestRuns]     = useState<TestRun[]>([])
  const [defects, setDefects]       = useState<Defect[]>([])
  const [loading, setLoading]       = useState(true)

  async function getCurrentUserId(): Promise<string | null> {
    const { data } = await supabase.auth.getUser()
    if (!data.user) return null
    // Look up app user by auth email
    const { data: row } = await supabase
      .from('users').select('id').eq('email', data.user.email ?? '').maybeSingle()
    return row?.id ?? null
  }

  // ── Helper: reload test cases + inheritance together ──────────────────────
  async function reloadCases() {
    const [casesRes, inhRes] = await Promise.all([
      supabase.from('test_cases').select('*').order('created_at'),
      supabase.from('test_case_inheritance').select('*'),
    ])
    if (casesRes.data && inhRes.data) {
      const rawCases = casesRes.data as DbTestCase[]
      const rawInh   = inhRes.data as DbInheritance[]
      setTestCases(rawCases.map(c => toTestCase(c, rawInh, rawCases)))
    }
  }

  // ── Helper: load auth-linked users via edge function ─────────────────────
  async function loadAuthUsers() {
    const { data: { session } } = await supabase.auth.getSession()
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-auth-users`, {
      headers: { 'Authorization': `Bearer ${session?.access_token ?? ''}` },
    })
    if (resp.ok) {
      const { users: authUsers } = await resp.json() as { users: Record<string, unknown>[] }
      setUsers(authUsers.map(u => toUser(u as unknown as DbUser & { authId?: string; confirmedAt?: string; lastSignIn?: string })))
    }
  }

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadAll() {
      const [suitesRes, casesRes, runsRes, resultsRes, inhRes, defectsRes] = await Promise.all([
        supabase.from('test_suites').select('*').order('created_at'),
        supabase.from('test_cases').select('*').order('created_at'),
        supabase.from('test_runs').select('*').order('created_at', { ascending: false }),
        supabase.from('run_results').select('*'),
        supabase.from('test_case_inheritance').select('*'),
        supabase.from('defects').select('*').order('created_at', { ascending: false }),
      ])
      await loadAuthUsers()
      if (suitesRes.data) setTestSuites(suitesRes.data.map(toTestSuite))
      if (casesRes.data && inhRes.data) {
        const rawCases = casesRes.data as DbTestCase[]
        const rawInh   = inhRes.data as DbInheritance[]
        setTestCases(rawCases.map(c => toTestCase(c, rawInh, rawCases)))
      }
      if (runsRes.data && resultsRes.data) {
        const results = resultsRes.data as DbRunResult[]
        setTestRuns((runsRes.data as DbTestRun[]).map(r => toTestRun(r, results)))
      }
      if (defectsRes.data) setDefects(defectsRes.data.map(toDefect))
      setLoading(false)
    }
    loadAll()
  }, [])

  // ── Realtime subscriptions ────────────────────────────────────────────────
  useEffect(() => {
    async function refetchCore() {
      const [s] = await Promise.all([
        supabase.from('test_suites').select('*').order('created_at'),
      ])
      await loadAuthUsers()
      if (s.data) setTestSuites(s.data.map(toTestSuite))
      await reloadCases()
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

    async function refetchDefects() {
      const { data } = await supabase.from('defects').select('*').order('created_at', { ascending: false })
      if (data) setDefects(data.map(toDefect))
    }

    const channel = supabase
      .channel('qa-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' },                  refetchCore)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'test_suites' },            refetchCore)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'test_cases' },             reloadCases)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'test_case_inheritance' },  reloadCases)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'test_runs' },              refetchRuns)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'run_results' },            refetchRuns)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'defects' },               refetchDefects)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // ── Users ─────────────────────────────────────────────────────────────────
  const addUser = useCallback(async (user: Omit<User, 'id'>) => {
    const { data, error } = await supabase
      .from('users')
      .insert({ name: user.name, email: user.email, roles: user.roles })
      .select()
      .single()
    if (error) throw error
    if (data) setUsers(prev => [...prev, toUser(data as DbUser)])
  }, [])

  const updateUser = useCallback(async (id: string, data: Partial<Omit<User, 'id'>>) => {
    const patch: Partial<DbUser> = {}
    if (data.name  !== undefined) patch.name  = data.name
    if (data.email !== undefined) patch.email = data.email
    if (data.roles !== undefined) patch.roles = data.roles
    const { error } = await supabase.from('users').update(patch).eq('id', id)
    if (error) throw error
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...data } : u))
  }, [])

  const deleteUser = useCallback(async (id: string) => {
    const { error } = await supabase.from('users').delete().eq('id', id)
    if (error) throw error
    setUsers(prev => prev.filter(u => u.id !== id))
  }, [])

  const removeAuthUser = useCallback(async (authId: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-auth-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ authId }),
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error((err as { error?: string }).error ?? 'Failed to remove user')
    }
    setUsers(prev => prev.filter(u => u.authId !== authId))
  }, [])

  // ── Test Suites ───────────────────────────────────────────────────────────
  const addTestSuite = useCallback(async (suite: Omit<TestSuite, 'id'>): Promise<string | null> => {
    const { data } = await supabase.from('test_suites').insert({
      name: suite.name,
      description: suite.description,
      owner_id: suite.ownerId || null,
      jira_number: suite.jiraNumber,
      is_hidden: suite.isHidden,
      attributes: suite.attributes ?? [],
    }).select('id').single()
    return data?.id ?? null
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
    const { data } = await supabase.from('test_cases').insert(fromTestCase(tc)).select('id').single()
    if (data?.id) void logActivity(data.id, 'created', { title: tc.title })
  }, [])

  const updateTestCase = useCallback(async (id: string, data: Partial<Omit<TestCase, 'id'>>) => {
    const patch: Partial<Omit<DbTestCase, 'id' | 'created_at' | 'updated_at'>> = {}
    if (data.testCaseId      !== undefined) patch.test_case_id     = data.testCaseId
    if (data.title           !== undefined) patch.title            = data.title
    if (data.description     !== undefined) patch.description      = data.description
    if (data.preconditions   !== undefined) patch.preconditions    = data.preconditions
    if (data.testData        !== undefined) patch.test_data        = data.testData
    if (data.steps           !== undefined) patch.steps            = data.steps
    if (data.qaStatus        !== undefined) patch.qa_status        = data.qaStatus
    if (data.uatStatus       !== undefined) patch.uat_status       = data.uatStatus
    if (data.batStatus       !== undefined) patch.bat_status       = data.batStatus
    if (data.priority        !== undefined) patch.priority         = data.priority
    if (data.testSuiteId     !== undefined) patch.test_suite_id    = data.testSuiteId || null
    if (data.attributeValues !== undefined) patch.attribute_values = data.attributeValues
    await supabase.from('test_cases').update(patch).eq('id', id)
    const changedFields = Object.keys(data)
    if (changedFields.length > 0) void logActivity(id, 'edited', { fields: changedFields })

    // Propagate inherited fields to children
    const { data: inhRows } = await supabase
      .from('test_case_inheritance')
      .select('*')
      .eq('parent_id', id)
    if (!inhRows || inhRows.length === 0) return

    const { data: childRows } = await supabase
      .from('test_cases')
      .select('*')
      .in('id', (inhRows as DbInheritance[]).map(r => r.child_id))
    if (!childRows) return

    for (const inh of inhRows as DbInheritance[]) {
      const child = (childRows as DbTestCase[]).find(c => c.id === inh.child_id)
      if (!child) continue
      const childPatch: Partial<Omit<DbTestCase, 'id' | 'created_at' | 'updated_at'>> = {}
      if (inh.inherit_preconditions && data.preconditions !== undefined)
        childPatch.preconditions = data.preconditions
      if (inh.inherit_test_data && data.testData !== undefined)
        childPatch.test_data = data.testData
      if (inh.inherit_steps && data.steps !== undefined)
        childPatch.steps = data.steps
      if (data.attributeValues !== undefined) {
        if (inh.inherit_attributes) {
          // Inherit ALL attributes
          const merged = { ...child.attribute_values }
          for (const key of Object.keys(data.attributeValues)) {
            if (key in merged) merged[key] = data.attributeValues[key]
          }
          childPatch.attribute_values = merged
        } else if (inh.inherited_attribute_ids?.length) {
          // Inherit only specific attributes
          const merged = { ...child.attribute_values }
          for (const attrId of inh.inherited_attribute_ids) {
            if (attrId in data.attributeValues) merged[attrId] = data.attributeValues[attrId]
          }
          childPatch.attribute_values = merged
        }
      }
      if (Object.keys(childPatch).length > 0) {
        await supabase.from('test_cases').update(childPatch).eq('id', inh.child_id)
      }
    }
  }, [])

  const deleteTestCase = useCallback(async (id: string) => {
    // Children: nullify their parent_id (cascade via ON DELETE SET NULL on DB)
    await supabase.from('test_cases').delete().eq('id', id)
  }, [])

  // ── Inheritance ───────────────────────────────────────────────────────────
  const linkChildToParent = useCallback(async (
    childId: string,
    parentId: string,
    config: Omit<InheritanceConfig, 'id' | 'childId' | 'parentId'>,
  ) => {
    // Set parent_id on child
    await supabase.from('test_cases').update({ parent_id: parentId }).eq('id', childId)
    // Upsert inheritance config
    await supabase.from('test_case_inheritance').upsert({
      child_id: childId,
      parent_id: parentId,
      inherit_preconditions: config.inheritPreconditions,
      inherit_test_data: config.inheritTestData,
      inherit_steps: config.inheritSteps,
      inherit_attributes: config.inheritAttributes,
      inherited_attribute_ids: config.inheritedAttributeIds ?? [],
    }, { onConflict: 'child_id' })

    // Immediately apply inherited fields from parent to child
    const { data: parentRow } = await supabase
      .from('test_cases').select('*').eq('id', parentId).single()
    if (!parentRow) return
    const parent = parentRow as DbTestCase
    const { data: childRow } = await supabase
      .from('test_cases').select('*').eq('id', childId).single()
    if (!childRow) return
    const child = childRow as DbTestCase

    const applyPatch: Partial<Omit<DbTestCase, 'id' | 'created_at' | 'updated_at'>> = {}
    if (config.inheritPreconditions) applyPatch.preconditions = parent.preconditions
    if (config.inheritTestData)      applyPatch.test_data     = parent.test_data
    if (config.inheritSteps)         applyPatch.steps         = parent.steps
    if (config.inheritAttributes) {
      const merged = { ...child.attribute_values }
      for (const key of Object.keys(parent.attribute_values)) {
        if (key in merged) merged[key] = parent.attribute_values[key]
      }
      applyPatch.attribute_values = merged
    } else if (config.inheritedAttributeIds?.length) {
      const merged = { ...child.attribute_values }
      for (const attrId of config.inheritedAttributeIds) {
        if (attrId in parent.attribute_values) merged[attrId] = parent.attribute_values[attrId]
      }
      applyPatch.attribute_values = merged
    }
    if (Object.keys(applyPatch).length > 0) {
      await supabase.from('test_cases').update(applyPatch).eq('id', childId)
    }
    await reloadCases()
  }, [])

  const updateInheritance = useCallback(async (
    childId: string,
    config: Omit<InheritanceConfig, 'id' | 'childId' | 'parentId'>,
    parentId: string,
  ) => {
    await supabase.from('test_case_inheritance').update({
      inherit_preconditions: config.inheritPreconditions,
      inherit_test_data: config.inheritTestData,
      inherit_steps: config.inheritSteps,
      inherit_attributes: config.inheritAttributes,
      inherited_attribute_ids: config.inheritedAttributeIds ?? [],
    }).eq('child_id', childId)
    // Re-apply inherited fields
    const { data: parentRow } = await supabase
      .from('test_cases').select('*').eq('id', parentId).single()
    if (!parentRow) return
    const parent = parentRow as DbTestCase
    const { data: childRow } = await supabase
      .from('test_cases').select('*').eq('id', childId).single()
    if (!childRow) return
    const child = childRow as DbTestCase

    const applyPatch: Partial<Omit<DbTestCase, 'id' | 'created_at' | 'updated_at'>> = {}
    if (config.inheritPreconditions) applyPatch.preconditions = parent.preconditions
    if (config.inheritTestData)      applyPatch.test_data     = parent.test_data
    if (config.inheritSteps)         applyPatch.steps         = parent.steps
    if (config.inheritAttributes) {
      const merged = { ...child.attribute_values }
      for (const key of Object.keys(parent.attribute_values)) {
        if (key in merged) merged[key] = parent.attribute_values[key]
      }
      applyPatch.attribute_values = merged
    } else if (config.inheritedAttributeIds?.length) {
      const merged = { ...child.attribute_values }
      for (const attrId of config.inheritedAttributeIds) {
        if (attrId in parent.attribute_values) merged[attrId] = parent.attribute_values[attrId]
      }
      applyPatch.attribute_values = merged
    }
    if (Object.keys(applyPatch).length > 0) {
      await supabase.from('test_cases').update(applyPatch).eq('id', childId)
    }
    await reloadCases()
  }, [])

  const unlinkChild = useCallback(async (childId: string) => {
    await supabase.from('test_case_inheritance').delete().eq('child_id', childId)
    await supabase.from('test_cases').update({ parent_id: null }).eq('id', childId)
    await reloadCases()
  }, [])

  const bulkDeleteTestCases = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return
    await supabase.from('test_cases').delete().in('id', ids)
  }, [])

  const bulkUpdateTestCases = useCallback(async (
    ids: string[],
    patch: Partial<Pick<TestCase, 'qaStatus' | 'uatStatus' | 'batStatus' | 'testSuiteId'>>,
  ) => {
    if (ids.length === 0) return
    const dbPatch: Record<string, unknown> = {}
    if (patch.qaStatus    !== undefined) dbPatch.qa_status     = patch.qaStatus
    if (patch.uatStatus   !== undefined) dbPatch.uat_status    = patch.uatStatus
    if (patch.batStatus   !== undefined) dbPatch.bat_status    = patch.batStatus
    if (patch.testSuiteId !== undefined) dbPatch.test_suite_id = patch.testSuiteId || null
    await supabase.from('test_cases').update(dbPatch).in('id', ids)
    const action: ActivityAction = patch.testSuiteId !== undefined ? 'moved' : 'status_changed'
    for (const id of ids) void logActivity(id, action, dbPatch)
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

  // ── Activity Log helper ───────────────────────────────────────────────────
  async function logActivity(testCaseId: string, action: ActivityAction, metadata: Record<string, unknown> = {}) {
    const actorId = await getCurrentUserId()
    await supabase.from('activity_log').insert({
      test_case_id: testCaseId,
      actor_id: actorId,
      action,
      metadata,
    })
  }

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

  // ── Persistent Run methods ────────────────────────────────────────────────
  const createTestRun = useCallback(async (opts: {
    name: string
    suiteIds: string[]
    executorId: string
    testerRole: TesterRole
  }): Promise<TestRun> => {
    const { data, error } = await supabase.from('test_runs').insert({
      name: opts.name,
      suite_ids: opts.suiteIds,
      executor_id: opts.executorId || null,
      tester_role: opts.testerRole,
      status: 'in_progress',
    }).select().single()
    if (error || !data) throw error ?? new Error('Failed to create run')
    return toTestRun(data as DbTestRun, [])
  }, [])

  const upsertRunResult = useCallback(async (
    runId: string,
    result: { testCaseId: string; status: TestStatus; notes: string; attachments?: RunAttachment[] },
  ): Promise<void> => {
    await supabase.from('run_results').upsert({
      run_id: runId,
      test_case_id: result.testCaseId,
      status: result.status,
      notes: result.notes,
      attachments: result.attachments ?? [],
      updated_at: new Date().toISOString(),
    }, { onConflict: 'run_id,test_case_id' })
  }, [])

  const completeTestRun = useCallback(async (runId: string): Promise<void> => {
    await supabase.from('test_runs').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', runId)
  }, [])

  const deleteTestRun = useCallback(async (id: string): Promise<void> => {
    await supabase.from('run_results').delete().eq('run_id', id)
    await supabase.from('test_runs').delete().eq('id', id)
  }, [])

  const uploadRunAttachment = useCallback(async (
    runId: string,
    tcId: string,
    file: File,
  ): Promise<string> => {
    const path = `${runId}/${tcId}/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('run-attachments').upload(path, file)
    if (error) throw error
    const { data: urlData } = supabase.storage.from('run-attachments').getPublicUrl(path)
    return urlData.publicUrl
  }, [])

  // ── Defects ──────────────────────────────────────────────────────────────
  const addDefect = useCallback(async (defect: Omit<Defect, 'id' | 'createdAt'>): Promise<void> => {
    const reporterId = await getCurrentUserId()
    await supabase.from('defects').insert({
      run_result_id: defect.runResultId ?? null,
      test_case_id: defect.testCaseId,
      title: defect.title,
      severity: defect.severity,
      description: defect.description,
      reporter_id: reporterId,
      status: defect.status,
    })
  }, [])

  const updateDefect = useCallback(async (id: string, patch: Partial<Pick<Defect, 'status' | 'title' | 'severity' | 'description'>>): Promise<void> => {
    await supabase.from('defects').update(patch).eq('id', id)
  }, [])

  const deleteDefect = useCallback(async (id: string): Promise<void> => {
    await supabase.from('defects').delete().eq('id', id)
  }, [])

  // ── Comments ─────────────────────────────────────────────────────────────
  const fetchComments = useCallback(async (testCaseId: string): Promise<{ comments: Comment[]; activity: ActivityEvent[] }> => {
    const [commentsRes, activityRes] = await Promise.all([
      supabase.from('comments').select('*').eq('test_case_id', testCaseId).order('created_at', { ascending: false }),
      supabase.from('activity_log').select('*').eq('test_case_id', testCaseId).order('created_at', { ascending: false }),
    ])
    return {
      comments: (commentsRes.data ?? []).map(toComment),
      activity: (activityRes.data ?? []).map(toActivityEvent),
    }
  }, [])

  const addComment = useCallback(async (testCaseId: string, body: string): Promise<void> => {
    const authorId = await getCurrentUserId()
    await supabase.from('comments').insert({ test_case_id: testCaseId, author_id: authorId, body })
  }, [])

  // ── Bulk add test cases to an existing suite (AI import) ─────────────────
  const addTestCasesToSuite = useCallback(async (
    suiteId: string,
    cases: Omit<TestCase, 'id'>[],
  ): Promise<void> => {
    if (cases.length === 0) return
    const rows = cases.map(tc => ({ ...fromTestCase(tc), test_suite_id: suiteId }))
    await supabase.from('test_cases').insert(rows)
  }, [])

  // ── User active flag ──────────────────────────────────────────────────────
  const setUserActive = useCallback(async (id: string, isActive: boolean): Promise<void> => {
    await supabase.from('users').update({ is_active: isActive }).eq('id', id)
  }, [])

  return {
    users,
    testSuites,
    testCases,
    testRuns,
    defects,
    loading,
    addUser,
    updateUser,
    deleteUser,
    removeAuthUser,
    setUserActive,
    addTestSuite,
    updateTestSuite,
    deleteTestSuite,
    addTestCase,
    updateTestCase,
    deleteTestCase,
    copyTestCase,
    bulkDeleteTestCases,
    bulkUpdateTestCases,
    addTestCasesToSuite,
    saveRun,
    createTestRun,
    upsertRunResult,
    completeTestRun,
    deleteTestRun,
    uploadRunAttachment,
    addDefect,
    updateDefect,
    deleteDefect,
    fetchComments,
    addComment,
    logActivity,
    linkChildToParent,
    updateInheritance,
    unlinkChild,
  }
}
