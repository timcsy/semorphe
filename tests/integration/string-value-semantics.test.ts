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
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import type { Lifter } from '../../src/core/lift/lifter'

let tp: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tp = new Parser()
  tp.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
})

async function run(body: string): Promise<string> {
  const src = `#include <iostream>\n#include <string>\nusing namespace std;\nint main(){ ${body} return 0; }`
  const interp = new SemanticInterpreter({ maxSteps: 50000 })
  await interp.execute(lifter.lift(tp.parse(src)!.rootNode as never) as never)
  return interp.getOutput().join('')
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
    expect((await run('string a = "abc"; cout << (a < "abd");')).trim()).toBe('true')
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
