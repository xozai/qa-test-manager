// ============================================
// QA Test Case Management System - Data Models
// ============================================

export type UserRole = 'BSA' | 'Dev' | 'QA' | 'UAT' | 'BAT'
export type TesterRole = 'QA' | 'UAT' | 'BAT'
export type Priority = 'High' | 'Med' | 'Low'
export type TestStatus = 'Untested' | 'Not Run' | 'Pass' | 'Fail' | 'Blocked' | 'Skipped'

export interface User {
  id: string
  name: string
  email: string
  roles: UserRole[]
  isActive?: boolean
  authId?: string        // auth.users UUID — present for real auth-linked users
  confirmedAt?: string   // when they accepted the invite (null = pending)
  lastSignIn?: string    // last login timestamp
}

export interface AttributeDef {
  id: string
  name: string
  type: 'text' | 'select' | 'boolean'
  options?: string[]
  inheritable?: boolean   // default true — controls whether child cases can inherit this attribute
}

export interface TestSuite {
  id: string
  name: string
  description: string
  ownerId: string
  jiraNumber: string
  isHidden: boolean
  attributes: AttributeDef[]
  suiteNumber?: number
  createdAt?: string
}

export interface TestStep {
  id?: string
  action: string
  expectedResult: string
}

export interface InheritanceConfig {
  id: string
  childId: string
  parentId: string
  inheritPreconditions: boolean
  inheritTestData: boolean
  inheritSteps: boolean
  inheritAttributes: boolean        // true = inherit ALL custom attributes
  inheritedAttributeIds: string[]   // IDs of specific attributes to inherit when inheritAttributes is false
}

export interface TestCase {
  id: string
  testCaseId: string
  title: string
  description: string
  preconditions: string
  testData: string
  steps: TestStep[]
  qaStatus: TestStatus
  uatStatus: TestStatus
  batStatus: TestStatus
  priority: Priority
  testSuiteId: string
  attributeValues: Record<string, string | boolean>
  parentId?: string | null
  inheritanceConfig?: InheritanceConfig | null
  isParent?: boolean
  createdAt?: string
  updatedAt?: string
}

// Additional types for UI/features
export interface SortConfig {
  key: keyof TestCase
  direction: 'asc' | 'desc'
  priority: number
}

export interface RunAttachment {
  name: string
  url: string
}

export interface RunResult {
  testCaseId: string
  status: TestStatus
  notes: string
  attachments?: RunAttachment[]
}

export interface TestRun {
  id: string
  name: string
  suiteIds: string[]
  executorId: string
  testerRole: TesterRole
  status: 'in_progress' | 'completed'
  results: RunResult[]
  createdAt: string
  completedAt?: string
}

export type DefectSeverity = 'Critical' | 'High' | 'Med' | 'Low'
export type DefectStatus = 'Open' | 'Fixed' | 'Closed'

export interface Defect {
  id: string
  runResultId?: string | null
  testCaseId: string
  title: string
  severity: DefectSeverity
  description: string
  reporterId?: string | null
  status: DefectStatus
  createdAt: string
}

export interface Comment {
  id: string
  testCaseId: string
  authorId?: string | null
  body: string
  createdAt: string
}

export type ActivityAction = 'created' | 'edited' | 'status_changed' | 'moved' | 'duplicated'

export interface ActivityEvent {
  id: string
  testCaseId: string
  actorId?: string | null
  action: ActivityAction
  metadata: Record<string, unknown>
  createdAt: string
}
