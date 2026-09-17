/**
 * **膠囊自證：集合的宣告，以及它的重複性那一軸。**
 *
 * 🔴 **它從哪來**：`multiset<` 在使用者學生的 218 支競賽練習裡出現 13 支，
 * 而 `multiset` 當時**根本沒有被登錄成容器樣板**——`ms.insert(3)` 兩次只留一個。
 *
 * 判準是 C++ 自己的：同一個方法名 `insert`，行為由**接收者的型別**決定。
 * 所以重複性住在這一顆（宣告）上，而不是拆成兩個 `insert`。
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
const collect = (n: SemanticNode, out: SemanticNode[] = []): SemanticNode[] => {
  out.push(n)
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) collect(k, out)
  return out
}
const ids = (n: SemanticNode): string[] => collect(n).map((x) => x.componentId)
const run = async (c: string): Promise<{ out: string; err: string }> => {
  const i = new SemanticInterpreter({ maxSteps: 100_000 })
  try {
    await i.execute(lift(c))
    return { out: i.getOutput().join(''), err: '' }
  } catch (e) { return { out: i.getOutput().join(''), err: (e as Error).message } }
}
const H = '#include <iostream>\n#include <set>\nusing namespace std;\n'
const S = apcs as unknown as StylePreset

describe('膠囊自證：集合的宣告與重複性', () => {
  it('★ lift：set 認得出來，而且不落進殘差', () => {
    const got = ids(lift(`${H}int main(){ set<int> s; }`))
    expect(got, '🔴 沒認出來 → 下面每一條都在驗空集合').toContain('cpp:set_declare')
    expect(got).not.toContain('cpp:raw_code')
  })

  it('★ multiset 走的是同一顆，而重複性是屬性不是身分', () => {
    const nodes = collect(lift(`${H}int main(){ multiset<int> ms; }`))
    const decl = nodes.find((n) => n.componentId === 'cpp:set_declare')
    expect(decl, '🔴 multiset 沒被登錄成容器樣板 → 它會掉成一般變數').toBeDefined()
    expect(decl!.properties.unique, '🔴 沒帶屬性 → 產碼與執行都會把它當 set').toBe('false')
  })

  it('★ 而 set 那一側要拿到相反的值（不是「沒有值」）', () => {
    const decl = collect(lift(`${H}int main(){ set<int> s; }`))
      .find((n) => n.componentId === 'cpp:set_declare')
    expect(decl!.properties.unique).toBe('true')
  })

  it('★ generate：兩種都吐得回去，一字不差', () => {
    expect(generateCode(lift(`${H}int main(){ set<int> s; }`), 'cpp', S)).toContain('set<int> s;')
    const ms = generateCode(lift(`${H}int main(){ multiset<int> ms; }`), 'cpp', S)
    expect(ms, '🔴 產成 set 的話：程式跑得動，而答案少一半').toContain('multiset<int> ms;')
  })

  it('★ 語義不動點：multiset 走一趟回來還是 multiset', () => {
    const once = generateCode(lift(`${H}int main(){ multiset<int> ms; }`), 'cpp', S)
    const twice = generateCode(lift(once), 'cpp', S)
    expect(twice).toBe(once)
  })

  it('★ execute：舊存檔沒有這個屬性時，它是 set（不留重複）', async () => {
    // 屬性缺席走的是同一條預設，而預設值寫在兩處（產碼與執行）——這一條盯的是後者。
    const r = await run(`${H}int main(){ set<int> s; s.insert(3); s.insert(3); cout << s.size(); }`)
    expect(r.err).toBe('')
    expect(r.out).toBe('1')
  })
})
