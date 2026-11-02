/**
 * 時間兩顆的自證測：`cpp:delay` / `cpp:millis`。
 *
 * ⚠️ **兩顆寫在一起，因為它們共用同一個時鐘**——分開測的話
 * 「`delay` 推進了時間而 `millis` 讀得到」**沒有任何一支測得到**。
 *
 * 🔴 執行那幾條由 Cella 的板子判決背書（spec 201）。Cella 的時鐘是**確定性的模擬時鐘**：
 * 原本「模擬／真實時間兩條路」裡真實時間那一條是 JS 直譯器的執行時（`arduino-clock` 的 `useRealTime`），
 * 它不屬於這顆膠囊的語義，跟著 JS 直譯器退場（重構階段 6）——本檔不再測它。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { generateCode } from '../../../core/projection/code-generator'
import apcs from '../../../languages/cpp/styles/apcs.json'
import { expectCellaOut, boardEnv } from '../../../../tests/helpers/cella-run'
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
describe('膠囊自證：時間兩顆', () => {
  it('★ lift：兩個名字都認得，且不落進殘差', () => {
    const ids = collect(lift('void loop(){ delay(100); unsigned long t = millis(); }'))
    expect(ids).toContain('cpp:delay')       // ← 正向錨點
    expect(ids).toContain('cpp:millis')
    expect(ids).not.toContain('cpp:raw_code')
    expect(ids, '🔴 還在走 func_call → 登錄沒生效').not.toContain('cpp:func_call')
  })

  it('★ generate：產回原樣', () => {
    const code = generateCode(lift('void loop(){ delay(500); }'), 'cpp', apcs as unknown as StylePreset)
    expect(code).toContain('delay(500);')
  })

  it('★ round-trip：程式碼 → 樹 → 程式碼，兩次相同', () => {
    const src = 'void loop(){ delay(1000); }'
    const once = generateCode(lift(src), 'cpp', apcs as unknown as StylePreset)
    const twice = generateCode(lift(once), 'cpp', apcs as unknown as StylePreset)
    expect(twice).toBe(once)
    expect(once).toContain('delay(1000)')
  })

  /** 🔴 這一支是兩顆共用時鐘的理由——分開做的話它測不出來。 */
  it('★ execute（ESP32）：delay 推進了時間，而 millis 讀得到', async () => {
    // 原本是 cout（JS 直譯器才收）；板子上改成 Serial（先 begin：arduino-esp32 沒開 UART 時 print 什麼都不送）。ESP32 的 millis() 由 1 µs 的 esp_timer 換算，delay(1000) 之後正好 1000
    await expectCellaOut('void setup(){ Serial.begin(9600); Serial.print(millis()); Serial.print(","); delay(1000); Serial.print(millis()); }\nvoid loop(){}',
      '0,1000', { board: 'esp32' })
  })

  it('★ execute（Uno）：delay(1000) 之後 millis 是 999——timer0 每 1.024 ms 一跳', async () => {
    // 🔴 期望值改了：原本 '0,1000'（JS 直譯器的毫秒時鐘）→ Uno 上 '0,999'。
    // 依據：AVR 核心的 millis() 由 timer0 溢位推進（每 1024 µs 一次，+1 ms，小數累到 125×8 µs 再多 +1）；
    // 到 1,000,000 µs 共 976 次溢位、補 23 ⟹ 999。真板子在 delay(1000) 剛結束時讀到的也是 999。
    await expectCellaOut('void setup(){ Serial.begin(9600); Serial.print(millis()); Serial.print(","); delay(1000); Serial.print(millis()); }\nvoid loop(){}',
      '0,999', { board: 'uno' })
  })

  it('★ execute（Uno）：三次 delay(1000) 累加——時鐘走了 3 秒', async () => {
    // 🔴 期望值改了：原本 '3000' → '2999'（同上：3,000,000 µs 是 2929 次溢位、補 70）。
    // ⚠️ 原本另有「牆上時間 < 500 ms」：那量的是 JS 直譯器的模擬模式沒有真的等；Cella 的時鐘本來就只有模擬的一條，
    //    牆上時間只反映判決的計算量（隨機器負載變），不再斷言——改斷言板子的時鐘：草稿碼跑到模擬的 5 秒為止。
    const r = await expectCellaOut('void setup(){ Serial.begin(9600); delay(1000); delay(1000); delay(1000); Serial.print(millis()); }\nvoid loop(){}',
      '2999', { board: 'uno' })
    expect(boardEnv(r).clockUs, '草稿碼跑到模擬的 5 秒').toBe(5_000_000)
  })
})
