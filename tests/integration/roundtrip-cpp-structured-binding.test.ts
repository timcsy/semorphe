/**
 * **結構化繫結與走訪的對象：五個面向的回歸網。**
 *
 * ## 它從哪來
 *
 * 語料（218 支學生程式）量到 `auto [` **16 處／13 支**，而每一處都被
 * **安靜地答錯**：那一串名字被塞進自動型別宣告的名字那一格，於是執行期
 * 真的宣告了一個叫 `[pt,d]` 的變數——**下一行用到 `pt` 時說「沒有宣告過」**。
 *
 * ## 🔴 這個檔專門守【③ 載得進工作區】與【④ 走一趟積木回來】
 *
 * 那兩個面向在 2026-09-10 之前完全沒有人量，而它們的症狀與 ①② 不同：
 *
 * ```
 * ① 產出的程式碼      lift → 產碼                  紅了：產出不一樣
 * ② 語義的不動點      lift → 產碼 → 再 lift         紅了：來回一趟就變
 * ③ 載得進工作區嗎    render → Blockly load        🔴 紅了：一片空白（不是少一行）
 * ④ 走一趟積木回來    render → extract → 產碼       🔴 紅了：學生一動積木，程式碼就少東西
 * ⑤ 跑起來一不一樣    execute vs 參照編譯器          住在 `interpreter-matches-compiler`
 * ```
 *
 * 這一刀動了**兩個積木的畫法**：新的「分別取出」，以及範圍 for 的
 * 走訪對象從**欄位**換成**接點**——後者是最大的迴歸風險，
 * 因為 `for (int x : v)` 這種舊寫法走的是同一條路。
 *
 * ⚠️ 形狀**從語料蒸餾**，不抄一整支——常駐測試不得依賴外部 repo
 * （`STUDYCPP_DIR` 沒設時探針會跳過，而**跳過的護欄與不存在的護欄長得一樣**）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { runCppDetailed } from '../helpers/run-cpp'
import { RenderStrategyRegistry } from '../../src/core/registry'
import { registerCppRenderStrategies } from '../../src/languages/cpp/renderers/strategies'
import { BlockSpecRegistry } from '../../src/core/blocks/block-spec-registry'
import { allCppComponents, allCppProjections } from '../../src/languages/cpp/all-declarations'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode, StylePreset } from '../../src/core/types'
import apcs from '../../src/languages/cpp/styles/apcs.json'

const style = apcs as unknown as StylePreset
let parser: Parser
let lifter: Lifter
let extractor: PatternExtractor
let renderer: PatternRenderer

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
  setupTestRenderer()
  const registry = new BlockSpecRegistry()
  registry.loadFromSplit(allCppComponents(), allCppProjections())
  extractor = new PatternExtractor()
  extractor.loadBlockSpecs(registry.getAll())
  // ⚠️ **用同一條路**：`renderToBlocklyState` 要的是**整棵樹的根**（它問「這顆是不是根」），
  //    而這裡要的是**一顆節點畫成一塊積木**——那是 `PatternRenderer.render`。
  //    走錯的症狀是 `extract` 全部回 null，**包含正向錨點**——而那正是「harness 壞了」的簽名。
  const rs = new RenderStrategyRegistry()
  registerCppRenderStrategies(rs)
  renderer = new PatternRenderer()
  renderer.setRenderStrategyRegistry(rs)
  renderer.loadBlockSpecs(registry.getAll())
}, 120_000)

const H = '#include <bits/stdc++.h>\nusing namespace std;\n'
const lift = (code: string): SemanticNode => lifter.lift(parser.parse(code)!.rootNode as never) as SemanticNode
const gen = (n: SemanticNode): string => generateCode(n, 'cpp', style)

/** 第一個符合的節點——從語義樹裡挖出被測的那一顆。 */
function findOne(n: SemanticNode | null, id: string): SemanticNode | null {
  if (!n) return null
  if (n.componentId === id) return n
  for (const kids of Object.values(n.slots ?? {})) {
    for (const k of (kids ?? []) as SemanticNode[]) { const r = findOne(k, id); if (r) return r }
  }
  return null
}

