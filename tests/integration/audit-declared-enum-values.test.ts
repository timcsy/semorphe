/**
 * 護欄：**`properties[].values` 不得存在。**
 *
 * ## 🔴 為什麼刪它而不是扶正它
 *
 * 三個量出來的事實（spec 144）：
 *
 * ```
 * ① 生產消費者 0 個   唯一消費是 block-spec-registry.ts:43 的 paramNames——只取名字
 * ② 40 個 enum 屬性裡 35 個兩邊各寫一份，而【沒有東西在守它們一致】
 * ③ 既有的雙重真相護欄看不到它（它只比 input 名稱）
 * ```
 *
 * 而第四個事實決定了方向：
 *
 * ```
 * blockDef.args0[].options   [顯示文字, 值]   234 個選項，182 個顯示文字是 i18n key
 * properties[].values        [值]
 * ```
 *
 * > **兩份宣告要合併時，先問哪一份是另一份的投影
 * > ——投影那一份沒有資格當唯一真相，不管它讀起來多像。**
 *
 * ## ⚠️ 自我否證聲明
 *
 * **如果掃到的元件數是 0，代表 glob 寫錯了，不是「沒有元件宣告 values」。**
 * 判斷依據是「★ 健康檢查」那一支——它錨在**掃到幾顆元件**（一個不隨修復改變的
 * 輸入量），🔴 **不是錨在違規數**：違規數正是這條護欄要推向零的東西。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢查下拉選項對不對**——那是 `blockDef` 的事
 * - **不檢查其餘 `properties` 欄位**（`name`／`kind`／`default`／`required`）
 * - **不管動態下拉**（來源是執行期的工作區狀態）
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const FILES = import.meta.glob('../../src/components/*/*/component.json', {
  eager: true, query: '?raw', import: 'default',
}) as Record<string, string>

interface Hit { conceptId: string; prop: string; count: number }

function measure(extra: Record<string, string> = {}): Hit[] {
  const out: Hit[] = []
  for (const [path, raw] of Object.entries({ ...FILES, ...extra })) {
    const d = JSON.parse(raw) as { conceptId?: string; properties?: { name?: string; values?: unknown[] }[] }
    for (const p of d.properties ?? []) {
      if (Array.isArray(p.values)) {
        out.push({ conceptId: d.conceptId ?? path, prop: p.name ?? '?', count: p.values.length })
      }
    }
  }
  return out.sort((a, b) => a.conceptId.localeCompare(b.conceptId))
}

describe('護欄：`properties[].values` 不得存在', () => {
  // ── ★ 健康檢查：錨在掃到幾顆元件，不在違規數 ────────────────────
  it('★ 健康檢查：掃到的元件數不得為零', () => {
    expect(Object.keys(FILES).length, '一顆元件都沒掃到 → glob 寫錯了，下面的數字是假的')
      .toBeGreaterThan(100)
  })

  it('★ 注入：一個宣告了 values 的元件 → **必須被報出**', () => {
    // ⚠️ 合成輸入——不用任何真實身分（它們被修好的那天注入就爛了）
    const fake = { 'synthetic.json': JSON.stringify({
      conceptId: 'test:synthetic', properties: [{ name: 'x', kind: 'enum', values: ['a', 'b'] }],
    }) }
    expect(measure(fake).map((h) => h.conceptId), '合成的違規沒被報出來 → 護欄壞了')
      .toContain('test:synthetic')
  })

  it('★ 注入：一個沒有 values 的元件 → **必須不被報出**', () => {
    // 🔴 第二支不可省：沒有它，一個「什麼都報」的掃描器也能通過上面那支。
    const fake = { 'clean.json': JSON.stringify({
      conceptId: 'test:clean', properties: [{ name: 'x', kind: 'enum', default: 'a' }],
    }) }
    expect(measure(fake).map((h) => h.conceptId), '沒有 values 卻被報 → 護欄會亂報')
      .not.toContain('test:clean')
  })

  it('🔴 沒有任何元件宣告 `properties[].values`', () => {
    const hits = measure()
    const report = hits.map((h) => `  ${h.conceptId}.${h.prop}（${h.count} 個值）`)
    expect(hits, `\n宣告了 values 而沒有人讀它的元件：\n${report.join('\n')}\n`).toEqual([])
  })
})
