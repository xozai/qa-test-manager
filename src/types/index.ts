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
}

export interface AttributeDef {
  id: string
  name: string
  type: 'text' | 'select' | 'boolean'
  options?: string[]
}

export interface TestSuite {
  id: string
  name: string
  description: string
  ownerId: string
  jiraNumber: string
  isHidden: boolean
  attributes: AttributeDef[]
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
  inheritAttributes: boolean
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

export interface RunResult {
  testCaseId: string
  status: TestStatus
  notes: string
}

export interface TestRun {
  id: string
  name: string
  suiteIds: string[]
  executorId: string
  testerRole: TesterRole
  results: RunResult[]
  createdAt: string
}
