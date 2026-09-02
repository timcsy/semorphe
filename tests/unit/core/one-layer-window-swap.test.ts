/**
 * 🔴 **只有一格的視窗裡，置換表必須是恆等的。**
 *
 * ## 病歷（2026-09-02，Arduino IDE）
 *
 * 使用者在積木面板選「流程」：**分頁標題變成了「Semorphe 流程」，而面板一片空白**。
 *
 * 根因是同一個決定被套了兩次：
 *
 * ```
 * showProjection('flow') → 置換表變成 relation↔space（網頁版的做法：
 *                          版面裡沒有那一層時把它換進來）
 * applyLayout           → 這個視窗只有一層 ⟹ 版面塌成「專注」，`*` ＝ relation
 *                       → 再套一次置換表 → space
 *                       → 而 space 在這個視窗又不存在 ⟹ 一格都不剩
 * ```
 *
 * > **一張「哪一格顯示誰」的置換表，在只有一格的地方沒有意義
 * > ——而讓它留著非恆等，那一格就會指到一個不存在的層。**
 *
 * ⚠️ 這一支測的是**那個化簡本身**（純函數），不是 DOM——
 * 對應的畫面驗證在 `tools/vscode-preflight`（四種視窗）與手動實測。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { identityAssignment, swapTo, effectiveAreas } from '../../../src/core/host/slot-assignment'
import { layoutPreset } from '../../../src/core/host/layout-presets'

const FOCUS = layoutPreset('focus')!

describe('一個視窗只有一層時的置換', () => {
  it('★ 入口條件：恆等的置換表下，「專注」顯示的就是那一層', () => {
    expect(effectiveAreas(FOCUS, identityAssignment(), 'relation')).toEqual([['relation']])
  })

  it('🔴 非恆等的置換表會把那一格指到【別的層】——而這個視窗沒有那一層', () => {
    // 這就是使用者看到空白的那一步：`*` 解析成 relation，再被置換成 space。
    const swapped = swapTo(identityAssignment(), 'space', 'relation')
    expect(effectiveAreas(FOCUS, swapped, 'relation')).toEqual([['space']])
  })

  it('🟢 而歸位之後就對了——`setHostLayer` 做的正是這件事', () => {
    expect(effectiveAreas(FOCUS, identityAssignment(), 'space')).toEqual([['space']])
    expect(effectiveAreas(FOCUS, identityAssignment(), 'relation')).toEqual([['relation']])
  })

  it('🔴 接線：`app-shell` 的 `setHostLayer` 要把置換表歸位', () => {
    const src = readFileSync(resolve(__dirname, '../../..', 'src/ui/app-shell.ts'), 'utf8')
    const fn = src.slice(src.indexOf('const setHostLayer'), src.indexOf('const showProjection'))
    // ⚠️ **只看程式碼那幾行**——註解裡寫著那段墓誌銘（「第一版呼叫 showProjection」），
    //    而一條掃字串的斷言如果連註解一起掃，它會被自己的說明文字絆倒。
    const code = fn.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
    expect(code, '沒有歸位 → 那一格會指到一個不存在的層').toMatch(/assignment = identityAssignment\(\)/)
    expect(code, '⚠️ 不得再走 showProjection——它會動置換表').not.toMatch(/showProjection\(/)
  })
})
