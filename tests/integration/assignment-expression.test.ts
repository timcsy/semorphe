/**
 * 指派是運算式、指標有真假值、以及不會的事要出聲（085）
 *
 * ## 三個修正，都是查 `var_assign` 那批 todo 時撞到的
 *
 * `while ((p = f()) != 0)` 這個寫法**一次都不跑**，而程式照樣跑完、印出後面
 * 的東西。追下去有三層：
 *
 * | 層 | 症狀 |
 * |---|---|
 * | 指派不回傳值 | `(y = 5) != 0` 的左邊是 undefined → 比較恆假 |
 * | 指標轉數字一律 0 | `p != 0` 對**有效的指標**也是假 |
 * | `strchr` 靜默回 0 | 找得到也回 0 —— **安靜的錯答案** |
 *
 * **三層都是靜默降級**：沒有錯誤訊息、沒有例外、輸出看起來像一段跑完的程式。
 */
import { describe, it, expect } from 'vitest'
import { runCella, describeCellaResult } from '../helpers/cella-run'

// 🔴 spec 202（重構 6c-2d）：執行判準從 JS 直譯器換成 Cella（`tests/helpers/cella-run.ts`）——判不出、翻不出、判定有錯都丟出說得出原因的錯。
const src = (body: string): string => `#include <iostream>\n#include <cstring>\nusing namespace std;\nint main(){ ${body} return 0; }`
async function run(body: string): Promise<string> {
  const r = await runCella(src(body))
  if (r.verdict !== 'accept') throw new Error(describeCellaResult(r))
  return r.out
}

describe('指派是一個運算式', () => {
  it('★ 指派求值成被指派的值', async () => {
    expect(
      (await run('int y = 0; if ((y = 5) != 0) { cout << y; }')).trim(),
      '指派不回傳值 → 比較拿到 undefined → 條件恆假，**而迴圈／分支靜靜不跑**',
    ).toBe('5')
  })

  it('★ while 條件裡的指派', async () => {
    expect((await run('int n = 3; int v = 0; while ((v = n) != 0) { cout << v; n = 0; }')).trim()).toBe('3')
  })

  it('★ 指派仍然真的寫進變數——只驗回傳值的話，一個「回傳值但不寫入」的實作也會過', async () => {
    expect((await run('int y = 0; (y = 7); cout << y;')).trim()).toBe('7')
  })
})

describe('指標的真假值', () => {
  it('★ 有效的指標 != 0 為真', async () => {
    expect(
      (await run('int x = 1; int* p = &x; if (p != 0) { cout << "yes"; }')).trim(),
      '指標轉數字一律 0 → 有效的指標也判為空',
    ).toBe('yes')
  })

  it('★ 空指標 != 0 為假——只驗前一支的話，「指標一律為真」也會過', async () => {
    expect((await run('int* p = 0; if (p != 0) { cout << "wrong"; } cout << "done";')).trim()).toBe('done')
  })
})

describe('做不到的事要出聲，不得靜默回 0', () => {
  // 🔴 spec 202：原本這一條斷言 JS 直譯器**拒絕**（它表示不了指向陣列中間的指標，所以要說）。
  // Cella 的記憶體模型表示得了 ⟹ 換成 C++ 的答案（g++ -std=c++17 印 1／0），並守住「不是靜默回 0」：
  // 判決要是 accept、沒有任何 problem，找得到印 1、找不到印 0（只驗前者的話「一律為真」也會過）。
  // 若哪天又表示不了，runCella 會回 untranslated／unknown 並指名那顆元件——那就是「出聲」，而不是靜默的 0。
  it('★ strchr 回傳指向陣列中間的指標——找得到時 != 0 為真', async () => {
    const r = await runCella(src("char s[6] = \"hello\"; char* p = strchr(s, 'l'); cout << (p != 0);"))
    expect(r.verdict, describeCellaResult(r)).toBe('accept')
    expect(r.problems).toEqual([])
    expect(
      r.out,
      'strchr 靜默回 0 → `strchr(...) != 0` 對找得到的字元也是假，' +
        '而程式跑完印出後面的東西。**安靜的錯答案比報錯更糟。**',
    ).toBe('1')
  })

  it('★ 對照組：找不到時回空指標', async () => {
    expect(await run("char s[6] = \"hello\"; char* p = strchr(s, 'z'); cout << (p != 0);")).toBe('0')
  })
})
