/**
 * `cpp:method_def` 的**自證測**（第 218 刀）——類別裡的一般成員函式，與它的尾端 const
 *
 * 推導不出來的三件事：
 *
 * ```
 * ① const 來回一趟不見——在此之前它借用頂層函式那顆，`int area() const` 產回去是 `int area()`，
 *    在 `const P&` 上呼叫就編不過
 * ② 形狀不單純的（static、回傳參考、noexcept）不准被這顆吃掉——它沒有地方放那些東西
 * ③ 執行照舊：類別執行器依 memberRole 收它，JS 直譯器的輸出不變
 * ```
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { generateCode } from '../../../core/projection/code-generator'
import { runCella, describeCellaResult } from '../../../../tests/helpers/cella-run'
import { formalize } from '../../../providers/cella/formalize'
import { renderToBlocklyState } from '../../../core/projection/block-renderer'
import { setupTestRenderer } from '../../../../tests/helpers/setup-renderer'
import competitive from '../../../languages/cpp/styles/competitive.json'
import apcs from '../../../languages/cpp/styles/apcs.json'
import type { Lifter } from '../../../core/lift/lifter'
import type { SemanticNode, StylePreset } from '../../../core/types'

let tsParser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
  setupTestRenderer()
})

const S = apcs as unknown as StylePreset
const lift = (code: string): SemanticNode => lifter.lift(tsParser.parse(code)!.rootNode as never) as SemanticNode
const gen = (code: string): string => generateCode(lift(code), 'cpp', S)

function all(n: SemanticNode, id: string, out: SemanticNode[] = []): SemanticNode[] {
  if (n.componentId === id) out.push(n)
  for (const kids of Object.values(n.slots ?? {})) for (const k of kids as SemanticNode[]) all(k, id, out)
  return out
}

/** 由 Cella 跑（spec 208：直譯器刪掉之後的判準）——判不是 accept 就把原因當訊息丟出來，不回空字串 */
async function run(code: string): Promise<string> {
  const r = await runCella(code)
  if (r.verdict !== 'accept') throw new Error(describeCellaResult(r))
  return r.out
}

const head = '#include <iostream>\nusing namespace std;\n'
const SRC = `${head}struct P {\n    int x;\n    int y;\n    int area() const {\n        return x * y;\n    }\n    void grow(int d) {\n        x += d;\n    }\n};\nint show(const P& p) {\n    return p.area();\n}\nint main() {\n    P p;\n    p.x = 2;\n    p.y = 3;\n    p.grow(1);\n    cout << show(p);\n    return 0;\n}\n`

