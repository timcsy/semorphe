/**
 * 腳位三顆的自證測：`cpp:pin_mode` / `cpp:digital_write` / `cpp:digital_read`。
 *
 * ⚠️ **三顆寫在一起，因為它們共用同一個狀態機**——分開測的話
 * 「寫進去讀得回來」這件事**沒有任何一支測得到**，
 * 而那正是這三顆存在的理由。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { runCella, expectCellaOut, knownCellaGap } from '../../../../tests/helpers/cella-run'
import { generateCode } from '../../../core/projection/code-generator'
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
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) collect(k, out)
  return out
}
/**
 * spec 201：執行判準換成 Cella 的 Uno 板子判決。原本的程式用 `cout`——AVR 沒有 `<iostream>`，
 * 改成 sketch 真正會寫的 `Serial.print`（程式的意思不變：把讀回來的值印出來）。
 */
const S = (setup: string): string => `void setup(){ Serial.begin(9600); ${setup} }\nvoid loop(){}\n`

describe('膠囊自證：腳位三顆', () => {
  it('★ lift：三個名字都認得，且不落進殘差', () => {
    const ids = collect(lift('void setup(){ pinMode(13, OUTPUT); digitalWrite(13, HIGH); int v = digitalRead(2); }'))
    expect(ids).toContain('cpp:pin_mode')          // ← 正向錨點
    expect(ids).toContain('cpp:digital_write')
    expect(ids).toContain('cpp:digital_read')
    expect(ids).not.toContain('cpp:raw_code')
    // 🔴 而它們【不再】是通用的函式呼叫——那正是這三顆膠囊的意義
    expect(ids, '🔴 還在走 func_call → 登錄沒生效').not.toContain('cpp:func_call')
  })

  it('★ generate：產回原樣', () => {
    const code = generateCode(
      lift('void setup(){ pinMode(13, OUTPUT); digitalWrite(13, HIGH); }'),
      'cpp', apcs as unknown as StylePreset)
    expect(code).toContain('pinMode(13, OUTPUT);')
    expect(code).toContain('digitalWrite(13, HIGH);')
  })

  it('★ round-trip：程式碼 → 樹 → 程式碼，兩次相同', () => {
    const src = 'void setup(){ pinMode(2, INPUT_PULLUP); }\nvoid loop(){ int v = digitalRead(2); }'
    const once = generateCode(lift(src), 'cpp', apcs as unknown as StylePreset)
    const twice = generateCode(lift(once), 'cpp', apcs as unknown as StylePreset)
    expect(twice).toBe(once)
  })

  it('★ execute：寫進去，讀得回來（🔴 這一支是三顆共用狀態機的理由）', async () => {
    await expectCellaOut(S(
      'pinMode(13, OUTPUT); digitalWrite(13, HIGH); Serial.print(digitalRead(13)); ' +
      'digitalWrite(13, LOW); Serial.print(digitalRead(13));'), '10', { board: 'uno' })
  })

  it('★ INPUT_PULLUP 沒接東西時讀回 HIGH——那是內部提升電阻', async () => {
    await expectCellaOut(S('pinMode(2, INPUT_PULLUP); Serial.print(digitalRead(2));'), '1', { board: 'uno' })
  })

  it('★ 沒接東西的 INPUT 讀回 0——可重現比擬真重要', async () => {
    // ⚠️ 真板子上浮接的腳讀到什麼不一定；Cella 的板子模型沒給 `digital:2` 時是 0（確定性），與原本的取捨同一個值
    await expectCellaOut(S('pinMode(2, INPUT); Serial.print(digitalRead(2));'), '0', { board: 'uno' })
  })

  /**
   * 🔴 **腳位號碼超範圍要出聲。**
   *
   * 在真板子上它是**靜默的無效操作**——而那是最難查的那種錯。
   */
  it('★ 腳位號碼超範圍 → 出聲，不得靜默', async () => {
    const r = await runCella(S('digitalWrite(999, HIGH);'), { board: 'uno' })
    expect(r.verdict, '🔴 一個什麼都不做又不出聲的呼叫，是最難查的那種錯').toBe('reject')
    expect(r.problems[0]?.kind).toBe('ubPin')
    // 期望值改了（原本斷言訊息含 999）。依據：AVR 核心 `digitalWrite(uint8_t pin, uint8_t val)`——999 傳進去先截成 uint8_t 的 231
    expect(r.problems[0]?.reason).toMatch(/pin 231 is not on the board/)
    expect(r.problems[0]?.source?.text).toContain('digitalWrite(999')
  })

  /**
   * ⚠️ **沒有 `pinMode` 就寫：本輪【照做而不擋】**，理由見 `arduino-pins.ts` 檔頭。
   * 這一支釘的是那個決定本身——**免得未來有人以為它是漏掉的**。
   */
  // 🟡 疑似 Cella 判錯（0.1.202611020258）：判 accept 而印 0。真的 AVR：腳位預設是輸入（DDR=0），`digitalWrite(13, HIGH)` 把 PORT 位元設 1
  // ＝打開內部提升電阻，`digitalRead` 讀 PIN 暫存器是 1（Uno R3 的 13 號 LED 經運算放大器緩衝，不會把腳拉低）。期望值 1（原本 JS 直譯器也是 1）
  it('🟡 已知缺陷（修好時這條會紅）：★ 沒有 pinMode 就 digitalWrite → 照做，而不是未定義也不是報錯', () => knownCellaGap(/實際 "0"/, async () => {
    // 本輪刻意不擋——出聲會擋住一批真的能跑的入門程式
    await expectCellaOut(S('digitalWrite(13, HIGH); Serial.print(digitalRead(13));'), '1', { board: 'uno' })
  }))
})
