/**
 * `cpp:range_find_lower` 的自證測——每一條負向前面先釘一個正向。
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

const H = '#include <iostream>\n#include <vector>\n#include <algorithm>\nusing namespace std;\n'
const lift = (body: string): SemanticNode =>
  createTestLifter().lift(parser.parse(H + `int main(){ ${body} }`)!.rootNode as never) as SemanticNode
const collect = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.conceptId)
  for (const ks of Object.values(n.children ?? {})) for (const k of ks) collect(k, out)
  return out
}
const run = async (body: string): Promise<string> => {
  const i = new SemanticInterpreter({ maxSteps: 100000 })
  await i.execute(lift(body))
  return i.getOutput().join('')
}

describe('膠囊自證：cpp:range_find_lower', () => {
  it('★ lift：認得，且不落進殘差', () => {
    const ids = collect(lift(`vector<int> v={1,3,5,7}; cout << (lower_bound(v.begin(),v.end(),5)-v.begin());`))
    expect(ids).toContain('cpp:range_find_lower')          // ← 正向錨點：先證明量到了東西
    expect(ids).not.toContain('raw_code')
    expect(ids).not.toContain('unresolved')
  })

  it('★ generate：產回原樣', () => {
    const code = generateCode(lift(`vector<int> v={1,3,5,7}; cout << (lower_bound(v.begin(),v.end(),5)-v.begin());`), 'cpp', apcs as unknown as StylePreset)
    expect(code).toContain('lower_bound(v.begin(), v.end(), 5)')
  })

  it('★ execute', async () => {
    expect(await run(`vector<int> v={1,3,5,7}; cout << (lower_bound(v.begin(),v.end(),5)-v.begin());`)).toBe('2')
  })

  it('★ 找不到時回結尾之後的位置', async () => {
    expect(await run(`vector<int> v={1,3}; cout << (lower_bound(v.begin(),v.end(),9)-v.begin());`)).toBe('2')
  })
})
