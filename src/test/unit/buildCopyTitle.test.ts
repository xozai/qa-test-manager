import { describe, it, expect } from 'vitest'
import { buildCopyTitle } from '../../store/helpers'

describe('buildCopyTitle', () => {
  it('appends (Copy) when no copy exists', () => {
    expect(buildCopyTitle('Login Test', new Set())).toBe('Login Test (Copy)')
  })

  it('appends (Copy 2) when (Copy) already exists', () => {
    expect(buildCopyTitle('Login Test', new Set(['Login Test (Copy)']))).toBe('Login Test (Copy 2)')
  })

  it('appends (Copy 3) when (Copy) and (Copy 2) already exist', () => {
    const existing = new Set(['Login Test (Copy)', 'Login Test (Copy 2)'])
    expect(buildCopyTitle('Login Test', existing)).toBe('Login Test (Copy 3)')
  })

  it('strips existing (Copy) suffix before computing base title', () => {
    // Copying "Login Test (Copy)" should produce "Login Test (Copy 2)"
    const existing = new Set(['Login Test (Copy)'])
    expect(buildCopyTitle('Login Test (Copy)', existing)).toBe('Login Test (Copy 2)')
  })

  it('strips (Copy N) suffix before computing base title', () => {
    // Copying "Login Test (Copy 5)" — base is "Login Test"
    const existing = new Set(['Login Test (Copy)', 'Login Test (Copy 2)'])
    expect(buildCopyTitle('Login Test (Copy 5)', existing)).toBe('Login Test (Copy 3)')
  })

  it('handles non-copy source title with no collisions cleanly', () => {
    expect(buildCopyTitle('Checkout Flow', new Set(['Other Case']))).toBe('Checkout Flow (Copy)')
  })

  it('finds first gap in a non-sequential copy list', () => {
    // (Copy) and (Copy 3) exist but not (Copy 2) — should fill (Copy 2)
    const existing = new Set(['Login Test (Copy)', 'Login Test (Copy 3)'])
    expect(buildCopyTitle('Login Test', existing)).toBe('Login Test (Copy 2)')
  })
})
