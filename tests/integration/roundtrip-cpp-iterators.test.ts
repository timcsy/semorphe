/**
 * **迭代器一族的 round-trip**——四個面向各驗一次。
 *
 * ## 它從哪來
 *
 * 三個互不相關的量測同時指向這一族：語料的錯誤分族（46 支裡 ≈16 支）、
 * 語料的方法直方圖（`begin` 33 ＋ `end` 30 ＋ `find` 8 ＋ `rbegin` 7 ＋ `lower_bound` 5）、
 * 以及一個看不到原始碼的出題者（10 支裡 7 支死在 `::iterator it = c.begin()`）。
 *
 * ## 真語料上量到的（2026-09-17，用到這一族的 28 支）
 *
 *     ① 那幾個方法不得變成別的東西    28/28
 *     ② 語義不動點                    28/28
 *     ③ `auto it = …` 掉進 raw code    0 支（修之前是每一支）
 *
 * ## 🔴 而 ①②③ 在修之前【也會是綠的】
 *
 * `auto it = v.begin()` 掉進 raw code 之後，那一段的**文字原樣保留**
 * ——產碼吐得回去、不動點也穩。分得出來的只有語義樹裡的身分，與跑出來的東西。
 *
 * ## ⚠️ 這裡的程式是從語料**蒸餾**出來的
 *
 * 常駐測試不得依賴外部 repo（`STUDYCPP_DIR` 沒設時探針會跳過，而**跳過的護欄
 * 與不存在的護欄長得一樣**）。語料真正的寫法：
 *
 * ```cpp
 * auto it = st.lower_bound(pre-K);  if (it != st.end()) { … }
 * ans.erase(ans.find(-p[r1]));
 * for (auto it = m.begin(); it != m.end(); ++it) cout << it->first;
 * if (!l.empty()) ls -= *l.rbegin();
 * ```
 *
 * 🔴 **判準裡不得放未定義行為**：空容器上 `*c.begin()`、`erase` 之後繼續用那個位置
 * （迭代器失效，而我們刻意不模擬）、`unordered_map` 的走訪順序。
 *
 * 2026-11-04（spec 212，6c-5）：參照編譯器那一半拿掉——期望值是當時 g++ 跑出來、與 Cella 一致的字串，寫死在這裡
 * （擷取在本機的 Apple clang 上做；這一檔的呼叫點全部兩邊相同，不同的那幾條原本就包在 `knownCellaGap` 裡，期望字串照樣寫 g++ 的值）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { runCella, describeCellaResult, knownCellaGap, expectCellaOut } from '../helpers/cella-run'
import { generateCode } from '../../src/core/projection/code-generator'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

const ROOT = process.cwd()
const S = apcs as unknown as StylePreset
let parser: Parser
let lifter: ReturnType<typeof createTestLifter>

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${ROOT}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${ROOT}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
}, 120_000)

const lift = (c: string): SemanticNode =>
  lifter.lift(parser.parse(c)!.rootNode as never) as SemanticNode
const nodes = (n: SemanticNode, out: SemanticNode[] = []): SemanticNode[] => {
  out.push(n)
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) nodes(k as SemanticNode, out)
  return out
}
const ids = (n: SemanticNode): string[] => nodes(n).map((x) => x.componentId)
/**
 * **執行那一邊是 Cella**（spec 203，重構 6c-2e）——走產品同一條 lift → formalize → 判決。
 * 判決不是 accept 就丟出說得出原因的錯（判不出、翻不出、判定有錯都不是空字串）。
 * 比對的另一邊是參照編譯器當時跑出來的字串（spec 212，6c-5 起寫死在呼叫點），所以這裡仍是「Cella 對參照編譯器」的交叉檢查。
 */
const cellaOut = async (src: string): Promise<string> => {
  const r = await runCella(src)
  if (r.verdict !== 'accept') throw new Error(describeCellaResult(r))
  return r.out
}
const run = cellaOut
const H = '#include <bits/stdc++.h>\nusing namespace std;\n'
const prog = (body: string, glob = ''): string => `${H}${glob}\nint main(){ ${body} return 0; }\n`

/** `expected`：當時 g++ 跑出來、與 Cella 一致的輸出（寫死，spec 212）。 */
const sameAsCompiler = async (body: string, expected: string, hint: string, glob = ''): Promise<void> => {
  expect(await run(prog(body, glob)), hint).toBe(expected)
}

/** 語料最常見的形狀：對照表的位置迴圈。 */
const WALK = `map<int,int> m; m[2]=7; m[1]=9;
  for (auto it = m.begin(); it != m.end(); ++it) cout << it->first << it->second;`

