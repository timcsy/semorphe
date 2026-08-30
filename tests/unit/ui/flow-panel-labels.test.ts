/**
 * @vitest-environment happy-dom
 *
 * **面板上的固定文字，要跟著每次更新重設。**
 *
 * ## 它從哪來（2026-08-26，開瀏覽器實測抓到的）
 *
 * 把 `flow-panel` 從 `import * as Blockly` 換成 `core/messages` 的訊息埠之後
 * （第七十四條護欄），切成 English 驗埠有沒有接上：
 *
 * ```
 * 🪦 粒度選單（整份程式）已於 2026-08-30 刪除——使用者：「這選單能不能先刪掉？
 *    現在好像還看不出有什麼用」。它的兩條斷言隨之退場，而**這一支要驗的東西
 *    沒有變**：標籤要跟著訊息埠走，不是在建構時定型。
 *
 * ⚠️ 留下來的錨點是「自動排版」那顆按鈕——它正是原本那個缺陷的所在
 *    （只在建構時設一次）。少了它，這一支就沒有東西在守了。
 * 自動排版   自動排版  →  【自動排版】       🔴 沒跟著換
 * ```
 *
 * ⚠️ `git stash` 確認過**不是迴歸**——換埠之前就是這樣。根因是
 * `<option>` 每次 `rebuild()` 都重建，而那顆按鈕的文字只在建構時設過一次。
 *
 * > **一段「只設一次」的介面文字，會在語言換掉的那天安靜地留在原地。**
 *
 * ## ⚠️ 而這件事沒有任何測試在看
 *
 * `panel-independence` 看的是 import，`mobile-tab-bar` 看的是分頁的 `data-tab`。
 * **標籤的文字沒有人看**——這支補的就是那一格。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FlowPanel } from '../../../src/ui/panels/flow-panel'
import { setMessageSource, resetMessageSource } from '../../../src/core/messages'
import type { SemanticNode } from '../../../src/core/types'

const tree = (): SemanticNode =>
  ({ id: 'r', componentId: 'cpp:program', children: {}, properties: {} }) as unknown as SemanticNode

const labels = (el: HTMLElement): string[] =>
  [...el.querySelectorAll('.flow-btn, .flow-empty, option')].map((n) => n.textContent ?? '')

describe('流程面板的標籤跟著訊息埠走', () => {
  let host: HTMLElement
  let panel: FlowPanel

  beforeEach(() => {
    host = document.createElement('div')
    panel = new FlowPanel(host)
  })
  afterEach(() => resetMessageSource())

  it('★ 沒有宿主翻譯表時用退路——**那不是降級，是預設行為**', () => {
    resetMessageSource()
    panel.onSemanticUpdate({ tree: tree() } as never)
    expect(labels(host).join('｜')).toContain('自動排版')
  })

  it('🔴 換一份翻譯表，**每一個標籤都要跟著換**（含只設一次的那顆按鈕）', () => {
    // 這一條是缺陷本身：修之前「自動排版」永遠留在建構時的那個值。
    setMessageSource((key) => ({
      FLOW_AUTOLAYOUT: 'Auto layout',
      FLOW_EMPTY: 'Nothing to chart yet.',
    })[key])
    panel.onSemanticUpdate({ tree: tree() } as never)
    const seen = labels(host).join('｜')
    expect(seen, '🔴 按鈕的文字沒跟著換 → 它又只在建構時設一次了').toContain('Auto layout')
    expect(seen).toContain('Nothing to chart yet.')
    expect(seen, '中文殘留＝有一格沒走埠').not.toContain('自動排版')
  })

  it('★ 反向：換回來也要跟著換（不是「換過一次就定型」）', () => {
    setMessageSource(() => 'X')
    panel.onSemanticUpdate({ tree: tree() } as never)
    expect(labels(host).join('｜')).toContain('X')
    resetMessageSource()
    panel.onSemanticUpdate({ tree: tree() } as never)
    expect(labels(host).join('｜'), '回到退路').toContain('自動排版')
  })
})
