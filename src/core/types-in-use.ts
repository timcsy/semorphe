/**
 * **這支程式用過哪些型別**——導出的，不是宣告的。
 *
 * ## 🔴 它解的是「我宣告過的型別，我選不到」
 *
 * 學生寫 `struct Point { … }; Point p;`，然後拉一顆變數宣告積木
 * ——而型別的下拉裡**沒有 `Point`**。
 *
 * ⚠️ **那不是一個正確性的 bug**：他打字寫得出來（認不得的值不會被換掉）。
 * 壞的是**可發現性**——他知道自己宣告過，而清單不知道。
 *
 * > **一份「這個欄位可以填什麼」的清單，如果它是宣告的而不是導出的，
 * > 那它描述的是【我們想到的】，不是【這支程式裡有的】。**
 *
 * ## ⚠️ 它讀語義樹，不重新解析程式碼
 *
 * 🔴 重新解析會是**第二個真相**：同一份程式兩個地方各解一次，
 * 而它們遲早會不一樣（這個 repo 記過那個形狀很多次）。
 *
 * ## ⚠️ 它不知道任何語言的型別名
 *
 * 這個檔住在 `src/core/`。「一棵樹上用過哪些型別」是核心問得出來的問題；
 * **「C++ 的內建型別有哪些」不是**——那份清單留在語言那一側。
 */
import type { SemanticNode } from './types'

/**
 * 走一遍樹，收集宣告節點帶著的型別名。
 *
 * ## 🔴 它拿不到 `vector<int>`，而那是【對的】
 *
 * 實測（2026-09-06）：
 *
 * ```
 * vector<int> v;   → cpp:vector_declare 的 type 是 "int"     ← 元素型別
 * int* p;          → cpp:pointer_declare 的 type 是 "int"     ← 同上
 * struct Point{};  → cpp:var_declare    的 type 是 "Point"    ← 這一個才是目標
 * ```
 *
 * ⚠️ **容器那一層的資訊住在【身分】裡，不在屬性裡**——`cpp:vector_declare`
 * 這個身分本身就說了「它是一個容器」。所以掃 `type` 拿到的是元素型別。
 *
 * > **一個「用過哪些型別」的掃描，掃到的是【元素】而不是【容器】
 * > ——因為容器那一層的資訊住在身分裡，不在屬性裡。**
 *
 * 🟢 而這一支**接受那個界線**：它要解的是「自訂型別選不到」，
 * 而 `vector<int>` 有它自己的積木。
 *
 * ## ⚠️ 打錯字的型別照樣收
 *
 * 系統**分不出**「打錯字」（`itn`）與「還沒宣告的自訂型別」，
 * 而猜錯的代價不對稱：
 *
 * ```
 * 漏掉一個真的型別   學生選不到 → 那正是今天的 bug
 * 多一個錯字         多一列
 * ```
 *
 * > **一個會替使用者修正錯字的清單，
 * > 會在它猜錯的時候把真的東西藏起來。**
 *
 * @returns 用過的型別名，**依它們在樹上出現的順序**（穩定，不排序）
 *   ——⚠️ 排序會讓下拉的內容隨無關的改動跳動。
 */
export function typesInUse(root: SemanticNode | null | undefined): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const walk = (n: SemanticNode | null | undefined): void => {
    if (!n || typeof n !== 'object') return
    const t = n.properties?.type
    if (typeof t === 'string' && t.length > 0 && !seen.has(t)) {
      seen.add(t)
      out.push(t)
    }
    for (const bucket of Object.values(n.children ?? {})) {
      for (const c of bucket ?? []) walk(c)
    }
  }
  walk(root)
  return out
}

/**
 * **內建清單 ∪ 程式裡用過的**——而內建那幾個的**順序與位置不動**。
 *
 * 🔴 課程在依賴那個順序（第一個是 `int`）。
 *
 * > **一份清單的順序，在有人照著它寫教材之後就是介面的一部分。**
 *
 * ⚠️ 比對用的是**值**（第二格），不是顯示文字——顯示文字會被翻譯，
 * 而同一個型別在兩個語系下會長得不一樣。
 */
export function withTypesInUse(
  builtin: readonly (readonly [string, string])[],
  used: readonly string[],
): Array<[string, string]> {
  const have = new Set(builtin.map((o) => o[1]))
  const out: Array<[string, string]> = builtin.map((o) => [o[0], o[1]])
  for (const t of used) {
    if (have.has(t)) continue
    have.add(t)
    // ⚠️ 顯示文字就是它自己——這是**使用者寫的名字**，沒有東西可以翻譯它
    out.push([t, t])
  }
  return out
}

// ─── 誰餵這棵樹 ────────────────────────────────────────────────────────

/**
 * **現在畫面上那支程式**——由組裝點餵，而下拉來源讀它。
 *
 * ## ⚠️ 為什麼是一個登記處，不是一個參數
 *
 * 下拉來源的簽章是 `(ctx?) => 選項[]`，而 `ctx` 裡只有
 * 「這顆積木是誰、接在誰身上」——**沒有樹**。
 *
 * 🔴 而把樹塞進 `ctx` 會讓**每一個**下拉來源都收到它，
 * 包括那些完全不需要的（語系、風格、板子）——那是把一個
 * 特例的需求變成所有人的簽章。
 *
 * 🟢 所以走與變數那份**同一條路**：一個具名的來源，
 * 由組裝點在同步之後餵一次。
 *
 * ⚠️ **沒有人餵時回 `null`**，而消費端退回內建清單
 * ——那與「沒有這個功能」時的行為相同（安全的那一邊）。
 */
let currentTree: SemanticNode | null = null

/** 組裝點在每次語義更新之後呼叫。 */
export function setTreeForTypeLookup(tree: SemanticNode | null): void {
  currentTree = tree
}

/** 下拉來源讀它。⚠️ 沒有人餵過就是空的——**不是錯誤**，是還沒同步。 */
export function typesInCurrentProgram(): string[] {
  return typesInUse(currentTree)
}
