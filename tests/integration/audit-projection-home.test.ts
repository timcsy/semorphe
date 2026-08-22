/**
 * 第五十四條護欄：**宣告的屬性，積木上有沒有一格裝它。**
 *
 * ## 為什麼有這一支（2026-08-23，開瀏覽器看出來的）
 *
 * 前一天剛替 Python 的函式收了型別註記（`def area(r: float) -> float`）——
 * 抬升收了、產生也產得回去、**5418 個測試全綠**。而在瀏覽器裡按一次
 * 「積木→程式碼」，出來的是：
 *
 * ```
 * def area(r):        ← 註記不見了
 * ```
 *
 * 因為**積木上沒有那一格**。語義樹裝得下、產生器印得出來，
 * 而投影到積木的那一步沒有地方放它，於是回程時它不在。
 *
 * > **一個屬性收得進語義樹，卻沒有一格積木裝它——那不是少一個欄位，
 * > 那是投影會掉東西。**
 *
 * ## 它是 #30／#34 的第三個方向
 *
 * ```
 * #30  lift 產出的**接點**，宣告裡有嗎        AST → 宣告
 * #34  lift 產出的**屬性**，宣告裡有嗎        AST → 宣告
 * #54  宣告的屬性與接點，**積木上有位置嗎**    宣告 → 積木   ← 本檔
 * ```
 *
 * 前兩條問的是「語義樹裝得下嗎」，這一條問的是「**投影裝得下嗎**」。
 * 而 P1（投影定理）說的是**每一個投影都要能回到同一棵樹**——
 * 少一格的症狀不是報錯，是**來回一趟之後少了東西，而產出的碼仍然合法**。
 *
 * ## ⚠️ 自我否證聲明（寫在量測之前）
 *
 * > **如果掃到的膠囊數低於 200，代表膠囊沒載入，這份報表不算數。**
 *
 * ## 這條護欄不檢測什麼
 *
 * - **不判定那一格【該不該】存在**——`obj` 固定成 `Serial` 是設計決定，
 *   而它要被說出來，不是被略過。
 * - **不看值對不對**——那是 `param-spec`。
 * - **不看語料**——它是靜態的：宣告與宣告比對。走具名策略的那些
 *   靜態掃不到，所以它們必須是**具名的判定**。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { printReport, assertRatchet, REPO_ROOT } from '../helpers/guardrail'

/** 判定的封閉詞彙——**刻意沒有「還沒想到」**。 */
type cause =
  | '該補一格'
  | '投影走具名策略，靜態掃不到'
  | '值由積木型別本身固定'
  | '排版提示，不給學生編輯'
  | '元概念，沒有積木'
  | '同一件事已經由接點裝著'
interface decision { key: string; cause: cause; reason: string }

const DECISION_FILE = 'tests/assets/projection-home-decisions.json'

interface gap { key: string; componentId: string; what: string }

/**
 * 偵測器——**與掃描分開**，因為分開才餵得進合成的假違規（第四十九條）。
 *
 * 輸入是一顆膠囊的宣告與它每一個形態的對映表，輸出是「沒有位置的那幾個」。
 */
export function gapsOf(
  c: { componentId: string; properties?: { name: string }[]; children?: Record<string, string> },
  forms: {
    renderMapping?: {
      fields?: Record<string, string>
      inputs?: Record<string, string>
      statementInputs?: Record<string, string>
      dynamicRules?: { childSlot?: string; countSource?: string }[]
      childrenAsField?: { childSlot?: string }[]
    }
  }[],
): gap[] {
  const homes = new Set<string>()
  for (const f of forms) {
    const rm = f.renderMapping ?? {}
    for (const v of Object.values(rm.fields ?? {})) homes.add(v)
    for (const v of Object.values(rm.inputs ?? {})) homes.add(v)
    for (const v of Object.values(rm.statementInputs ?? {})) homes.add(v)
    for (const r of rm.dynamicRules ?? []) {
      if (r.childSlot) homes.add(r.childSlot)
      // ⚠️ `countSource` 也是一個位置——那個屬性**驅動的是有幾格**
      //    （`ctorCount`／`paramCount`），使用者按 ＋／− 就是在改它。
      if (r.countSource) homes.add(r.countSource)
    }
    for (const r of rm.childrenAsField ?? []) if (r.childSlot) homes.add(r.childSlot)
  }
  const out: gap[] = []
  for (const p of c.properties ?? []) {
    if (!homes.has(p.name)) out.push({ key: `${c.componentId}.${p.name}`, componentId: c.componentId, what: `屬性 ${p.name}` })
  }
  for (const k of Object.keys(c.children ?? {})) {
    if (!homes.has(k)) out.push({ key: `${c.componentId}:${k}`, componentId: c.componentId, what: `接點 ${k}` })
  }
  return out
}

