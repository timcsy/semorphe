/**
 * **一個合法的名字長什麼樣**——由語言套件宣告，核心讀。
 *
 * ## 🔴 它為什麼存在
 *
 * 使用者 2026-09-14 轉述：「學生的變數名稱會寫成數字，Semorphe 竟然還可以接受」。
 *
 * 實測（把宣告積木的名字欄位改成 `123`）：
 *
 * ```
 * 產出的程式碼   int 123 = 16;
 * 主控台錯誤     none
 * 畫面上的標記   0
 * ```
 *
 * 而 `ParamKind` 的檔頭逐字寫著：
 *
 * > **每一個種類都以「它能讓什麼失敗」來定義。生不出檢查的種類不該存在。**
 * > | `identifier` | `name`(43)、`obj`(30)… | 空字串、**不合法的識別字** |
 *
 * 97 個參數宣告了 `kind: 'identifier'`，而**沒有任何一處讀 `kind`**
 * （`param-spec.ts` 只端名字出去）。這是同一週第三個「宣告了而沒有人讀」
 * ——前兩個是 `slots` 的 `min`／`max`，以及形態軸 `role`。
 *
 * ## ⚠️ 而它特別該由學生看見
 *
 * 第 3 課「變數」整整一節在教「哪些名字**編譯器不准**、哪些是**人之間的約定**」。
 * 一個收下 `int 123;` 的工具，把那一節教成了假的。
 *
 * > **一個教「這樣不行」的工具，如果它自己收下了那樣東西，
 * > 它教的不是規則，是「規則沒有人在管」。**
 *
 * ## 形狀：語言套件推、核心讀
 *
 * 與 `comment-syntax.ts`／`expression-statement.ts`／`degradation-blocks.ts` 同一個模子。
 * 🔴 **理由是 P9**：「名字可以長什麼樣」是語言的知識——C++ 是
 * `[A-Za-z_][A-Za-z0-9_]*` 而 Python 收得下中文變數名。核心不得知道那件事。
 */

/** 一個語言的識別字規則 */
export interface IdentifierSyntax {
  /**
   * 合法的名字要長成這樣。
   *
   * ⚠️ **要錨住整個字串**（`^…$`）——不錨的話 `123abc` 會因為中間有一段像樣子而過關。
   */
  pattern: RegExp
  /**
   * 保留字——它們**形狀合法而不能當名字**。
   *
   * 🔴 少了這一格，`int class = 1;` 會被判成合法：它完全符合上面那個樣式。
   * > **一個只驗形狀的檢查，擋不住「形狀對而意思被佔走」的那一類。**
   */
  reserved: ReadonlySet<string>
}

const registry = new Map<string, IdentifierSyntax>()

/** 語言套件宣告自己的規則 */
export function declareIdentifierSyntax(language: string, syntax: IdentifierSyntax): void {
  registry.set(language, syntax)
}

/** 這個語言的規則。**沒宣告就回 `undefined`**——而呼叫端要把它讀成「不知道」，不是「都合法」。 */
export function identifierSyntaxOf(language: string): IdentifierSyntax | undefined {
  return registry.get(language)
}

/** 這個名字在這個語言裡合法嗎。⚠️ **語言沒宣告規則就回 `true`**——不知道不等於錯。 */
export function isLegalIdentifier(language: string, name: string): boolean {
  const s = registry.get(language)
  if (!s) return true
  if (name === '') return false
  if (s.reserved.has(name)) return false
  return s.pattern.test(name)
}

/**
 * 為什麼不合法——給人看的那一格。
 *
 * ⚠️ 回的是**理由的身分**（i18n 的鍵尾），不是一句中文：
 * 兩個面板要說不一樣的話（`Diagnostic.rule` 那一刀）。
 */
export type IllegalNameReason = 'empty' | 'reserved' | 'starts_with_digit' | 'bad_char'

export function whyIllegal(language: string, name: string): IllegalNameReason | undefined {
  const s = registry.get(language)
  if (!s) return undefined
  if (name === '') return 'empty'
  if (s.reserved.has(name)) return 'reserved'
  if (s.pattern.test(name)) return undefined
  // 🔴 **「數字開頭」要單獨認出來**——那是學生最常撞到的那一種，
  //    而「這個字元不能用」對他來說指不出是哪裡錯。
  return /^[0-9]/.test(name) ? 'starts_with_digit' : 'bad_char'
}

/** ⚠️ 只給測試用——語言套件的宣告是一次性的。 */
export function resetIdentifierSyntax(): void {
  registry.clear()
}
