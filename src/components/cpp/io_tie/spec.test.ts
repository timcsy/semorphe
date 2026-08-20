/**
 * `cpp:io_tie` 的自證測。理由與「關閉輸入輸出同步」那顆同一條：
 * 執行那一路刻意是空的，所以測的是「**它不再擋住後面的程式**」。
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
  out.push(n.componentId)
  for (const ks of Object.values(n.children ?? {})) for (const k of ks) collect(k, out)
  return out
}

describe('膠囊自證：cpp:io_tie', () => {
  it('★ lift：三種空值寫法都認得，接收者進 obj', () => {
    for (const arg of ['nullptr', '0', 'NULL']) {
      const src = `int main(){ cin.tie(${arg}); }`
      const ids = collect(lift(src))
      expect(ids, src).toContain('cpp:io_tie')
      expect(ids, src).not.toContain('raw_code')
    }
  })

  it('★ generate：接收者與引數都保留——`cin.tie(&cout)` 是重新綁定，不是解除', () => {
    const code = generateCode(lift('int main(){ cin.tie(nullptr); }'), 'cpp', apcs as unknown as StylePreset)
    expect(code).toContain('cin.tie(nullptr)')
  })

  it('★ execute：它不做事，而後面的程式要跑得到', async () => {
    const i = new SemanticInterpreter({ maxSteps: 100000 })
    await i.execute(lift('int main(){ cin.tie(nullptr); cout << 7; }'))
    // 🔴 修之前這裡丟 UNDECLARED_VAR: cin——`cin` 被當成一個變數去查
    expect(i.getOutput().join('')).toBe('7')
  })
})
