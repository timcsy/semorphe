/**
 * 存檔的版本判定與欄位清單
 *
 * ## 為什麼是獨立的一個模組
 *
 * 自動載入與匯入檔案是兩條路徑，它們**必須**得到同一個判定。在此之前兩條
 * 路徑各自檢查，鬆緊度不同：自動載入那條（每次開頁面都跑）什麼都不檢查，
 * 匯入那條只檢查 `version` 欄位存在。放在獨立模組，是為了讓「有第二處判定」
 * 變得顯眼。
 *
 * 見 specs/052-storage-integrity-gate/research.md F2、contracts/storage.md
 */
import type { SavedState } from './storage'

/** 目前的存檔格式世代 */
export const CURRENT_VERSION = 3

/** 取出型別中「必填」的鍵 */
type RequiredKeys<T> = {
  [K in keyof T]-?: object extends Pick<T, K> ? never : K
}[keyof T]

/**
 * 存檔格式的全部欄位。
 *
 * **`satisfies` 是這裡的重點**：漏一個或多一個都編不過（實測 `TS1360`）。
 * TypeScript 的介面在執行期不存在，測試沒辦法列舉 `keyof SavedState`——
 * 這個常數是它在執行期的替身。
 *
 * 它**是手寫的**，但**不可能與型別漂移**，因為漂移會讓專案編不起來。
 * 這是把「推斷」改成「宣告」的同一招：缺失從沉默變成可偵測。
 */
export const SAVED_STATE_FIELDS = {
  version: 1,
  tree: 1,
  blocklyState: 1,
  code: 1,
  language: 1,
  styleId: 1,
  topicId: 1,
  enabledBranches: 1,
  lastModified: 1,
  blockStyleId: 1,
  locale: 1,
} satisfies Record<keyof Required<SavedState>, 1>

/** 必填欄位——形狀驗證用。同樣由編譯器釘住 */
export const REQUIRED_FIELDS = {
  version: 1,
  tree: 1,
  blocklyState: 1,
  code: 1,
  language: 1,
  styleId: 1,
  lastModified: 1,
} satisfies Record<RequiredKeys<SavedState>, 1>

/** 版本 N → N+1 的升級函式 */
export type Upgrade = (raw: Record<string, unknown>) => Record<string, unknown>

/**
 * 升級路徑註冊表。**目前刻意是空的——沒有需要升級的版本。**
 *
 * 它不是為未來預留的：沒有它，「版本較舊」只剩「拒絕」一條路，而
 * `CURRENT_VERSION` 首次調成 2 的那天，那等於拒絕掉每一位既有使用者的
 * 存檔——**比現況更糟**。它完成的是當下的 `needs-upgrade` 分支。
 *
 * `storage-version.test.ts` 有一支測試釘住「從 1 到 `CURRENT_VERSION` 的
 * 每一步都必須有註冊」。調高版本卻忘了寫升級函式，那支測試會變紅。
 */
/**
 * 1 → 2：**六對 statement／expression 雙版本合併成六個身分**（階段 6.5 的 B 項）。
 *
 * ## 為什麼這動得起
 *
 * P8「不做向後相容」的**範圍**已於 2026-08-07 釐清為**不含語義詞彙本身**
 * （`knowledge/history/026`）：P8 推導自「投影可重建」，而 componentId 改名動的是
 * **真實**，沒有東西可以重建它。這類變更 MUST 附一次性轉換。
 *
 * **這是那條釐清的第一次真正使用。**
 *
 * ## 只轉語義樹，不轉積木
 *
 * 積木型別是**加法式**保留的（`c_increment_expr` 仍然有效，只是現在對應到
 * `cpp_increment`）。轉積木型別是不必要的，而不必要的轉換是額外的風險面。
 */
const 合併掉的身分: Record<string, string> = {
  func_call_expr: 'func_call',
  cpp_method_call_expr: 'cpp_method_call',
  cpp_increment_expr: 'cpp_increment',
  cpp_compound_assign_expr: 'cpp_compound_assign',
  var_declare_expr: 'var_declare',
  cpp_scanf_expr: 'cpp_scanf',
}

/**
 * 就地改寫語義樹裡的舊身分。**只改認得的，其餘原樣通過。**
 *
 * ⚠️ 「認得的」這三個字是規格（FR-006）。不在表裡的身分**原樣保留**，
 * 不丟棄也不猜測——猜錯的節點會安靜地產出別的程式碼，那比留一個
 * 認不得的身分糟得多（後者至少會被 C3 的引用完備性護欄指名）。
 *
 * 對已是新格式的身分是**冪等**的：表裡沒有 `cpp:math_pow`，於是它原樣通過。
 */
