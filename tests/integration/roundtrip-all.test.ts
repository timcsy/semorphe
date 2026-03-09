/**
 * Full Block Roundtrip Test (T054)
 *
 * Verifies that ALL blocks (68 total) can complete:
 * 1. Semantic→Block render (PatternRenderer)
 * 2. Block→Semantic extract (PatternExtractor)
 * 3. Code generation (TemplateGenerator)
 *
 * This is the completeness validation for the JSON-driven pipeline.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import { TemplateGenerator } from '../../src/core/projection/template-generator'
import { createNode } from '../../src/core/semantic-tree'
import type { BlockSpec, UniversalTemplate, ConceptDefJSON, BlockProjectionJSON } from '../../src/core/types'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'

import universalConcepts from '../../src/blocks/semantics/universal-concepts.json'
import cppConcepts from '../../src/languages/cpp/semantics/concepts.json'
import universalBlocks from '../../src/blocks/projections/blocks/universal-blocks.json'
import basicBlocks from '../../src/languages/cpp/projections/blocks/basic.json'
import advancedBlocks from '../../src/languages/cpp/projections/blocks/advanced.json'
import specialBlocks from '../../src/languages/cpp/projections/blocks/special.json'
import universalTemplatesJson from '../../src/languages/cpp/templates/universal-templates.json'

// Build allSpecs eagerly at module level (needed for describe-time iteration)
const _registry = new BlockSpecRegistry()
const _allConcepts = [...universalConcepts as unknown as ConceptDefJSON[], ...cppConcepts as unknown as ConceptDefJSON[]]
const _allProjections = [
  ...universalBlocks as unknown as BlockProjectionJSON[],
  ...basicBlocks as unknown as BlockProjectionJSON[],
  ...advancedBlocks as unknown as BlockProjectionJSON[],
  ...specialBlocks as unknown as BlockProjectionJSON[],
]
_registry.loadFromSplit(_allConcepts, _allProjections)
const allSpecs: BlockSpec[] = _registry.getAll()

let renderer: PatternRenderer
let extractor: PatternExtractor
let generator: TemplateGenerator

beforeAll(() => {
  renderer = new PatternRenderer()
  extractor = new PatternExtractor()
  generator = new TemplateGenerator()

  renderer.loadBlockSpecs(allSpecs)
  extractor.loadBlockSpecs(allSpecs)

  for (const spec of allSpecs) {
    if (spec.codeTemplate?.pattern && spec.concept?.conceptId) {
      generator.registerTemplate(spec.concept.conceptId, spec.codeTemplate)
    }
  }
  generator.loadUniversalTemplates(universalTemplatesJson as unknown as UniversalTemplate[])
})

/**
 * Build a minimal SemanticNode with dummy values for all properties and children
 * based on the block's concept definition.
 */
function buildDummyNode(spec: BlockSpec) {
  const concept = spec.concept!
  const props: Record<string, string> = {}
  const children: Record<string, any[]> = {}

  for (const prop of concept.properties ?? []) {
    props[prop] = 'test'
  }

  const childDefs = concept.children ?? {}
  // children can be array of objects or a plain object
  if (Array.isArray(childDefs)) {
    for (const childObj of childDefs) {
      for (const [name, role] of Object.entries(childObj)) {
        if (role === 'statements') {
          children[name] = [] // empty statement list
        } else {
          children[name] = [createNode('number_literal', { value: '0' })]
        }
      }
    }
  } else {
    for (const [name, role] of Object.entries(childDefs)) {
      if (role === 'statements') {
        children[name] = []
      } else {
        children[name] = [createNode('number_literal', { value: '0' })]
      }
    }
  }

  return createNode(concept.conceptId, props, children)
}

describe('Full Roundtrip — All 68 Blocks', () => {
  // Skip blocks that are raw/unresolved (no real concept mapping)
  const skipConcepts = new Set(['cpp_raw_code', 'cpp_raw_expression'])

  describe('Render coverage: every concept renders to correct block type', () => {
    for (const spec of allSpecs) {
      const conceptId = spec.concept?.conceptId
      if (!conceptId || skipConcepts.has(conceptId)) continue

      const blockType = (spec.blockDef as any).type

      it(`${conceptId} → ${blockType}`, () => {
        const sem = buildDummyNode(spec)
        const block = renderer.render(sem)
        expect(block, `Failed to render concept '${conceptId}'`).not.toBeNull()
        expect(block!.type).toBe(blockType)
      })
    }
  })

  describe('Extract coverage: every block extracts to correct concept', () => {
    for (const spec of allSpecs) {
      const conceptId = spec.concept?.conceptId
      if (!conceptId || skipConcepts.has(conceptId)) continue

      const blockType = (spec.blockDef as any).type

      it(`${blockType} → ${conceptId}`, () => {
        const sem = buildDummyNode(spec)
        const block = renderer.render(sem)
        expect(block).not.toBeNull()

        const extracted = extractor.extract(block!)
        expect(extracted, `Failed to extract block '${blockType}'`).not.toBeNull()
        expect(extracted!.concept).toBe(conceptId)
      })
    }
  })

  describe('Code generation coverage: every concept generates code', () => {
    for (const spec of allSpecs) {
      const conceptId = spec.concept?.conceptId
      if (!conceptId || skipConcepts.has(conceptId)) continue
      if (!spec.codeTemplate?.pattern) continue // skip blocks without templates

      it(`${conceptId} generates code`, () => {
        const sem = buildDummyNode(spec)
        const code = generator.generate(sem, { indent: 0, style: { indent_size: 4 } as any })
        expect(code, `Failed to generate code for '${conceptId}'`).not.toBeNull()
        expect(typeof code).toBe('string')
      })
    }
  })
})
