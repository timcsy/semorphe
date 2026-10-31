/**
 * 「字元陣列用一個字串字面量初始化」嗎——`char s[20] = "Semorphe";`（第 394 刀）。
 *
 * 產碼（不加大括號）與 formalize（初值是一個運算式 `iE`，不是初值串列 `iL`）**讀同一支**。
 * ⚠️ 元素型別必須是字元：`string g[3] = {"a"};` 是字串的陣列，拿掉大括號就換了意思（第一百一十五條護欄抓到）。
 */
import type { SemanticNode } from '../../../core/types'
import { isStringLiteral } from '../../../languages/cpp/lang/node-traits'

export function isCharStringInit(node: SemanticNode): boolean {
  const values = node.slots?.values ?? []
  const type = String(node.properties?.type ?? '')
  return values.length === 1 && isStringLiteral(values[0].componentId) && /^(signed |unsigned )?char$/.test(type)
}
