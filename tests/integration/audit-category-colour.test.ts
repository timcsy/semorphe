/**
 * 第五十二條護欄：**一顆積木的顏色，等於它所在分類的顏色。**
 *
 * ## 為什麼有這一支（使用者 2026-08-22 回報）
 *
 * > 「我覺得你有一些的積木分類和顏色不太好，例如現在大部分積木都塞在『資料』」
 *
 * 顏色是**分類的視覺編碼**：學生靠它認「這是同一種東西」。而**它與分類
 * 不一致的時候，學生學到的是雜訊**——他看到兩顆同色的積木在不同的抽屜裡，
 * 或同一個抽屜裡有三種顏色，而那兩件事都在教他一個不存在的規則。
 *
 * ⚠️ **C++ 那份今天有幾處不一致**（`cpp:try_catch` 掛在「控制」而顏色是
 * 函式的粉紅、`class_def` 與 `struct_declare` 同屬「結構與類別」而兩種顏色）。
 * 所以這條護欄**對兩個語言用不同的門檻**：Python 是硬性零，C++ 是棘輪。
 *
 * > **一條新規則落地時，先拿它掃一遍現有的資料——而掃出來的那些
 * > 不是「馬上都要改」，是「從今天起不准再多」。**
 *
 * ## 這條護欄不檢測什麼
 *
 * - **顏色好不好看**——那是人的判斷。
 * - **分類分得對不對**（一顆積木該不該在那個抽屜裡）——同上。
 * - 只問一件事：**它的顏色與它所在的抽屜一致嗎。**
 */
import { describe, it, expect } from 'vitest'
import { cppCategoryDefs } from '../../src/languages/cpp/toolbox-categories'
import { pythonCategoryDefs } from '../../src/languages/python/toolbox-categories'
import { CATEGORY_COLORS } from '../../src/ui/theme/category-colors'
import { componentBlocks } from '../../src/core/component/registry'
import { printReport, assertRatchet } from '../helpers/guardrail'
import type { ToolboxCategoryDef } from '../../src/core/types'

interface blockRow { type: string; owner: string; category: string; colour: string }

/**
 * 每一顆積木的擁有者、來源分類與顏色。
 *
 * ⚠️ **`owner` 由登錄表補上**（`componentBlocks` 會把它掛在每一筆上）
 * ——`blocks.json` 自己不寫擁有者，那住在 `component.json`。
 */
function blocks(): blockRow[] {
  const out: blockRow[] = []
  for (const form of componentBlocks() as { blockDef?: { type?: string; colour?: unknown }; category?: string; owner?: string }[]) {
    const bd = form.blockDef
    if (!bd?.type || typeof bd.colour !== 'string') continue
    out.push({
      type: bd.type,
      owner: String(form.owner ?? ''),
      category: String(form.category ?? ''),
      colour: bd.colour,
    })
  }
  return out
}

/**
 * 一顆積木**落在哪個抽屜**——由分類宣告的 `sources` 決定。
 *
 * ⚠️ 一顆積木可以落在**好幾個**抽屜（`extraTypes` 是刻意的多入口），
 * 而那時「一致」的意思是**與它的來源分類那一個**一致
 * ——`sources` 那個才是它的家，`extraTypes` 是借放的。
 */
function homeCategory(b: blockRow, defs: readonly ToolboxCategoryDef[]): ToolboxCategoryDef | undefined {
  return defs.find((d) => (d.sources ?? []).some((s) => s.from === b.owner && s.category === b.category))
}

/** 把違規按「抽屜 → 該是什麼色 → 實際是什麼色」分組——**逐顆列會看不出形狀**。 */
function groupOf(rows: readonly string[]): [string, number][] {
  const c = new Map<string, number>()
  for (const r of rows) {
    const m = /在「(.*)」（(.*)）而顏色是 (.*)$/.exec(r)
    const k = m ? `${m[1]}：該 ${m[2]}，實際 ${m[3]}` : r
    c.set(k, (c.get(k) ?? 0) + 1)
  }
  return [...c].sort((a, b) => b[1] - a[1])
}

function mismatches(defs: readonly ToolboxCategoryDef[], ownerPrefix: string): string[] {
  const out: string[] = []
  for (const b of blocks()) {
    if (!b.owner.startsWith(ownerPrefix)) continue
    const home = homeCategory(b, defs)
    if (!home) continue // 沒有抽屜是「可拿性」那條護欄的事，不是這一條
    const want = (CATEGORY_COLORS as Record<string, string>)[home.colorKey]
    if (want && b.colour.toUpperCase() !== want.toUpperCase()) {
      out.push(`${b.type}：在「${home.fallback}」（${want}）而顏色是 ${b.colour}`)
    }
  }
  return out.sort()
}

describe('第五十二條護欄：積木的顏色與它所在的分類一致嗎', () => {
  it('★ 錨點：母體不是空的（否則下面每一個零都是假的）', () => {
    const all = blocks()
    expect(all.length, '一顆積木都沒掃到 → 掃描壞了').toBeGreaterThan(200)
    expect(all.filter((b) => b.owner === '(python)').length).toBeGreaterThan(50)
  })

  it('★ 注入：把一顆積木的顏色改掉【必須】被抓到', () => {
    const fake: ToolboxCategoryDef[] = [{
      key: 'k', nameKey: 'K', fallback: '假的', colorKey: 'io',
      sources: [{ from: '(python)', category: 'io' }],
    }]
    // `io` 是 #5CB1D6，而 python 的輸出積木就是那個色 → 這裡不該有違規
    expect(mismatches(fake, '(python)'), '健康的被誤報').toEqual([])
    // 換一個顏色鍵，同一批積木就全部不一致
    const wrong = [{ ...fake[0], colorKey: 'control' }]
    expect(mismatches(wrong, '(python)').length, '改了顏色卻抓不到 → 這條護欄量的是別的東西').toBeGreaterThan(0)
  })

  it('🔴 Python：硬性零', () => {
    const bad = mismatches(pythonCategoryDefs, '(python)')
    printReport('Python：積木顏色與分類', [
      `不一致 ${bad.length} 顆 ← 硬性零`,
      ...bad.map((b) => `  ✘ ${b}`),
    ])
    expect(bad, '學生看到同一個抽屜裡兩種顏色，學到的是一個不存在的規則').toEqual([])
  })

  it('C++：棘輪只准下降（既有的不一致不在這一刀的範圍）', () => {
    const bad = mismatches(cppCategoryDefs, '(')
    printReport('C++：積木顏色與分類', [
      `不一致 ${bad.length} 顆 ← 棘輪`,
      '',
      '  按「哪個抽屜 → 該是什麼色 → 實際是什麼色」分組：',
      ...groupOf(bad).map(([k, n]) => `     ${String(n).padStart(3)}  ${k}`),
      '',
      '⚠️ 這些**不是**「馬上都要改」，是「從今天起不准再多」——',
      '   一條新規則落地時先拿它掃一遍現有的資料，而掃出來的是起點不是缺陷帳。',
    ].filter(Boolean))
    assertRatchet([['C++ 顏色不一致', bad.length]], 'category-colour', { detail: bad })
  })
})
