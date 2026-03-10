import type { SemanticNode } from '../core/types'
import { createNode } from '../core/semantic-tree'
import type { RuntimeValue, RuntimeType, FunctionDef, ExecutionStatus, StepInfo } from './types'
import { defaultValue, valueToString, parseInputValue } from './types'
import { RuntimeError, RUNTIME_ERRORS } from './errors'
import { Scope } from './scope'
import { IOSystem } from './io'
import { unescapeC } from '../core/registry/transform-registry'

/** Break/Continue 訊號（非錯誤，用於流程控制） */
class BreakSignal { readonly _brand = 'break' }
class ContinueSignal { readonly _brand = 'continue' }
class ReturnSignal {
  value: RuntimeValue
  constructor(value: RuntimeValue) { this.value = value }
}

interface InterpreterOptions {
  maxSteps?: number
}

export class SemanticInterpreter {
  private scope: Scope = new Scope()
  private io: IOSystem = new IOSystem()
  private functions = new Map<string, FunctionDef>()
  private status: ExecutionStatus = 'idle'
  private steps = 0
  private maxSteps: number
  private stepRecords: StepInfo[] = []
  private recordSteps = false
  private inputProvider: (() => Promise<string>) | null = null
  private outputCallback: ((text: string) => void) | null = null
  private pointerTargets = new Map<string, import('./scope').Scope>()
  private scanfTokenBuffer: string[] = []  // buffered tokens for scanf/cin whitespace splitting
  private aborted = false
  private abortReject: ((reason: RuntimeError) => void) | null = null
  private waitingCallback: ((blockId: string | null) => void) | null = null
  private stepRecordCallback: ((step: StepInfo) => Promise<void>) | null = null
  private currentNode: SemanticNode | null = null

