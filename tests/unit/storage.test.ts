import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Storage } from '../../src/ui/storage'
import type { WorkspaceState } from '../../src/core/types'

describe('Storage', () => {
  let storage: Storage

  beforeEach(() => {
    localStorage.clear()
    storage = new Storage()
  })

  describe('localStorage 存取', () => {
    it('should save workspace state', () => {
      const state: WorkspaceState = {
        blocklyState: {},
        code: 'int x = 10;',
        languageId: 'cpp',
        customBlockSpecs: [],
        lastModified: new Date().toISOString(),
      }
      storage.save(state)
      expect(localStorage.getItem('code-blockly-state')).toBeTruthy()
    })

    it('should load saved workspace state', () => {
      const state: WorkspaceState = {
        blocklyState: { test: true },
        code: 'printf("hi");',
        languageId: 'cpp',
        customBlockSpecs: [],
        lastModified: '2026-03-02T00:00:00Z',
      }
      storage.save(state)
      const loaded = storage.load()
      expect(loaded).toBeDefined()
      expect(loaded!.code).toBe('printf("hi");')
      expect(loaded!.languageId).toBe('cpp')
    })

    it('should return null when no saved state', () => {
      const loaded = storage.load()
      expect(loaded).toBeNull()
    })

    it('should handle corrupted localStorage gracefully', () => {
      localStorage.setItem('code-blockly-state', 'invalid json')
      const loaded = storage.load()
      expect(loaded).toBeNull()
    })
  })

  describe('匯出 JSON 檔案', () => {
    it('should generate valid JSON for export', () => {
      const state: WorkspaceState = {
        blocklyState: {},
        code: 'int x;',
        languageId: 'cpp',
        customBlockSpecs: [],
        lastModified: '2026-03-02T00:00:00Z',
      }
      const json = storage.exportToJson(state)
      expect(json).toBeTruthy()
      const parsed = JSON.parse(json)
      expect(parsed.code).toBe('int x;')
    })
  })

  describe('匯入 JSON 檔案', () => {
    it('should parse valid JSON import', () => {
      const json = JSON.stringify({
        blocklyState: {},
        code: 'return 0;',
        languageId: 'cpp',
        customBlockSpecs: [],
        lastModified: '2026-03-02T00:00:00Z',
      })
      const state = storage.importFromJson(json)
      expect(state).toBeDefined()
      expect(state!.code).toBe('return 0;')
    })

    it('should return null for invalid JSON', () => {
      const state = storage.importFromJson('not json')
      expect(state).toBeNull()
    })

    it('should return null for incomplete state', () => {
      const state = storage.importFromJson('{"code": "test"}')
      expect(state).toBeNull()
    })
  })
})
