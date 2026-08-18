/**
 * 探針：**零件接線的語料，貼進來轉不轉得動。**
 *
 * 語料：20 段由**隔離的**出題者寫的 sketch（`arduino-parts-corpus.json`）
 * ——提示裡**沒有提到**接線元件或觸發序列的存在，否則量到的覆蓋是照著清單寫的。
 *
 * ## ⚠️ 宣稱範圍：**不含編譯與執行比對**
 *
 * `g++` 編不動 sketch，本專案沒接 `arduino-cli`。量的是辨識、產生、
 * round-trip 穩定性與概念身分——**不是**行為等價。（前兩輪的報告同此聲明。）
 *
 * ## 🔴 這一輪的第三軸要【雙向】量，而反向比正向重要
 *
 * ```
 * 該認沒認    const int ledPin = 13; ＋ pinMode(…) 卻仍是常數宣告
 * 🔴 不該認認了  一般常數被搶走 · 不是觸發序列的五句被摺 · 零件猜錯
 * ```
 *
 * **猜錯比猜不出來嚴重**——學生會照著錯的標籤理解他的電路。
 * 所以「變數名 → 猜出的零件」整張表印出來，逐筆人工看過（見報告）。
 *
 * ⚠️ 入口條件錨在**載入幾段**這個合成量，🔴 **不錨在殘差**（那是要推向零的東西）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

interface Sketch { board: string; topic: string; libraries: string[]; code: string }

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

const corpus = (): [string, Sketch][] =>
  Object.entries(
    JSON.parse(readFileSync(join(__dirname, 'arduino-parts-corpus.json'), 'utf8')) as Record<string, Sketch>,
  )
const lift = (c: string): SemanticNode | null =>
  createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode | null
const gen = (t: SemanticNode): string => generateCode(t, 'cpp', apcs as StylePreset)
const nodes = (n: SemanticNode, out: SemanticNode[] = []): SemanticNode[] => {
  out.push(n)
  for (const ks of Object.values(n.children ?? {})) for (const k of ks) nodes(k, out)
  return out
}
const RESIDUE = new Set(['cpp:raw_code', 'cpp:raw_expression', 'raw_code', 'unresolved'])

/** 這一段的原始碼**語法完整**嗎——⚠️ 分欄記，不得為了比率好看而濾掉語料。 */
const isWhole = (code: string): boolean => !parser.parse(code)!.rootNode.hasError

