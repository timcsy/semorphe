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

  it.fails('[UNSUPPORTED:迭代器] `v.insert(v.begin(), x)` 是定位插入，而我們沒有迭代器', async () => {
    // 🟠 **為什麼不現在修**：它的第一個引數是迭代器，而這個直譯器沒有迭代器這個概念。
    //    語料裡 `.begin(` 33 次、`.end(` 30 次——那是獨立的一刀。
    //    探索報告：「一個概念如果它的產出沒有人接得住，補上它不會讓任何一支程式跑起來
    //    ——它只會讓失敗的位置往後移。」
    // 🔴 何時該修：迭代器那一刀做完的當天，回來拔這根釘子。
    await sameAsCompiler(`vector<int> v; v.push_back(1); v.insert(v.begin(), 9); cout << v[0] << v[1];`, '')
  }, 60_000)

  it.fails('[BLOCKED:cpp:map_at] `map<int, multiset<int>>` 的 `m[1].insert(5)`', async () => {
    // 🟠 **為什麼不現在修**：`m[1]` 當接收者時，`receiverOf` 把它當成陣列的下標，
    //    而對照表的鍵不是下標。修它要讓接收者的解析知道「這個容器是 keyed」，
    //    而那正是接收者被壓成文字那個設計問題的一部分（34 顆元件共用）。
    // 🔴 何時該修：接收者重構那一刀。
    await sameAsCompiler(`map<int, multiset<int>> m; m[1].insert(5); m[1].insert(5); cout << m[1].size();`, '')
  }, 60_000)
})
