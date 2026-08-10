/**
 * `cpp:math_binary` 的自證測。
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

describe('膠囊自證：cpp:math_binary', () => {
  it('★ lift：`fmax(3.0, 7.0)` 得到這顆身分', () => {
    expect(身分們(樹(程式('fmax(3.0, 7.0)')))).toContain('cpp:math_binary')
  })

  it('★ generate：產回 fmax(3.0, 7.0)', () => {
    const t = createNode('cpp:program', {}, { body: [createNode('cpp:math_binary', { func: 'fmax' }, {
        arg1: [createNode('cpp:literal_number', { value: '3.0' })],
        arg2: [createNode('cpp:literal_number', { value: '7.0' })],
      })] })
    expect(generateCode(t, 'cpp', apcs as unknown as StylePreset)).toContain('fmax(3.0, 7.0)')
  })

  it('★ execute：`fmax(3.0, 7.0)` 印出 7', async () => {
    const t = 樹(程式('fmax(3.0, 7.0)'))
    expect(JSON.stringify(t)).toContain('cpp:math_binary')   // ← 先證明它進了樹
    const i = new SemanticInterpreter({ maxSteps: 100000 })
    await i.execute(t)
    expect(i.getOutput().join('').trim()).toBe('7')
  })

  it('★ 5 個函式名共用一顆身分', () => {
    for (const f of ['fmod', 'hypot', 'atan2', 'fmin', 'fmax']) {
      const ids = 身分們(樹(程式(`${f}(3.0, 4.0)`)))
      expect(ids, `${f}() 必須被辨識成 cpp:math_binary`).toContain('cpp:math_binary')
    }
  })
})
