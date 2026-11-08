/** `cpp:array_declare` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'
import { isCharStringInit } from './char-string-init'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.decl('cpp:array_declare', (n, f, global) => {
    const elem = f.type(n.properties?.type, n)
    if (!elem) return []
    const values = n.slots?.values ?? []
    // `int a[] = {7, 8}`：沒寫大小時，長度由大括號初值串列的項數決定（[dcl.init.aggr]/7，spec 202）。
    // 字元陣列的字串初值（`char s[] = "ab"`）長度不在這裡算——交給 Cella（下面的 tArrU）
    const len = f.one(n, 'size') === undefined && values.length > 0 && !isCharStringInit(n)
      ? values.length
      : f.constInt(f.one(n, 'size'))
    // 🟢 長度不是我們算得出的整數字面時，**把運算式原樣交給 Cella**（`tArrE`，cella 0.1.202611060800——「意思歸 Cella」）：
    //    常數運算式（`const int N = 1e5 + 5; int a[N];`、`int a[N * 2 + 1]`）照定長陣列算出值；不是常數的照 VLA 的規則
    //    （區塊裡、沒有初始化子 → 照 g++ 執行、判決帶 gcc:vla 假設；檔案範圍或帶初值 → reject）；C 與 C++ 對「常數」的認定由 Cella 依語言分開判。
    //    原本這裡自己判「全域或帶初值就標翻不出」、區域的送 sDeclV——兩件都是在替 Cella 決定意思（StudyCpp 的 template/Cn_k.cpp 就卡在這）。
    if (len === null) {
      // 🟢 沒寫長度、用字串初始化（`char word[] = "hello"`）：送 `tArrU` ＋ iE 字串，長度由 Cella 照 C11 6.7.9p14 定
      //    （字元數＋結尾 NUL、跳脫照實算、多位元組照 UTF-8 位元組數；cella 2026-11-08 給的形狀）——不在這裡自己算。
      //    `int a[];`（沒長度也沒初值）照樣送 tArrU、不帶初值——不完整型別的判斷歸 Cella。
      if (f.one(n, 'size') === undefined) {
        return f.declInit(n, f.k('tArrU', { t: elem }), isCharStringInit(n) ? f.initOf(values[0]) : null, global)
      }
      const t = f.k('tArrE', { t: elem, len: f.exprOf(n, 'size') })
      const init = isCharStringInit(n) ? f.initOf(values[0]) : values.length > 0 ? f.braceList(n, 'values') : null
      return f.declInit(n, t, init, global)
    }
    const t = f.k('tArr', { t: elem, n: len })
    // 字元陣列的字串初值是一個運算式（iE），不是初值串列——判準與 generate.ts 相同（第 394 刀）
    const init = isCharStringInit(n) ? f.initOf(values[0])
      : values.length > 0 ? f.braceList(n, 'values') : null
    return f.declInit(n, t, init, global)
  })
}