  constructor(options: InterpreterOptions = {}) {
    this.maxSteps = options.maxSteps ?? 100000
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

  /** Await input provider with abort support. Returns null on EOF (\x04). */
  private awaitInput(): Promise<string | null> {
    if (this.aborted) return Promise.reject(new RuntimeError(RUNTIME_ERRORS.ABORTED))
    // Notify that interpreter is waiting for input
    this.waitingCallback?.(this.currentNode?.metadata?.blockId ?? null)
    return new Promise<string | null>((resolve, reject) => {
      this.abortReject = reject
      this.inputProvider!().then(val => {
        this.abortReject = null
        // Ctrl+D sends \x04 — treat as EOF
        if (val === '\x04') resolve(null)
        else resolve(val)
      }, reject)
    })
  }

  /** Register a callback fired when interpreter is waiting (e.g., for input) */
  setWaitingCallback(callback: ((blockId: string | null) => void) | null): void {
    this.waitingCallback = callback
  }

  /** Register an async callback fired after each step is recorded (for real-time animation) */
  setStepRecordCallback(callback: ((step: StepInfo) => Promise<void>) | null): void {
    this.stepRecordCallback = callback
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

    // Built-in C/C++ constants
    this.scope.declare('EOF', { type: 'int', value: -1 })
    this.scope.declare('true', { type: 'int', value: 1 })
    this.scope.declare('false', { type: 'int', value: 0 })
    this.scope.declare('NULL', { type: 'int', value: 0 })

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

  // --- 核心分派 ---

  private async executeNode(node: SemanticNode): Promise<RuntimeValue | void> {
    await this.countStep()
    this.currentNode = node
    const concept = node.concept

    // 語言特有概念：靜默略過
    if (concept.includes(':')) return

    switch (concept) {
      case 'program': return this.execProgram(node)
      case 'number_literal': return this.execNumberLiteral(node)
      case 'string_literal': return this.execStringLiteral(node)
      case 'var_declare': return this.execVarDeclare(node)
      case 'var_assign': return this.execVarAssign(node)
      case 'var_ref': return this.execVarRef(node)
      case 'builtin_constant': return this.execBuiltinConstant(node)
      case 'arithmetic': return this.execArithmetic(node)
      case 'compare': return this.execCompare(node)
      case 'logic': return this.execLogic(node)
      case 'logic_not': return this.execLogicNot(node)
      case 'if': return this.execIf(node)
      case 'count_loop': return this.execCountLoop(node)
      case 'cpp_for_loop': return this.execForLoop(node)
      case 'while_loop': return this.execWhileLoop(node)
      case 'cpp_do_while': return this.execDoWhile(node)
      case 'cpp_switch': return this.execSwitch(node)
      case 'cpp_ternary': return this.execTernary(node)
      case 'cpp_cast': return this.execCast(node)
      case 'cpp_comma_expr': return this.execCommaExpr(node)
      case 'cpp_address_of': return this.execAddressOf(node)
      case 'cpp_pointer_deref': return this.execPointerDeref(node)
      case 'cpp_pointer_assign': return this.execPointerAssign(node)
      case 'forward_decl': return  // no-op: forward function declaration
      case 'break': throw new BreakSignal()
      case 'continue': throw new ContinueSignal()
      case 'func_def': return this.execFuncDef(node)
      case 'func_call': return this.execFuncCall(node)
      case 'func_call_expr': return this.execFuncCall(node)
      case 'return': return this.execReturn(node)
      case 'print': return this.execPrint(node)
      case 'input': return this.execInput(node)
      case 'cpp_printf': return this.execCppPrintf(node)
      case 'cpp_scanf': return this.execCppScanf(node)
      case 'endl': return { type: 'string', value: '\n' }
      case 'array_declare': return this.execArrayDeclare(node)
      case 'array_access': return this.execArrayAccess(node)
      case 'array_assign': return this.execArrayAssign(node)
      case 'cpp_increment': return this.execIncrement(node)
      case 'cpp_increment_expr': return this.execIncrement(node)
      case 'negate': return this.execNegate(node)
      case 'bitwise_not': return this.execBitwiseNot(node)
      case 'compound_assign': return this.execCompoundAssign(node)
      case 'cpp_compound_assign': return this.execCompoundAssign(node)
      case 'cpp_compound_assign_expr': return this.execCompoundAssign(node)
      case 'var_declare_expr': return this.execVarDeclare(node)
      case 'cpp_scanf_expr': return this.execCppScanf(node)
      default: return // 未知概念靜默略過
    }
  }

  private async countStep(): Promise<void> {
    if (this.aborted) {
      throw new RuntimeError(RUNTIME_ERRORS.ABORTED)
    }
    this.steps++
    if (this.steps > this.maxSteps) {
      throw new RuntimeError(RUNTIME_ERRORS.MAX_STEPS_EXCEEDED)
    }
    // Yield to event loop periodically to allow abort signals (Ctrl+C)
    if (this.steps % 10000 === 0) {
      await new Promise<void>(r => setTimeout(r, 0))
    }
  }

  // --- 基礎概念 (T016) ---

  private async execProgram(node: SemanticNode): Promise<void> {
    const body = node.children.body ?? []
    await this.executeBody(body)
    // C/C++ 慣例：若定義了 main 函式，自動呼叫
    if (this.functions.has('main')) {
      await this.execFuncCall(createNode('func_call', { name: 'main' }, { args: [] }))
    }
  }

  private async executeBody(nodes: SemanticNode[]): Promise<void> {
    for (const child of nodes) {
      await this.executeNode(child)
      await this.recordStepInfo(child)
    }
  }

  private async recordStepInfo(node: SemanticNode): Promise<void> {
    if (!this.recordSteps) return
    // Only record for statement-level concepts
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

    // Snapshot scope variables (exclude built-in constants)
    const BUILTIN_NAMES = new Set(['EOF', 'true', 'false', 'NULL', 'nullptr', 'INT_MAX', 'INT_MIN', 'LLONG_MAX', 'LLONG_MIN', 'SIZE_MAX'])
    const scopeSnapshot: { name: string; type: string; value: string }[] = []
    for (const [name, val] of this.scope.getAll()) {
      if (BUILTIN_NAMES.has(name)) continue
      scopeSnapshot.push({ name, type: val.type, value: valueToString(val) })
    }

    const step: StepInfo = {
      node,
      blockId: node.metadata?.blockId ?? null,
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

  private execNumberLiteral(node: SemanticNode): RuntimeValue {
    const raw = String(node.properties.value)
    const num = Number(raw)
    if (raw.includes('.')) {
      return { type: 'double', value: num }
    }
    return { type: 'int', value: Math.trunc(num) }
  }

  private execStringLiteral(node: SemanticNode): RuntimeValue {
    return { type: 'string', value: unescapeC(String(node.properties.value)) }
  }

  private async execVarDeclare(node: SemanticNode): Promise<void> {
    // Multi-variable declaration: int a, b, c;
    const declarators = node.children.declarators
    if (declarators && declarators.length > 0) {
      for (const decl of declarators) {
        await this.execVarDeclare(decl)
      }
      return
    }

    const name = String(node.properties.name)
    const type = String(node.properties.type || 'int')
    let val: RuntimeValue

    const init = node.children.initializer
    if (init && init.length > 0) {
      val = await this.evaluate(init[0])
      // 型別轉換
      val = this.coerceType(val, type)
    } else {
      val = defaultValue(type)
    }

    this.scope.declare(name, val)
  }

  private async execVarAssign(node: SemanticNode): Promise<void> {
    const name = String(node.properties.name)
    const valueNodes = node.children.value
    if (!valueNodes || valueNodes.length === 0) return
    const val = await this.evaluate(valueNodes[0])
    this.scope.set(name, val)
  }

  private execVarRef(node: SemanticNode): RuntimeValue {
    const name = String(node.properties.name)
    return this.scope.get(name)
  }

  private execBuiltinConstant(node: SemanticNode): RuntimeValue {
    const value = String(node.properties.value)
    switch (value) {
      case 'true': return { type: 'int', value: 1 }
      case 'false': return { type: 'int', value: 0 }
      case 'EOF': return { type: 'int', value: -1 }
      case 'NULL': case 'nullptr': return { type: 'int', value: 0 }
      case 'INT_MAX': return { type: 'int', value: 2147483647 }
      case 'INT_MIN': return { type: 'int', value: -2147483648 }
      case 'LLONG_MAX': return { type: 'int', value: Number.MAX_SAFE_INTEGER }
      case 'LLONG_MIN': return { type: 'int', value: Number.MIN_SAFE_INTEGER }
      default: return { type: 'int', value: 0 }
    }
  }

  // --- 運算概念 (T017) ---

  private async execArithmetic(node: SemanticNode): Promise<RuntimeValue> {
    const op = String(node.properties.operator)
    const left = await this.evaluate(node.children.left[0])
    const right = await this.evaluate(node.children.right[0])

    const lv = this.toNumber(left)
    const rv = this.toNumber(right)

    let result: number
    switch (op) {
      case '+': result = lv + rv; break
      case '-': result = lv - rv; break
      case '*': result = lv * rv; break
      case '/':
        if (rv === 0) throw new RuntimeError(RUNTIME_ERRORS.DIVISION_BY_ZERO)
        result = lv / rv
        break
      case '%':
        if (rv === 0) throw new RuntimeError(RUNTIME_ERRORS.DIVISION_BY_ZERO)
        result = lv % rv
        break
      // Bitwise operators
      case '&': result = lv & rv; break
      case '|': result = lv | rv; break
      case '^': result = lv ^ rv; break
      case '<<': result = lv << rv; break
      case '>>': result = lv >> rv; break
      default: result = 0
    }

    // 若兩邊都是整數，結果也為整數（整數截斷）
    if (left.type === 'int' && right.type === 'int') {
      return { type: 'int', value: Math.trunc(result) }
    }
    return { type: 'double', value: result }
  }

  private async execCompare(node: SemanticNode): Promise<RuntimeValue> {
    const op = String(node.properties.operator)
    const left = await this.evaluate(node.children.left[0])
    const right = await this.evaluate(node.children.right[0])

    const lv = this.toNumber(left)
    const rv = this.toNumber(right)

    let result: boolean
    switch (op) {
      case '<': result = lv < rv; break
      case '>': result = lv > rv; break
      case '<=': result = lv <= rv; break
      case '>=': result = lv >= rv; break
      case '==': result = lv === rv; break
      case '!=': result = lv !== rv; break
      default: result = false
    }

    return { type: 'bool', value: result }
  }

  private async execLogic(node: SemanticNode): Promise<RuntimeValue> {
    const op = String(node.properties.operator)
    const left = await this.evaluate(node.children.left[0])

    if (op === '&&') {
      if (!this.toBool(left)) return { type: 'bool', value: false }
      const right = await this.evaluate(node.children.right[0])
      return { type: 'bool', value: this.toBool(right) }
    }
    if (op === '||') {
      if (this.toBool(left)) return { type: 'bool', value: true }
      const right = await this.evaluate(node.children.right[0])
      return { type: 'bool', value: this.toBool(right) }
    }

    return { type: 'bool', value: false }
  }

  private async execLogicNot(node: SemanticNode): Promise<RuntimeValue> {
    const operand = await this.evaluate(node.children.operand[0])
    return { type: 'bool', value: !this.toBool(operand) }
  }

  // --- 遞增遞減 / 負數 / 複合賦值 ---

  private async execIncrement(node: SemanticNode): Promise<RuntimeValue> {
    const name = String(node.properties.name)
    const op = String(node.properties.operator)
    const position = String(node.properties.position ?? 'postfix')

    // Array element increment: arr[i]++ / --arr[i]
    const indexNodes = node.children.index ?? []
    if (indexNodes.length > 0) {
      const arr = this.scope.get(name)
      if (arr.type !== 'array' || !Array.isArray(arr.value)) {
        throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
      }
      const indexVal = await this.evaluate(indexNodes[0])
      const index = this.toNumber(indexVal)
      if (index >= 0 && index < arr.value.length) {
        const current = arr.value[index]
        const val = this.toNumber(current)
        const newVal = op === '++' ? val + 1 : val - 1
        const newRv: RuntimeValue = current.type === 'int'
          ? { type: 'int', value: Math.trunc(newVal) }
          : { type: 'double', value: newVal }
        const oldRv: RuntimeValue = { ...current }
        arr.value[index] = newRv
        return position === 'prefix' ? newRv : oldRv
      }
      return { type: 'int', value: 0 }
    }

    const current = this.scope.get(name)
    const val = this.toNumber(current)
    const newVal = op === '++' ? val + 1 : val - 1
    const newRv: RuntimeValue = current.type === 'int'
      ? { type: 'int', value: Math.trunc(newVal) }
      : { type: 'double', value: newVal }
    const oldRv: RuntimeValue = { type: current.type as any, value: val }
    this.scope.set(name, newRv)
    return position === 'prefix' ? newRv : oldRv
  }

  private async execNegate(node: SemanticNode): Promise<RuntimeValue> {
    const operand = await this.evaluate(node.children.value[0])
    const val = this.toNumber(operand)
    return operand.type === 'int'
      ? { type: 'int', value: -Math.trunc(val) }
      : { type: 'double', value: -val }
  }

  private async execBitwiseNot(node: SemanticNode): Promise<RuntimeValue> {
    const operand = await this.evaluate(node.children.operand[0])
    const val = this.toNumber(operand)
    return { type: 'int', value: ~Math.trunc(val) }
  }

  private async execCompoundAssign(node: SemanticNode): Promise<void> {
    const name = String(node.properties.name)
    const op = String(node.properties.operator)
    const rhs = await this.evaluate(node.children.value[0])
    const rv = this.toNumber(rhs)

    // Array element compound assign: arr[i] += value
    const indexNodes = node.children.index ?? []
    if (indexNodes.length > 0) {
      const arr = this.scope.get(name)
      if (arr.type !== 'array' || !Array.isArray(arr.value)) {
        throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
      }
      const indexVal = await this.evaluate(indexNodes[0])
      const index = this.toNumber(indexVal)
      if (index >= 0 && index < arr.value.length) {
        const current = arr.value[index]
        const result = this.computeCompound(op, this.toNumber(current), rv)
        arr.value[index] = current.type === 'int' && rhs.type === 'int'
          ? { type: 'int', value: Math.trunc(result) }
          : { type: 'double', value: result }
      }
      return
    }

    const current = this.scope.get(name)
    const lv = this.toNumber(current)
    const result = this.computeCompound(op, lv, rv)
    if (current.type === 'int' && rhs.type === 'int') {
      this.scope.set(name, { type: 'int', value: Math.trunc(result) })
    } else {
      this.scope.set(name, { type: 'double', value: result })
    }
  }

  private computeCompound(op: string, lv: number, rv: number): number {
    switch (op) {
      case '+=': return lv + rv
      case '-=': return lv - rv
      case '*=': return lv * rv
      case '/=':
        if (rv === 0) throw new RuntimeError(RUNTIME_ERRORS.DIVISION_BY_ZERO)
        return lv / rv
      case '%=':
        if (rv === 0) throw new RuntimeError(RUNTIME_ERRORS.DIVISION_BY_ZERO)
        return lv % rv
      case '&=': return lv & rv
      case '|=': return lv | rv
      case '^=': return lv ^ rv
      case '<<=': return lv << rv
      case '>>=': return lv >> rv
      default: return lv
    }
  }

  // --- 流程控制 (T018) ---

  private async execIf(node: SemanticNode): Promise<void> {
    const condition = await this.evaluate(node.children.condition[0])

    if (this.toBool(condition)) {
      await this.executeBody(node.children.then_body ?? [])
    } else {
      await this.executeBody(node.children.else_body ?? [])
    }
  }

  private async execCountLoop(node: SemanticNode): Promise<void> {
    const varName = String(node.properties.var_name)
    const from = this.toNumber(await this.evaluate(node.children.from[0]))
    const to = this.toNumber(await this.evaluate(node.children.to[0]))
    const body = node.children.body ?? []

    const parentScope = this.scope
    const inclusive = node.properties.inclusive === 'TRUE'
    for (let i = from; inclusive ? i <= to : i < to; i++) {
      // 每次迭代建立新子 scope（避免 body 中 var_declare 重複宣告）
      this.scope = parentScope.createChild()
      this.scope.declare(varName, { type: 'int', value: i })
      try {
        await this.executeBody(body)
      } catch (signal) {
        if (signal instanceof BreakSignal) break
        if (signal instanceof ContinueSignal) continue
        this.scope = parentScope
        throw signal
      }
    }
    this.scope = parentScope
  }

  private async execForLoop(node: SemanticNode): Promise<void> {
    const body = node.children.body ?? []
    const parentScope = this.scope
    const forScope = parentScope.createChild()
    this.scope = forScope

    // Execute init (in for-scope, so loop var persists across iterations)
    if (node.children.init && node.children.init.length > 0) {
      await this.executeNode(node.children.init[0])
    }

    while (true) {
      // Check condition (in for-scope)
      if (node.children.cond && node.children.cond.length > 0) {
        const condition = await this.evaluate(node.children.cond[0])
        if (!this.toBool(condition)) break
      }

      // 每次迭代建立新子 scope（避免 body 中 var_declare 重複宣告）
      this.scope = forScope.createChild()
      try {
        await this.executeBody(body)
      } catch (signal) {
        if (signal instanceof BreakSignal) { this.scope = forScope; break }
        if (signal instanceof ContinueSignal) {
          // fall through to update
        } else {
          this.scope = parentScope
          throw signal
        }
      }
      this.scope = forScope

      // Execute update
      if (node.children.update && node.children.update.length > 0) {
        await this.executeNode(node.children.update[0])
      }
    }
    this.scope = parentScope
  }

  private async execWhileLoop(node: SemanticNode): Promise<void> {
    const body = node.children.body ?? []

    // 建立子 scope，每次迭代內的宣告不會外洩
    const parentScope = this.scope
    while (true) {
      this.scope = parentScope.createChild()
      const condition = await this.evaluate(node.children.condition[0])
      if (!this.toBool(condition)) break

      try {
        await this.executeBody(body)
      } catch (signal) {
        if (signal instanceof BreakSignal) break
        if (signal instanceof ContinueSignal) continue
        this.scope = parentScope
        throw signal
      }
    }
    this.scope = parentScope
  }

  private async execDoWhile(node: SemanticNode): Promise<void> {
    const body = node.children.body ?? []
    const condNodes = node.children.cond ?? []

    const parentScope = this.scope
    do {
      this.scope = parentScope.createChild()
      try {
        await this.executeBody(body)
      } catch (signal) {
        if (signal instanceof BreakSignal) { this.scope = parentScope; return }
        if (signal instanceof ContinueSignal) { /* fall through to condition check */ }
        else { this.scope = parentScope; throw signal }
      }
      // Evaluate condition in the current iteration scope
      if (condNodes.length === 0) break
    } while (this.toBool(await this.evaluate(condNodes[0])))
    this.scope = parentScope
  }

  private async execSwitch(node: SemanticNode): Promise<void> {
    const exprNodes = node.children.expr ?? []
    if (exprNodes.length === 0) return
    const switchVal = await this.evaluate(exprNodes[0])

    const cases = node.children.cases ?? []
    let matched = false

    for (const caseNode of cases) {
      if (!matched) {
        // Check if this case matches (or is default)
        const isDefault = caseNode.concept === 'cpp_default'
        if (!isDefault) {
          const caseValNodes = caseNode.children.value ?? []
          if (caseValNodes.length > 0) {
            const caseVal = await this.evaluate(caseValNodes[0])
            if (this.toNumber(switchVal) !== this.toNumber(caseVal)) continue
          }
        }
        matched = true
      }

      // Execute case body (fall-through until break)
      const caseBody = caseNode.children.body ?? []
      try {
        await this.executeBody(caseBody)
      } catch (signal) {
        if (signal instanceof BreakSignal) return
        throw signal
      }
    }
  }

  private async execTernary(node: SemanticNode): Promise<RuntimeValue> {
    const condNodes = node.children.condition ?? []
    const trueNodes = node.children.true_expr ?? []
    const falseNodes = node.children.false_expr ?? []
    if (condNodes.length === 0) return { type: 'int', value: 0 }

    const condition = await this.evaluate(condNodes[0])
    if (this.toBool(condition)) {
      return trueNodes.length > 0 ? await this.evaluate(trueNodes[0]) : { type: 'int', value: 0 }
    } else {
      return falseNodes.length > 0 ? await this.evaluate(falseNodes[0]) : { type: 'int', value: 0 }
    }
  }

  private async execAddressOf(node: SemanticNode): Promise<RuntimeValue> {
    const varNodes = node.children.var ?? []
    if (varNodes.length > 0) {
      const varName = String(varNodes[0].properties.name ?? '')
      if (varName) {
        // Store pointer as string target name; track the scope
        this.pointerTargets.set(varName, this.scope.findOwner(varName) ?? this.scope)
        return { type: 'pointer' as any, value: varName }
      }
    }
    return { type: 'int', value: 0 }
  }

  private async execPointerDeref(node: SemanticNode): Promise<RuntimeValue> {
    const ptrNodes = node.children.ptr ?? []
    if (ptrNodes.length > 0) {
      const ptrVal = await this.evaluate(ptrNodes[0])
      if (ptrVal.type === ('pointer' as any) && typeof ptrVal.value === 'string') {
        const targetName = ptrVal.value
        const targetScope = this.pointerTargets.get(targetName)
        if (targetScope) return targetScope.get(targetName)
        return this.scope.get(targetName)
      }
    }
    return { type: 'int', value: 0 }
  }

  private async execPointerAssign(node: SemanticNode): Promise<void> {
    const ptrName = String(node.properties.ptr_name)
    const valueNodes = node.children.value ?? []
    if (valueNodes.length === 0) return
    const val = await this.evaluate(valueNodes[0])
    // Get the pointer value to find the target variable name
    const ptrVal = this.scope.get(ptrName)
    if (ptrVal.type === ('pointer' as any) && typeof ptrVal.value === 'string') {
      const targetName = ptrVal.value as string
      const targetScope = this.pointerTargets.get(targetName)
      if (targetScope) { targetScope.set(targetName, val); return }
      this.scope.set(targetName, val)
    }
  }

  private async execCommaExpr(node: SemanticNode): Promise<RuntimeValue> {
    const exprs = node.children.exprs ?? []
    let last: RuntimeValue = { type: 'int', value: 0 }
    for (const expr of exprs) {
      last = (await this.executeNode(expr)) as RuntimeValue ?? last
    }
    return last
  }

  private async execCast(node: SemanticNode): Promise<RuntimeValue> {
    const targetType = String(node.properties.target_type ?? 'int')
    const valueNodes = node.children.value ?? []
    if (valueNodes.length === 0) return { type: 'int', value: 0 }
    const val = await this.evaluate(valueNodes[0])
    const num = this.toNumber(val)
    if (targetType === 'int' || targetType === 'long' || targetType === 'short' || targetType === 'char') {
      return { type: 'int', value: Math.trunc(num) }
    }
    if (targetType === 'double' || targetType === 'float') {
      return { type: 'double', value: num }
    }
    return val
  }

  // --- 函式概念 (T019) ---

  private execFuncDef(node: SemanticNode): void {
    const name = String(node.properties.name)
    const returnType = String(node.properties.return_type || 'void')
    // Prefer structured param_decl children, fallback to legacy string[] properties
    const paramChildren = node.children.params ?? []
    let params: { type: string; name: string }[] = []
    if (paramChildren.length > 0) {
      params = paramChildren.map(p => ({
        type: String(p.properties.type ?? 'int'),
        name: String(p.properties.name ?? ''),
      }))
    } else {
      const rawParams = node.properties.params
      if (Array.isArray(rawParams)) {
        // Legacy params from blockly-panel: ["int x", "float y", "int arr[]", "int& ref", ...]
        params = rawParams.map((p: unknown) => {
          const s = String(p)
          const spaceIdx = s.indexOf(' ')
          if (spaceIdx < 0) return { type: 'int', name: s }
          let type = s.slice(0, spaceIdx)
          let name = s.slice(spaceIdx + 1).replace(/\[\]$/, '')
          if (name.startsWith('&')) {
            type = type + '&'
            name = name.slice(1)
          }
          return { type, name }
        })
      } else if (typeof rawParams === 'string' && rawParams.startsWith('[')) {
        try { params = JSON.parse(rawParams) } catch { params = [] }
      }
    }
    this.functions.set(name, {
      name,
      params,
      returnType,
      body: node.children.body ?? [],
    })
  }

  private async execFuncCall(node: SemanticNode): Promise<RuntimeValue> {
    const name = String(node.properties.name)
    const funcDef = this.functions.get(name)
    if (!funcDef) {
      throw new RuntimeError(RUNTIME_ERRORS.UNDEFINED_FUNCTION, { '%1': name })
    }

    const args = node.children.args ?? []
    const argValues: RuntimeValue[] = []
    for (const argNode of args) {
      argValues.push(await this.evaluate(argNode))
    }

    // 建立函式作用域
    const parentScope = this.scope
    this.scope = new Scope(parentScope)

    // 綁定參數
    for (let i = 0; i < funcDef.params.length; i++) {
      const param = funcDef.params[i]
      const isRef = param.type.includes('&')

      if (isRef && i < args.length) {
        // Reference parameter: create alias to caller's variable
        const argNode = args[i]
        const argVarName = String(argNode.properties.name ?? '')
        if (argVarName) {
          const ownerScope = parentScope.findOwner(argVarName)
          if (ownerScope) {
            this.scope.declareRef(param.name, ownerScope, argVarName)
            continue
          }
        }
      }

      const val = i < argValues.length ? argValues[i] : defaultValue(param.type.replace('&', '').replace('[]', ''))
      this.scope.declare(param.name, val)
    }

    let returnValue: RuntimeValue = defaultValue(funcDef.returnType)

    try {
      await this.executeBody(funcDef.body)
    } catch (signal) {
      if (signal instanceof ReturnSignal) {
        returnValue = signal.value
      } else {
        this.scope = parentScope
        throw signal
      }
    }

    this.scope = parentScope
    return returnValue
  }

  private async execReturn(node: SemanticNode): Promise<void> {
    const valueNodes = node.children.value
    if (valueNodes && valueNodes.length > 0) {
      const val = await this.evaluate(valueNodes[0])
      throw new ReturnSignal(val)
    }
    throw new ReturnSignal(defaultValue('void'))
  }

  // --- I/O 和陣列 (T020) ---

  private async execPrint(node: SemanticNode): Promise<void> {
    const values = node.children.values ?? []

    for (const valNode of values) {
      const val = await this.evaluate(valNode)
      if (val.type === 'string' && val.value === '\n') {
        this.io.writeNewline()
      } else {
        this.io.write(valueToString(val))
      }
    }
  }

  private async execInput(node: SemanticNode): Promise<RuntimeValue> {
    // Modern format: children.values contains var_ref or array_access nodes
    const valueNodes = node.children.values ?? []
    if (valueNodes.length > 0) {
      let lastVal: RuntimeValue = { type: 'int', value: 0 }
      let itemsRead = 0
      for (const varRefNode of valueNodes) {
        if (varRefNode.concept === 'array_access') {
          // Input to array element: cin >> arr[i]
          const arrName = String(varRefNode.properties.name)
          const arr = this.scope.get(arrName)
          if (arr.type !== 'array' || !Array.isArray(arr.value)) {
            throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
          }
          const indexVal = await this.evaluate((varRefNode.children.index ?? [])[0])
          const index = this.toNumber(indexVal)
          // Determine element type from existing array elements
          const elemType = arr.value.length > 0 ? arr.value[0].type : 'int'
          let raw = this.readCinToken()
          if (raw === null && this.inputProvider) {
            const line = await this.awaitInput()
            if (line !== null) {
              const tokens = line.trim().split(/\s+/).filter(t => t.length > 0)
              this.scanfTokenBuffer.push(...tokens)
              raw = this.readCinToken()
            }
          }
          if (raw === null) {
            // EOF: cin >> x returns falsy (0) on EOF
            return { type: 'int', value: 0 }
          }
          lastVal = parseInputValue(raw, elemType) ?? defaultValue(elemType)
          itemsRead++
          if (index >= 0 && index < arr.value.length) {
            arr.value[index] = lastVal
          }
          continue
        }

        const varName = String(varRefNode.properties.name ?? 'x')
        let targetType = 'string'
        try {
          const existing = this.scope.get(varName)
          targetType = existing.type
        } catch { /* variable might not exist yet */ }

        let raw = this.readCinToken()
        if (raw === null && this.inputProvider) {
          const line = await this.awaitInput()
          if (line !== null) {
            const tokens = line.trim().split(/\s+/).filter(t => t.length > 0)
            this.scanfTokenBuffer.push(...tokens)
            raw = this.readCinToken()
          }
        }
        if (raw === null) {
          // EOF: cin >> x returns falsy (0) on EOF
          return { type: 'int', value: 0 }
        }
        lastVal = parseInputValue(raw, targetType) ?? defaultValue(targetType)
        itemsRead++
        this.scope.set(varName, lastVal)
      }
      return { type: 'int', value: itemsRead }
    }

    // Legacy fallback: properties.variable (single variable)
    const targetVar = node.properties.variable ? String(node.properties.variable) : null
    let targetType = String(node.properties.type || 'string')

    if (targetVar) {
      try {
        const existing = this.scope.get(targetVar)
        targetType = existing.type
      } catch { /* variable might not exist yet */ }
    }

    let raw = this.io.read()
    if (raw === null && this.inputProvider) {
      raw = await this.awaitInput()
    }
    if (raw === null) {
      return { type: 'int', value: 0 }  // EOF: falsy
    }
    const val = parseInputValue(raw, targetType) ?? defaultValue(targetType)

    if (targetVar) {
      this.scope.set(targetVar, val)
    }

    return val
  }

  /** printf("format", args...) — parse format string, evaluate args, output formatted text */
  private async execCppPrintf(node: SemanticNode): Promise<void> {
    const format = String(node.properties.format ?? '')
    const argNodes = node.children.args ?? []

    // Evaluate all argument expressions
    const argValues: RuntimeValue[] = []
    for (const argNode of argNodes) {
      argValues.push(await this.evaluate(argNode))
    }

    // Parse format string and substitute arguments
    const output = formatPrintf(format, argValues)
    this.io.write(output)
  }

  /** scanf("format", &vars...) — read input tokens and assign to variables */
  private async execCppScanf(node: SemanticNode): Promise<RuntimeValue> {
    const format = String(node.properties.format ?? '%d')
    const argNodes = node.children.args ?? []

    // Extract format specifiers to determine types
    const specifiers = format.match(/%[^%]*?[diouxXeEfgGcsplnDOUaA]/g) ?? []

    let itemsRead = 0
    for (let i = 0; i < argNodes.length; i++) {
      const argNode = argNodes[i]
      const spec = specifiers[i] ?? '%d'

      // Determine target type from format specifier
      let targetType = 'int'
      if (/[fFeEgGaA]/.test(spec)) targetType = 'double'
      else if (/[cs]/.test(spec)) targetType = spec.includes('c') ? 'char' : 'string'

      // Read next token (scanf splits by whitespace)
      let raw = this.readScanfToken()
      if (raw === null && this.inputProvider) {
        const line = await this.awaitInput()
        if (line !== null) {
          const tokens = line.trim().split(/\s+/).filter(t => t.length > 0)
          this.scanfTokenBuffer.push(...tokens)
          raw = this.readScanfToken()
        }
      }
      if (raw === null) {
        // EOF: return -1 if no items read, otherwise return count so far
        return { type: 'int', value: itemsRead === 0 ? -1 : itemsRead }
      }
      const lastVal = parseInputValue(raw, targetType) ?? defaultValue(targetType)
      itemsRead++

      // Assign to array element or simple variable
      if (argNode.concept === 'array_access') {
        const arrName = String(argNode.properties.name)
        const arr = this.scope.get(arrName)
        if (arr.type === 'array' && Array.isArray(arr.value)) {
          const indexVal = await this.evaluate((argNode.children.index ?? [])[0])
          const index = this.toNumber(indexVal)
          if (index >= 0 && index < arr.value.length) {
            arr.value[index] = lastVal
          }
        }
      } else {
        const varName = String(argNode.properties.name ?? 'x')
        // Refine target type from existing variable declaration
        if (targetType === 'int') {
          try { const existing = this.scope.get(varName); targetType = existing.type } catch { /* default int */ }
          const refinedVal = parseInputValue(raw!, targetType) ?? defaultValue(targetType)
          this.scope.set(varName, refinedVal)
        } else {
          this.scope.set(varName, lastVal)
        }
      }
    }

    // Return number of items successfully read (like real scanf)
    return { type: 'int', value: itemsRead }
  }

  /** Read a single whitespace-delimited token for cin >>. Shares buffer with scanf. */
  private readCinToken(): string | null {
    // Return buffered token if available
    if (this.scanfTokenBuffer.length > 0) {
      return this.scanfTokenBuffer.shift()!
    }
    // Read next line from IO and split into tokens
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
  private readScanfToken(): string | null {
    // Return buffered token if available
    if (this.scanfTokenBuffer.length > 0) {
      return this.scanfTokenBuffer.shift()!
    }
    // Read next line from IO and split into tokens
    const line = this.io.read()
    if (line === null) return null
    const tokens = line.trim().split(/\s+/).filter(t => t.length > 0)
    if (tokens.length === 0) return null
    if (tokens.length > 1) {
      this.scanfTokenBuffer.push(...tokens.slice(1))
    }
    return tokens[0]
  }

  private async execArrayDeclare(node: SemanticNode): Promise<void> {
    const name = String(node.properties.name)
    const type = String(node.properties.type || 'int')

    // Size can be a child expression node (new) or a legacy property (old)
    const sizeChildren = node.children.size ?? []
    let size: number
    if (sizeChildren.length > 0) {
      const sizeVal = await this.evaluate(sizeChildren[0])
      size = this.toNumber(sizeVal)
    } else {
      const sizeRaw = node.properties.size
      size = Number(sizeRaw || 0)
      // VLA support: if size is a variable name (not a number), resolve it
      if (isNaN(size) && typeof sizeRaw === 'string') {
        try {
          const sizeVal = this.scope.get(sizeRaw)
          size = this.toNumber(sizeVal)
        } catch {
          size = 0
        }
      }
    }

    const elements: RuntimeValue[] = []
    for (let i = 0; i < size; i++) {
      elements.push(defaultValue(type))
    }

    this.scope.declare(name, { type: 'array', value: elements })
  }

  private async execArrayAccess(node: SemanticNode): Promise<RuntimeValue> {
    const name = String(node.properties.name)
    const indexNodes = node.children.index
    if (!indexNodes || indexNodes.length === 0) {
      return defaultValue('int')
    }

    const indexVal = await this.evaluate(indexNodes[0])
    const index = this.toNumber(indexVal)
    const arr = this.scope.get(name)

    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
    }

    if (index < 0 || index >= arr.value.length) {
      throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(index) })
    }

    return arr.value[index]
  }

  private async execArrayAssign(node: SemanticNode): Promise<void> {
    const name = String(node.properties.name)
    const indexNodes = node.children.index
    const valueNodes = node.children.value
    if (!indexNodes || indexNodes.length === 0 || !valueNodes || valueNodes.length === 0) return

    const indexVal = await this.evaluate(indexNodes[0])
    const index = this.toNumber(indexVal)
    const val = await this.evaluate(valueNodes[0])
    const arr = this.scope.get(name)

    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
    }

    if (index < 0 || index >= arr.value.length) {
      throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(index) })
    }

