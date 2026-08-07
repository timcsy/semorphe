/**
 * 「這個樹節點**不是元件**」的宣告登記處
 *
 * ## 為什麼需要它
 *
 * 語義樹裡不是每個節點都是元件。有三種例外，而在此之前它們**全部只是
 * 「不在登錄表裡」**——與「忘了寫概念定義」長得一模一樣：
 *
 * | 種類 | 例 | 為什麼不是元件 |
 * |---|---|---|
 * | `degradation` | `raw_code`、`unresolved` | 辨識不出來時的誠實標記 |
 * | `structural` | `param_decl`、`cpp_initializer_list` | 別人的子節點，不會單獨成為一顆積木 |
 * | `sentinel` | `_compound`、`_multi_field` | 辨識過程的中間產物 |
 *
 * ## 為什麼不用底線前綴判斷
 *
 * **默契不是規則。** `param_decl` 沒有底線而它是結構節點，`raw_code` 也沒有——
 * 用前綴推斷會同時漏報與誤報。
 *
 * ## 為什麼每筆都要理由
 *
 * `history/018`「用宣告刷數字」的直接教訓：**一個沒有理由的宣告，
 * 與「懶得處理」長得一模一樣**。而這個登記處的存在意義就是把
 * 「刻意不是元件」與「忘了寫定義」分開——沒有理由的話它就只是換個地方忘記。
 *
 * 形狀抄 `skip-declarations.ts`：核心宣告槽位，各層推進來。
 */

export type NonComponentKind = 'degradation' | 'structural' | 'sentinel'

export interface NonComponentDecl {
  kind: NonComponentKind
  reason: string
}

const declarations = new Map<string, NonComponentDecl>()

export function declareNonComponent(id: string, kind: NonComponentKind, reason: string): void {
  if (!reason.trim()) {
    throw new Error(`declareNonComponent('${id}') 缺理由——沒有理由的宣告與「懶得處理」分不出來`)
  }
  declarations.set(id, { kind, reason })
}

export function nonComponentDecl(id: string): NonComponentDecl | undefined {
  return declarations.get(id)
}

export function allNonComponents(): ReadonlyMap<string, NonComponentDecl> {
  return declarations
}

/**
 * 核心自己的降級退路。
 *
 * ⚠️ 這兩顆宣告在核心，是因為**降級是核心的機制**（P：誠實降級），
 * 不是某個語言的東西。語言專屬的非元件節點由語言套件自己推進來。
 */
declareNonComponent(
  'raw_code',
  'degradation',
  '辨識不出來時保留原始文字的退路。它刻意沒有概念定義——一顆「什麼都能是」的元件會讓五路完備性失去意義。',
)
declareNonComponent(
  'unresolved',
  'degradation',
  '子節點辨識得出、而外層辨識不出時的包裝。它帶 node_type 供診斷，本身不是任何一個語義概念。',
)
