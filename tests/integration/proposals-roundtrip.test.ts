/**
 * **結構操作改過的樹，轉成程式碼再轉回來是同一棵**（spec 220 SC-005）。
 *
 * 四種語言各取一支課文解答，套用四種操作（改屬性、插入、移動、刪除），
 * 產出程式碼、再 lift 回來：元件、屬性、接點的形狀都相同——提議接受之後，程式碼與積木說的是同一件事。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { liftPython, generatePython } from '../helpers/python-lift'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { allCppComponents } from '../../src/languages/cpp/all-declarations'
import { slotsOf } from '../../src/core/component/traits'
import { applyOps, schemaFrom, type NodeSpec, type OpSchema, type TreeOp } from '../../src/core/proposals/tree-ops'
import type { SemanticNode, StylePreset } from '../../src/core/types'
import apcs from '../../src/languages/cpp/styles/apcs.json'

const style = apcs as unknown as StylePreset
let parser: Parser
let cppSchema: OpSchema
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
  cppSchema = schemaFrom(allCppComponents())
})

const read = (p: string): string => fs.readFileSync(`lessons/${p}`, 'utf8')
const liftCpp = (src: string): SemanticNode => createTestLifter().lift(parser.parse(src)!.rootNode as never) as SemanticNode

/** 形狀：元件、屬性、接點（不含 id）。 */
const shape = (n: SemanticNode): unknown => ({
  c: n.componentId,
  p: n.properties,
  s: Object.fromEntries(Object.entries(n.slots ?? {}).filter(([, v]) => v.length > 0).map(([k, v]) => [k, v.map(shape)])),
})
const toSpec = (n: SemanticNode): NodeSpec => ({
  componentId: n.componentId,
  properties: { ...n.properties },
  slots: Object.fromEntries(Object.entries(n.slots ?? {}).map(([k, v]) => [k, v.map(toSpec)])),
})

/** 找一個裝語句、至少有兩句的接點（最深的那一個）。 */
function statementList(tree: SemanticNode): { parent: SemanticNode; slot: string } {
  let best: { parent: SemanticNode; slot: string; depth: number } | null = null
  const walk = (n: SemanticNode, depth: number): void => {
    for (const s of slotsOf(n.componentId)) {
      if (s.isBody && (n.slots[s.slot]?.length ?? 0) >= 2 && (!best || depth >= best.depth)) best = { parent: n, slot: s.slot, depth }
    }
    for (const kids of Object.values(n.slots ?? {})) for (const k of kids) walk(k, depth + 1)
  }
  walk(tree, 0)
  if (!best) throw new Error('找不到兩句以上的語句串')
  return best
}

function firstWith(tree: SemanticNode, pred: (n: SemanticNode) => boolean): SemanticNode {
  const st = [tree]
  while (st.length) { const n = st.shift()!; if (pred(n)) return n; for (const k of Object.values(n.slots ?? {})) st.push(...k) }
  throw new Error('找不到')
}

/** 四種操作：改一個字面值、複製第一句插在第二個位置、把第一句移到最後、刪掉原本的最後一句。 */
function fourOps(tree: SemanticNode): TreeOp[] {
  const { parent, slot } = statementList(tree)
  const kids = parent.slots[slot]
  const lit = firstWith(tree, (n) => typeof n.properties.value === 'string' && /^\d+$/.test(n.properties.value as string))
  return [
    { op: 'setProperty', node: lit.id, name: 'value', value: '7' },
    { op: 'insert', parent: parent.id, slot, index: 1, node: toSpec(kids[0]) },
    { op: 'move', node: kids[0].id, parent: parent.id, slot, index: kids.length },
    { op: 'remove', node: kids[kids.length - 1].id },
  ]
}

function applied(tree: SemanticNode, schema: OpSchema): SemanticNode {
  const r = applyOps(tree, fourOps(tree), schema)
  if (!r.ok) throw new Error(JSON.stringify(r.reason))
  return r.tree
}

describe('套用四種操作之後，產碼再 lift 回同一棵', () => {
  const cases: [string, string][] = [
    ['C++', 'cpp-beginner/05-程式從哪開始/solutions/make.cpp'],
    ['C', 'c-bridge/01-同一份程式，兩種說法/solutions/max.c'],
    ['Arduino', 'arduino/04-按鈕/solutions/lit~pullup.cpp'],
  ]
  for (const [name, file] of cases) {
    it(`${name}：${file}`, () => {
      const t0 = liftCpp(read(file))
      const t = applied(t0, cppSchema)
      expect(shape(t)).not.toEqual(shape(t0))   // 操作真的改了東西
      const code = generateCode(t, 'cpp', style)
      expect(shape(liftCpp(code))).toEqual(shape(t))
    })
  }
  it('Python：python-beginner/05-選擇/solutions/make.py', async () => {
    const t0 = await liftPython(read('python-beginner/05-選擇/solutions/make.py'))
    const t = applied(t0!, schemaFrom([]))
    expect(shape(t)).not.toEqual(shape(t0!))
    const code = generatePython(t)
    expect(shape((await liftPython(`${code}\n`))!)).toEqual(shape(t))
  })
})
