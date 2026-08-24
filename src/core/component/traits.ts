/**
 * **元件性狀的核心讀取器** —— 只讀膠囊自己的宣告
 *
 * ## 為什麼要與語言套件那一份分開
 *
 * ⚠️ **這一段的理由在 2026-08-11 過期了，留著是因為它解釋了這個檔為什麼存在。**
 *
 * 原文：「`languages/cpp/core/node-traits.ts` 除了讀膠囊宣告，還疊了一張**過渡表**
 * （還沒膠囊化的元件的性狀暫放處）。那張表是 C++ 的，所以那個模組屬於語言套件。」
 *
 * **F 完成之後（177/177 膠囊化）過渡表退場了**，於是那邊的 `性狀()` 與這裡的
 * `componentTraits()` **實作逐字相同**——兩份真相，而第三十八條護欄抓不到它，
 * 因為兩個函式**名字不同**。
 *
 * > **一份重複只要換個名字，就從「重複」變成「兩個模組各自的實作細節」。**
 *
 * 處置：那邊改成 delegate 到這裡。而這個檔仍然該存在——見下一段。
 *
 * 而**核心層也有消費者**：`interpreter/executors/variables.ts` 要分辨
 * `A a(5)` 是建構還是求值，判斷條件是「初值是不是一個名字等於型別的呼叫」。
 *
 * 它原本寫死 `arg0.componentId === 'cpp:func_call'`——一顆 C++ 元件的身分
 * 寫在核心裡。改成問語言套件那份性狀的話，**核心就 import 了語言套件**，
 * 而那是 P9 的字面違反（中立性護欄當場抓到）。
 *
 * > **把耦合從「身分」換成「性狀」是對的方向，而換的過程可能換出一條反向依賴。**
 *
 * 處置：核心讀核心讀得到的（膠囊的 `component.json`，`import.meta.glob` 直讀）。
 * 語言套件那個模組留下的是**真的需要語言知識的那些**
 * （運算子優先級、tree-sitter 節點形狀的判斷）。
 */
import { registeredComponents } from './registry'

/** 一顆已膠囊化元件宣告的性狀。沒宣告回 `undefined`——**不猜**。 */
export function componentTraits(componentId: string): Record<string, unknown> | undefined {
  const c = registeredComponents().find((x) => x.componentId === componentId)
  return (c?.manifest as { traits?: Record<string, unknown> } | undefined)?.traits
}

/**
 * 這顆是**具名呼叫**嗎（`properties.name` 是被呼叫的名字）。
 *
 * ⚠️ 只認膠囊的宣告。還沒膠囊化的元件在這裡一律回 `false`——
 * 那是保守的方向：**寧可少認一個，不要認錯一個**。
 */
export function isNamedCall(componentId: string): boolean {
  return componentTraits(componentId)?.namedCall === true
}

/**
 * 這顆的**角色**是什麼——`'statement'`／`'expression'`／…
 *
 * 🔴 **它讀的是膠囊的宣告（`component.json` 的 `role`），不是猜的。**
 *
 * ⚠️ 2026-08-17 補：產生器需要知道「一個節點出現在語句位置時要不要補分號」。
 * 第一版的判準是「**產出沒有以換行結尾 ⟹ 它是運算式**」——**而那是猜的，而且錯**：
 * `cpp:loop_do_while` 是語句，而它的產出以 `} while (…);` 收尾**沒有換行**，
 * 於是被補了第二個分號。
 *
 * > **一個「從產出的形狀反推它是什麼」的判準，
 * > 會在那個形狀有例外的時候安靜地做錯事——而宣告不會。**
 *
 * 認不得的回 `undefined`（不是猜一個看起來合理的）。
 */
export function roleOf(componentId: string): string | undefined {
  const c = registeredComponents().find((x) => x.componentId === componentId)
  return (c?.manifest as { role?: string } | undefined)?.role
}

