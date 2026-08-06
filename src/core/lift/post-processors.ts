/**
 * 辨識後處理的宣告登記處。
 *
 * ## 為什麼需要這個模組
 *
 * 有些改判**只有語言套件知道判準**。實際觸發它的例子是 `>>`：
 *
 * ```cpp
 * in  >> a;   // 從字串串流讀值
 * num >> 1;   // 位元位移
 * ```
 *
 * 兩者**語法完全相同**，分得出來的唯一依據是根變數的型別是不是
 * `istringstream` / `stringstream`——而那是 **C++ 的型別名**。
 *
 * 第一版把這條規則直接寫進 `lifter.ts`，於是核心層出現了兩個寫死的 C++
 * 型別字串。**中立性與語法耦合兩條護欄都沒數到它**：前者找的是元件身分，
 * 後者找的是語法符號（關鍵字、運算子、`std::`），而 `istringstream` 兩者
 * 皆非——它是型別名，是耦合的**第四種**形式（編號接 `knowledge/history/021`：
 * import 第一種、身分第二種、語法第三種）。
 *
 * 數到它的是**就近性**護欄：`input` / `var_ref` / `arithmetic` 三個元件的
 * 擴散度各 +1 檔，指向同一個新檔案。**三條護欄裡只有一條會叫**，而那條量的
 * 甚至不是語言耦合——見 `knowledge/history/021`「一條規範被機械化時，選了
 * 哪一維會消失在數字裡」。
 *
 * ## 形狀
 *
 * 語言套件推、核心讀——與 `comment-syntax.ts`、`skip-declarations.ts`、
 * `language-executors.ts` 同一個形狀。核心只知道「有人可能想改判」，
 * 不知道任何語言的型別名。
 */
import type { SemanticNode } from '../types'
import type { LiftContext } from './types'

/**
 * 拿到一個剛辨識出來的節點，回傳改判後的節點——或 `null` 表示不改判。
 *
 * **判不出來就回 `null`**（保守方向）。回傳一個猜的結果，等於把歧義推到
 * 執行時碰運氣，那正是 P3 禁止的。
 */
export type LiftPostProcessor = (node: SemanticNode, ctx: LiftContext) => SemanticNode | null

const declared: LiftPostProcessor[] = []

/** 語言套件載入時呼叫 */
export function declareLiftPostProcessor(fn: LiftPostProcessor): void {
  if (!declared.includes(fn)) declared.push(fn)
}

/** 測試用——還原成「沒有語言套件」的狀態 */
export function resetLiftPostProcessors(): void {
  declared.length = 0
}

/** 核心層讀它。沒有語言套件時是空陣列——不改判就是正確的中立行為 */
export function liftPostProcessors(): readonly LiftPostProcessor[] {
  return declared
}
