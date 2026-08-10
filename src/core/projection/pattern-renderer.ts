import type { SemanticNode, BlockSpec, RenderMapping, DynamicRule, Topic, FormSet } from '../types'
import { applyBlockOverride } from '../block-override'
import type { RenderStrategyRegistry, RenderContext } from '../registry/render-strategy-registry'
import { resolvePattern } from './common-mappings'
import { selectForm, buildFormSets, type FormDeclaration } from './form-selection'

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

import { serializeChildren } from './children-as-field'
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
  /** 每個元件身分的形態集合——由 `formDeclarations` 建出來 */
  private formSets = new Map<string, FormSet>()
  private formDeclarations: FormDeclaration[] = []
  private mappingByBlockType = new Map<string, RenderMapping>()
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
      const conceptId = spec.conceptMapping?.conceptId
      if (!conceptId) continue

      const blockDef = spec.blockDef as Record<string, unknown>
      const blockType = blockDef.type as string
      // Merge: auto-derive base mapping, then overlay explicit renderMapping from spec
      // ⚠️ **推導已退場。** 186 筆對應全部固化成顯式宣告（驗過「合併結果一字不差」），
      // 於是這裡不再從 `concept.properties` 推導任何東西。
      //
      // 那正是重點：推導在的時候，**參數宣告驅動了抽取行為**——改一顆元件的
      // 參數列就會改變它的積木怎麼被讀回來，而那是 C1（參數規格化）動不了的原因。
      // 現在 `properties` 只描述、不驅動。
      //
      // 代價：新積木**必須自己宣告** `renderMapping`。忘了不會靜默推導，
      // 會被 `audit-explicit-mapping` 當場指名——**顯式 ＋ 護欄**，不是隱式魔法。
      const derived: RenderMapping = { fields: {}, inputs: {}, statementInputs: {} }
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
            childrenAsField: explicit.childrenAsField,
          }
        : derived
      // ⚠️ **第一個宣告勝出，後來的不覆寫。**
      // 在此之前這裡是直接 `set`，於是同一個 conceptId 的第二顆積木會**蓋掉**
      // 第一顆——「一個身分多個形態」因此做不到，而那正是本功能要修的東西。
      if (!this.renderSpecs.has(conceptId)) this.renderSpecs.set(conceptId, { blockType, mapping })
      // 變體的 mapping 也要收——選到變體之後仍然要用它的 mapping 渲染欄位
      this.mappingByBlockType.set(blockType, mapping)
      this.formDeclarations.push({ conceptId, blockType, form: spec.form })

      // Track expression-only block types (have output but no previousStatement)
      if (blockDef.output !== undefined && blockDef.previousStatement === undefined) {
        this.expressionOnlyBlockTypes.add(blockType)
      }
      // Track statement-only block types (have previousStatement but no output)
      if (blockDef.previousStatement !== undefined && blockDef.output === undefined) {
        this.statementOnlyBlockTypes.add(blockType)
      }
    }
    this.formSets = buildFormSets(this.formDeclarations)
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
      const conceptId = spec.conceptMapping?.conceptId
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

    const spec = this.renderSpecs.get(node.conceptId)
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

    // 選形態——**規則來自宣告**（契約 C-2：本函式不得出現任何具體元件身分）。
    // 沒有多形態的元件走的是同一條路，只是形態集合只有一個成員。
    const formSet = this.formSets.get(node.conceptId)
    // 位置軸（statement/expression）在本功能中沒有任何積木宣告它——那是 B 項的事。
    // 傳 undefined 是誠實的：呼叫端目前不知道呈現位置。
    const chosen = formSet ? selectForm(formSet, node, {}) : undefined
    if (chosen?.degraded) {
      console.warn(`[PatternRenderer] ${node.conceptId}：${chosen.degraded.reason}`)
    }
    const 形態型別 = chosen?.blockType ?? spec.blockType
    const 形態映射 = this.mappingByBlockType.get(形態型別) ?? spec.mapping

    const block: BlockState = {
      type: 形態型別,
      id: nextBlockId(),
      fields: {},
      inputs: {},
    }

    // Map fields: blockField → semanticProperty
    for (const [blockField, semProp] of Object.entries(形態映射.fields)) {
      const value = node.properties[semProp]
      if (value !== undefined) {
        block.fields[blockField] = value
      }
    }

    // Map inputs: blockInput → semanticChild (expression)
    // Use ctx.renderExpression() for expression slots to handle statement-only blocks safely
    for (const [blockInput, semChild] of Object.entries(形態映射.inputs)) {
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
    for (const [blockInput, semChild] of Object.entries(形態映射.statementInputs)) {
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
    if (形態映射.dynamicRules) {
      this.renderDynamicRules(node, 形態映射.dynamicRules, block, ctx)
    }

    // childrenAsField：把一個接點的子節點序列化進一個文字欄位。
    // ⚠️ 零個子節點時**不寫欄位**（`serializeChildren` 回傳 null）——
    // 寫一個空欄位與不寫，在來回比對上是不同的東西。
    for (const spec of 形態映射.childrenAsField ?? []) {
      const text = serializeChildren(node.children[spec.childSlot] ?? [], spec)
      if (text !== null) block.fields[spec.field] = text
    }

    // Process extraStateFlags: set extraState[key] = true when children[childSlot] is non-empty
    if (形態映射.extraStateFlags) {
      for (const [extraKey, childSlot] of Object.entries(形態映射.extraStateFlags)) {
        const children = node.children[childSlot]
        if (children && children.length > 0) {
          if (!block.extraState) block.extraState = {}
          block.extraState[extraKey] = true
        }
      }
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

      // Set count in extraState
      if (!block.extraState) block.extraState = {}

      // Multi-mode slot pattern (always emit extraState, even for empty arrays)
      if (rule.modeSource && rule.modes) {
        const argsExtraState: Array<{ mode: string; text?: string }> = []
        for (let i = 0; i < childNodes.length; i++) {
          const child = childNodes[i]
          // Determine which mode this child maps to:
          // If a mode has `wrap` matching the child concept, use that mode's select path
          // Otherwise use compose mode
          let matched = false
          for (const [modeName, modeRule] of Object.entries(rule.modes)) {
            if (modeRule.wrap && child.conceptId === modeRule.wrap) {
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
        if (childNodes.length === 0) continue
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
        if (childNodes.length === 0) continue
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



}
