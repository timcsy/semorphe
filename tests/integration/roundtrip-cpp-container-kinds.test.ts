/**
 * **重複性與有序性兩軸的 round-trip**——四個面向各驗一次。
 *
 * ## 它從哪來
 *
 * 使用者學生的 218 支競賽練習裡，`multiset<` **13 支**、`unordered_map<` **5 支**。
 * 在補上這兩軸之前：
 *
 *     multiset       `insert` 無條件去重 ⟹ 少一半元素，而程式照常跑完
 *     unordered_map  根本沒登錄 ⟹ `m[3] = 7` 被當成陣列的第 3 格，INDEX_OUT_OF_RANGE
 *
 * ## 🔴 而這一族的形狀有一個陷阱，值得先講
 *
 * 「①產出的程式碼」與「②語義不動點」在修**之前**也是綠的——因為沒登錄的樣板
 * 會掉到一般變數宣告那條路，而那條路**原樣保留型別文字**（`multiset<int>`）。
 *
 * > **一個容器被當成別的東西處理時，它的【文字】可以是完美的。
 * > 分得出來的只有兩樣：語義樹裡的身分，與跑出來的東西。**
 *
 * 所以這支測試的重量在 **身分斷言** 與 **④ 行為**，而不在產碼。
 *
 * ## 真語料上量到的（2026-09-17，那 18 支）
 *
 *     ① lift 認得         18/18
 *     ② 產碼保住種類      18/18（multiset 不變 set、unordered_map 不變 map）
 *     ③ 語義不動點        18/18
 *
 * ## ⚠️ 這裡的程式是從語料**蒸餾**出來的，不是抄一整支
 *
 * 常駐測試不得依賴外部 repo（`STUDYCPP_DIR` 沒設時那批探針會跳過，而**跳過的
 * 護欄與不存在的護欄長得一樣**）。語料裡真正的用法是：
 * `mp[x]++` · `cout << mp[x]` · `mp[A[i]] = 1` · `cc.size()` · `cc.clear()`
 * · `st.insert(x)` · `st.erase(st.begin())` · `st.lower_bound({...})`。
 *
 * 🔴 **判準裡不得放未指定行為**：真的 `unordered_map` **走訪順序是未指定的**，
 * 所以這裡**沒有任何一題走訪它**。`m[k]`／`size`／`count` 是良好定義的。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { generateCode } from '../../src/core/projection/code-generator'
import { runCppDetailed, hasReferenceCompiler } from '../helpers/run-cpp'
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
const run = async (src: string): Promise<string> => {
  const out: string[] = []
  const interp = new SemanticInterpreter({ maxSteps: 200_000 })
  interp.setOutputCallback((x) => out.push(x))
  await interp.execute(lift(src), [])
  return out.join('')
}
const H = `#include <iostream>\n#include <set>\n#include <unordered_map>\n#include <string>\nusing namespace std;\n`

/** 語料的形狀：一串數字丟進 multiset，重複的每一個都要留著。 */
const MS = `${H}int main(){
    multiset<int> st;
    int a[5] = {4, 1, 4, 9, 1};
    for (int i = 0; i < 5; i++) st.insert(a[i]);
    cout << st.size();
    for (int x : st) cout << x;
    return 0;
}
`

/** 語料的形狀：數次數（`mp[x]++` 然後查）。 */
const UM = `${H}int main(){
    unordered_map<int,int> mp;
    int a[6] = {3, 1, 3, 3, 1, 7};
    for (int i = 0; i < 6; i++) mp[a[i]]++;
    cout << mp[3] << mp[1] << mp[7] << mp.size();
    return 0;
}
`

