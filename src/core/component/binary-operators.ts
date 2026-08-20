/**
 * **二元運算子的登錄表** —— `+` 這個符號屬於哪一顆元件
 *
 * `lifters/expressions.ts` 原本內嵌三組集合：
 *
 * ```ts
 * if (ARITHMETIC_OPS.has(op)) component = 'cpp:arithmetic'
 * else if (COMPARE_OPS.has(op)) component = 'cpp:compare'
 * else if (LOGIC_OPS.has(op)) component = 'cpp:logic'
 * else component = 'cpp:arithmetic'   // ← 退路也是一個身分
 * ```
 *
 * 「這是不是 `binary_expression`」是 C++ 語法的知識，留在共用檔；
 * **「`+` 這個符號屬於我」是元件自己的宣告。**
 *
 * ⚠️ **退路那一行也要有人認領**——`else component = 'cpp:arithmetic'` 是說
 * 「認不得的二元運算子當算術處理」。那是一個**決定**，所以要有元件顯式宣告
 * 自己是那個兜底，不能靠共用檔記得。
 */
const table = new Map<string, { componentId: string; source: string }>()
let fallback: { componentId: string; source: string } | null = null

/**
 * @throws 同一個運算子被兩顆元件認領——**靜默覆蓋的症狀是「某個運算子
 *   突然變成另一種概念」**，而那不會有任何錯誤訊息。
 */
export function registerBinaryOperator(operators: string[], componentId: string, source: string): void {
  for (const op of operators) {
    const existing = table.get(op)
    if (existing && existing.componentId !== componentId) {
      throw new Error(
        `二元運算子「${op}」被兩顆元件認領：${existing.componentId}（${existing.source}）與 ${componentId}（${source}）。`,
      )
    }
    table.set(op, { componentId, source })
  }
}

/** 認不得的二元運算子由誰兜底。**顯式宣告，不是共用檔的預設值。** */
export function registerBinaryOperatorFallback(componentId: string, source: string): void {
  if (fallback && fallback.componentId !== componentId) {
    throw new Error(`二元運算子的兜底被兩顆元件認領：${fallback.componentId} 與 ${componentId}（${source}）。`)
  }
  fallback = { componentId, source }
}

/** 這個運算子屬於誰。認不得就回兜底；連兜底都沒登錄回 `undefined`——**不猜**。 */
export function binaryOperatorComponent(op: string): string | undefined {
  return table.get(op)?.componentId ?? fallback?.componentId
}
