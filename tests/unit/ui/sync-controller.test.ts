import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { SyncController } from '../../../src/core/sync-controller'
import { cppStripScaffoldNodes as stripScaffoldNodes } from '../../../src/languages/cpp/cpp-scaffold-filter'
import type { CodeParser, SyncError } from '../../../src/core/sync-controller'
import type { StylePreset } from '../../../src/core/types'
import type { CodeMapping, BlockMapping } from '../../../src/core/projection/code-generator'
import { createNode } from '../../../src/core/semantic-tree'
import { SemanticBus } from '../../../src/core/semantic-bus'
// 🔴 **spec 153：風格分析改成由組裝點推進來**，所以測試也要裝
//    ——⚠️ 這三支測的是**同步控制器怎麼用分析器**（真行為），
//    不是被刪掉的功能，所以它們**留著並裝上分析器**，而不是退場。
import {
  detectStyleExceptionsForPreset, applyStyleConversions, analyzeIoConformance,
} from '../../../src/languages/cpp/style-exceptions'
import { Lifter } from '../../../src/core/lift/lifter'
import { registerCppLanguage } from '../../../src/languages/cpp/generators'
import { renderToBlocklyState } from '../../../src/core/projection/block-renderer'

beforeAll(() => {
  registerCppLanguage()
})

const mockStyle: StylePreset = {
  id: 'test',
  name: { 'zh-TW': 'Test', en: 'Test' },
  io_style: 'cout',
  naming_convention: 'camelCase',
  indent_size: 4,
  brace_style: 'K&R',
  namespace_style: 'using',
  header_style: 'individual',
}

