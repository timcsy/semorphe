/**
 * `cpp:comment` 的 **generate** 路（單行註解）
 *
 * ## ⚠️ 這顆元件原本有**兩份產生器**
 *
 * ```
 * core/projection/code-generator.ts            → commentSyntax().…（語言中立登記處）
 * languages/cpp/core/generators/statements.ts  → 寫死 `//`／`/* … *​/`／`///`
 * ```
 *
 * 實測**核心那一份贏**（註冊順序）。把寫死那份裝進膠囊試跑，
 * `/** @brief …*​/` 變成 `/// brief`，三支測試立刻紅——
 * **那是這條路上唯一的活口，而輸的那一份沒有人知道它輸了。**
 *
 * 兩份都剪了出來，這裡留下贏的那一份（行為一字不變）。
 *
 * ## 為什麼它現在搬得動了
 *
 * 核心原本必須自己留一份，理由是 FR-014（沒有語言套件時註解不得無聲消失）。
 * 而正確的切法是把責任換一個方向：
 *
 * > **不要讓核心認得某一類節點，讓核心不要弄丟任何節點。**
 *
 * 未知概念的標記改成帶著內容出來（`⟨unknown concept: cpp:comment | 文字⟩`），
 * 於是「註解怎麼寫」可以完全屬於語言——**而註解本來就是每個語言各自的機制**。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'
import { commentSyntax } from '../../../core/comment-syntax'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:comment', (node, ctx) => commentSyntax().line(String(node.properties.text ?? ''), indent(ctx)))
}
