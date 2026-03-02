import type { BlockSpec, ValidationError } from './types'

interface ToolboxBlockEntry {
  kind: 'block'
  type: string
}

interface ToolboxCategory {
  kind: 'category'
  name: string
  contents: ToolboxBlockEntry[]
}

export interface ToolboxDefinition {
  kind: 'categoryToolbox'
  contents: ToolboxCategory[]
}

export class BlockRegistry {
  private blocks = new Map<string, BlockSpec>()
  private categories = new Map<string, string[]>()

  register(spec: BlockSpec): void {
    const errors = this.validate(spec)
    if (errors.length > 0) {
      throw new Error(`Invalid BlockSpec "${spec.id || '(empty)'}": ${errors.map(e => e.message).join('; ')}`)
    }
    if (this.blocks.has(spec.id)) {
      throw new Error(`Block "${spec.id}" is already registered`)
    }

    this.blocks.set(spec.id, spec)

    const catList = this.categories.get(spec.category) ?? []
    catList.push(spec.id)
    this.categories.set(spec.category, catList)
  }

  unregister(id: string): void {
    const spec = this.blocks.get(id)
    if (!spec) return

    this.blocks.delete(id)

    const catList = this.categories.get(spec.category)
    if (catList) {
      const idx = catList.indexOf(id)
      if (idx !== -1) catList.splice(idx, 1)
      if (catList.length === 0) this.categories.delete(spec.category)
    }
  }

  get(id: string): BlockSpec | undefined {
    return this.blocks.get(id)
  }

  getByNodeType(nodeType: string): BlockSpec[] {
    const results: BlockSpec[] = []
    for (const spec of this.blocks.values()) {
      if (spec.astPattern.nodeType === nodeType) {
        results.push(spec)
      }
    }
    return results
  }

  getByCategory(category: string): string[] {
    return this.categories.get(category) ?? []
  }

  validate(spec: unknown): ValidationError[] {
    const errors: ValidationError[] = []
    const s = spec as Record<string, unknown>

    if (!s || typeof s !== 'object') {
      errors.push({ field: 'spec', message: 'spec must be an object' })
      return errors
    }

    if (!s.id || typeof s.id !== 'string') {
      errors.push({ field: 'id', message: 'id is required and must be a non-empty string' })
    }

    if (!s.category || typeof s.category !== 'string') {
      errors.push({ field: 'category', message: 'category is required and must be a non-empty string' })
    }

    if (!s.version || typeof s.version !== 'string') {
      errors.push({ field: 'version', message: 'version is required and must be a non-empty string' })
    }

    if (!s.blockDef || typeof s.blockDef !== 'object') {
      errors.push({ field: 'blockDef', message: 'blockDef is required and must be an object' })
    } else {
      const bd = s.blockDef as Record<string, unknown>
      if (s.id && bd.type !== s.id) {
        errors.push({ field: 'blockDef.type', message: `blockDef.type must match id (expected "${s.id}", got "${bd.type}")` })
      }
    }

    if (!s.codeTemplate || typeof s.codeTemplate !== 'object') {
      errors.push({ field: 'codeTemplate', message: 'codeTemplate is required and must be an object' })
    } else {
      const ct = s.codeTemplate as Record<string, unknown>
      if (!ct.pattern || typeof ct.pattern !== 'string') {
        errors.push({ field: 'codeTemplate.pattern', message: 'codeTemplate.pattern is required and must be a non-empty string' })
      }
    }

    if (!s.astPattern || typeof s.astPattern !== 'object') {
      errors.push({ field: 'astPattern', message: 'astPattern is required and must be an object' })
    } else {
      const ap = s.astPattern as Record<string, unknown>
      if (!ap.nodeType || typeof ap.nodeType !== 'string') {
        errors.push({ field: 'astPattern.nodeType', message: 'astPattern.nodeType is required and must be a non-empty string' })
      }
    }

    return errors
  }

  toToolboxDef(): ToolboxDefinition {
    const contents: ToolboxCategory[] = []

    for (const [categoryName, blockIds] of this.categories) {
      contents.push({
        kind: 'category',
        name: categoryName,
        contents: blockIds.map(id => ({ kind: 'block' as const, type: id })),
      })
    }

    return { kind: 'categoryToolbox', contents }
  }
}
