import { describe, it, expect } from 'vitest'
import * as path from 'path'
import { verify } from '../../helpers/component-paths'

const ROOT_DIR = path.resolve(__dirname, '../../..')

describe('verify-component-paths', () => {
  it('should scan and produce reports for all components', () => {
    const { reports } = verify(ROOT_DIR)
    expect(reports.length).toBeGreaterThan(0)
    // Every report should have a componentId and sources
    for (const r of reports) {
      expect(r.componentId).toBeTruthy()
      expect(r.sources.length).toBeGreaterThan(0)
    }
  })

  it('should check all four paths for each component', () => {
    const { reports } = verify(ROOT_DIR)
    for (const r of reports) {
      for (const cell of ['code.lift', 'blocks.render', 'blocks.lift', 'code.render']) expect(Object.keys(r.paths)).toContain(cell)
    }
  })

  it('should report missing paths in the missing array', () => {
    const { reports } = verify(ROOT_DIR)
    for (const r of reports) {
      const expectedMissing: string[] = []
      for (const cell of ['code.lift', 'blocks.render', 'blocks.lift', 'code.render'] as const) if (!r.paths[cell]) expectedMissing.push(cell)
      expect(r.missing).toEqual(expectedMissing)
    }
  })

  it('should return exit code 0 when all components are fully covered', () => {
    const { reports, exitCode } = verify(ROOT_DIR)
    const missing = reports.filter(r => r.missing.length > 0)
    if (missing.length === 0) {
      expect(exitCode).toBe(0)
    } else {
      expect(exitCode).toBe(1)
    }
  })

  it('should exclude internal components (_compound, raw_code, unresolved, program)', () => {
    const { reports } = verify(ROOT_DIR)
    const ids = reports.map(r => r.componentId)
    expect(ids).not.toContain('_compound')
    expect(ids).not.toContain('raw_code')
    expect(ids).not.toContain('unresolved')
    expect(ids).not.toContain('cpp:program')
  })

  it('should include core universal components', () => {
    const { reports } = verify(ROOT_DIR)
    const ids = new Set(reports.map(r => r.componentId))
    expect(ids.has('cpp:var_declare')).toBe(true)
    expect(ids.has('cpp:arithmetic')).toBe(true)
    expect(ids.has('cpp:if')).toBe(true)
    expect(ids.has('cpp:print')).toBe(true)
  })
})
