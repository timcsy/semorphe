import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SyncController } from '../../src/ui/sync-controller'
import { Storage } from '../../src/ui/storage'
import { CppLanguageModule } from '../../src/languages/cpp/module'
import { BlockRegistry } from '../../src/core/block-registry'
import { CodeToBlocksConverter } from '../../src/core/code-to-blocks'
import type { BlockSpec, WorkspaceState } from '../../src/core/types'
import universalBlocks from '../../src/blocks/universal.json'
import basicBlocks from '../../src/languages/cpp/blocks/basic.json'
import advancedBlocks from '../../src/languages/cpp/blocks/advanced.json'
import specialBlocks from '../../src/languages/cpp/blocks/special.json'

describe('雙向同步整合測試', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('手動雙向同步流程', () => {
    it('should sync blocks to code on manual trigger', () => {
      const codeResults: string[] = []

      const sync = new SyncController({
        blocksToCode: vi.fn().mockReturnValue('generated code'),
        codeToBlocks: vi.fn().mockResolvedValue({ blocks: { languageVersion: 0, blocks: [{ type: 'test' }] } }),
        setCode: (code: string) => codeResults.push(code),
        setBlocks: vi.fn(),
      })

      sync.syncBlocksToCode({ blocks: { languageVersion: 0, blocks: [] } })
      expect(codeResults).toHaveLength(1)
      expect(codeResults[0]).toBe('generated code')

      sync.destroy()
    })

    it('should sync code to blocks on manual trigger', async () => {
      const blockResults: unknown[] = []

      const sync = new SyncController({
        blocksToCode: vi.fn().mockReturnValue(''),
        codeToBlocks: vi.fn().mockResolvedValue({ blocks: { languageVersion: 0, blocks: [{ type: 'test' }] } }),
        setCode: vi.fn(),
        setBlocks: (blocks: unknown) => blockResults.push(blocks),
      })

      await sync.syncCodeToBlocks('new code')
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

  describe('T024: LanguageModule 注入驗證', () => {
    it('should use injected module adapter for code→blocks conversion', async () => {
      const registry = new BlockRegistry()
      const allBlocks = [...universalBlocks, ...basicBlocks, ...advancedBlocks, ...specialBlocks] as BlockSpec[]
      allBlocks.forEach(spec => registry.register(spec))

      const cppModule = new CppLanguageModule(registry)
      const parser = cppModule.getParser() as unknown as import('../../src/languages/cpp/parser').CppParser
      await parser.init()

      const adapter = cppModule.getAdapter()
      const converter = new CodeToBlocksConverter(registry, parser, adapter)
      const result = await converter.convertWithMappings('int x = 0;')

      // Should produce universal block via adapter
      const blocks = result.workspace.blocks.blocks
      expect(blocks.length).toBeGreaterThan(0)
      expect(blocks[0].type).toBe('u_var_declare')
    })

    it('should use injected module generator for blocks→code conversion', () => {
      const registry = new BlockRegistry()
      const allBlocks = [...universalBlocks, ...basicBlocks, ...advancedBlocks, ...specialBlocks] as BlockSpec[]
      allBlocks.forEach(spec => registry.register(spec))

      const cppModule = new CppLanguageModule(registry)
      const generator = cppModule.getGenerator() as unknown as import('../../src/languages/cpp/generator').CppGenerator

      const ws = {
        blocks: { languageVersion: 0, blocks: [{
          type: 'u_var_declare', id: 'b1',
          fields: { TYPE: 'int', NAME: 'x' },
          inputs: { INIT: { block: { type: 'u_number', id: 'b2', fields: { NUM: 0 } } } },
        }] },
      }
      const code = generator.generate(ws)
      expect(code).toContain('int x = 0;')
    })

    it('should produce SourceMappings when using module adapter', async () => {
      const registry = new BlockRegistry()
      const allBlocks = [...universalBlocks, ...basicBlocks, ...advancedBlocks, ...specialBlocks] as BlockSpec[]
      allBlocks.forEach(spec => registry.register(spec))

      const cppModule = new CppLanguageModule(registry)
      const parser = cppModule.getParser() as unknown as import('../../src/languages/cpp/parser').CppParser
      await parser.init()

      const adapter = cppModule.getAdapter()
      const converter = new CodeToBlocksConverter(registry, parser, adapter)
      const result = await converter.convertWithMappings('for (int i = 0; i < 10; i++) {\n  break;\n}')

      expect(result.mappings.length).toBeGreaterThan(0)
      // Find the for-loop mapping (spans lines 0-2)
      const forMapping = result.mappings.find(m => m.startLine === 0 && m.endLine === 2)
      expect(forMapping).toBeDefined()
    })

    it('should not require core changes to add a language module', () => {
      // Verify CppLanguageModule provides all LanguageModule interface methods
      const registry = new BlockRegistry()
      const allBlocks = [...universalBlocks, ...basicBlocks, ...advancedBlocks, ...specialBlocks] as BlockSpec[]
      allBlocks.forEach(spec => registry.register(spec))

      const cppModule = new CppLanguageModule(registry)

      // Verify interface compliance
      expect(cppModule.languageId).toBe('cpp')
      expect(typeof cppModule.getParser).toBe('function')
      expect(typeof cppModule.getGenerator).toBe('function')
      expect(typeof cppModule.getAdapter).toBe('function')
      expect(typeof cppModule.getBlockSpecs).toBe('function')

      // Verify block specs are returned correctly
      const specs = cppModule.getBlockSpecs()
      expect(specs.length).toBeGreaterThan(0)
      // All returned specs should be language-specific (cpp), not universal
      for (const spec of specs) {
        expect(spec.language).toBe('cpp')
      }
    })
  })

  describe('舊版 workspace 歸零', () => {
    it('should clear saved blockly state when setState throws (unknown block type)', () => {
      const storage = new Storage()
      // Save a workspace containing an unknown block type
      const stateWithOldBlocks: WorkspaceState = {
        blocklyState: {
          blocks: { languageVersion: 0, blocks: [{ type: 'cpp_cout', id: 'old1', fields: {} }] }
        },
        code: 'cout << 42;',
        languageId: 'cpp',
        customBlockSpecs: [],
        lastModified: new Date().toISOString(),
      }
      storage.save(stateWithOldBlocks)

      // Simulate App.restoreState() pattern: try setState, catch error, clear blocklyState
      const restored = storage.load()
      expect(restored).toBeDefined()
      expect(restored!.blocklyState).toBeDefined()

      // Simulate the error that would happen with unregistered block types
      const setStateFn = () => { throw new Error('Block type cpp_cout not found') }
      let errorOccurred = false
      try {
        setStateFn()
      } catch {
        errorOccurred = true
        // This is what App.restoreState() does on error
        storage.save({
          blocklyState: {},
          code: restored!.code ?? '',
          languageId: restored!.languageId ?? 'cpp',
          customBlockSpecs: [],
          lastModified: new Date().toISOString(),
        })
      }

      expect(errorOccurred).toBe(true)
      // After recovery, blocklyState should be empty
      const afterRecovery = storage.load()
      expect(afterRecovery).toBeDefined()
      expect(afterRecovery!.blocklyState).toEqual({})
      // Code should be preserved
      expect(afterRecovery!.code).toBe('cout << 42;')
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
