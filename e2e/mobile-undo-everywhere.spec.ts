/**
 * **第九十二條護欄**：手機上每一個視圖都按得到「還原」。
 *
 * ## 它從哪來
 *
 * 使用者 2026-08-31：「手機沒有每個視圖都顯示還原按鈕」。實測：
 *
 * ```
 * 程式碼分頁  ↩↪ 0x0      ← 看不到
 * 積木分頁    ↩↪ 27x22    ✅
 * 流程分頁    ↩↪ 0x0      ← 看不到
 * ```
 *
 * 原因：`switchToMobile` 把**整條快速列**搬進 `mobileBlocksContainer`，
 * 而 ↩↪ 是它的一員。
 *
 * > **一顆全域的按鈕，住在一個會被分頁藏起來的容器裡，
 * > 就只是那個分頁的按鈕。**
 *
 * ## 🔴 而「在別的分頁再放一對」是錯的解法
 *
 * 使用者 2026-08-30 才要求把**三對**還原鈕合併成一對（程式碼工具列／
 * 快速列／流程工具列各一對，而它們會各自還原各自的東西）。所以這支
 * **同時釘住兩個方向**：
 *
 * ```
 * ① 每個分頁都看得到     ← 這一次要修的
 * ② 而全畫面【只有一對】  ← 上一次修的，不准被這一次撞掉
 * ```
 *
 * 少了 ②，「每個分頁各放一對」會讓 ① 變綠，而那正是上一刀刪掉的東西。
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果分頁列上的分頁數少於 3，代表行動版版面沒有生效，這份結果不算數
 * > ——不是「每個視圖都有還原鈕」。**
 *
 * 錨在**分頁數**（合成量：`mobile-tab-bar` 宣告了幾個分頁）。它不會因為
 * 這個缺陷被修好而變動。🔴 **刻意不錨在「看不到的分頁數」**——那是要推向零的。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測按下去還原了什麼**——`undo-one-pair.spec.ts` 管那個
 * - **不檢測桌面版的位置**（下面第二支管「切回去有沒有放回原位」）
 * - ⚠️ **不檢測沒有標頭的宿主**（VSCode 面板）：那時 ↩↪ 留在快速列裡是對的
 */
import { test, expect } from '@playwright/test'
import { freshApp } from './helpers'

// 🔴 **四個分頁全走一遍**（2026-08-31：「其他視圖要跟進」）。
// 先前少了 `console`，而**它正是第二條漏網的工具列住的地方**
//（`.bottom-panel-tabs`）——沒有人走過的分頁上，規範不算數。
/**
 * **三個投影**——`console` 刻意不在這裡。
 *
 * 🔴 使用者 2026-08-31：「主控台那邊也不需要還原按鈕」。主控台顯示的是
 * 執行的輸出，**不是程式本身**，那裡沒有東西可以還原。
 *
 * > **「全域」的意思是「每一個投影都在」，不是「每一個分頁都在」。**
 *
 * ⚠️ 而它有自己的一條**反向**斷言（下面）：主控台上不得看得到還原鈕
 * ——少了那一條，「把它從這張表拿掉」就等於默默放棄檢查。
 */
const TABS = ['code', 'blocks', 'flow'] as const

