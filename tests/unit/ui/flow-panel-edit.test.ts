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
import { tryConnect, refusalKeyOf } from '../../../src/core/flow/connect'
import { msg } from '../../../src/core/messages'
import { registerCppLanguage } from '../../../src/languages/cpp/generators'

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

registerCppLanguage()

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

  it('🔴 【單】擊 → 開一個頁內輸入框（不是 window.prompt）', () => {
    const cell = host.querySelector('.fc-field-editable') as HTMLElement
    expect(cell, '沒有任何一格是可編輯的').toBeTruthy()
    cell.dispatchEvent(new Event('click', { bubbles: true }))
    expect(host.querySelector('.flow-field-input'), '沒有開輸入框').toBeTruthy()
  })

  it('🔴 命中區是一塊【矩形】，不是那幾個字', () => {
    // ## 它從哪來（2026-08-27，瀏覽器實測）
    //
    // 使用者逐字：「我根本無法拖曳與編輯還有接線」。而「編輯」那一半的
    // 根因是：SVG `<text>` 只有**字身**接得到指標事件，點在字距上會穿過去
    // 落到底板。量出來的是 `elementFromPoint(欄位中心)` → `fc-node-body`。
    //
    // > **一個命中區等於字形的控制項，使用者點得到的是筆畫，不是欄位。**
    //
    // ⚠️ 這與「把 `dblclick` 換成 `click`」是**兩個獨立的缺陷**——
    //    只改事件種類的話它照樣沒反應，而那看起來像「改了沒用」。
    const hits = [...host.querySelectorAll('.fc-field-hit')]
    const cells = [...host.querySelectorAll('.fc-field-editable')]
    expect(cells.length, '入口條件：一格可編輯的都沒有 → 下面在測空的').toBeGreaterThan(0)
    expect(hits.length, '🔴 沒有命中矩形 → 只有字身接得到事件').toBe(cells.length)
    expect(hits[0].tagName.toLowerCase(), '命中區必須是矩形').toBe('rect')

    // ★ 而它要真的接得到——點矩形（不是文字）也要開得起輸入框
    ;(hits[0] as unknown as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
    expect(host.querySelector('.flow-field-input'), '點在矩形上沒反應').toBeTruthy()
  })

  it('🔴 Enter 之後只送【一次】——`remove()` 會自己觸發 `blur`', () => {
    // 2026-08-27 瀏覽器實測抓到的例外：
    // `NotFoundError: Failed to execute 'remove' ... Perhaps it was moved in a 'blur' event handler?`
    //
    // ⚠️ 拋例外只是**看得見的那一半**；另一半是**同一次編輯被送出兩次**，而它安靜。
    //
    // > **一個「關掉自己」的收尾動作，會被自己觸發的事件再呼叫一次。**
    let fired = 0
    panel.onEdit(() => { fired++ })
    const cells = [...host.querySelectorAll('.fc-field-editable')] as HTMLElement[]
    const cell = cells.find((c) => (c.textContent ?? '').includes('到（不含）'))!
    cell.dispatchEvent(new Event('click', { bubbles: true }))
    const input = host.querySelector('.flow-field-input') as HTMLInputElement
    input.value = '到（含）'
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    // 真的瀏覽器在 `remove()` 時會補一個 blur——這裡照樣送一次進去
    input.dispatchEvent(new Event('blur', { bubbles: true }))
    expect(fired, '🔴 同一次編輯送了兩次').toBe(1)
  })

  it('🔴 圖住在一層【會捲動】的容器裡——`overflow: hidden` 會讓半張圖點不到', () => {
    // 2026-08-27 量到的：三欄版面下 SVG 是 **724** 寬、面板只有 **362**，
    // 而面板 `overflow: hidden` → **13 顆節點有 7 顆落在看不到的地方**。
    // 而**看不到的東西也點不到**，所以「接不了線」有一半是這個。
    //
    // > **一張比容器大的圖配上 `overflow: hidden`，不是「畫面乾淨」
    // > ——是「一半的功能不存在」。**
    //
    // ⚠️ happy-dom 沒有版面，所以這裡釘的是**結構**（圖在那一層裡面），
    //    捲動由 `.flow-canvas` 的 CSS 負責。結構錯了 CSS 再對也沒用。
    const canvas = host.querySelector('.flow-canvas')
    expect(canvas, '🔴 沒有那一層 → 捲動的規則沒有落點').toBeTruthy()
    expect(canvas!.querySelector('svg.flow-svg'), '🔴 圖不在會捲的那一層裡').toBeTruthy()
  })

  it('🔴 打完 Enter → 樹真的變了，而且【顯示文字換回原始值】', () => {
    let got: SemanticNode | null = null
    panel.onEdit((t) => { got = t })

    // 找到 `inclusive` 那一格（顯示成「到（不含）」）
    const cells = [...host.querySelectorAll('.fc-field-editable')] as HTMLElement[]
    const cell = cells.find((c) => (c.textContent ?? '').includes('到（不含）'))
    expect(cell, '找不到那一格 → 這支測的不是那條路').toBeTruthy()
    cell!.dispatchEvent(new Event('click', { bubbles: true }))

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
    cell.dispatchEvent(new Event('click', { bubbles: true }))
    const input = host.querySelector('.flow-field-input') as HTMLInputElement
    input.value = '亂改'
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(fired, '按了 Escape 而它還是送出去了').toBe(0)
    resetMessageSource()
  })
})