function 改寫身分(node: unknown, 表: Record<string, string>): unknown {
  if (!node || typeof node !== 'object') return node
  if (Array.isArray(node)) return node.map((n) => 改寫身分(n, 表))
  const n = node as Record<string, unknown>
  const out: Record<string, unknown> = { ...n }
  const cid = out.conceptId
  if (typeof cid === 'string' && 表[cid]) out.conceptId = 表[cid]
  const children = out.children
  if (children && typeof children === 'object' && !Array.isArray(children)) {
    const c: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(children as Record<string, unknown>)) c[k] = 改寫身分(v, 表)
    out.children = c
  }
  return out
}


/**
 * 2 → 3：**全部 174 顆元件身分加上命名空間**（階段 6.5 的 D 項）。
 *
 * ## 為什麼是凍結的字面表，不是從登錄表推導
 *
 * 「v2 那時存在哪些身分」是**歷史事實**。從當下的登錄表推導的話，往後每一次
 * 增刪元件都會悄悄改變這張表——而它要處理的是兩年前存的檔案。
 *
 * 規則其實很單純（`cpp_X → cpp:X`、裸名 `X → lang:X`），而**寫成明表**讓
 * 每一筆都看得見：規則若對某一顆是錯的，讀的人指得出來；寫成函式就指不出來。
 *
 * ## 只轉語義樹，不轉積木
 *
 * 66 顆元件身分與積木型別**字串完全相同**（`cpp_class_def` 兩者皆是），
 * 而積木型別是加法式保留的（B 項）。轉了它積木會消失，而積木消失的成因有十幾種
 * ——等有人回報時已經無從歸因。
 */
