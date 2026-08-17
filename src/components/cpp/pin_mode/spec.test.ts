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
import { SemanticInterpreter } from '../../../interpreter/interpreter'
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
  out.push(n.conceptId)
  for (const ks of Object.values(n.children ?? {})) for (const k of ks) collect(k, out)
  return out
}
const run = async (c: string): Promise<{ out: string; err: string }> => {
  const i = new SemanticInterpreter({ maxSteps: 100_000 })
  try {
    await i.execute(lift(c))
    return { out: i.getOutput().join(''), err: '' }
  } catch (e) {
    return { out: i.getOutput().join(''), err: (e as Error).message }
  }
}

const H = '#include <iostream>\nusing namespace std;\n'

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
    const { out, err } = await run(H +
      'void setup(){ pinMode(13, OUTPUT); digitalWrite(13, HIGH); cout << digitalRead(13); ' +
      'digitalWrite(13, LOW); cout << digitalRead(13); }')
    expect(err).toBe('')
    expect(out, '🔴 腳位狀態沒有被記住').toBe('10')
  })

  it('★ INPUT_PULLUP 沒接東西時讀回 HIGH——那是內部提升電阻', async () => {
    const { out } = await run(H + 'void setup(){ pinMode(2, INPUT_PULLUP); cout << digitalRead(2); }')
    expect(out).toBe('1')
  })

  it('★ 沒接東西的 INPUT 讀回 0——可重現比擬真重要', async () => {
    const { out } = await run(H + 'void setup(){ pinMode(2, INPUT); cout << digitalRead(2); }')
    expect(out, '🔴 一個每次讀到不同值的模擬器，測不出任何東西').toBe('0')
  })

  /**
   * 🔴 **腳位號碼超範圍要出聲。**
   *
   * 在真板子上它是**靜默的無效操作**——而那是最難查的那種錯。
   */
  it('★ 腳位號碼超範圍 → 出聲，不得靜默', async () => {
    const { err } = await run(H + 'void setup(){ digitalWrite(999, HIGH); }')
    expect(err, '🔴 一個什麼都不做又不出聲的呼叫，是最難查的那種錯').toContain('999')
  })

  /**
   * ⚠️ **沒有 `pinMode` 就寫：本輪【照做而不擋】**，理由見 `arduino-pins.ts` 檔頭。
   * 這一支釘的是那個決定本身——**免得未來有人以為它是漏掉的**。
   */
  it('★ 沒有 pinMode 就 digitalWrite → 照做，而不是未定義也不是報錯', async () => {
    const { out, err } = await run(H + 'void setup(){ digitalWrite(13, HIGH); cout << digitalRead(13); }')
    expect(err, '本輪刻意不擋——出聲會擋住一批真的能跑的入門程式').toBe('')
    expect(out).toBe('1')
  })
})
