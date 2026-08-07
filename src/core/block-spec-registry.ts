import type { BlockSpec, AstConstraint, ConceptDefJSON, BlockProjectionJSON, Topic } from './types'
import { applyBlockOverride } from './block-override'

export class BlockSpecRegistry {
  private specs = new Map<string, BlockSpec>()
  private byConceptId = new Map<string, BlockSpec>()
  private byBlockType = new Map<string, BlockSpec>()
  private conceptToBlockType = new Map<string, string>()

  /** Load from split concept + projection JSON (Phase 3 architecture) */
  loadFromSplit(concepts: ConceptDefJSON[], projections: BlockProjectionJSON[]): void {
    const conceptMap = new Map<string, ConceptDefJSON>()
    for (const c of concepts) conceptMap.set(c.conceptId, c)
    const specs: BlockSpec[] = projections.map(proj => {
      const concept = conceptMap.get(proj.conceptId)
      return {
        id: proj.id,
        language: proj.language,
        category: proj.category,
        version: proj.version,
        conceptMapping: {
          conceptId: proj.conceptId,
          abstractConcept: concept?.abstractConcept ?? undefined,
          properties: concept?.properties,
          children: concept?.children,
          role: concept?.role,
          annotations: concept?.annotations,
        },
        blockDef: proj.blockDef,
        codeTemplate: proj.codeTemplate ?? { pattern: '', imports: [], order: 0 },
        astPattern: proj.astPattern ?? { nodeType: '_none', constraints: [] },
        renderMapping: proj.renderMapping,
        // ⚠️ 逐欄位列舉的建構**每加一個欄位就會漏一次**——`form` 第一版就是這樣掉的，
        // 而症狀是「多形態完全沒生效」，看起來像選擇函式壞掉。
        // 這裡守著的不變式與存檔那條相同：見 experience「與其偵測錯誤，不如換一個
        // 讓錯誤無法被表達的形式」——展開合併讓漏欄位不可能發生。
        form: proj.form,
      }
    })
    this.loadFromJSON(specs)
  }

  loadFromJSON(specs: BlockSpec[]): void {
    for (const spec of specs) {
      this.specs.set(spec.id, spec)
      if (spec.conceptMapping?.conceptId) {
        this.byConceptId.set(spec.conceptMapping.conceptId, spec)
      }
      const blockType = (spec.blockDef as Record<string, unknown>)?.type as string | undefined
      if (blockType) {
        this.byBlockType.set(blockType, spec)
        if (spec.conceptMapping?.conceptId) {
          this.conceptToBlockType.set(spec.conceptMapping.conceptId, blockType)
        }
      }
    }
  }

  getByConceptId(conceptId: string): BlockSpec | undefined {
    return this.byConceptId.get(conceptId)
  }

  getByBlockType(blockType: string): BlockSpec | undefined {
    return this.byBlockType.get(blockType)
  }

  /** Get the block type string for a given concept ID */
  getBlockTypeForConcept(conceptId: string): string | undefined {
    return this.conceptToBlockType.get(conceptId)
  }

  /** Get the auto-built concept→blockType map (replaces hardcoded CONCEPT_TO_BLOCK) */
  getConceptToBlockMap(): Record<string, string> {
    const map: Record<string, string> = {}
    for (const [concept, blockType] of this.conceptToBlockType) {
      map[concept] = blockType
    }
    return map
  }

  getByAstPattern(nodeType: string, constraints: AstConstraint[]): BlockSpec[] {
    return [...this.specs.values()].filter(spec => {
      if (spec.astPattern.nodeType !== nodeType) return false
      // All spec constraints must be satisfied by the provided constraints
      return spec.astPattern.constraints.every(sc =>
        constraints.some(c => c.field === sc.field && c.text === sc.text)
      )
    })
  }

  /** Get all patterns suitable for the PatternLifter */
  getAllPatterns(): BlockSpec[] {
    return [...this.specs.values()].filter(
      spec => spec.astPattern && !spec.astPattern.nodeType.startsWith('_')
    )
  }

  listByCategory(category: string, visibleConcepts?: Set<string>): BlockSpec[] {
    return [...this.specs.values()].filter(spec => {
      if (spec.category !== category) return false
      if (!visibleConcepts) return true
      if (!spec.conceptMapping?.conceptId) return true
      return visibleConcepts.has(spec.conceptMapping.conceptId)
    })
  }

  getAll(): BlockSpec[] {
    return [...this.specs.values()]
  }

  /** Check if a block type is visible given a set of visible concepts */
  isBlockVisible(blockType: string, visibleConcepts?: Set<string>): boolean {
    if (!visibleConcepts) return true
    const spec = this.byBlockType.get(blockType)
    if (!spec) return true
    if (!spec.conceptMapping?.conceptId) return true
    return visibleConcepts.has(spec.conceptMapping.conceptId)
  }

  /** Get a BlockSpec with Topic override applied (if any) */
  getWithOverride(conceptId: string, topic?: Topic): BlockSpec | undefined {
    const spec = this.byConceptId.get(conceptId)
    if (!spec) return undefined
    if (!topic?.blockOverrides) return spec
    const override = topic.blockOverrides[conceptId]
    if (!override) return spec
    return applyBlockOverride(spec, override)
  }

  /** 取得所有不重複的類別名稱 */
  getCategories(): string[] {
    const cats = new Set<string>()
    for (const spec of this.specs.values()) {
      if (spec.category) cats.add(spec.category)
    }
    return [...cats]
  }
}
