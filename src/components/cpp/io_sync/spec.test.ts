/**
 * `cpp:io_sync` 的自證測。
 *
 * ⚠️ **每一條負向前面先釘一個正向**——`expect(ids).not.toContain(…)`
 * 在集合是空的時候也會過，而一支空過的測試與健康的長得一模一樣。
 *
 * ## 這顆的執行那一路刻意是空的
 *
 * 所以這裡測的不是「它做了什麼」，是「**它不再擋住後面的程式**」
 * ——修之前整段競賽框架停在第一行（`UNDEFINED_FUNC`），
 * 學生的程式一行都沒跑到。
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

describe('膠囊自證：cpp:io_sync', () => {
  it('★ lift：ios:: 與 ios_base:: 兩種寫法都認得，且不落進殘差', () => {
    for (const src of [
      'int main(){ ios::sync_with_stdio(false); }',
      'int main(){ ios_base::sync_with_stdio(false); }',
    ]) {
      const ids = collect(lift(src))
      expect(ids, src).toContain('cpp:io_sync')   // ← 正向錨點：先證明量到了東西
      expect(ids, src).not.toContain('raw_code')
      expect(ids, src).not.toContain('unresolved')
    }
  })

  it('★ generate：兩種寫法都產回 ios::（正規化，見 generate.ts 的理由）', () => {
    for (const src of [
      'int main(){ ios::sync_with_stdio(false); }',
      'int main(){ ios_base::sync_with_stdio(false); }',
    ]) {
      const code = generateCode(lift(src), 'cpp', apcs as unknown as StylePreset)
      expect(code, src).toContain('ios::sync_with_stdio(false)')
    }
  })

  it('★ execute：它不做事，而**後面的程式要跑得到**', async () => {
    const i = new SemanticInterpreter({ maxSteps: 100000 })
    await i.execute(lift('int main(){ ios::sync_with_stdio(false); cout << 42; }'))
    // 🔴 修之前這裡丟 UNDEFINED_FUNC，整段停在第一行——輸出是空的
    expect(i.getOutput().join('')).toBe('42')
  })
})