/**
 * 這顆是**帶索引的存取**嗎（`properties.obj` 是容器名、`children.index` 是索引）。
 *
 * ⚠️ 核心的 `interpreter/executors/io.ts` 要認得它——`cin >> arr[i]` 讀進來的值
 * 要寫回陣列的某一格。核心不得 import 語言套件（P9），所以這一份在這裡。
 */
export function isIndexedAccess(componentId: string): boolean {
  return componentTraits(componentId)?.indexedAccess === true
}

/**
 * 找**宣告了這個性狀**的那顆元件身分。
 *
 * ⚠️ 找不到回 `undefined`——**不猜**。投影宣告寫 `wrapTrait: 'variableRef'`
 * 而沒有元件宣告該性狀時，正確的反應是「這條規則不生效」，
 * 不是「包成一顆猜出來的元件」。
 */
export function componentWithTrait(trait: string): string | undefined {
  for (const c of registeredComponents()) {
    if ((c.manifest as { traits?: Record<string, unknown> }).traits?.[trait] === true) return c.componentId
  }
  return undefined
}

/**
 * 這顆能接成 `else if` 鏈嗎（`else { if … }` 摺成 `else if …`）。
 *
 * ⚠️ 三個消費者要問它——產生器、渲染器、**以及核心的 `pattern-lifter`**。
 * 核心不得 import 語言套件（P9），所以這一份在這裡。
 */
export function isElseIfChainable(componentId: string): boolean {
  return componentTraits(componentId)?.elseIfChainable === true
}


/**
 * 這顆是**整棵語義樹的根**（`children.body` 是整個程式）。
 *
 * ⚠️ `core/semantic-tree.ts` 的 `createEmptyProgram()` 原本寫死 `'cpp:program'`
 * ——**核心知道一顆 C++ 元件的名字**。而「哪一顆是樹根」是那顆元件的宣告：
 * 換一個語言就換一顆，核心只要問「誰是根」。
 *
 * > **核心可以知道「有一個根」，不該知道那個根叫什麼。**
 *
 * ⚠️ 而這句話**少了一半**——`knowledge/concepts/宣告登記處.md` 補完了它：
 * **也不該假設它有幾個**。下面的 `isProgramRoot` 就是那半句的產物。
 */
export function programRootComponent(): string | undefined {
  return componentWithTrait('programRoot')
}

/**
 * 🔴 **這顆是不是【某個語言的】程式根。**
 *
 * ## 為什麼不能用 `programRootComponent()` 比對
 *
 * `componentWithTrait` **回傳第一個匹配**——第二個語言宣告了 `programRoot`
 * 之後，兩顆之中會有一顆**靜默失效**。
 *
 * 2026-08-20（spec 160）實測就是這個症狀：Python 的樹送進
 * `renderToBlocklyState`，那裡寫著 `tree.componentId !== programRootComponent()`
 * → 回**空的積木清單，零錯誤**。使用者看到的是**空白畫布**。
 *
 * > **一個「全域只有一個」的假設，在第二個成員出現時不會報錯——它會挑一個。**
 *
 * 🟢 正解：**問這顆自己的宣告**，不要跟一個全域單值比。
 * 這樣「有幾個語言」對核心而言不再是一個要知道的數字。
 */
export function isProgramRoot(componentId: string): boolean {
  return componentTraits(componentId)?.programRoot === true
}

/** 這顆是**函式定義**嗎（`properties.name` 是函式名）。 */
export function isFunctionDefinition(componentId: string): boolean {
  return componentTraits(componentId)?.functionDefinition === true
}

/**
 * 這顆元件的 I/O 角色與風格。
 *
 * ⚠️ **它住在核心，是因為它一個 C++ 的字都不認識**——只是把膠囊宣告的
 * `ioRole`／`ioStyle` 讀出來。它原本住在 `languages/cpp/core/node-traits.ts`，
 * 而它的消費者是 `core/toolbox-builder.ts`（決定 I/O 積木的排序偏好），
 * 於是**視圖層為了問一句「這顆是哪種 I/O」而 import 了整個 C++ 語言套件**
 * ——P9 語言獨立性的字面違反（第三十九條護欄抓到）。
 *
 * `ioRole` ＝ 等價類、`ioStyle` ＝ 哪個成員，那是**一條被宣告出來的等價邊**
 * （見 `components/等價與觀察集.md`）。等價邊不屬於任何一個語言。
 */
