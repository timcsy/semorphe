import type { RuntimeValue } from './types'
import { RuntimeError, RUNTIME_ERRORS } from './errors'

export class Scope {
  private variables = new Map<string, RuntimeValue>()
  private refs = new Map<string, { scope: Scope, name: string }>()
  readonly parent: Scope | null

  constructor(parent: Scope | null = null) {
    this.parent = parent
  }

  declare(name: string, value: RuntimeValue): void {
    if (this.variables.has(name)) {
      throw new RuntimeError(RUNTIME_ERRORS.DUPLICATE_DECLARATION, { '%1': name })
    }
    this.variables.set(name, value)
  }

  /** Declare a reference alias: reads/writes to `name` delegate to `target` in `targetScope` */
  declareRef(name: string, targetScope: Scope, targetName: string): void {
    this.refs.set(name, { scope: targetScope, name: targetName })
  }

  get(name: string): RuntimeValue {
    const ref = this.refs.get(name)
    if (ref) return ref.scope.get(ref.name)
    if (this.variables.has(name)) {
      return this.variables.get(name)!
    }
    if (this.parent) {
      return this.parent.get(name)
    }
    throw new RuntimeError(RUNTIME_ERRORS.UNDECLARED_VAR, { '%1': name })
  }

  set(name: string, value: RuntimeValue): void {
    const ref = this.refs.get(name)
    if (ref) { ref.scope.set(ref.name, value); return }
    if (this.variables.has(name)) {
      this.variables.set(name, value)
      return
    }
    if (this.parent) {
      try {
        this.parent.get(name)
        this.parent.set(name, value)
        return
      } catch {
        // not found in parent, fall through
      }
    }
    this.variables.set(name, value)
  }

  /** Find the scope that owns a variable (for reference binding) */
  findOwner(name: string): Scope | null {
    if (this.variables.has(name)) return this
    if (this.parent) return this.parent.findOwner(name)
    return null
  }

  /** 這個名字宣告過嗎？（`get` 找不到會丟錯，所以要先問） */
  has(name: string): boolean {
    if (this.refs.has(name) || this.variables.has(name)) return true
    return this.parent?.has(name) ?? false
  }

  createChild(): Scope {
    return new Scope(this)
  }

  /**
   * 建一個**直接用 `fields` 當變數表**的作用域——給方法呼叫用。
   *
   * C++ 的方法直接寫欄位名（`x = 5`，不是 `this->x = 5`）。天真的做法是把
   * 欄位複製進來、跑完再複製回去，**而那在方法呼叫方法時是錯的**：內層改的
   * 是自己那份副本。
   *
   * 這裡不複製——欄位表就是變數表，讀寫自動穿透。
   *
   * ⚠️ 方法裡宣告的區域變數會落進這張表，也就是落進物件。呼叫端要用一個
   * **子作用域**跑方法本體，讓區域變數落在子層。見 `struct-methods.ts`。
   */
  static overFields(fields: Map<string, RuntimeValue>, parent: Scope | null): Scope {
    const s = new Scope(parent)
    ;(s as unknown as { variables: Map<string, RuntimeValue> }).variables = fields
    return s
  }

  getAll(): Map<string, RuntimeValue> {
    const result = new Map<string, RuntimeValue>()
    if (this.parent) {
      for (const [k, v] of this.parent.getAll()) {
        result.set(k, v)
      }
    }
    for (const [k, v] of this.variables) {
      result.set(k, v)
    }
    return result
  }
}