describe('cpp:method_def', () => {
  it('★ 正向錨點：類別裡的兩個成員函式都是這顆，頂層的 show 與 main 仍是頂層函式那顆', () => {
    const t = lift(SRC)
    expect(all(t, 'cpp:method_def').map((n) => n.properties.name)).toEqual(['area', 'grow'])
    expect(all(t, 'cpp:func_def').map((n) => n.properties.name)).toEqual(['show', 'main'])
    expect(all(t, 'raw_code')).toHaveLength(0)
  })

  it('🔴 lift：尾端 const 記在 is_const；沒有的是 false', () => {
    const [area, grow] = all(lift(SRC), 'cpp:method_def')
    expect(area.properties.is_const).toBe('true')
    expect(grow.properties.is_const).toBe('false')
    expect(grow.slots.params).toHaveLength(1)
  })

  it('🔴 generate：const 產回去——來回一趟一字不差', () => {
    const out = gen(SRC)
    expect(out).toContain('int area() const {')
    expect(out).toContain('void grow(int d) {')
    expect(gen(out)).toBe(out)
  })

  it('★ 執行：Cella 跑出來的與 C++ 一樣（const 方法在 const 參照上呼叫得到）', async () => {
    expect(await run(SRC)).toBe('9')
  })

  it('★ formalize：類別成員 mbMethod，const 的帶 isConst', () => {
    const r = formalize(lift(SRC), { lang: 'cpp' })
    expect(r.unknown).toEqual([])
    const ms: Record<string, unknown>[] = []
    const w = (o: unknown): void => { if (Array.isArray(o)) o.forEach(w); else if (o && typeof o === 'object') { if ((o as { k?: string }).k === 'mbMethod') ms.push(o as Record<string, unknown>); Object.values(o).forEach(w) } }
    w(r.program)
    expect(ms.map((m) => [(m.f as { name: string }).name, m.isConst])).toEqual([['area', true], ['grow', false]])
  })

  it('🔴 形狀不單純的不准被吃掉：static、回傳參考、noexcept 照舊走原路', () => {
    for (const member of ['static int count() { return 1; }', 'int f() noexcept { return 1; }']) {
      const t = lift(`${head}struct Q {\n    int x;\n    ${member}\n};\nint main() { return 0; }\n`)
      expect(all(t, 'cpp:method_def'), member).toHaveLength(0)
    }
  })

  // 🔴 模糊測試抓到（main 上就壞）：原路把 `Counter& tick()` 產成 `Counter tick()() {`——參考符號不見、宣告子的文字跑進名字
  it('🔴 回傳參考、指標、const 回傳：符號併進回傳型別，來回一趟一字不差', () => {
    const members = [
      ['Q& self() {\n        return *this;\n    }', 'Q&', 'false'],
      ['const int& ref() const {\n        return x;\n    }', 'const int&', 'true'],
      ['int* raw() {\n        return &x;\n    }', 'int*', 'false'],
      ['const string name() const {\n        return "q";\n    }', 'const string', 'true'],
    ] as const
    for (const [member, ret, isConst] of members) {
      const code = `${head}struct Q {\n    int x;\n    ${member}\n};\nint main() {\n    return 0;\n}\n`
      const [m] = all(lift(code), 'cpp:method_def')
      expect(m?.properties, member).toMatchObject({ return_type: ret, is_const: isConst })
      expect(gen(code), member).toContain(member.split('\n')[0])
    }
  })

  // ── 整合關卡（component-integrate 第四、五步）──
  it('★ 積木渲染：類別裡是方法那塊、const 下拉照實、名字與回傳型別在欄位上', () => {
    const state = renderToBlocklyState(lift(SRC)) as unknown as { blocks: { blocks: unknown[] } }
    const found: Record<string, unknown>[] = []
    const walk = (b: unknown): void => {
      if (!b || typeof b !== 'object') return
      const o = b as Record<string, unknown>
      if (o.type === 'cpp_method_def') found.push(o)
      for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v)
    }
    walk(state.blocks.blocks)
    expect(found.map((b) => (b.fields as Record<string, string>))).toEqual([
      expect.objectContaining({ NAME: 'area', RETURN_TYPE: 'int', IS_CONST: 'true' }),
      expect.objectContaining({ NAME: 'grow', RETURN_TYPE: 'void', IS_CONST: 'false' }),
    ])
  })

  it('★ 跨概念：方法本體裡有迴圈與條件、主程式在迴圈裡呼叫 const 方法；printf 風格產碼也保住 const', () => {
    const code = `${head}struct Acc {\n    int s;\n    void addUpTo(int n) {\n        for (int i = 1; i <= n; i++) {\n            if (i % 2 == 0) {\n                s += i;\n            }\n        }\n    }\n    int get() const {\n        return s;\n    }\n};\nint main() {\n    Acc a;\n    a.s = 0;\n    for (int k = 0; k < 3; k++) {\n        a.addUpTo(4);\n        cout << a.get() << endl;\n    }\n    return 0;\n}\n`
    const t = lift(code)
    expect(all(t, 'cpp:method_def').map((n) => [n.properties.name, n.properties.is_const])).toEqual([['addUpTo', 'false'], ['get', 'true']])
    expect(generateCode(t, 'cpp', competitive as unknown as StylePreset)).toContain('int get() const {')
    return run(code).then((out) => expect(out).toBe('6\n12\n18\n'))
  })
})
