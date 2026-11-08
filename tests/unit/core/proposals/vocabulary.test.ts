/**
 * 操作者拿得到元件詞彙（spec 222）：照詞彙組的節點，不會被形態檢查拒成「不認得」。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../helpers/setup-lifter'
import { allCppComponents } from '../../../../src/languages/cpp/all-declarations'
import { applyOps, schemaFrom, type NodeSpec, type OpSchema } from '../../../../src/core/proposals/tree-ops'
import { vocabularyOf, type VocabularyEntry } from '../../../../src/core/proposals/vocabulary'
import type { SemanticNode } from '../../../../src/core/types'

let parser: Parser
let schema: OpSchema
let vocab: VocabularyEntry[]
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  schema = schemaFrom(allCppComponents())
  vocab = vocabularyOf(schema, 'cpp')
})

const tree = (): SemanticNode => createTestLifter().lift(parser.parse('int main() {\n    cout << 1;\n    return 0;\n}\n')!.rootNode as never) as SemanticNode
const find = (t: SemanticNode, c: string): SemanticNode => {
  const st = [t]
  while (st.length) { const n = st.pop()!; if (n.componentId === c) return n; for (const k of Object.values(n.slots ?? {})) st.push(...k) }
  throw new Error(c)
}
/** 只用詞彙給的資訊組一個最小節點：必填的屬性給預設值（列舉沒有預設就給第一個值）。 */
const minimal = (e: VocabularyEntry): NodeSpec => ({
  componentId: e.componentId,
  properties: Object.fromEntries(e.properties.filter((p) => p.required).map((p) => [p.name, p.default ?? p.values?.[0] ?? 'x'])),
})

describe('元件詞彙', () => {
  it('只含目前語言的元件，筆數等於這個語言宣告的元件數', () => {
    expect(vocab.length).toBeGreaterThan(100)
    expect(vocab.every((e) => e.componentId.startsWith('cpp:'))).toBe(true)
    expect(vocab.length).toBe(new Set(allCppComponents().filter((c) => c.componentId.startsWith('cpp:')).map((c) => c.componentId)).size)
  })
  it('cpp:print：語句位置；接點 values 收運算式', () => {
    const p = vocab.find((e) => e.componentId === 'cpp:print')!
    expect(p.positions).toContain('statement')
    expect(p.slots).toEqual(expect.arrayContaining([expect.objectContaining({ slot: 'values', accepts: ['expression'] })]))
  })
  it('屬性帶種類、列舉值、預設', () => {
    const d = vocab.find((e) => e.componentId === 'cpp:var_declare')!
    expect(d.properties.find((p) => p.name === 'name')).toMatchObject({ kind: 'identifier', required: true, default: 'x' })
  })
  it('Python 的語言套件沒有宣告清單，也拿得到', () => {
    const py = vocabularyOf(schemaFrom([]), 'python')
    expect(py.some((e) => e.componentId === 'python:print')).toBe(true)
    expect(py.every((e) => e.componentId.startsWith('python:'))).toBe(true)
  })
  it('是純資料（可序列化、來回不變）', () => {
    expect(JSON.parse(JSON.stringify(vocab))).toEqual(vocab)
  })
  it('★ 照詞彙組的最小節點，插入時不會被拒成「不認得」或「屬性不對」', () => {
    const t = tree()
    const body = find(t, 'cpp:func_def')
    const values = find(t, 'cpp:print')
    const bad: string[] = []
    for (const e of vocab) {
      const target = e.positions.includes('statement')
        ? { parent: body.id, slot: 'body' }
        : { parent: values.id, slot: 'values' }
      const r = applyOps(t, [{ op: 'insert', ...target, index: 0, node: minimal(e) }], schema)
      if (!r.ok && ['unknown-component', 'unknown-slot', 'unknown-property', 'bad-value'].includes(r.reason.code)) {
        bad.push(`${e.componentId}: ${r.reason.code} ${r.reason.detail}`)
      }
    }
    expect(bad).toEqual([])
  })
})
