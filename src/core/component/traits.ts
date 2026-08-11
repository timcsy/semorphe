/**
 * **元件性狀的核心讀取器** —— 只讀膠囊自己的宣告
 *
 * ## 為什麼要與語言套件那一份分開
 *
 * `languages/cpp/core/node-traits.ts` 除了讀膠囊宣告，還疊了一張**過渡表**
 * （還沒膠囊化的元件的性狀暫放處）。那張表是 C++ 的，所以那個模組屬於語言套件。
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
 * 處置：核心讀核心讀得到的（膠囊的 `component.json`，`import.meta.glob` 直讀），
 * 語言套件在上面疊自己的過渡表。**已膠囊化的元件兩邊答案相同。**
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
