/**
 * Serial 兩顆的自證測：`cpp:serial_open` / `cpp:serial_print`。
 *
 * ## 🔴 它們的形狀與前面八顆不同
 *
 * ```
 * pinMode(13, OUTPUT)      call_expression   → registerCallComponent（一行資料）
 * Serial.println("hi")     方法呼叫           → registerMethodBranch（看得到 obj）
 * ```
 *
 * 而**為什麼是分支不是那張方法名表**：表的鍵是**方法名**，
 * 而 `begin` 已經被 `cpp:container_iter`（`v.begin()`）用著。
 *
 * > **「`begin` 在 `Serial` 上」這件事，一張只放得下方法名的表【表達不出來】。**
 *
 * ## ⚠️ 而 `print`／`println` 是【同一顆概念】的兩個形態
 *
 * 用 `newline` 旗標區分，**不是兩顆概念**——Sc3 認知一致性。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { SemanticInterpreter } from '../../../interpreter/interpreter'
import { generateCode } from '../../../core/projection/code-generator'
import { ioTraitOf } from '../../../core/component/traits'
import apcs from '../../../languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../../core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

const lift = (c: string): SemanticNode =>
  createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const collect = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const ks of Object.values(n.children ?? {})) for (const k of ks) collect(k, out)
  return out
}
const run = async (c: string): Promise<{ out: string; err: string }> => {
  const i = new SemanticInterpreter({ maxSteps: 100_000 })
  try {
    await i.execute(lift(c))
    return { out: i.getOutput().join(''), err: '' }
  } catch (e) { return { out: i.getOutput().join(''), err: (e as Error).message } }
}

describe('膠囊自證：Serial 兩顆', () => {
  it('★ lift：兩個都認得，且不落進殘差', () => {
    const ids = collect(lift('void setup(){ Serial.begin(9600); Serial.println("hi"); Serial.print(1); }'))
    expect(ids).toContain('cpp:serial_open')    // ← 正向錨點
    expect(ids).toContain('cpp:serial_print')
    expect(ids).not.toContain('cpp:raw_code')
    expect(ids, '🔴 Serial 還被當成一個未宣告的變數').not.toContain('cpp:var_ref')
  })

  /**
   * 🔴 **這一支釘的是「`begin` 有兩個主人」。**
   *
   * `v.begin()` 是迭代器、`Serial.begin(9600)` 是序列埠——
   * 而**一張只放得下方法名的表，兩者只能有一個贏**。
   */
  it('★ 而 v.begin() 仍然是迭代器——兩個 begin 各歸各的', () => {
    const ids = collect(lift('#include <vector>\nint main(){ vector<int> v; auto it = v.begin(); }'))
    expect(ids, '🔴 容器的 begin 被序列埠搶走了').toContain('cpp:container_iter')
    expect(ids).not.toContain('cpp:serial_open')
  })

  it('★ generate：print 與 println 由旗標決定，產回原樣', () => {
    const code = generateCode(
      lift('void setup(){ Serial.begin(9600); Serial.println("hi"); Serial.print(7); }'),
      'cpp', apcs as unknown as StylePreset)
    expect(code).toContain('Serial.begin(9600);')
    expect(code).toContain('Serial.println("hi");')
    expect(code).toContain('Serial.print(7);')
  })

  it('★ round-trip：程式碼 → 樹 → 程式碼，兩次相同', () => {
    const src = 'void setup(){ Serial.begin(9600); }\nvoid loop(){ Serial.println("hi"); }'
    const once = generateCode(lift(src), 'cpp', apcs as unknown as StylePreset)
    const twice = generateCode(lift(once), 'cpp', apcs as unknown as StylePreset)
    expect(twice).toBe(once)
  })

  it('★ execute：輸出真的到了【現有的】主控台', async () => {
    const { out, err } = await run('void setup(){ Serial.begin(9600); Serial.print("a"); Serial.println("b"); }')
    expect(err).toBe('')
    expect(out, '🔴 序列埠輸出沒有接到既有的 IO 出口').toBe('ab\n')
  })

  /**
   * 🔴 **這一支釘的是使用者 2026-08-17 的那個決定。**
   *
   * Serial 是「輸出」等價類的**第三個成員**，而它住在**語言套件的 `ioStyle`**
   * ——`src/core/types.ts` 的 `io_style`（`'cout' | 'printf'`）**一個字都沒改**。
   */
  it('★ 它與 cout／printf 是同一個等價類的三個成員', () => {
    expect(ioTraitOf('cpp:serial_print')).toEqual({ role: 'print', style: 'serial' })
    expect(ioTraitOf('cpp:print')?.role, '🔴 等價邊斷了——它們不再是同一類').toBe('print')
    expect(ioTraitOf('cpp:print_formatted')?.role).toBe('print')
    // 而三個成員的 style 必須互不相同——否則「哪個成員」這個問題答不出來
    const styles = ['cpp:print', 'cpp:print_formatted', 'cpp:serial_print'].map((c) => ioTraitOf(c)?.style)
    expect(new Set(styles).size).toBe(3)
  })
})
