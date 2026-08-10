/**
 * `cpp:math_pow` 的自證測。
 *
 * 這一顆與另外兩顆 cmath 元件一起搬家，而**整個 `<cmath>` 模組因此清空**——
 * 它只剩「這個標頭存在」這件事本身。搬家的形狀來歷見 `lift.ts` 檔頭：
 * `tryCmathLift()` 看起來像實作，拆開只剩三列資料。
 *
 * ⚠️ 每一條負向前面先釘一個正向：**空集合也會讓 `not.toContain` 過。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { SemanticInterpreter } from '../../../interpreter/interpreter'
import { generateCode } from '../../../core/projection/code-generator'
import { createNode } from '../../../core/semantic-tree'
import apcs from '../../../languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../../core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

function 樹(src: string): SemanticNode {
  return createTestLifter().lift(parser.parse(src)!.rootNode as never) as SemanticNode
}
function 身分們(n: SemanticNode): string[] {
  const out: string[] = [n.conceptId]
  for (const kids of Object.values(n.children ?? {})) for (const k of kids) out.push(...身分們(k as SemanticNode))
  return out
}
function 程式(expr: string): string {
  return `#include <iostream>\n#include <cmath>\nusing namespace std;\nint main() { cout << ${expr}; }`
}

describe('膠囊自證：cpp:math_pow', () => {
  it('★ lift：`pow(2, 10)` 得到這顆身分', () => {
    expect(身分們(樹(程式('pow(2, 10)')))).toContain('cpp:math_pow')
  })

  it('★ generate：產回 pow(2, 10)', () => {
    const t = createNode('cpp:program', {}, { body: [createNode('cpp:math_pow', {}, {
        base: [createNode('cpp:literal_number', { value: '2' })],
        exponent: [createNode('cpp:literal_number', { value: '10' })],
      })] })
    expect(generateCode(t, 'cpp', apcs as unknown as StylePreset)).toContain('pow(2, 10)')
  })

  it('★ execute：`pow(2, 10)` 印出 1024', async () => {
    const t = 樹(程式('pow(2, 10)'))
    expect(JSON.stringify(t)).toContain('cpp:math_pow')   // ← 先證明它進了樹
    const i = new SemanticInterpreter({ maxSteps: 100000 })
    await i.execute(t)
    expect(i.getOutput().join('').trim()).toBe('1024')
  })

  it('★ lift：引數依序進 base / exponent 兩個槽——**槽名是契約**', () => {
    const n = 樹(程式('pow(2, 10)'))
    const 找 = (x: SemanticNode): SemanticNode | null => {
      if (x.conceptId === 'cpp:math_pow') return x
      for (const kids of Object.values(x.children ?? {})) for (const k of kids) {
        const r = 找(k as SemanticNode); if (r) return r
      }
      return null
    }
    const p = 找(n)!
    expect(p, 'pow(2,10) 必須產生 cpp:math_pow').not.toBeNull()
    // ⚠️ 槽名錯了不會爆，只會是空陣列——所以要指名地驗兩個槽都非空。
    expect(p.children.base?.length, 'base 槽必須有東西').toBe(1)
    expect(p.children.exponent?.length, 'exponent 槽必須有東西').toBe(1)
  })
})
