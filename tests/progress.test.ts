import { describe, it, expect } from 'vitest'
import { normalizeProgress } from '../src/progress.js'

describe('normalizeProgress', () => {
  it('computes percentage correctly', () => {
    const p = normalizeProgress('download', 50, 100)
    expect(p).toEqual({
      phase: 'download',
      loaded: 50,
      total: 100,
      percentage: 50,
    })
  })

  it('rounds percentage to nearest integer', () => {
    const p = normalizeProgress('download', 33, 100)
    expect(p.percentage).toBe(33)

    const p2 = normalizeProgress('download', 1, 3)
    expect(p2.percentage).toBe(33)
  })

  it('clamps loaded to total', () => {
    const p = normalizeProgress('download', 150, 100)
    expect(p.loaded).toBe(100)
    expect(p.percentage).toBe(100)
  })

  it('clamps loaded to 0 when negative', () => {
    const p = normalizeProgress('initialize', -10, 100)
    expect(p.loaded).toBe(0)
    expect(p.percentage).toBe(0)
  })

  it('handles zero total', () => {
    const p = normalizeProgress('initialize', 0, 0)
    expect(p.percentage).toBe(0)
    expect(p.loaded).toBe(0)
    expect(p.total).toBe(0)
  })

  it('handles negative total', () => {
    const p = normalizeProgress('download', 50, -10)
    expect(p.total).toBe(0)
    expect(p.loaded).toBe(0)
    expect(p.percentage).toBe(0)
  })

  it('caps percentage at 100', () => {
    const p = normalizeProgress('download', 100, 100)
    expect(p.percentage).toBe(100)
  })

  it('preserves phase', () => {
    expect(normalizeProgress('download', 0, 100).phase).toBe('download')
    expect(normalizeProgress('initialize', 0, 100).phase).toBe('initialize')
  })
})
