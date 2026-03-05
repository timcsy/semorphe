import * as Blockly from 'blockly'
import { BlocklyEditor } from './blockly-editor'
import { CodeEditor } from './code-editor'
import { SyncController } from './sync-controller'
import { Storage } from './storage'
import { BlockRegistry } from '../core/block-registry'
import { CppGenerator } from '../languages/cpp/generator'
import { CppParser } from '../languages/cpp/parser'
import { CppLanguageAdapter } from '../languages/cpp/adapter'
import { CppLanguageModule } from '../languages/cpp/module'
import { LanguageRegistryImpl } from '../core/converter'
import { CodeToBlocksConverter } from '../core/code-to-blocks'
import { serializeModel } from '../core/semantic-model'
import { SemanticInterpreter } from '../interpreter/interpreter'
import { RuntimeError } from '../interpreter/errors'
import { ConsolePanel } from './console-panel'
import { StepController } from './step-controller'
import { VariablePanel } from './variable-panel'
import type { StepInfo } from '../interpreter/types'
import { StyleManagerImpl } from '../languages/style'
import type { StylePresetId } from '../languages/style'
import { LocaleLoader } from '../i18n/loader'
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
  private localeLoader: LocaleLoader
  private languageRegistry: LanguageRegistryImpl
  private styleManager: StyleManagerImpl
  private languageId = 'cpp'
  private toolboxLevel: ToolboxLevel = 'beginner'
  private diagnosticsTimer: ReturnType<typeof setTimeout> | null = null
  private lastChangedSide: 'blocks' | 'code' | null = null
  private interpreter: SemanticInterpreter
  private consolePanel: ConsolePanel | null = null
  private stepController: StepController
  private variablePanel: VariablePanel | null = null
  private stepRecords: StepInfo[] = []
  private currentStepIndex = 0
  private fullOutput: string[] = []

  constructor() {
    this.storage = new Storage()
    this.registry = new BlockRegistry()
    this.adapter = new CppLanguageAdapter()
    this.generator = new CppGenerator(this.registry, this.adapter)
    this.parser = new CppParser()
    this.localeLoader = new LocaleLoader()
    this.languageRegistry = new LanguageRegistryImpl()
    this.styleManager = new StyleManagerImpl()
    this.interpreter = new SemanticInterpreter()
    this.stepController = new StepController()
  }

  async init(): Promise<void> {
    // 1. Load locale before block registration so Blockly.Msg is populated
    await this.loadLocale('zh-TW')

    // 2. Register language module and inject types
    const cppModule = new CppLanguageModule(this.registry)
    this.languageRegistry.register(cppModule)
    this.languageRegistry.setActive('cpp')

    // 3. Apply language module tooltip overrides
    const activeModule = this.languageRegistry.getActive()
    this.localeLoader.applyTooltipOverrides(activeModule.getTooltipOverrides())

    // 4. Load universal + language-specific block definitions
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
    this.blocklyEditor.setLanguageTypes(activeModule.getTypes())
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
      // Semantic model hooks (T016)
      codeToSemanticModel: async (code) => {
        return this.parser.parseToModel(code, this.adapter)
      },
      semanticModelToCode: (model) => {
        return this.generator.generateFromModel(model, this.styleManager.getActive())
      },
      onSemanticModelUpdated: (model) => {
        try { localStorage.setItem('code-blockly-semantic', serializeModel(model)) } catch { /* ignore */ }
      },
    })

    // Wire up auto-save (no auto-sync), diagnostics, and sync hints
    this.blocklyEditor.onChange(() => {
      this.autoSave()
      this.scheduleDiagnostics()
      this.lastChangedSide = 'blocks'
      this.updateSyncHints()
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
      this.lastChangedSide = 'code'
      this.updateSyncHints()
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
    this.setupStyleSelector()
    this.setupUndoRedo()
    this.setupInterpreter()
  }

  private loadDefaultBlocks(): void {
    const allBlocks = [...universalBlocks, ...basicBlocks, ...advancedBlocks, ...specialBlocks] as BlockSpec[]
    allBlocks.forEach(spec => this.registry.register(spec))
  }

  private autoSave(): void {
    const state: WorkspaceState = {
      blocklyState: this.blocklyEditor?.getState() as Record<string, unknown> ?? {},
      code: this.codeEditor?.getCode() ?? '',
      languageId: this.languageId,
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
      // No saved state: load default template and generate code
      this.blocklyEditor?.setState(DEFAULT_TEMPLATE_STATE)
      setTimeout(() => {
        const workspace = this.blocklyEditor?.getState()
        if (workspace) this.syncController!.syncBlocksToCode(workspace)
      }, 0)
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
    const msg = Blockly.Msg as Record<string, string>
    if (this.toolboxLevel === 'beginner') {
      btn.textContent = msg['MODE_BEGINNER'] || '初級模式'
      btn.title = msg['MODE_BEGINNER_DESC'] || '顯示常用積木，適合入門學習'
      btn.dataset.level = 'beginner'
    } else {
      btn.textContent = msg['MODE_ADVANCED'] || '進階模式'
      btn.title = msg['MODE_ADVANCED_DESC'] || '顯示全部積木，包含指標、結構等進階功能'
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
      blocksToCodeBtn.addEventListener('click', async () => {
        const workspace = this.blocklyEditor?.getState()
        if (workspace) {
          this.syncController!.syncBlocksToCode(workspace)
          // Build semantic model cache from generated code for style switching
          const code = this.codeEditor?.getCode()
          if (code) {
            try {
              const model = await this.parser.parseToModel(code, this.adapter)
              this.syncController!.setCurrentModel(model)
            } catch { /* ignore - model cache is optional */ }
          }
          this.lastChangedSide = null
          this.updateSyncHints()
          this.showToast('TOAST_SYNC_SUCCESS', '同步完成')
        }
      })
    }

    if (codeToBlocksBtn) {
      codeToBlocksBtn.addEventListener('click', async () => {
        const code = this.codeEditor?.getCode()
        if (code !== undefined) {
          try {
            await this.syncController!.syncCodeToBlocks(code)
            this.lastChangedSide = null
            this.updateSyncHints()
            this.showToast('TOAST_SYNC_SUCCESS', '同步完成')
          } catch {
            this.showToast('ERROR_SYNC_FAILED', '轉換失敗，程式碼可能有語法錯誤', 'error')
          }
        }
      })
    }
  }

  private setupQuickAccess(): void {
    const bar = document.getElementById('quick-access-bar')
    if (!bar || !this.blocklyEditor) return
    const msg = Blockly.Msg as Record<string, string>
    for (const item of QUICK_ACCESS_ITEMS) {
      const label = msg[item.labelKey] || item.fallbackLabel
      const tooltip = item.tooltipKey ? (msg[item.tooltipKey] || label) : label
      const btn = document.createElement('button')
      btn.className = 'quick-access-btn'
      btn.title = tooltip
      btn.textContent = `${item.icon} ${label}`
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
          languageId: this.languageId,
          customBlockSpecs: [],
          lastModified: new Date().toISOString(),
        }
        const json = this.storage.exportToJson(state)
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `code-blockly-${new Date().toISOString().slice(0, 10)}.json`
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

  private setupStyleSelector(): void {
    const selector = document.getElementById('style-selector') as HTMLSelectElement | null
    if (!selector) return

    // Populate options with i18n names and description tooltips
    const msg = Blockly.Msg as Record<string, string>
    for (const preset of this.styleManager.getPresets()) {
      const opt = document.createElement('option')
      opt.value = preset.id
      opt.textContent = msg[preset.nameKey] || preset.id
      const descKey = `${preset.nameKey}.desc`
      if (msg[descKey]) opt.title = msg[descKey]
      selector.appendChild(opt)
    }
    selector.value = this.styleManager.getActive().id
    // Set selector tooltip to active style description
    const activeDescKey = `${this.styleManager.getActive().nameKey}.desc`
    selector.title = msg[activeDescKey] || '編碼風格'

    selector.addEventListener('change', async () => {
      this.styleManager.setActiveById(selector.value as StylePresetId)
      const newDescKey = `${this.styleManager.getActive().nameKey}.desc`
      selector.title = msg[newDescKey] || '編碼風格'
      // Re-generate code using cached semantic model (avoids lossy re-parse)
      if (this.syncController && this.codeEditor) {
        const cachedModel = this.syncController.getCurrentModel()
        if (cachedModel) {
          const newCode = this.generator.generateFromModel(cachedModel, this.styleManager.getActive())
          this.codeEditor.setCode(newCode)
        } else {
          // No cached model: parse current code to build one
          const code = this.codeEditor.getCode()
          if (code) {
            try {
              const model = await this.parser.parseToModel(code, this.adapter)
              const newCode = this.generator.generateFromModel(model, this.styleManager.getActive())
              this.codeEditor.setCode(newCode)
            } catch {
              // Fallback: re-generate from blocks
              if (this.blocklyEditor) {
                const workspace = this.blocklyEditor.getState()
                if (workspace) {
                  this.syncController.syncBlocksToCode(workspace)
                }
              }
            }
          }
        }
      }
    })
  }

  private setupUndoRedo(): void {
    const undoBtn = document.getElementById('undo-btn')
    const redoBtn = document.getElementById('redo-btn')
    if (undoBtn) {
      undoBtn.addEventListener('click', () => this.blocklyEditor?.undo())
    }
    if (redoBtn) {
      redoBtn.addEventListener('click', () => this.blocklyEditor?.redo())
    }
  }

  private setupInterpreter(): void {
    // Initialize console panel
    const consoleContainer = document.getElementById('console-panel')
    if (consoleContainer) {
      this.consolePanel = new ConsolePanel(consoleContainer)
    }

    const variableContainer = document.getElementById('variable-panel')
    if (variableContainer) {
      this.variablePanel = new VariablePanel(variableContainer)
    }

    const runBtn = document.getElementById('run-btn')
    const stopBtn = document.getElementById('stop-btn')
    const stepBtn = document.getElementById('step-btn')
    const pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement | null
    const runModeSelector = document.getElementById('run-mode-selector') as HTMLSelectElement | null

    if (runBtn) runBtn.addEventListener('click', () => this.runProgram())
    if (stopBtn) stopBtn.addEventListener('click', () => this.stopProgram())
    if (stepBtn) stepBtn.addEventListener('click', () => this.stepProgram())
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        if (this.stepController.getStatus() === 'running') {
          this.stepController.pause()
          pauseBtn.textContent = '▶ 繼續'
          this.consolePanel?.setStatus('paused')
        } else if (this.stepController.getStatus() === 'paused') {
          this.stepController.resume()
          pauseBtn.textContent = '⏸ 暫停'
          this.consolePanel?.setStatus('running')
        }
      })
    }
    if (runModeSelector) {
      runModeSelector.addEventListener('change', () => {
        const mode = runModeSelector.value
        if (mode !== 'immediate') {
          this.stepController.setSpeed(mode as 'slow' | 'medium' | 'fast')
        }
      })
    }

    // Configure step controller callbacks
    this.stepController.onStep(() => this.onStepExecuted())
    this.stepController.onStop(() => this.onStepStopped())
  }

  private getRunMode(): string {
    const selector = document.getElementById('run-mode-selector') as HTMLSelectElement | null
    return selector?.value ?? 'immediate'
  }

  private async runProgram(): Promise<void> {
    if (!this.consolePanel || !this.syncController) return

    // Reset previous state
    this.stepController.stop()
    this.interpreter.reset()

    // Get semantic model
    let model = this.syncController.getCurrentModel()
    if (!model) {
      const code = this.codeEditor?.getCode()
      if (code) {
        try {
          model = await this.parser.parseToModel(code, this.adapter)
          this.syncController.setCurrentModel(model)
        } catch {
          this.consolePanel.clear()
          this.consolePanel.setStatus('error', '程式碼解析失敗')
          return
        }
      }
    }

    if (!model) {
      this.consolePanel.clear()
      this.consolePanel.setStatus('error', '無程式可執行')
      return
    }

    this.consolePanel.clear()

    // Immediate mode: execute directly, show final output
    if (this.getRunMode() === 'immediate') {
      this.consolePanel.setStatus('running')
      try {
        this.interpreter.execute(model.program)
        const output = this.interpreter.getOutput()
        if (output.length > 0) this.consolePanel.appendOutput(output.join(''))
        this.consolePanel.setStatus('completed')
      } catch (e) {
        const output = this.interpreter.getOutput()
        if (output.length > 0) this.consolePanel.appendOutput(output.join(''))
        if (e instanceof RuntimeError) {
          this.consolePanel.appendOutput('\n' + e.message)
          this.consolePanel.setStatus('error', e.message)
        } else {
          this.consolePanel.setStatus('error', '未預期的錯誤')
        }
      }
      return
    }

    // Animated mode: step-based execution with highlighting
    await this.ensureSourceMappings()
    this.stepController.setSpeed(this.getRunMode() as 'slow' | 'medium' | 'fast')
    this.consolePanel.setStatus('running')

    try {
      this.stepRecords = this.interpreter.executeWithSteps(model.program)
      this.currentStepIndex = -1
      this.fullOutput = this.interpreter.getOutput()
    } catch (e) {
      if (e instanceof RuntimeError) {
        const output = this.interpreter.getOutput()
        if (output.length > 0) this.consolePanel.appendOutput(output.join(''))
        this.consolePanel.appendOutput('\n' + e.message)
        this.consolePanel.setStatus('error', e.message)
      } else {
        this.consolePanel.setStatus('error', '未預期的錯誤')
      }
      return
    }

    if (this.stepRecords.length === 0) {
      this.consolePanel.appendOutput(this.fullOutput.join(''))
      this.consolePanel.setStatus('completed')
      return
    }

    // Auto-run through steps with highlighting
    this.stepController.setStepFn(() => {
      this.currentStepIndex++
      return this.currentStepIndex < this.stepRecords.length - 1
    })
    this.updateExecButtons(true)
    this.stepController.run()
  }

  private async stepProgram(): Promise<void> {
    if (!this.consolePanel || !this.syncController) return

    // Re-initialize if no records or execution finished
    const needsInit = this.stepRecords.length === 0 ||
      this.stepController.getStatus() === 'idle' ||
      this.stepController.getStatus() === 'completed'

    if (needsInit) {
      this.stepController.stop()
      this.interpreter.reset()

      // Ensure sourceMappings exist for block highlighting
      await this.ensureSourceMappings()

      let model = this.syncController.getCurrentModel()
      if (!model) {
        const code = this.codeEditor?.getCode()
        if (code) {
          try {
            model = await this.parser.parseToModel(code, this.adapter)
            this.syncController.setCurrentModel(model)
          } catch {
            this.consolePanel.setStatus('error', '程式碼解析失敗')
            return
          }
        }
      }
      if (!model) return

      try {
        this.stepRecords = this.interpreter.executeWithSteps(model.program)
        this.currentStepIndex = -1
        this.fullOutput = this.interpreter.getOutput()
        this.consolePanel.clear()
      } catch (e) {
        if (e instanceof RuntimeError) {
          const output = this.interpreter.getOutput()
          this.consolePanel.clear()
          if (output.length > 0) this.consolePanel.appendOutput(output.join(''))
          this.consolePanel.appendOutput('\n' + e.message)
          this.consolePanel.setStatus('error', e.message)
          return
        }
        throw e
      }

      this.stepController.setStepFn(() => {
        this.currentStepIndex++
        return this.currentStepIndex < this.stepRecords.length - 1
      })

      this.updateExecButtons(true)
    }

    this.stepController.step()
  }

  private onStepExecuted(): void {
    if (this.currentStepIndex < 0 || this.currentStepIndex >= this.stepRecords.length) return
    const step = this.stepRecords[this.currentStepIndex]

    // Look up blockId from sourceMappings if not directly available
    let blockId = step.blockId
    if (!blockId && step.sourceRange && this.syncController) {
      const mappings = this.syncController.getSourceMappings()
      const mapping = mappings.find(
        m => step.sourceRange!.start >= m.startLine && step.sourceRange!.start <= m.endLine
      )
      if (mapping) blockId = mapping.blockId
    }

    // Highlight block
    if (blockId && this.blocklyEditor) {
      this.blocklyEditor.highlightBlock(blockId)
    }
    // Highlight code lines
    if (step.sourceRange && this.codeEditor) {
      this.codeEditor.addHighlight(step.sourceRange.start, step.sourceRange.end)
    }

    // Incremental output: show output up to this step
    if (this.consolePanel) {
      this.consolePanel.clear()
      if (step.outputLength > 0) {
        this.consolePanel.appendOutput(this.fullOutput.slice(0, step.outputLength).join(''))
      }
    }

    // Update variable panel from scope snapshot
    if (this.variablePanel) {
      this.variablePanel.updateFromSnapshot(step.scopeSnapshot)
    }

    // Check if completed
    if (this.stepController.getStatus() === 'completed') {
      // Show full output and clean up
      if (this.consolePanel) {
        this.consolePanel.clear()
        this.consolePanel.appendOutput(this.fullOutput.join(''))
      }
      this.consolePanel?.setStatus('completed')
      this.updateExecButtons(false)
      this.blocklyEditor?.highlightBlock(null)
      this.codeEditor?.clearHighlight()
      return
    }

    // Check breakpoints — pause if current step hits a breakpoint
    if (step.sourceRange && this.codeEditor?.hasBreakpoint(step.sourceRange.start)) {
      if (this.stepController.getStatus() === 'running') {
        this.stepController.pause()
        const pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement | null
        if (pauseBtn) pauseBtn.textContent = '▶ 繼續'
        this.consolePanel?.setStatus('paused')
        return
      }
    }

    this.consolePanel?.setStatus('running')
  }

  /** Compute sourceMappings if not already available (for block highlighting) */
  private async ensureSourceMappings(): Promise<void> {
    if (!this.syncController || !this.codeToBlocks) return
    if (this.syncController.getSourceMappings().length > 0) return
    const code = this.codeEditor?.getCode()
    if (!code) return
    try {
      const result = await this.codeToBlocks.convertWithMappings(code)
      this.syncController.setSourceMappings(result.mappings)
    } catch { /* ignore — mappings are optional */ }
  }

  private onStepStopped(): void {
    // Clear highlights
    this.blocklyEditor?.highlightBlock(null)
    this.codeEditor?.clearHighlight()
    this.variablePanel?.clear()
    this.stepRecords = []
    this.currentStepIndex = 0
    this.fullOutput = []
    this.consolePanel?.setStatus('idle')
    this.updateExecButtons(false)
  }

  private updateExecButtons(running: boolean): void {
    const execControls = document.getElementById('exec-controls')
    const pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement | null
    if (execControls) {
      execControls.classList.toggle('hidden', !running)
    }
    if (pauseBtn) {
      pauseBtn.disabled = !running
      pauseBtn.textContent = '⏸ 暫停'
    }
  }

  private stopProgram(): void {
    this.stepController.stop()
    this.interpreter.reset()
    this.consolePanel?.setStatus('idle')
    this.updateExecButtons(false)
  }

  private updateSyncHints(): void {
    const b2cBtn = document.getElementById('blocks-to-code-btn')
    const c2bBtn = document.getElementById('code-to-blocks-btn')
    if (!b2cBtn || !c2bBtn) return
    const msg = Blockly.Msg as Record<string, string>
    b2cBtn.classList.toggle('sync-hint', this.lastChangedSide === 'blocks')
    c2bBtn.classList.toggle('sync-hint', this.lastChangedSide === 'code')
    b2cBtn.title = this.lastChangedSide === 'blocks'
      ? (msg['SYNC_HINT_BLOCKS_CHANGED'] || '積木有變更，按此同步到程式碼')
      : (msg['SYNC_BLOCKS_TO_CODE'] || '把積木轉成程式碼')
    c2bBtn.title = this.lastChangedSide === 'code'
      ? (msg['SYNC_HINT_CODE_CHANGED'] || '程式碼有變更，按此同步到積木')
      : (msg['SYNC_CODE_TO_BLOCKS'] || '把程式碼轉成積木')
  }

  private showToast(messageKey: string, fallback: string, type: 'success' | 'error' = 'success'): void {
    const text = (Blockly.Msg as Record<string, string>)[messageKey] || fallback
    const toast = document.createElement('div')
    toast.className = `toast toast-${type}`
    toast.textContent = text
    document.body.appendChild(toast)
    requestAnimationFrame(() => toast.classList.add('show'))
    setTimeout(() => {
      toast.classList.remove('show')
      setTimeout(() => toast.remove(), 300)
    }, 2000)
  }

  private async loadLocale(localeId: string): Promise<void> {
    this.localeLoader.setBlocklyMsg(Blockly.Msg as Record<string, string>)
    await this.localeLoader.load(localeId)
  }

  dispose(): void {
    this.syncController?.destroy()
    this.blocklyEditor?.dispose()
    this.codeEditor?.dispose()
  }
}
