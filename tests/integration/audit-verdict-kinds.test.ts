/**
 * **護欄：判決的每一種問題，我們都判過要怎麼說**（2026-11-04，cella 0.1.202611032234 起套件附 `verdict-kinds.json`）。
 *
 * Cella 的 C 家族（C、C++、Arduino 共用）與 Python 套件各附一份種類清單。每一種要嘛在 `KINDS` 裡（有專屬文案），
 * 要嘛在 `GENERIC_KINDS` 裡（刻意走通用那一句）。**Cella 加了新種類而兩邊都沒有 ⟹ 紅**——要人判它歸哪裡，
 * 不讓它安靜地落進「判斷功能說這裡有狀況」。
 *
 * 反方向也要紅：我們列了而 Cella 清單裡沒有的種類（改名或刪掉了）——留著的文案永遠不會被用到。
 * 結構化的種類（`structured: true`）必須在 `KINDS` 裡：它的文案讀 params，不能走只會印 reason 的通用那一句。
 *
 * ⚠️ 自我否證：清單讀不到（套件路徑改了）⟹ 上面每一條都是空集合、照樣綠。所以入口條件要求兩份清單都讀得到、而且夠大。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { KIND_RULES, GENERIC_KINDS } from '../../src/core/verdict-diagnostics'

const ROOT = path.resolve(__dirname, '../..')
type KindList = { kinds: Record<string, { structured: boolean }> }
const read = (pkg: string): KindList => JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', pkg, 'verdict-kinds.json'), 'utf8')) as KindList
const LISTS = { cfamily: read('@cella-lang/cfamily'), python: read('@cella-lang/python') }

/** 判準：一份清單 ＋ 我們的兩張表 → 沒判過的、孤兒、結構化卻走通用的 */
export function judgeKinds(lists: KindList[], ours: readonly string[], generic: readonly string[]): { unjudged: string[]; orphans: string[]; structuredGeneric: string[] } {
  const all = new Map<string, boolean>()
  for (const l of lists) for (const [k, v] of Object.entries(l.kinds)) all.set(k, (all.get(k) ?? false) || v.structured)
  return {
    unjudged: [...all.keys()].filter((k) => !ours.includes(k) && !generic.includes(k)).sort(),
    orphans: [...ours, ...generic].filter((k) => !all.has(k)).sort(),
    structuredGeneric: [...all].filter(([k, st]) => st && !ours.includes(k)).map(([k]) => k).sort(),
  }
}

describe('護欄：判決的種類都判過要怎麼說', () => {
  it('★ 入口條件：兩份清單都讀得到，而且不是空的', () => {
    expect(Object.keys(LISTS.cfamily.kinds).length).toBeGreaterThan(30)
    expect(Object.keys(LISTS.python.kinds).length).toBeGreaterThan(4)
  })

  it('★ 注入：新種類 → 沒判過；我們多列的 → 孤兒；結構化卻走通用 → 報', () => {
    const l: KindList = { kinds: { a: { structured: false }, b: { structured: true }, c: { structured: false } } }
    expect(judgeKinds([l], ['a'], ['b', 'z'])).toEqual({ unjudged: ['c'], orphans: ['z'], structuredGeneric: ['b'] })
    expect(judgeKinds([l], ['a', 'b'], ['c'])).toEqual({ unjudged: [], orphans: [], structuredGeneric: [] })
  })

  it('🔴 硬性零：每一種都判過、沒有孤兒、結構化的都有專屬文案', () => {
    const r = judgeKinds(Object.values(LISTS), Object.keys(KIND_RULES), GENERIC_KINDS)
    expect(r.unjudged, '🔴 Cella 有這些種類而我們沒判過——放進 KINDS（寫專屬文案）或 GENERIC_KINDS（走通用那一句），`core/verdict-diagnostics.ts`').toEqual([])
    expect(r.orphans, '我們列了而 Cella 清單裡沒有（改名或刪掉了）——這些文案永遠不會被用到').toEqual([])
    expect(r.structuredGeneric, '結構化的種類要讀 params 說話，不能走只會印 reason 的通用那一句').toEqual([])
  })
})