/**
 * **(c) 改接線 ＋ (f) 誠實拒絕**——而第二支是重點。
 *
 * `history/017` 逐字：「一道檢查一旦會**拒絕**，就必須同時回答
 * **被拒絕的東西去哪了**。」——這裡的答案是「**哪裡都沒去**」，
 * 而那句話要能被驗證，不能只寫在註解裡。
 */
describe('流程面板：拉線', () => {
  const twoNodes = (): SemanticNode =>
    ({
      id: 'root', componentId: 'cpp:program', properties: {},
      children: {
        body: [
          { id: 'D', componentId: 'cpp:var_declare', properties: { name: 'x' }, children: {} },
          { id: 'N', componentId: 'cpp:literal_number', properties: { value: '7' }, children: {} },
        ],
      },
    }) as unknown as SemanticNode

  let host: HTMLElement
  let panel: FlowPanel

  beforeEach(() => {
    const table = { ...(zhTW as unknown as Record<string, string>), ...componentLabels('zh-TW') }
    setMessageSource((k) => table[k])
    host = document.createElement('div')
    panel = new FlowPanel(host, registry())
    panel.onSemanticUpdate({ tree: twoNodes() } as never)
  })

  it('★ 入口條件：接點真的畫出來了，而且是可以拉的', () => {
    const ports = host.querySelectorAll('.fc-port-wirable')
    expect(ports.length, '一個可拉的接點都沒有 → 下面在測空的').toBeGreaterThan(0)
  })

  it('🔴 (f) 接不上的線 → 說出理由，而**樹一個字都沒動**', () => {
    let fired = 0
    panel.onEdit(() => { fired++ })
    const before = JSON.stringify(panel.readSource())

    // 直接問那條規則（UI 的手勢在 happy-dom 裡模擬不了 pointer 的座標命中）
    const v = tryConnect(twoNodes(), 'D', 'N', 'value')
    expect(v.ok, '這一條【應該】被拒絕').toBe(false)

    expect(fired, '拒絕了而它還是送出去了 → 樹被動到了').toBe(0)
    expect(JSON.stringify(panel.readSource()), '樹變了').toBe(before)
  })

  it('🔴 每一個拒絕理由都查得到一句人話（畫面上不得出現代號）', () => {
    for (const r of ['no-such-slot', 'would-cycle', 'not-parent-child', 'wrong-kind'] as const) {
      const line = msg(refusalKeyOf(r), '')
      expect(line, `${r} 沒有文案`).not.toBe('')
      expect(line, `${r} 的文案裡出現了代號`).not.toContain(r)
      expect(line, '拒絕必須回答「被拒絕的東西去哪了」').toContain('沒有被改動')
    }
  })
})

