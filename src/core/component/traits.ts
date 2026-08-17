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
 * 它原本寫死 `arg0.conceptId === 'cpp:func_call'`——一顆 C++ 元件的身分
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
export function componentTraits(conceptId: string): Record<string, unknown> | undefined {
  const c = registeredComponents().find((x) => x.conceptId === conceptId)
  return (c?.manifest as { traits?: Record<string, unknown> } | undefined)?.traits
}

/**
 * 這顆是**具名呼叫**嗎（`properties.name` 是被呼叫的名字）。
 *
 * ⚠️ 只認膠囊的宣告。還沒膠囊化的元件在這裡一律回 `false`——
 * 那是保守的方向：**寧可少認一個，不要認錯一個**。
 */
export function isNamedCall(conceptId: string): boolean {
  return componentTraits(conceptId)?.namedCall === true
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
export function roleOf(conceptId: string): string | undefined {
  const c = registeredComponents().find((x) => x.conceptId === conceptId)
  return (c?.manifest as { role?: string } | undefined)?.role
}

/**
 * 這顆是**帶索引的存取**嗎（`properties.obj` 是容器名、`children.index` 是索引）。
 *
 * ⚠️ 核心的 `interpreter/executors/io.ts` 要認得它——`cin >> arr[i]` 讀進來的值
 * 要寫回陣列的某一格。核心不得 import 語言套件（P9），所以這一份在這裡。
 */
export function isIndexedAccess(conceptId: string): boolean {
  return componentTraits(conceptId)?.indexedAccess === true
}

/**
 * 找**宣告了這個性狀**的那顆元件身分。
 *
 * ⚠️ 找不到回 `undefined`——**不猜**。投影宣告寫 `wrapTrait: 'variableRef'`
 * 而沒有元件宣告該性狀時，正確的反應是「這條規則不生效」，
 * 不是「包成一顆猜出來的元件」。
 */
export function conceptWithTrait(trait: string): string | undefined {
  for (const c of registeredComponents()) {
    if ((c.manifest as { traits?: Record<string, unknown> }).traits?.[trait] === true) return c.conceptId
  }
  return undefined
}

/**
 * 這顆能接成 `else if` 鏈嗎（`else { if … }` 摺成 `else if …`）。
 *
 * ⚠️ 三個消費者要問它——產生器、渲染器、**以及核心的 `pattern-lifter`**。
 * 核心不得 import 語言套件（P9），所以這一份在這裡。
 */
export function isElseIfChainable(conceptId: string): boolean {
  return componentTraits(conceptId)?.elseIfChainable === true
}


/**
 * 這顆是**整棵語義樹的根**（`children.body` 是整個程式）。
 *
 * ⚠️ `core/semantic-tree.ts` 的 `createEmptyProgram()` 原本寫死 `'cpp:program'`
 * ——**核心知道一顆 C++ 元件的名字**。而「哪一顆是樹根」是那顆元件的宣告：
 * 換一個語言就換一顆，核心只要問「誰是根」。
 *
 * > **核心可以知道「有一個根」，不該知道那個根叫什麼。**
 */
export function programRootConcept(): string | undefined {
  return conceptWithTrait('programRoot')
}

/** 這顆是**函式定義**嗎（`properties.name` 是函式名）。 */
export function isFunctionDefinition(conceptId: string): boolean {
  return componentTraits(conceptId)?.functionDefinition === true
}

/**
 * 這顆元件的 I/O 角色與風格。
 *
 * ⚠️ **它住在核心，是因為它一個 C++ 的字都不認識**——只是把膠囊宣告的
 * `ioRole`／`ioStyle` 讀出來。它原本住在 `languages/cpp/core/node-traits.ts`，
 * 而它的消費者是 `ui/toolbox-builder.ts`（決定 I/O 積木的排序偏好），
 * 於是**視圖層為了問一句「這顆是哪種 I/O」而 import 了整個 C++ 語言套件**
 * ——P9 語言獨立性的字面違反（第三十九條護欄抓到）。
 *
 * `ioRole` ＝ 等價類、`ioStyle` ＝ 哪個成員，那是**一條被宣告出來的等價邊**
 * （見 `concepts/等價與觀察集.md`）。等價邊不屬於任何一個語言。
 */
export function ioTraitOf(conceptId: string): { role?: string; style?: string } | undefined {
  const t = componentTraits(conceptId)
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
export function isPlainDeclaration(conceptId: string): boolean {
  return componentTraits(conceptId)?.plainDeclaration === true
}
