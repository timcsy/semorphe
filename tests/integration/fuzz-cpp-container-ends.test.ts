/**
 * **模糊測試的回歸網：容器的兩端。**
 *
 * ## 它從哪來
 *
 * 一個**看不到原始碼**的代理（隔離 worktree）寫了 10 支中級 C++ 程式，
 * 全部 `g++ -std=c++17 -Wall` 編過、跑兩次輸出一致。
 * 第一輪過管線時：**程式碼 round-trip 10/10 PASS，而解譯器只有 1/10**。
 *
 * > **隔離是有作用的，不是形式**——我自己寫的測試七條全綠，
 * > 而一個不知道實作長什麼樣的人，第一批就問出四個我沒想到的形狀。
 *
 * ## 它抓到的（都已修好，下面每一條都是那些缺陷的最小重現）
 *
 * ```
 * 傳值沒有複製      int drain(deque<int> d) 清空它 → 呼叫者的容器也空了
 * 陣列參數被複製    而 C++ 的 deque<int> b[] 退化成指標，【不該】複製
 * 元素型別假裝是 int deque<string> 的元素被壓成 0
 * 帶下標的宣告子     string w[3] = {…} 被 lift 成一個叫 `w[3]` 的字串
 * ```
 *
 * ⚠️ **還開著的留在檔尾的 `it.todo`**，每一條都寫了為什麼不是現在修。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
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

const H = '#include <iostream>\n#include <deque>\n#include <vector>\n#include <string>\nusing namespace std;\n'

/** 跑一遍：拿 g++ 當權威，兩邊比 stdout。 */
async function both(glob: string, body: string): Promise<{ ref: string; got: string }> {
  const src = `${H}${glob}\nint main(){ ${body} return 0; }\n`
  const r = runCppDetailed(src)
  expect(r.ok, `🔴 參照編譯器收不下（測試自己的問題）：${r.ok ? '' : r.message}`).toBe(true)
  const out: string[] = []
  const interp = new SemanticInterpreter({ maxSteps: 300_000 })
  interp.setOutputCallback((x) => out.push(x))
  await interp.execute(lifter.lift(parser.parse(src)!.rootNode as never) as SemanticNode, [])
  return { ref: r.ok ? r.output : '', got: out.join('') }
}

