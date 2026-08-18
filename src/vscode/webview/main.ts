/**
 * Webview 那一側的進入點——**畫布住在這裡，而它是瀏覽器環境**。
 *
 * ## 🔴 為什麼「畫布在 Webview」讓一個已知的坑繞得開
 *
 * `core/component/registry.ts:22-48` 記著一個實測過的代價：
 *
 * ```
 * Vite    → CJS 269 KB → node 跑得動 → 189 顆膠囊全部載入   🟢
 * esbuild → CJS 4.6 KB → 🔴 import_meta.glob is not a function
 * ```
 *
 * ⚠️ 而那 4.6 KB 才是重點——**esbuild 建得出來，只是膠囊一顆都沒被打包進去**，
 * 只發一則 warning，執行期才炸。
 *
 * 🔴 **而 lift／generate／執行【全部】住在這一側也是同一個理由**：
 * 它們都要膠囊登錄表。主行程只負責文件的讀寫與宿主整合。
 *
 * ## 🔴 用 `BlocklyPanel` 本身，不自己 inject
 *
 * 第一版在這裡手抄了 `Blockly.inject` 的七項設定。而 `BlocklyPanel.init()`
 * **本來就傳齊那七項**——手抄一份等於製造第二個真相。
 *
 * > **這個專案付過那個學費**（`history/072`：兩條產出路徑，一條綠一條錯）。
 *
 * 🟢 而用面板本身還順便拿到 `extractSemanticTree()` 與 `setState()`
 * ——**雙向同步的兩個方向都是它既有的能力**。
 *
 * ## 這個檔刻意不碰 `App`
 *
 * `ui/app.ts` 的 `App` 有 31 個欄位，其中 18 個是 per-document 的。
 * **本輪一個都不碰**——面板一次只服務一份文件，那 18 個
 * **從文件重算得出來**（量過 ≈ 13 ms），所以它們不是狀態，是快取。
 */
import * as Blockly from 'blockly'
import { initCppModule } from '../../languages/cpp/module'
import { registerCppLanguage } from '../../languages/cpp/generators'
import { registeredComponents } from '../../core/component/registry'
import { BlockRegistrar } from '../../ui/block-registrar'
import { BlocklyPanel } from '../../ui/panels/blockly-panel'
import { LocaleLoader } from '../../i18n/loader'
import { generateCode } from '../../core/projection/code-generator'
import { rewriteSpan } from '../../core/projection/rewrite-span'
import { renderToBlocklyState } from '../../core/projection/block-renderer'
import { DEFAULT_CONFIG } from '../sync/settings'
import type { PanelConfig } from '../sync/settings'
import { setupWorkspace } from './workspace-setup'
import { createCodeLifter, type CodeLifter } from './lift'
import { nodeIdAtLine, rangeOfNodeId } from './highlight'
import { createRunner, type Runner } from './run'
import { attachDragMeter } from './fps'
import type { HostMessage, WebviewMessage } from '../sync/messages'
import type { SemanticNode } from '../../core/types'

declare function acquireVsCodeApi(): { postMessage(m: unknown): void }

/** 沒有宿主時（Chromium 預檢）也要跑得起來——⚠️ 而**要看得出是哪一種**。 */
const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null
const post = (m: WebviewMessage): void => vscode?.postMessage(m)

function row(label: string, value: string, warn = false): string {
  return `<div class="row"><span class="k">${label}</span><span class="v${warn ? ' warn' : ''}">${value}</span></div>`
}

