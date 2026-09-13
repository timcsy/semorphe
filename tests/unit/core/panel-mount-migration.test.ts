/**
 * **第一百二十五條護欄：面板的 `mount` 還在組裝點的那幾個，只准變少。**
 *
 * ## 🔴 它守的是一個【已經停住過一次】的搬遷
 *
 * spec 170 的 T001–T006 蓋好了面板登錄表（`panel-spec` ／ `panel-registry` ／
 * `load-panels`，262 行、有測試），**然後停住了**。而那個停住**看不見**：
 *
 * ```
 * src/panels 底下的宣告        0 份
 * loadPanels() 的產品呼叫者     0 個
 * README 引用的那支測試         不存在
 * ```
 *
 * 登錄表自己的測試檔頭逐字寫著：
 * 「**一個沒有人宣告的登記處【就是殼】，而它綠得跟真的一樣。**」
 *
 * 2026-09-13 把五份宣告寫了、把 `loadPanels()` 接上組裝點、
 * 讓「狀態」那一層的分頁真的去問登錄表。**而 `mount` 那一半還沒搬**
 * ——理由是 `app-shell.ts` 自己留下的那一句：
 *
 * > 那四格的**建構**與各自的相依糾纏在一起……先把**格子**收掉，建構留在原地
 * > ——**一次抽象如果同時搬走「容器」與「內容」，它壞掉時你分不出是哪一半。**
 *
 * 🟢 那個理由成立。⚠️ 而**沒有東西數著還剩幾個**的話，它會第二次停住。
 *
 * > **一個分階段的搬遷，如果沒有東西數著還剩幾個，它會停在第一階段。**
 *
 * ## 這一支不檢測什麼
 *
 * - **不檢測 `mount` 寫得對不對**——它只數還有幾個沒搬。
 * - **不強迫今天搬完**：硬性零今天會紅五筆，而一條每天都紅的護欄
 *   與一條沒有的護欄在第二天之後是同一個東西。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const PANELS = path.resolve(__dirname, '../../../src/panels')

function declarations(): { id: string; src: string }[] {
  return fs.readdirSync(PANELS)
    .filter((d) => fs.existsSync(path.join(PANELS, d, 'panel.ts')))
    .map((d) => ({ id: d, src: fs.readFileSync(path.join(PANELS, d, 'panel.ts'), 'utf8') }))
}

describe('第一百二十五條護欄：面板宣告的搬遷', () => {
  it('入口條件：`src/panels` 底下真的有宣告——一份都沒有就是那個殼', () => {
    const ds = declarations()
    expect(ds.length,
      '🔴 一份面板宣告都沒有——`load-panels.ts` 的 glob 會吃到空的，'
      + '而畫面正常、測試全綠。').toBeGreaterThanOrEqual(5)
  })

  it('★ 每一份都要 `export default`——少了它那個檔不會生效，而它不報錯', () => {
    for (const { id, src } of declarations()) {
      expect(src, `🔴 ${id}/panel.ts 沒有 export default`).toContain('export default')
    }
  })

  it('棘輪：`mount` 還在組裝點的只准變少（今天 5）', () => {
    const shell = declarations().filter((d) => d.src.includes('mountedByShell'))
    expect(shell.length,
      `🔴 比基線多——是不是新加了一個面板而沒有把 \`mount\` 寫進宣告？\n`
      + `   現在：${shell.map((d) => d.id).join('、')}`).toBeLessThanOrEqual(5)
    // ⚠️ 搬完一個要**下調這個數字**，不然基線會默許它退回去。
    expect(shell.length,
      '🟢 搬完了？把上面那個 5 與這一行的數字一起改小（顯式下調）。')
      .toBeGreaterThanOrEqual(shell.length)
  })

  it('★ 沒有 `mount` 的一定要說出來（`mountedByShell`）——不得靜靜地少一格', () => {
    for (const { id, src } of declarations()) {
      const hasMount = /\bmount\s*[:(]/.test(src)
      const declared = src.includes('mountedByShell')
      expect(hasMount || declared,
        `🔴 ${id}/panel.ts 既沒有 \`mount\` 也沒有 \`mountedByShell\`\n`
        + '   ——那一格會安靜地畫不出來。').toBe(true)
    }
  })
})
