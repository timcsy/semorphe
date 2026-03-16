import type { SemanticNode, BlockSpec, RenderMapping, DynamicRule } from '../types'
import { createNode } from '../semantic-tree'
import { FIELD_COMMON_MAPPINGS, INPUT_COMMON_MAPPINGS, resolvePath, resolvePattern } from './common-mappings'

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

      // Merge: auto-derive base mapping, then overlay explicit renderMapping from spec
      const derived = this.deriveRenderMapping(spec)
      const explicit = spec.renderMapping
      const mapping = explicit
        ? {
            fields: (explicit.fields && Object.keys(explicit.fields).length > 0) ? explicit.fields : derived.fields,
            inputs: (explicit.inputs && Object.keys(explicit.inputs).length > 0) ? explicit.inputs : derived.inputs,
            statementInputs: (explicit.statementInputs && Object.keys(explicit.statementInputs).length > 0) ? explicit.statementInputs : derived.statementInputs,
            dynamicInputs: explicit.dynamicInputs ?? derived.dynamicInputs,
            strategy: explicit.strategy ?? derived.strategy,
            expressionCounterpart: explicit.expressionCounterpart,
            dynamicRules: explicit.dynamicRules,
          }
        : derived
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

    // Process dynamicRules from extraState
    if (spec.mapping.dynamicRules) {
      this.extractDynamicRules(block, spec.mapping.dynamicRules, children)
    }

    return createNode(spec.conceptId, props, children)
  }

  /** Process dynamicRules to extract dynamic children from block extraState and inputs/fields */
  private extractDynamicRules(
    block: BlockState,
    rules: DynamicRule[],
    children: Record<string, SemanticNode[]>,
  ): void {
    const extraState = block.extraState ?? {}

    for (const rule of rules) {
      const count = resolvePath(extraState, rule.countSource)
      const numCount = typeof count === 'number' ? count : 0
      if (numCount <= 0) continue

      const childNodes: SemanticNode[] = []

      for (let i = 0; i < numCount; i++) {
        // Multi-mode slot pattern
        if (rule.modeSource && rule.modes) {
          const modePathResolved = resolvePattern(rule.modeSource, i)
          const mode = resolvePath(extraState, modePathResolved) as string | undefined
          if (mode && rule.modes[mode]) {
            const modeRule = rule.modes[mode]
            if (modeRule.field && modeRule.wrap) {
              // Select mode: read value from extraState, wrap as concept node
              const fieldPathResolved = resolvePattern(modeRule.field, i)
              const value = resolvePath(extraState, fieldPathResolved) as string | undefined
              if (value !== undefined) {
                childNodes.push(createNode(modeRule.wrap, { name: value }))
              }
            } else if (modeRule.input) {
              // Compose mode: read from block input
              const inputName = resolvePattern(modeRule.input, i)
              const inputData = block.inputs[inputName]
              if (inputData?.block) {
                const childNode = this.extract(inputData.block)
                if (childNode) childNodes.push(childNode)
              }
            }
          }
          continue
        }

        // Repeat field group pattern (childConcept + childFields)
        if (rule.childConcept && rule.childFields) {
          const fieldProps: Record<string, string> = {}
          for (const [fieldPattern, propName] of Object.entries(rule.childFields)) {
            const fieldName = resolvePattern(fieldPattern, i)
            const value = block.fields[fieldName]
            if (value !== undefined) {
              fieldProps[propName] = String(value)
            }
          }
          childNodes.push(createNode(rule.childConcept, fieldProps))
          continue
        }

        // Repeat input pattern (expression or statement)
        if (rule.inputPattern) {
          const inputName = resolvePattern(rule.inputPattern, i)
          const inputData = block.inputs[inputName]
          if (inputData?.block) {
            if (rule.isStatementInput) {
              // Statement input: extract chain
              const chain = this.extractStatementChain(inputData.block)
              childNodes.push(...chain)
            } else {
              // Expression input: extract single node
              const childNode = this.extract(inputData.block)
              if (childNode) childNodes.push(childNode)
            }
          }
          continue
        }
      }

      if (childNodes.length > 0) {
        children[rule.childSlot] = childNodes
      }
    }
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
    const mapped = FIELD_COMMON_MAPPINGS[fieldName]
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
    const mapped = INPUT_COMMON_MAPPINGS[inputName]
    if (mapped) {
      for (const m of mapped) {
        if (m in children) return m
      }
    }
    return null
  }
}