export async function boot(): Promise<void> {
  const readout = document.getElementById('readout')!
  const canvas = document.getElementById('canvas')!

  // 0. 語言套件的產生器、執行器、註解語法…
  //    🔴 **漏掉它的症狀是「單步一按就 RUNTIME_ERR_UNKNOWN_CONCEPT: cpp:program」**
  //       ——而積木與程式碼那兩個方向【看起來完全正常】。
  //       ⚠️ 一個只在第三個功能上現形的缺失。
  registerCppLanguage()

  // 1. 膠囊登錄表 ＋ 六個引擎。⚠️ 這一行就是「核搬得過去嗎」的答案。
  const { registry } = initCppModule()
  const capsules = registeredComponents().length

  // 2. i18n——⚠️ 不載的話積木上顯示的是 `%{BKY_U_BREAK_MSG0}` 這種原文。
  //    🔴 而它要在 buildToolbox 之前：工具箱的分類名也走 `Blockly.Msg`。
  const locale = new LocaleLoader()
  locale.setBlocklyMsg(Blockly.Msg as Record<string, string>)
  await locale.load(DEFAULT_CONFIG.locale)

  // 3. 積木定義：登錄表 → Blockly.Blocks
  const panelRef: { panel: BlocklyPanel | null } = { panel: null }
  new BlockRegistrar(registry).registerAll({
    getWorkspace: () => panelRef.panel?.getWorkspace() ?? null,
  })

  // 4. 組態 → 工作區（目標／課程清單／風格／工具箱）
  let config: PanelConfig = DEFAULT_CONFIG
  let setup = setupWorkspace(registry, config)

  // 5. 畫布——🔴 **用面板本身**，七項設定住在它裡面（見檔頭）。
  //
  // ⚠️ `media` 少一個尾端斜線的話會變成 `.../mediasprites.png`
  //    ——Blockly 直接把它當前綴接檔名。而症狀是**破圖但功能還在**。
  const mediaRaw = canvas.dataset.blocklyMedia ?? ''
  const media = mediaRaw && !mediaRaw.endsWith('/') ? `${mediaRaw}/` : mediaRaw
  const panel = new BlocklyPanel({
    container: canvas,
    blockSpecRegistry: registry,
    media: media || undefined,
    language: 'cpp',
    style: setup.style,
  })
  panelRef.panel = panel
  panel.init(setup.toolbox)

  // 5b. code → blocks 的管線。⚠️ wasm 與 Blockly 的 media 同一個目錄。
  //     🔴 **失敗要看得見**：載不起來的話積木永遠不會跟著程式碼變，
  //        而那**不會拋錯到任何人看得到的地方**。
  let lifter: CodeLifter | null = null
  let lifterError: string | null = null
  createCodeLifter(registry, setup.topic, media.replace(/media\/$/, ''))
    .then((l) => { lifter = l; render(); applyDocument() })
    .catch((e: unknown) => {
      lifterError = e instanceof Error ? e.message : String(e)
      render()
    })

  // ── 狀態：一次只服務一份文件 ──
  let docText: string | null = null
  let docVersion = -1
  let docUri: string | null = null
  /** 🔴 收到文件而正在重繪積木時，積木事件不得回寫——那是回音的另一半。 */
  let applyingFromDocument = false
  let editCount = 0
  /** 🔴 **只在真的產生編輯時更新** —— 見下面那段註解。 */
  let lastSpanLines = -1
  /** 沒有造成程式碼變化的積木事件（拖動位置、選取…）。FR-003 靠它看得見。 */
  let noopEvents = 0
  /** 目前這份文件的語義樹——高亮的兩個方向都查它。 */
  let currentTree: SemanticNode | null = null
  /** 🔴 選取的防迴圈：**值相等就不再傳播**。選取是冪等的，所以值比對就夠。 */
  let selectedNodeId: string | null = null
  let unmappedSelections = 0
  /**
   * ⚠️ **宣告要在 `render()` 第一次被呼叫之前** ——
   * 第一版宣告在下面的 7c，而 `render()` 讀它 → `Cannot access 'runner'
   * before initialization`，畫布整片空白。
   *
   * 🟢 而它**看得見**，因為 `boot()` 的 catch 把錯誤印在讀數上。
   * **一個空白的畫布與一個載壞的畫布長得一樣——除非有人把它印出來。**
   */
  let runner: Runner | null = null

  // 6. 積木改了 → 只重寫改到的那一段
  panel.onChange(() => {
    if (applyingFromDocument || docText === null) return
    const tree = panel.extractSemanticTree()
    const next = generateCode(tree, 'cpp', setup.style)
    // 🔴 拿【文件的實際文字】比，不是拿 generate(原樹) 比。
    //    理由與那次量錯寫在 `core/projection/rewrite-span.ts` 的檔頭。
    const span = rewriteSpan(docText, next)
    if (span === null) {
      // ⚠️ 純移動積木不改變程式碼 → **不產生檔案變更**（FR-003）。
      //
      // 🔴 **這裡刻意【不】覆寫 `lastSpanLines`。**
      // Blockly 一次操作會派送多個事件（create／move／…），而第二個事件
      // 重算時 `docText` 已經樂觀更新過 → 算出 `null`。
      // 覆寫的話讀數會變成「第幾次編輯 1，這次改了幾行 0」
      // ——**一個自相矛盾而且會誤導交棒的讀數**。
      noopEvents++
      render()
      return
    }
    editCount++
    lastSpanLines = Math.max(span.endLine - span.startLine, span.lines.length)
    // ⚠️ 樂觀更新：主行程套用之後會回一個新版本，而那時 `docText` 會被覆蓋。
    docText = next
    post({ type: 'applyEdit', span, baseVersion: docVersion })
    render()
  })

  // 7. 讀數——🔴 交棒要看它（見 `specs/139/quickstart.md` 第三節）。
  const render = (meter = ''): void => {
    const cats = (setup.toolbox as { contents?: unknown[] }).contents?.length ?? 0
    readout.innerHTML =
      row('膠囊', String(capsules), capsules < 200) +
      row('工具箱分類', String(cats), cats === 0) +
      row('目標', `${setup.target.id}／${setup.topic.id}／${setup.style.id}`) +
      row('文件', docUri === null ? '（未連接）' : `${docUri.split('/').pop()}　v${docVersion}`,
        docUri === null) +
      row('第幾次編輯', String(editCount)) +
      row('上次編輯改了幾行', lastSpanLines < 0 ? '—' : String(lastSpanLines)) +
      // FR-003：拖動位置不該產生檔案變更——這一格讓「沒變更」看得見，
      // ⚠️ 而不是靠「什麼都沒發生」去推論。
      row('無變更的積木事件', String(noopEvents)) +
      // 🔴 lift 載不起來的話「積木永遠不跟著程式碼變」，而那不會拋錯到
      //    任何人看得到的地方——所以它必須是讀數上的一格。
      row('目前選取', selectedNodeId === null ? '（無）' : selectedNodeId.slice(0, 12)) +
      row('指不到程式碼的選取', String(unmappedSelections), unmappedSelections > 0) +
      row('執行步數', runner === null ? '—' : String(runner.steps)) +
      row('程式碼→積木',
        lifterError !== null ? `🔴 ${lifterError}` : lifter ? '就緒' : '載入中…',
        lifterError !== null) +
      meter
  }
  render()

  /**
   * 把目前的文件畫成積木。
   *
   * 🔴 `applyingFromDocument` 期間積木事件**不得回寫**——那是回音的另一半：
   * 主行程用 `version` 擋住「我們寫的文字回來了」，而這裡擋住
   * 「我們畫的積木觸發了回寫」。**兩邊都要，缺一個就是迴圈。**
   *
   * ⚠️ 而重繪**不進 Blockly 的 undo 堆疊**——它不是使用者的操作。
   */
  function applyDocument(): void {
    if (!lifter || docText === null) return
    const text = docText
    void lifter.lift(text).then((tree) => {
      if (!tree || docText !== text) return   // 期間又換文件了 → 這次的結果過期
      currentTree = tree
      applyingFromDocument = true
      Blockly.Events.setRecordUndo(false)
      try {
        // ⚠️ 走**與網頁版同一個** `renderToBlocklyState`
        //    （`ui/sync-controller.ts:324`）——不自己再組一份。
        panel.onSemanticUpdate({
          source: 'code',
          tree,
          blockState: renderToBlocklyState(tree),
        } as never)
      } catch (e) {
        console.error('[semorphe] 畫積木失敗', e)
      } finally {
        Blockly.Events.setRecordUndo(true)
        applyingFromDocument = false
      }
      render()
    })
  }

  // 7b. 積木 → 程式碼的高亮
  //
  // 🔴 **值相等就不再傳播**：選取是冪等的（「選同一個」與「不選」效果一樣），
  //    所以值比對就夠——⚠️ 而它**不可以**套用文字編輯那套身分機制，
  //    因為文字編輯不是冪等的。**兩個問題長得像，而它們的性質不同。**
  panel.onNodeSelect((nodeId) => {
    if (nodeId === selectedNodeId) return
    selectedNodeId = nodeId
    const range = nodeId && currentTree ? rangeOfNodeId(currentTree, nodeId) : null
    if (nodeId && range === null) unmappedSelections++
    post({ type: 'revealNode', nodeId, range })
    render()
  })

  // 8. 宿主送東西進來
  window.addEventListener('message', (e: MessageEvent<HostMessage>) => {
    const msg = e.data
    if (msg.type === 'document') {
      docText = msg.text
      docVersion = msg.version
      docUri = msg.uri
      applyDocument()
      render()
    } else if (msg.type === 'config') {
      // 🔴 組態變了 → 工具箱與風格要跟著換，而積木要用新風格重畫。
      //    ⚠️ 而 `applyDocument()` 走的是同一條路——不另外寫一份重建邏輯。
      config = msg.config
      setup = setupWorkspace(registry, config)
      panel.setCodeContext('cpp', setup.style)
      panel.init(setup.toolbox)
      applyDocument()
      render()
    } else if (msg.type === 'viewState') {
      const ws2 = panel.getWorkspace()
      if (ws2) {
        // ⚠️ 縮放與捲動要在積木畫完之後才套——順序反了會被重繪蓋掉。
        ws2.setScale(msg.state.scale)
        ws2.scroll(msg.state.scrollX, msg.state.scrollY)
      }
    } else if (msg.type === 'selection') {
      // 程式碼 → 積木。⚠️ 同一個防迴圈：值相等就不動。
      if (!currentTree) return
      const nodeId = nodeIdAtLine(currentTree, msg.line)
      if (nodeId === selectedNodeId) return
      selectedNodeId = nodeId
      // ⚠️ 用面板既有的 highlightByNodeId——**不自己再做一份反查**。
      panel.highlightByNodeId(nodeId, 'code-to-block')
      render()
    } else if (msg.type === 'noDocument') {
      docText = null
      docUri = null
      docVersion = -1
      render()
    }
  })

  post({ type: 'ready', capsules, specs: registry.getAll().length })

  // 7c. 單步執行 —— 🔴 目的是【看見程式在積木上走過去】，不是跑完。
  const outEl = document.getElementById('out')!
  const stepBtn = document.getElementById('step') as HTMLButtonElement
  const stopBtn = document.getElementById('stop') as HTMLButtonElement
  const stateEl = document.getElementById('runstate')!

  const runnerHooks = {
    // 🔴 唯一真實：執行到哪個節點。兩個視圖各自投影它。
    atNode(nodeId: string | null): void {
      panel.highlightByNodeId(nodeId, 'execution')
      const range = nodeId && currentTree ? rangeOfNodeId(currentTree, nodeId) : null
      post({ type: 'executionAt', nodeId, range })
    },
    output(text: string): void { outEl.textContent += text },
    stateChanged(s: string): void {
      stateEl.textContent = s === 'idle' ? '閒置' : s === 'paused' ? `暫停（第 ${runner?.steps ?? 0} 步）` : '執行中'
      render()
    },
  }

  stepBtn.addEventListener('click', () => {
    if (!currentTree) return
    if (!runner || runner.state === 'idle') {
      outEl.textContent = ''
      runner = createRunner(currentTree, runnerHooks)
    }
    void runner.step()
  })
  stopBtn.addEventListener('click', () => {
    runner?.stop()
    runner = null
  })

  // 8b. 視圖狀態——⚠️ 它是**外觀**不是真相（程式碼才是），
  //     所以它不進文件，只進 per-uri 的儲存。
  const ws = panel.getWorkspace()
  if (ws) {
    ws.addChangeListener((e: Blockly.Events.Abstract) => {
      // 只在捲動／縮放這類純外觀的事件上存——⚠️ 而積木位置由 Blockly 自己管。
      if (e.type !== 'viewport_change') return
      post({
        type: 'viewStateChanged',
        state: { scrollX: ws.scrollX, scrollY: ws.scrollY, scale: ws.getScale(), blockPositions: {} },
      })
    })
  }

  // 9. 拖曳量測。判準寫在 `fps.ts`，⚠️ 結論由數字算出，不由人填。
  if (ws) attachDragMeter(ws, (html) => render(html))

  // 10. 除錯把手——照網頁版 `src/main.ts:11` 的 `window.__app` 慣例。
  //     ⚠️ 它**不是 API**：欄位名隨時會變，沒有人可以依賴它。
  ;(window as unknown as { __semorphe?: unknown }).__semorphe = {
    Blockly, panel, registry, get setup() { return setup }, get config() { return config },
    setConfig: (c: PanelConfig) => { config = c; setup = setupWorkspace(registry, c) },
  }
}

boot().catch((err: unknown) => {
  // ⚠️ **失敗要看得見**。一個空白的畫布與一個載壞的畫布長得一樣。
  const el = document.getElementById('readout')
  const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err)
  if (el) el.innerHTML = `<pre class="fatal">🔴 啟動失敗\n${msg}</pre>`
  console.error('[semorphe] boot failed', err)
})
