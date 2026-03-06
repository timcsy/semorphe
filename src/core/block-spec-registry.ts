import type { BlockSpec, AstConstraint, CognitiveLevel } from './types'

export class BlockSpecRegistry {
  private specs = new Map<string, BlockSpec>()
  private byConceptId = new Map<string, BlockSpec>()
  private byBlockType = new Map<string, BlockSpec>()
  private conceptToBlockType = new Map<string, string>()

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
}
