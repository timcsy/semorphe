/**
 * **二元運算子的登錄表** —— `+` 這個符號屬於哪一顆元件
 *
 * `lifters/expressions.ts` 原本內嵌三組集合：
 *
 * ```ts
 * if (ARITHMETIC_OPS.has(op)) concept = 'cpp:arithmetic'
 * else if (COMPARE_OPS.has(op)) concept = 'cpp:compare'
 * else if (LOGIC_OPS.has(op)) concept = 'cpp:logic'
 * else concept = 'cpp:arithmetic'   // ← 退路也是一個身分
 * ```
 *
 * 「這是不是 `binary_expression`」是 C++ 語法的知識，留在共用檔；
 * **「`+` 這個符號屬於我」是元件自己的宣告。**
 *
 * ⚠️ **退路那一行也要有人認領**——`else concept = 'cpp:arithmetic'` 是說
 * 「認不得的二元運算子當算術處理」。那是一個**決定**，所以要有元件顯式宣告
 * 自己是那個兜底，不能靠共用檔記得。
 */
const 表 = new Map<string, { conceptId: string; source: string }>()
let 兜底: { conceptId: string; source: string } | null = null

/**
 * @throws 同一個運算子被兩顆元件認領——**靜默覆蓋的症狀是「某個運算子
 *   突然變成另一種概念」**，而那不會有任何錯誤訊息。
 */
export function registerBinaryOperator(運算子們: string[], conceptId: string, source: string): void {
  for (const op of 運算子們) {
    const existing = 表.get(op)
    if (existing && existing.conceptId !== conceptId) {
      throw new Error(
        `二元運算子「${op}」被兩顆元件認領：${existing.conceptId}（${existing.source}）與 ${conceptId}（${source}）。`,
      )
    }
    表.set(op, { conceptId, source })
  }
}

/** 認不得的二元運算子由誰兜底。**顯式宣告，不是共用檔的預設值。** */
export function registerBinaryOperatorFallback(conceptId: string, source: string): void {
  if (兜底 && 兜底.conceptId !== conceptId) {
    throw new Error(`二元運算子的兜底被兩顆元件認領：${兜底.conceptId} 與 ${conceptId}（${source}）。`)
  }
  兜底 = { conceptId, source }
}

/** 這個運算子屬於誰。認不得就回兜底；連兜底都沒登錄回 `undefined`——**不猜**。 */
export function binaryOperatorConcept(op: string): string | undefined {
  return 表.get(op)?.conceptId ?? 兜底?.conceptId
}
