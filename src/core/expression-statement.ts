/**
 * 「一個**運算式**出現在語句位置時怎麼收尾」的宣告登記處。
 *
 * ## 為什麼需要它
 *
 * 在此之前這件事寫死在 `projection/code-generator.ts` 的 `asStatement` 裡：
 *
 * ```ts
 * if (text === '' || text.endsWith('\n') || ctx.indent === 0) return text
 * return roleOf(node.componentId) === 'expression' ? `${indent(ctx)}${text};\n` : text
 * ```
 *
 * **兩件語言特定的事被寫成了普遍規則**：
 *
 * | | C++ | Python |
 * |---|---|---|
 * | 收尾 | `;` | 什麼都不加 |
 * | **頂層允許裸運算式嗎** | ❌（編譯單元層級不合法，所以 `indent === 0` 直接跳過） | ✅ `nums.append(9)` 就是一整行 |
 *
 * 症狀（2026-08-21 的第五十條護欄量到）：`nums.append(9)` 產回去
 * **既沒縮排也沒換行**，於是下一行黏上去變成 `nums.append(9)print(len(nums))`
 * ——**一段不合法的 Python，而它看起來只是排版怪**。
 *
 * > **一條「這個層級不合法」的規則，是那個語言的文法在說話，不是普遍真理。**
 *
 * ⚠️ 而那個分號**中立性護欄看不見**：它找的是元件身分字串，
 * 而這裡寫死的是語法符號——與 `comment-syntax.ts` 檔頭記的同一種盲點。
 *
 * ## 形狀
 *
 * 語言套件推、核心讀——與 `comment-syntax.ts`、`degradation-blocks.ts` 同一個形狀。
 */

/** 一個語言的「運算式當語句用」規則 */
export interface ExpressionStatementSyntax {
  /** 收尾字串（C++ 是 `;`，Python 是空字串） */
  suffix: string
  /**
   * 頂層（`indent === 0`）允許裸的運算式語句嗎？
   *
   * C++ ❌——編譯單元層級的裸運算式不合法，硬包出來會產出不能編譯的碼。
   * Python ✅——那就是最常見的一行。
   */
  allowedAtTopLevel: boolean
}

const registry = new Map<string, ExpressionStatementSyntax>()

/** 語言套件宣告自己的規則 */
export function declareExpressionStatement(language: string, syntax: ExpressionStatementSyntax): void {
  registry.set(language, syntax)
}

/**
 * 核心讀。
 *
 * ⚠️ **沒有宣告時回 `null`，不回一個預設值**——一個猜出來的預設會讓
 * 「這個語言忘了宣告」與「這個語言就是這樣」長得一模一樣，
 * 而症狀會是產出的碼少一個分號或多一個換行（**看起來像排版問題**）。
 */
export function expressionStatementOf(language: string | undefined): ExpressionStatementSyntax | null {
  return (language !== undefined ? registry.get(language) : undefined) ?? null
}
