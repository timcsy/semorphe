import type { BlockSpec, AstConstraint, CognitiveLevel, ConceptDefJSON, BlockProjectionJSON } from './types'

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
        level: proj.level,
        version: proj.version,
        concept: {
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
      }
    })
    this.loadFromJSON(specs)
  }

  loadFromJSON(specs: BlockSpec[]): void {
    for (const spec of specs) {
      this.specs.set(spec.id, spec)
      if (spec.concept?.conceptId) {
        this.byConceptId.set(spec.concept.conceptId, spec)
      }
      const blockType = (spec.blockDef as Record<string, unknown>)?.type as string | undefined
      if (blockType) {
        this.byBlockType.set(blockType, spec)
        if (spec.concept?.conceptId) {
          this.conceptToBlockType.set(spec.concept.conceptId, blockType)
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

  listByCategory(category: string, level: CognitiveLevel): BlockSpec[] {
    return [...this.specs.values()].filter(
      spec => spec.category === category && spec.level <= level
    )
  }

  getAll(): BlockSpec[] {
    return [...this.specs.values()]
  }

  /** Get the cognitive level for a block type. Unknown blocks default to L2. */
  getLevel(blockType: string): CognitiveLevel {
    const spec = this.byBlockType.get(blockType)
    return spec?.level ?? 2
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
