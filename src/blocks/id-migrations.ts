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
import { registerIdMigration } from '../core/storage-version'

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
