import type { ConceptExecutor } from '../../../../interpreter/executor-registry'

/**
 * 條件編譯的執行路。
 *
 * ## 這不是巨集展開
 *
 * 「模擬 C 前處理器來解決巨集」是**已否決的墓碑**——語義結構不該去模擬文字
 * 替換。這裡做的是另一件事：**記下哪些名字被 `#define` 過**，讓 `#ifdef` /
 * `#ifndef` 決定要不要執行它的 body。
 *
 * 差別在於：巨集展開會改寫**別處的程式碼**（那是文字層的事）；條件編譯只決定
 * **這一段跑不跑**（那是控制流，語義層本來就該有）。
 *
 * ## 原本的樣子
 *
 * 三個都註冊成空操作，於是 `#define N 1` 之後的 `#ifdef N` 區塊**永遠不跑**
 * ——使用者寫的程式碼靜靜地消失。
 *
 * 見 specs/057、`knowledge/history/014-墓碑目錄.md`
 */

/** 這次執行中被 `#define` 過的名字。每次執行重新開始 */
const defined = new Set<string>()

export function registerPreprocessorExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {
  register('cpp_define', async (node) => {
    const name = String(node.properties.name ?? '')
    if (name) defined.add(name)
  })

  register('cpp_ifdef', async (node, ctx) => {
    const name = String(node.properties.condition ?? '')
    if (defined.has(name)) await ctx.executeBody(node.children.body ?? [])
  })

  register('cpp_ifndef', async (node, ctx) => {
    const name = String(node.properties.condition ?? '')
    if (!defined.has(name)) await ctx.executeBody(node.children.body ?? [])
  })
}

/** 測試用：清空已定義的名字 */
export function resetDefinedMacros(): void {
  defined.clear()
}
