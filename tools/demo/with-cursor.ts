/**
 * **把游標畫進頁面裡**——錄影才看得到「誰在動它」。
 *
 * ## 🔴 為什麼要自己畫
 *
 * Playwright 錄的是**頁面內容**，而作業系統的游標**不在裡面**。所以在此之前那幾支
 * 示範，畫面會自己動而看不到手——讀者只知道「有事情發生了」，不知道「要拉哪裡」。
 *
 * 🟢 而 `mouse.move`／`click` 送的是**真的 DOM 事件**，所以頁面裡的一個 listener
 * 收得到座標——游標因此畫得出來，連按下去的那一下都畫得出來。
 *
 * ## ⚠️ 三個實作上的坑
 *
 * ```
 * pointer-events: none    少了它，那顆假游標會擋住真正要點的東西
 * mouse.move 要帶 steps   不然是瞬移，畫面上像跳格（Playwright 預設 steps=1）
 * capture 階段監聽        Blockly／Monaco 會 stopPropagation，冒泡那一輪收不到
 * ```
 *
 * ⚠️ 而它掛在 `documentElement` 上不是 `body`：應用會重繪 body 底下的東西，
 * 掛在那裡會被洗掉。
 */
import type { Page } from '@playwright/test'

/** 假游標的樣子——⚠️ 內嵌 SVG，錄影環境不該有任何外部請求。 */
const CURSOR_SVG =
  '<svg viewBox="0 0 24 24" width="26" height="26">' +
  '<path d="M5 2.5 L5 20 L9.2 15.6 L11.9 21.5 L14.6 20.2 L11.9 14.6 L18 14.6 Z"' +
  ' fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>'

/**
 * 在這一頁裝上假游標。**每支錄影開頭呼叫一次就好**，不必改腳本其餘的內容。
 *
 * ⚠️ 用 `addInitScript`：換頁之後它自己會再裝一次（`page.goto` 不會保留 evaluate 的結果）。
 */
export async function withCursor(page: Page): Promise<void> {
  await page.addInitScript((svg: string) => {
    const install = (): void => {
      if (document.getElementById('__demo-cursor') !== null) return
      const root = document.documentElement
      const style = document.createElement('style')
      style.textContent = `
        #__demo-cursor{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;
          transform:translate(-3px,-2px);filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))}
        #__demo-ripple{position:fixed;left:0;top:0;z-index:2147483646;pointer-events:none;
          width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;
          border:2px solid #38bdf8;opacity:0;transform:scale(.4)}
        #__demo-ripple.on{animation:__demo-ping .45s ease-out}
        @keyframes __demo-ping{0%{opacity:.9;transform:scale(.4)}100%{opacity:0;transform:scale(1.6)}}
      `
      const cur = document.createElement('div')
      cur.id = '__demo-cursor'
      cur.innerHTML = svg
      const rip = document.createElement('div')
      rip.id = '__demo-ripple'
      root.append(style, rip, cur)

      const move = (e: MouseEvent): void => {
        cur.style.left = `${e.clientX}px`
        cur.style.top = `${e.clientY}px`
        rip.style.left = `${e.clientX}px`
        rip.style.top = `${e.clientY}px`
      }
      // 🔴 **capture 階段**——Blockly 與 Monaco 都會在冒泡途中攔下事件
      addEventListener('mousemove', move, true)
      addEventListener('mousedown', (e) => {
        move(e as MouseEvent)
        rip.classList.remove('on')
        void rip.offsetWidth   // ⚠️ 強制重排，不然連點兩下第二下不會播
        rip.classList.add('on')
      }, true)
    }
    if (document.readyState === 'loading') {
      addEventListener('DOMContentLoaded', install)
    } else {
      install()
    }
  }, CURSOR_SVG)
}