export const 加上命名空間: Record<string, string> = {
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
  cpp_abs: 'cpp:abs',
  cpp_accumulate: 'cpp:accumulate',
  cpp_address_of: 'cpp:address_of',
  cpp_array_2d_access: 'cpp:array_2d_access',
  cpp_array_2d_assign: 'cpp:array_2d_assign',
  cpp_array_2d_declare: 'cpp:array_2d_declare',
  cpp_atof: 'cpp:atof',
  cpp_atoi: 'cpp:atoi',
  cpp_auto_declare: 'cpp:auto_declare',
  cpp_case: 'cpp:case',
  cpp_cast: 'cpp:cast',
  cpp_char_literal: 'cpp:char_literal',
  cpp_class_def: 'cpp:class_def',
  cpp_comma_expr: 'cpp:comma_expr',
  cpp_compound_assign: 'cpp:compound_assign',
  cpp_const_cast: 'cpp:const_cast',
  cpp_const_declare: 'cpp:const_declare',
  cpp_constexpr_declare: 'cpp:constexpr_declare',
  cpp_constructor: 'cpp:constructor',
  cpp_container_clear: 'cpp:container_clear',
  cpp_container_count: 'cpp:container_count',
  cpp_container_empty: 'cpp:container_empty',
  cpp_container_erase: 'cpp:container_erase',
  cpp_container_pop: 'cpp:container_pop',
  cpp_container_push: 'cpp:container_push',
  cpp_container_push_back: 'cpp:container_push_back',
  cpp_default: 'cpp:default',
  cpp_define: 'cpp:define',
  cpp_delete: 'cpp:delete',
  cpp_destructor: 'cpp:destructor',
  cpp_do_while: 'cpp:do_while',
  cpp_dynamic_cast: 'cpp:dynamic_cast',
  cpp_enum: 'cpp:enum',
  cpp_exit: 'cpp:exit',
  cpp_fill: 'cpp:fill',
  cpp_for_loop: 'cpp:for_loop',
  cpp_free: 'cpp:free',
  cpp_gcd: 'cpp:gcd',
  cpp_getline: 'cpp:getline',
  cpp_ifdef: 'cpp:ifdef',
  cpp_ifndef: 'cpp:ifndef',
  cpp_ifstream_declare: 'cpp:ifstream_declare',
  cpp_include: 'cpp:include',
  cpp_include_local: 'cpp:include_local',
  cpp_increment: 'cpp:increment',
  cpp_iota: 'cpp:iota',
  cpp_isalpha: 'cpp:isalpha',
  cpp_isdigit: 'cpp:isdigit',
  cpp_istringstream_declare: 'cpp:istringstream_declare',
  cpp_lambda: 'cpp:lambda',
  cpp_lcm: 'cpp:lcm',
  cpp_make_pair: 'cpp:make_pair',
  cpp_malloc: 'cpp:malloc',
  cpp_map_access: 'cpp:map_access',
  cpp_map_assign: 'cpp:map_assign',
  cpp_map_declare: 'cpp:map_declare',
  cpp_max: 'cpp:max',
  cpp_memcpy: 'cpp:memcpy',
  cpp_memset: 'cpp:memset',
  cpp_method_call: 'cpp:method_call',
  cpp_min: 'cpp:min',
  cpp_namespace_def: 'cpp:namespace_def',
  cpp_new: 'cpp:new',
  cpp_ofstream_declare: 'cpp:ofstream_declare',
  cpp_operator_overload: 'cpp:operator_overload',
  cpp_override_method: 'cpp:override_method',
  cpp_pair_declare: 'cpp:pair_declare',
  cpp_partial_sum: 'cpp:partial_sum',
  cpp_pointer_assign: 'cpp:pointer_assign',
  cpp_pointer_declare: 'cpp:pointer_declare',
  cpp_pointer_deref: 'cpp:pointer_deref',
  cpp_printf: 'cpp:printf',
  cpp_priority_queue_declare: 'cpp:priority_queue_declare',
  cpp_priority_queue_top: 'cpp:priority_queue_top',
  cpp_pure_virtual: 'cpp:pure_virtual',
  cpp_queue_back: 'cpp:queue_back',
  cpp_queue_declare: 'cpp:queue_declare',
  cpp_queue_front: 'cpp:queue_front',
  cpp_rand: 'cpp:rand',
  cpp_range_for: 'cpp:range_for',
  cpp_raw_code: 'cpp:raw_code',
  cpp_raw_expression: 'cpp:raw_expression',
  cpp_ref_declare: 'cpp:ref_declare',
  cpp_reinterpret_cast: 'cpp:reinterpret_cast',
  cpp_reverse: 'cpp:reverse',
  cpp_scanf: 'cpp:scanf',
  cpp_set_declare: 'cpp:set_declare',
  cpp_set_insert: 'cpp:set_insert',
  cpp_sizeof: 'cpp:sizeof',
  cpp_sort: 'cpp:sort',
  cpp_srand: 'cpp:srand',
  cpp_stack_declare: 'cpp:stack_declare',
  cpp_stack_top: 'cpp:stack_top',
  cpp_static_cast: 'cpp:static_cast',
  cpp_static_declare: 'cpp:static_declare',
  cpp_static_member: 'cpp:static_member',
  cpp_stod: 'cpp:stod',
  cpp_stoi: 'cpp:stoi',
  cpp_strcat: 'cpp:strcat',
  cpp_strchr: 'cpp:strchr',
  cpp_strcmp: 'cpp:strcmp',
  cpp_strcpy: 'cpp:strcpy',
  cpp_string_append: 'cpp:string_append',
  cpp_string_at: 'cpp:string_at',
  cpp_string_c_str: 'cpp:string_c_str',
  cpp_string_clear: 'cpp:string_clear',
  cpp_string_declare: 'cpp:string_declare',
  cpp_string_empty: 'cpp:string_empty',
  cpp_string_erase: 'cpp:string_erase',
  cpp_string_find: 'cpp:string_find',
  cpp_string_find_first_not_of: 'cpp:string_find_first_not_of',
  cpp_string_find_last_not_of: 'cpp:string_find_last_not_of',
  cpp_string_insert: 'cpp:string_insert',
  cpp_string_length: 'cpp:string_length',
  cpp_string_push_back: 'cpp:string_push_back',
  cpp_string_replace: 'cpp:string_replace',
  cpp_string_substr: 'cpp:string_substr',
  cpp_stringstream_declare: 'cpp:stringstream_declare',
  cpp_strlen: 'cpp:strlen',
  cpp_strncmp: 'cpp:strncmp',
  cpp_strncpy: 'cpp:strncpy',
  cpp_strstr: 'cpp:strstr',
  cpp_struct_declare: 'cpp:struct_declare',
  cpp_struct_member_access: 'cpp:struct_member_access',
  cpp_struct_pointer_access: 'cpp:struct_pointer_access',
  cpp_swap: 'cpp:swap',
  cpp_switch: 'cpp:switch',
  cpp_template_function: 'cpp:template_function',
  cpp_ternary: 'cpp:ternary',
  cpp_throw: 'cpp:throw',
  cpp_to_string: 'cpp:to_string',
  cpp_tolower: 'cpp:tolower',
  cpp_toupper: 'cpp:toupper',
  cpp_try_catch: 'cpp:try_catch',
  cpp_typedef: 'cpp:typedef',
  cpp_using_alias: 'cpp:using_alias',
  cpp_using_namespace: 'cpp:using_namespace',
  cpp_vector_back: 'cpp:vector_back',
  cpp_vector_declare: 'cpp:vector_declare',
  cpp_vector_pop_back: 'cpp:vector_pop_back',
  cpp_vector_size: 'cpp:vector_size',
  cpp_virtual_method: 'cpp:virtual_method',
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

export const UPGRADES: Record<number, Upgrade> = {
  1: (raw) => ({ ...raw, tree: 改寫身分(raw.tree, 合併掉的身分), version: 2 }),
  2: (raw) => ({ ...raw, tree: 改寫身分(raw.tree, 加上命名空間), version: 3 }),
}

export type VersionVerdict =
  | { kind: 'ok' }
  | { kind: 'needs-upgrade'; from: number }
  | { kind: 'too-new'; from: number }
  | { kind: 'not-a-save'; detail: string }

/**
 * 判定一份**已經解析過**的資料是不是可用的存檔。
 *
 * 形狀不符時回傳 `not-a-save` 並說明原因——「說不出為什麼拒絕」等於沒有拒絕，
 * 使用者會看到一個無法行動的訊息。
 *
 * **額外欄位不構成拒絕理由**：一份來自較新版本、版本號卻相同的存檔會多出
 * 欄位。判嚴的代價是抹掉使用者的資料，判鬆的代價是多存幾個沒用的鍵——
 * 不對稱，所以判鬆。
 */
export function judge(value: unknown): VersionVerdict {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { kind: 'not-a-save', detail: `不是物件（${describe(value)}）` }
  }

  const obj = value as Record<string, unknown>

  const missing = Object.keys(REQUIRED_FIELDS).filter((k) => !(k in obj))
  if (missing.length > 0) {
    return { kind: 'not-a-save', detail: `缺少必填欄位：${missing.join('、')}` }
  }

  const version = obj.version
  if (typeof version !== 'number' || !Number.isFinite(version)) {
    return { kind: 'not-a-save', detail: `版本號不是有限數字（${describe(version)}）` }
  }

  if (version > CURRENT_VERSION) return { kind: 'too-new', from: version }
  if (version < CURRENT_VERSION) return { kind: 'needs-upgrade', from: version }
  return { kind: 'ok' }
}

