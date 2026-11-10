/**
 * 接收者的括號（2026-11-10 驗收運算子積木時撞到）。
 * 使用者寫的括號只活在程式碼那一路，走過積木就沒了，所以產生器要依優先級自己補。
 * 測法：lift 之後拿掉括號的排版提示，等於走過一趟積木。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { liftPython, generatePython } from '../helpers/python-lift'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

function dropParens(n: SemanticNode): SemanticNode {
  const metadata = n.metadata?.layoutHints
    ? { ...n.metadata, layoutHints: { ...n.metadata.layoutHints, parenthesized: false } }
    : n.metadata
  const slots = Object.fromEntries(Object.entries(n.slots ?? {}).map(([k, v]) => [k, v.map(dropParens)]))
  return { ...n, metadata, slots } as SemanticNode
}

const CPP: string[] = [
  'int f(V a, V b) { return (a + b).get(); }',
  'int f(V a, V b) { return (a + b).x; }',
  'int f(string a, string b) { return (a + b).size(); }',
  'int f(V a, V b, bool c) { return (c ? a : b).x; }',
  'int f(V* p) { return (*p).x; }',
  'int f(V* p) { return (p + 1)->x; }',
  'int f(V* it) { return (++it)->x; }',
  'int f(int* p, int i) { return (p + 1)[i]; }',
]
const CPP_UNCHANGED: string[] = [
  'int f(V a) { return a.get(); }',
  'int f(V* it) { return it++->x; }',
  'int f(vector<V> v) { return v[0].get(); }',
  'int f(V a) { return a.b.c; }',
]
const PY: string[] = [
  'x = (a + b).upper()',
  'x = (a if c else b).upper()',
  'x = (a + b).real',
  'x = (a + b)[0]',
  'x = (a + b)[1:2]',
  'x = (lambda: 1).__name__',
]

describe('接收者要帶的括號，走過積木也不能掉', () => {
  let parser: Parser
  let lifter: ReturnType<typeof createTestLifter>
  beforeAll(async () => {
    await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
    parser = new Parser()
    parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
    lifter = createTestLifter()
    setupTestRenderer()
    registerCppLanguage()
  })
  const roundCpp = (code: string): string => {
    const tree = lifter.lift(parser.parse(code)!.rootNode as never)!
    return generateCode(dropParens(tree), 'cpp', apcs as unknown as StylePreset)
  }
  const bodyOf = (code: string) => code.slice(code.indexOf('return'), code.lastIndexOf('}')).trim()

  it.each(CPP)('C++ 要補：%s', (code) => {
    expect(bodyOf(roundCpp(code))).toBe(bodyOf(code))
  })
  it.each(CPP_UNCHANGED)('C++ 不多加：%s', (code) => {
    expect(bodyOf(roundCpp(code))).toBe(bodyOf(code))
  })
  it.each(PY)('Python 要補：%s', async (code) => {
    const tree = await liftPython(code)
    expect(tree).not.toBeNull()
    expect(generatePython(dropParens(tree!)).trim()).toBe(code)
  })
})
