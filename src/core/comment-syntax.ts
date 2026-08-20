/**
 * 註解語法的宣告登記處。
 *
 * ## 為什麼需要這個模組
 *
 * 在此之前，核心層**自己寫死了 C 家族的註解語法**——四個地方：
 *
 * | 位置 | 做什麼 |
 * |---|---|
 * | `projection/code-generator.ts` | 產生 `//`、`/** *​/`、`/* *​/` |
 * | `projection/code-generator.ts` | 行末標註接 ` // text` |
 * | `projection/code-generator.ts` | 認不得的概念退回 `/* unknown component *​/` |
 * | `lift/lifter.ts` | 從原始碼**剝掉** `//` 與 `/* *​/` |
 *
 * Python 要的是 `#`，Lisp 要的是 `;`。那四處全部違反「拔掉 C++，核心仍能運作」。
 *
 * ## 這種耦合中立性護欄看不見
 *
 * 那條護欄找的是**元件身分字串**。上面四處**一個身分都沒有**——它們寫死的是
 * 語法符號。護欄回報的數字裡，這四筆從來不在。
 *
 * **身分只是耦合的一種形式，語法是另一種。** 這件事已寫進該護欄的
 * 「本護欄不檢測什麼」，並由 `tests/integration/comment-projection-snapshot.test.ts`
 * 的「核心層零註解語法」那一支守住。
 *
 * ## 形狀
 *
 * 語言套件推、核心讀——與 `skip-declarations.ts`、`language-executors.ts` 同一個形狀。
 *
 * 見 specs/059-concept-id-vs-lookalike/
 */

/** 一種語言怎麼寫註解 */
export interface CommentSyntax {
  /** 單行註解 */
  line(text: string, indent: string): string
  /** 區塊註解（text 可能含換行） */
  block(text: string, indent: string): string
  /** 文件註解——屬性的形狀見 `doc_comment` 概念定義 */
  doc(properties: Record<string, unknown>, indent: string): string
  /** 接在一行程式碼後面的行末註解 */
  trailing(code: string, text: string): string
  /** 從原始碼的註解節點文字剝掉語法符號，留下內容 */
  strip(raw: string): string
}

/**
 * 🔴 **依語言存**（spec 168）。
 *
 * ⚠️ 第一版是**一個全域槽**，於是「這個語言怎麼寫註解」的答案取決於
 * **哪個套件最後載入**。與 `degradation-blocks` 是同一個病，同一天收的。
 *
 * > **一個「全域只有一份」的登記處，等於宣告了「這個系統只有一個語言」。**
 */
const byLanguage = new Map<string, CommentSyntax>()
let active: string | null = null

/** 語言套件載入時呼叫 */
export function declareCommentSyntax(language: string, syntax: CommentSyntax): void {
  byLanguage.set(language, syntax)
}

/** 切語言時呼叫 */
export function setCommentLanguage(language: string): void {
  active = language
}

/** 測試用——還原成「沒有語言套件」的狀態 */
export function resetCommentSyntax(): void {
  byLanguage.clear()
  active = null
}

/**
 * 沒有語言套件時的退路。
 *
 * **不得無聲產出空字串**（FR-014）。一個註解憑空消失，使用者不會收到任何
 * 訊號，而下一次來回轉換它就永遠不見了——`053` 那次的教訓正是「刪掉核心的
 * 登記處會讓『沒載入語言套件』從無聲變成報錯」，那次 144 個測試一次變紅。
 *
 * 用 `⟨⟩` 而不是任何語言的註解符號：核心**不知道**任何語言怎麼寫註解，
 * 假裝知道就是把問題搬回原點。這個形式**明顯不是合法程式碼**，所以它會被
 * 看見，而註解的內容一個字都不會掉。
 */
const NEUTRAL: CommentSyntax = {
  line: (text, indent) => `${indent}⟨comment: ${text}⟩\n`,
  block: (text, indent) => `${indent}⟨comment: ${text}⟩\n`,
  doc: (properties, indent) => `${indent}⟨doc comment: ${String(properties.brief ?? '')}⟩\n`,
  trailing: (code, text) => `${code} ⟨comment: ${text}⟩`,
  strip: (raw) => raw,
}

/** 核心層讀它。沒有語言套件時回傳語言中立的退路，**不回傳 null**——見 NEUTRAL 的說明 */
export function commentSyntax(): CommentSyntax {
  return (active !== null ? byLanguage.get(active) : undefined) ?? NEUTRAL
}

/** 有沒有語言套件宣告過（護欄與診斷用） */
export function hasCommentSyntax(): boolean {
  return active !== null && byLanguage.has(active)
}
