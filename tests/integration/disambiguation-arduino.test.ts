/**
 * **規格消歧：Arduino 示範題**（spec 218 US2）——按鈕課「按著按鈕時燈要亮」宣告兩個解讀（外接下拉：按下讀到 HIGH／內建上拉：按下讀到 LOW）。
 * 情境是板子的時間序列輸入（`board-inputs`，Arduino 那一族登記的）；比對序列埠輸出與結束時輸出腳的電位。
 * 也驗證抽象：同一個比對器、第二種情境（核心不認得任何一種）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { runCella } from '../helpers/cella-run'
import { compareInterpretations } from '../../src/core/disambiguation/compare'
import { scenariosFor } from '../../src/core/disambiguation/scenario-registry'
import { interpretationSolutionFor } from '../../src/core/lesson/load-lessons'
import type { Judge } from '../../src/core/disambiguation/types'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

const LESSON = 'arduino/04-按鈕'
let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})
const lift = (src: string): SemanticNode => createTestLifter().lift(parser.parse(src)!.rootNode as never) as SemanticNode
/** 結束時輸出腳的電位（判決的 env） */
const outputLevels = (raw: Record<string, unknown> | null): Record<string, number> => {
  const env = typeof raw?.env === 'string' ? JSON.parse(raw.env) as { pins?: { pin: number; mode: string; level: number }[] } : {}
  return Object.fromEntries((env.pins ?? []).filter((p) => p.mode === 'OUTPUT').map((p) => [`pin${p.pin}`, p.level]))
}
const judge: Judge = async (tree, scenario) => {
  const events = scenario.kind === 'board-inputs' ? (scenario.payload as { events: { t: number; key: string; value: number }[] }).events : []
  const r = await runCella(generateCode(tree, 'cpp', apcs as StylePreset), { board: 'uno', inputs: events, steps: 2_000_000 })
  return { verdict: r.verdict, out: r.out, board: outputLevels(r.raw), problems: [...r.problems, ...r.untranslated.map((u) => ({ kind: 'untranslated', reason: u.reason }))] }
}
const refs = (): { id: string; label: string; tree: SemanticNode }[] =>
  [['pulldown', '按下時讀到 HIGH'], ['pullup', '按下時讀到 LOW']].map(([id, label]) => ({ id, label, tree: lift(interpretationSolutionFor(LESSON, 'lit', id)!) }))

const BTN = 'const int BTN = 2;\nconst int LED = 13;\n'
const STUDENT_DOWN = `${BTN}void setup() {\n  pinMode(BTN, INPUT);\n  pinMode(LED, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(LED, LOW);\n  if (digitalRead(BTN) == HIGH) {\n    digitalWrite(LED, HIGH);\n  }\n  delay(10);\n}\n`
const STUDENT_UP = `${BTN}void setup() {\n  pinMode(BTN, INPUT_PULLUP);\n  pinMode(LED, OUTPUT);\n}\n\nvoid loop() {\n  if (digitalRead(BTN) == HIGH) {\n    digitalWrite(LED, LOW);\n  } else {\n    digitalWrite(LED, HIGH);\n  }\n  delay(10);\n}\n`
const STUDENT_ALWAYS = `${BTN}void setup() {\n  pinMode(LED, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(LED, HIGH);\n  delay(10);\n}\n`

describe('規格消歧：Arduino 示範題（按鈕怎麼接）', () => {
  it('情境：板子的時間序列輸入，含「按下又放開」', () => {
    const s = scenariosFor(lift(STUDENT_DOWN))
    expect(s.filter((x) => x.kind === 'board-inputs').map((x) => x.label)).toEqual(expect.arrayContaining(['腳 2 一直放開', '腳 2 按下又放開']))
  })
  for (const [name, src, want] of [['外接下拉的學生', STUDENT_DOWN, ['pulldown']], ['內建上拉的學生', STUDENT_UP, ['pullup']], ['燈一直亮的學生（兩種都不是）', STUDENT_ALWAYS, []]] as const) {
    it(`★ ${name} → 一致的解讀是 ${JSON.stringify(want)}；不一致附得出情境與兩邊的腳位`, async () => {
      const student = lift(src)
      const r = await compareInterpretations(student, refs(), scenariosFor(student), judge)
      expect(r.results.filter((x) => x.status === 'consistent').map((x) => x.id), JSON.stringify(r.results.map((x) => [x.id, x.status, x.firstMismatch?.scenario.label, x.incomparable.slice(0, 1)]))).toEqual(want)
      for (const x of r.results.filter((y) => y.status === 'inconsistent')) {
        const m = x.firstMismatch!
        expect(JSON.stringify(m.student.board) + m.student.out).not.toBe(JSON.stringify(m.reference.board) + m.reference.out)
      }
    }, 600_000)
  }
})
