/**
 * Pure helper functions with no Supabase dependency.
 * Exported here so unit tests can import without triggering the Supabase client.
 */
import type {
  TestSuite, TestCase, TestStep, TestStatus, Priority, AttributeDef,
} from '../types'

// ── DB row types (mirrored from store.ts for use in tests) ────────────────────

export interface DbTestSuite {
  id: string
  name: string
  description: string
  owner_id: string | null
  jira_number: string
  is_hidden: boolean
  attributes: AttributeDef[]
  suite_number: number
  created_at: string
}

export interface DbTestCase {
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

export interface DbInheritance {
  id: string
  child_id: string
  parent_id: string
  inherit_preconditions: boolean
  inherit_test_data: boolean
  inherit_steps: boolean
  inherit_attributes: boolean
  inherited_attribute_ids: string[]
}

// ── Mappers ───────────────────────────────────────────────────────────────────

export function toTestSuite(row: DbTestSuite): TestSuite {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    ownerId: row.owner_id ?? '',
    jiraNumber: row.jira_number,
    isHidden: row.is_hidden,
    attributes: row.attributes ?? [],
    suiteNumber: row.suite_number,
    createdAt: row.created_at,
  }
}

export function toTestCase(
  row: DbTestCase,
  inheritanceRows: DbInheritance[] = [],
  allCases: DbTestCase[] = [],
): TestCase {
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

export function fromTestCase(tc: Omit<TestCase, 'id'>): Omit<DbTestCase, 'id' | 'created_at' | 'updated_at'> {
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

// ── Copy title helper ─────────────────────────────────────────────────────────

export function buildCopyTitle(sourceTitle: string, existingTitles: Set<string>): string {
  const baseTitle = sourceTitle.replace(/ \(Copy(?: \d+)?\)$/, '')
  let copyTitle = `${baseTitle} (Copy)`
  if (existingTitles.has(copyTitle)) {
    let n = 2
    while (existingTitles.has(`${baseTitle} (Copy ${n})`)) n++
    copyTitle = `${baseTitle} (Copy ${n})`
  }
  return copyTitle
}

// ── ID Generation ─────────────────────────────────────────────────────────────

export function generateTestCaseId(
  suiteNumber: number,
  existingCasesInSuite: TestCase[],
  parentId?: string | null,
): string {
  if (parentId) {
    const parent = existingCasesInSuite.find(tc => tc.id === parentId)
    const parentTcId = parent?.testCaseId ?? `TS-${suiteNumber}-1`
    const siblings = existingCasesInSuite.filter(tc => tc.parentId === parentId)
    const maxSibSeq = siblings.reduce((m, tc) => {
      const seg = Number(tc.testCaseId.split('-').pop())
      return isNaN(seg) ? m : Math.max(m, seg)
    }, 0)
    return `${parentTcId}-${maxSibSeq + 1}`
  }
  const standalones = existingCasesInSuite.filter(tc => !tc.parentId)
  const maxSeq = standalones.reduce((m, tc) => {
    const seg = Number(tc.testCaseId.split('-').pop())
    return isNaN(seg) ? m : Math.max(m, seg)
  }, 0)
  return `TS-${suiteNumber}-${maxSeq + 1}`
}