/**
 * **拖曳要看得見，放偏要說得出話**——2026-08-27，使用者：「節點從積木盤中拖不出來」。
 *
 * ## 而它【拖得出來】——真的壞掉的是回饋
 *
 * 瀏覽器實測：拖 palette 上的「數字」到 `initializer` 接點上，
 * 節點數 13 → 14、`create:cpp:literal_number→initializer`。**功能是通的。**
 *
 * 壞的是使用者看到的東西：
 *
 * ```
 * 拖的時候   chip 的手勢【沒有 pointermove】 → 畫面完全不動
 * 而預覽線   x1===x2、y1===y2               → 【零長度】，從來看不見
 * 放偏時     if (to) …                      → 什麼都不說
 * ```
 *
 * 接點是半徑 6 的圓。三件事疊起來的結果是：**多數人第一次放偏，然後看到零反應。**
 *
 * > **一個沒有回饋的拖曳，與一個壞掉的拖曳，在使用者眼裡是同一件事。**
 *
 * ## ⚠️ 為什麼「有沒有畫出預覽」這種檢查抓不到零長度那一條
 *
 * 那個 `<line>` **真的被建出來、真的進了 DOM**——它只是兩端在同一點。
 * 所以下面那支要斷言的是**兩端不同**，不是「有沒有這個元素」。
 */
describe('流程面板：拖曳的回饋', () => {
  let host: HTMLElement
  let panel: FlowPanel

  beforeEach(() => {
    const table = { ...(zhTW as unknown as Record<string, string>), ...componentLabels('zh-TW') }
    setMessageSource((k) => table[k])
    host = document.createElement('div')
    panel = new FlowPanel(host, registry())
    panel.onSemanticUpdate({ tree: {
      id: 'root', componentId: 'cpp:program', properties: {},
      children: { body: [
        { id: 'D', componentId: 'cpp:var_declare', properties: { name: 'x' }, children: {} },
      ] },
    } } as never)
  })

  // ⚠️ **happy-dom 沒有 `elementsFromPoint`**（沒有版面就沒有命中測試）。
  //    這裡補一個永遠「底下什麼都沒有」的替身——正好是這幾支要測的那條路：
  //    **放偏了**。🔴 而「放在接點上」那條**只能靠瀏覽器實測**，
  //    已於 2026-08-27 量過（13 → 14 顆，`create:cpp:literal_number→initializer`）。
  beforeEach(() => {
    ;(document as unknown as { elementsFromPoint: () => Element[] }).elementsFromPoint = () => []
  })

  const down = (el: Element, x: number, y: number): void => {
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y }))
  }
  const winEvent = (type: string, x: number, y: number): void => {
    window.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y }))
  }

  it('★ 入口條件：有接點可以拖，也有預覽線的容器', () => {
    const ports = host.querySelectorAll('.fc-port-wirable')
    expect(ports.length, '一個可拉的接點都沒有 → 下面在測空的').toBeGreaterThan(0)
    expect(host.querySelector('svg.flow-svg'), '沒有畫布').toBeTruthy()
  })

  it('🔴 預覽線的兩端【不得相同】——零長度的線就是沒有線', () => {
    const port = host.querySelector('.fc-port-wirable')!
    down(port, 10, 10)
    winEvent('pointermove', 200, 150)
    const line = host.querySelector('.fc-wire-preview')
    expect(line, '🔴 拖曳中沒有預覽線').toBeTruthy()
    const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map((a) => line!.getAttribute(a))
    expect(
      `${x1},${y1}`,
      '🔴 兩端在同一點 → 這條線畫得出來而【看不見】，' +
        '而任何「有沒有畫出預覽」的檢查都會說有',
    ).not.toBe(`${x2},${y2}`)
    winEvent('pointerup', 200, 150)
  })

  it('🔴 拖曳中要把能放的接點【點亮】', () => {
    const svg = host.querySelector('svg.flow-svg')!
    expect(svg.classList.contains('flow-dropping'), '還沒開始拖就亮著').toBe(false)
    down(host.querySelector('.fc-port-wirable')!, 10, 10)
    expect(
      svg.classList.contains('flow-dropping'),
      '🔴 拖曳中沒有點亮 → 半徑 6 的圓要使用者自己找',
    ).toBe(true)
    winEvent('pointerup', 999, 999)
    expect(svg.classList.contains('flow-dropping'), '放開之後還亮著').toBe(false)
  })

  it('🔴 放在空白處要【說出來】，不得靜默', () => {
    // `history/017`：一道會拒絕的檢查，必須同時回答「被拒絕的東西去哪了」。
    down(host.querySelector('.fc-port-wirable')!, 10, 10)
    winEvent('pointerup', 5000, 5000)   // 一個絕對不是接點的地方
    const notice = host.querySelector('.flow-notice')
    expect(notice, '🔴 放偏了而什麼都沒說 → 使用者會判定「接線壞了」').toBeTruthy()
    expect(notice!.textContent, '訊息要說得出「該放哪」').toContain('接點')
  })
})

