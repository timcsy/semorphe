/**
 * `cpp:io_sync` 的 **generate** 路
 *
 * ⚠️ **產出正規化成 `ios::`**，即使原文寫的是 `ios_base::` 或帶 `std::`。
 * 四種寫法是同一個函式（`ios` 繼承 `ios_base`），差別是**打字習慣不是語義**
 * ——而把一個沒有語義差別的選項搬到積木上，是純粹的認知負載。
 *
 * 代價講明：`ios_base::sync_with_stdio(false)` 進來、出去變成 `ios::…`。
 * 那是**投影的正規化**，與排版風格重排同類，不是資訊遺失。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:io_sync', (node, ctx) => {
    const value = node.children.value?.[0]
    // 引數缺席時補 `false`——這顆概念在真實程式裡幾乎只有一種用法，
    // 而空括號 `sync_with_stdio()` 編不過。
    const arg = value ? generateExpression(value, ctx) : 'false'
    return `${indent(ctx)}ios::sync_with_stdio(${arg});\n`
  })
}
