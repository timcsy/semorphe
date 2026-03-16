import type { SemanticNode, BlockSpec, RenderMapping, DynamicRule, Topic } from '../types'
import { applyBlockOverride } from '../block-override'
import type { RenderStrategyRegistry, RenderContext } from '../registry/render-strategy-registry'
import { FIELD_COMMON_MAPPINGS, INPUT_COMMON_MAPPINGS, resolvePattern } from './common-mappings'

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

import { nextBlockId as _nextBlockId, resetBlockIdCounter } from './common-mappings'

function nextBlockId(): string {
  return _nextBlockId('pblock_')
}

/**
 * JSON-driven pattern renderer engine.
 * Renders SemanticNodes to Blockly block state using renderMapping definitions.
 */
export class PatternRenderer {
  private renderSpecs = new Map<string, RenderSpec>()
  private expressionOnlyBlockTypes = new Set<string>()
  private statementOnlyBlockTypes = new Set<string>()
  private renderStrategyRegistry: RenderStrategyRegistry | null = null
  private activeRenderCtx: RenderContext | undefined = undefined

  setRenderStrategyRegistry(registry: RenderStrategyRegistry): void {
    this.renderStrategyRegistry = registry
  }

  /** Reset block ID counter (for testing) */
  resetIds(): void {
    resetBlockIdCounter()
  }

  /** Load block specs and build conceptId → RenderSpec index */
  loadBlockSpecs(specs: BlockSpec[]): void {
    for (const spec of specs) {
      const conceptId = spec.concept?.conceptId
      if (!conceptId) continue

      const blockDef = spec.blockDef as Record<string, unknown>
      const blockType = blockDef.type as string
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
      this.renderSpecs.set(conceptId, { blockType, mapping })

      // Track expression-only block types (have output but no previousStatement)
      if (blockDef.output !== undefined && blockDef.previousStatement === undefined) {
        this.expressionOnlyBlockTypes.add(blockType)
      }
      // Track statement-only block types (have previousStatement but no output)
      if (blockDef.previousStatement !== undefined && blockDef.output === undefined) {
        this.statementOnlyBlockTypes.add(blockType)
      }
    }
  }

  /** Reload block specs with Topic overrides applied */
  loadBlockSpecsWithTopic(specs: BlockSpec[], topic?: Topic): void {
    this.renderSpecs.clear()
    this.expressionOnlyBlockTypes.clear()
    this.statementOnlyBlockTypes.clear()
    if (!topic?.blockOverrides || Object.keys(topic.blockOverrides).length === 0) {
      this.loadBlockSpecs(specs)
      return
    }
    const overrides = topic.blockOverrides
    const overriddenSpecs = specs.map(spec => {
      const conceptId = spec.concept?.conceptId
      if (!conceptId) return spec
      const override = overrides[conceptId]
      if (!override) return spec
      return applyBlockOverride(spec, override)
    })
    this.loadBlockSpecs(overriddenSpecs)
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
    // Use ctx.renderExpression() for expression slots to handle statement-only blocks safely
    for (const [blockInput, semChild] of Object.entries(spec.mapping.inputs)) {
      const children = node.children[semChild]
      if (children && children.length > 0) {
        const childBlock = ctx?.renderExpression
          ? ctx.renderExpression(children[0])
          : this.render(children[0])
        if (childBlock) {
          block.inputs[blockInput] = { block: childBlock }
        }
      }
    }

    // Map statementInputs: blockInput → semanticChild (statement chain)
    for (const [blockInput, semChild] of Object.entries(spec.mapping.statementInputs)) {
      const children = node.children[semChild]
      if (children && children.length > 0) {
        const chain = ctx?.renderStatementChain
          ? ctx.renderStatementChain(children)
          : this.renderStatementChain(children)
        if (chain) {
          block.inputs[blockInput] = { block: chain }
        }
      }
    }

    // Process dynamicRules: render dynamic children into extraState + inputs/fields
    if (spec.mapping.dynamicRules) {
      this.renderDynamicRules(node, spec.mapping.dynamicRules, block, ctx)
    }

    return block
  }

