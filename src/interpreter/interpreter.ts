import type { SemanticNode } from '../core/types'
import { CPP_BUILTIN_CONSTANTS, CPP_BUILTIN_NAMES } from '../languages/cpp/builtins'
import type { RuntimeValue, FunctionDef, ExecutionStatus, StepInfo } from './types'
import { defaultValue, valueToString } from './types'
import { RuntimeError, RUNTIME_ERRORS } from './errors'
import { Scope } from './scope'
import { IOSystem } from './io'
import { ConceptExecutorRegistry, type ExecutionContext } from './executor-registry'
import { registerLiteralExecutors } from './executors/literals'
import { registerVariableExecutors } from './executors/variables'
import { registerOperatorExecutors } from './executors/operators'
import { registerControlFlowExecutors } from './executors/control-flow'
import { registerFunctionExecutors } from './executors/functions'
import { registerIoExecutors } from './executors/io'
import { registerArrayExecutors } from './executors/arrays'
import { registerPointerExecutors } from './executors/pointers'
import { registerMutationExecutors } from './executors/mutations'
import { registerCmathExecutors } from './executors/cmath'
import { registerStringExecutors } from './executors/strings'

interface InterpreterOptions {
  maxSteps?: number
}

export class SemanticInterpreter implements ExecutionContext {
  scope: Scope = new Scope()
  io: IOSystem = new IOSystem()
  functions = new Map<string, FunctionDef>()
  pointerTargets = new Map<string, Scope>()
  scanfTokenBuffer: string[] = []
  private status: ExecutionStatus = 'idle'
  private steps = 0
  private maxSteps: number
  private stepRecords: StepInfo[] = []
  private recordSteps = false
  private inputProvider: (() => Promise<string>) | null = null
  private outputCallback: ((text: string) => void) | null = null
  private aborted = false
  private abortReject: ((reason: RuntimeError) => void) | null = null
  private waitingCallback: ((nodeId: string | null) => void) | null = null
  private stepRecordCallback: ((step: StepInfo) => Promise<void>) | null = null
  private unknownConceptHandler: ((concept: string) => Promise<'skip' | 'abort'>) | null = null
  private currentNode: SemanticNode | null = null
  private executorRegistry: ConceptExecutorRegistry

  constructor(options: InterpreterOptions = {}) {
    this.maxSteps = options.maxSteps ?? 100000
    this.executorRegistry = new ConceptExecutorRegistry()
    const reg = (concept: string, executor: import('./executor-registry').ConceptExecutor) =>
      this.executorRegistry.register(concept, executor)
    registerLiteralExecutors(reg)
    registerVariableExecutors(reg)
    registerOperatorExecutors(reg)
    registerControlFlowExecutors(reg)
    registerFunctionExecutors(reg)
    registerIoExecutors(reg)
    registerArrayExecutors(reg)
    registerPointerExecutors(reg)
    registerMutationExecutors(reg)
    registerCmathExecutors(reg)
    registerStringExecutors(reg)

    // 編譯時/宣告性概念：無執行行為
    const noop: import('./executor-registry').ConceptExecutor = async () => {}
    for (const c of [
      'cpp_include', 'cpp_include_local', 'cpp_using_namespace', 'cpp_define',
      'cpp:include', 'cpp:include_local', 'cpp:using_namespace', 'comment',
    ]) {
      reg(c, noop)
    }
  }

  /** Abort execution from outside (e.g., Ctrl+C) */
  abort(): void {
    this.aborted = true
    this.status = 'error'
    if (this.abortReject) {
      this.abortReject(new RuntimeError(RUNTIME_ERRORS.ABORTED))
      this.abortReject = null
    }
  }

  /** Await input provider with abort support. Returns null on EOF (\x04) or if no provider. */
  awaitInput(): Promise<string | null> {
    if (!this.inputProvider) return Promise.resolve(null)
    if (this.aborted) return Promise.reject(new RuntimeError(RUNTIME_ERRORS.ABORTED))
    this.waitingCallback?.(this.currentNode?.id ?? null)
    return new Promise<string | null>((resolve, reject) => {
      this.abortReject = reject
      this.inputProvider!().then(val => {
        this.abortReject = null
        if (val === '\x04') resolve(null)
        else resolve(val)
      }, reject)
    })
  }

