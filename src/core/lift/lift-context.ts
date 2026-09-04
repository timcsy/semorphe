import type { Declaration, ScopeFrame } from '../types'

/**
 * LiftContext tracks scope, declarations, and context info during AST → SemanticNode lifting.
 * Supports variable shadowing via scope stack and provides type lookup for disambiguation.
 */
export class LiftContextData {
  private scopeStack: ScopeFrame[] = [{ level: 0, declarations: [] }]
  private usingDirectives: string[] = []
  private includes: string[] = []
  private macroDefinitions: string[] = []
  /**
   * **這支程式自己定義了哪些函式。**
   *
   * 🔴 它存在的理由是一個真缺陷（2026-09-04）：`swap(&x, &y)` 被 lift 成
   * 內建的 `cpp:var_swap`（`std::swap`），**而那支程式自己定義了 `swap`**。
   *
   * ```
   * void swap(int *a, int *b) { … }   ← 使用者寫的
   * swap(&x, &y);                     → cpp:var_swap（內建的那一顆）
   * 執行                              → 「這個東西不能被指定值」
   * ```
   *
   * 症狀不是「找不到函式」，是一個**看起來與指標有關的執行期錯誤**
   * ——而真正的原因是他的函式從頭到尾沒有被呼叫過。
   *
   * > **一個名字樣式如果不看「這個名字在這支程式裡有沒有被使用者自己定義」，
   * > 它就會把使用者的函式偷換成內建的那一顆。**
   *
   * ⚠️ 這是**路由器層級**的知識（名字的解析順序），不是任何一顆元件的
   * ——所以擋在 `tryCallBranches`，不是在每一個分支裡各寫一次。
   */
  private functionNames = new Set<string>()

  /** Push a new scope frame (entering a block, function, etc.) */
  pushScope(): void {
    const level = this.scopeStack.length
    this.scopeStack.push({ level, declarations: [] })
  }

  /** Pop the current scope frame */
  popScope(): void {
    if (this.scopeStack.length > 1) {
      this.scopeStack.pop()
    }
  }

  /** Get current scope depth */
  getScopeDepth(): number {
    return this.scopeStack.length - 1
  }

  /** 這支程式定義了一個叫這個名字的函式。⚠️ 原型與定義都算。 */
  declareFunction(name: string): void {
    if (name !== '') this.functionNames.add(name)
  }

  /** 使用者自己定義過這個名字嗎。 */
  hasFunction(name: string): boolean {
    return this.functionNames.has(name)
  }

  /** Declare a variable in the current scope */
  declare(name: string, type: string): void {
    const frame = this.scopeStack[this.scopeStack.length - 1]
    frame.declarations.push({ name, type, scope: frame.level })
  }

  /** Look up a variable by name, respecting shadowing (innermost scope first) */
  lookup(name: string): Declaration | null {
    for (let i = this.scopeStack.length - 1; i >= 0; i--) {
      const frame = this.scopeStack[i]
      const decl = frame.declarations.find(d => d.name === name)
      if (decl) return decl
    }
    return null
  }

  /** Get all visible declarations (for var_ref dropdown, etc.) */
  getVisibleDeclarations(): Declaration[] {
    const seen = new Set<string>()
    const result: Declaration[] = []
    for (let i = this.scopeStack.length - 1; i >= 0; i--) {
      for (const decl of this.scopeStack[i].declarations) {
        if (!seen.has(decl.name)) {
          seen.add(decl.name)
          result.push(decl)
        }
      }
    }
    return result
  }

  /** Add a using directive (e.g., "using namespace std") */
  addUsingDirective(directive: string): void {
    if (!this.usingDirectives.includes(directive)) {
      this.usingDirectives.push(directive)
    }
  }

  /** Add an include (e.g., "#include <iostream>") */
  addInclude(header: string): void {
    if (!this.includes.includes(header)) {
      this.includes.push(header)
    }
  }

  /** Add a macro definition (e.g., "#define MAX 100") */
  addMacroDefinition(macro: string): void {
    if (!this.macroDefinitions.includes(macro)) {
      this.macroDefinitions.push(macro)
    }
  }

  getUsingDirectives(): string[] {
    return [...this.usingDirectives]
  }

  getIncludes(): string[] {
    return [...this.includes]
  }

  getMacroDefinitions(): string[] {
    return [...this.macroDefinitions]
  }

  /** Check if a name resolves to a known type */
  isKnownType(name: string): boolean {
    return this.lookup(name) !== null
  }

  /** Get the type of a declared variable */
  getType(name: string): string | null {
    const decl = this.lookup(name)
    return decl?.type ?? null
  }
}
