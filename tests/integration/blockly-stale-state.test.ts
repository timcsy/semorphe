/**
 * 🔴 **殘的工作區不得覆蓋程式碼。**
 *
 * ## 病歷
 *
 * `ui/panels/blockly-panel.ts` 曾經是這樣：
 *
 * ```ts
 * try { this.setState(event.blockState) }
 * catch { /* safe to ignore *\/ }
 * ```
 *
 * ⚠️ 而它一點都不安全：載到一半拋錯 → **工作區是殘的**，
 * 而下一次積木變動會把那個殘的工作區**寫回使用者的檔案**。
 * 使用者實測到 `setup()`／`loop()` 整個消失，就是這個形狀。
 *
 * > **一個被吞掉的例外，會把「失敗了」變成「成功了，只是內容比較少」。**
 *
 * ## 這支測試守什麼
 *
 * 不是「例外有沒有被記錄」（那要 spy console），而是**原始碼層面的兩件事**：
 * ① 那個 catch 不得是空的　② 失敗要留下一個看得見的旗標，而且有人讀它。
 *
 * ⚠️ 這是一支**靜態**檢查，而它的理由是：真正要守的性質
 * （「殘的工作區不會被寫回去」）需要一個能讓 `setState` 拋錯的 Blockly 環境，
 * 而那個環境本身就會讓測試變成在測 Blockly。🔴 靜態檢查守得住「有沒有人接」，
 * 守不住「接得對不對」——**而後者由使用者實測回報**，這一點要說清楚。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * ⚠️ **先把註解拿掉再掃。**
 *
 * 🔴 第一版沒拿掉，於是它配到了**同一個檔的註解裡引用的那段 `catch {}`**
 * ——一個為了說明「這裡不可以是空的」而寫的例子，被當成了違規。
 *
 * > **一個掃原始碼的檢查，會掃到描述那段原始碼的文字
 * > ——而文件裡的反例讀起來與真的違規一模一樣。**
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

const PANEL = stripComments(readFileSync('src/ui/panels/blockly-panel.ts', 'utf8'))
const APP = stripComments(readFileSync('src/ui/app.ts', 'utf8'))
/** ⚠️ 有些斷言要看的是**有註解的**原文（例如「旗標有沒有對外的讀法」）。 */
const PANEL_RAW = readFileSync('src/ui/panels/blockly-panel.ts', 'utf8')

describe('殘的工作區不得覆蓋程式碼', () => {
  it('🔴 正向錨點：那段 try/catch 還在（不然下面兩條在測空氣）', () => {
    expect(PANEL).toContain('this.setState(event.blockState as object)')
  })

  it('🔴 `catch` 不得是空的——被吞掉的例外會變成「內容比較少的成功」', () => {
    // ⚠️ 掃的是**去掉註解之後**的原始碼——見 `stripComments` 的說明。
    expect(PANEL, '🔴 空的 catch 回來了').not.toMatch(/catch\s*(\([^)]*\))?\s*\{\s*\}/)
  })

  it('失敗要留下旗標，而且旗標要有人讀', () => {
    expect(PANEL, '🔴 沒有記住「這份工作區不可信」').toContain('stateLoadFailed = true')
    expect(PANEL_RAW, '🔴 旗標沒有對外的讀法').toContain('get isStateStale()')
  })

  it('🔴 兩條寫回程式碼的路【都】要問它——自動同步那條才是危險的', () => {
    // ① 使用者按「積木→程式碼」　② autoSync 在積木變動時自己跑
    const hits = APP.match(/isStateStale/g) ?? []
    expect(hits.length, `🔴 只有 ${hits.length} 條路問了——另一條會繞過去`).toBeGreaterThanOrEqual(2)
  })

  it('成功載入要把旗標清掉——否則一次失敗會讓面板永遠停在唯讀', () => {
    expect(PANEL).toContain('this.stateLoadFailed = false')
  })
})