describe('探針：零件接線語料（第 1 批盲測）', () => {
  it('⚠️ 入口條件：語料載得到（🔴 不錨在殘差）', () => {
    expect(corpus().length).toBeGreaterThanOrEqual(18)
  })

  it('① 殘差率——語法完整／片段分兩欄', () => {
    const cols = { whole: { n: 0, res: 0, segs: 0 }, partial: { n: 0, res: 0, segs: 0 } }
    const worst: string[] = []
    for (const [id, s] of corpus()) {
      const col = isWhole(s.code) ? cols.whole : cols.partial
      col.segs++
      const t = lift(s.code)
      if (!t) { worst.push(`${id}: lift 回 null`); continue }
      const list = nodes(t)
      col.n += list.length
      const r = list.filter((x) => RESIDUE.has(x.conceptId)).length
      col.res += r
      if (r > 0) worst.push(`${id}: ${r}/${list.length}`)
    }
    expect(cols.whole.n + cols.partial.n, '沒有量到任何節點').toBeGreaterThan(800)  // ← 正向錨點
    const pct = (c: { n: number; res: number }): string =>
      c.n === 0 ? '—' : `${((c.res / c.n) * 100).toFixed(2)}%`
    console.log(
      `\n殘差：語法完整 ${cols.whole.segs} 段 ${cols.whole.res}/${cols.whole.n} = ${pct(cols.whole)}` +
        `　｜　片段 ${cols.partial.segs} 段 ${cols.partial.res}/${cols.partial.n} = ${pct(cols.partial)}` +
        (worst.length > 0 ? `\n  有殘差的：${worst.join('、')}` : '\n  🟢 沒有任何一段有殘差'),
    )
  })

  it('② round-trip：文字與結構都不得漂移', () => {
    const drift: string[] = []
    let checked = 0
    for (const [id, s] of corpus()) {
      const t1 = lift(s.code)
      if (!t1) { drift.push(`${id}: lift 回 null`); continue }
      const once = gen(t1)
      const t2 = lift(once)
      if (!t2) { drift.push(`${id}: 二次 lift 回 null`); continue }
      checked++
      if (gen(t2) !== once) drift.push(`${id}: 文字漂移`)
      const a = nodes(t1).map((x) => x.conceptId).sort().join(',')
      const b = nodes(t2).map((x) => x.conceptId).sort().join(',')
      if (a !== b) drift.push(`${id}: 結構漂移`)
    }
    expect(checked, '一段都沒驗到——負向斷言會空過').toBeGreaterThanOrEqual(18)  // ← 正向錨點
    expect(drift, `漂移：${drift.join('、')}`).toEqual([])
  })

  it('🔴 ③ 概念身分（雙向）：該認的認了，不該認的一個都沒被搶', () => {
    const shouldButDidnt: string[] = []
    const table: string[] = []
    let attachTotal = 0
    for (const [id, s] of corpus()) {
      const t = lift(s.code)
      if (!t) continue
      const list = nodes(t)
      const attached = new Set(
        list.filter((x) => x.conceptId === 'cpp:pin_attach').map((x) => String(x.properties.name)),
      )
      attachTotal += attached.size
      for (const n of list.filter((x) => x.conceptId === 'cpp:pin_attach')) {
        table.push(`${String(n.properties.name)} → ${String(n.properties.device)}`)
      }
      // 🔴 **該認沒認**：一個 `const <int> X = <數字>;` 若 X 被當腳位用，就該是接線。
      for (const m of s.code.matchAll(/const\s+(?:int|byte|uint8_t)\s+(\w+)\s*=\s*(\d+)\s*;/g)) {
        const name = m[1]
        const usedAsPin = new RegExp(
          `\\b(?:pinMode|digitalWrite|digitalRead|analogRead|analogWrite|tone|noTone|pulseIn|ledcAttachPin)\\s*\\(\\s*${name}\\b`,
        ).test(s.code)
        if (usedAsPin && !attached.has(name)) shouldButDidnt.push(`${id}:${name}`)
      }
    }
    expect(attachTotal, '一顆接線都沒認出來——負向會空過').toBeGreaterThan(10)  // ← 正向錨點
    console.log(`\n零件猜測對照表（${table.length} 筆）：\n  ${table.join('\n  ')}`)
    expect(shouldButDidnt, `該認而沒認：${shouldButDidnt.join('、')}`).toEqual([])
  })

  it('🔴 ③ 反向：不是觸發序列的東西不得被摺', () => {
    const wrong: string[] = []
    let folded = 0
    for (const [id, s] of corpus()) {
      const t = lift(s.code)
      if (!t) continue
      const n = nodes(t).filter((x) => x.conceptId === 'cpp:ultrasonic_trigger').length
      folded += n
      // 原始碼裡有幾組真的觸發序列？（同一根腳、2 與 10）
      const real = [
        ...s.code.matchAll(
          /digitalWrite\(\s*(\w+)\s*,\s*LOW\s*\)\s*;[\s\S]{0,120}?delayMicroseconds\(\s*2\s*\)\s*;[\s\S]{0,120}?digitalWrite\(\s*\1\s*,\s*HIGH\s*\)\s*;[\s\S]{0,120}?delayMicroseconds\(\s*10\s*\)\s*;[\s\S]{0,120}?digitalWrite\(\s*\1\s*,\s*LOW\s*\)\s*;/g,
        ),
      ].length
      if (n !== real) wrong.push(`${id}: 摺了 ${n} 組而原文有 ${real} 組`)
    }
    expect(folded, '一組都沒摺到——負向會空過').toBeGreaterThan(0)   // ← 正向錨點
    expect(wrong, `摺錯：${wrong.join('、')}`).toEqual([])
  })
})