/**
 * **先拉出節點，再接邊**——2026-08-27，使用者：
 * 「一般我們都是先拉出節點，然後才去接邊，我現在連拉節點都不行」。
 *
 * ## 🪦 被推翻的那句話
 *
 * `createInto` 的檔頭原本寫著：
 *
 * > 「🔴 **沒有「浮在外面的節點」這種東西**：這張圖是一棵樹的投影，
 * >  而樹裡沒有無主的節點。」
 *
 * **而積木那側一直在做這件事**（`blockly-panel.ts extractSemanticTree`）：
 *
 * ```ts
 * const topBlocks = this.workspace.getTopBlocks(true)
 * for (const block of topBlocks) body.push(...this.extractBlockChain(block))
 * ```
 *
 * 一顆浮在工作區上的積木**本來就在樹裡**——它是根的一個頂層子節點。
 *
 * > **我用「模型不允許」擋掉了一個互動，而模型從來沒有不允許
 * > ——不允許的是我腦中那張模型的圖。**
 *
 * ⚠️ 損失不是「少一個便利功能」，是**整個手勢被倒過來**：節點圖的常規是
 * 先拉出來再接邊，而那條規則要求使用者在還沒看到節點之前
 * 就先命中一個半徑 6 的接點。
 *
 * ## 而它會讓程式碼暫時不合法，**那是共用的語義不是這裡的缺陷**
 *
 * 瀏覽器實測：流程放一顆「算式」→ 程式碼多一行 `+`；
 * 積木工作區放一顆 `cpp_arithmetic` → 程式碼多一行 ` + ;`。**兩邊一樣。**
 */