  /** Process dynamicRules to render semantic children into block extraState + dynamic inputs/fields */
  private renderDynamicRules(
    node: SemanticNode,
    rules: DynamicRule[],
    block: BlockState,
    ctx: RenderContext | undefined,
  ): void {
    for (const rule of rules) {
      const childNodes = node.children[rule.childSlot] ?? []
      if (childNodes.length === 0) continue

      // Set count in extraState
      if (!block.extraState) block.extraState = {}

      // Multi-mode slot pattern
      if (rule.modeSource && rule.modes) {
        const argsExtraState: Array<{ mode: string; text?: string }> = []
        for (let i = 0; i < childNodes.length; i++) {
          const child = childNodes[i]
          // Determine which mode this child maps to:
          // If a mode has `wrap` matching the child concept, use that mode's select path
          // Otherwise use compose mode
          let matched = false
          for (const [modeName, modeRule] of Object.entries(rule.modes)) {
            if (modeRule.wrap && child.concept === modeRule.wrap) {
              // Select mode: store value in extraState
              const nameValue = (child.properties.name as string) ?? ''
              argsExtraState.push({ mode: modeName, text: nameValue })
              matched = true
              break
            }
          }
          if (!matched) {
            // Compose mode: render as expression block input
            for (const [modeName, modeRule] of Object.entries(rule.modes)) {
              if (modeRule.input) {
                const inputName = resolvePattern(modeRule.input, i)
                const childBlock = ctx?.renderExpression
                  ? ctx.renderExpression(child)
                  : this.render(child)
                if (childBlock) {
                  block.inputs[inputName] = { block: childBlock }
                }
                argsExtraState.push({ mode: modeName })
                matched = true
                break
              }
            }
            if (!matched) {
              argsExtraState.push({ mode: 'compose' })
            }
          }
        }

        // Determine the extraState key from countSource
        // "args.length" → store as "args" array
        const countKey = rule.countSource.replace('.length', '')
        block.extraState[countKey] = argsExtraState
        continue
      }

      // Repeat field group pattern (childConcept + childFields)
      if (rule.childConcept && rule.childFields) {
        for (let i = 0; i < childNodes.length; i++) {
          const child = childNodes[i]
          for (const [fieldPattern, propName] of Object.entries(rule.childFields)) {
            const fieldName = resolvePattern(fieldPattern, i)
            const value = child.properties[propName]
            if (value !== undefined) {
              block.fields[fieldName] = value
            }
          }
        }
        // Set count in extraState
        const countKey = rule.countSource
        block.extraState[countKey] = childNodes.length
        continue
      }

      // Repeat input pattern (expression or statement)
      if (rule.inputPattern) {
        for (let i = 0; i < childNodes.length; i++) {
          const inputName = resolvePattern(rule.inputPattern, i)
          if (rule.isStatementInput) {
            // Statement input: render chain of single child
            const chain = ctx?.renderStatementChain
              ? ctx.renderStatementChain([childNodes[i]])
              : this.renderStatementChain([childNodes[i]])
            if (chain) {
              block.inputs[inputName] = { block: chain }
            }
          } else {
            const childBlock = ctx?.renderExpression
              ? ctx.renderExpression(childNodes[i])
              : this.render(childNodes[i])
            if (childBlock) {
              block.inputs[inputName] = { block: childBlock }
            }
          }
        }
        // Set count in extraState
        const countKey = rule.countSource
        block.extraState[countKey] = childNodes.length
        continue
      }
    }
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

  /** Check if a block type is statement-only (cannot be used in expression context) */
  isStatementOnly(blockType: string): boolean {
    return this.statementOnlyBlockTypes.has(blockType)
  }

  /** Check if a block type is expression-only (has output, no previous/next connection) */
  isExpressionOnly(blockType: string): boolean {
    return this.expressionOnlyBlockTypes.has(blockType)
  }

  /** Get the expression counterpart block type for a statement block type */
  getExpressionCounterpart(blockType: string): string | undefined {
    for (const spec of this.renderSpecs.values()) {
      if (spec.blockType === blockType && spec.mapping.expressionCounterpart) {
        return spec.mapping.expressionCounterpart
      }
    }
    return undefined
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

      if (argType === 'field_input' || argType === 'field_dropdown' || argType === 'field_number' || argType === 'field_multilinetext') {
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
    const mapped = FIELD_COMMON_MAPPINGS[fieldName]
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
    const mapped = INPUT_COMMON_MAPPINGS[inputName]
    if (mapped) {
      for (const m of mapped) {
        if (m in children) return m
      }
    }
    return null
  }
}
