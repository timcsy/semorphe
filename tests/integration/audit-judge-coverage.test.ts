/**
 * **判定者覆蓋率**——「我們**自以為**驗了多少」第一次是一個數得出來的數字。
 *
 * ## 它從哪來
 *
 * `knowledge/draft/2026-09-22-元件宣告的契約化.md` §十一之五：
 *
 * > ```
 * > 契約總數           我們寫了多少
 * > 🔴 沒有判定者的數    我們【自以為】驗了多少
 * > ```
 * > **那個數字今天沒有人知道**，而它比「有幾條契約」有用得多。
 *
 * 而它對得上 `principles.md` 最終檢驗表那一列，逐字：
 *
 * > | 這裡出錯會有人發現嗎 | **誠實降級**：答案是「不會」的每一處都是等待發生的靜默降級 |
 *
 * `judge == null` 就是那一格的機械化形式。
 *
 * ## 🔴 自我否證聲明第一次跑就兌現了，而它推翻了本護欄的第一版
 *
 * 原本寫的是：
 *
 * > 「如果『有判定者』的比例是 100%，代表工具壞了。」
 *
 * **第一次跑：裸 0 格。** 而工具沒壞——是**問題問錯了**：加上 `PATH_JUDGE`
 * 的預設之後，「有沒有判定者」**結構上必為真**。
 *
 * ⚠️ 那是同一天第 240 刀那條的**分子版本**：
 *
 * > **一條硬性零如果它的分母是零，它永遠成立——而那與「做到了」長得一樣。**
 *
 * ⟹ **改問：那個判定者【看過這一顆】嗎。**
 *
 * ```
 * 宣告上   六路都有預設判定者          ← 宣稱
 * 實測上   只有 execute 量過覆蓋率      ← 125 / 210,裸著 85（judge-coverage-execute 探針）
 * 🔴 棘輪   判定者宣稱覆蓋,而沒有人量過它的路數 —— 今天 5 / 6
 * ```
 *
 * ⚠️ 錨在**掃到幾顆、解析出幾格**（合成量）上——那是這個庫今年踩過的那一課：
 *
 * > **一個「零缺陷」的讀數，與一個「零樣本」的讀數，數字長得一模一樣
 * > ——分開它們的只有入口條件。**
 *
 * ## 🔴 分母與分子分兩欄記
 *
 * 2026-09-26 第 240 刀學到的：
 *
 * > **一條硬性零如果它的分母是零，它永遠成立——而那與「做到了」長得一樣。**
 *
 * 所以基線記 `denominator`（元件 × 路）與 `naked`（其中沒有判定者的），
 * 而**分母走 `assertCorpus`（雙向，變小也要出聲）**、分子走 `assertRatchet`（只准下降）。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢測那個判定者判得對不對**。一個判錯的與一個對的，在這裡長得一樣。
 * - **不檢測 `evidence` 那個檔真的在判那一路**——它只驗檔案存在。那需要人讀，
 *   而**假裝機械化得到才是這個庫記過最多次的那種假綠**。
 * - **不檢測 `preconditions` / `invariants` 的判定者**——那兩格要宣告，
 *   而宣告出來的欄位會說謊（draft §十一之四）。第一刀刻意不碰。
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  loadBaseline, writeBaseline, printReport, assertRatchet, assertCorpus, REPO_ROOT,
} from '../helpers/guardrail'
import { allComponentDefs } from '../helpers/component-scan'
import { JUDGE_KINDS, PATH_JUDGE, SIX_PATHS, isJudgeKind, judgeOf } from '../../src/core/component/judges'

const GUARD = 'judge-coverage'

type Cell = { componentId: string; path: string; judge: string | null }

/**
 * 🔴 **只算元件【真的有】的那一路**——`paths` 裡沒有 `formalize` 的那 347 顆，
 * 不該在分母裡多出一格「沒有判定者的 formalize」。
 * **一條不存在的路，它沒有判定者不是缺陷。**
 */
function scan(): { components: number; cells: Cell[]; naked: Cell[]; own: Cell[] } {
  const defs = allComponentDefs() as Array<{
    componentId: string
    paths?: Record<string, unknown>
    postconditions?: Record<string, { judge?: unknown }>
  }>
  const cells: Cell[] = []
  const own: Cell[] = []
  for (const d of defs) {
    for (const p of SIX_PATHS) {
      if (!d.paths?.[p]) continue
      const declared = d.postconditions?.[p]?.judge
      const j = judgeOf(p, d.postconditions)
      cells.push({ componentId: d.componentId, path: p, judge: j })
      if (declared !== undefined) own.push({ componentId: d.componentId, path: p, judge: j })
    }
  }
  return { components: defs.length, cells, naked: cells.filter((c) => c.judge === null), own }
}

