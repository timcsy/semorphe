/**
 * `cpp:range_unique` 與 `cpp:range_remove` 的自證測——**「刪除-移除」那個慣用法的兩半**。
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
 * ⚠️ **兩顆寫在同一支**，理由不是省事：它們做的是**同一件事**（把不要的往後擠，
 * 回傳新的結尾，而且**不改變長度**），差別只在判準——一個問「等不等於這個值」，
 * 一個問「與前一格一不一樣」。那個差別在接點結構上看得見，所以是兩顆身分；
 * 而**它們錯起來會一起錯**，所以測試放在一起讀得出對照。
 * ⚠️ `cpp:range_find` 有自己的一支——它不在那根釘子上，是**語料**要的。
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

describe('膠囊自證：擠掉不要的那兩顆', () => {
  it('★ lift：兩個名字都認得，而且兩端是【接點】不是屬性', () => {
    const src = `${H}int main(){ vector<int> v{1,1,2};\n`
      + ` auto b = unique(v.begin(), v.end());\n`
      + ` auto c = remove(v.begin(), v.end(), 1);\n`
      + ` return 0; }`
    const tree = lift(src)
    const all = collect(tree)
    expect(all).toContain('cpp:range_unique')   // ← 正向錨點先釘
    expect(all).toContain('cpp:range_remove')
    expect(all).not.toContain('cpp:raw_code')

    const dig = (n: SemanticNode, id: string): SemanticNode | null => {
      if (n.componentId === id) return n
      for (const ks of Object.values(n.slots ?? {})) for (const k of ks) {
        const f = dig(k, id); if (f) return f
      }
      return null
    }
    const u = dig(tree, 'cpp:range_unique')!
    expect(Object.keys(u.properties ?? {})).toEqual([])
    expect(u.slots.begin?.[0]?.componentId).toBe('cpp:container_iter')
    expect(u.slots.end?.[0]?.componentId).toBe('cpp:container_iter')
    // 🔴 **擠掉某個值的那一顆多一個接點**——那正是它們是兩顆身分的理由
    const r = dig(tree, 'cpp:range_remove')!
    expect(r.slots.value?.length).toBe(1)
  })

  it('★ generate：產回去一字不差', () => {
    const src = `${H}int main(){ vector<int> v{1,1,2};\n`
      + ` v.erase(unique(v.begin(), v.end()), v.end());\n`
      + ` v.erase(remove(v.begin(), v.end(), 1), v.end());\n`
      + ` return 0; }`
    const code = generateCode(lift(src), 'cpp', apcs as unknown as StylePreset)
    expect(code).toContain('v.erase(unique(v.begin(), v.end()), v.end())')
    expect(code).toContain('v.erase(remove(v.begin(), v.end(), 1), v.end())')
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
   */
  it('🔴 lift：引數個數不對的同名函式不得被認領', () => {
    const ids = collect(lift(`${H}int remove(int x){ return x; }\nint main(){ cout << remove(3); return 0; }`))
    expect(ids).toContain('cpp:func_call')
    expect(ids).not.toContain('cpp:range_remove')
  })
})
