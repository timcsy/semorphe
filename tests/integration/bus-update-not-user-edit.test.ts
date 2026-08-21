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

/**
 * 讓 Blockly 排隊中的事件流乾。
 *
 * ⚠️ **它只是「讓佇列跑一輪」，不是「等某件事發生」**——需要等某件事的地方
 * 用下面的 `until()`。
 *
 * 🔴 **而有一種地方 `until()` 幫不上忙：負向斷言**（「不得觸發」）。
 * 沒辦法輪詢「某件事**沒有**發生」——輪到它成立就只是「它還沒發生」而已。
 *
 * 而兩者等太短的**後果相反**：
 *
 * | | 等太短的症狀 |
 * |---|---|
 * | 正向（`toBeGreaterThan(0)`） | **假紅**——機器忙的時候它說「產品壞了」 |
 * | 負向（`.toBe(0)`） | **假綠**——安靜地變弱，永遠不會有人發現 |
 *
 * 所以負向斷言的正確做法不是等更久，是**釘在一個已經完成的正向代理之後**：
 * 先 `until(積木載進去了)`，再斷言「而回呼沒響」。那時「沒響」才有意義
 * ——因為**會讓它響的那件事已經跑完了**。
 */
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 60))

/**
 * 🔴 **等條件，不等時間。**
 *
 * ## 為什麼有這一支
 *
 * 這個檔原本每一處都 `await tick()`（固定 60ms）然後直接斷言。
 * 單獨跑 3/3 全過，而**全套跑的時候紅過四次**（2026-08-20 一個 session 裡）：
 * 幾百支測試同時搶 CPU，60ms 不夠讓 `requestAnimationFrame → setTimeout(0)` 跑完。
 *
 * > **一支靠固定時間等的測試，在機器忙的時候會說謊——而它說的是「產品壞了」。**
 *
 * ⚠️ 而它的代價比「偶爾要重跑」大得多：這個檔是**護欄**，
 * 而專案自己的判準是「**亂叫的護欄很快就會被忽略**」
 * （`audit-toolbox-reachability.test.ts:192` 逐字）。
 *
 * 🟢 輪詢到條件成立為止，逾時才失敗——**快的機器上更快，慢的機器上不會說謊**。
 */