describe('round-trip：容器的重複性與有序性', () => {
  it('🔴 身分：multiset 走的是集合那顆元件，不是一般變數宣告', () => {
    const decl = nodes(lift(MS)).find((n) => n.componentId === 'cpp:set_declare')
    expect(decl, '🔴 沒登錄成容器樣板 → 它會掉成一般變數，而【文字仍然是對的】').toBeDefined()
    expect(decl!.properties.unique, '🔴 沒帶重複性 → 執行時會去重，少一半元素').toBe('false')
    expect(ids(lift(MS))).not.toContain('cpp:raw_code')
  })

  it('🔴 身分：unordered_map 走的是對照表那顆元件', () => {
    const decl = nodes(lift(UM)).find((n) => n.componentId === 'cpp:map_declare')
    expect(decl, '🔴 沒登錄 → `mp[x]` 會被當成陣列索引而報越界').toBeDefined()
    expect(decl!.properties.ordered).toBe('false')
  })

  it('🔴 產碼：種類不得在來回一趟裡被換掉', () => {
    expect(generateCode(lift(MS), 'cpp', S)).toContain('multiset<int> st;')
    expect(generateCode(lift(UM), 'cpp', S)).toContain('unordered_map<int, int> mp;')
  })

  it('🔴 語義不動點：轉一圈回來是同一棵樹', () => {
    for (const src of [MS, UM]) {
      const once = ids(lift(src)).join(',')
      expect(ids(lift(generateCode(lift(src), 'cpp', S))).join(',')).toBe(once)
    }
  })

  it('🔴 存檔相容：沒有那個屬性的舊樹，兩條預設路都要當它是有序且去重的', async () => {
    // ⚠️ 預設值寫在兩處（產碼與執行），所以兩處都要驗——一處改了另一處沒改的話，
    //    畫面上的程式碼與跑出來的行為會**互相矛盾**，而那比兩邊都錯更難查。
    const old = `${H}int main(){ set<int> s; s.insert(2); s.insert(2); cout << s.size(); return 0; }\n`
    const tree = lift(old)
    const decl = nodes(tree).find((n) => n.componentId === 'cpp:set_declare')!
    delete decl.properties.unique                      // 模擬既有存檔：那一格不存在
    expect(generateCode(tree, 'cpp', S)).toContain('set<int> s;')
    const out: string[] = []
    const interp = new SemanticInterpreter({ maxSteps: 200_000 })
    interp.setOutputCallback((x) => out.push(x))
    await interp.execute(tree, [])
    expect(out.join(''), '🔴 預設成 multiset 的話舊存檔的集合會開始留重複').toBe('1')
  })

  it.runIf(hasReferenceCompiler())('🔴 行為：multiset 跑起來與參照編譯器一樣', async () => {
    const ref = runCppDetailed(MS)
    expect(ref.ok, `🔴 參照編譯器收不下（測試自己的問題）：${ref.ok ? '' : ref.message}`).toBe(true)
    expect(await run(MS), '🔴 去重的話這裡會少兩個元素，而 size 也會小').toBe(ref.output)
  }, 60_000)

  it.runIf(hasReferenceCompiler())('🔴 行為：unordered_map 跑起來與參照編譯器一樣', async () => {
    const ref = runCppDetailed(UM)
    expect(ref.ok, `🔴 參照編譯器收不下（測試自己的問題）：${ref.ok ? '' : ref.message}`).toBe(true)
    expect(await run(UM), '🔴 沒登錄的話這裡是 INDEX_OUT_OF_RANGE').toBe(ref.output)
  }, 60_000)

  it.runIf(hasReferenceCompiler())('🔴 行為：字串當鍵（語料 21_toj55_2 的形狀）', async () => {
    const src = `${H}int main(){
    unordered_map<string,int> mp;
    mp["ab"] = 1; mp["cd"] = 2; mp["ab"]++;
    cout << mp["ab"] << mp["cd"] << mp.size();
    return 0;
}
`
    const ref = runCppDetailed(src)
    expect(ref.ok, `🔴 參照編譯器收不下（測試自己的問題）：${ref.ok ? '' : ref.message}`).toBe(true)
    expect(await run(src)).toBe(ref.output)
  }, 60_000)
})