export function ioTraitOf(componentId: string): { role?: string; style?: string } | undefined {
  const t = componentTraits(componentId)
  const role = t?.ioRole as string | undefined
  const style = t?.ioStyle as string | undefined
  if (!role && !style) return undefined
  return { role, style }
}

/**
 * 這顆是**沒有初值的宣告**嗎。
 *
 * ⚠️ 這個函式在 2026-08-11 之前的一輪才從核心**搬下去**到語言套件，
 * 而現在搬回來——理由變了，所以記一下：
 *
 * - 搬下去的理由：「它是 C++ 的性狀」
 * - **搬回來的理由**：它讀的是**膠囊自己宣告的一個布林**，
 *   而任何語言的膠囊都可以宣告它。**函式裡沒有一個 C++ 的字。**
 *
 * > **判斷一個函式屬於哪一層，看它認識什麼，不看它今天被誰用。**
 */
export function isPlainDeclaration(componentId: string): boolean {
  return componentTraits(componentId)?.plainDeclaration === true
}

/**
 * 這顆元件需要板子提供什麼**能力**才存在。
 *
 * ```
 * cpp:touch_read   'touch'       只有有電容觸摸腳位的板子才有 touchRead
 * cpp:pwm_write    'ledc-pwm'    只有有 LEDC 控制器的板子才有 ledcWrite
 * cpp:digital_write  undefined   所有板子都有
 * ```
 *
 * 🔴 **`undefined` ＝ 所有板子都有**——預設值的方向不可反。反過來的話，
 * 每加一顆元件都要在三個地方登記，而那正是階段 6.5「加一顆元件 ＝
 * 新增一個資料夾，零編輯」要治的病。
 *
 * ⚠️ 這與 `ioTraitOf` 是**同一個形狀**：`ioStyle` 說「我只在某個 I/O 風格的
 * 世界裡有意義」，這裡說「我只在有某個硬體能力的板子上存在」。
 * 兩者都是**性狀**——消費者問「這顆是什麼」，不問「這顆叫什麼」。
 */
export function capabilityOf(componentId: string): string | undefined {
  const cap = componentTraits(componentId)?.needsCapability
  return typeof cap === 'string' && cap !== '' ? cap : undefined
}

/**
 * 這個目標提供得了那個能力嗎。
 *
 * ⚠️ **兩個「是」的來源不一樣，而它們都要通**：
 *
 * ```
 * capability === undefined   這顆元件不挑板子      → 一律 true
 * target.provides === undefined  這個目標不限縮    → 一律 true
 * ```
 *
 * 🔴 消費者一律走這個函式，**不得自己讀 `provides`**——否則那兩條預設規則
 * 會在每一個消費點各自被實作一次，而它們之中總有一個會寫反。
 */
export function targetProvides(
  target: { provides?: readonly string[] },
  capability: string | undefined,
): boolean {
  if (capability === undefined) return true
  if (target.provides === undefined) return true
  return target.provides.includes(capability)
}

/**
 * 從一組可見概念中，濾掉這個目標**提供不了**的。
 *
 * 🔴 **這是能力過濾的唯一入口**——工具箱組裝與測試都走它，
 * 不在兩邊各寫一份會漂移的判準（`tests/helpers/toolbox.ts` 的檔頭記過
 * 那個病：兩份看起來一樣，於是護欄全綠而正式路徑上的積木整批消失）。
 *
 * ⚠️ **它只該被工具箱那一條路呼叫。** `lift`／`generate`／`execute`
 * 一律不看目標——P4 逐字：「這是**過濾**（filtering），不是**簡化**
 * （simplification）——語義結構始終完整」。學生在 Uno 上貼一段 ESP32 的
 * 程式碼，`touchRead` 仍要被認出來，只是他拉不出新的一顆。
 */