    arr.value[index] = val
  }

  // --- 輔助方法 ---

  private async evaluate(node: SemanticNode): Promise<RuntimeValue> {
    const result = await this.executeNode(node)
    if (result && typeof result === 'object' && 'type' in result) {
      return result as RuntimeValue
    }
    return defaultValue('void')
  }

  private toNumber(val: RuntimeValue): number {
    if (typeof val.value === 'number') return val.value
    if (typeof val.value === 'boolean') return val.value ? 1 : 0
    if (typeof val.value === 'string') return Number(val.value) || 0
    return 0
  }

  private toBool(val: RuntimeValue): boolean {
    if (typeof val.value === 'boolean') return val.value
    if (typeof val.value === 'number') return val.value !== 0
    if (typeof val.value === 'string') return val.value.length > 0
    return false
  }

  private coerceType(val: RuntimeValue, targetType: string): RuntimeValue {
    if (val.type === targetType) return val
    switch (targetType) {
      case 'int': return { type: 'int', value: Math.trunc(this.toNumber(val)) }
      case 'float':
      case 'double': return { type: targetType as RuntimeType, value: this.toNumber(val) }
      case 'bool': return { type: 'bool', value: this.toBool(val) }
      case 'string': return { type: 'string', value: valueToString(val) }
      case 'char': return { type: 'char', value: valueToString(val).charAt(0) || '' }
      default: return val
    }
  }
}

