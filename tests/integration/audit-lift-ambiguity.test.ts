/**
 * 辨識歧義護欄（第五條）
 *
 * 量：有多少辨識規則在搶同一種語法，而勝負只由**登記先後**決定。
 *
 * 這是 P3「新增 pattern 不得改變既有 pattern 的匹配結果——**歧義在註冊時
 * 仲裁，不在執行時碰運氣**」的執行機構。那條原則寫在 principles.md，
 * 但在本護欄之前**沒有任何測試在檢查它**。
 *
 * ## 與前四條護欄的關鍵差異
 *
 * **前四條量「有多少東西壞了」，這一條量「有多少東西靠運氣」。**
 *
 * 靠運氣的東西**現在可能是對的**——登記順序碰巧給出正確結果的不在少數
 * （否則專案早就不能用了）。所以這條的數字下降**不代表修好了 bug**，
 * 而代表**移除了一個未來會咬人的機會**。
 *
 * 見 specs/051-lift-claim-arbitration/
 */
import { describe, it, expect } from 'vitest'
import {
  loadBaseline,
  writeBaseline,
  printReport,
  RATCHET_NOTE,
  type BaselineMeta,
  assertRatchet,
} from '../helpers/guardrail'
import { classifyPair, type RuleLike, type PairVerdict } from '../helpers/discriminator'
import { createTestLifter } from '../helpers/setup-lifter'

const RULE =
  '從實際載入後的規則表量測。判定保守：只有能證明互斥才判「不會撞」，判不出來一律「無法確定」。'

/** 護欄的失效樣態——照 concepts/執行機構.md 的要求 */
const SELF_FALSIFICATION =
  '⚠️ 這條護欄的健康檢查是下面那兩支「★ 合成注入」，**不是報表上的數字**。' +
  '「確定會撞 0」與「判定邏輯整個沒接上」產出完全一樣——注入測試是唯一分得出來的東西。'

const NOT_DETECTED =
  '本護欄**不檢測**：跨語法節點的間接競爭（規則 A 讓某節點降級、使規則 B 在父節點上改變行為）、' +
  '手寫辨識層（實測零覆蓋）、執行期才成立的條件。'

interface AmbiguityBaseline {
  _meta: BaselineMeta
  samePriorityGroups: number
  definitelyCollide: number
  unknown: number
  duplicateRegistrations: number
  groups: { nodeType: string; priority: number; rules: string[] }[]
}

interface Group {
  nodeType: string
  priority: number
  rules: RuleLike[]
  winner: string
  winReason: 'priority' | 'insertion-order'
}

/** 從測試載入路徑取得載入後的規則表（不動生產程式碼——FR-030） */
function loadRules(): Map<string, RuleLike[]> {
  const lifter = createTestLifter() as unknown as { patternLifter: { patterns: Map<string, RuleLike[]> } }
  return lifter.patternLifter.patterns
}

function measure(): {
  groups: Group[]
  pairs: PairVerdict[]
  duplicates: { nodeType: string; conceptId: string; priorities: number[] }[]
  crossPriorityCollisions: PairVerdict[]
} {
  const patterns = loadRules()
  const groups: Group[] = []
  const pairs: PairVerdict[] = []
  const duplicates: { nodeType: string; conceptId: string; priorities: number[] }[] = []
  const crossPriorityCollisions: PairVerdict[] = []

  for (const [nodeType, list] of patterns) {
    // ── 同優先權群組（代理指標）
    const byPri = new Map<number, RuleLike[]>()
    for (const r of list) {
      const arr = byPri.get(r.priority) ?? []
      arr.push(r)
      byPri.set(r.priority, arr)
    }
    for (const [priority, rules] of byPri) {
      if (rules.length < 2) continue
      // list 已依 priority 降冪排序；同優先權時，先出現的先被試到
      const winner = rules[0].conceptId
      // 同優先權 → 勝出純粹靠登記先後，不是設計
      groups.push({ nodeType, priority, rules, winner, winReason: 'insertion-order' })
      for (let i = 0; i < rules.length; i++) {
        for (let j = i + 1; j < rules.length; j++) pairs.push(classifyPair(rules[i], rules[j]))
      }
    }

    // ── 重複登記：同一概念在同一語法上出現一次以上
    const byConcept = new Map<string, number[]>()
    for (const r of list) {
      const arr = byConcept.get(r.conceptId) ?? []
      arr.push(r.priority)
      byConcept.set(r.conceptId, arr)
    }
    for (const [conceptId, priorities] of byConcept) {
      if (priorities.length > 1) duplicates.push({ nodeType, conceptId, priorities: priorities.sort() })
    }

    // ── 不同優先權卻可能會撞：優先權在做「隱形仲裁」——比同優先權更危險
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (list[i].priority === list[j].priority) continue
        if (list[i].conceptId === list[j].conceptId) continue // 重複登記另外算
        const v = classifyPair(list[i], list[j])
        if (v.verdict === 'definitely') crossPriorityCollisions.push(v)
      }
    }
  }
  return { groups, pairs, duplicates, crossPriorityCollisions }
}

