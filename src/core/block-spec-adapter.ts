import type { BlockSpec, ConceptDefJSON, BlockProjectionJSON } from './types'

/**
 * Merge split concept + projection JSON back into BlockSpec[] format.
 * This adapter enables downstream engines (PatternLifter, TemplateGenerator,
 * PatternRenderer, PatternExtractor) to remain unchanged.
 */
export function mergeToBlockSpecs(
  concepts: ConceptDefJSON[],
  projections: BlockProjectionJSON[],
): BlockSpec[] {
  const conceptMap = new Map<string, ConceptDefJSON>()
  for (const c of concepts) {
    conceptMap.set(c.conceptId, c)
  }

  return projections.map(proj => {
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
    } satisfies BlockSpec
  })
}
