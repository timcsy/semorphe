/**
 * **主控台這個表面**——它可以關，而它必須叫得回來（spec 171）。
 *
 * ## 🔴 它從哪來
 *
 * 使用者 2026-09-02：「讓最底下水平**完全展開**是放主控台……然後主控台
 * 可以**關閉或是開啟**，行為跟 VSCode 那邊類似」。
 *
 * 🪦 而它反轉了第八十一條護欄的 I4：「`state` 必須在每一個版面裡恰好一個
 * 連續矩形——**不得缺席**」。
 *
 * > **「不准關」是一條擋住使用者的規範；
 * > 而「一定回得來」才是那條規範真正要保護的東西
 * > ——使用者【看不到程式在說什麼】。**
 *
 * ## ⚠️ 「有輸出就自己回來」住在共用的那一側
 *
 * 它寫在 `ConsolePanel` 的**寫入路徑**上，不是各宿主各寫一份。
 * 兩個宿主各寫一次的話，其中一個遲早會漏——而漏掉的症狀是使用者
 * **看不到程式在說什麼**，那與「程式當掉了」長得一樣。
 */
export interface ConsoleSurface {
  /** 把它叫回來。⚠️ 已經開著時**必須是 no-op**——不得跳動或搶焦點。 */
  show(): void
  /** 使用者關掉它。 */
  hide(): void
  /** 它現在關著嗎。 */
  isHidden(): boolean
}

/**
 * 有東西要寫進主控台時：**關著就先把它叫回來**。
 *
 * 🔴 而「程式在等輸入」**也算**——`cin` 的提示不出現的話，
 * 使用者會以為程式當掉了。
 *
 * > **一個「程式在等你」的狀態，如果沒有地方顯示，
 * > 它與「程式壞了」長得一樣。**
 *
 * @returns 這一次有沒有真的把它叫回來（給測試與診斷看）
 */
export function revealForOutput(surface: ConsoleSurface | null | undefined): boolean {
  if (!surface || !surface.isHidden()) return false
  surface.show()
  return true
}

/**
 * **這一則要不要把主控台叫回來**（2026-09-02）。
 *
 * ## 🔴 病歷：「好像被卡在主控台，而且我點其他的 tab 是切不過去的」
 *
 * 主控台變成宿主 panel 區的一個原生分頁之後，我在**每一則**送過去的訊息上
 * 都叫了一次 `show()`——包括 `clear`。而 `clear` 很吵（每次重跑、每次
 * 執行狀態重置都會發一則），於是使用者一點「終端機」，下一則 `clear`
 * 就把面板搶回主控台——**看起來像切不過去**。
 *
 * > **「有輸出就自己回來」的主詞是【輸出】。
 * > 把它寫成「有訊息就回來」，那個面板就再也放不掉。**
 *
 * 兩條規則：
 *
 * ```
 * ① 清空不算輸出          它是「準備要跑了」，不是「程式在說話」
 * ② 一次執行只搶一次       第一則輸出把它叫回來；之後由使用者決定要看哪一頁
 * ```
 *
 * @param m 送給主控台那個視圖的那一則
 * @param revealedThisRun 這一輪執行已經叫過了嗎（`clear` 會把它重設）
 */
export function shouldRevealForConsoleMessage(
  m: { chunk?: string; clear?: boolean; awaitingInput?: string },
  revealedThisRun: boolean,
): boolean {
  // ⚠️ `clear` ＝ 新的一輪要開始了——不叫人，而是把「叫過了」重設。
  if (m.clear) return false
  if (revealedThisRun) return false
  return (m.chunk !== undefined && m.chunk !== '') || m.awaitingInput !== undefined
}

/**
 * **這個視窗是「畫輸出的人」還是「產生輸出的人」**（2026-09-02）。
 *
 * ## 🔴 病歷：一個回音圈
 *
 * 主控台搬進宿主的 panel 區之後有兩種視窗：跑程式的（積木／流程）與
 * 畫輸出的（主控台）。而第一版**兩邊都接了兩個方向**——畫的人把它畫下來的
 * 每一個字又報回宿主，宿主再轉回來：
 *
 * ```
 * 主控台視圖 write("hello") → onOutput → 報給宿主 → 轉回主控台視圖
 *   → write("hello") → …
 * ```
 *
 * 使用者看到的是：「執行了一次，結果**字被銜接在之後**，然後**還是一直閃**」，
 * 以及「好像被**卡在主控台**，而且我點其他的 tab 是**切不過去的**」
 * （每一輪回音都把面板叫回來一次）。
 *
 * > **同一個面板，「把它畫出來」與「把它報出去」不能同時接
 * > ——那不是兩個功能，那是一個迴圈。**
 *
 * ⚠️ 判準問**宣告**：投影到 `panelBottom` ＝ 這個視窗自己畫。
 */
export function consoleRole(surface: string): 'draw' | 'report' {
  return surface === 'panelBottom' ? 'draw' : 'report'
}

/**
 * **下方面板的兩頁**——主控台與變數（2026-09-02）。
 *
 * 🔴 使用者：「下方面板也分『主控台』『變數』，我要有『顯示…面板』的選項，
 * 如果現在已經是開著的，就是『隱藏…面板』。」
 *
 * ⚠️ 它們在版面選單裡，而**它們不是版面**——所以值域上要分得出來。
 * `__` 開頭：版面的 id 都是名字（`focus`／`compare`／`three-column`），
 * 一個永遠不會與它們相撞的形狀，勝過一句「請不要把版面取這個名字」。
 */
export const BOTTOM_PAGES = ['console', 'variables'] as const
export type BottomPage = typeof BOTTOM_PAGES[number]

/** 版面選單裡那兩項的值。 */
export const bottomToggleValue = (page: BottomPage): string => `__toggle-${page}`

/** 反過來：這個值是哪一頁的開關（不是的話回 `null`）。 */
export function bottomPageOf(value: string | undefined): BottomPage | null {
  return BOTTOM_PAGES.find((p) => bottomToggleValue(p) === value) ?? null
}

/**
 * **哪幾頁現在看得見**——⚠️ 「面板開著」與「這一頁看得見」是兩件事。
 *
 * 網頁版底下是**一條有兩個分頁的**面板：面板開著時只有**作用中的那一頁**
 * 看得見。IDE 那側是宿主 panel 區的兩個原生分頁，答案由宿主給。
 *
 * > **一個「顯示／隱藏」的標籤要說實話，就得先問得出「它現在看得見嗎」
 * > ——而在一條有分頁的面板上，那不等於「面板開著嗎」。**
 */
export interface BottomVisibility {
  readonly console: boolean
  readonly variables: boolean
}
