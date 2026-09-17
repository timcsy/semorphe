/**
 * **膠囊自證：對照表的宣告——有序性那一軸，與「用另一個容器建起來」那一格。**
 *
 * 🔴 **它在 2026-09-17 之前一個測試都沒有**，而這一刀動了它兩次：
 * 先是 `ordered` 那一軸（`map` vs `unordered_map`），再是 `source` 那一格。
 *
 * > **一顆被改過兩次而沒有自證測的元件，兩次改動都只由別人的測試間接看著。**
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
const declOf = (c: string): SemanticNode | undefined =>
  collect(lift(c)).find((n) => n.componentId === 'cpp:map_declare')
const run = async (c: string): Promise<string> => {
  const i = new SemanticInterpreter({ maxSteps: 100_000 })
  try { await i.execute(lift(c)); return i.getOutput().join('') }
  catch (e) { return 'ERR=' + (e as Error).message }
}
const H = '#include <iostream>\n#include <map>\n#include <string>\nusing namespace std;\n'
const S = apcs as unknown as StylePreset

describe('膠囊自證：對照表的宣告', () => {
  it('★ lift：認得出來，而且不落進殘差', () => {
    const got = ids(lift(`${H}int main(){ map<string,int> m; }`))
    expect(got, '🔴 沒認出來 → 下面每一條都在驗空集合').toContain('cpp:map_declare')
    expect(got).not.toContain('cpp:raw_code')
  })

  it('★ 兩個型別參數各就各位', () => {
    const d = declOf(`${H}int main(){ map<string,int> m; }`)!
    expect(d.properties.key_type).toBe('string')
    expect(d.properties.value_type).toBe('int')
  })

  it('★ 有序性是屬性不是身分——而兩側都要有值', () => {
    expect(declOf(`${H}int main(){ map<int,int> m; }`)!.properties.ordered).toBe('true')
    expect(declOf(`${H}int main(){ unordered_map<int,int> m; }`)!.properties.ordered).toBe('false')
  })

  it('★ generate：兩種都吐得回去', () => {
    expect(generateCode(lift(`${H}int main(){ map<int,int> m; }`), 'cpp', S)).toContain('map<int, int> m;')
    expect(generateCode(lift(`${H}int main(){ unordered_map<int,int> m; }`), 'cpp', S))
      .toContain('unordered_map<int, int> m;')
  })

  /**
   * 🔴 **「用另一個容器建起來」原本整段消失**（2026-09-17）：掛不掛 `source`
   * 這一格是**問宣告**的（`hasInitSourceDecl` 從 `slots` 讀），而這裡曾經是空的。
   */
  it('★ lift：初始值進得了 source 這一格', () => {
    const d = declOf(`${H}map<char,int> f(); int main(){ map<char,int> r = f(); }`)!
    expect(d.slots.source?.length, '🔴 初始值在 lift 就掉了').toBe(1)
  })

  /**
   * 🔴 **`map<char,int> f();` 是一個【函式】的前置宣告，不是一個變數**（2026-09-17）。
   * 空的參數列沒有歧義可言——「最令人困惑的解析」只在有引數時咬人。
   * 認錯的症狀：那一行變成 `map<char, int> f;`（合法），而之後 `f()` 找不到那個函式。
   */
  it('★ 函式的前置宣告不得被認成一個對照表變數', () => {
    const src = `${H}map<char,int> f();\nint main(){ map<char,int> r = f(); }`
    const decls = collect(lift(src)).filter((n) => n.componentId === 'cpp:map_declare')
    expect(decls.length, '🔴 前置宣告被認成變數了').toBe(1)
    expect(decls[0].properties.name).toBe('r')
  })

  it('★ generate：初始值產得回去（掉得對稱的話來回轉換看起來會是綠的）', () => {
    const gen = generateCode(lift(`${H}map<char,int> f(); int main(){ map<char,int> r = f(); }`), 'cpp', S)
    expect(gen, '🔴 產出 `map<char,int> r;`——合法，只是不是使用者寫的那一段')
      .toContain('map<char, int> r = f();')
  })

  it('★ 不動點：來回兩次一字不差', () => {
    const src = `${H}map<char,int> f(); int main(){ map<char,int> r = f(); }`
    const once = generateCode(lift(src), 'cpp', S)
    expect(generateCode(lift(once), 'cpp', S)).toBe(once)
  })

  it('★ execute：宣告建得出來，而 m[k] 寫得進去', async () => {
    expect(await run(`${H}int main(){ map<string,int> m; m["a"]=3; cout<<m["a"]<<m.size(); }`)).toBe('31')
  })

  it('🔴 execute：接住回傳的容器，內容要真的在', async () => {
    expect(await run(
      `${H}map<char,int> f(){ map<char,int> m; m['a']=1; return m; }\n`
      + `int main(){ map<char,int> r=f(); cout<<r.size()<<r['a']; }`)).toBe('11')
  })

  it('🔴 execute：複製要真的是複製（不是接管同一串格子）', async () => {
    expect(await run(
      `${H}int main(){ map<int,int> a; a[1]=1; map<int,int> b=a; b[2]=2; cout<<a.size()<<b.size(); }`),
    ).toBe('12')
  })
})
