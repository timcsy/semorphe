/**
 * `python:literal_string` 的自證測。
 *
 * ## 為什麼有這一顆
 *
 * 在它之前，`print("hi")` 的引數**降級成 `cpp_raw_expression`**——
 * 學生看到的是一坨灰色的方塊，裡面寫著 `"hi"`。
 *
 * > **一顆積木做得到「產得回去」，不代表學生看得懂它。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser } from 'web-tree-sitter'
import { createPythonLifter } from '../../../../tests/helpers/python-lift'
import { PythonParser } from '../../../languages/python/parser'
import { registerLanguage, generateCode } from '../../../core/projection/code-generator'
import { registerGenerate } from './generate'
import { registerGenerate as registerPrint } from '../print/generate'
import { registerGenerate as registerProgram } from '../program/generate'
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
    registerGenerate(g); registerPrint(g); registerProgram(g)
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

describe('python:literal_string', () => {
  it('★ lift：認得出來，而且【不是】降級', async () => {
    const got = ids(await liftPy('print("hi")'))
    // 正向錨點在前——lift 回 null 時集合是空的，負向會空過
    expect(got, '沒認出字串字面值 → 下面那條會空過').toContain('python:literal_string')
    expect(got, '⚠️ 還在降級 → 學生看到的是一坨灰色方塊').not.toContain('raw_code')
  })

  it('★ generate：產得回去', async () => {
    const tree = await liftPy('print("hi")')
    expect(generateCode(tree, 'python', googleStyle as StylePreset).trim()).toBe('print("hi")')
  })

  it('★ round-trip：多個引數也一字不差', async () => {
    const tree = await liftPy('print("a", "b")')
    expect(ids(tree).filter((i) => i === 'python:literal_string').length,
      '兩個引數應該是兩顆字面值').toBe(2)
    expect(generateCode(tree, 'python', googleStyle as StylePreset).trim()).toBe('print("a", "b")')
  })

  it('★ 反向：C++ 的字串**不得**被認成 Python 那顆', async () => {
    const t = await py.parse('print("hi")')
    const got = ids(lifter.lift(t.rootNode as never)!)
    expect(got.filter((i) => i === 'cpp:literal_string'),
      '⚠️ Python 的樹裡出現 cpp 的身分 → lift 樣式的 astNodeType 撞了').toEqual([])
  })
})
