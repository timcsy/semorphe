/**
 * **e2e 護欄：按得到的東西要有 24×24**
 *
 * ## ⚠️ 它為什麼【沒有編號】
 *
 * 編號那份清單由 `tests/integration/audit-guardrail-count.test.ts` 數，
 * 而它只掃 `tests/integration/`。這一條**量的是真的版面**（元素渲染出來
 * 多大），沒有瀏覽器就量不到——所以它住在 e2e，與 `arrange-scatters`
 * 同一族（那一條也是 e2e 護欄、也不佔編號）。
 *
 * 🔴 **不要為了讓它進清單而把它搬進 `tests/integration`**：
 * 在沒有版面的地方量尺寸，量到的是 0。
 *
 * ## 🔴 它從哪來（2026-09-21）
 *
 * 一班學生上完 C++ 入門前幾課，其中一個逐字：
 *
 * > 我覺得網站有一些bug有一些按下去不會到他寫的部分。
 * > 網站疑時很完善了只是**有一些感覺太擠**其他還可。
 *
 * ⚠️ 「太擠」聽起來沒辦法量——這一條就是它**量得出來的那一面**。
 *
 * ## 判準：24×24 CSS px
 *
 * 那是 **WCAG 2.2 AA 的 2.5.8「目標大小（最小）」**。
 * 🔴 **它是別人寫下來的下限，不是我挑的數字**——這很重要：
 * 「擠不擠」很主觀，而「這顆按鈕有沒有 24px」不是。
 *
 * > **一個說不出「哪裡擠」的抱怨，先去量那個領域有標準的那一面。**
 *
 * ## 為什麼視窗是 1366×768
 *
 * 那是學校筆電最常見的尺寸，而**這班學生就是在教室裡上的課**。
 * ⚠️ 在開發機的大螢幕上量，量到的是我的螢幕。
 *
 * ## ⚠️ 為什麼是棘輪不是硬性零
 *
 * 第一次量到 **20/34 不合格**。一條今天就紅 20 筆的護欄，明天就是背景雜訊
 *（`build-guardrail` 第 6.8 步）。修完是 0，而**基線就寫 0**
 * ——所以它今天等同硬性零，而型別上仍然是棘輪：
 * 往後新增一顆 18px 的按鈕會當場紅，而不必等到有人抱怨。
 *
 * ## 本檔不檢測什麼
 *
 * - **不檢測 Blockly 畫出來的積木**（`<svg>` 裡的欄位）——那是另一個尺寸系統，
 *   而學生是用拖的不是用點的。要量它要另開一條。
 * - 🔴 **不檢測程式碼編輯器自己的輸入代理**（Monaco 的 `textarea.inputarea`）：
 *   它跟著游標縮到 1×1，而**使用者瞄準的是編輯區那一大片，不是它**。
 *   ⚠️ 這是一條真的例外，不是為了讓數字好看——判準是「這個東西是不是
 *   使用者要點的目標」，而它連自己都不畫出來。
 * - **不檢測「看起來擠不擠」**——那要人看，而這一條只回答「有沒有低於下限」。
 * - **不檢測間距**（WCAG 2.5.8 允許「小但周圍留白夠」的例外）——
 *   ⚠️ 那個例外是真的，而實作它要算每一顆的鄰居距離。今天取**嚴格的那一邊**。
 */
import { test, expect } from '@playwright/test'

/** WCAG 2.2 AA · 2.5.8 目標大小（最小）。**不是我挑的數字。** */
const MIN = 24
/** 學校筆電最常見的尺寸。⚠️ 在開發機的大螢幕上量，量到的是我的螢幕。 */
const VIEWPORT = { width: 1366, height: 768 }

interface Target { w: number; h: number; what: string }

test('🔴 按得到的東西都要有 24×24（WCAG 2.2 AA · 2.5.8）', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize(VIEWPORT)
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto(`/?lesson=${encodeURIComponent('cpp-beginner/08-組合技')}`)
  await page.waitForFunction(
    () => Boolean((window as never as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
    undefined, { timeout: 60_000 })
  await page.waitForTimeout(2500)

  const got = await page.evaluate((min) => {
    const vis = (e: Element): boolean => {
      const r = e.getBoundingClientRect()
      const s = getComputedStyle(e)
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'
        && s.opacity !== '0' && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth
    }
    const sel = 'button,a[href],input,select,textarea,[role=button],[role=tab],[onclick],[tabindex]:not([tabindex="-1"])'
    // ⚠️ **排掉 Blockly 的 svg**——見檔頭「不檢測什麼」。
    const all = [...document.querySelectorAll(sel)]
      .filter((e) => e.namespaceURI === 'http://www.w3.org/1999/xhtml' && vis(e))
      // 🔴 編輯器自己的輸入代理不是目標——見檔頭「不檢測什麼」。
      .filter((e) => e.closest('.monaco-editor') === null)
    const small = all.filter((e) => {
      const r = e.getBoundingClientRect()
      return r.width < min || r.height < min
    }).map((e) => {
      const r = e.getBoundingClientRect()
      return {
        w: Math.round(r.width), h: Math.round(r.height),
        what: `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}.${String(e.className).split(' ')[0]}`
          + `「${(e.textContent ?? '').trim().slice(0, 12)}」`,
      }
    })
    return { total: all.length, small }
  }, MIN)

  // ★ 自我否證：一個都沒掃到 ⟹ 下面那條在驗空集合，而它會是綠的
  expect(got.total, '🔴 一個互動元素都沒掃到 → 掃描壞了，不是它們都合格')
    .toBeGreaterThan(20)

  const lines = (got.small as Target[]).map((t) => `  ${t.w}x${t.h}  ${t.what}`)
  // eslint-disable-next-line no-console
  console.log(`\n  點擊目標（${VIEWPORT.width}×${VIEWPORT.height}）\n`
    + `  ─────────────\n`
    + `  可見的互動元素  ${got.total}\n`
    + `  🔴 小於 ${MIN}×${MIN}    ${got.small.length}  ← 棘輪（第一次量到 20）\n`
    + lines.join('\n'))

  expect(
    lines,
    `🔴 這幾顆低於 WCAG 2.2 AA 的 ${MIN}×${MIN} 下限。\n`
      + '   修法：在 style.css 末尾那一段「點得到的最小尺寸」加上它的選擇器。\n'
      + '   ⚠️ 用 min-height／min-width，不要用 height——已經夠大的不要動。',
  ).toEqual([])
})

test('★ 注入：偵測器認得出一顆太小的按鈕', async ({ page }) => {
  // 🔴 合成一顆 18px 的按鈕塞進去——不靠任何一顆真的壞掉。
  //    偵測器壞掉的話，上面那條會在**每一顆都太小**的時候全綠。
  await page.setViewportSize(VIEWPORT)
  await page.goto('/')
  const n = await page.evaluate((min) => {
    const b = document.createElement('button')
    b.style.cssText = 'position:fixed;top:0;left:0;width:20px;height:18px;z-index:9999'
    b.textContent = 'x'
    document.body.appendChild(b)
    const r = b.getBoundingClientRect()
    const hit = r.width < min || r.height < min
    b.remove()
    return hit ? 1 : 0
  }, MIN)
  expect(n, '認不出一顆 20×18 的按鈕 → 上面那條是空過的').toBe(1)
})
