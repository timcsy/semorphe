/**
 * I/O 操縱子三顆的自證測：`cpp:io_mode` · `cpp:io_mode_number` · `cpp:io_flush`。
 *
 * ## 🔴 為什麼三顆寫在一起
 *
 * 它們共用**同一份串流狀態**（`runtime/stream-state.ts`，`WeakMap` 以 `ctx.io` 為鍵），
 * 而這一族最容易錯的正是**互相影響**：
 *
 * ```
 * setfill('0') 之後，setw 補的是 0 不是空白
 * fixed 之後，setprecision 的意思從「有效數字」變成「小數點後幾位」
 * setw 用掉就沒了，而其餘的一直有效
 * ```
 *
 * **分開三支測的話，那三條沒有人在看。**
 *
 * ⚠️ 而它們**是三顆身分**不是一顆：`flush` 與那兩顆做的事不同，
 * 帶值的與不帶值的引數個數不同——判準見各自 `component.json` 的 `_why`。
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

const S = apcs as unknown as StylePreset
const lift = (c: string): SemanticNode =>
  createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const collect = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) collect(k, out)
  return out
}
const run = async (c: string): Promise<{ out: string; err: string }> => {
  const i = new SemanticInterpreter({ maxSteps: 100_000 })
  try {
    await i.execute(lift(c))
    return { out: i.getOutput().join(''), err: '' }
  } catch (e) { return { out: i.getOutput().join(''), err: (e as Error).message } }
}
const H = '#include <bits/stdc++.h>\nusing namespace std;\n'
const prog = (body: string): string => `${H}int main(){ ${body} return 0; }`

describe('膠囊自證：I/O 操縱子三顆', () => {
  it('★ lift：三顆都認得，而屬性帶得對', () => {
    const tree = lift(prog(
      `cout << setw(3) << setprecision(2) << setfill('0') << fixed << scientific << flush << 1;`))
    const ids = collect(tree)
    expect(ids).toContain('cpp:io_mode')          // ← 正向錨點先釘
    expect(ids).toContain('cpp:io_mode_number')
    expect(ids).toContain('cpp:io_flush')
    expect(ids).not.toContain('cpp:raw_code')

    const all = (id: string): SemanticNode[] => {
      const acc: SemanticNode[] = []
      const dig = (n: SemanticNode): void => {
        if (n.componentId === id) acc.push(n)
        for (const ks of Object.values(n.slots ?? {})) for (const k of ks) dig(k)
      }
      dig(tree)
      return acc
    }
    expect(all('cpp:io_mode').map((n) => n.properties.setting)).toEqual(['width', 'precision', 'fill'])
    expect(all('cpp:io_mode_number').map((n) => n.properties.notation)).toEqual(['fixed', 'scientific'])
  })

  /**
   * 🔴 **使用者自己的變數不得被搶走**——`fixed`／`flush` 都是很普通的名字。
   * ⚠️ 這一條前面有正向錨點（上一支），所以「沒有被認領」才是有意義的讀數。
   */
  it('🔴 lift：宣告過的同名變數不得被認成操縱子', () => {
    const ids = collect(lift(prog(`int fixed = 3; int flush = 4; cout << fixed << flush;`)))
    expect(ids).toContain('cpp:var_ref')
    expect(ids).not.toContain('cpp:io_mode_number')
    expect(ids).not.toContain('cpp:io_flush')
  })

  it('★ generate：產回去一字不差', () => {
    const src = prog(`cout << setw(3) << setfill('0') << fixed << setprecision(2) << 1.5 << flush;`)
    const code = generateCode(lift(src), 'cpp', S)
    for (const want of ['setw(3)', "setfill('0')", 'fixed', 'setprecision(2)', 'flush']) {
      expect(code, `🔴 產出少了 ${want}`).toContain(want)
    }
  })

  it('★ round-trip：產回去再 lift，身分不變', () => {
    const src = prog(`cout << setw(4) << 7 << '\\n';`)
    const once = generateCode(lift(src), 'cpp', S)
    expect(generateCode(lift(once), 'cpp', S)).toBe(once)
    expect(collect(lift(once))).toContain('cpp:io_mode')
  })

  it('🔴 execute：欄寬只影響下一項，用掉就沒了', async () => {
    const r = await run(prog(`cout << setw(4) << 7 << 8;`))
    expect(r.err).toBe('')
    expect(r.out).toBe('   78')
  })

  it('🔴 execute：補位的字會影響欄寬怎麼補（兩個設定互相影響）', async () => {
    const r = await run(prog(`cout << setfill('0') << setw(3) << 5 << ',' << setw(3) << 6;`))
    expect(r.err).toBe('')
    expect(r.out).toBe('005,006')
  })

  /**
   * 🔴 **`fixed` 改變了「位數」的意思**——這一條是這一族最容易錯的地方，
   * 而它只有在兩顆一起用的時候才看得出來。
   */
  it('🔴 execute：位數的意思跟著數字的寫法走', async () => {
    const a = await run(prog(`cout << setprecision(2) << 3.14159;`))
    expect(a.out, '🔴 沒選寫法時是【總共兩位有效數字】').toBe('3.1')
    const b = await run(prog(`cout << fixed << setprecision(2) << 3.14159;`))
    expect(b.out, '🔴 選了固定小數之後是【小數點後兩位】').toBe('3.14')
  })

  it('🔴 execute：印零個字的那一項不得吃掉欄寬', async () => {
    const r = await run(prog(`cout << setw(3) << fixed << 7;`))
    expect(r.err).toBe('')
    expect(r.out, '🔴 那個 3 要給 7，不是給 fixed').toBe('  7')
  })

  /**
   * ⚠️ **送出在這裡沒有可觀察的效果，而那不是敷衍**——輸出沒有緩衝。
   * 這一條驗的是「它不會弄壞任何東西」，不是「它做了什麼」。
   */
  it('★ execute：送出不改變輸出', async () => {
    const r = await run(prog(`cout << "ab" << flush << "cd";`))
    expect(r.err).toBe('')
    expect(r.out).toBe('abcd')
  })

  it('🔴 execute：設定一直有效，直到被改掉', async () => {
    const r = await run(prog(`cout << setprecision(2) << 1.23456 << ' ' << 2.34567;`))
    expect(r.err).toBe('')
    expect(r.out).toBe('1.2 2.3')
  })

  /**
   * 🔴 **一次執行一份狀態**——模組變數會讓上一次的設定洩漏到下一次，
   * 而那種污染的症狀是「單獨跑綠、整批跑紅」。
   */
  it('🔴 execute：上一次執行的設定不得洩漏到下一次', async () => {
    await run(prog(`cout << fixed << setprecision(4) << 1.0;`))
    const r = await run(prog(`cout << 1.0 / 3;`))
    expect(r.out, '🔴 上一次的設定洩漏了').toBe('0.333333')
  })
})
