/**
 * **視圖登錄表** —— 加一個視圖 = 登錄一個 `ViewHost`，不是改 `app.ts`
 *
 * ## 為什麼需要它
 *
 * `ViewHost` 這個契約與 `SemanticBus` 都已經存在（specs 014／015），而**中間
 * 少了一格**：沒有任何地方持有「所有視圖」這個集合。
 *
 * 後果有兩個，而它們都不會報錯：
 *
 * **① `capabilities` 是一份沒有人讀的宣告。** 四個面板都誠實地宣告了
 * `editable`／`needsLanguageProjection`／`consumedAnnotations`，而**零讀取者**
 * ——那正是這個專案反覆遇到的「機制有了沒人接上」。
 *
 * **② 加第五個視圖要改 `app.ts`。** 而 `app.ts` 裡那段是硬編的：
 *
 * ```ts
 * if (…) this.monacoPanel?.setCode(data.code)
 * if (…) this.blocklyPanel?.onSemanticUpdate(data)
 * ```
 *
 * ⚠️ 更糟的是**同一件事有兩條線**：面板自己 `bus.on('semantic:update', …)`，
 * 而 `app.ts` 又直接呼叫 `panel.onSemanticUpdate(data)`。
 * 兩份真相，而它們今天剛好一致。
 *
 * ## 這個登錄表要為誰而存在
 *
 * 不是為了現在這四個面板——是為了**還沒寫的那些**：
 *
 * ```
 * 積木視圖    blockly-panel      形態投影
 * 程式碼視圖  monaco-panel       形態投影
 * 2D 組裝     circuit-2d-panel   形態投影（硬體域）
 * 3D 組裝     circuit-3d-panel   形態投影（硬體域）
 * 圖鑑        registry-browser   登錄表的視圖
 * ```
 *
 * `concepts/元件.md` 的五槽裡，**形態**（積木／文字／2D／3D／URDF）本來就是
 * **一個槽、多個值**。而今天的實作把它攤平成「render＝Blockly、generate＝文字」
 * ——這個登錄表是把那個攤平還原成集合的第一步。
 *
 * ## ⚠️ 它刻意**不做**的事
 *
 * - **不管視圖怎麼訂閱事件**——那是 `connectBus` 的事，面板自己決定要聽什麼。
 *   登錄表只回答「有哪些視圖」與「它們宣稱自己能做什麼」。
 * - **不管視圖的生命週期順序**——`initialize`／`dispose` 由呼叫端決定。
 *   把順序寫進登錄表等於發明一個沒有人要求的框架。
 */
import type { ViewHost } from './view-host'
import type { SemanticBus } from './semantic-bus'

const views = new Map<string, ViewHost>()

/**
 * 登錄一個視圖。
 *
 * @throws 同一個 `viewId` 登錄兩次——**靜默覆蓋的症狀是「某個面板不再更新」**，
 *   而那不會有任何錯誤訊息。
 */
export function registerView(view: ViewHost): void {
  const existing = views.get(view.viewId)
  if (existing && existing !== view) {
    throw new Error(
      `視圖 id「${view.viewId}」被登錄兩次（${existing.viewType} 與 ${view.viewType}）。` +
        'id 是這張表的鍵，重複會讓其中一個安靜地收不到更新。',
    )
  }
  views.set(view.viewId, view)
}

/** 全部已登錄的視圖。 */
export function registeredViews(): ViewHost[] {
  return [...views.values()]
}

/** `ViewHost` 契約上**必要**的成員。`onExecutionAtNode` 是可選的，不在此列。 */
const REQUIRED_MEMBERS = ['onSemanticUpdate', 'onExecutionState'] as const

/**
 * 這個東西是不是一個 `ViewHost`。
 *
 * ## ⚠️ 為什麼判準是 `viewId` 而不是「有沒有那兩個方法」
 *
 * 一個**部分實作**契約的面板（有 `viewId`、卻漏了 `onExecutionState`）用後者
 * 會被**靜默排除**——它不會被登錄，而畫面上的症狀是「那個面板不再更新」，
 * 沒有任何錯誤。這個專案已經被同一種靜默咬過很多次。
 *
 * 所以：**`viewId` 是自稱，而自稱了契約就必須完整**。不完整 → throw。
 *
 * > **讓「我不是視圖」與「我是視圖但漏了東西」分得出來。**
 */
export function isViewHost(x: unknown): x is ViewHost {
  if (typeof x !== 'object' || x === null) return false
  const v = x as Partial<ViewHost>
  if (typeof v.viewId !== 'string') return false // 不自稱是視圖——正常，不是錯誤

  const missing = REQUIRED_MEMBERS.filter((m) => typeof v[m] !== 'function')
  if (typeof v.capabilities !== 'object' || v.capabilities === null) missing.push('capabilities' as never)
  if (missing.length > 0) {
    throw new Error(
      `「${v.viewId}」有 viewId 卻沒有實作 ViewHost 的 ${missing.join('／')}。` +
        '它會被排除在視圖登錄表之外，而症狀是「這個面板不再更新」且沒有任何錯誤。',
    )
  }
  return true
}

