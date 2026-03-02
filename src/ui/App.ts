import { BlocklyEditor } from './blockly-editor'
import { CodeEditor } from './code-editor'
import { SyncController } from './sync-controller'
import { Storage } from './storage'
import { BlockRegistry } from '../core/block-registry'
import { CppGenerator } from '../languages/cpp/generator'
import { CppParser } from '../languages/cpp/parser'
import { CodeToBlocksConverter } from '../core/code-to-blocks'
import type { BlockSpec, WorkspaceState } from '../core/types'
import basicBlocks from '../languages/cpp/blocks/basic.json'
import advancedBlocks from '../languages/cpp/blocks/advanced.json'
import specialBlocks from '../languages/cpp/blocks/special.json'

export class App {
  private blocklyEditor: BlocklyEditor | null = null
  private codeEditor: CodeEditor | null = null
  private syncController: SyncController | null = null
  private storage: Storage
  private registry: BlockRegistry
  private generator: CppGenerator
  private parser: CppParser
  private codeToBlocks: CodeToBlocksConverter | null = null

  constructor() {
    this.storage = new Storage()
    this.registry = new BlockRegistry()
    this.generator = new CppGenerator(this.registry)
    this.parser = new CppParser()
  }

  async init(): Promise<void> {
    // Load default block definitions
    this.loadDefaultBlocks()

    // Initialize parser
    await this.parser.init()
    this.codeToBlocks = new CodeToBlocksConverter(this.registry, this.parser)

    // Initialize editors
    const blocklyContainer = document.getElementById('blockly-editor')
    const codeContainer = document.getElementById('code-editor')

    if (!blocklyContainer || !codeContainer) {
      throw new Error('Editor containers not found')
    }

    this.blocklyEditor = new BlocklyEditor(blocklyContainer)
    this.blocklyEditor.init(this.registry)

    this.codeEditor = new CodeEditor(codeContainer)
    this.codeEditor.init()

    // Initialize sync controller
    this.syncController = new SyncController({
      blocksToCode: (workspace) => this.generator.generate(workspace as Parameters<CppGenerator['generate']>[0]),
      codeToBlocks: (code) => this.codeToBlocks!.convert(code),
      setCode: (code) => this.codeEditor!.setCode(code),
      setBlocks: (workspace) => this.blocklyEditor!.setState(workspace),
      debounceMs: 500,
    })

    // Wire up events
    this.blocklyEditor.onChange((workspace) => {
      this.syncController!.onBlocksChanged(workspace)
      this.autoSave()
    })

    this.codeEditor.onChange((code) => {
      this.syncController!.onCodeChanged(code)
      this.autoSave()
    })

    // Restore saved state
    this.restoreState()

    // Setup upload UI
    this.setupUploadUI()
    this.setupExportImportUI()
  }

  private loadDefaultBlocks(): void {
    const allBlocks = [...basicBlocks, ...advancedBlocks, ...specialBlocks] as BlockSpec[]
    allBlocks.forEach(spec => this.registry.register(spec))
  }

  private autoSave(): void {
    const state: WorkspaceState = {
      blocklyState: this.blocklyEditor?.getState() as Record<string, unknown> ?? {},
      code: this.codeEditor?.getCode() ?? '',
      languageId: 'cpp',
      customBlockSpecs: [],
      lastModified: new Date().toISOString(),
    }
    this.storage.save(state)
  }

  private restoreState(): void {
    const state = this.storage.load()
    if (state) {
      if (state.code) {
        this.codeEditor?.setCode(state.code)
      }
      if (state.blocklyState && Object.keys(state.blocklyState).length > 0) {
        this.blocklyEditor?.setState(state.blocklyState)
      }
      // Restore custom block specs
      if (state.customBlockSpecs?.length > 0) {
        for (const spec of state.customBlockSpecs) {
          try {
            this.registry.register(spec)
          } catch {
            // Skip duplicate registrations
          }
        }
        this.blocklyEditor?.updateToolbox(this.registry)
      }
    }
  }

  private setupUploadUI(): void {
    const uploadBtn = document.getElementById('upload-blocks-btn')
    const fileInput = document.getElementById('blocks-file-input') as HTMLInputElement | null

    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => fileInput.click())
      fileInput.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => {
          try {
            const specs = JSON.parse(reader.result as string) as BlockSpec[]
            const arr = Array.isArray(specs) ? specs : [specs]
            for (const spec of arr) {
              this.registry.register(spec)
            }
            this.blocklyEditor?.updateToolbox(this.registry)
          } catch (err) {
            console.error('Failed to load block definitions:', err)
          }
        }
        reader.readAsText(file)
      })
    }
  }

  private setupExportImportUI(): void {
    const exportBtn = document.getElementById('export-btn')
    const importBtn = document.getElementById('import-btn')
    const importInput = document.getElementById('import-file-input') as HTMLInputElement | null

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const state: WorkspaceState = {
          blocklyState: this.blocklyEditor?.getState() as Record<string, unknown> ?? {},
          code: this.codeEditor?.getCode() ?? '',
          languageId: 'cpp',
          customBlockSpecs: [],
          lastModified: new Date().toISOString(),
        }
        const json = this.storage.exportToJson(state)
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `code-blockly-${Date.now()}.json`
        a.click()
        URL.revokeObjectURL(url)
      })
    }

    if (importBtn && importInput) {
      importBtn.addEventListener('click', () => importInput.click())
      importInput.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => {
          const state = this.storage.importFromJson(reader.result as string)
          if (state) {
            if (state.code) this.codeEditor?.setCode(state.code)
            if (state.blocklyState) this.blocklyEditor?.setState(state.blocklyState)
            this.storage.save(state)
          }
        }
        reader.readAsText(file)
      })
    }
  }

  dispose(): void {
    this.syncController?.destroy()
    this.blocklyEditor?.dispose()
    this.codeEditor?.dispose()
  }
}
