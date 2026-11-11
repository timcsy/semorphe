/**
 * **兩個宿主同結果**（spec 218 SC-004）：同一份比對，一次用測試的 Judge（Node：樹 → 產碼 → runCella），
 * 一次用產品的 `makeCheckJudge`（瀏覽器那條路的翻譯層：判決請求 → CheckAnswer → 比對結果；這裡的 check 背後也接 Node 的判決）。
 * 兩者的比對結果要完全相同——瀏覽器的 worker 那一側由 e2e `disambiguation.spec.ts` 走（畫面上的結果與這裡相同）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { runCella } from '../helpers/cella-run'
import { compareInterpretations } from '../../src/core/disambiguation/compare'
import { scenariosFor } from '../../src/core/disambiguation/scenario-registry'
import { makeCheckJudge, outputLevels } from '../../src/core/disambiguation/check-judge'
import { interpretationSolutionFor } from '../../src/core/lesson/load-lessons'
import type { Judge } from '../../src/core/disambiguation/types'
import type { CheckAnswer, CheckRequest } from '../../src/core/capabilities'
import cStyle from '../../src/languages/cpp/styles/c.json'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})
const lift = (src: string): SemanticNode => createTestLifter().lift(parser.parse(src)!.rootNode as never) as SemanticNode

function nodeJudge(lang: 'c' | 'cpp', board?: string): Judge {
  return async (tree, s) => {
    const p = s.payload as { text?: string; events?: { t: number; key: string; value: number }[] }
    const r = await runCella(generateCode(tree, 'cpp', (lang === 'c' ? cStyle : apcs) as StylePreset), { lang, stdin: p.text ?? '', ...(board ? { board, inputs: p.events ?? [], steps: 2_000_000 } : {}) })
    return { verdict: r.verdict, out: r.out, ...(board ? { board: outputLevels(r.raw as never) } : {}), problems: [...r.problems.map((x) => ({ kind: x.kind, ...(x.reason ? { reason: x.reason } : {}) })), ...r.untranslated.map((u) => ({ kind: 'untranslated', reason: u.reason }))] }
  }
}
/** 產品那條路的 check：請求 → 判決（背後接 Node 的判決器） */
function nodeCheck(lang: 'c' | 'cpp', board?: string): (req: CheckRequest) => Promise<CheckAnswer> {
  return async (req) => {
    const r = await runCella(generateCode(req.tree, 'cpp', (lang === 'c' ? cStyle : apcs) as StylePreset), { lang, stdin: req.input, ...(board ? { board, inputs: [...(req.boardInputs ?? [])], steps: 2_000_000 } : {}) })
    if (r.verdict === 'untranslated') return { verdict: { verdict: 'invalid', basis: 'computed', exit: null, out: '', problems: r.untranslated.map((u) => ({ kind: 'untranslated', reason: u.reason })) } as never, types: null, stale: false, readsInput: false }
    return { verdict: r.raw as never, types: null, stale: false, readsInput: false }
  }
}
const BASE = { targetId: 'x', styleId: 'x', skeletonId: 'x' }

describe('兩個宿主同結果（spec 218）', () => {
  it('★ C 示範題：測試的 Judge 與產品的 makeCheckJudge 比出一模一樣的結果', async () => {
    const L = 'c-bridge/01-同一份程式，兩種說法'
    const refs = ['zero', 'eof'].map((id) => ({ id, label: id, tree: lift(interpretationSolutionFor(L, 'max', id)!) }))
    const student = lift(interpretationSolutionFor(L, 'max', 'eof')!.replace('int best = 0;', 'int best = 0; '))
    const sc = scenariosFor(student)
    const a = await compareInterpretations(student, refs, sc, nodeJudge('c'))
    const b = await compareInterpretations(student, refs, sc, makeCheckJudge(nodeCheck('c'), BASE))
    expect(b.results.map((x) => [x.id, x.status, x.firstMismatch?.scenario.label])).toEqual(a.results.map((x) => [x.id, x.status, x.firstMismatch?.scenario.label]))
    expect(a.results.find((x) => x.id === 'eof')!.status).toBe('consistent')
  }, 600_000)
  it('★ Arduino 示範題：同上（含結束時輸出腳的電位）', async () => {
    const L = 'arduino/04-按鈕'
    const refs = ['pulldown', 'pullup'].map((id) => ({ id, label: id, tree: lift(interpretationSolutionFor(L, 'lit', id)!) }))
    const student = refs[1].tree
    const sc = scenariosFor(student)
    const a = await compareInterpretations(student, refs, sc, nodeJudge('cpp', 'uno'))
    const b = await compareInterpretations(student, refs, sc, makeCheckJudge(nodeCheck('cpp', 'uno'), BASE))
    expect(b.results.map((x) => [x.id, x.status, x.firstMismatch?.scenario.label])).toEqual(a.results.map((x) => [x.id, x.status, x.firstMismatch?.scenario.label]))
    expect(a.results.map((x) => x.status)).toEqual(['inconsistent', 'consistent'])
  }, 600_000)
})