async function until(
  pred: () => boolean,
  why: string,
  // 🔴 **3000 不夠**（2026-08-21 第三次紅）：機器降頻 ＋ 四個 worker 搶 CPU 時，
  // `requestAnimationFrame → setTimeout(0)` 這條鏈跑不完，於是 `until` 自己逾時，
  // 而它的訊息寫「條件仍不成立」——**讀起來像產品壞了**。
  //
  // 放寬的理由與 `vitest.config.ts` 的 `testTimeout: 60000` 逐字相同：
  // **通過時這個數字不花任何時間**（條件成立就立刻回），只在真的卡住時才付。
  timeoutMs = 15000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (pred()) {
      // 🔴 **條件成立 ≠ 佇列排乾了。**（2026-08-21，把 `tick` 換成 `until` 時當場撞到）
      //
      // `tick()` 的 60ms 在做**兩件事**：等條件、以及**把 Blockly 排隊中的
      // `requestAnimationFrame → setTimeout(0)` 排乾**。而 `until` 條件一成立
      // 就回（可能 10ms），第二件事**被一起拿掉了**——殘留的事件漏進下一支測試，
      // 於是**別支**測試莫名其妙紅（實測：改完之後 14 綠變成 2 紅，
      // 而那兩支我一行都沒動）。
      //
      // > **一個固定的等待，往往同時是「等」與「讓別人跑完」。
      // > 換成條件輪詢只保住了前者，而後者是沒有人寫下來的那一半。**
      await tick()
      return
    }
    if (Date.now() > deadline) throw new Error(`等了 ${timeoutMs}ms 條件仍不成立：${why}`)
    await new Promise((r) => setTimeout(r, 10))
  }
}

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
    await until(() => fired() > 0, '回呼從來不響的話，負向斷言全部沒有意義')
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
    await until(() => panel.getWorkspace()!.getAllBlocks(false).length === 1, '積木沒載進去 → 這一條空過')
    await until(() => fired() > 0, '繞開之後仍然是 0 → 這支測試量不到東西，下面三條都是假的')
  })

  it('程式碼→積木【不得】觸發回呼', async () => {
    const { panel, fired } = makePanel()
    const ev: SemanticUpdateEvent = {
      tree: createNode('cpp:program', {}, {}),
      source: 'code',
      blockState: { blocks: { languageVersion: 0, blocks: [{ type: PROBE }] } },
    }
    panel.onSemanticUpdate(ev)
    // 先等它真的載進去——否則「沒觸發」只是因為什麼都還沒發生（見 `tick` 檔頭）
    await until(() => panel.getWorkspace()!.getAllBlocks(false).length === 1, '積木沒載進去 → 這一條空過')
    expect(fired(), '每一次程式碼→積木都反手寫回文件 → 使用者的復原堆疊被灌爆').toBe(0)
  })

  it('resync 也一樣不得觸發', async () => {
    const { panel, fired } = makePanel()
    panel.onSemanticUpdate({
      tree: createNode('cpp:program', {}, {}),
      source: 'resync',
      blockState: { blocks: { languageVersion: 0, blocks: [{ type: PROBE }] } },
    })
    await until(() => panel.getWorkspace()!.getAllBlocks(false).length === 1, 'resync 沒載進去 → 下面那條空過')
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
    await until(() => fired() > 0, '群組沒還原 → 使用者的編輯從此靜默')
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
    await until(() => ws.getUndoStack().length > 0, '拉了一顆卻沒進復原堆疊 → 下面那條空過')

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
    await until(() => ws.getAllBlocks(false).length === 1, '重畫沒把積木放上去 → 這一條空過')
    const before = ws.getAllBlocks(false).length
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
      // ⚠️ 等**事件真的到**，不是等 60ms——這一支是第 0 步漏掉的最後一個
      // 固定時間等（spec 162 選入宣告式建構器之後，重畫多做了一點事就不夠了）。
      await until(() => busEvents.length > 0, '重畫一則事件都沒發 → 下面那條空過')
    } finally { Blockly.Events.disable = real.disable; Blockly.Events.enable = real.enable }

    expect(busEvents.every((e) => e.recordUndo === false),
      `重畫的事件仍可復原 → 它們會落在 clearUndo() 之後，堆疊又有東西：` +
      busEvents.filter((e) => e.recordUndo !== false).map((e) => e.type).join('、'),
    ).toBe(true)
    expect(ws.getUndoStack().length, '排隊中的事件落在 clearUndo() 之後').toBe(0)
  })

  // ── 🔴 啟動競態：還沒被畫過的工作區不得寫回 ──────────────────────
  //
  // 2026-08-19 的時間軸（Arduino IDE）：
  //
  // ```
  // 1｜   +0ms｜📄 宿主送來文件｜版本 1｜10 行
  // 2｜ +125ms｜⛔ 擋下：6 → 0 行（少了 6）    ← 拿【空的】工作區去寫檔案
  // 5｜ +816ms｜🔄 重畫 ← code｜重畫前頂層 0 顆  ← 積木這時才第一次載入
  // ```
  //
  // 安全網擋下來了，⚠️ **而它只擋「少一半以上」**——少一點的擋不住。
  it('還沒被匯流排畫過的工作區，必須算「殘的」', async () => {
    const { panel } = makePanel()
    expect(panel.isStateStale, '沒畫過卻不算殘 → 啟動的那一秒可以把檔案寫空').toBe(true)

    panel.onSemanticUpdate({
      tree: createNode('cpp:program', {}, {}),
      source: 'code',
      blockState: { blocks: { languageVersion: 0, blocks: [{ type: PROBE }] } },
    })
    // 正向錨點：畫過之後【必須】解除，否則這個旗標等於永久停用寫回
    await until(() => !panel.isStateStale, '畫過了還算殘 → 積木永遠寫不回程式碼')
  })

  // ── 🔴 第三層：重畫【之後】那一幀內建立的事件也不得可復原 ────────
  //
  // 使用者逐字確認（2026-08-19）第 6 則是「按了 Cmd+Z」，而時間軸顯示
  // 重畫時堆疊是 0——**所以有東西在重畫之後才進來**。
  // 有 mutator 的積木，其形狀更新被 Blockly 延到下一幀。
  //
  // ⚠️ **代價寫在這裡**：這一幀（約 16 ms）內使用者若剛好動了積木，
  //    那一步會失去復原。這是刻意的——而它比「事後清空」好，因為清空
  //    **分不出那一項是誰放的**（第一版就是這樣寫的，這支測試當場紅）。
  it('重畫之後那一幀內建立的事件，不得進復原堆疊', async () => {
    const { panel } = makePanel()
    const ws = panel.getWorkspace()!
    panel.onSemanticUpdate({
      tree: createNode('cpp:program', {}, {}),
      source: 'code',
      blockState: { blocks: { languageVersion: 0, blocks: [{ type: PROBE }] } },
    })
    // ★ 錨點：**窗口真的開著**——在此之前這件事只能靠時間推論。
    expect(panel.isRedrawWindowOpen(), '窗口沒開 → 這一條在測一個不存在的情況').toBe(true)
    // 同步窗口【之後】才動手——模擬「被延到下一幀」的那些事件。
    ws.newBlock(PROBE)
    // 🔴 **缺席斷言不能等固定時間**——要等到窗口**真的關了**（一個正向訊號），
    // 那時候「還沒進堆疊」才是結論，而不是「還沒來得及進」。
    await until(() => !panel.isRedrawWindowOpen(), '窗口一直沒關')
    expect(ws.getAllBlocks(false).length, '（錨點）積木真的建出來了').toBe(2)
    expect(ws.getUndoStack().length,
      '重畫之後那一幀建立的事件仍可復原 → Cmd+Z 會重放一個不屬於這個世界的動作').toBe(0)
  })

  it('窗口關掉之後，使用者的動作【必須】重新可復原', async () => {
    const { panel } = makePanel()
    const ws = panel.getWorkspace()!
    panel.onSemanticUpdate({
      tree: createNode('cpp:program', {}, {}),
      source: 'code',
      blockState: { blocks: { languageVersion: 0, blocks: [{ type: PROBE }] } },
    })
    await until(() => !panel.isRedrawWindowOpen(), '窗口一直沒關 → 下面那條會測到窗口內的行為')
    ws.newBlock(PROBE)
    // 🔴 沒有這一條的話，「永遠不記復原」也能讓上面那支通過
    //    ——而那等於把積木的復原整個關掉。
    await until(() => ws.getUndoStack().length > 0, '窗口沒關 → 積木的復原被永久停用')
  })

  // ── 🔴 拖曳過程不得寫檔案 ────────────────────────────────────────
  //
  // 2026-08-19 兩份時間軸拼起來：**一次拖曳產生兩次寫入**，
  // 而它們各自是編輯器裡的一個復原項——於是 Cmd+Z 還原到的是
  // 「拖到一半」的中間狀態（`int x;` 同時在 loop 裡和最外層），
  // **而使用者從來沒看過那個狀態**。
  // ── 🔴 改欄位的中途也不得寫 ────────────────────────────────────
  //
  // 2026-08-19 使用者按第 1 條驗收時抓到：把 `x` 改成 `y`，⌘Z 要按**兩次**，
  // 而中間那一步是 **`int ;`**——**欄位被清空的那一瞬間也被寫進了檔案**，
  // 那是一個他從來沒有輸入過的狀態。
  //
  // ⚠️ 文字欄位用 `WidgetDiv`、下拉用 `DropDownDiv`——**兩個不同的容器**，
  //    只問一個會漏掉另一半。
  it('欄位編輯器開著時不得寫回，關掉之後補一次', async () => {
    const { panel, fired } = makePanel()
    const ws = panel.getWorkspace()!
    panel.onSemanticUpdate({
      tree: createNode('cpp:program', {}, {}),
      source: 'code',
      blockState: { blocks: { languageVersion: 0, blocks: [{ type: PROBE }] } },
    })
    // 🔴 同上：base 取早了的話下游全錯
    await until(() => ws.getAllBlocks(false).length === 1, '匯流排還沒畫完就取基準')
    const base = fired()

    const realVisible = Blockly.WidgetDiv.isVisible
    Blockly.WidgetDiv.isVisible = (): boolean => true
    ws.newBlock(PROBE)
    await tick()
    expect(fired(), '編輯到一半就寫檔案 → ⌘Z 會停在 `int ;` 那種狀態').toBe(base)

    // 🔴 關掉之後【必須】補寫——而這裡**不會再有新的積木事件**，
    //    所以它證明的是輪詢那條路，不是「下一則事件順便寫掉」。
    Blockly.WidgetDiv.isVisible = realVisible
    // ⚠️ 這裡等的是**輪詢那條路**補寫——原本寫死 300ms，而輪詢的間隔一旦
    // 因為機器忙而落在 300ms 之外，這一支就會說「產品沒補寫」。
    await until(() => fired() > base, '編輯器關了卻沒補寫 → 使用者的修改永遠不進檔案')
  })

  it('下拉選單開著時也一樣（兩個是不同的容器）', async () => {
    const { panel, fired } = makePanel()
    const ws = panel.getWorkspace()!
    panel.onSemanticUpdate({
      tree: createNode('cpp:program', {}, {}),
      source: 'code',
      blockState: { blocks: { languageVersion: 0, blocks: [{ type: PROBE }] } },
    })
    // 🔴 base 取早了的話下游三條全錯——先等匯流排真的畫完
    await until(() => ws.getAllBlocks(false).length === 1, '匯流排還沒畫完就取基準')
    const base = fired()
    const real = Blockly.DropDownDiv.isVisible
    Blockly.DropDownDiv.isVisible = (): boolean => true
    ws.newBlock(PROBE)
    await tick()
    expect(fired(), '只擋 WidgetDiv 會漏掉下拉').toBe(base)
    Blockly.DropDownDiv.isVisible = real
    // ⚠️ 原本是硬等 300ms——同一個病，只是數字大一點
    await until(() => fired() > base, '下拉關掉之後沒補寫')
  })

  it('拖曳中的變動不得觸發寫回，放下之後補一次', async () => {
    const { panel, fired } = makePanel()
    const ws = panel.getWorkspace()!
    // 讓匯流排先畫過一次，否則 isStateStale 會擋住（那是另一條規範）
    panel.onSemanticUpdate({
      tree: createNode('cpp:program', {}, {}),
      source: 'code',
      blockState: { blocks: { languageVersion: 0, blocks: [{ type: PROBE }] } },
    })
    // 🔴 同上：base 取早了的話下游全錯
    await until(() => ws.getAllBlocks(false).length === 1, '匯流排還沒畫完就取基準')
    const base = fired()

    // ① 拖曳中——不得寫
    const realIsDragging = ws.isDragging.bind(ws)
    ws.isDragging = (): boolean => true
    ws.newBlock(PROBE)
    await tick()
    expect(fired(), '拖到一半就寫檔案 → Cmd+Z 會還原到使用者沒看過的狀態').toBe(base)

    // ② 放下之後——**必須**補寫。
    //    🔴 沒有這一條的話，「永遠不寫」也能讓上面那條通過，而那是更糟的 bug。
    ws.isDragging = realIsDragging
    ws.newBlock(PROBE)
    await until(() => fired() > base, '放下之後沒補寫 → 使用者的那一步永遠不會進檔案')
  })
})
