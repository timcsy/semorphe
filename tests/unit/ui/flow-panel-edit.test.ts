/**
 * @vitest-environment happy-dom
 *
 * **流程面板改一格的值**——路線圖「流程可編輯」的 (b)。
 *
 * ## 這支釘的三件事，而第三件是最容易漏的
 *
 * ```
 * ① 雙擊那一格會開一個【頁內】輸入框（不是 window.prompt——第七十七條護欄）
 * ② 打完 Enter → 那棵樹【真的變了】，而且送得出去
 * ③ 🔴 顯示文字要【換回原始值】：畫面上是「到（不含）」而樹裡存 `FALSE`
 * ```
 *
 * ⚠️ 第三件沒有的話，改一次欄位就會把「到（不含）」寫進真實，
 * **而下一次投影就壞了**——症狀出現在別的地方，看起來與這次編輯無關。
 *
 * > **一個把顯示文字寫回真實的編輯器，會把投影的損失變成真實的損失。**
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { FlowPanel } from '../../../src/ui/panels/flow-panel'
import { BlockSpecRegistry } from '../../../src/core/block-spec-registry'
import { allCppComponents, allCppProjections } from '../../../src/languages/cpp/all-declarations'
import { setMessageSource, resetMessageSource } from '../../../src/core/messages'
import zhTW from '../../../src/i18n/zh-TW/blocks.json'
import { componentLabels } from '../../../src/core/component/labels'
import type { SemanticNode } from '../../../src/core/types'

const loopTree = (): SemanticNode =>
  ({
    id: 'root', componentId: 'cpp:program', properties: {},
    children: {
      body: [{
        id: 'L1', componentId: 'cpp:loop_count',
        properties: { var_name: 'i', inclusive: 'FALSE' },
        children: {},
      }],
    },
  }) as unknown as SemanticNode

function registry(): BlockSpecRegistry {
  const reg = new BlockSpecRegistry()
  reg.loadFromSplit(allCppComponents(), allCppProjections())
  return reg
}

describe('流程面板：改一格的值', () => {
  let host: HTMLElement
  let panel: FlowPanel

  beforeEach(() => {
    // ⚠️ **這個專案有兩套訊息系統，而流程視圖走的是 `core/messages` 那一套**：
    //    `core/messages.ts` 的 `msg()` 讀 `setMessageSource` 接上的來源（產品接的是 `Blockly.Msg`），
    //    而 `i18n/messages.ts` 的 `formatMessage()` 讀 `setMessages` 的那張表。
    //    🔴 設錯一套的症狀是「查不到 → 用退路」，看起來像**功能沒做**。
    // ⚠️ **膠囊的標籤也要載**——下拉的顯示文字（「到（不含）」）住在膠囊裡。
    const table = { ...(zhTW as unknown as Record<string, string>), ...componentLabels('zh-TW') }
    setMessageSource((k) => table[k])
    host = document.createElement('div')
    panel = new FlowPanel(host, registry())
    panel.onSemanticUpdate({ tree: loopTree() } as never)
  })

  it('★ 入口條件：那一格真的畫出來了，而且顯示的是【顯示文字】', () => {
    const fields = [...host.querySelectorAll('.fc-field')].map((e) => e.textContent ?? '')
    expect(fields.join('｜'), '一格都沒畫出來 → 下面的斷言在測空的').not.toBe('')
    expect(fields.join('｜'), '🔴 `FALSE` 還在 → 值沒有換成顯示文字').not.toContain('FALSE')
    expect(fields.join('｜')).toContain('到（不含）')
  })

  it('🔴 雙擊 → 開一個頁內輸入框（不是 window.prompt）', () => {
    const cell = host.querySelector('.fc-field-editable') as HTMLElement
    expect(cell, '沒有任何一格是可編輯的').toBeTruthy()
    cell.dispatchEvent(new Event('dblclick', { bubbles: true }))
    expect(host.querySelector('.flow-field-input'), '沒有開輸入框').toBeTruthy()
  })

  it('🔴 打完 Enter → 樹真的變了，而且【顯示文字換回原始值】', () => {
    let got: SemanticNode | null = null
    panel.onEdit((t) => { got = t })

    // 找到 `inclusive` 那一格（顯示成「到（不含）」）
    const cells = [...host.querySelectorAll('.fc-field-editable')] as HTMLElement[]
    const cell = cells.find((c) => (c.textContent ?? '').includes('到（不含）'))
    expect(cell, '找不到那一格 → 這支測的不是那條路').toBeTruthy()
    cell!.dispatchEvent(new Event('dblclick', { bubbles: true }))

    const input = host.querySelector('.flow-field-input') as HTMLInputElement
    // ⚠️ 這個值要**逐字**是那個選項的顯示文字（`U_COUNT_LOOP_TO_INCL`）。
    //    第一版打「到」，而它是「到（含）」——測試紅了三分鐘，**而程式碼是對的**。
    //    > 一個手打選項文字的測試，打錯時看起來與功能壞掉一模一樣。
    input.value = '到（含）'
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))

    expect(got, '沒有送出去 → 改了而沒有人知道').not.toBeNull()
    const loop = (got as unknown as SemanticNode).children.body[0]
    expect(
      loop.properties.inclusive,
      '🔴 顯示文字被寫進真實了——下一次投影會壞，而症狀出現在別的地方',
    ).toBe('TRUE')
  })

  it('★ 反向：按 Escape 不得改動任何東西', () => {
    // 缺了這一條，一個「打開就寫回去」的實作也能通過上面幾條。
    let fired = 0
    panel.onEdit(() => { fired++ })
    const cell = host.querySelector('.fc-field-editable') as HTMLElement
    cell.dispatchEvent(new Event('dblclick', { bubbles: true }))
    const input = host.querySelector('.flow-field-input') as HTMLInputElement
    input.value = '亂改'
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(fired, '按了 Escape 而它還是送出去了').toBe(0)
    resetMessageSource()
  })
})