  /** Register a callback fired when interpreter is waiting (e.g., for input) */
  setWaitingCallback(callback: ((nodeId: string | null) => void) | null): void {
    this.waitingCallback = callback
  }

  /** Register an async callback fired after each step is recorded (for real-time animation) */
  setStepRecordCallback(callback: ((step: StepInfo) => Promise<void>) | null): void {
    this.stepRecordCallback = callback
  }

  /** Register a handler for unknown concepts. Returns 'skip' to continue or 'abort' to stop. */
  setUnknownConceptHandler(handler: ((concept: string) => Promise<'skip' | 'abort'>) | null): void {
    this.unknownConceptHandler = handler
  }

  setInputProvider(provider: (() => Promise<string>) | null): void {
    this.inputProvider = provider
  }

  /** Register a callback for real-time output (called on each write/newline) */
  setOutputCallback(callback: ((text: string) => void) | null): void {
    this.outputCallback = callback
    this.io.onOutput(callback)
  }

  async execute(program: SemanticNode, stdin: string[] = []): Promise<void> {
    this.scope = new Scope()
    this.io = new IOSystem(stdin)
    if (this.outputCallback) this.io.onOutput(this.outputCallback)
    this.functions = new Map()
    this.steps = 0
    this.status = 'running'
    this.aborted = false
    this.abortReject = null

    this.scanfTokenBuffer = []

    // Built-in C/C++ constants — declare subset needed for scope-based lookup
    for (const [name, val] of Object.entries(CPP_BUILTIN_CONSTANTS)) {
      this.scope.declare(name, { type: val.type, value: val.value })
    }

    try {
      await this.executeNode(program)
      this.status = 'completed'
    } catch (e) {
      if (e instanceof RuntimeError) {
        this.status = 'error'
        throw e
      }
      throw e
    }
  }

  getState(): { status: ExecutionStatus } {
    return { status: this.status }
  }

  getOutput(): string[] {
    return this.io.getOutput()
  }

  getScope(): Scope {
    return this.scope
  }

  /** Enable or disable step recording */
  setRecordSteps(enabled: boolean): void {
    this.recordSteps = enabled
  }

  /** Execute with step recording for replay-based stepping */
  async executeWithSteps(program: SemanticNode, stdin: string[] = []): Promise<StepInfo[]> {
    this.stepRecords = []
    this.recordSteps = true
    await this.execute(program, stdin)
    this.recordSteps = false
    return [...this.stepRecords]
  }

  getStepRecords(): StepInfo[] {
    return [...this.stepRecords]
  }

  reset(): void {
    this.scope = new Scope()
    this.io.reset()
    this.functions = new Map()
    this.steps = 0
    this.status = 'idle'
    this.stepRecords = []
    this.recordSteps = false
  }

  // --- ExecutionContext implementation ---

  async executeNode(node: SemanticNode): Promise<RuntimeValue | void> {
    await this.countStep()
    this.currentNode = node
    const concept = node.concept

    const executor = this.executorRegistry.get(concept)
    if (executor) {
      return executor(node, this)
    }

    // 未知概念：通知使用者決定跳過或停止
    if (this.unknownConceptHandler) {
      const action = await this.unknownConceptHandler(concept)
      if (action === 'abort') {
        throw new RuntimeError(RUNTIME_ERRORS.UNKNOWN_CONCEPT, { concept })
      }
      // 'skip' — 繼續執行
      return
    }
    // 無 handler 時預設報錯
    throw new RuntimeError(RUNTIME_ERRORS.UNKNOWN_CONCEPT, { concept })
  }

  async countStep(): Promise<void> {
    if (this.aborted) {
      throw new RuntimeError(RUNTIME_ERRORS.ABORTED)
    }
    this.steps++
    if (this.steps > this.maxSteps) {
      throw new RuntimeError(RUNTIME_ERRORS.MAX_STEPS_EXCEEDED)
    }
    if (this.steps % 10000 === 0) {
      await new Promise<void>(r => setTimeout(r, 0))
    }
  }

