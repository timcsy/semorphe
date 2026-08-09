/**
 * 通用（跨語言）元件的身分改名表（v2 → v3，spec 103）
 *
 * 這些身分本來是裸名（`if`／`print`／`comment`），現在歸 `lang:` 所有。
 * scope 叫 `lang` 不叫 `universal`——硬體進來那天 `universal:if` 會被讀成
 * 「所有域通用」，而它其實是「所有**語言**通用」。
 *
 * ## 為什麼是凍結的明表，不是一條規則
 *
 * 規則很單純，而「v2 那時存在哪些身分」是**歷史事實**。從當下的登錄表推導的話，
 * 往後每一次增刪元件都會悄悄改變這張表——而它要處理的是兩年前存的檔案。
 *
 * 寫成明表讓每一筆都看得見：規則若對某一顆是錯的，讀的人指得出來。
 */
import { registerIdMigration, registerPropertyMigration } from '../core/storage-version'

export const ID_MIGRATIONS_V2_TO_V3: Record<string, string> = {
  arithmetic: 'lang:arithmetic',
  array_access: 'lang:array_access',
  array_assign: 'lang:array_assign',
  array_declare: 'lang:array_declare',
  bitwise_not: 'lang:bitwise_not',
  block_comment: 'lang:block_comment',
  break: 'lang:break',
  builtin_constant: 'lang:builtin_constant',
  comment: 'lang:comment',
  compare: 'lang:compare',
  continue: 'lang:continue',
  count_loop: 'lang:count_loop',
  doc_comment: 'lang:doc_comment',
  endl: 'lang:endl',
  forward_decl: 'lang:forward_decl',
  func_call: 'lang:func_call',
  func_def: 'lang:func_def',
  if: 'lang:if',
  if_else: 'lang:if_else',
  input: 'lang:input',
  logic: 'lang:logic',
  logic_not: 'lang:logic_not',
  negate: 'lang:negate',
  number_literal: 'lang:number_literal',
  print: 'lang:print',
  program: 'lang:program',
  return: 'lang:return',
  string_literal: 'lang:string_literal',
  var_assign: 'lang:var_assign',
  var_declare: 'lang:var_declare',
  var_ref: 'lang:var_ref',
  while_loop: 'lang:while_loop',
}

registerIdMigration(ID_MIGRATIONS_V2_TO_V3)

/**
 * 參數改名（v3 → v4）：通用元件的接收者統一叫 `obj`
 *
 * ⚠️ **鍵是 v3 當時的 id**（`lang:*`），不是現在的 `cpp:*`。
 * 參數改名跑在 v3→v4，而 D1 的身分改名跑在 v4→v5——**順序不能倒**。
 * 我一度把鍵「順手」更新成 `cpp:*`，那會讓 v3 的樹完全對不上，
 * 結果是 id 改了而參數沒改。**遷移表的鍵屬於它那個版本，不屬於現在。**
 */
export const PROPERTY_MIGRATIONS_V3_TO_V4: Record<string, Record<string, string>> = {
  'lang:array_access': { name: 'obj' },
  'lang:array_assign': { name: 'obj' },
  'lang:var_assign': { name: 'obj' },
}

registerPropertyMigration(PROPERTY_MIGRATIONS_V3_TO_V4)

/**
 * v4 → v5（**D1**，G 項第 2 步，2026-08-09）：`lang:` 這個 scope 退場。
 *
 * ## 為什麼 `lang:` 沒有工作了
 *
 * - **不是元件套件**——各套件自理（見 `knowledge/concepts/元件.md`）
 * - **不是積木套件**——積木各語言各自，共用會變成所有語言需求的聯集
 * - **抽象概念住在圖鑑**，那是內容不是 scope
 *
 * 留著它就是留一個**假的通用宣稱**：「這 32 顆是跨語言的」——
 * 而那件事只有第二個語言到場才驗證得了，現在說就是猜。
 *
 * Python 進來時 `py:if` 是**新元件 ＋ 一條轉換邊**，不是改名。
 *
 * ⚠️ 這份檔案在 D1 之後成為**純歷史**——它記的是這些 id 曾經屬於通用套件。
 */
export const ID_MIGRATIONS_V4_TO_V5: Record<string, string> = {
  'lang:arithmetic': 'cpp:arithmetic',
  'lang:array_access': 'cpp:array_access',
  'lang:array_assign': 'cpp:array_assign',
  'lang:array_declare': 'cpp:array_declare',
  'lang:bitwise_not': 'cpp:bitwise_not',
  'lang:block_comment': 'cpp:block_comment',
  'lang:break': 'cpp:break',
  'lang:builtin_constant': 'cpp:builtin_constant',
  'lang:comment': 'cpp:comment',
  'lang:compare': 'cpp:compare',
  'lang:continue': 'cpp:continue',
  'lang:count_loop': 'cpp:count_loop',
  'lang:doc_comment': 'cpp:doc_comment',
  'lang:endl': 'cpp:endl',
  'lang:forward_decl': 'cpp:forward_decl',
  'lang:func_call': 'cpp:func_call',
  'lang:func_def': 'cpp:func_def',
  'lang:if': 'cpp:if',
  'lang:if_else': 'cpp:if_else',
  'lang:input': 'cpp:input',
  'lang:logic': 'cpp:logic',
  'lang:logic_not': 'cpp:logic_not',
  'lang:negate': 'cpp:negate',
  'lang:number_literal': 'cpp:number_literal',
  'lang:print': 'cpp:print',
  'lang:program': 'cpp:program',
  'lang:return': 'cpp:return',
  'lang:string_literal': 'cpp:string_literal',
  'lang:var_assign': 'cpp:var_assign',
  'lang:var_declare': 'cpp:var_declare',
  'lang:var_ref': 'cpp:var_ref',
  'lang:while_loop': 'cpp:while_loop',
}

registerIdMigration(ID_MIGRATIONS_V4_TO_V5)
