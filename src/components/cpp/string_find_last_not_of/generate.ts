/**
 * `cpp:string_find_last_not_of` 的 **generate** 路
 *
 * ## ⚠️ 這一路搬家前**根本不存在**
 *
 * 實測（`git stash` 回到搬家前的原始碼）：`generateCode` 對這顆身分回
 * `⟨unknown component⟩`。lift 得到它、execute 跑得動它，**但投影回程式碼會斷**。
 *
 * 也就是說 `s.find_last_not_of(" ")` 這段真實可寫的 C++，
 * 走「程式碼 → 積木 → 程式碼」一圈之後**變成一句錯誤訊息**。
 * 根公理是「唯一真實，各式投影」，而這裡有一個投影是壞的。
 *
 * ### 為什麼沒有人發現
 *
 * 兩顆的身分原本是 `lifters/io.ts` 裡**樣板字串組出來的**
 * （`` createNode(`cpp:string_${method}`) ``）——而**掃描器看不到樣板字串**。
 * 就近性護欄因此把它們記成「1 檔」，實際上是 2 檔；
 * 而「宣告了卻沒有實作」的檢查也一樣看不到那半邊。
 *
 * > **一個看不見的身分，連它缺了哪一路都量不出來。**
 *
 * 補這一路不是重寫既有實作（沒有既有實作可以對歪），所以與搬家同一個 commit。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:string_find_last_not_of', (node, ctx) => {
    const obj = node.properties.obj ?? 'str'
    const argNodes = node.children.arg ?? []
    const arg = argNodes.length > 0 ? generateExpression(argNodes[0], ctx) : '""'
    return `${obj}.find_last_not_of(${arg})`
  })
}
