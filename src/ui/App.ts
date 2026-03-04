import { BlocklyEditor } from './blockly-editor'
import { CodeEditor } from './code-editor'
import { SyncController } from './sync-controller'
import { Storage } from './storage'
import { BlockRegistry } from '../core/block-registry'
import { CppGenerator } from '../languages/cpp/generator'
import { CppParser } from '../languages/cpp/parser'
import { CppLanguageAdapter } from '../languages/cpp/adapter'
import { CodeToBlocksConverter } from '../core/code-to-blocks'
import { DEFAULT_TEMPLATE_STATE, QUICK_ACCESS_ITEMS } from '../core/types'
import type { BlockSpec, WorkspaceState, ToolboxLevel } from '../core/types'
import universalBlocks from '../blocks/universal.json'
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
  private adapter: CppLanguageAdapter
  private codeToBlocks: CodeToBlocksConverter | null = null
  private languageId = 'cpp'
  private toolboxLevel: ToolboxLevel = 'beginner'
  private diagnosticsTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    this.storage = new Storage()
    this.registry = new BlockRegistry()
    this.adapter = new CppLanguageAdapter()
    this.generator = new CppGenerator(this.registry, this.adapter)
    this.parser = new CppParser()
  }

  async init(): Promise<void> {
    // Load universal + language-specific block definitions
    this.loadDefaultBlocks()

    // Initialize parser
    await this.parser.init()
    this.codeToBlocks = new CodeToBlocksConverter(this.registry, this.parser, this.adapter)

    // Initialize editors
    const blocklyContainer = document.getElementById('blockly-editor')
    const codeContainer = document.getElementById('code-editor')

    if (!blocklyContainer || !codeContainer) {
      throw new Error('Editor containers not found')
    }

    this.blocklyEditor = new BlocklyEditor(blocklyContainer)
    this.blocklyEditor.init(this.registry, this.languageId)

    this.codeEditor = new CodeEditor(codeContainer)
    this.codeEditor.init()

    // Initialize sync controller with SourceMapping support
    this.syncController = new SyncController({
      blocksToCode: (workspace) => this.generator.generate(workspace as Parameters<CppGenerator['generate']>[0]),
      codeToBlocks: (code) => this.codeToBlocks!.convert(code),
      codeToBlocksWithMappings: async (code) => {
        const result = await this.codeToBlocks!.convertWithMappings(code)
        return { workspace: result.workspace, mappings: result.mappings }
      },
      setCode: (code) => this.codeEditor!.setCode(code),
      setBlocks: (workspace) => this.blocklyEditor!.setState(workspace),
      highlightCodeLines: (startLine, endLine) => this.codeEditor!.addHighlight(startLine, endLine),
      clearCodeHighlight: () => this.codeEditor!.clearHighlight(),
      highlightBlock: (blockId) => this.blocklyEditor!.highlightBlock(blockId),
      clearBlockHighlight: () => this.blocklyEditor!.highlightBlock(null),
    })

    // Wire up auto-save (no auto-sync) and diagnostics
    this.blocklyEditor.onChange(() => {
      this.autoSave()
      this.scheduleDiagnostics()
    })

    // Wire up bidirectional highlight
    this.blocklyEditor.onBlockSelect((blockId) => {
      if (blockId) {
        this.syncController!.onBlockSelected(blockId)
      } else {
        this.syncController!.onBlockDeselected()
      }
    })

    this.codeEditor.onChange(() => {
      this.autoSave()
    })

    this.codeEditor.onCursorChange((line) => {
      this.syncController!.onCodeCursorChange(line)
    })

    // Setup manual sync buttons
    this.setupSyncUI()

    // Restore saved state (or load default template)
    this.restoreState()

    // Setup UI controls
    this.setupClearButton()
    this.setupToolboxToggle()
    this.setupQuickAccess()
    this.setupUploadUI()
    this.setupExportImportUI()
  }

  private loadDefaultBlocks(): void {
    const allBlocks = [...universalBlocks, ...basicBlocks, ...advancedBlocks, ...specialBlocks] as BlockSpec[]
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
        this.migrateWorkspaceState(state.blocklyState)
        try {
          this.blocklyEditor?.setState(state.blocklyState)
        } catch (err) {
          console.warn('Failed to restore blockly state, clearing saved state:', err)
          this.storage.save({
            blocklyState: {},
            code: state.code ?? '',
            languageId: state.languageId ?? 'cpp',
            customBlockSpecs: [],
            lastModified: new Date().toISOString(),
          })
        }
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
        this.blocklyEditor?.updateToolbox(this.registry, this.languageId)
      }
    } else {
      // No saved state: load default template
      this.blocklyEditor?.setState(DEFAULT_TEMPLATE_STATE)
    }
  }

  private setupClearButton(): void {
    const clearBtn = document.getElementById('clear-workspace-btn')
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.blocklyEditor?.clear()
      })
    }
  }

  private setupToolboxToggle(): void {
    // Restore saved level
    this.toolboxLevel = this.storage.loadToolboxLevel() ?? 'beginner'

    // Apply initial toolbox level
    this.blocklyEditor?.updateToolbox(this.registry, this.languageId, this.toolboxLevel)

    const toggleBtn = document.getElementById('toolbox-toggle-btn')
    if (toggleBtn) {
      this.updateToggleButton(toggleBtn)
      toggleBtn.addEventListener('click', () => {
        this.toolboxLevel = this.toolboxLevel === 'beginner' ? 'advanced' : 'beginner'
        this.storage.saveToolboxLevel(this.toolboxLevel)
        this.blocklyEditor?.updateToolbox(this.registry, this.languageId, this.toolboxLevel)
        this.updateToggleButton(toggleBtn)
      })
    }
  }

  private updateToggleButton(btn: HTMLElement): void {
    if (this.toolboxLevel === 'beginner') {
      btn.textContent = '初級模式'
      btn.dataset.level = 'beginner'
    } else {
      btn.textContent = '進階模式'
      btn.dataset.level = 'advanced'
    }
  }

  /** Migrate old workspace format to current format */
  private migrateWorkspaceState(ws: Record<string, unknown>): void {
    const blocks = ws.blocks as { blocks?: Record<string, unknown>[] } | undefined
    if (!blocks?.blocks) return
    for (const block of blocks.blocks) {
      this.migrateBlock(block)
    }
  }

  private migrateBlock(block: Record<string, unknown>): void {
    if (!block) return
    // Migrate u_print: EXPR → EXPR0 + extraState, remove old ENDL field
    if (block.type === 'u_print') {
      const inputs = block.inputs as Record<string, unknown> | undefined
      if (inputs && 'EXPR' in inputs && !('EXPR0' in inputs)) {
        inputs['EXPR0'] = inputs['EXPR']
        delete inputs['EXPR']
      }
      // Remove old ENDL dropdown field (now uses u_endl block instead)
      const fields = block.fields as Record<string, unknown> | undefined
      if (fields) {
        delete fields['ENDL']
      }
      // Recalculate extraState itemCount
      if (inputs) {
        const exprCount = Object.keys(inputs).filter(k => /^EXPR\d+$/.test(k)).length
        if (exprCount > 0) {
          block.extraState = { itemCount: exprCount }
        }
      }
    }
    // Recurse into inputs
    const inputs = block.inputs as Record<string, { block?: Record<string, unknown> }> | undefined
    if (inputs) {
      for (const inp of Object.values(inputs)) {
        if (inp?.block) this.migrateBlock(inp.block)
      }
    }
    // Recurse into next
    const next = block.next as { block?: Record<string, unknown> } | undefined
    if (next?.block) this.migrateBlock(next.block)
  }

  private setupSyncUI(): void {
    const blocksToCodeBtn = document.getElementById('blocks-to-code-btn')
    const codeToBlocksBtn = document.getElementById('code-to-blocks-btn')

    if (blocksToCodeBtn) {
      blocksToCodeBtn.addEventListener('click', () => {
        const workspace = this.blocklyEditor?.getState()
        if (workspace) {
          this.syncController!.syncBlocksToCode(workspace)
        }
      })
    }

    if (codeToBlocksBtn) {
      codeToBlocksBtn.addEventListener('click', async () => {
        const code = this.codeEditor?.getCode()
        if (code !== undefined) {
          await this.syncController!.syncCodeToBlocks(code)
        }
      })
    }
  }

  private setupQuickAccess(): void {
    const bar = document.getElementById('quick-access-bar')
    if (!bar || !this.blocklyEditor) return
    for (const item of QUICK_ACCESS_ITEMS) {
      const btn = document.createElement('button')
      btn.className = 'quick-access-btn'
      btn.title = item.label
      btn.textContent = `${item.icon} ${item.label}`
      btn.addEventListener('click', () => {
        this.blocklyEditor!.createBlockAtCenter(item.blockType)
      })
      bar.appendChild(btn)
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
            this.blocklyEditor?.updateToolbox(this.registry, this.languageId)
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

  private scheduleDiagnostics(): void {
    if (this.diagnosticsTimer) clearTimeout(this.diagnosticsTimer)
    this.diagnosticsTimer = setTimeout(() => {
      if (!this.blocklyEditor) return
      const diagnostics = this.blocklyEditor.runDiagnostics()
      this.blocklyEditor.applyDiagnostics(diagnostics)
    }, 300)
  }

  dispose(): void {
    this.syncController?.destroy()
    this.blocklyEditor?.dispose()
    this.codeEditor?.dispose()
  }
}
