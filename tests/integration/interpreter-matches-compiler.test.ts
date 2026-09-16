/**
 * **解譯器跑出來的，要和參照編譯器一樣**——最小重現的那一批。
 *
 * ## 它從哪來（2026-09-16）
 *
 * 使用者：「你有幫我驗證語料庫的執行結果與模擬的是一致的嗎？」——沒有。
 * 那 218 支學生程式的四支探針裡，`interpret`／`execute` 的出現次數是 **0**：
 * 量的全是形狀（殘差、不動點、載得進工作區、宣告的形狀）。
 *
 * 補上第五個面向之後（`tests/probes/studycpp-behaves.test.ts`），
 * 兩邊都跑得完的 91 支裡有 **41 支輸出不同**，而它們收斂成兩族：
 *
 * 
 * cout << '\n'   印出一個【反斜線】     ← properties.char 存的是原始碼文字，沒解跳脫
 * int a{7}       變成 1                ← 純量的大括號初始化沒有被拆開
 * 
 *
 * 🔴 **兩個都只錯在 `execute` 那一路**：lift 的樹是對的、產生器吐回去也是對的，
 * 所以第一百一十五／一百一十七／一百一十八條（形狀）**全綠**。
 *
 * > **一個只錯在 execute 那一路的缺陷，形狀是完美的
 * > ——而形狀完美正是它活下來的原因。**
 *
 * ## ⚠️ 這裡不放什麼
 *
 * **未定義行為不得進來**。第一版我寫了 `int n, L, c{}; cout << n;`
 * ——而讀一個沒初始化的 `n` 在 C++ 裡是 UB，g++ 印出 `-278200144`。
 * 那一題量的是「我們有沒有跟 g++ 一起做出同一個未定義的選擇」，不是行為。
 *
 * > **一條拿參照實作當權威的護欄，不得把【它也沒有答案的地方】寫進判準。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { runCppDetailed, hasReferenceCompiler } from '../helpers/run-cpp'
import type { SemanticNode } from '../../src/core/types'

const ROOT = process.cwd()
let parser: Parser
let lifter: ReturnType<typeof createTestLifter>

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${ROOT}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${ROOT}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
}, 120_000)

/** 🔴 每一題都是從真實的學生程式夾出來的——見檔頭。 */
const CASES: [string, string][] = [
  ['字元字面值 `\\n`（AP325/3/3_1）', `cout << 'A' << '\\n' << 'B';`],
  ['字元字面值 `\\t`', `cout << 'a' << '\\t' << 'b';`],
  ['字元字面值 `\\\\`', `cout << '\\\\';`],
  ['字元字面值的數值', `cout << (int)'0' << " " << (int)'a';`],
  ['字元相減', `cout << ('7' - '0');`],
  ['大括號值初始化（AP325/3/3_9）', `int a{}; cout << a;`],
  ['大括號帶值', `int a{7}; cout << a;`],
  ['一行兩個都帶大括號', `int c{}, mc{}; cout << c << mc;`],
  ['`long long` 的大括號', `long long ans{}; cout << ans;`],
  ['容器的大括號【不得】被拆開', `vector<int> v{1,2,3}; cout << v.size() << v[1];`],
  ['字串的大括號', `string s{}; cout << "[" << s << "]";`],
]

describe('解譯器與參照編譯器：同一段程式，印出來的要一樣', () => {
  it('★ 入口條件：真的有參照編譯器', () => {
    expect(hasReferenceCompiler(), '🔴 沒有 g++ → 下面每一條都在驗空氣').toBe(true)
  })

  for (const [name, body] of CASES) {
    it(`🔴 ${name}`, async () => {
      const src = '#include <iostream>\n#include <string>\n#include <vector>\n'
        + `using namespace std;\nint main(){ ${body} return 0; }\n`
      const ref = runCppDetailed(src)
      expect(ref.ok, `🔴 參照編譯器收不下這一段（測試自己的問題）：${
        ref.ok ? '' : ref.message}`).toBe(true)
      const tree = lifter.lift(parser.parse(src).rootNode as never) as SemanticNode
      const out: string[] = []
      const interp = new SemanticInterpreter({ maxSteps: 200_000 })
      interp.setOutputCallback((x) => out.push(x))
      await interp.execute(tree, [])
      expect(out.join(''), `🔴 跑出來不一樣\n   ${src.trim().split('\n').pop()}`)
        .toBe(ref.ok ? ref.output : '')
    }, 60_000)
  }
})