  async executeBody(nodes: SemanticNode[]): Promise<void> {
    for (const child of nodes) {
      await this.executeNode(child)
      await this.recordStepInfo(child)
    }
  }

  async evaluate(node: SemanticNode): Promise<RuntimeValue> {
    const result = await this.executeNode(node)
    if (result && typeof result === 'object' && 'type' in result) {
      return result as RuntimeValue
    }
    return defaultValue('void')
  }

  toNumber(val: RuntimeValue): number {
    if (typeof val.value === 'number') return val.value
    if (typeof val.value === 'boolean') return val.value ? 1 : 0
    if (typeof val.value === 'string') return Number(val.value) || 0
    return 0
  }

  toBool(val: RuntimeValue): boolean {
    if (typeof val.value === 'boolean') return val.value
    if (typeof val.value === 'number') return val.value !== 0
    if (typeof val.value === 'string') return val.value.length > 0
    return false
  }

  coerceType(val: RuntimeValue, targetType: string): RuntimeValue {
    if (val.type === targetType) return val
    switch (targetType) {
      case 'int': return { type: 'int', value: Math.trunc(this.toNumber(val)) }
      case 'float':
      case 'double': return { type: targetType as import('./types').RuntimeType, value: this.toNumber(val) }
      case 'bool': return { type: 'bool', value: this.toBool(val) }
      case 'string': return { type: 'string', value: valueToString(val) }
      case 'char': return { type: 'char', value: valueToString(val).charAt(0) || '' }
      default: return val
    }
  }

  /** Read a single whitespace-delimited token for cin >>. Shares buffer with scanf. */
  readCinToken(): string | null {
    if (this.scanfTokenBuffer.length > 0) {
      return this.scanfTokenBuffer.shift()!
    }
    const line = this.io.read()
    if (line === null) return null
    const tokens = line.trim().split(/\s+/).filter(t => t.length > 0)
    if (tokens.length === 0) return null
    if (tokens.length > 1) {
      this.scanfTokenBuffer.push(...tokens.slice(1))
    }
    return tokens[0]
  }

  /** Read a single whitespace-delimited token for scanf. Splits lines into tokens. */
  readScanfToken(): string | null {
    if (this.scanfTokenBuffer.length > 0) {
      return this.scanfTokenBuffer.shift()!
    }
    const line = this.io.read()
    if (line === null) return null
    const tokens = line.trim().split(/\s+/).filter(t => t.length > 0)
    if (tokens.length === 0) return null
    if (tokens.length > 1) {
      this.scanfTokenBuffer.push(...tokens.slice(1))
    }
    return tokens[0]
  }

  // --- Step recording ---

  private async recordStepInfo(node: SemanticNode): Promise<void> {
    if (!this.recordSteps) return
    const concept = node.concept
    if (concept.includes(':')) return
    const statementConcepts = new Set([
      'var_declare', 'var_declare_expr', 'var_assign', 'print', 'input',
      'cpp_printf', 'cpp_scanf', 'cpp_scanf_expr',
      'if', 'count_loop', 'cpp_for_loop', 'while_loop', 'cpp_do_while', 'cpp_switch',
      'func_def', 'func_call', 'func_call_expr', 'return', 'break', 'continue',
      'cpp_increment', 'cpp_increment_expr', 'cpp_compound_assign_expr',
      'array_declare', 'array_assign',
      'cpp_pointer_assign', 'forward_decl',
    ])
    if (!statementConcepts.has(concept)) return

    const scopeSnapshot: { name: string; type: string; value: string }[] = []
    for (const [name, val] of this.scope.getAll()) {
      if (CPP_BUILTIN_NAMES.has(name)) continue
      scopeSnapshot.push({ name, type: val.type, value: valueToString(val) })
    }

    const step: StepInfo = {
      node,
      nodeId: node.id,
      sourceRange: node.metadata?.sourceRange
        ? { start: node.metadata.sourceRange.startLine, end: node.metadata.sourceRange.endLine }
        : null,
      outputLength: this.io.getOutput().length,
      scopeSnapshot,
    }
    this.stepRecords.push(step)

    if (this.stepRecordCallback) {
      await this.stepRecordCallback(step)
    }
  }
}
