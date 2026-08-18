/**
 * 探針：**用到函式庫的語料，貼進來轉不轉得動。**
 *
 * 語料：20 段由**隔離的**出題者寫的 sketch——提示裡**沒有提到**型別辨識、
 * 「最令人困惑的解析」或任何概念名，否則量到的覆蓋是照著清單寫的。
 *
 * ## ⚠️ 宣稱範圍：不含編譯與執行比對
 *
 * `g++` 編不動 sketch，本專案沒接 `arduino-cli`。量的是辨識、產生、
 * round-trip 穩定性與概念身分——**不是**行為等價。（前三輪同此聲明。）
 *
 * ## 🔴 這一輪要特別量三件事，而它們都在【共用層】
 *
 * ```
 * A. 型別辨識的命中率   宣告認出來、而它的方法有沒有跟著認出來
 *                      ——⚠️「宣告對而方法錯」是這一批最可能的失敗形狀
 * B. 最令人困惑的解析   `Type name(MACRO, ...)` ——剛修好的那個 bug
 * C. 容器的迭代器       vector／string 的 .begin() 一個都不准被搶
 * ```
 *
 * ⚠️ 入口條件錨在**載入幾段**這個合成量，🔴 **不錨在殘差**。
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
    JSON.parse(readFileSync(join(__dirname, 'arduino-libraries-corpus.json'), 'utf8')) as Record<string, Sketch>,
  )
const lift = (c: string): SemanticNode | null =>
  createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode | null
const gen = (t: SemanticNode): string => generateCode(t, 'cpp', apcs as StylePreset)
const nodes = (n: SemanticNode, out: SemanticNode[] = []): SemanticNode[] => {
  out.push(n)
  for (const ks of Object.values(n.children ?? {})) for (const k of ks) nodes(k, out)
  return out
}
const ids = (n: SemanticNode): string[] => nodes(n).map((x) => x.conceptId)
const RESIDUE = new Set(['cpp:raw_code', 'cpp:raw_expression', 'raw_code', 'unresolved'])
const isWhole = (code: string): boolean => !parser.parse(code)!.rootNode.hasError

/** 這一批的專屬身分（宣告 → 它的方法們）。 */
const FAMILY: Record<string, { decl: string; methods: string[] }> = {
  Servo: { decl: 'cpp:servo_declare', methods: ['cpp:servo_attach', 'cpp:servo_write', 'cpp:servo_read'] },
  DHT: { decl: 'cpp:dht_declare', methods: ['cpp:dht_open', 'cpp:dht_read'] },
  LiquidCrystal: { decl: 'cpp:lcd_declare', methods: ['cpp:lcd_open', 'cpp:lcd_print', 'cpp:lcd_at', 'cpp:lcd_clear'] },
}

describe('探針：函式庫語料（第 2／3 批盲測）', () => {
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
    expect(cols.whole.n + cols.partial.n, '沒有量到任何節點').toBeGreaterThan(1200)  // ← 正向錨點
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
      if (ids(t1).sort().join(',') !== ids(t2).sort().join(',')) drift.push(`${id}: 結構漂移`)
    }
    expect(checked, '一段都沒驗到').toBeGreaterThanOrEqual(18)   // ← 正向錨點
    expect(drift, `漂移：${drift.join('、')}`).toEqual([])
  })

  it('🔴 ③A 型別辨識：宣告認出來的，它的方法也要跟著認出來', () => {
    const table: string[] = []
    const broken: string[] = []
    let declTotal = 0
    for (const [id, s] of corpus()) {
      const t = lift(s.code)
      if (!t) continue
      const list = ids(t)
      for (const [ctype, fam] of Object.entries(FAMILY)) {
        // 原始碼裡有沒有這個型別的宣告（`Servo x;` / `DHT d(...)` / `LiquidCrystal l(...)`）
        const declared = new RegExp(`^\\s*${ctype}\\w*\\s+\\w+\\s*[;(]`, 'm').test(s.code)
        if (!declared) continue
        declTotal++
        const gotDecl = list.includes(fam.decl)
        const gotMethod = fam.methods.some((m) => list.includes(m))
        table.push(`${id} ${ctype}：宣告 ${gotDecl ? '✅' : '❌'}　方法 ${gotMethod ? '✅' : '❌'}`)
        // 🔴 **「宣告對而方法錯」是這一批最可能的失敗形狀**——它安靜地降級成通用方法呼叫
        if (gotDecl && !gotMethod) broken.push(`${id} ${ctype}：宣告認出來但方法沒有`)
        if (!gotDecl) broken.push(`${id} ${ctype}：宣告沒認出來`)
      }
    }
    expect(declTotal, '語料裡一個函式庫物件都沒有').toBeGreaterThan(5)   // ← 正向錨點
    console.log(`\n型別辨識（${table.length} 筆）：\n  ${table.join('\n  ')}`)
    expect(broken, `辨識斷了：${broken.join('、')}`).toEqual([])
  })

  it('🔴 ③B 最令人困惑的解析：`Type name(MACRO, …)` 要認得出來', () => {
    // tree-sitter 不做前置處理，所以引數是識別字時它解析成【函式宣告】。
    // 真編譯器沒有這個問題——巨集先被展開了。
    const VEXING = /^\s*(Servo|DHT|LiquidCrystal\w*)\s+(\w+)\s*\(\s*[A-Za-z_]\w*\s*[,)]/m
    const found: string[] = []
    const missed: string[] = []
    for (const [id, s] of corpus()) {
      const m = VEXING.exec(s.code)
      if (!m) continue
      found.push(`${id}: ${m[0].trim()}`)
      const t = lift(s.code)
      const list = t ? ids(t) : []
      const want = FAMILY[m[1].startsWith('LiquidCrystal') ? 'LiquidCrystal' : m[1]]?.decl
      if (want && !list.includes(want)) missed.push(`${id}: ${m[0].trim()}`)
    }
    console.log(`\n最令人困惑的解析：語料裡 ${found.length} 筆\n  ${found.join('\n  ') || '（無）'}`)
    expect(missed, `沒認出來：${missed.join('、')}`).toEqual([])
  })

  it('🔴 ③C 容器的迭代器一個都不准被搶', () => {
    const bad: string[] = []
    let seen = 0
    for (const [id, s] of corpus()) {
      // 語料裡若有 vector／string 的 .begin()/.end()，它們必須仍是迭代器
      const iters = (s.code.match(/\b\w+\.(begin|end)\(\s*\)/g) ?? []).filter(
        (x) => !/^(dht|lcd|Serial|WiFi|\w*[Ll]cd|\w*[Dd]ht)\./.test(x),
      )
      if (iters.length === 0) continue
      seen += iters.length
      const t = lift(s.code)
      const list = t ? ids(t) : []
      if (!list.includes('cpp:container_iter')) bad.push(`${id}: ${iters.join(' ')}`)
    }
    console.log(`\n容器迭代器：語料裡 ${seen} 處`)
    expect(bad, `被搶走了：${bad.join('、')}`).toEqual([])
  })
})