describe('流程面板：拉一顆節點出來（先不接）', () => {
  // ⚠️ `setPalette` 吃的是**工具箱結構**（`buildToolbox()` 的輸出），
  //    不是攤平後的清單——那正是 `core/flow/palette.ts` 存在的理由：
  //    「用同一份資料」擋不住分岔，「用同一份**結果**」才擋得住。
  const TOOLBOX = {
    contents: [
      { kind: 'category', name: '運算', contents: [{ kind: 'block', type: 'cpp_arithmetic' }] },
    ],
  }

  let host: HTMLElement
  let panel: FlowPanel

  const oneNode = (): SemanticNode =>
    ({
      id: 'root', componentId: 'cpp:program', properties: {},
      children: { body: [
        { id: 'D', componentId: 'cpp:var_declare', properties: { name: 'x' }, children: {} },
      ] },
    }) as unknown as SemanticNode

  beforeEach(() => {
    const table = { ...(zhTW as unknown as Record<string, string>), ...componentLabels('zh-TW') }
    setMessageSource((k) => table[k])
    ;(document as unknown as { elementsFromPoint: () => Element[] }).elementsFromPoint = () => []
    host = document.createElement('div')
    panel = new FlowPanel(host, registry())
    panel.onSemanticUpdate({ tree: oneNode() } as never)
  })

  /**
   * ⚠️ **要先點分類**——積木盤 2026-08-27 改成 Blockly 的形狀：
   *    左邊一條固定的分類，點了才彈出那一格的積木。
   *    在此之前是一整面攤平的按鈕（22 顆，其中三顆「如果」做同一件事）。
   */
  const openCategory = (name: string): void => {
    const cat = [...host.querySelectorAll('.flow-cat')].find((c) => c.textContent?.includes(name))
    expect(cat, `分類條上沒有「${name}」`).toBeTruthy()
    ;(cat as HTMLElement).click()
  }

  const dragChip = (text: string, to: { x: number; y: number }): void => {
    const chip = [...host.querySelectorAll('.flow-chip')].find((c) => c.textContent === text)
    expect(chip, `palette 上沒有「${text}」`).toBeTruthy()
    chip!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 0, clientY: 0 }))
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: to.x, clientY: to.y }))
  }

  it('★ 入口條件：palette 上真的有東西可以拉', () => {
    // 🔴 沒有這一條的話，下面兩支在「找不到 chip」時會【一起】變綠——
    //    因為「什麼都沒生」正是它們其中一支要的結果。
    panel.setPalette(TOOLBOX)
    expect(host.querySelectorAll('.flow-cat').length, '分類條是空的').toBeGreaterThan(0)
    // ★ 而點了分類才有積木——**這正是這一刀改的形狀**
    expect(host.querySelectorAll('.flow-chip').length, '還沒點分類就有積木了').toBe(0)
    openCategory('運算')
    expect(host.querySelectorAll('.flow-chip').length, '點了分類而沒有積木').toBeGreaterThan(0)
  })

  it('🔴 一個分類裡同一個身分只出現【一次】', () => {
    // ## 它從哪來（2026-08-27，瀏覽器實測）
    //
    // 「控制」那一格裡有**三顆「如果」**，而它們是同一個 `blockType`、
    // 同一個 `componentId`（工具箱用 `extraState` 列了三種變體）。
    // 流程這側 `createLoose` 只吃 `componentId`——**三顆按下去做的事一模一樣**。
    //
    // > **兩個看起來不同、做起來相同的選項，比一個選項更難用
    // > ——使用者會停下來想「差別在哪」，而答案是「沒有」。**
    //
    // ⚠️ 已知的損失：`cpp_if` 那三種變體（有沒有 else）因此選不到。
    //    那是 `extraState` 的事，而流程視圖還沒有表達它的方式。
    panel.setPalette({
      contents: [{
        kind: 'category', name: '控制', contents: [
          { kind: 'block', type: 'cpp_if' },
          { kind: 'block', type: 'cpp_if' },   // 同一顆，不同 extraState
          { kind: 'block', type: 'cpp_if' },
        ],
      }],
    })
    openCategory('控制')
    const chips = [...host.querySelectorAll('.flow-chip')].map((c) => c.textContent)
    expect(chips.length, `🔴 同一個身分列了 ${chips.length} 次：${chips.join('／')}`).toBe(1)
  })

  it('🔴 點畫布的空白處 → 彈出格收起來', () => {
    // 2026-08-27 使用者回報：「選的一個分類之後，在點擊空白處無法自動收合」。
    //
    // ⚠️ 監聽掛在**畫布**上而不是 `document`——掛在 document 的話，
    //    工具列上任何一次點擊都會順手收掉它，而那不是使用者的意思。
    // ⚠️ 用 `pointerdown` 而不是 `click`：拖節點時 `click` 不會發生，
    //    而那一刻正是最需要它讓開的時候。
    panel.setPalette(TOOLBOX)
    openCategory('運算')
    const flyout = host.querySelector('.flow-palette') as HTMLElement
    expect(flyout.style.display, '點了分類而沒有彈出來').not.toBe('none')
    host.querySelector('.flow-canvas')!
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 300, clientY: 300 }))
    expect(flyout.style.display, '🔴 點了空白處而它還開著').toBe('none')
    expect(host.querySelectorAll('.flow-cat.active').length, '分類還亮著').toBe(0)
  })

  it('🪦 工具列上【沒有】收起積木盤那顆——收合鈕貼在分類條邊上', () => {
    // 使用者逐字：「我想也不要有收起積木盤這個，
    // 行動版的話仿照 Blockly 那邊的收合按鈕就好」。
    //
    // 🔴 桌機上分類條靠邊排版、96px、不蓋任何東西——**沒有理由收它**，
    //    而一顆沒有理由按的按鈕佔的是工具列最貴的那塊地方。
    //    行動版寬度真的不夠，所以那裡需要（`display` 由 CSS 的斷點管）。
    panel.setPalette(TOOLBOX)
    const bar = host.querySelector('.flow-toolbar')!
    expect(
      bar.querySelector('.flow-palette-toggle'),
      '🔴 它又長回工具列了',
    ).toBeNull()
    const toggle = host.querySelector('.flow-palette-toggle')
    expect(toggle, '收合鈕整顆不見了 → 行動版收不起來').toBeTruthy()
    expect(toggle!.textContent, '形狀要與積木那顆一致（◀／▶）').toBe('◀')
    // ★ 而它要真的會收——不是一顆裝飾
    ;(toggle as HTMLElement).click()
    expect((host.querySelector('.flow-toolbox') as HTMLElement).style.display).toBe('none')
    expect(toggle!.textContent).toBe('▶')
  })

  it('🔴 拖曳一開始，彈出格要【讓開】', () => {
    // 彈出格覆蓋在畫布上。不收的話使用者**看不到自己要放去哪裡**
    // ——那正是 2026-08-26 那次「拖不動」的成因（一塊浮層蓋住畫布左上角）。
    //
    // > **一個浮在畫布上的東西，在使用者需要看畫布的那一刻必須讓開。**
    panel.setPalette(TOOLBOX)
    openCategory('運算')
    const flyout = host.querySelector('.flow-palette') as HTMLElement
    expect(flyout.style.display, '點了分類而沒有彈出來').not.toBe('none')
    const chip = [...host.querySelectorAll('.flow-chip')].find((c) => c.textContent === '算式')!
    chip.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 0, clientY: 0 }))
    expect(
      flyout.style.display,
      '🔴 拖曳開始了而彈出格還蓋著畫布',
    ).toBe('none')
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 5000, clientY: 5000 }))
  })

  it('🔴 放在畫布上 → 樹的頂層多一顆（就像一顆還沒接的積木）', () => {
    panel.setPalette(TOOLBOX)
    openCategory('運算')
    let got: SemanticNode | null = null
    panel.onEdit((t) => { got = t })
    dragChip('算式', { x: 0, y: 0 })   // happy-dom 沒有版面：畫布的邊界是 0×0，(0,0) 在裡面
    expect(got, '🔴 什麼都沒送出去 → 拉不出節點').not.toBeNull()
    const body = (got as unknown as SemanticNode).children.body
    expect(body.length, '🔴 頂層沒有多出那一顆').toBe(2)
    expect(body[1].componentId).toBe('cpp:arithmetic')
  })

  it('★ 反向：放到面板【外面】＝取消，不得生出東西', () => {
    // 少了這一條，一個「放哪都生」的實作也會通過上面那支——
    // 而它的症狀是「手滑放到旁邊，畫面上莫名多一顆」。
    panel.setPalette(TOOLBOX)
    openCategory('運算')
    let fired = 0
    panel.onEdit(() => { fired++ })
    dragChip('算式', { x: 5000, y: 5000 })
    expect(fired, '🔴 放到面板外面還是生了一顆').toBe(0)
  })
})