test.describe('行動版', () => {
  // 🔴 **390px，不是 500px。**
  //
  // 第一版用 500 寬，而 ↩↪ 當時塞在標頭裡量到 32x28、看起來完全正常。
  // 使用者 2026-08-31 在真的手機上（約 390px）截圖回報：標頭被擠爆了
  // ——「▶ 執行」折成兩行、↩↪ 疊在一起。
  //
  // > **一個「量得到就算過」的寬度，不是使用者手上那一支的寬度。**
  //
  // 390×844 是今天最常見的手機邏輯解析度（iPhone 12/13/14、多數 Android）。
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })

  test('★ 手機：每一個分頁都看得到還原鈕，而全畫面只有一對', async ({ page }) => {
    test.setTimeout(90_000)
    await freshApp(page)
    await page.waitForTimeout(3000)

    // ★ 入口條件——錨在合成量，見檔頭的自我否證
    expect(
      await page.locator('[data-tab]').count(),
      '🔴 分頁列上不到 3 個分頁 → 行動版版面沒生效，這份結果不算數。',
    ).toBeGreaterThanOrEqual(3)

    for (const tab of TABS) {
      await page.locator(`[data-tab="${tab}"]`).last().click()
      await page.waitForTimeout(1200)

      const size = await page.evaluate(() => {
        const r = (id: string): { w: number; h: number } => {
          const b = document.getElementById(id)?.getBoundingClientRect()
          return { w: Math.round(b?.width ?? 0), h: Math.round(b?.height ?? 0) }
        }
        return { undo: r('undo-btn'), redo: r('redo-btn') }
      })

      expect(
        size.undo.w * size.undo.h,
        `🔴 「${tab}」分頁上的還原鈕量到 ${size.undo.w}x${size.undo.h} —— 使用者按不到它。` +
          '⚠️ 它多半還在快速列裡，而快速列被關在積木那一格。',
      ).toBeGreaterThan(0)
      expect(
        size.redo.w * size.redo.h,
        `🔴 「${tab}」分頁上的重做鈕量到 ${size.redo.w}x${size.redo.h}`,
      ).toBeGreaterThan(0)

      // 🔴 **只有「一列」**（使用者 2026-08-31 特別強調）。
      //
      // 四段合進來之後最容易壞的是它：內容一多就換行，而那一列上面就是
      // 標頭——高度一變，整個畫面跟著跳。CSS 用 `flex-wrap: nowrap` ＋
      // 橫捲擋住它，而這裡量的是**結果**：它有沒有變成兩列。
      //
      // ⚠️ 錨在「一顆按鈕的高度」而不是一個寫死的 px：字級變了它跟著變，
      //    而「兩列 ≈ 兩倍高」這個關係不會變。
      const rows = await page.evaluate(() => {
        const bar = document.getElementById('mobile-action-bar')
        if (!bar) return { barH: 0, btnH: 0 }
        const btn = bar.querySelector('button')
        return {
          barH: Math.round(bar.getBoundingClientRect().height),
          btnH: Math.round(btn?.getBoundingClientRect().height ?? 0),
        }
      })
      expect(rows.btnH, '🔴 那一列裡一顆按鈕都沒有').toBeGreaterThan(0)
      expect(
        rows.barH,
        `🔴 「${tab}」分頁的工具列高 ${rows.barH}px，而一顆按鈕才 ${rows.btnH}px` +
          '——它換行變成兩列了。只能有一列。',
      ).toBeLessThan(rows.btnH * 1.8)

      // 而**這個分頁該顯示的那一段真的顯示了**——否則「都在同一條裡」
      // 可以靠「全部藏起來」作弊
      const shown = await page.evaluate(() =>
        Array.from(document.getElementById('mobile-action-bar')?.children ?? [])
          .filter((c) => (c as HTMLElement).style.display !== 'none')
          .map((c) => c.className || c.id))
      // 四個投影各自那一段。⚠️ `className` 可能不只一個字（例如
      //    `quick-access-bar something`），所以下面用「有沒有含這個字」比對。
      const wants: Record<string, string> = {
        blocks: 'quick-access-bar',
        flow: 'flow-toolbar',
        code: 'monaco-clipboard-bar',
        console: 'bottom-panel-tabs',
      }
      if (wants[tab]) {
        expect(
          shown.some((c) => c.includes(wants[tab])),
          `🔴 「${tab}」分頁上少了它原本那一段工具列（找 ${wants[tab]}）。` +
            `實際顯示：${JSON.stringify(shown)}`,
        ).toBe(true)
      }
    }

    // 🔴 **標頭不准被塞爆**——而判準是【結構】，不是像素。
    //
    // 使用者看到的症狀是像素的（「▶ 執行」折成兩行、↩↪ 疊在一起），而
    // ⚠️ **像素判準在這裡抓不到它**：把 ↩↪ 塞回標頭做注入，Playwright 在
    //    390px 下量到的執行鈕**沒有折行**——瀏覽器的字型排版比真手機窄，
    //    而真手機還有系統字級縮放。
    //
    // > **一個「看起來還好嗎」的判準，只在你這台機器的排版上成立。**
    //
    // 所以主要偵測器是結構的：↩↪ 必須在自己那一列裡。它是決定性的
    // ——注入時當場變紅，而且不依賴任何一台機器的字型。
    expect(
      await page.evaluate(() => document.getElementById('undo-btn')?.closest('#mobile-action-bar') !== null),
      `🔴 「${'每個分頁'}」——還原鈕不在行動版第二列裡。` +
        '塞進標頭會在真手機上把它擠爆（使用者 2026-08-31 的截圖：' +
        '「▶ 執行」折成兩行、↩↪ 疊在一起），而那在 500px 的模擬器上看不出來。',
    ).toBe(true)
    // 🟡 像素那一條**留著當寬鬆上界**，而它不是主要偵測器（見上）：
    //    真的爛到連 Playwright 都排不下時它會出聲。
    const runH = await page.evaluate(() =>
      Math.round(document.getElementById('run-btn')?.getBoundingClientRect().height ?? 0))
    expect(runH, '🔴 量不到執行鈕').toBeGreaterThan(0)
    expect(runH, `🟡 執行鈕高 ${runH}px——標頭排不下了`).toBeLessThan(56)

    // 🔴 **行動版只有一條工具列**（使用者 2026-08-31：「總之整合成一個工具列」）。
    //
    // 在此之前有五條各自為政的：標頭（全域）、快速列（只在積木分頁）、
    // 流程工具列（流程）、剪貼工具列（程式碼）、下方面板分頁列（主控台）。
    // 整合之後它們都是 `#mobile-action-bar` 的子節點，而**依分頁顯示
    // 對應的那一段**。
    //
    // ⚠️ 這一條釘的是「還在不在同一條裡」——下一個人加一條分頁專屬的
    //    工具列時，它會出聲。少了它，這條規範會安靜地退回三條。
    const strays = await page.evaluate(() =>
      ['.quick-access-bar', '.flow-toolbar', '.monaco-clipboard-bar', '.bottom-panel-tabs']
        .flatMap((sel) => Array.from(document.querySelectorAll(sel)))
        .filter((el) => !el.closest('#mobile-action-bar'))
        .map((el) => el.className))
    expect(
      strays,
      `🔴 這些工具列不在那一條裡：${JSON.stringify(strays)}——行動版該只有一條。`,
    ).toEqual([])

    // 🔴 **這一列上不准有瀏覽器預設底色的按鈕。**
    //
    // 使用者 2026-08-31：「我希望底色不要白」。量到的（`getComputedStyle`，
    // 不是看截圖）：↩↪ 是 `rgb(239,239,239)`（ButtonFace），而同一列上
    // 其他每一顆是透明或 `rgb(60,60,60)`。
    //
    // 原因：↩↪ 原本靠 `.quick-access-bar button` 上色，搬進 `#undo-group`
    // 之後那條選擇器不再命中。⚠️ **`style.css` 裡已經有這個病的墓碑**
    //（「檔案選單」那一段，2026-08-25 從快速列搬到標頭時踩的同一個）。
    //
    // > **樣式掛在容器上的按鈕，搬家等於脫光。**
    //
    // 判準錨在**亮度**，不是某一個色碼：換佈景時色碼會變，而
    // 「深色列上不該有亮底的按鈕」這件事不會。
    const bright = await page.evaluate(() => {
      const bar = document.getElementById('mobile-action-bar')
      return Array.from(bar?.querySelectorAll('button') ?? []).flatMap((b) => {
        const bg = getComputedStyle(b).backgroundColor
        const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(bg)
        if (!m) return []
        if (m[4] !== undefined && Number(m[4]) === 0) return []   // 透明，沒問題
        const lum = (Number(m[1]) * 299 + Number(m[2]) * 587 + Number(m[3]) * 114) / 1000
        return lum > 140 ? [`${(b.textContent ?? '').trim().slice(0, 6)}=${bg}`] : []
      })
    })
    expect(
      bright,
      `🔴 這一列上有亮底的按鈕：${JSON.stringify(bright)}——多半是搬家之後` +
        '掉出了原本那條容器選擇器，於是用了瀏覽器預設的 ButtonFace。',
    ).toEqual([])

    // 🔴 **主控台那一格不給還原鈕**（使用者 2026-08-31）。
    //
    // > **「全域」的意思是「每一個投影都在」，不是「每一個分頁都在」。**
    //   主控台顯示的是執行的輸出，不是程式本身——那裡沒有東西可以還原。
    await page.locator('[data-tab="console"]').last().click()
    await page.waitForTimeout(1200)
    expect(
      await page.evaluate(() =>
        (document.getElementById('undo-btn')?.getBoundingClientRect().width ?? 0) > 0),
      '🔴 主控台分頁上還看得到還原鈕',
    ).toBe(false)

    // 🔴 **搬進來的按鈕，原本的樣式不准被新容器拆掉。**
    //
    // 使用者 2026-08-31：「這邊的藍色底線不見了」——`主控台／變數` 的
    // 選中底線（`.bottom-tab-btn.active` 的 `border-bottom: 2px #007acc`）
    // 被我補的 `#mobile-action-bar button { border: none }` 清掉了。
    //
    // ⚠️ 它與上面那條「不准有亮底按鈕」是**同一個決定的兩端**：
    //    真正掉出選擇器的只有 ↩↪（它被單獨搬出快速列），其餘四段
    //    **連容器一起搬**，class 選擇器都還命中——所以補樣式的範圍
    //    只該到 `#undo-group`，不是整列。
    //
    // > **一條「幫新容器裡的按鈕補樣式」的規則，
    // > 會順手拆掉那些本來就有樣式的按鈕。**
    const underline = await page.evaluate(() => {
      const el = document.querySelector('#mobile-action-bar .bottom-tab-btn.active')
      if (!el) return null
      const cs = getComputedStyle(el)
      return { w: cs.borderBottomWidth, c: cs.borderBottomColor }
    })
    expect(underline, '🔴 這一列裡找不到選中的主控台分頁').not.toBeNull()
    expect(
      underline!.w,
      `🔴 選中的分頁沒有底線了（寬 ${underline!.w}）——多半是某條 button 規則` +
        '把 `border` 清成 none 了',
    ).not.toBe('0px')
    expect(
      underline!.c,
      `🔴 底線在而顏色不對（${underline!.c}）——它該是 #007acc`,
    ).toBe('rgb(0, 122, 204)')

    // 🔴 **主控台那一段：分頁靠左、動作靠右**（使用者 2026-08-31：
    //    「主控台變數的 tab 要跟其他按鈕隔開（靠左跟靠右）」）。
    //    修之前量到的是它們貼在一起：`90..194` 接著 `194..280`。
    const lr = await page.evaluate(() => {
      const bar = document.getElementById('mobile-action-bar')
      const tabs = bar?.querySelector('.bottom-panel-tab-buttons')
      const acts = bar?.querySelector('.bottom-panel-tab-actions')
      if (!bar || !tabs || !acts) return null
      const B = bar.getBoundingClientRect()
      return {
        gap: Math.round(acts.getBoundingClientRect().x - tabs.getBoundingClientRect().right),
        rightEdge: Math.round(B.right - acts.getBoundingClientRect().right),
        barW: Math.round(B.width),
      }
    })
    expect(lr, '🔴 主控台那一段不在這一列裡').not.toBeNull()
    expect(
      lr!.gap,
      `🔴 分頁與動作只隔了 ${lr!.gap}px——它們該一左一右分開（列寬 ${lr!.barW}px）`,
    ).toBeGreaterThan(lr!.barW / 4)
    expect(
      lr!.rightEdge,
      `🔴 動作那一組離右緣還有 ${lr!.rightEdge}px——它沒有靠右`,
    ).toBeLessThan(24)

    // 🔴 **反向**：不准靠「每個分頁各放一對」讓上面變綠
    const pairs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button'))
        .filter((b) => (b.textContent ?? '').trim() === '↩').length)
    expect(
      pairs,
      '🔴 畫面上有不只一顆還原鈕——2026-08-30 才把三對合併成一對，' +
        '而「各放一對」會讓它們各自還原各自的東西。搬同一顆，不要複製。',
    ).toBe(1)
  })
})

