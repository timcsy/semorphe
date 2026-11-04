/**
 * 字串搜尋的起點與 npos（092）
 *
 * ## 起點是三支阻斷者不同的 todo，而它們共用一個根因
 *
 * `var_assign`（掃描迴圈）、`print`（括號布林運算式）、逗號運算子——
 * 三個標記各不相同。實測之後：
 *
 * | | 結果 |
 * |---|---|
 * | 括號布林運算式 | **早就正確**（091 修好布林輸出之後） |
 * | 逗號運算子 | **早就正確** |
 * | 掃描迴圈 | **真的壞** —— 兩個 bug 疊在一起 |
 *
 * ## 兩個 bug
 *
 * | 缺陷 | 後果 |
 * |---|---|
 * | 搜尋的**起點參數被丟掉** | `s.find("X", pos)` 永遠從頭找 → **無限迴圈** |
 * | 找不到時回 `4294967295` | 使用者寫 `!= -1` 的話，那個比較**永遠成立** |
 *
 * 兩個湊在一起的症狀是**爆步數上限**——離現場很遠，而且看起來像「程式太複雜」。
 *
 * ## 為什麼回 -1 而不是 npos
 *
 * C++ 的 `string::npos` 是 `size_t(-1)`，而**使用者常寫 `!= -1` 來比**。
 * 這個直譯器沒有把 npos 表示成一個常數，所以回 -1 讓兩種寫法都對。
 *
 * 🔴 spec 202：換成 Cella 之後，「印出來的是什麼」照 C++ 的答案——`cout << s.find("X")` 印 npos
 * （g++ -std=c++17，64 位元：`18446744073709551615`）；`!= -1` 那條仍然成立（`-1` 轉成 size_t 就是 npos），由掃描迴圈守。
 */
import { describe, it, expect } from 'vitest'
import { runCella, describeCellaResult, knownCellaGap } from '../helpers/cella-run'

// 🔴 spec 202（重構 6c-2d）：執行判準從 JS 直譯器換成 Cella（`tests/helpers/cella-run.ts`）——判不出、翻不出、判定有錯都丟出說得出原因的錯。
async function run(body: string): Promise<string> {
  const src = `#include <iostream>\n#include <string>\nusing namespace std;\nint main(){ ${body} return 0; }`
  const r = await runCella(src)
  if (r.verdict !== 'accept') throw new Error(describeCellaResult(r))
  return r.out
}

describe('搜尋的起點', () => {
  // 帶起點的 `find(x, pos)`：g++ 印 3（Cella 0.1.202611020258 曾判 reject，0.1.202611021533 修好）
  it('★ 從指定位置往後找', async () => {
    expect(
      (await run('string s = "aXbXc"; cout << s.find("X", 2);')).trim(),
      '起點被丟掉 → 永遠從頭找 → 掃描迴圈**無限跑**',
    ).toBe('3')
  })

  it('★ 沒給起點時從頭找——只驗有起點的話，「一律用起點 0」也會過', async () => {
    expect((await run('string s = "aXbXc"; cout << s.find("X");')).trim()).toBe('1')
  })
})

describe('找不到時的回傳值', () => {
  // 依據：g++ -std=c++17 印 18446744073709551615（npos = size_t(-1)）；原本的 -1 是 JS 直譯器的取捨
  it('★ 印出 npos（size_t 的最大值），不是 -1', async () => {
    expect(
      (await run('string s = "abc"; cout << s.find("X");')).trim(),
      'C++ 的 npos 是 size_t(-1)，印出來是 size_t 的最大值（`!= -1` 仍成立：-1 轉成 size_t 就是它）',
    ).toBe('18446744073709551615')
  })
})

describe('npos 這個名字本身（cella 0.1.202611041233 起認得）', () => {
  // 兩種寫法都要認成同一顆身分、照原文產回、而 Cella 判得出值。
  // 🔴 帶 `std::` 的那一種原本讀成 unresolved（辨識規則只寫了 `string::npos`），formalize 翻不出（2026-11-04 升級 Cella 時量到）
  it.each(['string::npos', 'std::string::npos'])('★ %s', async (name) => {
    const code = `#include <iostream>\n#include <string>\nusing namespace std;\nint main() {\n  string s = "ab";\n  cout << (s.find("z") == ${name}) << "\\n";\n  return 0;\n}\n`
    const r = await runCella(code)
    expect(JSON.stringify(r.tree), '認成 builtin_constant').toContain(`"value":"${name}"`)
    expect(r.verdict, describeCellaResult(r)).toBe('accept')
    expect(r.out).toBe('1\n')
  })
})

describe('掃描迴圈——兩個 bug 疊起來的實際症狀', () => {
  // Cella 判錯：同上，`s.find("X", pos)` 被判 reject（g++ 印 2）
  it('★ 數出所有出現次數（期望值由 g++ 決定）', async () => {
    const out = await run(`string s = "aXbXc";
  int pos = 0;
  int n = 0;
  while ((pos = s.find("X", pos)) != -1) {
      n = n + 1;
      pos = pos + 1;
  }
  cout << n;`)
    expect(out.trim(), '兩個 bug 湊起來的症狀是**爆步數上限**——離現場很遠').toBe('2')
  })
})

describe('順帶驗證：兩個過期的阻斷者', () => {
  it('★ 括號布林運算式（091 之後早就正確）', async () => {
    expect((await run('int a = 3; int b = 7; cout << (a < b) << (a > b) << ((a < b) && (b < 10));')).trim()).toBe('101')
  })

  it('★ 逗號運算子（早就正確）', async () => {
    expect((await run('int i; int t; for (i = 0, t = 0; i < 4; i++) { t = t + i; } cout << t;')).trim()).toBe('6')
  })
})
