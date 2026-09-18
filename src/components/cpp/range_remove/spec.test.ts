/**
 * `cpp:range_remove` 的自證測——**它與同族那顆擠掉重複的差在哪裡**。
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
 * ⚠️ **共同的行為（不改變長度、回傳新的結尾）驗在同族那顆擠掉重複的膠囊裡**
 * ——那兩顆做的是同一件事，放在一起才讀得出對照。
 * 這一支只驗**這顆獨有的那一格**：判準是「等不等於這個值」，所以它多一個接點。
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

describe('膠囊自證：擠掉等於某個值的', () => {
  it('★ lift：多一個接點，而那正是它與同族分家的理由', () => {
    const tree = lift(`${H}int main(){ vector<int> v{1,2,1}; remove(v.begin(), v.end(), 1); return 0; }`)
    expect(collect(tree)).toContain('cpp:range_remove')   // ← 正向錨點
    const dig = (n: SemanticNode): SemanticNode | null => {
      if (n.componentId === 'cpp:range_remove') return n
      for (const ks of Object.values(n.slots ?? {})) for (const k of ks) {
        const f = dig(k); if (f) return f
      }
      return null
    }
    const r = dig(tree)!
    expect(r.slots.value?.length, '🔴 少了「要擠掉哪個值」那一格').toBe(1)
    expect(r.slots.begin?.length).toBe(1)
    expect(r.slots.end?.length).toBe(1)
  })

  it('★ execute：值可以是運算式，而且比較不是只比 `.value`', async () => {
    const r = await run(`${H}int main(){ vector<string> v{"a","b","a"}; string t = "a";\n`
      + ` v.erase(remove(v.begin(), v.end(), t), v.end());\n`
      + ` for (auto& s : v) cout << s; cout << v.size();\n`
      + ` return 0; }`)
    expect(r.err).toBe('')
    expect(r.out).toBe('b1')
  })
})
