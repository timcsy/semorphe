/**
 * **模糊測試的常駐網：容器的重複性與有序性。**
 *
 * ## 它從哪來
 *
 * 補上 `multiset`／`unordered_map` 兩軸之後，往
 * 「**`insert` 這個方法名只有一個主人**」那個方向壓出來的。每一種容器的
 * `.insert(` 都會走到同一顆元件，而它在此之前對每一種做同一件事。
 *
 * ## 🔴 壓出來的四件事，其中兩件是【修好一個缺陷才浮出來的】
 *
 *     map.insert({k,v})       我讓「不是集合」丟錯 ⟹ 對照表也被擋掉了   ← 我自己造的迴歸
 *     multiset.erase(key)     C++ 刪【全部】等於那個鍵的，而我們刪一個   ← 支援重複之後才成立
 *     v.insert(v.begin(), x)  🟠 既有：定位插入要先有迭代器
 *     m[1].insert(5)          🟠 既有：巢狀容器
 *
 * > **一個「只有在另一個缺陷存在時才正確」的實作，
 * > 會在那個缺陷被修好的當天變成新的缺陷。**
 *
 * `multiset` 不能留重複的時候，「`erase` 刪一個」與「刪全部」**沒有差別**
 * ——所以那段程式碼看起來是對的，而且測試全綠。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { runCppDetailed, hasReferenceCompiler } from '../helpers/run-cpp'
import { generateCode } from '../../src/core/projection/code-generator'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { StylePreset } from '../../src/core/types'
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

const lift = (c: string): SemanticNode =>
  lifter.lift(parser.parse(c)!.rootNode as never) as SemanticNode
const ids = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) ids(k as SemanticNode, out)
  return out
}
const run = async (src: string): Promise<string> => {
  const out: string[] = []
  const interp = new SemanticInterpreter({ maxSteps: 200_000 })
  interp.setOutputCallback((x) => out.push(x))
  await interp.execute(lift(src), [])
  return out.join('')
}
const H = `#include <iostream>\n#include <set>\n#include <map>\n#include <vector>\n#include <string>\n#include <unordered_map>\nusing namespace std;\n`
const prog = (body: string): string => `${H}int main(){ ${body} return 0; }\n`
const S = apcs as unknown as StylePreset

/** 兩邊餵同一段程式，比 stdout——g++ 是權威。 */
const sameAsCompiler = async (body: string, hint: string): Promise<void> => {
  const src = prog(body)
  const ref = runCppDetailed(src)
  expect(ref.ok, `🔴 參照編譯器收不下（測試自己的問題）：${ref.ok ? '' : ref.message}`).toBe(true)
  expect(await run(src), hint).toBe(ref.output)
}

