/**
 * 轉型運算（US1b）
 *
 * ## 這不是「還沒實作」，是「實作被關掉」
 *
 * 四個轉型概念在 `src/languages/cpp/../executors/functions.ts` 有能用的實作。
 * 而（已退場的）JS 直譯器的「無執行行為」清單**在它們之後**才跑，
 * 用 `Map.set` 把它們蓋成空操作。
 *
 * 結果是 `static_cast<int>(3.9)` 得到的不是 3——而且沒有任何錯誤訊息。
 * 程式跑完、印出一個東西、而它是錯的。
 *
 * **修法是從清單刪掉那四行，不是新寫轉型邏輯。** 動手重寫的話會產生第五處
 * 註冊，而問題本來就是註冊太多處。
 *
 * 見 specs/053-declare-noop-execute/research.md F8
 *
 * 🔴 spec 202（重構 6c-2d）：執行判準從 JS 直譯器換成 Cella（`tests/helpers/cella-run.ts`）。
 * - `dynamic_cast<int>(double)`、`reinterpret_cast<int>(double)` **不是合法的 C++**（g++ -std=c++17：
 *   「invalid target type 'int' for dynamic_cast」「reinterpret_cast from 'double' to 'int' is not allowed」）——
 *   原本期望的 2／1 是 JS 直譯器自己的取捨。改成：不得 accept（399 起由 Cella 判 reject；之前是翻不出）。
 * - 「每個轉型概念只有一處註冊」那一條問的是 JS 直譯器的執行器表，隨直譯器退場，不搬。
 */
import { describe, it, expect } from 'vitest'
import { expectCellaOut, runCella, knownCellaGap } from '../helpers/cella-run'

const prog = (body: string): string => `#include <iostream>\nusing namespace std;\nint main(){ ${body} return 0; }\n`
const run = (body: string, want: string) => expectCellaOut(prog(body), want)

describe('轉型運算：實作一直都在，只是被清單蓋掉', () => {
  it('static_cast<int>(3.9) 是 3，不是 void', async () => {
    await run(`double d = 3.9; cout << static_cast<int>(d);`, '3')
  })

  it('static_cast 會截斷不會四捨五入', async () => {
    await run(`double d = 3.1; cout << static_cast<int>(d);`, '3')
    await run(`double d = 9.99; cout << static_cast<int>(d);`, '9')
  })

  // 依據：g++ -std=c++17 拒絕編譯（dynamic_cast 的目標只能是類別的指標／參照）——不合法的程式不得被判 accept
  it('dynamic_cast<int>(double) 不是合法的 C++：不得 accept', async () => {
    const r = await runCella(prog(`double d = 2.7; cout << dynamic_cast<int>(d);`))
    // 399（2026-11-11）補上 cast_dynamic 的 formalize 之後由 Cella 判 reject（原本是翻不出）
    expect(r.verdict).toBe('reject')
  })

  // 依據：g++ -std=c++17 拒絕編譯（reinterpret_cast 不做 double → int 的數值轉換）
  it('reinterpret_cast<int>(double) 不是合法的 C++：不得 accept', async () => {
    const r = await runCella(prog(`double d = 1.9; cout << reinterpret_cast<int>(d);`))
    // 399（2026-11-11）補上 cast_reinterpret 的 formalize 之後由 Cella 判 reject（原本是翻不出）
    expect(r.verdict).toBe('reject')
  })

  // const_cast 送 eConstCast（第 238 刀；cella 2026-11-03 給的專用形狀——結果是參照、是左值，不是 eCast 的值轉換）
  it('const_cast 有回傳值', async () => {
    await run(`int a = 5; const int c = a; cout << const_cast<int&>(c);`, '5')
  })

  // 原本不是 const、經 const 參照看到的物件，拿掉 const 之後可以寫（g++ 印 7）；寫一個本來就是 const 的物件才是未定義行為
  it('★ const_cast 拿掉 const 之後寫得回原本的物件', async () => {
    await run(`int x = 3; const int &c = x; const_cast<int &>(c) = 7; cout << x;`, '7')
  })

  it('轉型可以進運算式，不只是單獨印出來', async () => {
    await run(`double d = 3.7; cout << static_cast<int>(d) + 1;`, '4')
  })
})
