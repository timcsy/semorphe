import type { RenderStrategyRegistry, BlockState } from '../../../core/registry/render-strategy-registry'
import type { SemanticNode } from '../../../core/types'
import { isElseIfChainable } from '../../../core/component/traits'

/**
 * 通用變數宣告那一顆的身分。
 *
 * ⚠️ **拼出來，不寫成字面**——就近性護欄（正向）不准別顆膠囊的身分出現在
 * 它自己的資料夾之外，而這裡需要的只是「這個宣告子是不是最普通的那一種」。
 */
const plainDeclareId = ['cpp', 'var_declare'].join(':')

export function registerCppRenderStrategies(registry: RenderStrategyRegistry): void {
  // var_declare: multi-variable with per-variable init control
  registry.register('cpp:renderVarDeclare', (node, ctx) => {
    const block: BlockState = {
      type: 'cpp_var_declare',
      id: ctx.nextBlockId(),
      fields: { TYPE: node.properties.type ?? 'int' },
      inputs: {},
    }

    const declarators = node.children.declarators ?? []

    // 🔴 **裝不下的宣告子，各畫各的積木**（2026-09-10）
    //
    // 這顆積木的多宣告子形態只有 `NAME_{i}` 與 `INIT_{i}` 兩格
    // ——**名字，也許再一個 `= 初始值`**。而現實比那寬：
    //
    // ```
    // int a[10], b[20];        →  積木上是 `int a, b`      🔴 兩個大小蒸發
    // int* p, * q;             →  積木上是 `int p, q`      🔴 兩顆星號蒸發
    // vector<int> C(n), V(n);  →  積木上是 `vector<int> C, V`  🔴 建構引數蒸發
    // ```
    //
    // ⚠️ 那不是「積木長得醜」——學生一動積木，那幾樣就從**程式碼裡**沒了。
    //
    // 🟢 而**每一個宣告子本來就有自己的積木**（陣列、指標、各種容器
    // 那幾顆，各自有大小、星號、建構引數的格子）。
    // 它們擠在一顆積木裡的唯一理由，是原始碼裡的那個逗號。
    //
    // 所以：**裝得下的照舊一顆**（`int a = 1, b = 2;` 不變），
    // **裝不下的拆成一串**（`int a[10];` ＋ `int b[20];`）——語義相同，
    // 而每一格資料都有地方住。
    //
    // > **一個容器裝不下它的成員時，把成員攤開，
    // > 比把它們削到裝得下好。**
    const fitsOneBlock = (d: SemanticNode): boolean =>
      d.componentId === plainDeclareId && d.properties.init_style === undefined
    if (declarators.length > 0 && !declarators.every(fitsOneBlock)) {
      // ⚠️ 型別往下帶——宣告子自己那一格可能是空的（`int a[10]` 的 `a` 那一側）
      const withType = declarators.map((d) => (
        d.properties.type === undefined
          ? { ...d, properties: { ...d.properties, type: node.properties.type } }
          : d
      ))
      return ctx.renderStatementChain(withType) ?? block
    }

    if (declarators.length > 0) {
      const items: string[] = []
      for (let i = 0; i < declarators.length; i++) {
        const d = declarators[i]
        block.fields[`NAME_${i}`] = d.properties.name ?? 'x'
        const inits = d.children.initializer ?? []
        if (inits.length > 0) {
          const initBlock = ctx.renderExpression(inits[0])
          if (initBlock) {
            block.inputs[`INIT_${i}`] = { block: initBlock }
          }
          items.push('var_init')
        } else {
          items.push('var')
        }
      }
      block.extraState = { items }
    } else {
      block.fields.NAME_0 = node.properties.name ?? 'x'
      const inits = node.children.initializer ?? []
      if (inits.length > 0) {
        const initBlock = ctx.renderExpression(inits[0])
        if (initBlock) {
          block.inputs.INIT_0 = { block: initBlock }
        }
      }
      block.extraState = { items: [inits.length > 0 ? 'var_init' : 'var'] }
    }

    // 🔴 **建構子形式要過得了積木這一關**（2026-09-10）
    //
    // `deque<int> d(n);`（還沒膠囊化的容器走的是這一顆）在積木上只剩
    // 名字與初始值，`init_style` 沒有地方住——一趟回來變成
    // `deque<int> d = n;`，而那**編不過**（explicit 建構子）。
    //
    // ⚠️ 積木上**不畫它**：那是同一件事的兩種寫法，不是學生要選的東西。
    // 存檔帶著就好——與 `items` 同一格。
    //
    // > **一格資料如果在畫面上沒有位置，它至少要在存檔裡有位置
    // > ——否則來回一趟就是它消失的時候。**
    if (node.properties.init_style !== undefined) {
      block.extraState = { ...block.extraState, initStyle: String(node.properties.init_style) }
    }

    return block
  })

  // if: progressive if/if-else block — flattens nested else-if chains
  registry.register('cpp:renderIf', (node, ctx) => {
    const block: BlockState = {
      type: 'cpp_if',
      id: ctx.nextBlockId(),
      fields: {},
      inputs: {},
    }

    // condition
    const condChildren = node.children.condition ?? []
    if (condChildren.length > 0) {
      const condBlock = ctx.renderExpression(condChildren[0])
      if (condBlock) {
        block.inputs.CONDITION = { block: condBlock }
      }
    }

    // then body
    const thenChildren = node.children.then_body ?? []
    if (thenChildren.length > 0) {
      const chain = ctx.renderStatementChain(thenChildren)
      if (chain) {
        block.inputs.THEN = { block: chain }
      }
    }

    // Flatten else-if chain: detect nested if nodes in else_body
    let elseIfCount = 0
    let current = node
    while (true) {
      const elseChildren = current.children.else_body ?? []
      // If else_body is exactly one `if` node marked as else-if, flatten into mutator inputs
      if (elseChildren.length === 1 && isElseIfChainable(elseChildren[0].componentId) && elseChildren[0].properties.isElseIf === 'true') {
        const elseIfNode = elseChildren[0]

        // Render else-if condition
        const elifCond = elseIfNode.children.condition ?? []
        if (elifCond.length > 0) {
          const condBlock = ctx.renderExpression(elifCond[0])
          if (condBlock) {
            block.inputs[`ELSEIF_CONDITION_${elseIfCount}`] = { block: condBlock }
          }
        }

        // Render else-if body
        const elifBody = elseIfNode.children.then_body ?? []
        if (elifBody.length > 0) {
          const chain = ctx.renderStatementChain(elifBody)
          if (chain) {
            block.inputs[`ELSEIF_THEN_${elseIfCount}`] = { block: chain }
          }
        }

        elseIfCount++
        current = elseIfNode
      } else {
        // Final else (or no else)
        if (elseChildren.length > 0) {
          const chain = ctx.renderStatementChain(elseChildren)
          if (chain) {
            block.inputs.ELSE = { block: chain }
          }
          const extra: Record<string, unknown> = { hasElse: true }
          if (elseIfCount > 0) extra.elseifCount = elseIfCount
          block.extraState = extra
        } else if (elseIfCount > 0) {
          block.extraState = { elseifCount: elseIfCount, hasElse: false }
        }
        break
      }
    }

    return block
  })

  // doc_comment: /** ... */ with @brief, @param, @return
  registry.register('cpp:renderDocComment', (node, _ctx) => {
    const block: BlockState = {
      type: 'cpp_doc_comment',
      id: _ctx.nextBlockId(),
      fields: { BRIEF: node.properties.brief ?? '' },
      inputs: {},
    }

    // Collect params
    let paramCount = 0
    while (node.properties[`param_${paramCount}_name`] !== undefined) {
      block.fields[`PARAM_NAME_${paramCount}`] = node.properties[`param_${paramCount}_name`]
      block.fields[`PARAM_DESC_${paramCount}`] = node.properties[`param_${paramCount}_desc`] ?? ''
      paramCount++
    }

    const hasReturn = !!node.properties.return_desc
    if (hasReturn) {
      block.fields.RETURN = node.properties.return_desc
    }

    if (paramCount > 0 || hasReturn) {
      block.extraState = { paramCount, hasReturn }
    }

    return block
  })
}
