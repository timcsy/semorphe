/**
 * 靜態作用域走訪（spec 180 FR-003）：每個參照指到宣告它的節點。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { registerCppLanguage } from '../../../src/languages/cpp/generators'
import { createTestLifter } from '../../helpers/setup-lifter'
import { resolveScopes } from '../../../src/providers/cella/formalize/scope'
import type { SemanticNode } from '../../../src/core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})
const lift = (c: string): SemanticNode => createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode

function all(t: SemanticNode, pred: (n: SemanticNode) => boolean, out: SemanticNode[] = []): SemanticNode[] {
  if (pred(t)) out.push(t)
  for (const ks of Object.values(t.slots ?? {})) for (const k of ks) all(k, pred, out)
  return out
}
/** 第 i 個叫 name 的參照，指到的宣告節點的 componentId 與 type（拿來分辨是哪一個宣告）。 */
function target(src: string): (name: string, i?: number) => SemanticNode | 'unresolved' {
  const t = lift(src)
  const { declOf } = resolveScopes(t)
  const byId = new Map(all(t, () => true).map((n) => [n.id, n]))
  return (name, i = 0) => {
    const ref = all(t, (n) => n.componentId === 'cpp:var_ref' && n.properties.name === name)[i]
    const d = declOf.get(ref.id)
    return d ? byId.get(d)! : 'unresolved'
  }
}

describe('靜態作用域走訪', () => {
  it('★ 區域遮蔽全域；內層區塊遮蔽外層', () => {
    const at = target('int x = 1;\nint main() { int x = 2; { double x = 3; cout << x; } cout << x; }')
    expect((at('x', 0) as SemanticNode).properties.type, '內層區塊的 x').toBe('double')
    expect((at('x', 1) as SemanticNode).properties.type, '離開區塊後回到 main 的 x').toBe('int')
    const t2 = target('int x = 1;\nint f() { return x; }')
    expect((t2('x') as SemanticNode).componentId, '沒有遮蔽時指到全域').toBe('cpp:var_declare')
  })

  it('★ 參數與本體同一層', () => {
    const at = target('int f(int a) { return a + 1; }')
    expect((at('a') as SemanticNode).componentId).toBe('param_decl')
  })

  it('★ for 的 init、range-for、計數迴圈的變數只在迴圈裡', () => {
    const at = target('int main() { vector<int> v; for (int k : v) { cout << k; } for (int j = 5; j > 0; j -= 2) { cout << j; } for (int i = 0; i < 3; i++) { cout << i; } }')
    expect((at('k') as SemanticNode).componentId).toBe('cpp:loop_range')
    expect((at('v') as SemanticNode).componentId, 'range-for 的 iterable 在外層').toBe('cpp:vector_declare')
    expect((at('j') as SemanticNode).componentId).toBe('cpp:var_declare')
    expect((at('i') as SemanticNode).componentId).toBe('cpp:loop_count')
  })

  it('★ 一行宣告多個名字：各自是一個宣告', () => {
    const at = target('int main() { int x, y = 3; x = y; }')
    expect((at('x') as SemanticNode).properties.name).toBe('x')
    expect((at('y') as SemanticNode).properties.name).toBe('y')
  })

  it('🔴 指不到宣告的名字出聲，不猜', () => {
    const t = lift('int main() { cout << nope; }')
    const { unresolved } = resolveScopes(t)
    expect(unresolved.map((u) => u.name)).toEqual(['nope'])
  })

  it('★ 區塊結束後裡面的名字不再看得到', () => {
    const t = lift('int main() { { int inner = 1; } cout << inner; }')
    expect(resolveScopes(t).unresolved.map((u) => u.name)).toEqual(['inner'])
  })

  it('🔴 課文的 C／C++／Arduino 解答：每個參照都指得到宣告（2026-10-31 量：94 份、852 個參照、0 個落空）', () => {
    const files: string[] = []
    for (const track of ['cpp-beginner', 'cpp-advanced', 'c-bridge', 'arduino']) {
      const walk = (d: string): void => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, e.name)
          if (e.isDirectory()) walk(p)
          else if (/solutions\/.*\.(cpp|c|ino)$/.test(p)) files.push(p)
        }
      }
      walk(path.join('lessons', track))
    }
    expect(files.length, '一份解答都沒讀到 → 下面的零是假的').toBeGreaterThan(80)
    const misses: string[] = []
    let refs = 0
    for (const f of files) {
      const r = resolveScopes(lift(fs.readFileSync(f, 'utf8')))
      refs += r.declOf.size + r.unresolved.length
      for (const u of r.unresolved) misses.push(`${f}：${u.name}`)
    }
    expect(refs, '一個參照都沒有 → 走訪沒走進去').toBeGreaterThan(500)
    expect(misses).toEqual([])
  })
})
