/**
 * `cpp:io_flush` 的自證測——**一個真正的 no-op，而那不是敷衍**。
 *
 * ## 🔴 它與同族那顆換行的差在哪裡
 *
 * 兩顆的形狀**全同**（0 引數／0 接點／運算式），而判準（`元件代數.md`）逐字是
 * 「引數個數不同、**或語義上做的事不同**」——換行做兩件事，這一顆做一件。
 *
 * ⚠️ 而它在這個直譯器裡**沒有可觀察的效果**（輸出沒有緩衝）。
 * 這一支驗的是「它不會弄壞任何東西」與「它轉得回去」，不是「它做了什麼」。
 *
 * > **一個「什麼都不做」的實作，與一個「還沒做」的實作長得一樣
 * > ——差別只在有沒有人寫下為什麼，以及有沒有測試釘住那個「不做」。**
 *
 * ⚠️ 互相影響的那幾條驗在同族帶值的那顆膠囊裡——三顆共用同一份串流狀態。
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

describe('膠囊自證：立刻送出', () => {
  it('★ lift：認得，而且不落進殘差', () => {
    const ids = collect(lift(prog(`cout << "a" << flush;`)))
    expect(ids).toContain('cpp:io_flush')      // ← 正向錨點
    expect(ids).not.toContain('cpp:raw_code')
  })

  it('🔴 lift：宣告過的同名變數不得被搶走', () => {
    const ids = collect(lift(prog(`int flush = 4; cout << flush;`)))
    expect(ids).toContain('cpp:var_ref')
    expect(ids).not.toContain('cpp:io_flush')
  })

  it('★ generate／round-trip：產回去一字不差', () => {
    const src = prog(`cout << "a" << flush;`)
    const once = generateCode(lift(src), 'cpp', S)
    expect(once).toContain('flush')
    expect(generateCode(lift(once), 'cpp', S)).toBe(once)
  })

  /**
   * 🔴 **它印零個字，而不是不執行**——輸出那一路對每一項都要求一個值，
   * 而「印出零個字」與「這一項不存在」在那條路上是兩件事。
   */
  it('🔴 execute：不改變輸出，也不吃掉欄寬', async () => {
    const a = await run(prog(`cout << "ab" << flush << "cd";`))
    expect(a.err).toBe('')
    expect(a.out).toBe('abcd')
    const b = await run(prog(`cout << setw(3) << flush << 7;`))
    expect(b.out, '🔴 那個 3 要給 7，不是給送出').toBe('  7')
  })
})
