/**
 * **第八十七條護欄**：每一份範例都載得起來、指向存在的目標、而且有程式碼。
 *
 * ## 它從哪來
 *
 * 2026-08-28 使用者：「如果沒有選擇課程時，要不要有選單去選擇 template？」
 * ＋「**這就很像是 ArduinoIDE 提供的那種範例**」。
 *
 * 那一格今天不是真的空——有一個**隱形的預設**在跑（目標的 `skeleton`
 * ＋ 一支空的 `int main()`）。
 *
 * > 🎯 **這一刀真正做的是：把一個隱形的預設變成一個看得見的選項。**
 *
 * ## 🔴 一個跑不動的範例，比沒有範例更糟
 *
 * 它是**內建的壞例子**——學生會假設官方附的東西是對的。
 * 所以「程式碼真的跑得動」那一半住在 `e2e/templates.spec.ts`（要開瀏覽器）；
 * 這裡守的是宣告那一半。
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果載到的範例少於 1 份，代表 glob 沒接上——這份報表不算數，
 * > 不是「範例都合格」。**
 *
 * 錨在**載到幾份**（合成量）。🔴 刻意不錨在「壞掉的份數」——那正是要推向零的。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測程式碼跑不跑得動**——那要真的解析，住在 e2e。
 * - **不檢測範例好不好**——只檢查它存在、指得到、有內容。
 */
import { describe, it, expect } from 'vitest'
import { printReport } from '../helpers/guardrail'
import { findFiles } from '../helpers/find-files'
import { allTemplates } from '../../src/core/load-templates'
import { parseTemplate } from '../../src/core/template'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const DIR = path.join(ROOT, 'templates')

describe('★ 第八十七條：範例是一份宣告 ＋ 一個真的程式檔', () => {
  const loaded = allTemplates()
  // 🔴 **母體從檔案系統數**——拿被測的東西當母體的話，「少載了一份」會安靜通過
  const onDisk = fs.existsSync(DIR)
    ? fs.readdirSync(DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .filter((d) => fs.existsSync(path.join(DIR, d.name, 'template.json')))
        .map((d) => d.name)
    : []
  const knownTargets = new Set(
    findFiles(path.join(ROOT, 'src/languages'), 'targets')
      .map((rel) => JSON.parse(fs.readFileSync(path.join(ROOT, 'src/languages', rel), 'utf8')).id as string))

  it('入口條件——glob 真的接上了', () => {
    printReport('範例', [
      `檔案系統上   ${onDisk.length} 份`,
      `載進來的     ${loaded.size} 份`,
      ...[...loaded.values()].map((t) =>
        `  ${(t.group ?? '(無組)').padEnd(6)} ${t.name.padEnd(14)} → ${t.target}　${t.code.split('\n').length} 行`),
    ])
    expect(loaded.size, '🔴 一份範例都沒載到 → glob 沒接上，這份報表不算數').toBeGreaterThanOrEqual(1)
    expect(knownTargets.size, '🔴 一個目標都沒讀到').toBeGreaterThanOrEqual(1)
  })

  it('硬性零——檔案系統上的每一份都載得起來', () => {
    expect(
      onDisk.filter((id) => !loaded.has(id)),
      '🔴 這些範例在檔案系統上而載不起來——選單上看不到它們：',
    ).toEqual([])
  })

  it('硬性零——每一份指向的目標都存在', () => {
    expect(
      [...loaded.values()].filter((t) => !knownTargets.has(t.target)).map((t) => `${t.id} → ${t.target}`),
      '🔴 選了它會切到一個不存在的目標：',
    ).toEqual([])
  })

  it('🔴 硬性零——每一份都有程式碼（空的範例不是範例）', () => {
    expect(
      [...loaded.values()].filter((t) => t.code.trim() === '').map((t) => t.id),
      '🔴 一份沒有程式碼的範例，套用之後與「什麼都沒做」分不出來：',
    ).toEqual([])
  })

  it('硬性零——同一組裡的 `order` 不得重複（重複＝順序其實是碰巧的）', () => {
    const dup: string[] = []
    const seen = new Map<string, string>()
    for (const t of loaded.values()) {
      const k = `${t.group ?? ''}#${t.order}`
      const prev = seen.get(k)
      if (prev) dup.push(`${prev} 與 ${t.id} 都是 ${t.group}/${t.order}`)
      seen.set(k, t.id)
    }
    expect(dup, '🔴 範例選單的順序是碰巧的：').toEqual([])
  })
})

describe('★ 注入——證明它會報，也證明它不亂報', () => {
  const OK = { name: 'ㄒ', target: 'ㄒ目標', order: 1 }

  it('★ 注入：正確的宣告 → 讀得出來', () => {
    expect(parseTemplate('t', OK, 'int main(){}').name).toBe('ㄒ')
  })

  it('🔴 ★ 注入：程式碼是空的 → 丟錯（不得回一份空範例）', () => {
    expect(() => parseTemplate('t', OK, '   \n  ')).toThrow(/空/)
  })

  it('★ 注入：缺 target → 丟錯', () => {
    expect(() => parseTemplate('t', { name: 'x' }, 'code')).toThrow(/target/)
  })

  it('★ 注入：缺 name → 丟錯', () => {
    expect(() => parseTemplate('t', { target: 'cpp' }, 'code')).toThrow(/name/)
  })
})
