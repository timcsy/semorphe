/**
 * vector 的初始化列表（094）
 *
 * ## 這個缺陷四路裡壞了三路，而來回轉換看起來「成功」
 *
 * `vector<int> v = {3,1,4}` 原本：
 *
 * | 路 | 狀況 |
 * |---|---|
 * | 辨識 | 初始化列表**整段丟掉** |
 * | 產生 | 產回 `vector<int> v;` —— **合法程式，只是不是使用者寫的那段** |
 * | 執行 | 空的向量 → `v[1]` 索引越界、`v.size()` 是 0 |
 *
 * **辨識丟掉、產生也跟著少，於是來回轉換前後「一致」**——只有跑起來才會現形。
 * 那正是「只驗來回轉換抓不到」的典型。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { expectCellaOut, knownCellaGap } from '../helpers/cella-run'
import type { Lifter } from '../../src/core/lift/lifter'
import type { StylePreset } from '../../src/core/types'
import apcs from '../../src/languages/cpp/styles/apcs.json'

let tp: Parser
let lifter: Lifter
const style = apcs as unknown as StylePreset

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tp = new Parser()
  tp.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
})

const wrap = (body: string, extra = ''): string =>
  `#include <iostream>\n#include <vector>\n#include <string>\n${extra}using namespace std;\nint main(){ ${body} return 0; }`
const lift = (b: string) => lifter.lift(tp.parse(wrap(b))!.rootNode as never)
const roundTrip = (b: string): string => generateCode(lift(b) as never, 'cpp', style)

// spec 198（重構 6c-1）：執行的判準從 JS 直譯器換成 Cella——期望值照舊是 g++ 印的（`tests/helpers/cella-run.ts`）
const run = (b: string, expected: string) => expectCellaOut(wrap(b), expected)

describe('產生：初始化列表要一起產回去', () => {
  it('★ 整數', () => {
    expect(
      roundTrip('vector<int> v = {3,1,4};'),
      '產回 `vector<int> v;` —— **合法程式，只是不是使用者寫的那段**',
    ).toContain('vector<int> v = {3, 1, 4}')
  })

  it('★ 沒有初始值時不得多出一對大括號', () => {
    const g = roundTrip('vector<int> v;')
    expect(g).toContain('vector<int> v;')
    expect(g).not.toContain('= {}')
  })
})

describe('執行：期望值由 g++ 決定', () => {
  it('★ 元素與長度都對（g++ 印 `8 1`）', async () => {
    // 原本的錯：空的向量 → 索引越界、size 是 0
    await run('vector<int> v = {3,1,4}; int s=0; for(int i=0;i<v.size();i++){ s=s+v[i]; } cout<<s<<" "<<v[1];', '8 1')
  })

  it('★ 字串向量（g++ 印 `bob 2 0`）', async () => {
    await run('vector<string> names = {"ann","bob"}; vector<int> e; cout << names[1] << " " << names.size() << " " << e.size();', 'bob 2 0')
  })

  it('★ 空向量仍是空的——只驗有初始值的話，「一律填東西」也會過', async () => {
    await run('vector<int> v; cout << v.size();', '0')
  })

  it('★ `vector<int> v(5)` 不是列表初始化，不得被當成初始值', async () => {
    // 那是「建立 5 個元素」的建構式呼叫，語法上是 argument_list 不是
    // initializer_list。把它當成列表的話 `v` 會變成 `{5}`。
    const g = roundTrip('vector<int> v(5);')
    expect(g, '建構式呼叫被當成初始化列表了').not.toContain('= {5}')
  })
})

/**
 * 巢狀的大括號初始值：內層兩個元素的大括號是兩個元素，不是建構引數 `(n, val)`——標準 [over.match.list]：有 initializer_list 建構子時優先選它（g++ 印 `2 4 2`）。
 * 🟢 Cella 0.1.202611021533 是**安靜錯答**（印「4 1 9」），0.1.202611021901 修好。
 * 🟢 而同一刀帶出的回歸（內層**空的**大括號 `{}` 判 reject，g++ 印 `305`）在 0.1.202611022353 修好。
 */
describe('巢狀的大括號初始值', () => {
  it('內層兩個元素的大括號是兩個元素，不是建構引數', async () => {
    await expectCellaOut('#include <iostream>\n#include <vector>\nusing namespace std;\nint main() {\n  vector<vector<int>> d2 = {{4, 1}, {9, 7}};\n  cout << d2[0].size() << " " << d2[0][0] << " " << d2[1].size();\n}\n', '2 4 2')
  }, 120_000)
  it('內層空的大括號是一個空的 vector', async () => {
    await expectCellaOut('#include <iostream>\n#include <vector>\nusing namespace std;\nint main() {\n  vector<vector<int>> d = {{4, 1}, {}, {5}};\n  cout << d.size() << d[1].size() << d[2][0];\n}\n', '305')
  }, 120_000)
})
