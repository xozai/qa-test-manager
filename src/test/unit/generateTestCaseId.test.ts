import { describe, it, expect } from 'vitest'
import { generateTestCaseId } from '../../store/helpers'
import type { TestCase } from '../../types'

function makeCase(overrides: Partial<TestCase> & { testCaseId: string }): TestCase {
  const { testCaseId, ...rest } = overrides
  return {
    id: rest.id ?? testCaseId,
    testCaseId,
    title: 'Test',
    description: '',
    preconditions: '',
    testData: '',
    steps: [],
    qaStatus: 'Not Run',
    uatStatus: 'Not Run',
    batStatus: 'Not Run',
    priority: 'Med',
    testSuiteId: 'suite-1',
    attributeValues: {},
    parentId: overrides.parentId ?? null,
    isParent: overrides.isParent ?? false,
    inheritanceConfig: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...rest,
  }
}

describe('generateTestCaseId — standalone (no parentId)', () => {
  it('returns TS-1-1 for an empty suite', () => {
    expect(generateTestCaseId(1, [])).toBe('TS-1-1')
  })

  it('returns TS-1-4 when 3 standalones exist (TS-1-1, TS-1-2, TS-1-3)', () => {
    const cases = [
      makeCase({ testCaseId: 'TS-1-1' }),
      makeCase({ testCaseId: 'TS-1-2' }),
      makeCase({ testCaseId: 'TS-1-3' }),
    ]
    expect(generateTestCaseId(1, cases)).toBe('TS-1-4')
  })

  it('uses max+1, not count+1, when a case has been deleted (gap in sequence)', () => {
    // TS-1-2 was deleted — only TS-1-1 and TS-1-3 remain (count=2, max=3)
    const cases = [
      makeCase({ testCaseId: 'TS-1-1' }),
      makeCase({ testCaseId: 'TS-1-3' }),
    ]
    expect(generateTestCaseId(1, cases)).toBe('TS-1-4')
  })

  it('uses correct suite number', () => {
    expect(generateTestCaseId(5, [])).toBe('TS-5-1')
  })

  it('ignores child cases when computing next standalone ID', () => {
    const cases = [
      makeCase({ testCaseId: 'TS-1-1' }),
      makeCase({ id: 'child-1', testCaseId: 'TS-1-1-1', parentId: 'TS-1-1' }),
    ]
    expect(generateTestCaseId(1, cases)).toBe('TS-1-2')
  })
})

describe('generateTestCaseId — child (with parentId)', () => {
  it('returns TS-1-2-1 for the first child of TS-1-2', () => {
    const parent = makeCase({ id: 'parent-1', testCaseId: 'TS-1-2', isParent: true })
    const cases = [
      makeCase({ testCaseId: 'TS-1-1' }),
      parent,
    ]
    expect(generateTestCaseId(1, cases, 'parent-1')).toBe('TS-1-2-1')
  })

  it('returns next sibling number when children already exist', () => {
    const parent = makeCase({ id: 'parent-1', testCaseId: 'TS-1-2', isParent: true })
    const child1 = makeCase({ id: 'child-1', testCaseId: 'TS-1-2-1', parentId: 'parent-1' })
    const child2 = makeCase({ id: 'child-2', testCaseId: 'TS-1-2-2', parentId: 'parent-1' })
    expect(generateTestCaseId(1, [parent, child1, child2], 'parent-1')).toBe('TS-1-2-3')
  })

  it('uses max+1 not count+1 when a sibling was deleted', () => {
    const parent = makeCase({ id: 'parent-1', testCaseId: 'TS-1-2', isParent: true })
    // TS-1-2-2 was deleted — only TS-1-2-1 and TS-1-2-3 remain
    const child1 = makeCase({ id: 'child-1', testCaseId: 'TS-1-2-1', parentId: 'parent-1' })
    const child3 = makeCase({ id: 'child-3', testCaseId: 'TS-1-2-3', parentId: 'parent-1' })
    expect(generateTestCaseId(1, [parent, child1, child3], 'parent-1')).toBe('TS-1-2-4')
  })

  it('falls back gracefully when parent not found in list', () => {
    const child = makeCase({ id: 'orphan', testCaseId: 'TS-1-1-1', parentId: 'missing-id' })
    // parent not in cases list — should still return a TS-N-1-1 style ID
    const result = generateTestCaseId(1, [child], 'missing-id')
    expect(result).toMatch(/^TS-1-1-/)
  })
})
