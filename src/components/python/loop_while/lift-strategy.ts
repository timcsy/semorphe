/**
 * `python:loop_while` 的 **lift** 路。
 *
 * ## 為什麼從純資料換成策略（第 417 刀）
 *
 * `while … else:` 的 `else` 底下那一段要進 `else_body`，而它住在 `else_clause` 這個
 * 包裝節點裡（`alternative` → `else_clause` → `body`）；`else:` 底下第一行的註解
 * 也掛在 `else_clause` 上、排在 `block` 之前（與 `python:if` 同一個 AST 形狀）。
 * `fieldMappings` 只認「一個欄位對一個接點」，拿不到第二層，也收不到那顆註解。
 *
 * 🪦 在此之前帶 `else` 的 `while` 整顆走誠實降級（2026-08-23 起；更早是**安靜地丟掉**那一段）。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

/* eslint-disable @typescript-eslint/no-explicit-any */

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:liftLoopWhile', (node, ctx) => {
    const body = (n: any): SemanticNode[] => {
      if (!n) return []
      const lifted = ctx.lift(n)
      if (!lifted) return []
      return lifted.componentId === '_compound' ? (lifted.slots.body ?? []) : [lifted]
    }
    const condition = ctx.lift(node.childForFieldName('condition') as never)
    // 條件認不出來就整顆降級——一個沒有條件的 while 產不回合法的程式碼。
    if (!condition) return null
    const slots: Record<string, SemanticNode[]> = {
      condition: [condition],
      body: body(node.childForFieldName('body')),
    }
    const alt = node.childForFieldName('alternative') as any
    if (alt) {
      // `else:` 底下的註解掛在 `else_clause` 上——收成那一段的第一顆，與 `python:if` 同一條規則
      const notes: SemanticNode[] = []
      for (const kid of alt.namedChildren as any[]) {
        if (kid.type !== 'comment') continue
        const made = ctx.lift(kid)
        if (made) notes.push(made)
      }
      const elseBody = [...notes, ...body(alt.childForFieldName('body'))]
      // ⚠️ 空的 `else`（只有 `pass`）在這裡是空陣列，而空陣列不寫進去——
      //    產回去就沒有 `else:`，那是另一支程式的文字。這種罕見寫法照舊整顆降級。
      if (elseBody.length === 0) return null
      slots.else_body = elseBody
    }
    return createNode('python:loop_while', {}, slots)
  })
}
