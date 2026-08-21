/**
 * @vitest-environment happy-dom
 *
 * ⚠️ **預設環境是 `node`**（2026-08-21，見 `vitest.config.ts` 的說明）——
 * 這個檔碰得到 DOM（`document`／`localStorage`／面板），所以顯式加回來。
 */
import { CURRENT_VERSION } from '../../../src/core/storage-version'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StorageService } from '../../../src/core/storage'
import type { SavedState } from '../../../src/core/storage'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

describe('StorageService', () => {
  let storage: StorageService

  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    storage = new StorageService()
  })

  describe('save and load', () => {
    it('should save and load state', () => {
      const saved = storage.save({
        code: 'int x = 5;',
        language: 'cpp',
        styleId: 'apcs',
        level: 1,
      })
      expect(saved).toBe(true)

      const loaded = storage.load()
      expect(loaded).not.toBeNull()
      expect(loaded!.code).toBe('int x = 5;')
      expect(loaded!.language).toBe('cpp')
      expect(loaded!.version).toBe(CURRENT_VERSION)
    })

    it('should return null when no state saved', () => {
      expect(storage.load()).toBeNull()
    })

    it('should merge with existing state', () => {
      storage.save({ code: 'int x = 5;', styleId: 'apcs' })
      storage.save({ code: 'int y = 10;' })
      const loaded = storage.load()
      expect(loaded!.code).toBe('int y = 10;')
      expect(loaded!.styleId).toBe('apcs')
    })
  })

  describe('clear', () => {
    it('should clear saved state', () => {
      storage.save({ code: 'test' })
      storage.clear()
      expect(storage.load()).toBeNull()
    })
  })

  describe('export and import', () => {
    it('should export state as blob', () => {
      const state: SavedState = {
        version: CURRENT_VERSION,
        tree: null,
        blocklyState: {},
        code: 'int x = 5;',
        language: 'cpp',
        styleId: 'apcs',
        level: 1,
        lastModified: new Date().toISOString(),
      }
      const blob = storage.exportToBlob(state)
      expect(blob.type).toBe('application/json')
      expect(blob.size).toBeGreaterThan(0)
    })

    it('should import valid JSON', () => {
      const json = JSON.stringify({
        version: CURRENT_VERSION,
        tree: null,
        blocklyState: {},
        code: 'int x = 5;',
        language: 'cpp',
        styleId: 'apcs',
        level: 1,
        lastModified: '2024-01-01T00:00:00Z',
      })
      const state = storage.importFromJSON(json)
      expect(state).not.toBeNull()
      expect(state!.code).toBe('int x = 5;')
    })

    it('should reject invalid JSON', () => {
      expect(storage.importFromJSON('not json')).toBeNull()
    })

    it('should reject JSON without version', () => {
      expect(storage.importFromJSON('{"code": "test"}')).toBeNull()
    })
  })
})
