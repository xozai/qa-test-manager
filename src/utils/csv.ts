import Papa from 'papaparse'
import { TestCase, TestStep, TestSuite, Priority, TestStatus } from '../types'

const PRIORITY_VALUES: Priority[] = ['High', 'Med', 'Low']
const STATUS_VALUES: TestStatus[] = ['Pass', 'Fail', 'Blocked', 'Skipped', 'Not Run']

function isValidPriority(value: string): value is Priority {
  return PRIORITY_VALUES.includes(value as Priority)
}

function isValidStatus(value: string): value is TestStatus {
  return STATUS_VALUES.includes(value as TestStatus)
}

/** Legacy decoder for old ;; encoded step exports — kept for backwards compatibility */
function decodeStepsLegacy(raw: string): TestStep[] {
  if (!raw) return []
  return raw.split(';;').map(pair => {
    const idx = pair.indexOf('|')
    if (idx === -1) return { action: pair.trim(), expectedResult: '' }
    return {
      action: pair.slice(0, idx).trim(),
      expectedResult: pair.slice(idx + 1).trim(),
    }
  })
}

export const CSV_HEADERS = [
  'testCaseId',
  'title',
  'description',
  'preconditions',
  'testData',
  'steps',
  'qaStatus',
  'uatStatus',
  'batStatus',
  'priority',
  'suiteName',
]

export function exportTestCasesToCSV(testCases: TestCase[], testSuites: TestSuite[]): void {
  const suiteMap = Object.fromEntries(testSuites.map(s => [s.id, s.name]))
  const rows = testCases.map(tc => ({
    testCaseId: tc.testCaseId,
    title: tc.title,
    description: tc.description,
    preconditions: tc.preconditions,
    testData: tc.testData,
    steps: JSON.stringify(tc.steps),
    qaStatus: tc.qaStatus,
    uatStatus: tc.uatStatus,
    batStatus: tc.batStatus,
    priority: tc.priority,
    suiteName: suiteMap[tc.testSuiteId] ?? '',
  }))

  const csv = Papa.unparse(rows, { columns: CSV_HEADERS })
  downloadCSV(csv, 'test-cases-export.csv')
}

export function downloadCSVTemplate(testSuites: TestSuite[]): void {
  const suiteName = testSuites[0]?.name ?? 'My Suite Name'
  const sampleSteps = JSON.stringify([
    { action: 'Navigate to the page', expectedResult: 'Page is displayed' },
    { action: 'Perform the action', expectedResult: 'Expected outcome occurs' },
  ])

  const sample = [
    {
      testCaseId: 'TC-006',
      title: 'Sample Test Case',
      description: 'Brief description of what this test verifies.',
      preconditions: 'User is logged in.',
      testData: 'Username: user@example.com',
      steps: sampleSteps,
      qaStatus: 'Not Run',
      uatStatus: 'Not Run',
      batStatus: 'Not Run',
      priority: 'Med',
      suiteName,
    },
  ]

  const csv = Papa.unparse(sample, { columns: CSV_HEADERS })
  downloadCSV(csv, 'test-cases-template.csv')
}

export interface ImportResult {
  imported: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt'>[]
  errors: { row: number; message: string }[]
}

export function importTestCasesFromCSV(file: File, testSuites: TestSuite[]): Promise<ImportResult> {
  const suiteNameMap = Object.fromEntries(
    testSuites.map(s => [s.name.toLowerCase(), s.id])
  )

  return new Promise(resolve => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: results => {
        const imported: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt'>[] = []
        const errors: { row: number; message: string }[] = []

        results.data.forEach((row, index) => {
          const rowNum = index + 2 // 1-based + header row

          if (!row.title?.trim()) {
            errors.push({ row: rowNum, message: 'Missing required field: title' })
            return
          }

          const priority = row.priority?.trim()
          if (!isValidPriority(priority)) {
            errors.push({ row: rowNum, message: `Invalid priority: "${priority}". Must be High, Med, or Low` })
            return
          }

          const qaStatus = row.qaStatus?.trim() || 'Not Run'
          const uatStatus = row.uatStatus?.trim() || 'Not Run'
          const batStatus = row.batStatus?.trim() || 'Not Run'

          if (!isValidStatus(qaStatus)) {
            errors.push({ row: rowNum, message: `Invalid qaStatus: "${qaStatus}"` })
            return
          }
          if (!isValidStatus(uatStatus)) {
            errors.push({ row: rowNum, message: `Invalid uatStatus: "${uatStatus}"` })
            return
          }
          if (!isValidStatus(batStatus)) {
            errors.push({ row: rowNum, message: `Invalid batStatus: "${batStatus}"` })
            return
          }

          // Resolve suite name → ID (support both new "suiteName" and old "testSuiteId" columns)
          const rawSuiteName = (row.suiteName ?? row.testSuiteId ?? '').trim()
          const testSuiteId = suiteNameMap[rawSuiteName.toLowerCase()] ?? ''
          if (rawSuiteName && !testSuiteId) {
            errors.push({ row: rowNum, message: `Suite "${rawSuiteName}" not found — row imported without a suite assignment` })
          }

          // Parse steps: JSON first, fall back to legacy ;; encoding
          let steps: TestStep[] = []
          const rawSteps = row.steps?.trim() || ''
          if (rawSteps) {
            try {
              const parsed = JSON.parse(rawSteps)
              steps = Array.isArray(parsed) ? parsed : []
            } catch {
              steps = decodeStepsLegacy(rawSteps)
            }
          }

          imported.push({
            testCaseId: row.testCaseId?.trim() || '',
            title: row.title.trim(),
            description: row.description?.trim() || '',
            preconditions: row.preconditions?.trim() || '',
            testData: row.testData?.trim() || '',
            steps,
            qaStatus: qaStatus as TestStatus,
            uatStatus: uatStatus as TestStatus,
            batStatus: batStatus as TestStatus,
            priority: priority as Priority,
            testSuiteId,
            attributeValues: {},
          })
        })

        resolve({ imported, errors })
      },
      error: err => {
        resolve({
          imported: [],
          errors: [{ row: 0, message: `Parse error: ${err.message}` }],
        })
      },
    })
  })
}

function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
