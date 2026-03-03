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
      if (spec.astPattern?.nodeType === nodeType) {
        results.push(spec)
      }
    }
    return results
  }

  getByCategory(category: string): string[] {
    return this.categories.get(category) ?? []
  }

  /** 取得指定語言可用的所有積木（universal + 該語言的特殊積木） */
  getByLanguage(languageId: string): BlockSpec[] {
    const results: BlockSpec[] = []
    for (const spec of this.blocks.values()) {
      if (spec.language === 'universal' || spec.language === languageId) {
        results.push(spec)
      }
    }
    return results
  }

  /** 取得所有已註冊的積木 */
  getAll(): BlockSpec[] {
    return Array.from(this.blocks.values())
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

    if (!s.language || typeof s.language !== 'string') {
      errors.push({ field: 'language', message: 'language is required and must be a non-empty string' })
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

    const isUniversal = s.language === 'universal'

    if (!isUniversal) {
      // 語言特殊積木必須有 codeTemplate 和 astPattern
      if (s.codeTemplate !== undefined && typeof s.codeTemplate === 'object' && s.codeTemplate !== null) {
        const ct = s.codeTemplate as Record<string, unknown>
        if (!ct.pattern || typeof ct.pattern !== 'string') {
          errors.push({ field: 'codeTemplate.pattern', message: 'codeTemplate.pattern is required and must be a non-empty string' })
        }
      } else if (s.codeTemplate === undefined) {
        errors.push({ field: 'codeTemplate', message: 'codeTemplate is required for language-specific blocks' })
      } else {
        errors.push({ field: 'codeTemplate', message: 'codeTemplate must be an object' })
      }

      if (s.astPattern !== undefined && typeof s.astPattern === 'object' && s.astPattern !== null) {
        const ap = s.astPattern as Record<string, unknown>
        if (!ap.nodeType || typeof ap.nodeType !== 'string') {
          errors.push({ field: 'astPattern.nodeType', message: 'astPattern.nodeType is required and must be a non-empty string' })
        }
      } else if (s.astPattern === undefined) {
        errors.push({ field: 'astPattern', message: 'astPattern is required for language-specific blocks' })
      } else {
        errors.push({ field: 'astPattern', message: 'astPattern must be an object' })
      }
    }

    return errors
  }

  toToolboxDef(languageId?: string): ToolboxDefinition {
    const contents: ToolboxCategory[] = []
    const filteredCategories = new Map<string, string[]>()

    for (const [id, spec] of this.blocks) {
      if (languageId && spec.language !== 'universal' && spec.language !== languageId) {
        continue
      }
      const catList = filteredCategories.get(spec.category) ?? []
      catList.push(id)
      filteredCategories.set(spec.category, catList)
    }

    for (const [categoryName, blockIds] of filteredCategories) {
      contents.push({
        kind: 'category',
        name: categoryName,
        contents: blockIds.map(id => ({ kind: 'block' as const, type: id })),
      })
    }

    return { kind: 'categoryToolbox', contents }
  }
}
