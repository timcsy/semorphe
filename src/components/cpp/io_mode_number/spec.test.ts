/**
 * `cpp:io_mode_number` 的自證測——**數字的寫法**（固定小數／科學記號）。
 *
 * ## 🔴 它與同族那顆帶值的設定差在哪裡
 *
 * **引數個數不同**（0 vs 1）⟹ 是身分。而 `fixed` 與 `scientific` 之間
 * 做的是同一件事，差別只有一個值 ⟹ 一顆 ＋ 一個屬性。
 *
 * ⚠️ 「位數的意思跟著寫法走」那一條驗在同族帶值的那顆膠囊裡
 * ——它要兩顆一起用才看得出來，而**分開測的話沒有人在看**。
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

const S = apcs as unknown as StylePreset
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
const prog = (body: string): string => `${H}int main(){ ${body} return 0; }`

describe('膠囊自證：數字的寫法', () => {
  it('★ lift：兩個值都認得，而屬性帶得對', () => {
    const tree = lift(prog(`cout << fixed << 1.0; cout << scientific << 2.0;`))
    const ids = collect(tree)
    expect(ids).toContain('cpp:io_mode_number')   // ← 正向錨點
    expect(ids).not.toContain('cpp:raw_code')
    const acc: SemanticNode[] = []
    const dig = (n: SemanticNode): void => {
      if (n.componentId === 'cpp:io_mode_number') acc.push(n)
      for (const ks of Object.values(n.slots ?? {})) for (const k of ks) dig(k)
    }
    dig(tree)
    expect(acc.map((n) => n.properties.notation)).toEqual(['fixed', 'scientific'])
  })

  it('🔴 lift：宣告過的同名變數不得被搶走', () => {
    const ids = collect(lift(prog(`int fixed = 3; cout << fixed;`)))
    expect(ids).toContain('cpp:var_ref')
    expect(ids).not.toContain('cpp:io_mode_number')
  })

  it('★ generate／round-trip：兩個值都產得回去', () => {
    for (const w of ['fixed', 'scientific']) {
      const src = prog(`cout << ${w} << 1.5;`)
      const once = generateCode(lift(src), 'cpp', S)
      expect(once, `🔴 產出少了 ${w}`).toContain(w)
      expect(generateCode(lift(once), 'cpp', S)).toBe(once)
    }
  })

  it('🔴 execute：兩種寫法印出來不一樣', async () => {
    const a = await run(prog(`cout << fixed << setprecision(2) << 1234.5;`))
    expect(a.out).toBe('1234.50')
    const b = await run(prog(`cout << scientific << setprecision(2) << 1234.5;`))
    expect(b.out).toBe('1.23e+03')
  })
})
