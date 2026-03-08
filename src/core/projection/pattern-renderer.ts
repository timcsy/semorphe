import type { SemanticNode, BlockSpec, RenderMapping } from '../types'
import type { RenderStrategyRegistry, RenderContext } from '../registry/render-strategy-registry'

interface BlockState {
  type: string
  id: string
  fields: Record<string, unknown>
  inputs: Record<string, { block: BlockState }>
  next?: { block: BlockState }
  extraState?: Record<string, unknown>
}

interface RenderSpec {
  blockType: string
  mapping: RenderMapping
}

let blockIdCounter = 0

function nextBlockId(): string {
  return `pblock_${++blockIdCounter}`
}

/**
 * JSON-driven pattern renderer engine.
 * Renders SemanticNodes to Blockly block state using renderMapping definitions.
 */
export class PatternRenderer {
  private renderSpecs = new Map<string, RenderSpec>()
  private expressionOnlyBlockTypes = new Set<string>()
  private renderStrategyRegistry: RenderStrategyRegistry | null = null
  private activeRenderCtx: RenderContext | undefined = undefined

  setRenderStrategyRegistry(registry: RenderStrategyRegistry): void {
    this.renderStrategyRegistry = registry
  }

  /** Reset block ID counter (for testing) */
  resetIds(): void {
    blockIdCounter = 0
  }

  /** Load block specs and build conceptId → RenderSpec index */
  loadBlockSpecs(specs: BlockSpec[]): void {
    for (const spec of specs) {
      const conceptId = spec.concept?.conceptId
      if (!conceptId) continue

      const blockDef = spec.blockDef as Record<string, unknown>
      const blockType = blockDef.type as string
      const mapping = spec.renderMapping ?? this.deriveRenderMapping(spec)
      this.renderSpecs.set(conceptId, { blockType, mapping })

      // Track expression-only block types (have output but no previousStatement)
      if (blockDef.output !== undefined && blockDef.previousStatement === undefined) {
        this.expressionOnlyBlockTypes.add(blockType)
      }
    }
  }

  /** Render a SemanticNode to a BlockState. Returns null if no render spec found. */
  render(node: SemanticNode, renderCtx?: RenderContext): BlockState | null {
    // Store renderCtx so recursive calls (auto-derive children) can use strategies
    if (renderCtx) this.activeRenderCtx = renderCtx
    const ctx = renderCtx ?? this.activeRenderCtx

    const spec = this.renderSpecs.get(node.concept)
    if (!spec) return null

    // Layer 3: renderStrategy takes priority over auto-derive mapping
    if (spec.mapping.strategy && this.renderStrategyRegistry && ctx) {
      const strategyFn = this.renderStrategyRegistry.get(spec.mapping.strategy)
      if (strategyFn) {
        try {
          const result = strategyFn(node, ctx!)
          if (result) return result
        } catch {
          // Strategy threw — fall through to auto-derive
        }
      } else {
        console.warn(`[PatternRenderer] renderStrategy "${spec.mapping.strategy}" not found in registry`)
      }
    }

    const block: BlockState = {
      type: spec.blockType,
      id: nextBlockId(),
      fields: {},
      inputs: {},
    }

    // Map fields: blockField → semanticProperty
    for (const [blockField, semProp] of Object.entries(spec.mapping.fields)) {
      const value = node.properties[semProp]
      if (value !== undefined) {
        block.fields[blockField] = value
      }
    }

    // Map inputs: blockInput → semanticChild (expression)
    for (const [blockInput, semChild] of Object.entries(spec.mapping.inputs)) {
      const children = node.children[semChild]
      if (children && children.length > 0) {
        const childBlock = this.render(children[0])
        if (childBlock) {
          block.inputs[blockInput] = { block: childBlock }
        }
      }
    }

    // Map statementInputs: blockInput → semanticChild (statement chain)
    for (const [blockInput, semChild] of Object.entries(spec.mapping.statementInputs)) {
      const children = node.children[semChild]
      if (children && children.length > 0) {
        const chain = this.renderStatementChain(children)
        if (chain) {
          block.inputs[blockInput] = { block: chain }
        }
      }
    }

    return block
  }

  private renderStatementChain(nodes: SemanticNode[]): BlockState | null {
    if (nodes.length === 0) return null

    // Filter: only render blocks that have previousStatement (statement blocks)
    // Expression-only blocks (e.g. u_var_ref with only output) cannot be chained
    let first: BlockState | null = null
    let current: BlockState | null = null
    for (const node of nodes) {
      const block = this.render(node)
      if (!block) continue
      // Skip expression-only blocks that can't be statement-chained
      if (this.expressionOnlyBlockTypes.has(block.type)) continue
      if (!first) {
        first = block
        current = block
      } else {
        current!.next = { block: block }
        current = block
      }
    }

    return first
  }

  /** Auto-derive renderMapping from blockDef and concept */
  private deriveRenderMapping(spec: BlockSpec): RenderMapping {
    const mapping: RenderMapping = {
      fields: {},
      inputs: {},
      statementInputs: {},
    }

    const concept = spec.concept
    if (!concept) return mapping

    const blockDef = spec.blockDef as Record<string, unknown>

    // Collect all args from args0, args1, args2, args3...
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
        // Map to a semantic property
        const semProp = this.findMatchingProperty(argName, properties)
        if (semProp) {
          mapping.fields[argName] = semProp
        }
      } else if (argType === 'input_value') {
        // Map to a semantic child (expression)
        const semChild = this.findMatchingChild(argName, children)
        if (semChild) {
          mapping.inputs[argName] = semChild
        }
      } else if (argType === 'input_statement') {
        // Map to a semantic child (statements)
        const semChild = this.findMatchingChild(argName, children)
        if (semChild) {
          mapping.statementInputs[argName] = semChild
        }
      }
    }

    return mapping
  }

  /** Find matching semantic property for a block field name */
  private findMatchingProperty(fieldName: string, properties: string[]): string | null {
    // Exact case-insensitive match
    const lower = fieldName.toLowerCase()
    for (const prop of properties) {
      if (prop.toLowerCase() === lower) return prop
    }
    // Try common mappings
    const commonMappings: Record<string, string[]> = {
      'OP': ['operator'],
      'NUM': ['value'],
      'TEXT': ['value'],
      'VAR': ['variable', 'var_name'],
      'ARRAY': ['name'],
      'NS': ['namespace'],
      'HEADER': ['header'],
      'RETURN_TYPE': ['return_type'],
      'PARAMS': ['params'],
      'ARGS': ['args'],
      'BOUND': ['inclusive'],
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

  /** Find matching semantic child for a block input name */
  private findMatchingChild(inputName: string, children: Record<string, string>): string | null {
    const lower = inputName.toLowerCase()
    for (const child of Object.keys(children)) {
      if (child.toLowerCase() === lower) return child
    }
    // Common mappings
    const commonMappings: Record<string, string[]> = {
      'COND': ['condition'],
      'CONDITION': ['condition'],
      'THEN': ['then_body', 'then'],
      'ELSE': ['else_body', 'else'],
      'BODY': ['body', 'then_body'],
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
