/** @vitest-environment jsdom */
/**
 * 護欄：**匯流排造成的積木變動，不得被當成使用者編輯**。
 *
 * ## ⚠️ 先說這條護欄【不是】什麼
 *
 * 2026-08-19 使用者回報：`int x = 1;` 寫在 `setup()` 裡，按兩次 Cmd+Z 之後
 * 變成兩顆 `int x;` 掉到最外層、`= 1` 不見了。**這條護欄抓不到那件事**
 * ——實測過：對修法前的程式碼跑，它是綠的。
 *
 * 它是那次調查的**副產品**：查的過程中發現 `busUpdateInProgress` 這個旗標
 * **從蓋好起就沒有為真過**（Blockly 走 `requestAnimationFrame → setTimeout(0)`
 * 發事件，而旗標是同步開關的）。
 *
 * ```
 * 同步窗口結束時，聽到的事件數：0
 * 一個 tick 之後：            2   ← 兩則都看到旗標是 false
 * ```
 *
 * 🟢 **而它一直沒有出事，是因為真正在擋的是別人**：`setState` 自己呼叫
 * `Blockly.Events.disable()`。所以那個旗標是**死的但無害**——
 * 它宣告了一個保護，而那個保護由另一個機制在提供。
 *
 * > **一個沒有在做事的守衛，與一個壞掉的守衛，讀起來一模一樣；
 * > 而差別要到「真正在擋的那個東西被拿掉」的那天才看得出來。**
 *
 * 於是這條護欄釘的是**那個真正的不變式**，而不是任何一個實作：
 * 不管今天是誰在擋，「程式碼→積木不得觸發使用者編輯」都必須成立。
 *
 * ## ⚠️ 自我否證聲明
 *
 * **如果「使用者親手建一顆積木」那一條沒有觸發回呼，代表這支測試壞了，
 * 不是系統對了**——它證明的只會是「這個回呼從來不響」，而那能讓下面
 * 每一條負向斷言都空過。
 *
 * 錨點是**合成的**（自己建一顆探針積木、自己餵一份積木狀態），
 * 不是任何真實元件的狀態——所以它不會因為某顆元件被修好而失效。
 *
 * ## 本護欄不檢測什麼
 *
 * - 不檢查寫回文件的**內容**對不對（那是投影遺失護欄的事）
 * - 不檢查 VSCode 那側的範圍計算（`applySpan` 有自己的測試）
 * - 只問「這則變動被歸給誰」
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import * as Blockly from 'blockly/core'
import { BlocklyPanel } from '../../src/ui/panels/blockly-panel'
import type { SemanticUpdateEvent } from '../../src/core/view-host'
import { createNode } from '../../src/core/semantic-tree'

/** 一顆最小的合成積木——**不是任何真實元件**，見自我否證聲明。 */
const PROBE = 'guardrail_probe_block'

function makePanel(): { panel: BlocklyPanel; fired: () => number } {
  const container = document.createElement('div')
  Object.assign(container.style, { width: '400px', height: '300px' })
  document.body.appendChild(container)
  const panel = new BlocklyPanel({ container })
  panel.init({ kind: 'categoryToolbox', contents: [] })
  let n = 0
  panel.onChange(() => { n += 1 })
  return { panel, fired: () => n }
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 60))

beforeAll(() => {
  Blockly.defineBlocksWithJsonArray([
    { type: PROBE, message0: '探針', previousStatement: null, nextStatement: null, colour: 0 },
  ])
})

afterEach(() => { document.body.innerHTML = '' })

