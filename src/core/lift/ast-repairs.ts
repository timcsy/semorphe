/**
 * **解析器解錯的時候，在任何人讀這棵樹之前把它修回來。**
 *
 * ## 🔴 為什麼它與「辨識後處理」是兩件事
 *
 * `post-processors.ts` 修的是**語義節點**（「這棵樹的意思其實是別的」）。
 * 這裡修的是**語法樹本身**（「這棵樹一開始就不是這段程式的樹」）。
 *
 * ```
 * 後處理   in >> a   樹是對的，而「位移還是讀取」要看型別      → 改判
 * 樹修復   !K--      樹說 (!K)--，而 C++ 說 !(K--)            → 換一棵樹
 * ```
 *
 * 兩者**不能互相代替**：一棵解錯的樹，它的每一個子節點都會被正確地辨識
 * 成錯誤的東西——而後處理拿到的是那個結果，它看不出上游錯了。
 *
 * > **一個「解析器解錯了」的缺陷，長得與「我 lift 錯了」一模一樣
 * > ——而往下追的每一層都是對的。**
 *
 * ## ⚠️ 這個掛鉤很危險，所以它的契約寫得很緊
 *
 * 換一棵樹等於**繞過使用者寫的那段文字**。所以：
 *
 * ```
 * ① 回 null 是預設    修不動、判不出來、拿不到解析器——一律讓開，走原本那一路
 * ② 不得換語義        只准做「這段文字唯一合法的讀法就是這個」的重寫
 * ③ 不得遞迴          修出來的樹不可以再被同一條規則認領（否則無窮迴圈）
 * ```
 *
 * ⚠️ ③ 靠**判準自己**保證，不靠這裡加計數器：加了計數器的話，一條會重複
 * 認領的規則就從「當場無窮迴圈」變成「跑兩次之後安靜地停下來」，而後者查不到。
 *
 * ## 形狀
 *
 * 語言套件推、核心讀——與 `post-processors.ts`、`comment-syntax.ts`、
 * `skip-declarations.ts` 同一個形狀。核心只知道「有人可能想換一棵樹」，
 * 不知道任何語言的文法。
 */
import type { SemanticNode } from '../types'
import type { AstNode, LiftContext } from './types'

/**
 * 拿到一個即將被辨識的語法節點，回傳**修好之後的語義節點**——或 `null` 表示不管它。
 *
 * ⚠️ `ctx` 在這裡的用途有兩個：**問宣告**（「這個名字是變數還是樣板」，
 * 而那個答案只有 lift 當下知道），以及**辨識修好的那棵樹**（`ctx.lift`）。
 *
 * 🔴 **為什麼回的是語義節點而不是「換掉的那個 AstNode」**（2026-09-19 改的）：
 * 修復通常要**改寫文字**再讓解析器重解（見 cpp 的 `misparse.ts`），而改寫進去的
 * 那幾個字元——例如一對括號——**不是使用者寫的東西**。
 * 括號在 lift 時會被拆掉並記成排版註記（`layoutHints.parenthesized`），
 * 於是產生器把它放回去，而使用者的 `ans < eps` 變成 `(ans) < eps`。
 *
 * > **一個「把樹修回來」的機制，要負責把自己留下的痕跡也擦掉
 * > ——而它只有在自己 lift 之後才擦得到。**
 */
export type AstRepair = (node: AstNode, ctx: LiftContext) => SemanticNode | null

const declared: AstRepair[] = []

/** 語言套件載入時呼叫 */
export function declareAstRepair(fn: AstRepair): void {
  if (!declared.includes(fn)) declared.push(fn)
}

/** 測試用——還原成「沒有語言套件」的狀態 */
export function resetAstRepairs(): void {
  declared.length = 0
}

/** 核心層讀它。沒有語言套件時是空陣列——不換樹就是正確的中立行為 */
export function astRepairs(): readonly AstRepair[] {
  return declared
}
