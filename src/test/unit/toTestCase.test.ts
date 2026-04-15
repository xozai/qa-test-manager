import { describe, it, expect } from 'vitest'
import { toTestCase } from '../../store/helpers'

const baseRow = {
  id: 'case-1',
  test_case_id: 'TS-1-1',
  title: 'Login Test',
  description: 'Desc',
  preconditions: 'Pre',
  test_data: 'Data',
  steps: [{ action: 'Click login', expectedResult: 'Modal opens' }],
  qa_status: 'Not Run',
  uat_status: 'Not Run',
  bat_status: 'Not Run',
  priority: 'Med',
  test_suite_id: 'suite-1',
  attribute_values: { env: 'prod' },
  parent_id: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const baseInheritRow = {
  id: 'inh-1',
  child_id: 'case-1',
  parent_id: 'case-0',
  inherit_preconditions: true,
  inherit_test_data: false,
  inherit_steps: true,
  inherit_attributes: false,
  inherited_attribute_ids: ['env'],
}

describe('toTestCase', () => {
  it('maps a basic row with no inheritance correctly', () => {
    const tc = toTestCase(baseRow)
    expect(tc.id).toBe('case-1')
    expect(tc.testCaseId).toBe('TS-1-1')
    expect(tc.title).toBe('Login Test')
    expect(tc.qaStatus).toBe('Not Run')
    expect(tc.priority).toBe('Med')
    expect(tc.testSuiteId).toBe('suite-1')
    expect(tc.attributeValues).toEqual({ env: 'prod' })
    expect(tc.parentId).toBeNull()
    expect(tc.isParent).toBe(false)
    expect(tc.inheritanceConfig).toBeNull()
  })

  it('sets isParent true when another case references this row as parent_id', () => {
    const childRow = { ...baseRow, id: 'case-2', test_case_id: 'TS-1-2', parent_id: 'case-1' }
    const tc = toTestCase(baseRow, [], [baseRow, childRow])
    expect(tc.isParent).toBe(true)
  })

  it('sets isParent false when no cases reference this row', () => {
    const tc = toTestCase(baseRow, [], [baseRow])
    expect(tc.isParent).toBe(false)
  })

  it('populates inheritanceConfig when a matching inheritance row exists', () => {
    const tc = toTestCase(baseRow, [baseInheritRow])
    expect(tc.inheritanceConfig).not.toBeNull()
    expect(tc.inheritanceConfig!.id).toBe('inh-1')
    expect(tc.inheritanceConfig!.childId).toBe('case-1')
    expect(tc.inheritanceConfig!.parentId).toBe('case-0')
    expect(tc.inheritanceConfig!.inheritPreconditions).toBe(true)
    expect(tc.inheritanceConfig!.inheritTestData).toBe(false)
    expect(tc.inheritanceConfig!.inheritSteps).toBe(true)
    expect(tc.inheritanceConfig!.inheritAttributes).toBe(false)
    expect(tc.inheritanceConfig!.inheritedAttributeIds).toEqual(['env'])
  })

  it('sets inheritanceConfig to null when no matching inheritance row', () => {
    const otherInh = { ...baseInheritRow, child_id: 'case-999' }
    const tc = toTestCase(baseRow, [otherInh])
    expect(tc.inheritanceConfig).toBeNull()
  })

  it('sets parentId from parent_id field', () => {
    const childRow = { ...baseRow, parent_id: 'case-0' }
    const tc = toTestCase(childRow)
    expect(tc.parentId).toBe('case-0')
  })

  it('defaults attributeValues to {} when attribute_values is null', () => {
    const row = { ...baseRow, attribute_values: null as unknown as Record<string, string> }
    const tc = toTestCase(row)
    expect(tc.attributeValues).toEqual({})
  })

  it('maps steps array correctly', () => {
    const tc = toTestCase(baseRow)
    expect(tc.steps).toHaveLength(1)
    expect(tc.steps[0].action).toBe('Click login')
    expect(tc.steps[0].expectedResult).toBe('Modal opens')
  })
})
