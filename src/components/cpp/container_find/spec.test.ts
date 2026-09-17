/**
 * **膠囊自證：在有序容器裡找一個位置。**
 *
 * 🔴 **它從哪來**：語料量到 `find` 8 次、`lower_bound` 5 次、`upper_bound` 2 次，
 * 而**已登錄的容器方法裡一個都沒有**。症狀是「`s`（不是一個物件）」
 * ——方法名沒登錄，掉到泛用的 method_call。
 *
 * ⚠️ 而 `find` 這個名字**已經有主人**（字串的搜尋），所以這顆用方法分支
 * ＋ 問接收者的型別，而「我有沒有成員的查找」由容器自己宣告。
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
const ids = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) ids(k, out)
  return out
}
const run = async (c: string): Promise<{ out: string; err: string }> => {
  const i = new SemanticInterpreter({ maxSteps: 200_000 })
  try { await i.execute(lift(c)); return { out: i.getOutput().join(''), err: '' } }
  catch (e) { return { out: i.getOutput().join(''), err: (e as Error).message } }
}
const H = '#include <iostream>\n#include <set>\n#include <string>\nusing namespace std;\n'
const S = apcs as unknown as StylePreset
const SET3 = 'set<int> s; s.insert(1); s.insert(3); s.insert(5);'

describe('膠囊自證：有序容器的查找', () => {
  it('★ lift：認得 find，而且不落進殘差', () => {
    const a = ids(lift(`${H}int main(){ ${SET3} auto it = s.find(3); }`))
    expect(a, '🔴 沒認出來 → 下面每一條都在驗空集合').toContain('cpp:container_find')
    expect(a).not.toContain('cpp:raw_code')
  })

  it('🔴 而字串的搜尋【不得】被這顆搶走——同一個方法名，兩個語義', () => {
    const a = ids(lift(`${H}int main(){ string t = "abc"; cout << t.find("b"); }`))
    expect(a, '🔴 搶走的話回傳的會是一個位置，而字串的搜尋要回索引')
      .not.toContain('cpp:container_find')
  })

  it('★ 三個方法名走同一顆，而判準進屬性', () => {
    for (const [m, how] of [['find', 'find'], ['lower_bound', 'lower_bound'], ['upper_bound', 'upper_bound']]) {
      const t = lift(`${H}int main(){ ${SET3} auto it = s.${m}(3); }`)
      const found: SemanticNode[] = []
      const walk = (n: SemanticNode): void => {
        if (n.componentId === 'cpp:container_find') found.push(n)
        for (const ks of Object.values(n.slots ?? {})) for (const k of ks) walk(k)
      }
      walk(t)
      expect(found.length, `🔴 ${m} 沒被認出來`).toBeGreaterThan(0)
      expect(found[0].properties.how).toBe(how)
    }
  })

  it('★ generate：三種都吐得回去', () => {
    for (const m of ['find', 'lower_bound', 'upper_bound']) {
      expect(generateCode(lift(`${H}int main(){ ${SET3} auto it = s.${m}(3); }`), 'cpp', S))
        .toContain(`s.${m}(3)`)
    }
  })

  it('★ 語義不動點：轉一圈回來是同一棵樹', () => {
    const src = `${H}int main(){ ${SET3} auto it = s.lower_bound(2); }`
    const once = ids(lift(src)).join(',')
    expect(ids(lift(generateCode(lift(src), 'cpp', S))).join(',')).toBe(once)
  })

  it('🔴 execute：找得到給那一格，找不到給【結尾之後】', async () => {
    const r = await run(`${H}int main(){ ${SET3} cout << (s.find(3) != s.end()) << (s.find(9) != s.end()); }`)
    expect(r.err).toBe('')
    expect(r.out, '🔴 找不到若丟錯或回空，`it != c.end()` 這個標準寫法就沒有意義了').toBe('10')
  })

  it('🔴 execute：三種判準的差別（1,3,5 上找 2）', async () => {
    const r = await run(`${H}int main(){ ${SET3}
      cout << *s.lower_bound(2) << *s.upper_bound(3) << (s.find(2) == s.end()); }`)
    expect(r.err).toBe('')
    expect(r.out, '🔴 不小於 2 的第一個是 3、大於 3 的第一個是 5、而 2 不在裡面').toBe('351')
  })
})