/**
 * 掃一個容器，把裡面**所有** `ViewHost` 登錄進來。
 *
 * ## ⚠️ 這個函式存在的理由是一句曾經為假的註解
 *
 * 本檔檔頭寫著「加一個視圖 ＝ 登錄一個 `ViewHost`，不是改 `app.ts`」，
 * 而 `app.ts` 當時是**一份手寫的四元素陣列**——加第五個視圖一定要改它。
 *
 * > **一個註解宣稱「這個檔不用動」，而它下一行就是要動的地方。**
 *
 * 改成掃描之後那句話才是真的：面板只要實作契約就會被收，**呼叫端不用列名**。
 * 與 `registry.ts` 掃 `component.json` 是同一個形狀——
 * **手寫清單的維護成本，會在有人忘記的那天一次付清。**
 *
 * @returns 找到並登錄的視圖。回傳它是為了讓呼叫端能斷言數量
 *   （`build-guardrail` 第 9 步的入口條件：**計數器會數 ≠ 真的收到東西**）。
 */
export function registerViewsIn(container: object): ViewHost[] {
  const found = Object.values(container).filter(isViewHost)
  for (const v of found) registerView(v)
  return found
}

/**
 * 有某個能力的視圖。
 *
 * 這是 `capabilities` 的**第一個讀取者**——在此之前那份宣告沒有人看。
 *
 * ```ts
 * viewsWith('editable')                 // 哪些視圖可以編輯
 * viewsWith('needsLanguageProjection')  // 哪些視圖需要語言投影（硬體視圖不需要）
 * ```
 */
export function viewsWith(capability: 'editable' | 'needsLanguageProjection'): ViewHost[] {
  return registeredViews().filter((v) => v.capabilities[capability])
}

/**
 * 消費某個標註的視圖。
 *
 * ⚠️ 這一格今天只有 `blockly-panel` 填了（`control_flow`／`introduces_scope`）。
 * 它存在的理由是「一棵語義樹上掛的標註，該只算給真的有人讀的那些」
 * ——而在有登錄表之前，那個「有人讀」是查不到的。
 */
export function viewsConsuming(annotation: string): ViewHost[] {
  return registeredViews().filter((v) => v.capabilities.consumedAnnotations.includes(annotation))
}

/**
 * 把匯流排接到**全部已登錄的視圖**上。
 *
 * ⚠️ **只接 `ViewHost` 契約上的那兩個事件。** 面板自己還想聽別的
 * （`console-panel` 聽 `execution:output`）就自己 `connectBus`——
 * 那是面板的事，不是契約的事。
 *
 * ## ⚠️ 為什麼要收攏：契約在，而實作繞過它
 *
 * 在此之前四個面板的 `onExecutionState` **全部是空樁**，
 * 註解寫著「Handled via execution:state bus event」——
 * 真正的工作在各自的 `connectBus` 裡。
 *
 * > **一個契約如果沒有人透過它呼叫，那些方法就只是註解。**
 *
 * 而 `app.ts` 又硬編了第二條線（`this.blocklyPanel?.onSemanticUpdate(data)`），
 * 於是同一件事有兩條路，**而它們的條件不一樣**
 * （monaco 的自訂閱漏掉 `resync`，靠 app.ts 那條補）。
 *
 * ## ⚠️ `execution:state` 在此之前是**零發送者**
 *
 * ```
 * emit('execution:state')          整個 src/   0 次
 * this.panels.<某個>Panel          execution-controller.ts  81 次
 * ```
 *
 * `SemanticBus` 宣告了它、`ViewHost` 宣告了 `onExecutionState`，而**沒有人發**
 * ——執行器直接持有五個面板的引用。所以接這條線的同時，
 * `execution-controller.ts` 的 `displayStep` 也改成廣播（**那是第一個發送者**）。
 *
 * > **只接收端不夠。一條沒有人發的線，與一條沒有接的線，在執行時完全相同。**
 *
 * 剩下的 80 處是**命令**（`highlightBlock`／`revealLine`／`showTab`），
 * 不是廣播——它們要不要上匯流排是另一個題目。
 */
export function connectViews(bus: SemanticBus): void {
  bus.on('semantic:update', (d) => {
    for (const v of registeredViews()) v.onSemanticUpdate(d as never)
  })
  bus.on('execution:state', (d) => {
    for (const v of registeredViews()) v.onExecutionState(d)
  })
  // ⚠️ `onExecutionAtNode` 是**可選**的——沒有它就是明確地不接（主控台、變數面板）。
  // 這裡的 `?.` 是契約的一部分，不是防禦。
  bus.on('execution:at-node', (d) => {
    for (const v of registeredViews()) v.onExecutionAtNode?.(d)
  })
}

/** 測試用：清空登錄表。⚠️ 產品路徑不該呼叫它。 */
export function resetViews(): void {
  views.clear()
}
