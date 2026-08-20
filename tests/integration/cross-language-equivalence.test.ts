/**
 * spec 156：**在觀察集 O 底下，哪些概念落在同一類——而第一個分歧點在哪。**
 *
 * ## 🔴 這一支【不是】「Python 能跑」的測試
 *
 * `vision` 階段 7 的目的（2026-08-20 人拍板改寫）逐字：
 *
 * > **拿第二個語言去【產生等價的證據】**，順便量出**鄰域半徑在哪裡失效**。
 *
 * 而舊的問法（「`layer: universal` 對不對」）**本身不成立**：
 * 通解是**算子**的性質不是**解**的性質，「某個東西是不是通用的」
 * 在固定觀察集之前是**不良定義的**（`draft/通解與特解和小世界模型`）。
 *
 * ## 等價的機制不是為這一刀發明的
 *
 * `toolbox-builder.ts:118` 逐字：
 *
 * > 「第四版問的是那條**等價邊**本身：`cpp:print` 與 `cpp:print_formatted`
 * > 宣告了同一個 `ioRole`（＝同一個等價類）與不同的 `ioStyle`（＝哪個成員）。」
 *
 * 🟢 所以觀察集取 `{ioRole}`——它已經是**生產路徑在用**的等價關係。
 *
 * ## ⚠️ 這一支量得到什麼、量不到什麼
 *
 * ```
 * 量得到   在【宣告的性狀】這個觀察集下，誰跟誰同類
 * 量不到   它們是不是【真的】做同一件事——那要行為證據，而 Python 還沒有執行期
 * ```
 *
 * > **一條等價邊是一份【主張】，而觀察集決定那份主張有多強。**
 */
import { describe, it, expect } from 'vitest'
import { allComponentDefs } from '../helpers/component-scan'
import { printReport } from '../helpers/guardrail'

/** 觀察集：這一刀只取一維。**先有一條邊，再談半徑。** */
const OBSERVATION_SET = ['ioRole'] as const

interface Member { componentId: string; scope: string }

/** 依觀察集把概念分群——鍵是「在這個觀察集下看起來的樣子」。 */
function classes(): Map<string, Member[]> {
  const out = new Map<string, Member[]>()
  for (const def of allComponentDefs()) {
    const traits = ((def as unknown as { traits?: Record<string, unknown> }).traits) ?? {}
    const key = OBSERVATION_SET.map((d) => traits[d]).join('｜')
    if (OBSERVATION_SET.every((d) => traits[d] === undefined)) continue  // 這個觀察集看不到它
    const scope = def.componentId.slice(0, def.componentId.indexOf(':'))
    const arr = out.get(key) ?? []
    arr.push({ componentId: def.componentId, scope })
    out.set(key, arr)
  }
  return out
}

describe('spec 156 · 等價類（觀察集 = {ioRole}）', () => {
  const cls = classes()

  it('★ 錨點：觀察集下真的看得到東西（否則下面在比空集合）', () => {
    expect(cls.size, '一個等價類都沒有 → 是 traits 讀不到，不是沒有等價').toBeGreaterThan(0)
    const total = [...cls.values()].reduce((n, m) => n + m.length, 0)
    expect(total, '成員數為零').toBeGreaterThan(2)
  })

  it('🔴 至少一類【同時含 cpp 與 python 的成員】——這是第一條跨語言的等價邊', () => {
    const crossing = [...cls.entries()].filter(([, ms]) => new Set(ms.map((m) => m.scope)).size > 1)
    printReport('等價類（觀察集 = {ioRole}）', [
      ...[...cls.entries()].sort().map(([k, ms]) => {
        const scopes = [...new Set(ms.map((m) => m.scope))].sort()
        const mark = scopes.length > 1 ? '🟢 跨語言' : `⚠️ 只有 ${scopes[0]}`
        return `  ${mark}  ioRole=${k}：${ms.map((m) => m.componentId).sort().join('、')}`
      }),
      '',
      `跨語言的類：${crossing.length}｜單語言的類：${cls.size - crossing.length}`,
    ])
    expect(crossing.map(([k]) => k), 'ioRole 的每一類都只有單一語言 → 還沒有任何跨語言的等價證據')
      .not.toEqual([])
  })

  it('🔴 第一個【不】落在同一類的地方，是一個位置', () => {
    // 判準：在這個觀察集下，**只有單邊成員**的類就是分歧點的候選。
    const singles = [...cls.entries()]
      .filter(([, ms]) => new Set(ms.map((m) => m.scope)).size === 1)
      .map(([k, ms]) => ({ key: k, scope: ms[0].scope, members: ms.map((m) => m.componentId).sort() }))
      .sort((a, b) => a.key.localeCompare(b.key))

    printReport('第一個分歧點（觀察集 = {ioRole}）', [
      singles.length === 0
        ? '  （沒有單語言的類——在這個觀察集下兩個語言完全對齊）'
        : `  🔴 ${singles[0].key}：只有 ${singles[0].scope}（${singles[0].members.join('、')}）`,
      '',
      '⚠️ **而「只有單邊」不等於「不可能等價」**——它可能只是',
      '   **另一個語言的那顆還沒被建出來**。這個觀察集分不出這兩件事，',
      '   而分得出來需要**行為**證據（Python 的執行期，spec 156 明確排除）。',
      '',
      '> **鄰域的邊界要用行為量，而宣告只量得到【我們說它們一樣】。**',
    ])
    // 🟢 這一條不是紅燈——它是**把分歧點寫成一個位置**，而位置本身要存在
    expect(singles.length + [...cls.values()].length, '報表沒有內容').toBeGreaterThan(0)
  })
})