export function filterByTarget(
  components: ReadonlySet<string>,
  target: { provides?: readonly string[] },
): Set<string> {
  if (target.provides === undefined) return new Set(components)
  const out = new Set<string>()
  for (const id of components) {
    if (targetProvides(target, capabilityOf(id))) out.add(id)
  }
  return out
}


/**
 * 這顆元件**讓一個名字存在**時，那個名字放在哪些欄位上。
 *
 * 回傳欄位名的樣板清單（`['NAME']`／`['PARAM_{i}']`），`{i}` 代表可增減的一組。
 *
 * ## 🔴 為什麼是宣告而不是一份清單
 *
 * `block-registrar` 的變數下拉原本是**一長串寫死的積木型別**
 * （`cpp_var_declare`／`cpp_func_def`／`cpp_loop_count`／`cpp_input`…）。
 * 於是第二個語言的變數**一個都進不了下拉**——使用者 2026-08-21 回報：
 * 「Python 那邊的積木選擇無法選到前面已經有的變數」。
 *
 * > **一份「哪些積木會產生名字」的清單，如果寫在介面層，
 * > 那麼「這個語言有沒有變數」就變成介面層要知道的事。**
 *
 * ⚠️ C++ 那條既有的路**沒有動**——它是 `vision` 記著的那批命令式定義的一部分，
 * 而改它要走比對護欄。這裡加的是**第二條路**：宣告式的那條。
 */
export function variableNameFields(componentId: string): string[] {
  const v = componentTraits(componentId)?.declaresVariable
  if (v === true) return ['NAME']
  return Array.isArray(v) ? (v as string[]) : []
}

/** 全部**宣告了**自己會產生名字的元件。 */
export function componentsDeclaringVariables(): { componentId: string; fields: string[] }[] {
  return registeredComponents()
    .map((c) => ({ componentId: c.componentId, fields: variableNameFields(c.componentId) }))
    .filter((x) => x.fields.length > 0)
}

/**
 * 這顆元件的**身體插槽**——子槽裡裝的是語句的那些，依宣告順序。
 *
 * 🔴 **流程圖靠這個知道「哪一條是流程」**，而它讀的是膠囊自己的宣告
 * （`component.json` 的 `children`），不是一份「哪些概念有身體」的清單。
 * 那份清單如果存在，它會住在視圖層而且用語言專屬的名字——
 * 那正是 P9（視圖層不得認識語言）擋掉的形狀。
 *
 * ⚠️ 子槽的宣告有**兩種寫法**（378 個字串、41 個物件），兩種都要認：
 *
 * ```json
 * "then_body": "statements"
 * "body":      { "allowed": ["statement"], "min": 0 }
 * ```
 *
 * 只認前者的話，寫成物件的那一顆會安靜地變成「沒有身體」——
 * 而症狀是流程圖少畫一段，不是報錯。
 */
export function bodySlotsOf(componentId: string): string[] {
  return slotsOf(componentId).filter((s) => s.isBody).map((s) => s.slot)
}

/**
 * 這顆元件宣告的**全部子槽**，依宣告順序，並標出哪些裝語句。
 *
 * 節點圖要的是這一份：裝語句的變成**執行接點**，其餘的變成**資料接點**。
 * 兩者的分界不在視圖的判斷裡，在膠囊的宣告裡。
 */
export function slotsOf(componentId: string): { slot: string; isBody: boolean }[] {
  const c = registeredComponents().find((x) => x.componentId === componentId)
  const children = (c?.manifest as { children?: Record<string, unknown> } | undefined)?.children
  if (!children) return []
  const isBody = (v: unknown): boolean => {
    if (typeof v === 'string') return v === 'statements' || v === 'statement'
    const allowed = (v as { allowed?: unknown[] } | null)?.allowed
    return Array.isArray(allowed) && allowed.some((a) => a === 'statement' || a === 'statements')
  }
  return Object.entries(children).map(([slot, v]) => ({ slot, isBody: isBody(v) }))
}
