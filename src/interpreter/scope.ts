import type { RuntimeValue } from './types'
import { RuntimeError, RUNTIME_ERRORS } from './errors'

export class Scope {
  private variables = new Map<string, RuntimeValue>()
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

  get(name: string): RuntimeValue {
    if (this.variables.has(name)) {
      return this.variables.get(name)!
    }
    if (this.parent) {
      return this.parent.get(name)
    }
    throw new RuntimeError(RUNTIME_ERRORS.UNDECLARED_VAR, { '%1': name })
  }

  set(name: string, value: RuntimeValue): void {
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
