import * as Blockly from 'blockly'
import { SemanticInterpreter } from '../interpreter/interpreter'
import { StepController } from './step-controller'
import { DebugToolbar } from './debug-toolbar'
import type { StepInfo, ExecutionSpeed } from '../interpreter/types'
import type { SemanticNode as InterpreterNode } from '../core/types'
import { RuntimeError } from '../interpreter/errors'
import { showToast } from './toolbar/toast'
import type { BlocklyPanel } from './panels/blockly-panel'
import type { MonacoPanel } from './panels/monaco-panel'
import type { ConsolePanel } from './panels/console-panel'
import type { VariablePanel } from './panels/variable-panel'
import type { BottomPanel } from './layout/bottom-panel'
import type { SyncController } from './sync-controller'

export interface ExecutionPanels {
  blocklyPanel: BlocklyPanel | null
  monacoPanel: MonacoPanel | null
  consolePanel: ConsolePanel | null
  variablePanel: VariablePanel | null
  bottomPanel: BottomPanel | null
  syncController: SyncController | null
}

export class ExecutionController {
  private panels: ExecutionPanels
  private interpreter: SemanticInterpreter | null = null
  private stepController: StepController | null = null
  private debugToolbar: DebugToolbar
  private runMode: 'run' | 'debug' | 'animate-slow' | 'animate-medium' | 'animate-fast' | 'step' = 'run'
  private stepRecords: StepInfo[] = []
  private currentStepIndex = -1
  private animatePaused = false
  private animateResolve: (() => void) | null = null
  private animateSpeed: ExecutionSpeed = 'medium'
  private animateAccelerateSkipIds: Set<string> | null = null
  private getBlocksDirty: () => boolean
  private syncBeforeRun: () => void

  private static readonly ANIMATE_DELAY: Record<string, number> = {
    slow: 800,
    medium: 300,
    fast: 50,
  }

  constructor(
    panels: ExecutionPanels,
    opts: {
      getBlocksDirty: () => boolean
      syncBeforeRun: () => void
    },
  ) {
    this.panels = panels
    this.getBlocksDirty = opts.getBlocksDirty
    this.syncBeforeRun = opts.syncBeforeRun
    this.debugToolbar = new DebugToolbar()
  }

  getDebugToolbar(): DebugToolbar {
    return this.debugToolbar
  }

  updatePanels(panels: Partial<ExecutionPanels>): void {
    Object.assign(this.panels, panels)
  }