function scanCapsules(): { total: number; gaps: gap[] } {
  const caps: string[] = []
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name === 'component.json') caps.push(p)
    }
  }
  walk(path.join(REPO_ROOT, 'src/components'))

  const gaps: gap[] = []
  for (const cp of caps) {
    const c = JSON.parse(fs.readFileSync(cp, 'utf8')) as {
      componentId: string
      properties?: { name: string }[]
      children?: Record<string, string>
      paths?: { render?: string | null }
    }
    const render = c.paths?.render
    if (!render) continue
    const bp = path.join(path.dirname(cp), render)
    if (!fs.existsSync(bp)) continue
    const forms = JSON.parse(fs.readFileSync(bp, 'utf8')) as Parameters<typeof gapsOf>[1]
    gaps.push(...gapsOf(c, forms))
  }
  return { total: caps.length, gaps }
}

describe('第五十四條護欄：宣告的屬性，積木上有沒有一格裝它', () => {
  const { total, gaps } = scanCapsules()
  const decisions = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, DECISION_FILE), 'utf8'),
  ) as decision[]
  const byKey = new Map(decisions.map((d) => [d.key, d]))

  it('★ 錨點：膠囊真的掃到了（低於 200 代表沒載入，報表不算數）', () => {
    expect(total).toBeGreaterThan(200)
  })

  it('🔴 硬性零：每一個沒位置的宣告都要有【判定】，不得是「沒想到」', () => {
    const unjudged = gaps.filter((g) => !byKey.has(g.key))
    const orphan = decisions.filter((d) => !gaps.some((g) => g.key === d.key))
    const noReason = decisions.filter((d) => !d.reason || d.reason.length < 6)
    const count = (c: cause): number => gaps.filter((g) => byKey.get(g.key)?.cause === c).length

    printReport('宣告的屬性與接點，積木上有沒有位置', [
      `膠囊 ${total}｜沒位置的宣告 ${gaps.length}`,
      '',
      `  🔴 該補一格            ${count('該補一格')}  ← 棘輪盯這一欄（**真的會掉東西**）`,
      `  投影走具名策略        ${count('投影走具名策略，靜態掃不到')}   靜態掃不到，由那顆的 spec.test.ts 釘住`,
      `  值由積木型別本身固定  ${count('值由積木型別本身固定')}   使用者不必改，也改不動`,
      `  排版提示，不給學生編輯 ${count('排版提示，不給學生編輯')}   記的是原文長什麼樣`,
      `  元概念，沒有積木      ${count('元概念，沒有積木')}   `,
      `  已由接點裝著          ${count('同一件事已經由接點裝著')}   屬性是接點的投影，不是第二份真相`,
      `  ⚠️ 還沒判定           ${unjudged.length}  ← 硬性零`,
      ...unjudged.map((g) => `     ✘ ${g.componentId}｜${g.what}`),
      '',
      '⚠️ 「該補一格」與「值由積木型別本身固定」讀起來都是零風險，',
      '   而前者**每一次來回都在掉東西**。',
    ])

    expect(noReason.map((d) => d.key), '沒有理由的判定是把「懶得看」寫成「看過了」').toEqual([])
    expect(orphan.map((d) => d.key), '判定過期了——那一格已經有位置了，這一筆該退場').toEqual([])
    expect(
      unjudged.map((g) => `${g.componentId}｜${g.what}`),
      '沒位置的宣告必須是【判過的】，不是【沒想到的】',
    ).toEqual([])
  })

  // ─────────────────────────────────────────────────────────
  // ★ 注入——**證明這個偵測器認得出違規**（第四十九條）
  // ─────────────────────────────────────────────────────────
  it('★ 注入①：一個沒有位置的屬性【必須】被抓到', () => {
    const found = gapsOf(
      { componentId: 'fake:one', properties: [{ name: 'lost' }] },
      [{ renderMapping: { fields: { NAME: 'name' } } }],
    )
    expect(found.map((g) => g.key)).toEqual(['fake:one.lost'])
  })

  it('★ 注入②：有位置的不得被誤報——五種機制都算', () => {
    const found = gapsOf(
      {
        componentId: 'fake:two',
        properties: [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'n' }],
        children: { body: 'statements', args: 'expression', params: 'param_decl' },
      },
      [{
        renderMapping: {
          fields: { A: 'a' },
          inputs: { B: 'b', ARGS: 'args' },
          statementInputs: { BODY: 'body' },
          dynamicRules: [{ childSlot: 'c', countSource: 'n' }],
          childrenAsField: [{ childSlot: 'params' }],
        },
      }],
    )
    expect(found.map((g) => g.key)).toEqual([])
  })

  it('★ 注入③：一顆元件有好幾種形態時，**任何一種**有位置就算有', () => {
    const found = gapsOf(
      { componentId: 'fake:three', properties: [{ name: 'kind' }] },
      [{ renderMapping: { fields: {} } }, { renderMapping: { fields: { KIND: 'kind' } } }],
    )
    expect(found.map((g) => g.key)).toEqual([])
  })

  it('棘輪：「該補一格」只准下降', () => {
    const real = gaps.filter((g) => byKey.get(g.key)?.cause === '該補一格')
    assertRatchet([['🔴 該補一格', real.length]], 'projection-home', {
      detail: real.map((g) => `${g.componentId}｜${g.what}`),
    })
  })
})
