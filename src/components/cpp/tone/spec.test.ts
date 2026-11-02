/**
 * 蜂鳴器兩顆的自證測：`cpp:tone` / `cpp:tone_stop`。
 *
 * ⚠️ **寫在一起，因為它們共用同一份腳位狀態**——分開測的話
 * 「`tone` 設了而 `tone_stop` 清得掉」**沒有任何一支測得到**。
 *
 * ## 🔴 執行那一路驗的是【狀態】，不是輸出
 *
 * 這兩顆**刻意零輸出**：`ctx.io` 是程式的輸出，學生的 `Serial.println` 走同一條，
 * 而把模擬器的旁白寫進那裡會讓程式的輸出變成錯的。
 *
 * > **一顆刻意不說話的元件，如果用「輸出是空的」來測，
 * > 那條測試對「它到底做了什麼」一個字都沒說。**
 *
 * 所以本檔**直接看腳位狀態**。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { generateCode } from '../../../core/projection/code-generator'
import apcs from '../../../languages/cpp/styles/apcs.json'
import { runCella, boardPin, describeCellaResult } from '../../../../tests/helpers/cella-run'
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
 * 跑一段（Cella 的 Uno 板子判決），回傳**腳位 8 的最終狀態**（不是輸出——這兩顆刻意不說話）。
 * spec 201：執行判準從 JS 直譯器換成 Cella；板子的 `env` 帶每支腳的 `toneHz`（沒在響是 null）。
 */
const pin8 = async (c: string): Promise<{ toneHz: number | null } | undefined> => {
  const r = await runCella(c, { board: 'uno' })
  if (r.verdict !== 'accept') throw new Error(describeCellaResult(r))
  return boardPin(r, 8)
}
describe('cpp:tone / cpp:tone_stop', () => {
  it('lift —— 兩顆身分都認得出來（而 noTone 不叫 no_tone）', () => {
    const ids = collect(lift('void setup() { tone(8, 440, 500); noTone(8); }\nvoid loop() {}\n'))
    expect(ids).toContain('cpp:tone')           // ← 正向錨點
    expect(ids).toContain('cpp:tone_stop')
    expect(ids).not.toContain('cpp:raw_code')
  })

  it('generate —— 兩引數與三引數各自產回原樣', () => {
    const two = generateCode(lift('void setup() { tone(8, 440); }\nvoid loop() {}\n'), 'cpp', apcs as StylePreset)
    expect(two).toContain('tone(8, 440)')
    // 🔴 沒有第三個引數時不得產出空的逗號——`tone(8, 440,)` 編不過
    expect(two).not.toContain('tone(8, 440,)')

    const three = generateCode(lift('void setup() { tone(8, 440, 500); }\nvoid loop() {}\n'), 'cpp', apcs as StylePreset)
    expect(three).toContain('tone(8, 440, 500)')
  })

  it('round-trip —— 兩種引數數量都不漂移', () => {
    const src = 'void setup() {\n  tone(8, 440);\n  tone(9, 880, 250);\n  noTone(8);\n}\nvoid loop() {\n}\n'
    const once = generateCode(lift(src), 'cpp', apcs as StylePreset)
    const twice = generateCode(lift(once), 'cpp', apcs as StylePreset)
    expect(twice).toBe(once)
  })

  it('🔴 執行 —— `tone` 之後腳位狀態記著頻率', async () => {
    // 自訂 main：跑完時模擬時鐘還在 0，響 500 毫秒的那一聲還沒停
    expect((await pin8('int main() { tone(8, 440, 500); return 0; }'))?.toneHz).toBe(440)
  })

  it('🔴 執行 —— `tone_stop` 之後頻率被清掉（兩顆共用同一份狀態）', async () => {
    const p = await pin8('int main() { tone(8, 440); noTone(8); return 0; }')
    expect(p, '腳位 8 應該被碰過').toBeDefined()                // ← 正向錨點
    expect(p?.toneHz).toBeNull()
  })

  it('⚠️ 給了毫秒才會停；沒指定與「響 0 毫秒」都是一直響', async () => {
    // sketch 跑到模擬的 5 秒：響 500 毫秒的那一聲到結束時已經停了，響 6 秒的還在響
    expect((await pin8('void setup() { tone(8, 440, 500); }\nvoid loop() {}\n'))?.toneHz).toBeNull()
    expect((await pin8('void setup() { tone(8, 440, 6000); }\nvoid loop() {}\n'))?.toneHz).toBe(440)

    const forever = await pin8('void setup() { tone(8, 440); }\nvoid loop() {}\n')
    expect(forever?.toneHz, '沒有第三個引數 → 一直響').toBe(440)
    // 期望值改了（原本 JS 直譯器把 0 當成「響 0 毫秒」）。依據：AVR 核心 `tone(uint8_t, unsigned int, unsigned long duration = 0)`，
    // Tone.cpp 裡 `duration > 0` 才算 toggle_count，否則 -1＝一直響——`tone(8, 440, 0)` 與 `tone(8, 440)` 是同一個呼叫
    const zero = await pin8('void setup() { tone(8, 440, 0); }\nvoid loop() {}\n')
    expect(zero?.toneHz, '0 毫秒＝預設參數＝一直響（真板子分不出來）').toBe(440)
  })
})