describe('護欄：匯流排造成的積木變動不得被當成使用者編輯', () => {
  // ── ★ 入口條件：錨在「回呼會不會響」，不在任何缺陷數 ────────────
  it('★ 健康檢查：使用者親手建一顆積木【必須】觸發回呼', async () => {
    const { panel, fired } = makePanel()
    const ws = panel.getWorkspace()
    expect(ws, '工作區沒建起來 → 下面每一條都是空過的').not.toBeNull()
    ws!.newBlock(PROBE)
    await tick()
    expect(fired(), '回呼從來不響的話，負向斷言全部沒有意義').toBeGreaterThan(0)
  })


  // ── ★ 注入：證明「反序列化的事件確實走得到這個回呼」 ──────────────
  //
  // 🔴 沒有這一支的話，下面三條「不得觸發」可能只是因為**根本沒有事件**
  //    ——而那與「擋住了」在讀數上完全一樣。
  //
  // ⚠️ 所以這裡把**兩層保護都繞開**（`Events.disable` 與匯流排群組），
  //    直接反序列化一份狀態進去。它必須觸發回呼；不觸發就代表這支測試
  //    量的是一條死路，下面每一條的 0 都不算數。
  it('★ 注入：繞開兩層保護之後，反序列化【就會】被算成使用者編輯', async () => {
    const { panel, fired } = makePanel()
    // `disable`／`enable` 是一對**計數器**——只換掉一個的話另一個會把計數
    // 推到 -1，於是全域事件從此關閉，症狀是「後面每一支測試都莫名其妙變綠」。
    const real = { disable: Blockly.Events.disable, enable: Blockly.Events.enable }
    Blockly.Events.disable = (): void => {}
    Blockly.Events.enable = (): void => {}
    try {
      Blockly.serialization.workspaces.load(
        { blocks: { languageVersion: 0, blocks: [{ type: PROBE }] } },
        panel.getWorkspace()!,
      )
      await tick()
    } finally { Blockly.Events.disable = real.disable; Blockly.Events.enable = real.enable }
    expect(panel.getWorkspace()!.getAllBlocks(false).length, '積木沒載進去 → 這一條空過').toBe(1)
    expect(fired(), '繞開之後仍然是 0 → 這支測試量不到東西，下面三條都是假的')
      .toBeGreaterThan(0)
  })

  it('程式碼→積木【不得】觸發回呼', async () => {
    const { panel, fired } = makePanel()
    const ev: SemanticUpdateEvent = {
      tree: createNode('cpp:program', {}, {}),
      source: 'code',
      blockState: { blocks: { languageVersion: 0, blocks: [{ type: PROBE }] } },
    }
    panel.onSemanticUpdate(ev)
    await tick()
    // 先證明它真的載進去了——否則「沒觸發」只是因為什麼都沒發生
    expect(panel.getWorkspace()!.getAllBlocks(false).length, '積木沒載進去 → 這一條空過').toBe(1)
    expect(fired(), '每一次程式碼→積木都反手寫回文件 → 使用者的復原堆疊被灌爆').toBe(0)
  })

  it('resync 也一樣不得觸發', async () => {
    const { panel, fired } = makePanel()
    panel.onSemanticUpdate({
      tree: createNode('cpp:program', {}, {}),
      source: 'resync',
      blockState: { blocks: { languageVersion: 0, blocks: [{ type: PROBE }] } },
    })
    await tick()
    expect(panel.getWorkspace()!.getAllBlocks(false).length).toBe(1)
    expect(fired()).toBe(0)
  })

  it('載完之後使用者再動一次，仍然算使用者的', async () => {
    const { panel, fired } = makePanel()
    panel.onSemanticUpdate({
      tree: createNode('cpp:program', {}, {}),
      source: 'code',
      blockState: { blocks: { languageVersion: 0, blocks: [{ type: PROBE }] } },
    })
    await tick()
    expect(fired()).toBe(0)
    // 🔴 群組必須被還原——否則之後每一次使用者編輯都被吃掉，
    //    症狀是「積木拉了半天程式碼不動」。
    panel.getWorkspace()!.newBlock(PROBE)
    await tick()
    expect(fired(), '群組沒還原 → 使用者的編輯從此靜默').toBeGreaterThan(0)
  })

  // ── 🔴 使用者回報的那件事：舊世界的復原項活過了重畫 ──────────────
  //
  // 2026-08-19，Arduino IDE。診斷印出 `create｜cpp_var_declare｜頂層 2 顆`
  // 接三則 `move`——那是 Blockly 自己的復原在重放**重畫之前**的事件。
  //
  // ```
  // ① 使用者親手拉過一顆積木  → 復原堆疊 1 項
  // ② 從程式碼重畫            → 復原堆疊【仍然 1 項】  ← 修法前
  // ③ 按一次復原              → create 憑空長回來 → 自動同步寫進檔案
  // ```
  it('重畫之後，積木那側的復原歷史必須被清掉', async () => {
    const { panel } = makePanel()
    const ws = panel.getWorkspace()!

    // ① 正向錨點：使用者親手拉一顆，復原堆疊【必須】長出東西
    //    ——否則下面那個「必須是 0」只是因為它一直都是 0。
    ws.newBlock(PROBE)
    await tick()
    expect(ws.getUndoStack().length, '拉了一顆卻沒進復原堆疊 → 下面那條空過').toBeGreaterThan(0)

    // ② 從程式碼重畫
    panel.onSemanticUpdate({
      tree: createNode('cpp:program', {}, {}),
      source: 'code',
      blockState: { blocks: { languageVersion: 0, blocks: [{ type: PROBE }] } },
    })
    await tick()
    expect(ws.getUndoStack().length,
      '舊世界的復原項活過了重畫 → Cmd+Z 會把一個不存在的過去接回畫布').toBe(0)
  })

  // ⚠️ 這一支**單獨抓不到那個 bug**——修法退回去時它仍然是綠的（jsdom 裡
  //    重放沒有把積木加回來）。真正會變紅的是上面那條「復原堆疊必須是 0」。
  //    留著它是因為它釘的是**使用者看得到的那一面**，而那是這條規範的目的。
  it('重畫之後按復原，不得憑空長出積木', async () => {
    const { panel, fired } = makePanel()
    const ws = panel.getWorkspace()!
    ws.newBlock(PROBE)
    await tick()
    panel.onSemanticUpdate({
      tree: createNode('cpp:program', {}, {}),
      source: 'code',
      blockState: { blocks: { languageVersion: 0, blocks: [{ type: PROBE }] } },
    })
    await tick()
    const before = ws.getAllBlocks(false).length
    expect(before, '重畫沒把積木放上去 → 這一條空過').toBe(1)
    const firedBefore = fired()

    ws.undo(false)          // ← 焦點在面板上時，Cmd+Z 走的就是這條
    await tick()
    expect(ws.getAllBlocks(false).length, '復原重放了舊世界的事件').toBe(before)
    expect(fired(), '重放的事件被算成使用者編輯 → 自動同步把它寫進檔案').toBe(firedBefore)
  })

  // ── 🔴 第二層：重畫過程中【產生】的事件不得可復原 ────────────────
  //
  // `clearUndo()` 是**同步**清的，而 Blockly 的事件走
  // `requestAnimationFrame → setTimeout(0)`——排隊中的那些會落在清空【之後】，
  // 於是復原堆疊又有東西了。2026-08-19 第二次回報時就是卡在這一層。
  //
  // ⚠️ 這裡要繞開 `Events.disable()`，否則重畫根本不發事件，斷言會空過。
  // ⚠️ **這一支在 jsdom 裡兩邊都綠**（退回 `setRecordUndo` 實驗過）：
  //    `workspaces.load` 自己的預設就是 `recordUndo: false`，所以載入那一段
  //    本來就不可復原。`setRecordUndo` 真正在包的是 **`forceRenderAllBlocks`**
  //    ——而它在 jsdom 裡不產生事件（沒有真的排版），**這裡量不到**。
  //
  // 🔴 所以它是一支**釘住不變式、而目前抓不到迴歸**的測試。留著的理由是
  //    它會在「有人把 load 的 recordUndo 打開」時變紅；不留的話那個改動無聲。
  it('重畫過程中產生的事件，必須在【建立的當下】就被標成不可復原', async () => {
    const { panel } = makePanel()
    const ws = panel.getWorkspace()!
    const busEvents: Blockly.Events.Abstract[] = []
    ws.addChangeListener((e) => { if (e.group === 'semorphe:bus-update') busEvents.push(e) })

    const real = { disable: Blockly.Events.disable, enable: Blockly.Events.enable }
    Blockly.Events.disable = (): void => {}
    Blockly.Events.enable = (): void => {}
    try {
      panel.onSemanticUpdate({
        tree: createNode('cpp:program', {}, {}),
        source: 'code',
        blockState: { blocks: { languageVersion: 0, blocks: [{ type: PROBE }] } },
      })
      await tick()
    } finally { Blockly.Events.disable = real.disable; Blockly.Events.enable = real.enable }

    expect(busEvents.length, '重畫一則事件都沒發 → 下面那條空過').toBeGreaterThan(0)
    expect(busEvents.every((e) => e.recordUndo === false),
      `重畫的事件仍可復原 → 它們會落在 clearUndo() 之後，堆疊又有東西：` +
      busEvents.filter((e) => e.recordUndo !== false).map((e) => e.type).join('、'),
    ).toBe(true)
    expect(ws.getUndoStack().length, '排隊中的事件落在 clearUndo() 之後').toBe(0)
  })
})
