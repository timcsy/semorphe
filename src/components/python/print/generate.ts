/**
 * `python:print` 的 **generate** 路——`print(a, b)`。
 *
 * ## ⚠️ 這顆此刻是什麼
 *
 * spec `156` 的**第一顆 Python 元件**。它存在的目的是**產生第一條跨語言的等價邊**
 * （與 C++ 那顆輸出概念宣告同一個 `ioRole`），**不是**讓 Python 能跑。
 *
 * 🔴 **render／extract／execute 三路是【真的缺】**，不是刻意跳過
 * ——`skip-declaration-gate` 的理由詞彙只有三個，**沒有一個是「還沒做」**，
 * 而那是刻意的（`history/018`）。它們記在完備性基線的「缺」裡，附理由。
 *
 * > **膠囊契約沒有「一個語言正在建構中」這個狀態
 * > ——而那是 spec 156 掀出來的結構缺口。**
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:print', (node, ctx) => {
    const values = node.children.values ?? []
    const parts = values.map((v) => generateExpression(v, ctx))
    return `${indent(ctx)}print(${parts.join(', ')})\n`
  })
}