/**
 * 面向③④：**畫成積木，再從積木抽回來**。
 *
 * ⚠️ 回傳的是抽回來的那棵樹——斷言由呼叫端做，
 * 因為「哪一格不得掉」是那顆元件的知識。
 */
function throughBlocks(sem: SemanticNode): { block: Record<string, unknown>; back: SemanticNode } {
  const block = renderer.render(sem) as Record<string, unknown> | null
  expect(block, '🔴 ③ 畫不出積木——那是「一片空白」，不是少一行').not.toBeNull()
  const back = extractor.extract(block as never) as SemanticNode | null
  expect(back, '🔴 ④ 抽不回來——學生一動積木，程式碼就少東西').not.toBeNull()
  return { block: block as Record<string, unknown>, back: back as SemanticNode }
}

describe('結構化繫結與走訪的對象：五個面向', () => {
  // ── ①② 語料真正的寫法 ────────────────────────────────
  //
  // ⚠️ 語料 15/16 處**不寫空格**（`auto[pt,d]`）。產出寫 `auto [pt, d]` 是
  //    **排版不是行為**（判準③），而這裡釘住的是「名字一個都不掉」。
  const SHAPES: [string, string, string[]][] = [
    ['宣告式：兩個名字（語料最常見）',
      'int main(){ auto[pt,d] = BFS.front(); }', ['auto [pt, d] = BFS.front();']],
    ['宣告式：三個名字',
      'int main(){ auto[u,v,w] = ms.top(); }', ['auto [u, v, w] = ms.top();']],
    ['宣告式：就地修改（`auto&`）',
      'int main(){ auto& [k,val] = *m.begin(); }', ['auto& [k, val] = *m.begin();']],
    ['範圍 for：拆名 ＋ 下標容器',
      'int main(){ for(auto[w,to] : ar[P]) f(w); }', ['for (auto [w, to] : ar[P])']],
    ['範圍 for：舊的簡單寫法不得被弄壞',
      'int main(){ for(int x : v) f(x); }', ['for (int x : v)']],
    ['範圍 for：走訪的對象是對照表的一格',
      'int main(){ for(int i : m[k]) f(i); }', ['for (int i : m[k])']],
    ['雙端佇列的宣告（語料 22 支）',
      'int main(){ deque<pair<int,int>> BFS; }', ['deque<pair<int,int>> BFS;']],
    /**
     * 🔴 **同一顆元件的第二個樣板名**（round-trip 探針量到的，語料 4 支走樣）。
     *
     * 兩個型別參數要放哪兩格，本來是一條按**樣板名**分派的 `if` 鏈
     * （`=== 'map'`／`=== 'pair'`），而 `unordered_map` 與 `map` 是**同一顆元件**
     * ——於是它落到最後那條 `else`，產出 `type: "string,bool"`，
     * 而產碼那一側讀不到 `key_type` 就補 `int, int`：
     * **`unordered_map<string,bool>` 變成 `unordered_map<int,int>`**。
     *
     * > **一個按「名字」分派的特例表，在同一個東西有第二個名字的那天
     * > 會安靜地漏掉它——而那個東西的行為看起來只是「預設值」。**
     *
     * 🟢 而那條 `if` 鏈旁邊**早就寫著修法**：「第三個出現時該收斂成
     * 『從 `component.json` 的 properties 宣告推導』，而不是再加一個 `if`。」
     */
    ['🔴 同一顆元件的第二個樣板名：`unordered_map` 的鍵型別',
      'int main(){ unordered_map<string,bool> mp; }', ['unordered_map<string, bool> mp;']],
    ['★ 正向錨點：有序的那一個本來就是對的',
      'int main(){ map<string,int> mp; }', ['map<string, int> mp;']],
    ['★ 正向錨點：一對值的兩個型別參數',
      'int main(){ pair<int,string> p; }', ['pair<int, string> p;']],
    ['★ 正向錨點：只有一個型別參數的容器不得被拆成兩格',
      'int main(){ multiset<pair<int,int>> ms; }', ['multiset<pair<int,int>> ms;']],
    /**
     * 🔴 **`int x, y;` 要產回成一行**（round-trip 探針量到的最後一支走樣）。
     *
     * 攤成兩行是**合法而且行為相同**的 C++，所以 ①④⑤ 三個面向都是綠的
     * ——紅的是 **② 語義的不動點**：再 lift 一次，一顆合併的成員宣告
     * 就變成兩顆平行的。
     *
     * > **一個只在「再走一趟」時才看得出來的差別，
     * > 每一個只走一趟的檢查都會是綠的。**
     */
    ['🔴 結構的成員：`int x, y;` 要產回成一行',
      'struct Point{ int x, y; };\nint main(){ Point p; }', ['int x, y;']],
    ['★ 正向錨點：型別不同的兩格不得被併回一行（星號屬於型別）',
      'struct Node{ Node *next, prev; };\nint main(){ }', ['Node* next;', 'Node prev;']],
  ]

  for (const [name, src, wants] of SHAPES) {
    it(`① 產出的程式碼：${name}`, () => {
      const out = gen(lift(H + src))
      for (const w of wants) expect(out, `🔴 產出裡找不到「${w}」`).toContain(w)
    })

    it(`② 語義的不動點：${name}`, () => {
      const once = gen(lift(H + src))
      expect(gen(lift(once)), '🔴 來回一趟就變——那是可逆性的違反').toBe(once)
    })
  }

  // ── ③④ 這一刀動過畫法的兩顆積木 ──────────────────────
  describe('③④ 走一趟積木回來', () => {
    it('🔴 分別取出：N 個名字欄位 ＋ 一個接點，一格都不得掉', () => {
      const sem = findOne(lift(`${H}int main(){ auto[pt,d] = BFS.front(); }`), 'cpp:var_declare_sequence')
      expect(sem, 'lift 失敗的話下面全部空過').not.toBeNull()
      const { block, back } = throughBlocks(sem!)
      // 🔴 `paramCount` 是**存檔契約**——與同族的參數列一字不差
      expect((block.extraState as Record<string, unknown>)?.paramCount,
        '🔴 名字有幾個要存得回去，否則再開啟時只剩預設的那幾格').toBe(2)
      expect((back.slots.targets ?? []).map((t) => t.properties.name)).toEqual(['pt', 'd'])
      expect(back.properties.binding).toBe('value')
      expect(gen(back), '🔴 走一趟積木回來，程式碼要一樣').toContain('auto [pt, d] = BFS.front();')
    })

    it('🔴 分別取出：三個名字 ＋ 就地修改', () => {
      const sem = findOne(lift(`${H}int main(){ auto& [u,v,w] = ms.top(); }`), 'cpp:var_declare_sequence')
      expect(sem, 'lift 失敗的話下面全部空過').not.toBeNull()
      const { block, back } = throughBlocks(sem!)
      expect((block.extraState as Record<string, unknown>)?.paramCount).toBe(3)
      expect(back.properties.binding, '🔴 「就地修改」掉了——而它與「複製一份」是不同的程式').toBe('reference')
      expect(gen(back)).toContain('auto& [u, v, w] = ms.top();')
    })

    it('🔴 範圍 for：走訪的對象是接點，而它是一個運算式', () => {
      const sem = findOne(lift(`${H}int main(){ for(auto[w,to] : ar[P]) f(w); }`), 'cpp:loop_range')
      expect(sem, 'lift 失敗的話下面全部空過').not.toBeNull()
      const { block, back } = throughBlocks(sem!)
      expect((block.extraState as Record<string, unknown>)?.paramCount).toBe(2)
      expect((back.slots.targets ?? []).map((t) => t.properties.name)).toEqual(['w', 'to'])
      expect((back.slots.iterable ?? []).length,
        '🔴 走訪的對象整個掉了——而一個接不上東西的迴圈跑零次，看起來像「容器是空的」').toBe(1)
      expect(gen(back)).toContain('for (auto [w, to] : ar[P])')
    })

    it('🔴 範圍 for：舊的簡單寫法走一趟積木回來仍然一字不差', () => {
      // 🔴 **這一條是這一刀最大的迴歸風險**：走訪的對象那個字串屬性整個退場了，
      //    而 `for (int x : v)` 走的是同一條路。
      const sem = findOne(lift(`${H}int main(){ for(int x : v) f(x); }`), 'cpp:loop_range')
      expect(sem, 'lift 失敗的話下面全部空過').not.toBeNull()
      const { back } = throughBlocks(sem!)
      expect(back.properties.var_name).toBe('x')
      expect(back.properties.var_type).toBe('int')
      expect(gen(back)).toContain('for (int x : v)')
    })

    it('★ 正向錨點：雙端佇列的宣告也走得回來', () => {
      const sem = findOne(lift(`${H}int main(){ deque<int> dq; }`), 'cpp:deque_declare')
      expect(sem, 'lift 失敗的話下面全部空過').not.toBeNull()
      const { back } = throughBlocks(sem!)
      expect(back.properties.name).toBe('dq')
      expect(back.properties.type).toBe('int')
      expect(gen(back)).toContain('deque<int> dq;')
    })
  })

  /**
   * **跨概念的組合**（整合那一關要的）——新元件放進既有的結構裡。
   *
   * ⚠️ 單獨測過不等於組合起來也對：`audit-completeness` 的檔頭逐字寫著
   * 「本護欄只抓『殼』……**不檢測條件性正確**——單獨測通過、組合起來才壞的問題」。
   */
  describe('跨概念：放進既有的結構裡', () => {
    const COMBOS: [string, string][] = [
      ['放進條件的主體',
        `deque<pair<int,int>> q; q.push_back({2, 5});
         if (!q.empty()) { auto [a, b] = q.front(); cout << a << b; }`],
      ['放進巢狀的迴圈',
        `vector<vector<pair<int,int>>> g(2); g[0].push_back({1, 2}); g[1].push_back({3, 4});
         for (int i = 0; i < 2; i++) for (auto [x, y] : g[i]) cout << x << y;`],
      ['放進函式，而名字當引數傳出去',
        `deque<pair<int,int>> q; q.push_back({3, 4}); auto [a, b] = q.front(); cout << add(a, b);`],
      ['與既有的走訪並列',
        `vector<int> v{1, 2}; for (int x : v) cout << x;
         map<int,pair<int,int>> m; m[1] = {7, 8};
         for (auto [k, pr] : m) { auto [lo, hi] = pr; cout << k << lo << hi; }`],
    ]
    for (const [name, body] of COMBOS) {
      it(`⑤ ${name}`, async () => {
        const glob = name.includes('函式') ? 'int add(int p, int q){ return p + q; }' : ''
        const src = `${H}${glob}\nint main(){ ${body} return 0; }\n`
        const ref = runCppDetailed(src)
        expect(ref.ok, `🔴 參照編譯器收不下（測試自己的問題）：${ref.ok ? '' : ref.message}`).toBe(true)
        const out: string[] = []
        const interp = new SemanticInterpreter({ maxSteps: 300_000 })
        interp.setOutputCallback((x) => out.push(x))
        await interp.execute(lift(src), [])
        expect(out.join(''), '🔴 單獨測通過、組合起來才壞').toBe(ref.output)
      }, 60_000)
    }
  })

  // ── 身分（COMPONENT_IDENTITY）────────────────────────
  //
  // ⚠️ **只驗輸出字串會放過「用錯概念而碰巧產對」**——這一族正是那種：
  //    在此之前 `auto[a,b]` 產出的程式碼一字不差，而樹裡是自動型別宣告。
  describe('身分：產對了不等於認對了', () => {
    it('🔴 一串名字是它自己的身分，不是自動型別宣告', () => {
      const t = lift(`${H}int main(){ auto[a,b] = v[0]; }`)
      expect(findOne(t, 'cpp:var_declare_sequence'), '🔴 它被認成別的東西了').not.toBeNull()
      expect(findOne(t, 'cpp:var_declare_auto'), '🔴 一串名字不該落到「一個名字」那一顆').toBeNull()
    })

    it('★ 正向錨點：一個名字仍然是自動型別宣告', () => {
      const t = lift(`${H}int main(){ auto x = v[0]; }`)
      expect(findOne(t, 'cpp:var_declare_auto')).not.toBeNull()
      expect(findOne(t, 'cpp:var_declare_sequence')).toBeNull()
    })

    it('🔴 雙端佇列是它自己的身分，不是一般的變數宣告', () => {
      const t = lift(`${H}int main(){ deque<pair<int,int>> q; }`)
      expect(findOne(t, 'cpp:deque_declare'), '🔴 它掉回一般的變數宣告了——元素型別會整個消失').not.toBeNull()
    })
  })
})