const { groups, pairs, duplicates, crossPriorityCollisions } = measure()
const definitely = pairs.filter((p) => p.verdict === 'definitely')
const never = pairs.filter((p) => p.verdict === 'never')
const unknown = pairs.filter((p) => p.verdict === 'unknown')

describe('護欄：辨識歧義（誰認領這段語法，是設計還是運氣）', () => {
  it('產出可讀報表：群組、勝出者、勝出原因', () => {
    const lines: string[] = []
    lines.push(SELF_FALSIFICATION)
    lines.push(NOT_DETECTED)
    lines.push('')
    lines.push(`判定規則：${RULE}`)
    lines.push('')
    lines.push('**這條護欄量的是「有多少東西靠運氣」，不是「有多少東西壞了」。**')
    lines.push('靠運氣的東西現在可能是對的——數字下降不代表修好 bug，')
    lines.push('而代表**移除了一個未來會咬人的機會**。')
    lines.push('')
    lines.push(
      `同優先權群組：${groups.length}｜規則對：${pairs.length}` +
        `（🔴 確定會撞 ${definitely.length}｜🟢 不會撞 ${never.length}｜🟡 無法確定 ${unknown.length}）`,
    )
    lines.push('')

    for (const g of [...groups].sort((a, b) => b.rules.length - a.rules.length)) {
      const own = pairs.filter((p) => g.rules.some((r) => r.conceptId === p.a) && g.rules.some((r) => r.conceptId === p.b))
      const d = own.filter((p) => p.verdict === 'definitely').length
      const u = own.filter((p) => p.verdict === 'unknown').length
      lines.push(
        `  ${g.nodeType} @優先權=${g.priority}：${g.rules.length} 條` +
          `（🔴${d} 🟡${u}）→ 目前勝出：${g.winner}` +
          `（原因：${g.winReason === 'priority' ? '優先權較高' : '**只是登記得早**'}）`,
      )
      lines.push(`      ${g.rules.map((r) => r.conceptId).join(', ')}`)
    }

    if (duplicates.length > 0) {
      lines.push('')
      lines.push('**重複登記**（同一概念在同一語法上登記多次——不是優先權設計，是意外）：')
      for (const d of duplicates) lines.push(`  ${d.nodeType}: ${d.conceptId} @優先權 ${d.priorities.join(', ')}`)
    }

    // 差集：兩個方向都是資訊
    const groupsAllSafe = groups.filter((g) => {
      const own = pairs.filter((p) => g.rules.some((r) => r.conceptId === p.a) && g.rules.some((r) => r.conceptId === p.b))
      return own.length > 0 && own.every((p) => p.verdict === 'never')
    })
    lines.push('')
    lines.push('差集（兩個方向都是資訊）：')
    lines.push(`  同優先權但全部不會撞：${groupsAllSafe.length} 組 ← **優先權設了沒有區分作用**`)
    lines.push(
      `  不同優先權卻確定會撞：${crossPriorityCollisions.length} 對 ← **優先權在做隱形仲裁，比同優先權更危險**` +
        `（它看起來像設計）`,
    )
    if (unknown.length > 0) {
      lines.push('')
      lines.push(`🟡 無法確定 ${unknown.length} 對——**它不算安全**。判不出來就說判不出來，不猜。`)
      for (const p of unknown.slice(0, 8)) lines.push(`    ${p.a} vs ${p.b}：${p.reason}`)
      if (unknown.length > 8) lines.push(`    … 另外 ${unknown.length - 8} 對`)
    }

    printReport('辨識歧義護欄', lines)
    expect(groups.length).toBeGreaterThanOrEqual(0)
  })

  it('★ 掃描規模不為零——錨在**輸入**上，不錨在缺陷上', () => {
    // ⚠️ 這一支原本是 `expect(groups.length).toBeGreaterThan(0)`
    // ——**而 `groups.length` 正是這條護欄想推向零的那個數字**。
    //
    // 諷刺的是：它下面三行就在解釋這個教訓（兩支錨在真實狀態上的自我否證
    // 已經被改過），而這一支帶著同樣的反模式活了下來。
    //
    // **判準**：斷言的那個數字，是不是這條護欄想推向零的？
    // 是 → 錨錯了，它會在成功的那天變紅。
    // 錨在**規則載入了幾條**上——那個數字不會因為修好而歸零。
    const 規則總數 = [...loadRules().values()].reduce((n, l) => n + l.length, 0)
    // ⚠️ 門檻從 20 降到 10（2026-08-11）：**規則從共用檔搬進膠囊之後，
    // 這裡數到的是「共用檔還剩幾條」**——那個數字隨 F 下降。
    // `createTestLifter` 已經載入膠囊的 pattern，所以總數是對的；
    // 而門檻本身仍然是「有沒有載到東西」的錨，不是缺陷計數。
    expect(規則總數, '一條辨識規則都沒載入 → 報表上的每個數字都是假的').toBeGreaterThan(10)
  })

  // 這兩支原本錨在 `declaration` 那一群的真實狀態上（「8 條同時盯著宣告語法，
  // 沒被判為確定會撞就代表護欄壞了」）。那群後來被修好了，於是那句自我否證
  // 變成「叫未來的讀者不要相信一個正確的結果」——比沒有聲明更糟。
  //
  // **build-guardrail 第 2 步明文警告過這件事，而這是它第二次發生。**
  // 錨點改成合成規則：它不隨真實世界的修復而失效。
  const 合成 = (conceptId: string, constraints?: RuleLike['constraints']): RuleLike => ({
    conceptId, patternType: 'simple', priority: 10, constraints,
  })

  it('★ 合成注入：兩條約束一字不差的規則必須判「確定會撞」', () => {
    const 同約束 = [{ field: 'type', nodeType: 'template_type' }]
    const v = classifyPair(合成('__probe_a__', 同約束), 合成('__probe_b__', [...同約束]))
    expect(
      v.verdict,
      `約束完全相同卻沒被判為確定會撞 → 判定邏輯壞了，報表上的「0」一律不可信。理由：${v.reason}`,
    ).toBe('definitely')
  })

  it('★ 合成注入：判別式互斥的兩條不得被誤判為會撞', () => {
    const v = classifyPair(
      合成('__probe_c__', [{ field: 'type', text: 'string' }]),
      合成('__probe_d__', [{ field: 'type', text: 'vector' }]),
    )
    expect(
      v.verdict,
      `同一欄位要求不同的字面值，兩者不可能同時成立。誤判成會撞的話，' +
        '一個「什麼都報」的掃描器也能通過上一支。理由：${v.reason}`,
    ).toBe('never')
  })

  it('★ 不誤報最常用的那一對：`print` vs `input` 必須判「不會撞」', () => {
    const pair = pairs.find(
      (p) => (p.a === 'cpp:print' && p.b === 'cpp:input') || (p.a === 'cpp:input' && p.b === 'cpp:print'),
    )
    if (!pair) return // 它們若不同優先權就不在同優先權群組裡，不算問題
    expect(
      pair.verdict,
      `誤報這一對會讓維護者立刻學會忽略整個護欄。判定理由：${pair.reason}`,
    ).toBe('never')
  })

  it('棘輪：四個數字皆不得上升', () => {
    const b = loadBaseline<AmbiguityBaseline>('lift-ambiguity')
    const rows: [string, number, number][] = [
      ['同優先權群組', groups.length, b.samePriorityGroups],
      ['確定會撞', definitely.length, b.definitelyCollide],
      ['無法確定', unknown.length, b.unknown],
      ['重複登記', duplicates.length, b.duplicateRegistrations],
    ]
    const worsened = rows.filter(([, now, base]) => now > base)
    const improved = rows.filter(([, now, base]) => now < base)

    if (improved.length > 0) {
      printReport('辨識歧義：有改善，可下調基線', improved.map(([n, now, base]) => `  ✔ ${n}: ${base} → ${now}`))
    }
    if (worsened.length > 0) {
      const newGroups = groups.filter(
        (g) => !b.groups.some((x) => x.nodeType === g.nodeType && x.priority === g.priority),
      )
      printReport('辨識歧義：數字上升', [
        ...worsened.map(([n, now, base]) => `  ✘ ${n}: ${base} → ${now}`),
        ...newGroups.map((g) => `  ✘ 新群組：${g.nodeType} @優先權=${g.priority} → ${g.rules.map((r) => r.conceptId).join(', ')}`),
      ])
    }
    // 只擋上升的棘輪不會自己收緊——舊基線會默許退回去，而**綠色套件的輸出
    // 沒有人會讀**，所以「有改善」只印一行報表等於沒有發生。改善必須讓測試
    // 變紅，逼基線與改善一起 commit。
    assertRatchet(rows)
  })
})

/** 產生基線：`GENERATE_BASELINE=1 npx vitest run tests/integration/audit-lift-ambiguity.test.ts` */
if (process.env.GENERATE_BASELINE) {
  writeBaseline('lift-ambiguity', {
    _meta: {
      guard: 'lift-ambiguity',
      measuredAt: new Date().toISOString().slice(0, 10),
      rule: RULE,
      note: RATCHET_NOTE + ' ' + SELF_FALSIFICATION,
    },
    samePriorityGroups: groups.length,
    definitelyCollide: definitely.length,
    unknown: unknown.length,
    duplicateRegistrations: duplicates.length,
    groups: groups.map((g) => ({
      nodeType: g.nodeType,
      priority: g.priority,
      rules: g.rules.map((r) => r.conceptId),
    })),
  })
}
