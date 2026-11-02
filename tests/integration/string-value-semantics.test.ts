/**
 * 字串的值語義（086）——四個修正，而它們是同一次追查
 *
 * ## 起點是六支「連停用理由都不知道」的測試
 *
 * 缺陷帳裡有六支標成 `[UNVERIFIED]` 的 todo——**不知道為什麼停用**。
 * 逐一寫程式、用 g++ 定期望值、餵進直譯器，追出四個疊在一起的缺陷：
 *
 * | 缺陷 | 症狀 |
 * |---|---|
 * | 字串宣告**忽略初始值** | `string s = "abc"` 之後 `s` 是 `""` |
 * | 比較一律走 `toNumber` | 兩個字串都變 0 → `==` **恆真**、`!=` **恆假** |
 * | `push_back` 讀錯子槽 | 完全沒作用，而且不出聲 |
 * | 字元字面掉 char 型別 | `'x'` 串接成 `"120"` |
 *
 * **四個都是靜默的**：沒有錯誤訊息、沒有例外，輸出看起來像一段跑完的程式。
 * 那正是它們當初被停用時「不知道為什麼」的原因——**症狀離現場很遠**。
 *
 * ## 第一個是根因，它一修好就解掉三個症狀
 *
 * 字串沒有初始值 → `length()` 回 0、`substr()` 回空、`stoi()` 型別不符。
 * 三個看起來是三個 bug，其實是一個。
 */
// ⚠️ 091：C++ 的 `cout << (x > 2)` 印出 **1／0**，不是 `true`／`false`
// （後者要 `std::boolalpha`）。這個檔原本的斷言記錄的是**舊的錯誤輸出**，
// 期望值已改為 g++ 實際印出的東西。
import { describe, it, expect } from 'vitest'
import { runCella, describeCellaResult, expectCellaOut } from '../helpers/cella-run'

// 🔴 spec 202（重構 6c-2d）：執行判準從 JS 直譯器換成 Cella（`tests/helpers/cella-run.ts`）——判不出、翻不出、判定有錯都丟出說得出原因的錯。
async function run(body: string): Promise<string> {
  const src = `#include <iostream>\n#include <string>\nusing namespace std;\nint main(){ ${body} return 0; }`
  const r = await runCella(src)
  if (r.verdict !== 'accept') throw new Error(describeCellaResult(r))
  return r.out
}

describe('字串宣告要讀初始值（根因）', () => {
  it('★ `string s = "abc"` 之後 s 是 "abc"', async () => {
    expect(
      (await run('string s = "abc"; cout << s;')).trim(),
      '初始值被忽略 → 字串一律是空的，而後面每一個字串操作都安靜地錯',
    ).toBe('abc')
  })

  it('★ 一修好就解掉三個症狀：length／substr／stoi', async () => {
    expect((await run('string s = "abc"; cout << s.length();')).trim()).toBe('3')
    expect((await run('string s = "abcdef"; cout << s.substr(1,3);')).trim()).toBe('bcd')
    expect((await run('string a = "42"; cout << stoi(a);')).trim()).toBe('42')
  })

  it('★ 沒有初始值時仍是空字串', async () => {
    expect((await run('string s; cout << "[" << s << "]";')).trim()).toBe('[]')
  })
})

describe('字串比較要比內容', () => {
  it('★ 相等', async () => {
    expect((await run('string a = "abc"; if (a == "abc") { cout << "eq"; } else { cout << "ne"; }')).trim()).toBe('eq')
  })

  it('★ **不相等**——只驗相等的話，「一律相等」也會過', async () => {
    expect(
      (await run('string a = "abc"; if (a == "xyz") { cout << "wrong"; } else { cout << "ne"; }')).trim(),
      '比較一律走 toNumber → 兩個字串都變 0 → `==` **恆真**',
    ).toBe('ne')
  })

  it('★ 大小比較用字典序', async () => {
    expect((await run('string a = "abc"; cout << (a < "abd");')).trim()).toBe('1')
  })

  it('★ 數字比較不得被影響', async () => {
    expect((await run('int a = 3; if (a == 3) { cout << "eq"; } if (a == 4) { cout << "wrong"; }')).trim()).toBe('eq')
  })
})

describe('push_back', () => {
  it('★ 真的接上字元', async () => {
    expect(
      (await run("string s = \"ab\"; s.push_back('x'); cout << s;")).trim(),
      'push_back 讀錯子槽 → **完全沒作用，而且不出聲**',
    ).toBe('abx')
  })

  it('★ 字元字面不得變成數字碼', async () => {
    expect(
      (await run("string s = \"\"; s.push_back('x'); cout << s;")).trim(),
      "'x' 求值成 120 → 串接成 \"120\"，與 082 在陣列初始化列表遇到的是同一個病",
    ).toBe('x')
  })

  it('★ 迴圈裡連續 push_back', async () => {
    expect(
      (await run("string s = \"\"; for (int i=0;i<3;i++){ s.push_back('x'); } if (s == \"xxx\") { cout << \"match\"; } else { cout << s; }")).trim(),
    ).toBe('match')
  })
})

/**
 * 🔴 **「string x{};」是空字串，不是「用 0 建一個字串」**（2026-11-03，升級 Cella 0.1.202611021533 時在學生的 6_advanced_inout 露出來）：
 * formalize 原本把空大括號一律翻成 0，字串那一格就成了 `string x = 0`——從空指標建字串，Cella 判 ubNull（判得對，送錯的是我們）。
 */
describe('空大括號初始化的字串', () => {
  it('★ string x{} 之後 getline 讀得進來', async () => {
    await expectCellaOut('#include <iostream>\n#include <string>\nusing namespace std;\nint main() {\n  string x{};\n  getline(cin, x);\n  cout << "[" << x << "]" << x.size();\n}\n', '[hi]2', { stdin: 'hi\n' })
  }, 120_000)
  it('★ string x{} 本身是空字串', async () => {
    await expectCellaOut('#include <iostream>\n#include <string>\nusing namespace std;\nint main() {\n  string x{};\n  cout << "[" << x << "]" << x.size();\n}\n', '[]0')
  }, 120_000)
  it('★ 數字的空大括號仍是 0', async () => {
    await expectCellaOut('#include <iostream>\nusing namespace std;\nint main() {\n  int n{};\n  char c{};\n  cout << n << (c == 0);\n}\n', '01')
  }, 120_000)
})