/** Format a printf-style string with runtime values */
function formatPrintf(format: string, args: RuntimeValue[]): string {
  let argIdx = 0
  // Process escape sequences first
  let result = format.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\')

  // Replace format specifiers with argument values
  result = result.replace(/%([0-9]*\.?[0-9]*)?[diouxXeEfgGcsplnDOUaA%]/g, (match) => {
    if (match === '%%') return '%'
    if (argIdx >= args.length) return match

    const val = args[argIdx++]
    const numVal = typeof val.value === 'number' ? val.value : parseFloat(String(val.value))

    // Check for precision/width specifier like %.2f, %04d
    const precMatch = match.match(/^%([0-9]*)\.?([0-9]*)([a-zA-Z])$/)
    const specChar = precMatch ? precMatch[3] : match.charAt(match.length - 1)
    const precision = precMatch?.[2] ? parseInt(precMatch[2]) : undefined

    switch (specChar) {
      case 'd':
      case 'i':
      case 'l':
        return String(Math.trunc(isNaN(numVal) ? 0 : numVal))
      case 'f':
      case 'F':
        return (isNaN(numVal) ? 0 : numVal).toFixed(precision ?? 6)
      case 'e':
      case 'E':
        return (isNaN(numVal) ? 0 : numVal).toExponential(precision ?? 6)
      case 'g':
      case 'G':
        return (isNaN(numVal) ? 0 : numVal).toPrecision(precision ?? 6)
      case 'c':
        return typeof val.value === 'string' ? val.value.charAt(0) : String.fromCharCode(numVal)
      case 's':
        return valueToString(val)
      case 'x':
        return Math.trunc(isNaN(numVal) ? 0 : numVal).toString(16)
      case 'X':
        return Math.trunc(isNaN(numVal) ? 0 : numVal).toString(16).toUpperCase()
      case 'o':
        return Math.trunc(isNaN(numVal) ? 0 : numVal).toString(8)
      default:
        return valueToString(val)
    }
  })

  return result
}
