/**
 * `cpp:var_declare_volatile` 的**自證測**（438）——Arduino 的中斷旗標 `volatile bool pressed = false;`
 *
 * 推導不出來的語義：① `volatile` 不能被丟掉（434 之前產回去是 `bool pressed`——另一支程式）；
 * ② 判別只收一種形狀，其餘組合照舊整句降級；③ 翻給 Cella 時去掉 `volatile`（cella 11-13 談定），判決照一般變數。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { generateCode } from '../../../core/projection/code-generator'
import { expectCellaOut } from '../../../../tests/helpers/cella-run'
import type { SemanticNode, StylePreset } from '../../../core/types'
import apcs from '../../../languages/cpp/styles/apcs.json'

const style = apcs as unknown as StylePreset
let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
}, 30000)

const lift = (code: string) => createTestLifter().lift(parser.parse(code)!.rootNode as never) as SemanticNode
const ids = (n: SemanticNode): string[] => [n.componentId, ...Object.values(n.slots ?? {}).flat().flatMap(ids)]
const find = (n: SemanticNode, id: string): SemanticNode[] =>
  [...(n.componentId === id ? [n] : []), ...Object.values(n.slots ?? {}).flat().flatMap((c) => find(c, id))]
const gen = (t: SemanticNode) => generateCode(t, 'cpp', style)

describe('cpp:var_declare_volatile', () => {
  it('lift：帶初值的全域旗標是這顆，型別與名字都在', () => {
    const t = lift('volatile bool pressed = false;\n')
    const [v] = find(t, 'cpp:var_declare_volatile')
    expect(v).toBeDefined()                                 // 正向錨點
    expect(v.properties).toMatchObject({ type: 'bool', name: 'pressed' })
    expect(ids(t)).not.toContain('cpp:raw_code')
    expect(ids(t)).not.toContain('cpp:var_declare')         // 不是丟掉 volatile 的一般宣告
  })

  it('lift：兩個字的型別、沒有初值、在函式裡', () => {
    const t = lift('void f() {\n  volatile unsigned long last;\n}\n')
    const [v] = find(t, 'cpp:var_declare_volatile')
    expect(v?.properties).toMatchObject({ type: 'unsigned long', name: 'last' })
    expect(v.slots?.initializer).toBeUndefined()
  })

  it('generate ＋ 來回：一字不差（是不動點）', () => {
    for (const code of ['volatile bool pressed = false;\n', 'volatile unsigned long last = 0;\n', 'volatile int count;\n']) {
      const out = gen(lift(code))
      expect(out.trimEnd()).toBe(code.trimEnd())
      expect(gen(lift(out))).toBe(out)
    }
  })

  it('439：易變陣列不是這顆——走陣列宣告那顆，volatile 住在元素型別', () => {
    const t = lift('volatile int arr[3];\n')
    expect(ids(t)).toContain('cpp:array_declare')             // 正向錨點
    expect(ids(t)).not.toContain('cpp:var_declare_volatile')
    expect(gen(t).trim()).toBe('volatile int arr[3];')
  })

  it('其餘形狀照舊整句降級（不猜、不丟字）', () => {
    for (const code of ['bool volatile f = false;\n', 'volatile const int k = 1;\n', 'volatile static int s = 0;\n', 'volatile int *p;\n']) {
      const t = lift(code)
      expect(ids(t), code).toContain('cpp:raw_code')       // 正向錨點：降級了
      expect(ids(t), code).not.toContain('cpp:var_declare_volatile')
      expect(gen(t)).toContain(code.trim())
    }
  })

  for (const board of ['uno', 'esp32']) {
    it(`執行（${board}）：去掉 volatile 照一般變數判，旗標讀寫照常`, async () => {
      await expectCellaOut(
        'volatile bool pressed = false;\nvolatile unsigned long count = 0;\nvoid setup() {\n  Serial.begin(9600);\n  pressed = true;\n  count = count + 3;\n  if (pressed) {\n    Serial.println(count);\n  }\n}\nvoid loop() {}\n',
        '3\r\n', { board })
    })
  }
})
