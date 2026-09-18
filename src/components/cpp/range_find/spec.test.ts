/**
 * `cpp:range_find` 的自證測——**語料要的那一顆**
 *（`basic/14_array_2.cpp` 的 `find(begin(array), end(array), search)`）。
 *
 * ## 🔴 它們為什麼是一起誕生的
 *
 * 三顆都**回傳一個位置**，而在「範圍的兩端還是字串屬性」的年代這件事做不到
 * ——`fuzz-cpp-containers-2.test.ts` 有一根 `it.fails` 逐字寫著：
 *
 * > 「🟠 為什麼不現在修：這兩個是**範圍演算法**，回傳一個位置而不改變長度
 * > ——而『範圍』今天還是兩個字串屬性。在範圍結構化之前補這兩顆，
 * > 它們的第一個引數會是一串文字。
 * > 🔴 何時該修：**範圍那一族從字串屬性換成接點的那一刀**。」
 *
 * 這就是那一刀。
 *
 * ⚠️ 而 `range_find` 不在那根釘子上——它是**語料**要的
 *（`basic/14_array_2.cpp` 的 `find(begin(array), end(array), search)`）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { SemanticInterpreter } from '../../../interpreter/interpreter'
import { generateCode } from '../../../core/projection/code-generator'
import apcs from '../../../languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../../core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

const lift = (c: string): SemanticNode =>
  createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const collect = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) collect(k, out)
  return out
}
const run = async (c: string): Promise<{ out: string; err: string }> => {
  const i = new SemanticInterpreter({ maxSteps: 100_000 })
  try {
    await i.execute(lift(c))
    return { out: i.getOutput().join(''), err: '' }
  } catch (e) { return { out: i.getOutput().join(''), err: (e as Error).message } }
}
const H = '#include <bits/stdc++.h>\nusing namespace std;\n'

describe('膠囊自證：範圍那一族的三顆新元件', () => {
  it('★ lift：三個名字都認得，而且兩端是【接點】不是屬性', () => {
    const src = `${H}int main(){ vector<int> v{1,1,2};\n`
      + ` auto a = find(v.begin(), v.end(), 2);\n`
      + ` auto b = unique(v.begin(), v.end());\n`
      + ` auto c = remove(v.begin(), v.end(), 1);\n`
      + ` return 0; }`
    const tree = lift(src)
    const ids = collect(tree)
    // ← 正向錨點先釘：`lift` 回 null 時集合是空的，負向斷言會空過
    expect(ids).toContain('cpp:range_find')
    expect(ids).toContain('cpp:range_unique')
    expect(ids).toContain('cpp:range_remove')
    expect(ids).not.toContain('cpp:raw_code')

    // 🔴 **兩端要在接點上，不在屬性上**——這一刀的重點就是這件事
    const find = (function dig(n: SemanticNode): SemanticNode | null {
      if (n.componentId === 'cpp:range_find') return n
      for (const ks of Object.values(n.slots ?? {})) for (const k of ks) {
        const f = dig(k); if (f) return f
      }
      return null
    })(tree)!
    expect(Object.keys(find.properties ?? {})).toEqual([])
    expect(find.slots.begin?.[0]?.componentId).toBe('cpp:container_iter')
    expect(find.slots.end?.[0]?.componentId).toBe('cpp:container_iter')
  })

  it('★ generate：產回去一字不差（含自由函式那一形）', () => {
    const src = `${H}int main(){ int a[3]={1,2,3};\n`
      + ` int* p = find(begin(a), end(a), 2);\n`
      + ` return 0; }`
    const code = generateCode(lift(src), 'cpp', apcs as unknown as StylePreset)
    // 🔴 原生陣列**沒有成員 `begin`**——產成 `a.begin()` 的話編不過
    expect(code).toContain('find(begin(a), end(a), 2)')
    expect(code).not.toContain('a.begin()')
  })

  it('★ execute：找得到就是那一格，找不到就是結尾之後', async () => {
    const r = await run(`${H}int main(){ int a[4]={4,5,6,7};\n`
      + ` cout << (find(begin(a), end(a), 6) - begin(a));\n`
      + ` cout << (find(begin(a), end(a), 9) == end(a));\n`
      + ` return 0; }`)
    expect(r.err).toBe('')
    expect(r.out).toBe('21')
  })

  /**
   * 🔴 **不改變長度**——這是「刪除-移除」為什麼是兩步的原因，
   * 而它是最容易被實作成「順手刪掉」的一條。
   */
  it('🔴 execute：擠掉之後容器【還是原來那麼長】', async () => {
    const r = await run(`${H}int main(){ vector<int> v{1,1,2,3,3};\n`
      + ` auto it = unique(v.begin(), v.end());\n`
      + ` cout << v.size() << ',' << (it - v.begin());\n`
      + ` return 0; }`)
    expect(r.err).toBe('')
    expect(r.out).toBe('5,3')
  })

  it('🔴 execute：擠掉 ＋ 刪掉尾巴 ＝ 真的變短', async () => {
    const r = await run(`${H}int main(){ vector<int> v{1,2,1,3};\n`
      + ` v.erase(remove(v.begin(), v.end(), 1), v.end());\n`
      + ` for (int x : v) cout << x;\n`
      + ` return 0; }`)
    expect(r.err).toBe('')
    expect(r.out).toBe('23')
  })

  /**
   * ⚠️ **只擠掉相鄰的**——沒排序過時結果「不完整」而**不是錯的**（C++ 也是這樣）。
   * 🔴 **不要替使用者先排序**：那會改掉他沒叫我們改的東西。
   */
  it('🔴 execute：沒排序過時只擠掉相鄰的，而不是全部', async () => {
    const r = await run(`${H}int main(){ vector<int> v{1,2,1};\n`
      + ` auto it = unique(v.begin(), v.end());\n`
      + ` cout << (it - v.begin());\n`
      + ` return 0; }`)
    expect(r.err).toBe('')
    expect(r.out).toBe('3')
  })

  it('★ round-trip：產回去再 lift，身分不變', () => {
    const src = `${H}int main(){ vector<int> v{1,1,2};\n`
      + ` v.erase(unique(v.begin(), v.end()), v.end());\n`
      + ` return 0; }`
    const once = generateCode(lift(src), 'cpp', apcs as unknown as StylePreset)
    const twice = generateCode(lift(once), 'cpp', apcs as unknown as StylePreset)
    expect(twice).toBe(once)
    expect(collect(lift(once))).toContain('cpp:range_unique')
  })

  /**
   * 🔴 **名字很短的函式，使用者自己也寫得出來**——判不出來就讓開。
   * ⚠️ 這一條前面有正向錨點（上面那幾支），所以「沒有認領」才是有意義的讀數。
   */
  it('🔴 lift：引數個數不對的同名函式不得被認領', () => {
    const ids = collect(lift(`${H}int find(int x){ return x; }\nint main(){ cout << find(3); return 0; }`))
    expect(ids).toContain('cpp:func_call')
    expect(ids).not.toContain('cpp:range_find')
  })
})
