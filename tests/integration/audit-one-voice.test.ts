/**
 * **護欄：同一種錯誤只有一種說法**（錯誤訊息第三步，2026-11-05）
 *
 * 寫程式時的標示（`DIAG_CELLA_<種類>_BLOCK`，積木那一側）與執行停下（`RUNTIME_ERR_<種類>`）原本是兩份文案：
 * 中文五種剛好一致而沒有東西擋著；英文全部不一致（"This divides by zero" ／ "division by zero"）；
 * 「越過結尾」「板子上沒有的腳」執行時有專屬的說法、寫程式時卻落到通用那一句。學生會以為是兩件事。
 *
 * 規則：執行停下的那一句 ＝ 前綴 ＋ 積木側的說法（英文開頭轉小寫）＋ 出處。兩份都留在翻譯表裡（很多地方直接讀 JSON 原檔），
 * 由這支擋住它們分岔。對照表從產品自己的兩張表導出（`UB_KEY`、`KIND_RULES`），不在這裡手抄。
 */
import { describe, it, expect } from 'vitest'
import zhTW from '../../src/i18n/zh-TW/blocks.json'
import en from '../../src/i18n/en/blocks.json'
import { UB_KEY } from '../../src/providers/cella/stop-of-verdict'
import { KIND_RULES } from '../../src/core/verdict-diagnostics'

const LOCALES: Record<string, { table: Record<string, string>; prefix: string; wrap: (p: string) => string; lower: boolean }> = {
  'zh-TW': { table: zhTW as Record<string, string>, prefix: '停在這裡：', wrap: (p) => `（{${p}}）`, lower: false },
  en: { table: en as Record<string, string>, prefix: 'Stopped here: ', wrap: (p) => ` ({${p}})`, lower: true },
}

/** 種類 → [執行停下的鍵, 判決的規則, 出處的參數名] */
export function pairs(): [string, string, string, string][] {
  const out: [string, string, string, string][] = []
  for (const [kind, rtKey] of Object.entries(UB_KEY)) {
    const rule = KIND_RULES[kind]?.rule
    out.push([kind, rtKey, rule ?? '（沒有規則）', kind === 'ubPin' ? 'pre' : 'clause'])
  }
  out.push(['unspecified', 'RUNTIME_ERR_UNSPECIFIED_BEHAVIOR', 'CELLA_UNSPECIFIED', 'clause'])
  return out
}

export function expected(blockText: string, loc: (typeof LOCALES)[string], param: string): string {
  const body = loc.lower ? blockText.charAt(0).toLowerCase() + blockText.slice(1) : blockText
  return `${loc.prefix}${body}${loc.wrap(param)}`
}

describe('護欄：同一種錯誤只有一種說法', () => {
  it('入口條件：對照表從產品的兩張表導出，至少七種', () => {
    expect(pairs().length).toBeGreaterThanOrEqual(7)
  })

  it('🔴 硬性零：執行停下的說法 ＝「停在這裡：」＋ 寫程式時積木側的說法 ＋ 出處', () => {
    const bad: string[] = []
    for (const [name, loc] of Object.entries(LOCALES)) {
      for (const [kind, rtKey, rule, param] of pairs()) {
        const block = loc.table[`DIAG_${rule}_BLOCK`]
        if (!block) { bad.push(`${name} ${kind}：寫程式時沒有專屬的說法（DIAG_${rule}_BLOCK）——執行時卻有`); continue }
        const want = expected(block, loc, param)
        if (loc.table[rtKey] !== want) bad.push(`${name} ${kind}：\n    執行停下  ${loc.table[rtKey]}\n    應該是    ${want}`)
      }
    }
    expect(bad, '🔴 同一種錯誤兩套說法——改積木側那一句，執行停下照規則跟著').toEqual([])
  })

  it('★ 注入：說法分岔一定抓得到', () => {
    const loc = { ...LOCALES['zh-TW'] }
    expect(expected('除以零了', loc, 'clause')).toBe('停在這裡：除以零了（{clause}）')
    expect(expected('This divides by zero', LOCALES.en, 'clause')).toBe('Stopped here: this divides by zero ({clause})')
    expect(expected('除以零了', loc, 'clause')).not.toBe('停在這裡：除以零（{clause}）')
  })
})
