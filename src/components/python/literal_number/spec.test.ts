/**
 * `python:literal_number` 的自證測。
 *
 * ## 🔴 這一顆的特別之處：**兩條 lift 樣式對一顆元件**
 *
 * Python 把整數與浮點數分成**兩種 AST 節點**（`integer`／`float`），
 * 而它們在**語義上是同一種東西**（一個數字）。
 *
 * > **AST 的分法不必是語義的分法**——那正是「解構語法之散，重塑形態之模」。
 *
 * 所以下面**兩種都要測**：只測整數的話，浮點數那條樣式壞了也不會有人知道。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser } from 'web-tree-sitter'
import { createPythonLifter } from '../../../../tests/helpers/python-lift'
import { PythonParser } from '../../../languages/python/parser'
import { registerLanguage, generateCode } from '../../../core/projection/code-generator'
import { registerGenerate } from './generate'
import { registerGenerate as registerPrint } from '../print/generate'
import { registerGenerate as registerProgram } from '../program/generate'
import { registerGenerate as registerStr } from '../literal_string/generate'
import type { Lifter } from '../../../core/lift/lifter'
import type { SemanticNode, StylePreset, NodeGenerator } from '../../../core/types'
import googleStyle from '../../../languages/cpp/styles/google.json'

let py: PythonParser
let lifter: Lifter

beforeAll(async () => {
  py = new PythonParser()
  await py.init(`${process.cwd()}/public`)
  await Parser.init()
  lifter = createPythonLifter()
  registerLanguage('python', () => {
    const g = new Map<string, NodeGenerator>()
    registerGenerate(g); registerPrint(g); registerProgram(g); registerStr(g)
    return g
  })
}, 60_000)

function ids(n: SemanticNode, out: string[] = []): string[] {
  out.push(n.componentId)
  for (const kids of Object.values(n.children ?? {})) for (const k of kids) ids(k, out)
  return out
}
async function liftPy(code: string): Promise<SemanticNode> {
  const t = await py.parse(code)
  return lifter.lift(t.rootNode as never)!
}

describe('python:literal_number', () => {
  it('★ lift：整數認得出來，而且【不是】降級', async () => {
    const got = ids(await liftPy('print(42)'))
    expect(got, '沒認出整數 → 下面那條會空過').toContain('python:literal_number')
    expect(got, '⚠️ 還在降級 → 學生看到灰色方塊').not.toContain('raw_code')
  })

  it('🔴 lift：**浮點數也要**——它是另一種 AST 節點', async () => {
    const got = ids(await liftPy('print(3.14)'))
    expect(got, '⚠️ 只做了 integer 那條樣式 → 小數會降級').toContain('python:literal_number')
    expect(got).not.toContain('raw_code')
  })

  it('★ generate：整數與小數都產得回去', async () => {
    for (const code of ['print(42)', 'print(3.14)']) {
      const tree = await liftPy(code)
      expect(generateCode(tree, 'python', googleStyle as StylePreset).trim(),
        `${code} 產回來不一樣`).toBe(code)
    }
  })

  it('★ round-trip：與字串混用也一字不差', async () => {
    const code = 'print("x =", 42)'
    const tree = await liftPy(code)
    const got = ids(tree)
    expect(got).toContain('python:literal_string')
    expect(got).toContain('python:literal_number')
    expect(generateCode(tree, 'python', googleStyle as StylePreset).trim()).toBe(code)
  })
})
