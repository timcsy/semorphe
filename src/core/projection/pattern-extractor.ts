import type { SemanticNode, BlockSpec, RenderMapping } from '../types'
import { createNode } from '../semantic-tree'

interface BlockState {
  type: string
  id: string
  fields: Record<string, unknown>
  inputs: Record<string, { block: BlockState }>
  next?: { block: BlockState }
  extraState?: Record<string, unknown>
}

interface ExtractSpec {
  conceptId: string
  mapping: RenderMapping
}

/**
 * JSON-driven pattern extractor engine.
 * Extracts SemanticNodes from Blockly block state using renderMapping (reverse direction).
 */
export class PatternExtractor {
  private extractSpecs = new Map<string, ExtractSpec>()

  /** Load block specs and build blockType → ExtractSpec index */
  loadBlockSpecs(specs: BlockSpec[]): void {
    for (const spec of specs) {
      const conceptId = spec.concept?.conceptId
      if (!conceptId) continue

      const blockType = (spec.blockDef as Record<string, unknown>).type as string
      if (!blockType) continue

      const mapping = spec.renderMapping ?? this.deriveRenderMapping(spec)
      this.extractSpecs.set(blockType, { conceptId, mapping })
    }
  }

  /** Extract a SemanticNode from a BlockState. Returns null if no extract spec found. */
  extract(block: BlockState): SemanticNode | null {
    const spec = this.extractSpecs.get(block.type)
    if (!spec) return null

    const props: Record<string, string | number> = {}
    const children: Record<string, SemanticNode[]> = {}

    // Reverse fields mapping: semanticProperty ← blockField
    for (const [blockField, semProp] of Object.entries(spec.mapping.fields)) {
      const value = block.fields[blockField]
      if (value !== undefined) {
        props[semProp] = String(value)
      }
    }

    // Reverse inputs mapping: semanticChild ← blockInput (expression)
    for (const [blockInput, semChild] of Object.entries(spec.mapping.inputs)) {
      const inputData = block.inputs[blockInput]
      if (inputData?.block) {
        const childNode = this.extract(inputData.block)
        if (childNode) {
          children[semChild] = [childNode]
        }
      }
    }

    // Reverse statementInputs mapping: semanticChild ← blockInput (statement chain)
    for (const [blockInput, semChild] of Object.entries(spec.mapping.statementInputs)) {
      const inputData = block.inputs[blockInput]
      if (inputData?.block) {
        children[semChild] = this.extractStatementChain(inputData.block)
      }
    }

    return createNode(spec.conceptId, props, children)
  }

  /** Extract a statement chain (block + next chain) into an array of SemanticNodes */
  private extractStatementChain(block: BlockState): SemanticNode[] {
    const results: SemanticNode[] = []
    let current: BlockState | undefined = block

    while (current) {
      const node = this.extract(current)
      if (node) results.push(node)
      current = current.next?.block
    }

    return results
  }

  /** Auto-derive renderMapping from blockDef and concept (same logic as PatternRenderer) */
  private deriveRenderMapping(spec: BlockSpec): RenderMapping {
    const mapping: RenderMapping = {
      fields: {},
      inputs: {},
      statementInputs: {},
    }

    const concept = spec.concept
    if (!concept) return mapping

    const blockDef = spec.blockDef as Record<string, unknown>

    const allArgs: Array<Record<string, unknown>> = []
    for (let i = 0; i <= 9; i++) {
      const args = blockDef[`args${i}`] as Array<Record<string, unknown>> | undefined
      if (args) allArgs.push(...args)
    }

    const properties = concept.properties ?? []
    const children = concept.children ?? {}

    for (const arg of allArgs) {
      const argType = arg.type as string
      const argName = arg.name as string
      if (!argName) continue

      if (argType === 'field_input' || argType === 'field_dropdown' || argType === 'field_number') {
        const semProp = this.findMatchingProperty(argName, properties)
        if (semProp) mapping.fields[argName] = semProp
      } else if (argType === 'input_value') {
        const semChild = this.findMatchingChild(argName, children)
        if (semChild) mapping.inputs[argName] = semChild
      } else if (argType === 'input_statement') {
        const semChild = this.findMatchingChild(argName, children)
        if (semChild) mapping.statementInputs[argName] = semChild
      }
    }

    return mapping
  }

  private findMatchingProperty(fieldName: string, properties: string[]): string | null {
    const lower = fieldName.toLowerCase()
    for (const prop of properties) {
      if (prop.toLowerCase() === lower) return prop
    }
    const commonMappings: Record<string, string[]> = {
      'OP': ['operator'],
      'NUM': ['value'],
      'TEXT': ['value'],
      'VAR': ['variable'],
      'ARRAY': ['name'],
      'NS': ['namespace'],
      'HEADER': ['header'],
      'RETURN_TYPE': ['return_type'],
      'PARAMS': ['params'],
      'ARGS': ['args'],
      'FORMAT': ['format'],
    }
    const mapped = commonMappings[fieldName]
    if (mapped) {
      for (const m of mapped) {
        if (properties.includes(m)) return m
      }
    }
    return null
  }

  private findMatchingChild(inputName: string, children: Record<string, string>): string | null {
    const lower = inputName.toLowerCase()
    for (const child of Object.keys(children)) {
      if (child.toLowerCase() === lower) return child
    }
    const commonMappings: Record<string, string[]> = {
      'COND': ['condition'],
      'CONDITION': ['condition'],
      'A': ['left', 'operand'],
      'B': ['right'],
      'EXPR': ['values', 'expression'],
    }
    const mapped = commonMappings[inputName]
    if (mapped) {
      for (const m of mapped) {
        if (m in children) return m
      }
    }
    return null
  }
}
