import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { SyncController } from '../../../src/ui/sync-controller'
import type { CodeParser, SyncError } from '../../../src/ui/sync-controller'
import type { BlocklyPanel } from '../../../src/ui/panels/blockly-panel'
import type { MonacoPanel } from '../../../src/ui/panels/monaco-panel'
import type { StylePreset } from '../../../src/core/types'
import { createNode } from '../../../src/core/semantic-tree'
import { Lifter } from '../../../src/core/lift/lifter'
import { registerCppLanguage } from '../../../src/languages/cpp/generators'

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

function createMockBlocklyPanel() {
  return {
    extractSemanticTree: vi.fn(() => createNode('program', {}, { body: [] })),
    setState: vi.fn(),
    getState: vi.fn(() => ({})),
    init: vi.fn(),
    onChange: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    clear: vi.fn(),
    dispose: vi.fn(),
  } as unknown as BlocklyPanel
}

function createMockMonacoPanel() {
  return {
    getCode: vi.fn(() => ''),
    setCode: vi.fn(),
    init: vi.fn(),
    dispose: vi.fn(),
  } as unknown as MonacoPanel
}

describe('SyncController', () => {
  let blocklyPanel: BlocklyPanel
  let monacoPanel: MonacoPanel
  let controller: SyncController

  beforeEach(() => {
    blocklyPanel = createMockBlocklyPanel()
    monacoPanel = createMockMonacoPanel()
    controller = new SyncController(blocklyPanel, monacoPanel, 'cpp', mockStyle)
  })

  describe('syncBlocksToCode', () => {
    it('should extract tree from blockly and set code in monaco', () => {
      const tree = createNode('program', {}, {
        body: [createNode('var_declare', { name: 'x', type: 'int' }, { initializer: [] })],
      })
      ;(blocklyPanel.extractSemanticTree as ReturnType<typeof vi.fn>).mockReturnValue(tree)

      controller.syncBlocksToCode()

      expect(blocklyPanel.extractSemanticTree).toHaveBeenCalled()
      expect(monacoPanel.setCode).toHaveBeenCalled()
      const code = (monacoPanel.setCode as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(code).toContain('int x;')
    })

    it('should prevent re-entrant sync', () => {
      // First call sets syncing = true
      controller.syncBlocksToCode()
      expect(blocklyPanel.extractSemanticTree).toHaveBeenCalledTimes(1)
    })

    it('should store current tree', () => {
      const tree = createNode('program', {}, { body: [] })
      ;(blocklyPanel.extractSemanticTree as ReturnType<typeof vi.fn>).mockReturnValue(tree)

      controller.syncBlocksToCode()
      expect(controller.getCurrentTree()).not.toBeNull()
      expect(controller.getCurrentTree()!.concept).toBe('program')
    })
  })

  describe('syncCodeToBlocks', () => {
    it('should return false if no pipeline configured', () => {
      const result = controller.syncCodeToBlocks()
      expect(result).toBe(false)
    })

    it('should parse code and update blockly when pipeline configured', () => {
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
      const mockParser: CodeParser = {
        parse: vi.fn(() => ({ rootNode })),
      }

      const lifter = new Lifter()
      lifter.register('translation_unit', () => createNode('program', {}, { body: [] }))

      controller.setCodeToBlocksPipeline(lifter, mockParser)
      ;(monacoPanel.getCode as ReturnType<typeof vi.fn>).mockReturnValue('')

      const result = controller.syncCodeToBlocks()
      expect(result).toBe(true)
      expect(blocklyPanel.setState).toHaveBeenCalled()
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
      const mockParser: CodeParser = {
        parse: vi.fn(() => ({ rootNode })),
      }

      const lifter = new Lifter()
      lifter.register('translation_unit', (_node, ctx) => {
        return createNode('program', {}, { body: ctx.liftChildren(_node.namedChildren) })
      })

      const errorCallback = vi.fn()
      controller.setCodeToBlocksPipeline(lifter, mockParser)
      controller.onError(errorCallback)
      ;(monacoPanel.getCode as ReturnType<typeof vi.fn>).mockReturnValue('bad')

      controller.syncCodeToBlocks()

      expect(errorCallback).toHaveBeenCalled()
      const errors: SyncError[] = errorCallback.mock.calls[0][0]
      expect(errors).toHaveLength(1)
      expect(errors[0].line).toBe(2)
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
      // Set APCS style (io_style: cout → ioPreference: iostream)
      const apcsStyle: StylePreset = {
        ...mockStyle,
        id: 'apcs',
        io_style: 'cout',
        header_style: 'individual',
      }
      controller.setCodingStyle(apcsStyle)

      const exceptionsCallback = vi.fn()
      controller.onStyleExceptions(exceptionsCallback)

      // Create a tree with cpp_printf (non-conforming in APCS/iostream mode)
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
      const mockParser: CodeParser = {
        parse: vi.fn(() => ({ rootNode })),
      }

      const lifter = new Lifter()
      lifter.register('translation_unit', () => tree)

      controller.setCodeToBlocksPipeline(lifter, mockParser)
      ;(monacoPanel.getCode as ReturnType<typeof vi.fn>).mockReturnValue('')

      controller.syncCodeToBlocks()

      expect(exceptionsCallback).toHaveBeenCalled()
      const [exceptions] = exceptionsCallback.mock.calls[0]
      expect(exceptions).toHaveLength(1)
      expect(exceptions[0].label).toContain('printf')
    })

    it('should NOT call onStyleExceptions when all nodes conform', () => {
      controller.setCodingStyle(mockStyle)

      const exceptionsCallback = vi.fn()
      controller.onStyleExceptions(exceptionsCallback)

      // Create a conforming tree (print is fine in iostream mode)
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
      const mockParser: CodeParser = {
        parse: vi.fn(() => ({ rootNode })),
      }

      const lifter = new Lifter()
      lifter.register('translation_unit', () => tree)

      controller.setCodeToBlocksPipeline(lifter, mockParser)
      ;(monacoPanel.getCode as ReturnType<typeof vi.fn>).mockReturnValue('')

      controller.syncCodeToBlocks()

      expect(exceptionsCallback).not.toHaveBeenCalled()
    })

    it('should convert StylePreset io_style=printf to CodingStyle ioPreference=cstdio', () => {
      const compStyle: StylePreset = {
        ...mockStyle,
        id: 'competitive',
        io_style: 'printf',
        header_style: 'bits',
      }
      controller.setCodingStyle(compStyle)

      const exceptionsCallback = vi.fn()
      controller.onStyleExceptions(exceptionsCallback)

      // iostream is non-conforming in competitive/cstdio mode
      const tree = createNode('program', {}, {
        body: [createNode('cpp_include', { header: 'iostream', local: false })],
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
      const mockParser: CodeParser = {
        parse: vi.fn(() => ({ rootNode })),
      }

      const lifter = new Lifter()
      lifter.register('translation_unit', () => tree)

      controller.setCodeToBlocksPipeline(lifter, mockParser)
      ;(monacoPanel.getCode as ReturnType<typeof vi.fn>).mockReturnValue('')

      controller.syncCodeToBlocks()

      expect(exceptionsCallback).toHaveBeenCalled()
      const [exceptions] = exceptionsCallback.mock.calls[0]
      expect(exceptions).toHaveLength(1)
      expect(exceptions[0].label).toContain('iostream')
      expect(exceptions[0].suggestion).toContain('cstdio')
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
      ;(monacoPanel.getCode as ReturnType<typeof vi.fn>).mockReturnValue(code)
    }

    it('should fire bulk_deviation when code mostly uses cstdio in iostream preset', () => {
      controller.setCodingStyle(mockStyle) // io_style: 'cout' → iostream
      const ioCallback = vi.fn()
      controller.onIoConformance(ioCallback)

      setupWithCode('printf("a"); scanf("%d", &x); printf("b"); cout << z;')
      // cstdio=3 (printf, scanf, printf), iostream=1 (cout) → bulk deviation
      controller.syncCodeToBlocks()

      expect(ioCallback).toHaveBeenCalledTimes(1)
      expect(ioCallback.mock.calls[0][0].verdict).toBe('bulk_deviation')
    })

    it('should fire minor_exception when code has one cstdio in iostream preset', () => {
      controller.setCodingStyle(mockStyle)
      const ioCallback = vi.fn()
      controller.onIoConformance(ioCallback)

      setupWithCode('cout << x << endl; cin >> y; cout << z; scanf("%d", &w);')
      // iostream=4 (cout, endl, cin, cout), cstdio=1 (scanf) → minor exception
      controller.syncCodeToBlocks()

      expect(ioCallback).toHaveBeenCalledTimes(1)
      expect(ioCallback.mock.calls[0][0].verdict).toBe('minor_exception')
    })

    it('should NOT fire when code fully conforms to preset', () => {
      controller.setCodingStyle(mockStyle)
      const ioCallback = vi.fn()
      controller.onIoConformance(ioCallback)

      setupWithCode('cout << "hello" << endl; cin >> x;')
      controller.syncCodeToBlocks()

      expect(ioCallback).not.toHaveBeenCalled()
    })

    it('should NOT fire when code has no I/O at all', () => {
      controller.setCodingStyle(mockStyle)
      const ioCallback = vi.fn()
      controller.onIoConformance(ioCallback)

      setupWithCode('int x = 5; return 0;')
      controller.syncCodeToBlocks()

      expect(ioCallback).not.toHaveBeenCalled()
    })
  })
})
