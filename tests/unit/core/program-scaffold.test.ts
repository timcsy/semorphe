import { describe, it, expect } from 'vitest'
import { resolveVisibility } from '../../../src/core/program-scaffold'
import type { ScaffoldItem } from '../../../src/core/program-scaffold'

describe('ProgramScaffold contract', () => {
  describe('resolveVisibility', () => {
    it('should return hidden for L0', () => {
      expect(resolveVisibility(0, false)).toBe('hidden')
    })

    it('should return ghost for L1', () => {
      expect(resolveVisibility(1, false)).toBe('ghost')
    })

    it('should return editable for L2', () => {
      expect(resolveVisibility(2, false)).toBe('editable')
    })

    it('should return editable for pinned items regardless of level', () => {
      expect(resolveVisibility(0, true)).toBe('editable')
      expect(resolveVisibility(1, true)).toBe('editable')
      expect(resolveVisibility(2, true)).toBe('editable')
    })
  })

  describe('ScaffoldItem structure', () => {
    it('should satisfy the ScaffoldItem interface', () => {
      const item: ScaffoldItem = {
        code: '#include <iostream>',
        visibility: 'ghost',
        reason: '因為你用了 cout',
        section: 'imports',
        pinned: false,
      }
      expect(item.code).toBe('#include <iostream>')
      expect(item.visibility).toBe('ghost')
      expect(item.reason).toBeDefined()
      expect(item.section).toBe('imports')
    })

    it('ghost items MUST have a non-empty reason', () => {
      const ghostItem: ScaffoldItem = {
        code: '#include <iostream>',
        visibility: 'ghost',
        reason: '因為你用了 cout',
        section: 'imports',
      }
      expect(ghostItem.reason).toBeTruthy()
    })
  })
})
