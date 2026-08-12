/**
 * 「C++ 修飾詞 → 元件身分」的登錄表
 *
 * `const int x = 1;` 與 `constexpr int x = 1;` 是**兩顆元件**，
 * 而它們的差別只有一個關鍵字。原本那個對應寫在一個三元運算子裡：
 *
 * ```ts
 * const conceptId = qualifier === 'const' ? 'cpp:var_declare_const'
 *                                         : 'cpp:var_declare_constexpr'
 * ```
 *
 * > **一顆元件可以只以「一個三元運算子的其中一支」存在。**
 * > 而那種形式**不會出現在任何「建立點」的統計裡**——它不是建立，是選名字。
 * > 找可搬元件時只數 `createNode` 會漏掉這一類。
 *
 * ⚠️ 表是空的：核心給機制、套件給資料。
 */

const table = new Map<string, { conceptId: string; source: string }>()

export function registerQualifierConcept(qualifier: string, conceptId: string, source: string): void {
  const existing = table.get(qualifier)
  if (existing && existing.conceptId !== conceptId) {
    throw new Error(
      `修飾詞「${qualifier}」被登錄兩次且指向不同身分：` +
        `${existing.conceptId}（${existing.source}）與 ${conceptId}（${source}）。`,
    )
  }
  table.set(qualifier, { conceptId, source })
}

/** 修飾詞 → 元件身分。認不得回 `undefined`。 */
export function qualifierConcept(qualifier: string): string | undefined {
  return table.get(qualifier)?.conceptId
}