describe('模糊測試：insert 只有一個主人，而每一種容器要做自己的事', () => {
  it.runIf(hasReferenceCompiler())('🔴 對照表的 insert——大括號那個形式', async () => {
    await sameAsCompiler(`map<int,int> m; m.insert({3,7}); cout << m[3] << m.size();`,
      '🔴 「不是集合就丟錯」會把對照表一起擋掉——那是修一個缺陷造出另一個')
  }, 60_000)

  it.runIf(hasReferenceCompiler())('🔴 對照表的 insert——`make_pair` 那個形式', async () => {
    await sameAsCompiler(`map<int,int> m; m.insert(make_pair(3,7)); cout << m[3] << m.size();`, '')
  }, 60_000)

  it.runIf(hasReferenceCompiler())('🔴 對照表的 insert 在鍵已存在時【什麼都不做】（不是覆蓋）', async () => {
    await sameAsCompiler(
      `map<int,int> m; m.insert({3,7}); m.insert({3,9}); cout << m[3] << m.size();`,
      '🔴 覆蓋是 `m[k] = v` 的事，不是 insert 的——寫成覆蓋的話學生的計數會少')
  }, 60_000)

  it.runIf(hasReferenceCompiler())('🔴 字串當鍵的大括號 insert', async () => {
    await sameAsCompiler(`map<string,int> m; m.insert({"ab",5}); cout << m["ab"] << m.size();`, '')
  }, 60_000)

  it.runIf(hasReferenceCompiler())('🔴 multiset 的 `erase(key)` 刪掉【全部】等於那個鍵的', async () => {
    await sameAsCompiler(
      `multiset<int> s; s.insert(4); s.insert(4); s.insert(7); s.erase(4); cout << s.size();`,
      '🔴 刪一個的話 size 多一——而這一條在 multiset 不能留重複的年代是【對的】')
  }, 60_000)

  it.runIf(hasReferenceCompiler())('🔴 而 set 的 erase 行為不得被那個改動帶偏', async () => {
    await sameAsCompiler(
      `set<int> s; s.insert(4); s.insert(7); s.erase(4); cout << s.size();`,
      '🔴 正向錨點：集合那一側本來就只有一個，刪完要剩一個')
  }, 60_000)

  it.runIf(hasReferenceCompiler())('🔴 讀一個不存在的鍵會【插入一個預設值】（size 會變）', async () => {
    await sameAsCompiler(`map<int,int> m; m[1]=1; int x = m[9]; cout << x << m.size();`,
      '🔴 學生天天踩這一條——讀 m[9] 之後 size 是 2 不是 1')
  }, 60_000)

  it.runIf(hasReferenceCompiler())('🔴 容器傳值給函式：裡面改了，外面不得變', async () => {
    const src = `${H}void f(set<int> s){ s.insert(99); }\nint main(){ set<int> a; a.insert(1); f(a); cout << a.size(); return 0; }\n`
    const ref = runCppDetailed(src)
    expect(ref.ok, `🔴 參照編譯器收不下（測試自己的問題）：${ref.ok ? '' : ref.message}`).toBe(true)
    expect(await run(src), '🔴 值語義：這一族今天修過兩次').toBe(ref.output)
  }, 60_000)

  it.runIf(hasReferenceCompiler())('🔴 multiset 裝字串：留重複而且有序', async () => {
    await sameAsCompiler(
      `multiset<string> s; s.insert("b"); s.insert("a"); s.insert("b"); cout << s.size(); for (auto& x : s) cout << x;`,
      '')
  }, 60_000)

  it('🔴 身分：字串的 insert 不得被容器那顆吃掉', () => {
    const a = ids(lift(prog(`string s = "cd"; s.insert(0, "ab"); cout << s;`)))
    // ⚠️ 不寫別顆元件的完整身分（就近性護欄兩個方向都會報）——用尾綴比對
    expect(a.filter((x) => /:set_insert$/.test(x)),
      '🔴 同一個方法名，而字串那一顆有自己的主人').toEqual([])
  })

  // ─── 壓出來而這一刀不修的，各留一支測試 ────────────────────────
  //
  // ⚠️ 兩支都用 `it.fails`（不是 `it.todo`）——**修好的那天它會紅，逼人來拔釘子**。
  //    `it.todo` 沒有本體，它宣告了一個缺陷而沒有任何機構在看那個缺陷還在不在。
  //
  // ⚠️ 而標記的兩種**不是同義詞**（缺陷帳的檔頭定義）：
  //    `[UNSUPPORTED:描述]`   要加一個新概念  ← 迭代器整族都還不存在
  //    `[BLOCKED:身分]`       修一顆既有元件  ← 括號裡必須是登錄表裡真的有的身分

  /**
   * 🔴 **型別別名指向一個容器**——`typedef map<int, set<int>> Graph;`（2026-09-18，盲測）。
   *
   * `Graph g;` 在語法上就是一個普通的變數宣告，於是 `g[a]` 被認成**陣列下標**。
   * 根因在一條收集器的規則上：`cpp:var_declare` 被它捕成型別 **`var`**
   * ——一個沒有任何人認得的名字。
   *
   * > **一條「概念名就是型別」的規則，在概念名說的是「我是一般的那一種」時
   * > 會給出一個看起來像型別的字串——而它比沒有更糟。**
   *
   * ⚠️ **而別名刻意不在 lift 期展開**：展開的話產出的程式碼會變成
   * `map<int, set<int>> g;`——一支與學生寫的不同的程式。
   * > **一個別名的意義就是那個短名字；把它換掉等於把它拿掉。**
   */
  it('★ typedef 指向容器時，那個變數要真的是那種容器', async () => {
    const src = `${H}typedef map<int, set<int>> Graph;\ntypedef vector<int> vi;\ntypedef pair<int,int> pii;\n`
      + `int main(){ Graph g; g[1].insert(2); g[1].insert(2);\n`
      + `  vi v; v.push_back(7); pii p = make_pair(3, 4);\n`
      + `  cout << g[1].size() << g.size() << v[0] << p.first << p.second; return 0; }\n`
    const ref = runCppDetailed(src)
    expect(ref.ok, '🔴 參照編譯器收不下（測試自己的問題）').toBe(true)
    expect(await run(src), '🔴 別名沒有被解開').toBe(ref.output)
    // 🔴 **產出的程式碼要保住那個短名字**——別名的意義就在它
    const gen = generateCode(lift(src), 'cpp', S)
    expect(gen, '🔴 別名被展開了——學生的程式碼變成另一支').toContain('Graph g;')
    expect(gen).toContain('vi v;')
  }, 60_000)

  /**
   * 🟢 **2026-09-18：這根釘子被拔了，而它遲到了一天。**
   *
   * 它寫著「🔴 何時該修：**迭代器那一刀做完的當天，回來拔這根釘子**」
   * ——而那一刀 2026-09-17 就做完了，**沒有人回來**。
   *
   * > **一根釘子如果只寫著「誰擋住我」，
   * > 它不會在那個人讓開的時候自己掉下來。**
   *
   * ⚠️ 而阻斷者讓開之後，缺陷**換了一個形狀**：位置不再是「不支援」，
   * 它變成了**要插入的那個值**——`v.insert(v.begin(), 9)` 被
   * 字串的 insert 認領（它只看引數個數），整個列表被重建成一串文字，
   * 而 `v[0]` 印出來是 `[9`。
   *
   * > **一個「還不認得」的東西，在它終於被造出來之後會被當成別的東西
   * > ——而那不是同一個缺陷，是它的下一個形狀。**
   */
  it('★ `v.insert(v.begin(), x)` 是定位插入', async () => {
    await sameAsCompiler(`vector<int> v; v.push_back(1); v.insert(v.begin(), 9); cout << v[0] << v[1] << v.size();`, '')
  }, 60_000)

  it('★ 定位插入：中間、尾端，而回傳的是新元素的位置', async () => {
    await sameAsCompiler(
      `vector<int> v{1,2,3}; auto it = v.insert(v.begin() + 1, 9);
       cout << *it << (it - v.begin()); for (int x : v) cout << x;
       vector<int> w{1,2}; w.insert(w.end(), 9); for (int x : w) cout << x;`, '')
  }, 60_000)

  it('★ 兩端都能進出的容器也定位插入得了', async () => {
    await sameAsCompiler(`deque<int> d{1,3}; d.insert(d.begin() + 1, 2); for (int x : d) cout << x;`, '')
  }, 60_000)

  it('★ 正向錨點：字串的 insert 仍然是字串的（它也收兩個引數）', async () => {
    await sameAsCompiler(`string s = "helo"; s.insert(3, "l"); cout << s;`, '')
  }, 60_000)

  /**
   * 🟢 **2026-09-18：這根釘子被拔了**（釘的時候寫著「何時該修：接收者重構那一刀」）。
   *
   * 接收者確實修好了，而**那只解開一半**：`m[1]` 自動建出來的那一格原本只是
   * 「一個空陣列」——沒有種類的性質，於是內層的可重複集合不知道自己該留重複。
   *
   * 修法**不是在 `map_at` 多寫一段**：「可重複集合留重複」是宣告那顆元件的知識，
   * 所以由它自己登記一個「我的空實例長什麼樣」，`map_at` 只負責問。
   *
   * > **一個「不經過宣告也會被建出來」的東西，
   * > 它的形狀仍然屬於宣告它的那顆元件——只是需要一個問得到的地方。**
   */
  it('★ `map<int, multiset<int>>` 的 `m[1].insert(5)` 留得住重複', async () => {
    await sameAsCompiler(`map<int, multiset<int>> m; m[1].insert(5); m[1].insert(5); cout << m[1].size();`,
      '🔴 內層容器沒有拿到「留重複」')
  }, 60_000)

  /**
   * 🔴 **`multiset::count` 要數【全部】**（2026-09-18，盲測抓到）。
   * `set`／`map` 的鍵唯一，所以那個數字只會是 0 或 1——**而 `multiset` 不是**。
   * > **一個「有沒有」與一個「有幾個」在唯一鍵的容器上是同一個答案
   * > ——而那讓錯的那一半在大多數情況下看起來是對的。**
   */
  it('★ 可重複集合的 count 數全部，而集合與對照表只回 0／1', async () => {
    await sameAsCompiler(
      `multiset<int> ms; ms.insert(3); ms.insert(3); set<int> s; s.insert(3);
       map<string,int> mp; mp["a"] = 1;
       cout << ms.count(3) << ms.count(9) << s.count(3) << mp.count("a") << mp.count("b");`,
      '🔴 可重複集合的 count 只回了 0／1')
  }, 60_000)

  /**
   * 🔴 **兩個位置界定一段範圍的刪除**——`ms.erase(a, b)`，而 C++ 的區間是半開的。
   *
   * 在此之前只讀了第一個引數，而症狀不是「少刪一些」：`before - after`
   * 算出 **-358**，那個容器的內容變成一串 `[object Object],…`
   * ——因為**兩個引數被字串那一顆的 `erase(pos, len)` 認走了**。
   *
   * > **一個只看引數個數的判別，在另一個型別剛好也收兩個引數時
   * > 不會落空——它會安靜地把那個東西當成自己的。**
   */
  it('★ erase(第一個位置, 最後一個之後) 刪一整段', async () => {
    await sameAsCompiler(
      `multiset<int> ms; for (int i = 1; i <= 6; i++) ms.insert(i);
       multiset<int>::iterator a = ms.lower_bound(2); multiset<int>::iterator b = ms.upper_bound(4);
       int before = (int)ms.size(); ms.erase(a, b);
       cout << before - (int)ms.size() << ms.size() << *ms.begin();`,
      '🔴 範圍刪除沒做對')
  }, 60_000)

  it('★ 而字串的 erase(位置, 長度) 不得被弄壞', async () => {
    await sameAsCompiler(`string s = "abcdef"; s.erase(1, 2); cout << s;`, '🔴 字串的兩引數刪除壞了')
  }, 60_000)

  /**
   * 🔴 **容器裡面裝容器，而內層那個【沒有經過宣告】**（2026-09-18，盲測兩支）。
   */
  it('★ 巢狀容器的內層要拿得到自己的種類', async () => {
    await sameAsCompiler(
      `map<string, set<int>> b; b["a"].insert(3); b["a"].insert(3); b["a"].insert(1);
       vector<set<int>> bins(4); bins[1].insert(5); bins[1].insert(5);
       vector<vector<int>> g(2); g[0].push_back(7);
       cout << b["a"].size() << *b["a"].begin() << bins[1].size() << g[0][0] << g.size();`,
      '🔴 內層容器沒有拿到種類')
  }, 60_000)

  /**
   * 🔴 **有序容器要問使用者自己的 `operator<`**（2026-09-18，盲測兩支）。
   *
   * 三件事全部是**靜默的**：`sort` 完全沒排序、`set<T>` 的順序是插入順序、
   * 重複的結構全部留了下來（判準寫成 `==`，而 C++ 的是 `!(a<b) && !(b<a)`）。
   *
   * ⚠️ **機制早就齊了**——`cpp:compare` 與 `cpp:arithmetic` 都會問運算子多載。
   * > **一個機制的消費者少一個，那個機制就對那條路徑不存在。**
   */
  it('★ 自訂結構的排序、去重、查找、計數要用同一份規則', async () => {
    const src = `${H}struct T { int k; T(int a) : k(a) {}\n`
      + `  bool operator<(const T& o) const { return k < o.k; } };\n`
      + `int main(){ vector<T> v; v.push_back(T(3)); v.push_back(T(1)); sort(v.begin(), v.end());\n`
      + `  set<T> s; s.insert(T(3)); s.insert(T(3)); s.insert(T(1));\n`
      + `  cout << v[0].k << v[1].k << s.size() << s.begin()->k\n`
      + `       << (s.find(T(2)) == s.end() ? "no2" : "has2") << s.count(T(1)); return 0; }\n`
    const ref = runCppDetailed(src)
    expect(ref.ok, '🔴 參照編譯器收不下（測試自己的問題）').toBe(true)
    expect(await run(src), '🔴 自訂比較沒有被問到').toBe(ref.output)
  }, 60_000)
})
