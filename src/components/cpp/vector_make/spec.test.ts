/** `cpp:vector_make` 的自證測——每一條負向前面先釘一個正向。 */
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

const H = '#include <iostream>\n#include <vector>\nusing namespace std;\n'
const lift = (body: string): SemanticNode =>
  createTestLifter().lift(parser.parse(H + `int main(){ ${body} }`)!.rootNode as never) as SemanticNode
const collect = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const ks of Object.values(n.children ?? {})) for (const k of ks) collect(k, out)
  return out
}
const run = async (body: string): Promise<string> => {
  const i = new SemanticInterpreter({ maxSteps: 200000 })
  await i.execute(lift(body))
  return i.getOutput().join('')
}

describe('膠囊自證：cpp:vector_make', () => {
  it('★ lift：認得，且不落進殘差', () => {
    const ids = collect(lift('vector<vector<int>> g(2, vector<int>(3, 7)); cout << g[1][2];'))
    expect(ids).toContain('cpp:vector_make')     // ← 正向錨點
    expect(ids).not.toContain('raw_code')
    expect(ids).not.toContain('unresolved')
  })

  it('★ generate：產回原樣（含填充值）', () => {
    const code = generateCode(
      lift('vector<vector<int>> g(2, vector<int>(3, 7)); cout << g[1][2];'),
      'cpp', apcs as unknown as StylePreset,
    )
    expect(code).toContain('vector<vector<int>> g(2, vector<int>(3, 7))')
  })

  it('★ execute：二維向量讀得到', async () => {
    expect(await run('vector<vector<int>> g(2, vector<int>(3, 7)); cout << g[1][2];')).toBe('7')
  })

  it('★ execute：**每一列是獨立的複本**', async () => {
    // 🔴 共用同一個列物件的話，`g[0][0] = 9` 會同時改到 `g[1][0]`
    // ——而症狀離現場很遠：程式跑完、印出東西、而它是錯的。
    expect(await run('vector<vector<int>> g(2, vector<int>(3, 0)); g[0][0]=9; cout << g[1][0];')).toBe('0')
  })

  it('★ 一維的填充值形式（不得因為修二維而壞掉）', async () => {
    expect(await run('vector<int> v(3, 5); cout << v[0] << v[2];')).toBe('55')
  })

  it('★ 只有大小時仍是預設值', async () => {
    expect(await run('vector<int> v(3); cout << v.size() << v[0];')).toBe('30')
  })
})