describe('判定者覆蓋率', () => {
  it('★ 入口條件：掃得到元件，而且解析出格子', () => {
    const { components, cells } = scan()
    expect(components, '🔴 掃到 0 顆元件 → 判別壞了').toBeGreaterThan(100)
    expect(cells.length, '🔴 解析出 0 格 → 判別壞了').toBeGreaterThan(components * 3)
  })

  it('★ 入口條件：格子只算元件【真的有】的那些路', () => {
    const { cells, components } = scan()
    expect(cells.length, '🔴 一格都沒有 → 判別壞了').toBeGreaterThan(components)
    expect(cells.length, '🔴 每顆都有六路是不可能的 —— formalize 今天只有 2 顆')
      .toBeLessThan(components * SIX_PATHS.length)
    expect(cells.filter((c) => c.path === 'formalize').length, '🔴 formalize 今天就是 2 顆').toBe(2)
  })

  it('🔴 硬性零：judge 的值一律在閉集裡', () => {
    const bad = scan().own.filter((c) => c.judge !== null && !isJudgeKind(c.judge))
    expect(bad, `🔴 閉集外的 judge：${JSON.stringify(bad)}｜合法值 ${JUDGE_KINDS.join(' / ')}`).toEqual([])
  })

  it('🔴 硬性零：每一路的預設判定者都指到一個【存在的】檔', () => {
    const missing: string[] = []
    for (const p of SIX_PATHS) {
      const e = PATH_JUDGE[p]
      if (e.kind === null) continue
      expect(e.evidence, `🔴 ${p} 宣告了判定者卻沒說它在哪裡跑`).not.toBe('')
      if (!existsSync(path.join(REPO_ROOT, e.evidence))) missing.push(`${p} → ${e.evidence}`)
    }
    expect(missing, `🔴 判定者指到不存在的檔：${missing.join('、')}`).toEqual([])
  })

  it('🔴 硬性零：每一路都要說得出【它判的是什麼】', () => {
    const silent = SIX_PATHS.filter((p) => PATH_JUDGE[p].kind !== null && !PATH_JUDGE[p].judges.trim())
    expect(silent, `🔴 這幾路宣告了判定者而沒說它判什麼：${silent.join('、')}`
      + '｜⚠️ 那一句是【人讀出來的】,而它的用途是讓下一個人否證得了填表的人').toEqual([])
  })

  it('⚠️ 注入：判別真的分得出「有判定者」與「沒有」', () => {
    expect(judgeOf('generate', undefined), '🔴 沒寫也該吃預設').toBe('grammar')
    expect(judgeOf('generate', { generate: { judge: 'human' } }), '🔴 per-元件覆蓋該優先').toBe('human')
    expect(judgeOf('generate', { generate: { judge: null } }), '🔴 顯式寫 null 該是 null').toBe(null)
    expect(judgeOf('generate', { generate: { judge: 'wibble' } }), '🔴 閉集外的值不該被當成判定者').toBe('grammar')
  })

  it('棘輪：判定者宣稱覆蓋而沒有人量過的路，只准下降', () => {
    const { components, cells, naked, own } = scan()
    const byPath = new Map<string, number>()
    for (const c of cells) byPath.set(c.path, (byPath.get(c.path) ?? 0) + 1)
    const unmeasured = SIX_PATHS.filter((p) => PATH_JUDGE[p].kind !== null && PATH_JUDGE[p].coverage === null)
    printReport('判定者覆蓋率', [
      `分母   ${components} 顆｜格子 ${cells.length}（只算元件真的有的那一路）`,
      `逐路   ${[...byPath].map(([p, n]) => `${p} ${n}`).join('｜')}`,
      `judge == null   ${naked.length} 格`,
      `per-元件覆蓋    ${own.length} 格（其餘吃該路的預設）`,
      '',
      `🔴 判定者的覆蓋率【沒有人量過】的路：${unmeasured.length} / ${SIX_PATHS.length}   ${unmeasured.join('、')}`,
      ...SIX_PATHS.map((p) => {
        const c = PATH_JUDGE[p].coverage
        const pct = c ? `${c.covered} / ${c.of}（${Math.round(c.covered / c.of * 100)}%）` : '🔴 沒有人量過'
        return `   ${p.padEnd(10)} ${pct.padEnd(22)} ${PATH_JUDGE[p].judges.slice(0, 64)}`
      }),
      '',
      '⚠️ 本護欄不檢測那個判定者判得【對】不對——判錯的與對的在這裡長得一樣。',
      '⚠️ 也不檢測 evidence 那個檔真的在判那一路——它只驗檔案存在。那需要人讀。',
    ])

    if (!existsSync(path.join(REPO_ROOT, 'tests/baselines', `${GUARD}.json`))) {
      writeBaseline(GUARD, {
        _meta: {
          note: '第一刀只接【已經在跑】的四路 ＋ formalize。preconditions／invariants 的判定者刻意不碰'
            + '——那兩格要宣告，而宣告出來的欄位會說謊。',
          ratchet: 'naked 只准下降。分母（元件 × 路）走 assertCorpus，變大變小都要出聲。',
        },
        scanned: { components, cells: cells.length },
        naked: naked.length,
        unmeasuredPaths: unmeasured.length,
        byPath: Object.fromEntries(byPath),
      })
      return
    }
    const base = loadBaseline<{
      scanned: { components: number; cells: number }; naked: number; unmeasuredPaths: number
    }>(GUARD)
    assertCorpus([
      ['元件數', components, base.scanned.components],
      ['格子數', cells.length, base.scanned.cells],
    ])
    assertRatchet([
      ['沒有判定者的格子', naked.length, base.naked],
      ['判定者沒有人量過覆蓋率的路', unmeasured.length, base.unmeasuredPaths],
    ])
  })
})
