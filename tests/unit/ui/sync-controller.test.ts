import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { SyncController } from '../../../src/ui/sync-controller'
import type { CodeParser, SyncError } from '../../../src/ui/sync-controller'
import type { StylePreset } from '../../../src/core/types'
import { createNode } from '../../../src/core/semantic-tree'
import { SemanticBus } from '../../../src/core/semantic-bus'
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
  })

  describe('constructor', () => {
    it('should accept (bus, language, style) without panel references', () => {
      const b = new SemanticBus()
      const c = new SyncController(b, 'cpp', mockStyle)
      expect(c.isSyncing()).toBe(false)
      expect(c.getCurrentTree()).toBeNull()
    })
  })

  describe('edit:blocks → semantic:update (blocks→code)', () => {
    it('should emit semantic:update with code when receiving edit:blocks', () => {
      const handler = vi.fn()
      bus.on('semantic:update', handler)

      const tree = createNode('program', {}, {
        body: [createNode('var_declare', { name: 'x', type: 'int' }, { initializer: [] })],
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
      const tree = createNode('program', {}, { body: [] })
      bus.emit('edit:blocks', { blocklyState: { tree } })
      expect(controller.getCurrentTree()).not.toBeNull()
    })

    it('should include mappings in semantic:update', () => {
      const handler = vi.fn()
      bus.on('semantic:update', handler)

      const tree = createNode('program', {}, {
        body: [createNode('var_declare', { name: 'x', type: 'int' }, { initializer: [] })],
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
      lifter.register('translation_unit', () => createNode('program', {}, { body: [] }))
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
        bus.emit('edit:blocks', { blocklyState: { tree: createNode('program', {}, { body: [] }) } })
      })

      const tree = createNode('program', {}, { body: [] })
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

      const tree = createNode('program', {}, {
        body: [createNode('cpp_printf', { format: '%d\\n' })],
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

      const tree = createNode('program', {}, {
        body: [createNode('print', {}, { values: [createNode('string', { value: 'hello' })] })],
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
      lifter.register('translation_unit', () => createNode('program', {}, { body: [] }))
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
})
