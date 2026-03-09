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

  createChild(): Scope {
    return new Scope(this)
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
