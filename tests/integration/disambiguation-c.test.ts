/**
 * **規格消歧：C 示範題**（spec 218 US1）——c-bridge 第 1 課「讀進一串整數，印出最大的」宣告兩個解讀（讀到 0 停／讀到結尾停）。
 * 三支學生程式（各換一種寫法，不和解答逐字相同）的比對結果要分別是 {zero}、{eof}、{}，每個不一致附得出情境與兩邊的輸出。
 * Judge 走 Node 宿主：樹 → 產碼 → `runCella`（帶情境的標準輸入）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { runCella } from '../helpers/cella-run'
import { compareInterpretations } from '../../src/core/disambiguation/compare'
import { scenariosFor } from '../../src/core/disambiguation/scenario-registry'
import { interpretationSolutionFor, solutionFor } from '../../src/core/lesson/load-lessons'
import type { Judge } from '../../src/core/disambiguation/types'
import cStyle from '../../src/languages/cpp/styles/c.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

const LESSON = 'c-bridge/01-同一份程式，兩種說法'
let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})
const lift = (src: string): SemanticNode => createTestLifter().lift(parser.parse(src)!.rootNode as never) as SemanticNode
const judge: Judge = async (tree, scenario) => {
  const r = await runCella(generateCode(tree, 'cpp', cStyle as StylePreset), { lang: 'c', stdin: (scenario.payload as { text: string }).text })
  return { verdict: r.verdict === 'untranslated' ? 'untranslated' : r.verdict, out: r.out, problems: [...r.problems, ...r.untranslated.map((u) => ({ kind: 'untranslated', reason: u.reason }))] }
}
const refs = (): { id: string; label: string; tree: SemanticNode }[] =>
  [['zero', '讀到 0 就停'], ['eof', '讀到輸入結尾才停']].map(([id, label]) => ({ id, label, tree: lift(interpretationSolutionFor(LESSON, 'max', id)!) }))

// ⚠️ 原本想用 `for (; x != 0; scanf(…))`：更新格裡的 scanf 今天被照實降級成原文（raw_expression），讀取排程看不到它——另排一刀
const STUDENT_ZERO = '#include <stdio.h>\nint main() {\n    int x, m = 0, first = 1;\n    while (1) {\n        scanf("%d", &x);\n        if (x == 0) {\n            break;\n        }\n        if (first || x > m) {\n            m = x;\n            first = 0;\n        }\n    }\n    printf("%d\\n", m);\n    return 0;\n}\n'
const STUDENT_EOF = '#include <stdio.h>\nint main() {\n    int x, m = 0, n = 0;\n    while (scanf("%d", &x) == 1) {\n        if (n == 0 || m < x) {\n            m = x;\n        }\n        n = n + 1;\n    }\n    printf("%d\\n", m);\n    return 0;\n}\n'
const STUDENT_SUM = '#include <stdio.h>\nint main() {\n    int x, s = 0;\n    while (scanf("%d", &x) == 1) {\n        s = s + x;\n    }\n    printf("%d\\n", s);\n    return 0;\n}\n'

describe('規格消歧：C 示範題（讀到哪裡停）', () => {
  it('入口：兩個解讀都有解答、預設解答也還在（今天的對錯與 Parsons 用它）', () => {
    expect(interpretationSolutionFor(LESSON, 'max', 'zero')).toContain('while (x != 0)')
    expect(interpretationSolutionFor(LESSON, 'max', 'eof')).toContain('scanf("%d", &x) == 1')
    expect(solutionFor(LESSON, 'max')).toBe(interpretationSolutionFor(LESSON, 'max', 'zero'))
  })
  it('情境：從讀取的型別與順序產生，含「0 後面還有數字」「沒有 0 就結尾」', () => {
    const labels = scenariosFor(lift(STUDENT_ZERO)).map((s) => s.label)
    expect(labels).toEqual(expect.arrayContaining(['有 0，而且 0 後面還有數字', '沒有 0 就結尾', '空輸入']))
  })
  for (const [name, src, want] of [['讀到 0 停的學生', STUDENT_ZERO, ['zero']], ['讀到結尾停的學生', STUDENT_EOF, ['eof']], ['印總和的學生（兩種都不是）', STUDENT_SUM, []]] as const) {
    it(`★ ${name} → 一致的解讀是 ${JSON.stringify(want)}；不一致都附得出情境與兩邊輸出`, async () => {
      const student = lift(src)
      const r = await compareInterpretations(student, refs(), scenariosFor(student), judge)
      expect(r.results.filter((x) => x.status === 'consistent').map((x) => x.id)).toEqual(want)
      for (const x of r.results.filter((y) => y.status === 'inconsistent')) {
        expect(x.firstMismatch!.scenario.label.length).toBeGreaterThan(0)
        expect(x.firstMismatch!.student.out).not.toBe(x.firstMismatch!.reference.out)
      }
      expect(r.indistinguishable).toEqual([])
    }, 300_000)
  }

  it('退化（FR-009）：沒宣告解讀的既有題目——只有一個解讀時就是對錯；解答自己對自己一致、改壞的不一致', async () => {
    const sol = solutionFor('c-bridge/04-自己管記憶體', 'ex1')!
    const one = [{ id: 'only', label: '唯一', tree: lift(sol) }]
    const good = await compareInterpretations(lift(sol), one, scenariosFor(lift(sol)), judge)
    expect(good.results.map((x) => x.status)).toEqual(['consistent'])
    const broken = sol.replace('sum = sum + a[i];', 'sum = sum + a[i] + 1;')
    expect(broken).not.toBe(sol)
    const bad = await compareInterpretations(lift(broken), one, scenariosFor(lift(broken)), judge)
    expect(bad.results.map((x) => x.status)).toEqual(['inconsistent'])
  }, 300_000)
})
