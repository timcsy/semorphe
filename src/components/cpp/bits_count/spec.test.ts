/**
 * `cpp:bits_count` 的自證測——每一條負向前面先釘一個正向。
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

const H = '#include <iostream>\nusing namespace std;\n'
const lift = (c: string): SemanticNode =>
  createTestLifter().lift(parser.parse(H + c)!.rootNode as never) as SemanticNode
const collect = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.conceptId)
  for (const ks of Object.values(n.children ?? {})) for (const k of ks) collect(k, out)
  return out
}
const run = async (c: string): Promise<string> => {
  const i = new SemanticInterpreter({ maxSteps: 100000 })
  await i.execute(lift(c))
  return i.getOutput().join('')
}

describe('膠囊自證：cpp:bits_count', () => {
  it('★ lift：認得，且不落進殘差', () => {
    const ids = collect(lift('int main(){ cout << __builtin_popcount(7); }'))
    expect(ids).toContain('cpp:bits_count')      // ← 正向錨點
    expect(ids).not.toContain('raw_code')
    expect(ids).not.toContain('unresolved')
  })

  it('★ generate：產回原樣', () => {
    const code = generateCode(lift('int main(){ cout << __builtin_popcount(7); }'), 'cpp', apcs as unknown as StylePreset)
    expect(code).toContain('__builtin_popcount(7)')
  })

  it('★ execute：數 1 的個數', async () => {
    expect(await run('int main(){ cout << __builtin_popcount(7); }'), '7 = 0b111').toBe('3')
    expect(await run('int main(){ cout << __builtin_popcount(0); }'), '0 沒有 1').toBe('0')
    expect(await run('int main(){ cout << __builtin_popcount(8); }'), '8 = 0b1000').toBe('1')
  })

  it('★ execute：負數以 32 位無號解讀——**帶號位移會讓迴圈不結束**', async () => {
    expect(await run('int main(){ cout << __builtin_popcount(-1); }')).toBe('32')
  })

  it('★ execute：引數是運算式而不只是常值', async () => {
    expect(await run('int main(){ int x = 5; cout << __builtin_popcount(x | 2); }'), '5|2 = 7').toBe('3')
  })
})
