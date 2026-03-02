import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SyncController } from '../../src/ui/sync-controller'
import { Storage } from '../../src/ui/storage'
import type { WorkspaceState } from '../../src/core/types'

describe('雙向同步整合測試', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('雙向同步端到端流程', () => {
    it('should sync blocks to code and back', async () => {
      const codeResults: string[] = []
      const blockResults: unknown[] = []

      const sync = new SyncController({
        blocksToCode: vi.fn().mockReturnValue('generated code'),
        codeToBlocks: vi.fn().mockResolvedValue({ blocks: { languageVersion: 0, blocks: [{ type: 'test' }] } }),
        setCode: (code: string) => codeResults.push(code),
        setBlocks: (blocks: unknown) => blockResults.push(blocks),
        debounceMs: 100,
      })

      // Blocks change → code updates
      sync.onBlocksChanged({ blocks: { languageVersion: 0, blocks: [] } })
      await vi.advanceTimersByTimeAsync(100)
      expect(codeResults).toHaveLength(1)
      expect(codeResults[0]).toBe('generated code')

      // Code change → blocks update
      sync.onCodeChanged('new code')
      await vi.advanceTimersByTimeAsync(100)
      expect(blockResults).toHaveLength(1)

      sync.destroy()
    })
  })

  describe('工作內容恢復', () => {
    it('should save and restore workspace state', () => {
      const storage = new Storage()
      const state: WorkspaceState = {
        blocklyState: { blocks: { languageVersion: 0, blocks: [] } },
        code: '#include <stdio.h>\nint main() { return 0; }',
        languageId: 'cpp',
        customBlockSpecs: [],
        lastModified: new Date().toISOString(),
      }

      storage.save(state)
      const restored = storage.load()
      expect(restored).toBeDefined()
      expect(restored!.code).toBe(state.code)
      expect(restored!.languageId).toBe('cpp')
    })

    it('should export and import workspace', () => {
      const storage = new Storage()
      const state: WorkspaceState = {
        blocklyState: {},
        code: 'int x = 42;',
        languageId: 'cpp',
        customBlockSpecs: [],
        lastModified: '2026-03-02T00:00:00Z',
      }

      const json = storage.exportToJson(state)
      const imported = storage.importFromJson(json)
      expect(imported).toBeDefined()
      expect(imported!.code).toBe('int x = 42;')
    })
  })

  describe('自訂積木上傳', () => {
    it('should persist custom block specs in workspace state', () => {
      const storage = new Storage()
      const state: WorkspaceState = {
        blocklyState: {},
        code: '',
        languageId: 'cpp',
        customBlockSpecs: [
          {
            id: 'custom_block',
            category: 'custom',
            version: '1.0.0',
            blockDef: { type: 'custom_block', message0: 'custom', colour: 100 },
            codeTemplate: { pattern: '/* custom */', imports: [], order: 0 },
            astPattern: { nodeType: 'custom', constraints: [] },
          },
        ],
        lastModified: new Date().toISOString(),
      }

      storage.save(state)
      const restored = storage.load()
      expect(restored!.customBlockSpecs).toHaveLength(1)
      expect(restored!.customBlockSpecs[0].id).toBe('custom_block')
    })
  })
})
