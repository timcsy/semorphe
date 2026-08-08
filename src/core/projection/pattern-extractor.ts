import type { SemanticNode, BlockSpec, RenderMapping, DynamicRule } from '../types'
import { createNode } from '../semantic-tree'
import { deriveRenderMapping, resolvePath, resolvePattern } from './common-mappings'

export interface BlockState {
  type: string
  id: string
  fields: Record<string, unknown>
  inputs: Record<string, { block: BlockState }>
  next?: { block: BlockState }
  extraState?: Record<string, unknown>
}

export interface ExtractContext {
  extract(block: BlockState): SemanticNode | null
  extractStatementChain(block: BlockState): SemanticNode[]
}

export type ExtractStrategyFn = (block: BlockState, ctx: ExtractContext) => SemanticNode | null

interface ExtractSpec {
  conceptId: string
  mapping: RenderMapping
}

/**
 * JSON-driven pattern extractor engine.
 * Extracts SemanticNodes from Blockly block state using renderMapping (reverse direction).
 * Supports hand-written extraction strategies for blocks with complex logic.
 */
export class PatternExtractor {
  private extractSpecs = new Map<string, ExtractSpec>()
  private extractStrategies = new Map<string, ExtractStrategyFn>()

  /** Load block specs and build blockType → ExtractSpec index */
  loadBlockSpecs(specs: BlockSpec[]): void {
    for (const spec of specs) {
      const conceptId = spec.conceptMapping?.conceptId
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
            extraStateFlags: explicit.extraStateFlags,
          }
        : derived
      this.extractSpecs.set(blockType, { conceptId, mapping })
    }
  }

  /** Register a hand-written extraction strategy for a specific block type */
  registerExtractStrategy(blockType: string, fn: ExtractStrategyFn): void {
    this.extractStrategies.set(blockType, fn)
  }

  /** Extract a SemanticNode from a BlockState. Returns null if no extract spec found. */
  extract(block: BlockState): SemanticNode | null {
    // Check for hand-written extraction strategy FIRST
    const strategy = this.extractStrategies.get(block.type)
    if (strategy) {
      const ctx: ExtractContext = {
        extract: (b) => this.extract(b),
        extractStatementChain: (b) => this.extractStatementChain(b),
      }
      const result = strategy(block, ctx)
      if (result) {
        if (block.id) result.metadata = { ...result.metadata, sourceBlockId: block.id }
        return result
      }
      // Strategy returned null — fall through to auto-derive
    }

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

    const node = createNode(spec.conceptId, props, children)
    // Store the source block ID as metadata (not as node.id — node ID is the unique truth)
    if (block.id) node.metadata = { ...node.metadata, sourceBlockId: block.id }
    return node
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

  /**
   * ⚠️ **推導只有一份**——`common-mappings.ts` 的 `deriveRenderMapping`。
   *
   * 這裡曾經有一份自己的拷貝，而 `PatternRenderer` 有另一份，**兩份不一樣**：
   * 渲染那份認 `field_multilinetext`，這份不認。於是 `c_comment_block` 的內容
   * **渲染得出去、抽取不回來**——使用者在積木編輯器裡寫的區塊註解會消失，
   * 而唯一的症狀是「切換積木風格之後東西不見了」。
   *
   * 已合併成一份。一致性由 `audit-derive-agreement` 護欄看著——它**餵同一個
   * 輸入給渲染與抽取、比對輸出**，而不是比對程式碼。
   */
  private deriveRenderMapping(spec: BlockSpec): RenderMapping {
    const c = spec.conceptMapping
    return deriveRenderMapping(
      spec.blockDef as Record<string, unknown>,
      c?.properties ?? [],
      (c?.children ?? {}) as Record<string, unknown>,
    )
  }

  // `findMatchingProperty` / `findMatchingChild` 已移到 `common-mappings.ts`——
  // 它們是推導的一部分，而推導只有一份。
}