  setupExecution(): void {
    const replaceBtn = (id: string) => {
      const el = document.getElementById(id)
      if (el) {
        const clone = el.cloneNode(true) as HTMLElement
        el.parentNode?.replaceChild(clone, el)
        return clone
      }
      return null
    }

    replaceBtn('run-btn')?.addEventListener('click', () => this.executeWithCurrentMode())

    const modeBtn = replaceBtn('run-mode-btn')
    const modeMenu = document.getElementById('run-mode-menu')
    modeBtn?.addEventListener('click', (e) => {
      e.stopPropagation()
      if (modeMenu) {
        const visible = modeMenu.style.display !== 'none'
        modeMenu.style.display = visible ? 'none' : ''
        if (!visible) this.updateRunModeMenu()
      }
    })

    modeMenu?.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('.run-mode-option') as HTMLElement | null
      if (!target) return
      const mode = target.dataset.mode as typeof this.runMode
      if (mode) {
        this.runMode = mode
        this.updateRunButtonLabel()
        modeMenu.style.display = 'none'
        this.executeWithCurrentMode()
      }
    })

    document.addEventListener('click', () => {
      if (modeMenu) modeMenu.style.display = 'none'
    })

    this.panels.consolePanel?.onSignal((signal) => {
      if (signal === 'SIGINT') {
        this.interpreter?.abort()
        if (this.stepController?.getStatus() === 'stepping' || this.stepController?.getStatus() === 'paused') {
          this.handleStop()
        }
      }
    })

    this.debugToolbar.onAction((action) => {
      switch (action) {
        case 'continue':
          if (this.animatePaused && this.animateResolve) {
            this.animatePaused = false
            this.debugToolbar.setMode('running')
            this.panels.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_RUNNING'] || 'Running', 'running')
            this.animateResolve()
          } else if (this.stepController) {
            this.stepController.resume()
            this.debugToolbar.setMode('running')
            this.panels.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_RUNNING'] || 'Running', 'running')
          }
          // If interpreter is running but no animateResolve (e.g., waiting for input), ignore
          break
        case 'pause':
          if (this.animateResolve === null && this.interpreter) {
            this.animatePaused = true
          } else {
            this.handlePause()
          }
          this.debugToolbar.setMode('paused')
          break
        case 'step':
          if (this.animatePaused && this.animateResolve) {
            this.animatePaused = true
            this.animateResolve()
          } else if (!this.interpreter) {
            // Only start new step execution if no interpreter is already running
            this.handleStep()
          }
          // If interpreter is running but no animateResolve (e.g., waiting for input), ignore
          break
        case 'step-out':
          this.handleStepOut()
          break
        case 'accelerate':
          this.handleAccelerate()
          break
        case 'stop':
          if (this.animateResolve) {
            const resolve = this.animateResolve
            this.animateResolve = null
            resolve()
          }
          this.interpreter?.abort()
          this.handleStop()
          break
      }
    })
  }

  private async handleRun(): Promise<void> {
    if (this.getBlocksDirty()) {
      const sync = confirm(Blockly.Msg['EXEC_UNSYNC_PROMPT'] || 'Blocks have changed. Sync before running?')
      if (sync) this.syncBeforeRun()
    }

    // Execution is a projection of the canonical semantic tree — not biased to any view
    const tree = this.panels.syncController?.getCurrentTree()
    if (!tree) return

    this.resetExecution()
    this.interpreter = new SemanticInterpreter({ maxSteps: 10_000_000 })
    this.interpreter.setInputProvider(() => this.panels.consolePanel!.promptInput())
    this.interpreter.setOutputCallback((text: string) => {
      this.panels.consolePanel?.write(text)
    })
    this.interpreter.setWaitingCallback((nodeId) => {
      this.panels.blocklyPanel?.clearHighlight()
      // Switch to console tab so the input field is visible
      this.panels.bottomPanel?.showTab('console')
      this.panels.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_WAITING'] || 'Waiting for input...', 'running')
      if (nodeId) {
        const mapping = this.panels.syncController?.getMappingForNode(nodeId)
        if (mapping) {
          if (mapping.blockId && this.panels.blocklyPanel?.getWorkspace()) {
            this.panels.blocklyPanel.highlightBlock(mapping.blockId, 'execution')
            this.panels.blocklyPanel.getWorkspace()!.centerOnBlock(mapping.blockId)
          }
          if (mapping.startLine !== null && mapping.endLine !== null && this.panels.monacoPanel) {
            this.panels.monacoPanel.revealLine(mapping.startLine + 1)
            this.highlightMonacoLines(mapping.startLine + 1, mapping.endLine + 1)
          }
        }
      }
    })

    // Breakpoint support in run mode: pause on breakpoint, then allow stepping
    this.animatePaused = false
    this.animateResolve = null
    this.stepRecords = []
    this.currentStepIndex = -1
    this.interpreter.setRecordSteps(true)
    this.interpreter.setStepRecordCallback(async (step: StepInfo) => {
      this.stepRecords.push(step)
      this.currentStepIndex = this.stepRecords.length - 1

      // If already in stepping mode (user clicked "step" from breakpoint), pause every step
      let shouldPause = this.animatePaused

      // Check breakpoints
      if (!shouldPause && step.nodeId) {
        const mapping = this.panels.syncController?.getMappingForNode(step.nodeId)
        if (mapping && mapping.startLine !== null && mapping.endLine !== null) {
          const breakpoints = this.panels.monacoPanel?.getBreakpoints() ?? []
          if (breakpoints.length > 0) {
            const hit = breakpoints.some(bp => bp >= mapping.startLine! + 1 && bp <= mapping.endLine! + 1)
            if (hit) {
              shouldPause = true
              this.panels.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_PAUSED'] || 'Paused (breakpoint)', 'running')
            }
          }
        }
      }

      if (shouldPause) {
        this.displayStep(this.currentStepIndex)
        this.animatePaused = true
        this.debugToolbar.setMode('paused')
        this.panels.bottomPanel?.showTab('variables')
        await new Promise<void>(resolve => { this.animateResolve = resolve })
        this.animateResolve = null
      }
    })

    this.showExecButtons(true, 'running')
    this.panels.consolePanel?.clear()
    this.panels.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_RUNNING'] || 'Running', 'running')
    this.panels.bottomPanel?.showTab('console')

    try {
      await this.interpreter.execute(tree as unknown as InterpreterNode)
      this.clearHighlights()
      this.panels.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_COMPLETED'] || 'Completed', 'completed')
      showToast(Blockly.Msg['TOAST_EXEC_COMPLETE'] || 'Program completed', 'success')
    } catch (e) {
      if (e instanceof RuntimeError) {
        if (e.i18nKey === 'RUNTIME_ERR_ABORTED') {
          this.panels.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_ABORTED'] || 'Interrupted', '')
        } else {
          this.panels.consolePanel?.error(e.message)
          this.panels.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_ERROR'] || 'Error', 'error')
          showToast(Blockly.Msg['TOAST_EXEC_ERROR'] || 'Execution error', 'error')
        }
      } else {
        this.panels.consolePanel?.error(String(e))
        this.panels.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_ERROR'] || 'Error', 'error')
      }
    } finally {
      this.showExecButtons(false)
    }
  }

  private async handleStep(): Promise<void> {
    if (this.stepController?.getStatus() === 'stepping' || this.stepController?.getStatus() === 'paused') {
      this.stepController.step()
      return
    }

    if (this.getBlocksDirty()) {
      const sync = confirm(Blockly.Msg['EXEC_UNSYNC_PROMPT'] || 'Blocks have changed. Sync before running?')
      if (sync) this.syncBeforeRun()
    }

    // Execution is a projection of the canonical semantic tree — not biased to any view
    const tree = this.panels.syncController?.getCurrentTree()
    if (!tree) return

    this.resetExecution()
    this.interpreter = new SemanticInterpreter({ maxSteps: 10_000_000 })
    this.interpreter.setInputProvider(() => this.panels.consolePanel!.promptInput())
    this.interpreter.setOutputCallback((text: string) => {
      this.panels.consolePanel?.write(text)
    })
    this.interpreter.setWaitingCallback((nodeId) => {
      this.panels.blocklyPanel?.clearHighlight()
      // Switch to console tab so the input field is visible
      this.panels.bottomPanel?.showTab('console')
      this.panels.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_WAITING'] || 'Waiting for input...', 'running')
      if (nodeId) {
        const mapping = this.panels.syncController?.getMappingForNode(nodeId)
        if (mapping) {
          if (mapping.blockId && this.panels.blocklyPanel?.getWorkspace()) {
            this.panels.blocklyPanel.highlightBlock(mapping.blockId, 'execution')
            this.panels.blocklyPanel.getWorkspace()!.centerOnBlock(mapping.blockId)
          }
          if (mapping.startLine !== null && mapping.endLine !== null && this.panels.monacoPanel) {
            this.panels.monacoPanel.revealLine(mapping.startLine + 1)
            this.highlightMonacoLines(mapping.startLine + 1, mapping.endLine + 1)
          }
        }
      }
    })
    this.panels.consolePanel?.clear()
    this.panels.bottomPanel?.showTab('variables')
    this.showExecButtons(true, 'stepping')

    try {
      this.stepRecords = await this.interpreter.executeWithSteps(tree as unknown as InterpreterNode)
    } catch (e) {
      if (e instanceof RuntimeError) {
        this.panels.consolePanel?.error(e.message)
        this.panels.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_ERROR'] || 'Error', 'error')
        this.showExecButtons(false)
        return
      }
    }

    this.currentStepIndex = -1
    this.stepController = new StepController()

    const speedSelect = document.getElementById('speed-select') as HTMLSelectElement | null
    if (speedSelect) {
      this.stepController.setSpeed(speedSelect.value as ExecutionSpeed)
    }

    this.stepController.setStepFn(() => {
      this.currentStepIndex++
      return this.currentStepIndex < this.stepRecords.length - 1
    })

    this.stepController.onStep(() => {
      this.displayStep(this.currentStepIndex)

      const step = this.stepRecords[this.currentStepIndex]
      if (step?.nodeId) {
        const mapping = this.panels.syncController?.getMappingForNode(step.nodeId)
        if (mapping && mapping.startLine !== null && mapping.endLine !== null) {
          const breakpoints = this.panels.monacoPanel?.getBreakpoints() ?? []
          const hitBreakpoint = breakpoints.some(bp => bp >= mapping.startLine + 1 && bp <= mapping.endLine + 1)
          if (hitBreakpoint && this.stepController?.getStatus() === 'running') {
            this.stepController.pause()
            this.panels.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_PAUSED'] || 'Paused (breakpoint)', 'running')
            this.debugToolbar.setMode('paused')
          }
        }
      }
    })

    this.stepController.onStop(() => {
      this.clearHighlights()
      this.panels.variablePanel?.clear()
      this.showExecButtons(false)
    })

    this.panels.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_RUNNING'] || 'Running', 'running')
    this.stepController.step()
  }

  private handlePause(): void {
    if (this.stepController?.getStatus() === 'running') {
      this.stepController.pause()
      this.panels.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_PAUSED'] || 'Paused', 'running')
      this.debugToolbar.setMode('paused')
    }
  }

  private handleStepOut(): void {
    if (!this.stepController || !this.stepRecords.length) return
    const status = this.stepController.getStatus()
    if (status !== 'stepping' && status !== 'paused') return

    const currentNodeId = this.stepRecords[this.currentStepIndex]?.nodeId
    if (!currentNodeId) {
      this.stepController.step()
      return
    }

    while (this.currentStepIndex < this.stepRecords.length - 1) {
      const nextStep = this.stepRecords[this.currentStepIndex + 1]
      if (nextStep?.nodeId !== currentNodeId) break
      this.currentStepIndex++
    }
    this.stepController.step()
  }

  private nodeIdToBlockId(nodeId: string): string | null {
    const mapping = this.panels.syncController?.getMappingForNode(nodeId)
    return mapping?.blockId ?? null
  }

  private handleAccelerate(): void {
    const currentNodeId = this.stepRecords[this.currentStepIndex]?.nodeId
    if (!currentNodeId) return
    const currentBlockId = this.nodeIdToBlockId(currentNodeId)

    if (this.interpreter && !this.stepController) {
      const level = this.debugToolbar.getAccelerateLevel() ?? 1
      const workspace = this.panels.blocklyPanel?.getWorkspace()
      let targetBlock = currentBlockId ? workspace?.getBlockById(currentBlockId) ?? null : null

      if (level > 1 && targetBlock) {
        for (let i = 1; i < level && targetBlock; i++) {
          const parent = targetBlock.getSurroundParent()
          if (!parent) break
          targetBlock = parent
        }
      }

      const skipNodeIds = new Set<string>()
      if (targetBlock) {
        // Collect all block IDs under target, then map to nodeIds for skipping
        const blockIds = new Set<string>()
        const collectBlockIds = (block: Blockly.Block) => {
          blockIds.add(block.id)
          for (const child of block.getChildren(false)) {
            collectBlockIds(child)
          }
        }
        collectBlockIds(targetBlock)
        // Map blockIds → nodeIds via blockMappings
        const blockMappings = this.panels.syncController?.getBlockMappings() ?? []
        for (const bm of blockMappings) {
          if (blockIds.has(bm.blockId)) skipNodeIds.add(bm.nodeId)
        }
      } else {
        skipNodeIds.add(currentNodeId)
      }
      this.animateAccelerateSkipIds = skipNodeIds

      if (this.animatePaused && this.animateResolve) {
        this.animatePaused = false
        this.debugToolbar.setMode('running')
        this.animateResolve()
      }
      return
    }

    if (!this.stepController || !this.stepRecords.length) return
    const status = this.stepController.getStatus()
    if (status === 'completed' || status === 'idle') return

    const wasRunning = status === 'running'
    if (wasRunning) this.stepController.pause()

    const level = this.debugToolbar.getAccelerateLevel() ?? 1
    const workspace = this.panels.blocklyPanel?.getWorkspace()

    if (level <= 1) {
      while (this.currentStepIndex < this.stepRecords.length - 1) {
        const nextStep = this.stepRecords[this.currentStepIndex + 1]
        if (nextStep?.nodeId !== currentNodeId) break
        this.currentStepIndex++
      }
    } else {
      let targetBlock = currentBlockId ? workspace?.getBlockById(currentBlockId) ?? null : null
      for (let i = 1; i < level && targetBlock; i++) {
        const parent = targetBlock.getSurroundParent()
        if (!parent) break
        targetBlock = parent
      }
      const skipNodeIds = new Set<string>()
      if (targetBlock) {
        const blockIds = new Set<string>()
        const collectBlockIds = (block: Blockly.Block) => {
          blockIds.add(block.id)
          for (const child of block.getChildren(false)) {
            collectBlockIds(child)
          }
        }
        collectBlockIds(targetBlock)
        const blockMappings = this.panels.syncController?.getBlockMappings() ?? []
        for (const bm of blockMappings) {
          if (blockIds.has(bm.blockId)) skipNodeIds.add(bm.nodeId)
        }
      }
      while (this.currentStepIndex < this.stepRecords.length - 1) {
        const nextStep = this.stepRecords[this.currentStepIndex + 1]
        if (!nextStep?.nodeId || !skipNodeIds.has(nextStep.nodeId)) break
        this.currentStepIndex++
      }
    }
    this.displayStep(this.currentStepIndex)
    if (wasRunning) {
      this.stepController.resume()
    } else {
      this.stepController.step()
    }
  }

  handleStop(): void {
    this.stepController?.stop()
    this.clearHighlights()
    this.panels.variablePanel?.clear()
    this.panels.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_IDLE'] || 'Ready', '')
    this.showExecButtons(false)
  }

  private displayStep(index: number): void {
    if (index < 0 || index >= this.stepRecords.length) return
    const step = this.stepRecords[index]

    this.panels.variablePanel?.updateFromSnapshot(step.scopeSnapshot)
    this.panels.bottomPanel?.showTab('variables')

    this.panels.blocklyPanel?.clearHighlight()
    const autoScroll = this.debugToolbar.isAutoScrollEnabled() ?? false
    if (step.nodeId) {
      const mapping = this.panels.syncController?.getMappingForNode(step.nodeId)
      if (mapping) {
        if (mapping.blockId && this.panels.blocklyPanel?.getWorkspace()) {
          this.panels.blocklyPanel.highlightBlock(mapping.blockId, 'execution')
          if (autoScroll) {
            this.panels.blocklyPanel.getWorkspace()!.centerOnBlock(mapping.blockId)
          }
        }
        if (mapping.startLine !== null && mapping.endLine !== null && this.panels.monacoPanel) {
          // revealLine BEFORE addHighlight — revealLine triggers onCursorChange which clears highlights
          if (autoScroll) {
            this.panels.monacoPanel.revealLine(mapping.startLine + 1)
          }
          this.highlightMonacoLines(mapping.startLine + 1, mapping.endLine + 1)
        }
      }
    }

    if (this.stepController?.getStatus() === 'completed') {
      this.panels.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_COMPLETED'] || 'Completed', 'completed')
      this.showExecButtons(false)
    }
  }

  private resetExecution(): void {
    this.interpreter = null
    this.stepController?.stop()
    this.stepController = null
    this.stepRecords = []
    this.currentStepIndex = -1
    this.clearHighlights()
  }

  private showExecButtons(running: boolean, mode: 'running' | 'stepping' = 'running'): void {
    const runGroup = document.querySelector('.run-group') as HTMLElement | null
    if (runGroup) runGroup.style.display = running ? 'none' : ''

    if (running) {
      this.debugToolbar.show(mode)
    } else {
      this.debugToolbar.hide()
    }
  }

  private executeWithCurrentMode(): void {
    switch (this.runMode) {
      case 'run':
        this.handleRun()
        break
      case 'debug':
      case 'step':
        this.handleStep()
        break
      case 'animate-slow':
      case 'animate-medium':
      case 'animate-fast': {
        const speedMap = { 'animate-slow': 'slow', 'animate-medium': 'medium', 'animate-fast': 'fast' } as const
        this.handleAnimate(speedMap[this.runMode])
        break
      }
    }
  }

  private async handleAnimate(speed: ExecutionSpeed): Promise<void> {
    if (this.animatePaused && this.animateResolve) {
      this.animatePaused = false
      this.animateSpeed = speed
      this.debugToolbar.setMode('running')
      this.panels.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_RUNNING'] || 'Running', 'running')
      this.animateResolve()
      return
    }

    if (this.getBlocksDirty()) {
      const sync = confirm(Blockly.Msg['EXEC_UNSYNC_PROMPT'] || 'Blocks have changed. Sync before running?')
      if (sync) this.syncBeforeRun()
    }

    // Execution is a projection of the canonical semantic tree — not biased to any view
    const tree = this.panels.syncController?.getCurrentTree()
    if (!tree) return

    this.resetExecution()
    this.animatePaused = false
    this.animateResolve = null
    this.animateSpeed = speed
    this.animateAccelerateSkipIds = null

    this.interpreter = new SemanticInterpreter({ maxSteps: 10_000_000 })
    this.interpreter.setInputProvider(() => this.panels.consolePanel!.promptInput())
    this.interpreter.setOutputCallback((text: string) => {
      this.panels.consolePanel?.write(text)
    })
    this.interpreter.setWaitingCallback((nodeId) => {
      this.panels.blocklyPanel?.clearHighlight()
      // Switch to console tab so the input field is visible
      this.panels.bottomPanel?.showTab('console')
      this.panels.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_WAITING'] || 'Waiting for input...', 'running')
      if (nodeId) {
        const mapping = this.panels.syncController?.getMappingForNode(nodeId)
        if (mapping) {
          if (mapping.blockId && this.panels.blocklyPanel?.getWorkspace()) {
            this.panels.blocklyPanel.highlightBlock(mapping.blockId, 'execution')
            this.panels.blocklyPanel.getWorkspace()!.centerOnBlock(mapping.blockId)
          }
          if (mapping.startLine !== null && mapping.endLine !== null && this.panels.monacoPanel) {
            this.panels.monacoPanel.revealLine(mapping.startLine + 1)
            this.highlightMonacoLines(mapping.startLine + 1, mapping.endLine + 1)
          }
        }
      }
    })

    this.stepRecords = []
    this.currentStepIndex = -1
    this.interpreter.setRecordSteps(true)
    this.interpreter.setStepRecordCallback(async (step: StepInfo) => {
      this.stepRecords.push(step)
      this.currentStepIndex = this.stepRecords.length - 1

      if (this.animateAccelerateSkipIds && step.nodeId && this.animateAccelerateSkipIds.has(step.nodeId)) {
        return
      }
      this.animateAccelerateSkipIds = null

      this.displayStep(this.currentStepIndex)

      let shouldPause = this.animatePaused
      if (!shouldPause && step.nodeId) {
        const mapping = this.panels.syncController?.getMappingForNode(step.nodeId)
        if (mapping && mapping.startLine !== null && mapping.endLine !== null) {
          const breakpoints = this.panels.monacoPanel?.getBreakpoints() ?? []
          const hitBreakpoint = breakpoints.some(bp => bp >= mapping.startLine + 1 && bp <= mapping.endLine + 1)
          if (hitBreakpoint) {
            shouldPause = true
            this.panels.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_PAUSED'] || 'Paused (breakpoint)', 'running')
          }
        }
      }

      if (shouldPause) {
        this.animatePaused = true
        this.debugToolbar.setMode('paused')
        await new Promise<void>(resolve => { this.animateResolve = resolve })
        this.animateResolve = null
        return
      }

      const delay = ExecutionController.ANIMATE_DELAY[this.animateSpeed]
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    })

    this.panels.consolePanel?.clear()
    this.panels.bottomPanel?.showTab('variables')
    this.showExecButtons(true, 'running')
    this.panels.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_RUNNING'] || 'Running', 'running')

    try {
      await this.interpreter.execute(tree as unknown as InterpreterNode)
      this.panels.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_COMPLETED'] || 'Completed', 'completed')
    } catch (e) {
      if (e instanceof RuntimeError) {
        if (e.i18nKey === 'RUNTIME_ERR_ABORTED') {
          this.panels.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_ABORTED'] || 'Interrupted', '')
        } else {
          this.panels.consolePanel?.error(e.message)
          this.panels.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_ERROR'] || 'Error', 'error')
        }
      } else {
        this.panels.consolePanel?.error(String(e))
        this.panels.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_ERROR'] || 'Error', 'error')
      }
    } finally {
      this.clearHighlights()
      this.showExecButtons(false)
    }
  }

  private updateRunButtonLabel(): void {
    const btn = document.getElementById('run-btn')
    if (!btn) return
    const labels: Record<string, string> = {
      'run': '▶ 執行',
      'debug': '🔍 除錯',
      'animate-slow': '▷ 動畫（慢）',
      'animate-medium': '▷ 動畫（中）',
      'animate-fast': '▷ 動畫（快）',
      'step': '⏭ 逐步',
    }
    btn.textContent = labels[this.runMode] ?? '▶ 執行'
  }

  private updateRunModeMenu(): void {
    const menu = document.getElementById('run-mode-menu')
    if (!menu) return
    menu.querySelectorAll('.run-mode-option').forEach(el => {
      const opt = el as HTMLElement
      opt.classList.toggle('active', opt.dataset.mode === this.runMode)
    })
  }

  private highlightMonacoLines(startLine: number, endLine: number): void {
    this.panels.monacoPanel?.addHighlight(startLine, endLine)
  }

  /** Highlight both block and code panels for a given nodeId */
  private highlightNodeId(nodeId: string | undefined): void {
    if (!nodeId) return
    this.panels.blocklyPanel?.clearHighlight()
    const mapping = this.panels.syncController?.getMappingForNode(nodeId)
    if (!mapping) return
    if (mapping.blockId && this.panels.blocklyPanel?.getWorkspace()) {
      this.panels.blocklyPanel.highlightBlock(mapping.blockId, 'execution')
    }
    if (mapping.startLine !== null && mapping.endLine !== null && this.panels.monacoPanel) {
      this.panels.monacoPanel.revealLine(mapping.startLine + 1)
      this.highlightMonacoLines(mapping.startLine + 1, mapping.endLine + 1)
    }
  }

  private clearHighlights(): void {
    this.panels.blocklyPanel?.clearHighlight()
  }

  dispose(): void {
    this.debugToolbar.dispose()
  }
}