describe('SyncController (bus-based)', () => {
  let bus: SemanticBus
  let controller: SyncController

  beforeEach(() => {
    bus = new SemanticBus()
    controller = new SyncController(bus, 'cpp', mockStyle)
    controller.setStyleAnalyzer({
      // ⚠️ **要與產品那條組裝一致**（`src/ui/app.ts`）：引擎現在講核心的
      //    `StylePreset`，收窄留在語言那側。這裡手接一份是既有的債
      //    （第三十七條護欄在數它），而**手接的那份必須跟著產品改**。
      detectStyleExceptions: detectStyleExceptionsForPreset,
      applyStyleConversions,
      analyzeIoConformance: (code, pref) =>
        analyzeIoConformance(code, (pref === 'printf' ? 'cstdio' : 'iostream') as never),
    })
  })

  describe('constructor', () => {
    it('should accept (bus, language, style) without panel references', () => {
      const b = new SemanticBus()
      const c = new SyncController(b, 'cpp', mockStyle)
      c.setStyleAnalyzer({
        detectStyleExceptions: detectStyleExceptionsForPreset,
        applyStyleConversions,
        analyzeIoConformance: (code, pref) => analyzeIoConformance(code, pref as never),
      })
      expect(c.isSyncing()).toBe(false)
      expect(c.getCurrentTree()).toBeNull()
    })
  })

  describe('edit:blocks → semantic:update (blocks→code)', () => {
    it('should emit semantic:update with code when receiving edit:blocks', () => {
      const handler = vi.fn()
      bus.on('semantic:update', handler)

      const tree = createNode('cpp:program', {}, {
        body: [createNode('cpp:var_declare', { name: 'x', type: 'int' }, { initializer: [] })],
      })
      const blockState = renderToBlocklyState(tree)

      bus.emit('edit:blocks', { blocklyState: { tree } })

      expect(handler).toHaveBeenCalled()
      const data = handler.mock.calls[0][0]
      expect(data.source).toBe('blocks')
      expect(data.tree).toBeDefined()
      expect(data.code).toBeDefined()
      expect(data.code).toContain('int x;')
    })

    it('should store current tree after blocks→code sync', () => {
      const tree = createNode('cpp:program', {}, { body: [] })
      bus.emit('edit:blocks', { blocklyState: { tree } })
      expect(controller.getCurrentTree()).not.toBeNull()
    })

    it('should include mappings in semantic:update', () => {
      const handler = vi.fn()
      bus.on('semantic:update', handler)

      const tree = createNode('cpp:program', {}, {
        body: [createNode('cpp:var_declare', { name: 'x', type: 'int' }, { initializer: [] })],
      })
      bus.emit('edit:blocks', { blocklyState: { tree } })

      const data = handler.mock.calls[0][0]
      expect(data.mappings).toBeDefined()
      expect(Array.isArray(data.mappings)).toBe(true)
    })
  })

  describe('edit:code → semantic:update (code→blocks)', () => {
    function setupPipeline() {
      const rootNode = {
        type: 'translation_unit',
        text: '',
        isNamed: true,
        children: [],
        namedChildren: [],
        childForFieldName: () => null,
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 0 },
      }
      const mockParser: CodeParser = { parse: vi.fn(() => ({ rootNode })) }
      const lifter = new Lifter()
      lifter.register('translation_unit', () => createNode('cpp:program', {}, { body: [] }))
      controller.setCodeToBlocksPipeline(lifter, mockParser)
    }

    it('should not emit if no pipeline configured', () => {
      const handler = vi.fn()
      bus.on('semantic:update', handler)

      bus.emit('edit:code', { code: 'int x;' })
      expect(handler).not.toHaveBeenCalled()
    })

    it('should emit semantic:update with blockState when receiving edit:code', () => {
      setupPipeline()
      const handler = vi.fn()
      bus.on('semantic:update', handler)

      bus.emit('edit:code', { code: '' })

      expect(handler).toHaveBeenCalled()
      const data = handler.mock.calls[0][0]
      expect(data.source).toBe('code')
      expect(data.tree).toBeDefined()
      expect(data.blockState).toBeDefined()
    })

    it('should call error callback on parse errors', () => {
      const errorNode = {
        type: 'ERROR',
        text: 'bad',
        isNamed: true,
        children: [],
        namedChildren: [],
        childForFieldName: () => null,
        startPosition: { row: 2, column: 0 },
        endPosition: { row: 2, column: 3 },
      }
      const rootNode = {
        type: 'translation_unit',
        text: 'bad',
        isNamed: true,
        children: [errorNode],
        namedChildren: [errorNode],
        childForFieldName: () => null,
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 2, column: 3 },
      }
      const mockParser: CodeParser = { parse: vi.fn(() => ({ rootNode })) }
      const lifter = new Lifter()
      lifter.register('translation_unit', (_node, ctx) => {
        return createNode('program', {}, { body: ctx.liftChildren(_node.namedChildren) })
      })

      const errorCallback = vi.fn()
      controller.setCodeToBlocksPipeline(lifter, mockParser)
      controller.onError(errorCallback)

      bus.emit('edit:code', { code: 'bad' })

      expect(errorCallback).toHaveBeenCalled()
      const errors: SyncError[] = errorCallback.mock.calls[0][0]
      expect(errors).toHaveLength(1)
      expect(errors[0].line).toBe(2)
    })
  })

  describe('syncing flag (anti-loop)', () => {
    it('should prevent re-entrant sync', () => {
      const callCount = { blocks: 0 }
      bus.on('semantic:update', () => {
        callCount.blocks++
        // Simulate a panel re-emitting (should be ignored)
        bus.emit('edit:blocks', { blocklyState: { tree: createNode('cpp:program', {}, { body: [] }) } })
      })

      const tree = createNode('cpp:program', {}, { body: [] })
      bus.emit('edit:blocks', { blocklyState: { tree } })

      // Should only be called once (re-entrant call blocked)
      expect(callCount.blocks).toBe(1)
    })
  })

  describe('state management', () => {
    it('should track syncing state', () => {
      expect(controller.isSyncing()).toBe(false)
    })

    it('should allow setting style', () => {
      controller.setStyle({ ...mockStyle, id: 'new' })
      // No error thrown
    })

    it('should allow setting language', () => {
      controller.setLanguage('python')
      // No error thrown
    })
  })

  describe('stripScaffoldNodes (unit)', () => {
    it('should strip include, using_namespace, and unwrap func_def(main)', () => {
      const fullTree = createNode('cpp:program', {}, {
        body: [
          createNode('cpp:include', { header: 'iostream' }),
          createNode('cpp:using_namespace', { ns: 'std' }),
          createNode('cpp:func_def', { name: 'main', return_type: 'int' }, {
            body: [
              createNode('cpp:print', {}, { values: [createNode('string', { value: 'hello' })] }),
              createNode('cpp:return', {}, { value: [createNode('number', { value: 0 })] }),
            ],
          }),
        ],
      })

      const stripped = stripScaffoldNodes(fullTree)
      const body = stripped.children.body ?? []

      // Only user's body (print) should remain — include, namespace, func_def wrapper, return stripped
      expect(body).toHaveLength(1)
      expect(body[0].componentId).toBe('cpp:print')
    })

    it('should keep non-scaffold nodes (user-defined functions)', () => {
      const tree = createNode('cpp:program', {}, {
        body: [
          createNode('cpp:include', { header: 'iostream' }),
          createNode('cpp:func_def', { name: 'helper', return_type: 'void' }, {
            body: [createNode('cpp:print', {}, { values: [] })],
          }),
          createNode('cpp:func_def', { name: 'main', return_type: 'int' }, {
            body: [
              createNode('cpp:var_declare', { name: 'x', type: 'int' }, { initializer: [] }),
              createNode('cpp:return', {}, { value: [createNode('number', { value: 0 })] }),
            ],
          }),
        ],
      })

      const stripped = stripScaffoldNodes(tree)
      const body = stripped.children.body ?? []

      // helper (user-defined) + var_declare (from main body) should remain
      expect(body).toHaveLength(2)
      expect(body[0].componentId).toBe('cpp:func_def')
      expect(body[0].properties.name).toBe('helper')
      expect(body[1].componentId).toBe('cpp:var_declare')
    })

    it('should handle body-only tree (already stripped)', () => {
      const tree = createNode('cpp:program', {}, {
        body: [createNode('cpp:var_declare', { name: 'x', type: 'int' }, { initializer: [] })],
      })

      const stripped = stripScaffoldNodes(tree)
      const body = stripped.children.body ?? []

      expect(body).toHaveLength(1)
      expect(body[0].componentId).toBe('cpp:var_declare')
    })

    it('should handle empty program', () => {
      const tree = createNode('cpp:program', {}, { body: [] })
      const stripped = stripScaffoldNodes(tree)
      expect(stripped.children.body ?? []).toHaveLength(0)
    })
  })

  describe('resyncForTopic (topic change)', () => {
    it('should emit resync event with both code and blockState', () => {
      controller.setTopic({ id: 'basics', language: 'cpp', name: 'Basics', description: '', levelTree: { id: 'root', level: 0, label: 'root', children: [] } }, new Set())

      const handler = vi.fn()
      bus.on('semantic:update', handler)

      const fullTree = createNode('cpp:program', {}, {
        body: [
          createNode('cpp:include', { header: 'iostream' }),
          createNode('cpp:func_def', { name: 'main', return_type: 'int' }, {
            body: [
              createNode('cpp:var_declare', { name: 'x', type: 'int' }, { initializer: [] }),
              createNode('cpp:return', {}, { value: [createNode('number', { value: 0 })] }),
            ],
          }),
        ],
      })

      controller.resyncForTopic(fullTree, '')

      expect(handler).toHaveBeenCalled()
      const data = handler.mock.calls[0][0]
      expect(data.source).toBe('resync')
      expect(data.code).toBeDefined()
      expect(data.blockState).toBeDefined()
    })

    it('should produce complete code even with body-only tree', () => {
      controller.setTopic({ id: 'basics', language: 'cpp', name: 'Basics', description: '', levelTree: { id: 'root', level: 0, label: 'root', children: [] } }, new Set())

      const handler = vi.fn()
      bus.on('semantic:update', handler)

      // Body-only tree (no scaffold nodes) — as extracted from blocks
      const bodyTree = createNode('cpp:program', {}, {
        body: [
          createNode('cpp:var_declare', { name: 'x', type: 'int' }, { initializer: [] }),
        ],
      })

      controller.resyncForTopic(bodyTree, '')

      const data = handler.mock.calls[0][0]
      // Code should be complete (scaffold wraps the body)
      expect(data.code).toContain('int x;')
    })
  })

  describe('style exception detection', () => {
    it('should call onStyleExceptions when non-conforming nodes found', () => {
      const apcsStyle: StylePreset = {
        ...mockStyle,
        id: 'apcs',
        io_style: 'cout',
        header_style: 'individual',
      }
      controller.setCodingStyle(apcsStyle)

      const exceptionsCallback = vi.fn()
      controller.onStyleExceptions(exceptionsCallback)

      const tree = createNode('cpp:program', {}, {
        body: [createNode('cpp:print_formatted', { format: '%d\\n' })],
      })

      const rootNode = {
        type: 'translation_unit',
        text: '',
        isNamed: true,
        children: [],
        namedChildren: [],
        childForFieldName: () => null,
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 0 },
      }
      const mockParser: CodeParser = { parse: vi.fn(() => ({ rootNode })) }
      const lifter = new Lifter()
      lifter.register('translation_unit', () => tree)

      controller.setCodeToBlocksPipeline(lifter, mockParser)
      bus.emit('edit:code', { code: '' })

      expect(exceptionsCallback).toHaveBeenCalled()
      const [exceptions] = exceptionsCallback.mock.calls[0]
      expect(exceptions).toHaveLength(1)
      expect(exceptions[0].label).toContain('printf')
    })

    it('should NOT call onStyleExceptions when all nodes conform', () => {
      controller.setCodingStyle(mockStyle)

      const exceptionsCallback = vi.fn()
      controller.onStyleExceptions(exceptionsCallback)

      const tree = createNode('cpp:program', {}, {
        body: [createNode('cpp:print', {}, { values: [createNode('string', { value: 'hello' })] })],
      })

      const rootNode = {
        type: 'translation_unit',
        text: '',
        isNamed: true,
        children: [],
        namedChildren: [],
        childForFieldName: () => null,
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 0 },
      }
      const mockParser: CodeParser = { parse: vi.fn(() => ({ rootNode })) }
      const lifter = new Lifter()
      lifter.register('translation_unit', () => tree)

      controller.setCodeToBlocksPipeline(lifter, mockParser)
      bus.emit('edit:code', { code: '' })

      expect(exceptionsCallback).not.toHaveBeenCalled()
    })
  })

  describe('I/O conformance analysis (借音/轉調)', () => {
    function setupWithCode(code: string) {
      const rootNode = {
        type: 'translation_unit',
        text: '',
        isNamed: true,
        children: [],
        namedChildren: [],
        childForFieldName: () => null,
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 0 },
      }
      const mockParser: CodeParser = { parse: vi.fn(() => ({ rootNode })) }
      const lifter = new Lifter()
      lifter.register('translation_unit', () => createNode('cpp:program', {}, { body: [] }))
      controller.setCodeToBlocksPipeline(lifter, mockParser)
      // We need to make the code available via the edit:code event
      return code
    }

    it('should fire bulk_deviation when code mostly uses cstdio in iostream preset', () => {
      controller.setCodingStyle(mockStyle) // io_style: 'cout' → iostream
      const ioCallback = vi.fn()
      controller.onIoConformance(ioCallback)

      const code = setupWithCode('printf("a"); scanf("%d", &x); printf("b"); cout << z;')
      bus.emit('edit:code', { code })

      expect(ioCallback).toHaveBeenCalledTimes(1)
      expect(ioCallback.mock.calls[0][0].verdict).toBe('bulk_deviation')
    })

    it('should fire minor_exception when code has one cstdio in iostream preset', () => {
      controller.setCodingStyle(mockStyle)
      const ioCallback = vi.fn()
      controller.onIoConformance(ioCallback)

      const code = setupWithCode('cout << x << endl; cin >> y; cout << z; scanf("%d", &w);')
      bus.emit('edit:code', { code })

      expect(ioCallback).toHaveBeenCalledTimes(1)
      expect(ioCallback.mock.calls[0][0].verdict).toBe('minor_exception')
    })

    it('should NOT fire when code fully conforms to preset', () => {
      controller.setCodingStyle(mockStyle)
      const ioCallback = vi.fn()
      controller.onIoConformance(ioCallback)

      const code = setupWithCode('cout << "hello" << endl; cin >> x;')
      bus.emit('edit:code', { code })

      expect(ioCallback).not.toHaveBeenCalled()
    })

    it('should NOT fire when code has no I/O at all', () => {
      controller.setCodingStyle(mockStyle)
      const ioCallback = vi.fn()
      controller.onIoConformance(ioCallback)

      const code = setupWithCode('int x = 5; return 0;')
      bus.emit('edit:code', { code })

      expect(ioCallback).not.toHaveBeenCalled()
    })
  })

  describe('nodeId-based cross-projection queries (US2)', () => {
    it('getMappingForBlock should resolve via blockId→nodeId→codeMappings join', () => {
      // Simulate a tree with externally-provided blockMappings (no metadata.blockId)
      const decl = createNode('cpp:var_declare', { name: 'x', type: 'int' }, { initializer: [] })
      const tree = createNode('cpp:program', {}, { body: [decl] })
      const blockMappings: BlockMapping[] = [{ nodeId: decl.id, blockId: 'blk_1' }]

      // Trigger blocks→code sync with blockMappings
      bus.emit('edit:blocks', { blocklyState: { tree, blockMappings } })

      // codeMappings should use nodeId
      const codeMappings = controller.getCodeMappings()
      expect(codeMappings.length).toBeGreaterThanOrEqual(1)
      const declCodeMapping = codeMappings.find(m => m.nodeId === decl.id)
      expect(declCodeMapping).toBeDefined()

      // blockMappings should have nodeId→blockId from external source
      const retrievedMappings = controller.getBlockMappings()
      expect(retrievedMappings.length).toBeGreaterThanOrEqual(1)
      expect(retrievedMappings.find(m => m.blockId === 'blk_1')).toBeDefined()

      // getMappingForBlock resolves via nodeId join
      const result = controller.getMappingForBlock('blk_1')
      expect(result).not.toBeNull()
      expect(result!.startLine).toBe(declCodeMapping!.startLine)
      expect(result!.endLine).toBe(declCodeMapping!.endLine)
    })

    it('getMappingForLine should resolve via line→codeMappings→nodeId→blockMappings join', () => {
      const decl = createNode('cpp:var_declare', { name: 'x', type: 'int' }, { initializer: [] })
      const tree = createNode('cpp:program', {}, { body: [decl] })
      const blockMappings: BlockMapping[] = [{ nodeId: decl.id, blockId: 'blk_1' }]

      bus.emit('edit:blocks', { blocklyState: { tree, blockMappings } })

      // getMappingForLine should find a mapping for line 0 via nodeId join
      const mapping = controller.getMappingForLine(0)
      expect(mapping).not.toBeNull()
      if (mapping) {
        expect(mapping.blockId).toBe('blk_1')
        expect(typeof mapping.blockId).toBe('string')
      }
    })

    it('getMappingForBlock should return null for unknown blockId', () => {
      const tree = createNode('cpp:program', {}, { body: [] })
      bus.emit('edit:blocks', { blocklyState: { tree } })

      const result = controller.getMappingForBlock('nonexistent')
      expect(result).toBeNull()
    })

    it('codeMappings should not contain blockId field (FR-001)', () => {
      const decl = createNode('cpp:var_declare', { name: 'x', type: 'int' }, { initializer: [] })
      const tree = createNode('cpp:program', {}, { body: [decl] })
      bus.emit('edit:blocks', { blocklyState: { tree } })

      const codeMappings = controller.getCodeMappings()
      for (const cm of codeMappings) {
        expect('blockId' in cm).toBe(false)
        expect(cm.nodeId).toBeDefined()
      }
    })
  })
})