describe('round-trip：迭代器一族', () => {
  it('🔴 身分：`auto it = c.begin()` 不得掉進 raw code', () => {
    const a = ids(lift(prog(WALK)))
    expect(a, '🔴 沒認出來 → 下面每一條都在驗空集合').toContain('cpp:container_iter')
    expect(a, '🔴 修之前它整段是 raw code，而【產碼吐得回去】——所以形狀那幾條是綠的')
      .not.toContain('cpp:raw_code')
  })

  it('🔴 身分：三個判準走同一顆，而判準進屬性', () => {
    const src = prog(`set<int> s; s.insert(1); auto a = s.find(1); auto b = s.lower_bound(1); auto c = s.upper_bound(1);`)
    const found = nodes(lift(src)).filter((n) => n.componentId === 'cpp:container_find')
    expect(found.length, '🔴 三個方法名都要走到這一顆').toBe(3)
    expect(found.map((n) => n.properties.how)).toEqual(['find', 'lower_bound', 'upper_bound'])
  })

  it('🔴 產碼：那幾個方法不得被換掉', () => {
    const gen = generateCode(lift(prog(WALK)), 'cpp', S)
    expect(gen).toContain('.begin()')
    expect(gen).toContain('.end()')
    const g2 = generateCode(lift(prog(`set<int> s; auto it = s.lower_bound(2); auto j = s.rbegin();`)), 'cpp', S)
    expect(g2).toContain('.lower_bound(2)')
    expect(g2).toContain('.rbegin()')
  })

  it('🔴 語義不動點：轉一圈回來是同一棵樹', () => {
    for (const src of [prog(WALK), prog(`set<int> s; s.insert(1); auto it = s.find(1);`)]) {
      const once = ids(lift(src)).join(',')
      expect(ids(lift(generateCode(lift(src), 'cpp', S))).join(',')).toBe(once)
    }
  })

  // 歸類：Cella 判錯——類別迭代器的 `it->first` 被判「不是指標」；`(*it).first` 是好的
  it('🔴 行為：位置迴圈與 `it->`', async () => {
    await sameAsCompiler(WALK, "1927", '🔴 修之前這一段整個是 raw code')
  }, 60_000)

  it('🔴 行為：`erase(find(x))` 只刪一個（語料最常見的寫法）', async () => {
    await sameAsCompiler(
      `multiset<int> ms; ms.insert(4); ms.insert(4); ms.insert(7);
       ms.erase(ms.find(4)); cout << ms.size() << ms.count(4);`, "21",
      '🔴 走成「刪全部」的話，一個計數會少掉不只一個')
  }, 60_000)

  it('🔴 行為：`lower_bound` ＋ `!= end()` 的標準寫法', async () => {
    await sameAsCompiler(
      `set<int> s; s.insert(1); s.insert(3); s.insert(5);
       auto it = s.lower_bound(2); if (it != s.end()) cout << *it;
       auto j = s.lower_bound(9); cout << (j == s.end());`, "31",
      '🔴 找不到必須回「結尾之後」，否則這個寫法整個失去意義')
  }, 60_000)

  // 歸類：Cella 判錯——類別迭代器的 `->` 被判「不是指標」
  it('🔴 行為：有序容器裝一對值（AP325/4/4_15 的形狀）', async () => {
    await sameAsCompiler(
      `multiset<pair<int,int>> st; st.insert({3,4}); st.insert({1,2});
       for (auto it = st.begin(); it != st.end(); ++it) cout << it->first << it->second;
       auto lo = st.lower_bound({2,0}); cout << lo->first;`, "12343",
      '🔴 三個缺陷疊在這裡：容器不記元素型別、比較規則不認一對值、查找把每一格拆開')
  }, 60_000)

  it('🔴 行為：最大的那一個與反向走訪', async () => {
    await sameAsCompiler(
      `set<int> s; s.insert(1); s.insert(5); s.insert(3);
       cout << *s.rbegin();
       for (auto it = s.rbegin(); it != s.rend(); ++it) cout << *it;`, "5531",
      '🔴 `++rit` 往後走的話，由大到小會安靜地變成由小到大')
  }, 60_000)

  it('★ 正向錨點：純量與字串的集合不得被這一刀帶偏', async () => {
    await sameAsCompiler(
      `set<int> a; a.insert(5); a.insert(1); for (int v : a) cout << v;
       set<string> b; b.insert("bb"); b.insert("aa"); cout << *b.begin();`, "15aa", '')
  }, 60_000)
})

/**
 * 巢狀的型別名（第 235 刀）：`map<int,int>::iterator` 送 tMember（cella 2026-11-03 給的形狀；宣告、參數、typedef 三種位置同一個）。
 * ⚠️ vector／string 的 iterator 與 set／multiset 的 const_iterator 等 Cella 補成員型別（今天判 reject「unknown type」，釘在 fuzz-cpp-iterators）。
 */
describe('巢狀的型別名：容器的 iterator', () => {
  const P = '#include <bits/stdc++.h>\nusing namespace std;\n'
  it('★ map 的 iterator 當參數與宣告', async () => {
    await expectCellaOut(P + 'int sum(map<int,int>::iterator a, map<int,int>::iterator b) { int s = 0; for (; a != b; ++a) s += a->second; return s; }\nint main() { map<int,int> m; m[1] = 10; m[2] = 20; map<int,int>::iterator it = m.begin(); cout << it->first << " " << sum(m.begin(), m.end()); }\n', '1 30')
  }, 120_000)
  it('★ set 的 iterator 宣告', async () => {
    await expectCellaOut(P + 'int main() { set<int> s = {5, 3, 9}; set<int>::iterator it = s.begin(); cout << *it; }\n', '3')
  }, 120_000)
})