describe.runIf(hasReferenceCompiler())('模糊測試的回歸：容器兩端', () => {
  it('🔴 傳值進函式要複製——被呼叫端改不到呼叫者的容器', async () => {
    const { ref, got } = await both(
      'int drain(deque<int> d){ int n=0; while(!d.empty()){ d.pop_front(); n++; } return n; }',
      `deque<int> dq; dq.push_back(1); dq.push_back(2); int n=drain(dq); cout << n << dq.size();`)
    expect(got, '🔴 少了複製的話「傳值」與「傳參考」行為完全相同').toBe(ref)
  }, 60_000)

  it('🔴 而【陣列參數】不複製——C++ 裡它退化成指標', async () => {
    const { ref, got } = await both(
      'void feed(deque<int> b[], int v){ b[1].push_back(v); }',
      `deque<int> bins[3]; feed(bins, 8); cout << bins[1].size() << bins[1].front();`)
    expect(got, '🔴 複製掉的話餵進去的東西全部留在函式裡').toBe(ref)
  }, 60_000)

  it('🔴 參考參數當然也改得到', async () => {
    const { ref, got } = await both(
      'int take(deque<int>& d){ int v=d.front(); d.pop_front(); return v; }',
      `deque<int> dq; dq.push_back(3); dq.push_back(5); cout << take(dq) << dq.size();`)
    expect(got).toBe(ref)
  }, 60_000)

  it('🔴 不知道元素型別就不要假裝是 int（`deque<string>`）', async () => {
    const { ref, got } = await both('',
      `deque<string> d; d.push_back("ab"); d.push_front("cd"); cout << d.front() << d.back() << d.size();`)
    expect(got, '🔴 壓成 int 的話字串會變成 0——程式跑完、印出東西、而它是錯的').toBe(ref)
  }, 60_000)

  it('🔴 帶下標的宣告子不得被字串那一支認領（`string w[3] = {…}`）', async () => {
    const { ref, got } = await both('',
      `string w[3] = {"aa","bb","cc"}; cout << w[1] << w[2].size();`)
    expect(got, '🔴 `[3]` 被吞進名字的話，`w` 根本沒有被宣告').toBe(ref)
  }, 60_000)

  it('🔴 兩端交錯：push_front／push_back／pop_front／pop_back', async () => {
    const { ref, got } = await both('',
      `deque<int> d; for(int i=1;i<=6;i++){ if(i%2==0) d.push_front(i); else d.push_back(i); }`
      + ` d.pop_front(); d.pop_back(); cout << d.front() << d.back() << d.size();`)
    expect(got).toBe(ref)
  }, 60_000)

  /**
   * ── 還開著的 ──────────────────────────────────────────
   *
   * ⚠️ 每一條都寫了**為什麼不是現在修**。「還沒做」不是理由。
   */

  /**
   * 🔴 **這兩條用 `it.fails` 不用 `it.todo`**——缺陷帳那條護欄逐字記著：
   * 「`it.todo` 本身就是一種殼：它宣告了一個缺陷，而**沒有任何機構在看那個缺陷
   * 還在不在**」。`it.fails` 會在修好的那天變紅，逼人來拔釘子。
   */
  /**
   * 🟢 **2026-09-18：這根釘子被拔了。** 接收者從字串屬性換成接點之後，
   * 下標是一棵樹——`i % 3` 由**同一份算術語義**求值，不需要第二份。
   *
   * > **一個「要自己寫一份小算式求值器才能修」的缺陷，
   * > 通常是在說那個東西本來就不該是字串。**
   */
  it('★ 接收者的下標帶乘除取餘', async () => {
    const { ref, got } = await both('',
      `vector<deque<int>> h(3); int i=4; h[i % 3].push_back(6); cout << h[1].front();`)
    expect(got).toBe(ref)
  }, 60_000)

  /** 🟢 **2026-09-18：同一根，同一天拔的**——接收者本來就是一棵樹。 */
  it('★ 接收者是一個運算式（`rows.front().push_back(9)`）', async () => {
    const { ref, got } = await both('',
      `deque<vector<int>> rows; rows.push_back({1,2}); rows.front().push_back(9);`
      + ` cout << rows.front().size();`)
    expect(got).toBe(ref)
  }, 60_000)

  /**
   * 🔴 **接收者的下標是一個【字串鍵】**——相鄰串列與分組統計的標準寫法。
   *
   * 這一族在 2026-09-18 之前整族斷在同一個地方：接收者被壓成一串文字，
   * 而解那串文字的地方只認得「名字、數字、以及它們的加減」。
   * 十支資訊隔離的盲測有 **7 支**死在上面。
   */
  it('★ 接收者的下標是字串鍵', async () => {
    // ⚠️ `<map>` 由 glob 補進來——`H` 那一份只有 deque／vector／string
    const { ref, got } = await both('#include <map>',
      `map<string, vector<int>> m; string k = "a"; m[k].push_back(5); m[k].push_back(7);`
      + ` cout << m[k].size();`)
    expect(got).toBe(ref)
  }, 60_000)

  it('★ 接收者的下標裡還有一個下標', async () => {
    const { ref, got } = await both('',
      `vector<int> b[2]; int keys[2] = {0, 1}; int i = 3; b[keys[i % 2]].push_back(9);`
      + ` cout << b[1].size() << b[1][0];`)
    expect(got).toBe(ref)
  }, 60_000)

  /**
   * 🔴 **`m[k]` 在鍵不存在時自動建的那一格，要照【值型別】長**
   *（相鄰串列 `g[a].push_back(b)` 就靠它）。在此之前一律補 `int 0`，
   * 而 `push_back` 說「這不是一個容器」。
   */
  it('★ 對照表的值是容器時，第一次存取就要建得出那個容器', async () => {
    const { ref, got } = await both('#include <map>',
      `map<int, vector<int>> g; g[3].push_back(1); g[3].push_back(2); g[5].push_back(9);`
      + ` cout << g[3].size() << g[5].front() << g.size();`)
    expect(got).toBe(ref)
  }, 60_000)

  /**
   * 🟠 **`m[k][0]`——對照表上的雙下標被認成【二維陣列】**（2026-09-18 隔離出來）。
   *
   * `map<int, vector<int>> g;` 的 `g[5][0]` lift 成 `cpp:array_2d_at`，
   * 於是它拿 `5` 當列索引去一個長度 1 的東西上取——`INDEX_OUT_OF_RANGE`。
   *
   * ⚠️ **接收者重構治不了它**：這是**身分選擇**的問題，不是接收者的形狀。
   * `x[a][b]` 只有在 `x` 真的是二維陣列時才是二維存取；`x` 是對照表時
   * 它是 `array_at(map_at(x, a), b)`。
   *
   * 🔴 **為什麼不是現在修**：那個分支要先問根變數的宣告型別，而它今天
   * 在 `subscript_expression` 的**外層**就決定了。與 `m[k]` 的巢狀那一族
   * 一起改比較安全——分開改會讓兩邊各認一半。
   * 🔴 **何時該修**：下一刀碰 `subscript_expression` 的身分選擇時。
   * ⚠️ 用 `it.fails` 不用 `it.todo`——修好的那天它會紅，逼人來拔釘子。
   */
  it.fails('[BLOCKED:cpp:array_2d_at] 🟠 對照表上的雙下標被認成二維陣列', async () => {
    const { ref, got } = await both('#include <map>',
      `map<int, vector<int>> g; g[5].push_back(9); cout << g[5][0];`)
    expect(got).toBe(ref)
  }, 60_000)

  it.todo('[UNSUPPORTED:deque<char> 傳值後的差異，根因未定位] 🟠 模糊測試 fuzz_9'
    + ' ——傳值複製已經修好，而這一支還有別的差異（字元的印法）沒查清楚。'
    + ' 🔴 不留一個「大概是這個」的修法：根因未定位前不動它。')

  it.todo('[UNSUPPORTED:巢狀容器的索引越界，根因未定位] 🟠 fuzz_3 的格子 BFS'
    + ' ——`RUNTIME_ERR_INDEX_OUT_OF_RANGE: 1`，而 g++ 跑得完。根因未定位。')
})
