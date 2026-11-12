/**
 * **參數列排得不合法：形態檢查說得出來、執行擋得住**（第 428 刀）。
 *
 * 瀏覽器實測：`def f(*a, *b)` 判斷說「沒有發現問題」、照跑印 `1`（CPython 是 SyntaxError）；
 * 第一版修法只讓 formalize 不送，畫面就變成「Cella 還不支援：param_decl」——把學生寫錯說成系統不會。
 * 這一支釘的是學生該看到的那一則：形態錯誤，錨在函式那一顆，執行前就擋。
 *
 * 🔴 閘門上之前先量誤報（`param-check.ts` 的檔頭：「它擋錯了幾個——那個數字只有別人的程式答得出來」）：
 * 課文的每一支解答（C++、C、Arduino、Python）都不得被這條擋下。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { liftPython } from '../helpers/python-lift'
import { sources } from '../helpers/binding-corpus'
import { canExecute, diagnosticsFromTree, dropUnsupportedCoveredByParamLists, type Diagnostic } from '../../src/core/diagnostics'
import { checkParamLists } from '../../src/core/component/param-list-check'
import { natureOf } from '../../src/core/diagnostic-nature'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode } from '../../src/core/types'

let tp: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tp = new Parser()
  tp.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
})

const liftCpp = (src: string): SemanticNode => lifter.lift(tp.parse(src)!.rootNode as never) as unknown as SemanticNode
const rulesOf = (t: SemanticNode | null): string[] => diagnosticsFromTree(t!).map((d) => d.rule).filter((r) => r.startsWith('BAD_PARAMS_'))

describe('參數列的形態檢查', () => {
  it('★ 正向錨點：合法的參數列一則都不報、照樣可以跑', async () => {
    for (const c of [
      'def f(a, b=1, *r, k, **kw):\n    return b\n',
      'def f(*args, scale=1, **kw):\n    return 1\n',
      'def f(*a, k, j=2):\n    return 1\n',
      'g = lambda a, b: a + b\n',
      'a, a = 1, 2\n',   // ⚠️ 借用 param_decl 的左邊——Python 收（後者蓋前者），不是參數列
    ]) {
      const t = await liftPython(c)
      expect(t, c).not.toBeNull()
      expect(rulesOf(t), c).toEqual([])
      expect(canExecute(t!).ok, c).toBe(true)
    }
  })

  it('🔴 Python 不收的四種（lambda 帶預設值今天整段是灰積木，不在這裡）：報形態錯誤（錨在函式那一顆）、執行擋下', async () => {
    for (const [c, rule, name] of [
      ['def f(*a, *b):\n    return 1\n', 'BAD_PARAMS_SECOND_VARARGS', 'b'],
      ['def f(**a, b):\n    return 1\n', 'BAD_PARAMS_AFTER_KWARGS', 'b'],
      ['def f(a=1, b):\n    return 1\n', 'BAD_PARAMS_DEFAULT_ORDER', 'b'],
      ['def f(a, a):\n    return 1\n', 'BAD_PARAMS_DUPLICATE', 'a'],
    ] as const) {
      const t = await liftPython(c)
      const ds = diagnosticsFromTree(t!).filter((d) => d.rule.startsWith('BAD_PARAMS_'))
      expect(ds.map((d) => d.rule), c).toEqual([rule])
      expect(ds[0].severity, `${c}：程式寫錯了，是 error`).toBe('error')
      expect(ds[0].params, c).toEqual({ name })
      expect(natureOf(rule), `${c}：性質是形態（不涉及意思）`).toBe('form')
      const fn = checkParamLists(t!)[0]
      expect(ds[0].nodeId, `${c}：錨在函式那一顆（參數自己沒有積木）`).toBe(fn.nodeId)
      const gate = canExecute(t!)
      expect(gate.ok, `${c}：不得照跑`).toBe(false)
      expect(gate.ok === false && gate.cause).toBe('bad_params')
    }
  })

  it('收集其餘引數又給了預設值（積木齒輪排得出來；lift 不會產出這種樹）', () => {
    const p = (id: string, name: string, extra: Record<string, string> = {}): SemanticNode =>
      ({ id, componentId: 'param_decl', properties: { type: '', name, ...extra }, slots: {} }) as SemanticNode
    const fn = { id: 'fn', componentId: 'python:func_def', properties: { name: 'f' }, slots: { params: [p('p1', 'a', { variadic: 'list', default: '1' })], body: [] } } as unknown as SemanticNode
    expect(checkParamLists(fn).map((f) => f.reason)).toEqual(['variadic_default'])
  })

  it('C++ 共用同一個結構：有預設值的後面接沒有預設值的也擋；沒有名字的參數不算重複', () => {
    expect(rulesOf(liftCpp('int f(int, int);\nint main() { return 0; }\n'))).toEqual([])
    expect(rulesOf(liftCpp('int f(int a, int b = 2) { return a + b; }\nint main() { return f(1); }\n'))).toEqual([])
    expect(rulesOf(liftCpp('int f(int a = 1, int b) { return a + b; }\nint main() { return 0; }\n'))).toEqual(['BAD_PARAMS_DEFAULT_ORDER'])
  })

  it('判決那邊對同一顆的「判不出來」不疊在形態那一則上面；別的照留', async () => {
    const t = await liftPython('def f(*a, *b):\n    return 1\n')
    const fn = checkParamLists(t!)[0].nodeId
    const ds: Diagnostic[] = [
      { nodeId: fn, severity: 'info', rule: 'CELLA_UNSUPPORTED', params: {}, source: 'cella' },
      // 瀏覽器實測回來的是這一種：種類 unsupported、沒有分類
      { nodeId: fn, severity: 'info', rule: 'CELLA_UNCLASSIFIED', params: {}, source: 'cella' },
      { nodeId: fn, severity: 'error', rule: 'CELLA_UB_DIV_ZERO', params: {}, source: 'cella' },
      { nodeId: 'other', severity: 'info', rule: 'CELLA_UNSUPPORTED', params: {}, source: 'cella' },
    ]
    expect(dropUnsupportedCoveredByParamLists(ds, t).map((d) => `${d.nodeId === fn ? 'fn' : d.nodeId}:${d.rule}`)).toEqual(['fn:CELLA_UB_DIV_ZERO', 'other:CELLA_UNSUPPORTED'])
  })
})

describe('🔴 上閘門前的誤報量測：課文的每一支解答都不得被擋', () => {
  it('C++／C／Arduino', () => {
    const all = sources()
    expect(all.length, '入口條件：語料不是空的').toBeGreaterThan(50)
    const hits = all.filter((s) => checkParamLists(liftCpp(s.code)).length > 0).map((s) => s.id)
    expect(hits).toEqual([])
  })

  it('Python', async () => {
    const files: string[] = []
    for (const track of ['python-beginner', 'python-bridge']) {
      for (const lesson of fs.readdirSync(path.join('lessons', track))) {
        const dir = path.join('lessons', track, lesson, 'solutions')
        if (!fs.existsSync(dir)) continue
        for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.py'))) files.push(path.join(dir, f))
      }
    }
    expect(files.length, '入口條件：語料不是空的').toBeGreaterThan(10)
    const hits: string[] = []
    for (const f of files) {
      const t = await liftPython(fs.readFileSync(f, 'utf8'))
      if (t && checkParamLists(t).length > 0) hits.push(f)
    }
    expect(hits).toEqual([])
  })
})