test('★ 切回桌機時，還原鈕回到快速列裡的原位（不是排到最後）', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await freshApp(page)
  await page.waitForTimeout(3000)
  expect(
    await page.evaluate(() => document.getElementById('undo-btn')?.closest('#mobile-action-bar') !== null),
    '🔴 手機版時還原鈕不在行動版第二列裡 → 這一次量的不是「搬回去」',
  ).toBe(true)

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.waitForTimeout(2000)

  const order = await page.evaluate(() => {
    const bar = document.querySelector('.quick-access-bar')
    if (!bar) return null
    return Array.from(bar.querySelectorAll('button'))
      .map((b) => b.id || (b.textContent ?? '').trim())
  })
  expect(order, '🔴 找不到快速列').not.toBeNull()
  const u = order!.indexOf('undo-btn'), r = order!.indexOf('redo-btn'), c = order!.indexOf('clear-btn')
  expect(u, `🔴 還原鈕沒有回到快速列。實際順序：${JSON.stringify(order)}`).toBeGreaterThanOrEqual(0)
  expect(r, '🔴 重做鈕沒有回到快速列').toBeGreaterThan(u)
  // ⚠️ 只在「清空」存在時比——那顆由登錄表決定建不建
  if (c >= 0) {
    expect(
      c,
      '🔴 還原／重做排到「清空」後面了——appendChild 會把節點放到最後，' +
        `而順序是使用者記得的東西。實際：${JSON.stringify(order)}`,
    ).toBeGreaterThan(r)
  }

  /**
   * 🔴 **另外三段也要回家，而且要回到「內容上面」**（2026-08-31）。
   *
   * 「搬回去」有一個安靜的壞法：搬回對的容器、**排到內容底下**。
   * 那時工具列還在、還能按，只是跑到編輯器（或主控台輸出）的下面
   * ——⚠️ 一個「元素存不存在」的檢查完全看不出來。
   *
   * > **一個搬家的動作，錯的不會是「有沒有到」，是「到了哪個位置」。**
   *
   * 所以量的是**索引**：它必須排在同一個容器裡那塊內容的前面。
   */
  const homes = await page.evaluate(() => {
    const at = (sel: string, contentSel: string) => {
      const el = document.querySelector(sel)
      if (!el?.parentElement) return null
      const kids = Array.from(el.parentElement.children)
      return { self: kids.indexOf(el), content: kids.findIndex((k) => k.matches(contentSel)) }
    }
    return {
      // 剪貼列本來就是編輯器容器的**第一個**子節點——沒有分隔線之類的東西在它前面
      clipboard: at('.monaco-clipboard-bar', '.monaco-clipboard-bar'),
      inWrapper: document.querySelector('.monaco-clipboard-bar')?.parentElement?.className ?? null,
      consoleTabs: at('.bottom-panel-tabs', '.bottom-panel-content'),
    }
  })
  expect(homes.clipboard, '🔴 剪貼工具列不見了——它沒有從行動版那一列搬回程式碼面板').not.toBeNull()
  expect(
    homes.inWrapper,
    `🔴 剪貼工具列沒有回到編輯器那一格，它現在在「${homes.inWrapper}」裡`,
  ).toContain('monaco-wrapper')
  expect(
    homes.clipboard!.self,
    `🔴 剪貼工具列排到編輯器底下了（它是第 ${homes.clipboard!.self} 個子節點，該是第 0 個）`,
  ).toBe(0)
  // ⚠️ 主控台那一格由登錄表決定建不建（VSCode 走宿主終端機）——沒有就不比
  if (homes.consoleTabs && homes.consoleTabs.content >= 0) {
    expect(
      homes.consoleTabs.self,
      `🔴 下方面板的分頁列排到輸出底下了（第 ${homes.consoleTabs.self} 個，` +
        `內容在第 ${homes.consoleTabs.content} 個）`,
    ).toBeLessThan(homes.consoleTabs.content)
  }
})
