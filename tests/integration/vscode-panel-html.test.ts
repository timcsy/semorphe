/**
 * Webview 的 HTML 與 CSP——**把兩個「不會拋錯的壞」變成會紅的測試**。
 *
 * ## 自我否證聲明（⚠️ 寫在斷言之前）
 *
 * > 這一刀有**兩個獨立的失敗方式都長成「破圖但功能還在」**：
 * > ① media URI 少一個尾端斜線 → 縮放鈕／垃圾桶破圖
 * > ② CSP 漏掉 `img-src data:` → 積木上的 `+`／`-` 按鈕破圖
 * >
 * > **兩個都不會拋錯、不會出現在 console、不會讓任何測試變紅。**
 * > 所以它們必須被**主動**斷言。
 *
 * 而那正是 `vite.config.ts` 檔頭記過的病：
 * 「壞得很安靜：只是變破圖，功能還在，**所以沒有人會回報它**。」
 *
 * ⚠️ 本檔測的是**純函式**（`renderHtml`／`csp`），不 import `vscode`
 * ——那個模組只在宿主裡存在。
 */
import { describe, it, expect } from 'vitest'
import { renderHtml, csp } from '../../src/vscode/webview-html'

const SOURCE = 'vscode-resource://x'

describe('CSP', () => {
  it('正向錨點：四條主要指令都在', () => {
    const value = csp(SOURCE)
    for (const d of ['default-src', 'script-src', 'style-src', 'img-src']) {
      expect(value).toContain(d)
    }
  })

  it('🔴 `img-src` 必須允許 `data:`——+／- 按鈕是 data URI', () => {
    // 出處：`ui/block-registrar.ts:291-305`
    //   'data:image/svg+xml,' + encodeURIComponent('<svg …>')
    // 而 cpp_var_declare／cpp_print／cpp_array_declare／cpp_vector_declare／
    // cpp_initializer_list 都用它。
    const imgSrc = csp(SOURCE)
      .split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith('img-src'))
    expect(imgSrc).toBeDefined()
    expect(imgSrc).toContain('data:')
  })

  it('`style-src` 必須允許 inline——Blockly 執行期注入樣式', () => {
    const styleSrc = csp(SOURCE)
      .split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith('style-src'))
    expect(styleSrc).toContain(`'unsafe-inline'`)
  })

  it('🔴 `connect-src` 必須設——Blockly 用 fetch() 抓音效', () => {
    // ⚠️ 2026-08-17 預檢實測撞出來的，而**它是新的**（PoC 沒遇過、draft 沒記過）：
    //
    //   Fetch API cannot load …/media/click.mp3.
    //   Refused to connect because it violates the document's CSP.
    //   PAGEERROR Failed to fetch
    //
    // 🔴 **`media-src` 擋不住它**——那條管 <audio>/<video> 元素，
    //    而 Blockly 走的是 fetch ＋ AudioContext。
    //
    // > 兩條看起來管同一件事的指令，管的其實是兩條不同的路。
    const directives = csp(SOURCE)
      .split(';')
      .map((s) => s.trim())
    expect(directives.some((d) => d.startsWith('connect-src'))).toBe(true)
    // 正向錨點：media-src 也還在（兩條都要，不是二選一）
    expect(directives.some((d) => d.startsWith('media-src'))).toBe(true)
  })

  it("🔴 `script-src` 有 'wasm-unsafe-eval' 而【沒有】'unsafe-eval'", () => {
    // ⚠️ 這一條是**護欄式**的，不只是「功能對不對」：
    // `'wasm-unsafe-eval'` 嚴格窄於 `'unsafe-eval'`，而順手放寬是最容易發生的事
    // ——**而放寬之後沒有任何東西會壞掉，所以沒有人會發現**。
    const scriptSrc = csp(SOURCE)
      .split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith('script-src'))!
    expect(scriptSrc).toContain(`'wasm-unsafe-eval'`)
    expect(scriptSrc, "🔴 不得順手加 'unsafe-eval'").not.toMatch(/(^|[^-])'unsafe-eval'/)
  })

  it('🔴 `default-src` 沒有被放寬', () => {
    // 加 wasm 權限時最容易順手做的第二件事，就是把 default-src 打開。
    expect(csp(SOURCE)).toContain(`default-src 'none'`)
  })

  it('`default-src` 是 none——白名單而不是黑名單', () => {
    // ⚠️ 而這一條正是上面三個坑的**共同成因**：白名單漏一項就靜默失敗。
    // 換成寬鬆的 default-src 會讓它們消失，**而那是把尺改短**。
    expect(csp(SOURCE)).toContain(`default-src 'none'`)
  })
})

describe('renderHtml', () => {
  const parts = {
    scriptSrc: 'vscode-resource://x/dist/webview.js',
    styleSrc: 'vscode-resource://x/dist/webview.css',
    mediaSrc: 'vscode-resource://x/dist/media/',
    csp: csp(SOURCE),
  }

  it('正向錨點：容器、樣式、腳本都在', () => {
    // 🔴 spec 140 起這裡只有**一個容器**——其餘由應用自己建。
    //    ⚠️ spec 139 有 #canvas / #readout / #bar / #out，而那是一個【另做的東西】。
    const html = renderHtml(parts)
    expect(html).toContain('id="app"')
    expect(html).toContain(parts.scriptSrc)
    expect(html, '🔴 樣式要與網頁版同一份').toContain(parts.styleSrc)
  })

  it('🔴 零個行內 `<script>`——行內腳本會被 CSP 擋掉', () => {
    // `script-src ${source}` 不含 nonce，也不含 'unsafe-inline'。
    // 所以任何 `<script>…程式碼…</script>` 都不會執行，
    // ⚠️ **而症狀是「畫布一片空白」，沒有任何錯誤指向這裡。**
    const html = renderHtml(parts)
    const inline = html.match(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/g) ?? []
    expect(inline).toEqual([])
  })

  it('🔴 media 走 data 屬性，而它保留尾端斜線', () => {
    // Blockly 直接把 `media` 當前綴接檔名：少一個 `/` 就變成
    // `.../mediasprites.png`——而症狀是破圖，功能還在。
    const html = renderHtml(parts)
    expect(html).toContain(`data-blockly-media="${parts.mediaSrc}"`)
    expect(parts.mediaSrc.endsWith('/')).toBe(true)
  })

  it('CSP 進了 meta 標籤', () => {
    expect(renderHtml(parts)).toContain(`content="${parts.csp}"`)
  })

  it('屬性有跳脫——URI 裡的 & 不得撐破標籤', () => {
    const html = renderHtml({ ...parts, scriptSrc: 'x?a=1&b=2"onload="evil()' })
    expect(html).not.toContain('onload="evil()"')
    expect(html).toContain('&amp;b=2')
  })
})
