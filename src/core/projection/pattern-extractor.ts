import type { SemanticNode, BlockSpec, RenderMapping, DynamicRule } from '../types'
import { parseToChildren } from './children-as-field'
import { createNode } from '../semantic-tree'
import type { Annotation } from '../types'
import { resolvePath, resolvePattern } from './common-mappings'
import { componentWithTrait } from '../component/traits'

export interface BlockState {
  type: string
  id: string
  fields: Record<string, unknown>
  inputs: Record<string, { block: BlockState }>
  next?: { block: BlockState }
  /**
   * **積木上的註解泡泡**——Blockly 自己的欄位（`icons.comment`）。
   *
   * 🔴 使用者寫的行末註解住在這裡，**不住在 `extraState`**：
   * 沒有 mutation 的積木**根本沒有 `extraState` 這條路**（Blockly 只在積木
   * 自己實作 `save/loadExtraState` 時才理它），於是那些註解會在
   * 「積木→程式碼」之後安靜消失。
   *
   * 🟢 而註解泡泡是 Blockly 原生會存檔的東西，**而且使用者看得到、改得動**。
   */
  icons?: { comment?: { text: string; pinned?: boolean; height?: number; width?: number } }
  extraState?: Record<string, unknown>
}

export interface ExtractContext {
  extract(block: BlockState): SemanticNode | null
  extractStatementChain(block: BlockState): SemanticNode[]
}

export type ExtractStrategyFn = (block: BlockState, ctx: ExtractContext) => SemanticNode | null

interface ExtractSpec {
  componentId: string
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
      const componentId = spec.componentMapping?.componentId
      if (!componentId) continue

      const blockType = (spec.blockDef as Record<string, unknown>).type as string
      if (!blockType) continue

      // Merge: auto-derive base mapping, then overlay explicit renderMapping from spec
      // ⚠️ **推導已退場。** 186 筆對應全部固化成顯式宣告（驗過「合併結果一字不差」），
      // 於是這裡不再從 `component.properties` 推導任何東西。
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
      this.extractSpecs.set(blockType, { componentId, mapping })
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

    // childrenAsField：把一個文字欄位解析回子節點。
    // ⚠️ 欄位空白時**不建立**子節點陣列——`{}` 與 `{params: []}` 不同。
    // ⚠️ 迴圈變數不叫 `spec`——外層已經有一個 `spec`（BlockSpec），
    // 遮蔽之後讀的人分不出 `spec.mapping` 是哪一個。
    for (const caf of spec.mapping.childrenAsField ?? []) {
      const text = String(block.fields?.[caf.field] ?? '').trim()
      if (!text) continue
      const kids = parseToChildren(text, caf)
      if (kids.length) children[caf.childSlot] = kids
    }

    // Process dynamicRules from extraState
    if (spec.mapping.dynamicRules) {
      this.extractDynamicRules(block, spec.mapping.dynamicRules, children)
    }

    const node = createNode(spec.componentId, props, children)
    // Store the source block ID as metadata (not as node.id — node ID is the unique truth)
    if (block.id) node.metadata = { ...node.metadata, sourceBlockId: block.id }
    // 🔴 **標註要撿回來**（2026-08-23）：渲染那一路把它們放進 `extraState.annotations`，
    //    而這裡原本一個字都沒讀——症狀是**使用者寫的行末註解在「積木→程式碼」之後不見了**。
    //    ⚠️ 不報錯、產出的碼合法，而**他打的字沒了**。
    const notes = (block.extraState as { annotations?: Annotation[] } | undefined)?.annotations
    if (Array.isArray(notes) && notes.length > 0) node.annotations = notes
    // 🔴 **註解泡泡也是使用者寫的註解**——使用者可以從右鍵選單自己加一個。
    //    ⚠️ 它贏過 `extraState` 裡那一份：**他改的是泡泡**。
    const bubble = block.icons?.comment?.text?.trim()
    if (bubble) node.annotations = [{ type: 'comment', text: bubble, position: 'inline' }]
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
            const wrap = modeRule.wrapTrait ? componentWithTrait(modeRule.wrapTrait) : modeRule.wrap
            if (modeRule.field && wrap) {
              // Select mode: read value from extraState, wrap as component node
              const fieldPathResolved = resolvePattern(modeRule.field, i)
              const value = resolvePath(extraState, fieldPathResolved) as string | undefined
              if (value !== undefined) {
                childNodes.push(createNode(wrap, { name: value }))
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

        // Repeat field group pattern (childComponent + childFields)
        if (rule.childComponent && rule.childFields) {
          const fieldProps: Record<string, string> = {}
          for (const [fieldPattern, propName] of Object.entries(rule.childFields)) {
            const fieldName = resolvePattern(fieldPattern, i)
            const value = block.fields[fieldName]
            if (value !== undefined) {
              fieldProps[propName] = String(value)
            }
          }
          childNodes.push(createNode(rule.childComponent, fieldProps))
          continue
        }

        // Repeat input pattern (expression or statement)
        if (rule.inputPattern) {
          const inputName = resolvePattern(rule.inputPattern, i)
          const inputData = block.inputs[inputName]
          if (inputData?.block) {
            if (rule.isStatementInput) {
              // 🔴 **一個 input ⇄ 一個孩子**（2026-08-23 修）：這一串是**那一支**的整段。
              //
              // ⚠️ 原本把整串攤進同一個清單，於是 `elif` 的兩個清單
              //    （條件、主體）**靠索引配對就錯開了**——第二支 elif 的條件
              //    配到第一支的第二行。而那正是同族產生器的註解早就寫著的
              //    「錯開之後每一格都還在，只是接錯了人」。
              //
              // 🟢 兩行以上包成 `_compound`（核心用來表示「一段」的結構身分），
              //    一行的照原樣——**不為了整齊而多包一層**。
              const chain = this.extractStatementChain(inputData.block)
              if (chain.length === 1) childNodes.push(chain[0])
              else if (chain.length > 1) childNodes.push(createNode('_compound', {}, { body: chain }))
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


  // `findMatchingProperty` / `findMatchingChild` 已移到 `common-mappings.ts`——
  // 它們是推導的一部分，而推導只有一份。
}