/**
 * 從 JSON 字串判定。**兩條讀取路徑都走這裡**，所以它們不可能鬆緊度不同。
 */
export function judgeJSON(json: string): { verdict: VersionVerdict; value: unknown } {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    return { verdict: { kind: 'not-a-save', detail: '不是合法的 JSON' }, value: undefined }
  }
  return { verdict: judge(value), value }
}

/**
 * 逐版套用升級，從 `from` 到 `CURRENT_VERSION`。
 *
 * 逐版而非一步到位，是為了讓「新增一版」只需要寫一個函式。
 *
 * 失敗時回傳 `null`——**不得產出半升級的狀態**，那比拒絕更難察覺。
 */
export function upgrade(
  raw: Record<string, unknown>,
  from: number,
): { ok: true; value: Record<string, unknown> } | { ok: false; reason: string } {
  let current = raw
  for (let v = from; v < CURRENT_VERSION; v++) {
    const step = UPGRADES[v]
    if (!step) return { ok: false, reason: `沒有從版本 ${v} 到 ${v + 1} 的升級路徑` }
    try {
      current = { ...step(current), version: v + 1 }
    } catch (e) {
      return { ok: false, reason: `版本 ${v} → ${v + 1} 的升級失敗：${String(e)}` }
    }
  }
  const after = judge(current)
  if (after.kind !== 'ok') {
    return { ok: false, reason: `升級後仍然不是可用的存檔：${describeVerdict(after)}` }
  }
  return { ok: true, value: current }
}

function describe(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return '陣列'
  return typeof v
}

function describeVerdict(v: VersionVerdict): string {
  switch (v.kind) {
    case 'ok':
      return '可用'
    case 'needs-upgrade':
      return `仍是版本 ${v.from}`
    case 'too-new':
      return `版本 ${v.from} 高於當前`
    case 'not-a-save':
      return v.detail
  }
}
