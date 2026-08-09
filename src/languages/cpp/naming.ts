/**
 * C++ 套件的命名詞彙表
 *
 * ## 為什麼詞彙表是資料，不是慣例
 *
 * 「命名一致」是不可否證的，所以它會隨每個維護者的品味漂移，
 * 而**在有版本之後，每次漂移都是一次存檔遷移**（發版 ＋ 遷移表 ＋ 立墓碑）。
 * 寫成明列的清單，「加一個新字」就變成**顯式動作**——
 * 有人會在寫 `length` 的時候看到清單上已經有 `size`。
 *
 * 這與 `identity.ts` 的 scope 白名單是同一個機制，往下一層套用。
 *
 * ## 這份表**不是**從現況導出的
 *
 * 現況有四群同義詞。這裡各選一個，其餘**故意不列**——於是它們會被指名。
 * **表是目標，不是快照。**
 *
 * ## 消費者
 *
 * `tests/integration/audit-naming.test.ts`（第二十七條護欄）。沒有執行期讀者是
 * 刻意的——它描述「名字該長什麼樣」，那是規範不是行為，而規範沒有機械檢查就是殼。
 */
import type { NamingVocabulary } from '../../core/naming'

/**
 * 主體詞彙——「這個操作作用在什麼上」。
 *
 * ⚠️ 大部分是**從現況量出來的**（被 ≥2 顆元件共用的前綴），不是挑的。
 * 少數幾個（`loop`／`literal`）是補上的——`count_loop` 的主體其實是 `loop`，
 * 而「排序即分群」要求它排在 `loop_*` 那一族裡。
 */
export const SUBJECTS = [
  'array', 'array_2d', 'class', 'container', 'enum', 'func', 'ifstream',
  'istringstream', 'literal', 'loop', 'map', 'math', 'method', 'namespace',
  'ofstream', 'pair', 'pointer', 'priority_queue', 'queue', 'set', 'stack',
  'string', 'stringstream', 'struct', 'template', 'var', 'vector',
] as const

/**
 * 操作詞彙——**封閉集合，同一個操作在任何主體上用同一個字**。
 *
 * ⚠️ **這一份是選出來的，需要人覆核。** 四群同義詞各選了一個：
 *
 * | 一件事 | 現況有 | 這裡選 |
 * |---|---|---|
 * | 大小 | `size`／`length` | **`size`** |
 * | 加到尾端 | `push_back`／`append` | **`append`** |
 * | 取單一元素 | `access`／`at` | **`at`** |
 * | 看某一端 | `top`／`front`／`back` | **`peek`**（哪一端變成參數） |
 *
 * 最後一列最激進——它把「哪一端」從名字挪進參數。理由是 `stack_top` 與
 * `queue_front` 的差別是**紀律**（LIFO／FIFO），而紀律已經在主體裡了。
 * **這一條特別需要覆核**：stack/queue 的混淆曾被使用者回報過
 * （`knowledge/episodes/2026-08-07-學生說積木寫錯了.md`）。
 */
export const OPERATIONS = [
  'append', 'assign', 'at', 'call', 'cast', 'clear', 'count', 'declare',
  'def', 'empty', 'erase', 'find', 'insert', 'make', 'peek',
  'pop', 'push', 'ref', 'size', 'swap',
] as const

/**
 * 種類——名詞性的種差。
 *
 * `literal` 與 `loop` 從**操作**改成**主體**（`literal_char`／`loop_while`），
 * 於是第二段變成種類。理由是「排序即分群」：`count_loop`／`while_loop`／`for_loop`
 * 排不在一起，`loop_*` 排得在一起——而登錄表、工具箱、目錄都吃這個順序。
 */
export const KINDS = ['char', 'number', 'string', 'count', 'for', 'while', 'range', 'do_while'] as const

/**
 * 修飾詞——**不得站在主體的位置**。
 *
 * `static` 同時是 `static_cast`（轉型）、`static_declare`（宣告）、
 * `static_member`（成員）的「主體」——而它三次都是修飾詞。
 *
 * 依 `knowledge/concepts/元件.md` 的跨域規則②，修飾詞該是**參數**或**形態**。
 * C1 已經查證過「修飾詞確實是參數不是身分」
 * （`tests/assets/identity-review-decisions.json`），只是合併要附一次性轉換，
 * 所以延後了。**這條護欄讓那筆延後看得見。**
 */
export const MODIFIERS = [
  'const', 'constexpr', 'static', 'virtual', 'pure', 'override', 'auto',
  'dynamic', 'reinterpret', 'ref', 'compound',
] as const

/**
 * 允許的**單字名**——不可分解成「主體＋操作」，而那是對的。
 *
 * ## 判準：語言構造 vs 函式庫函式
 *
 * | | 例 | 可以是單字名嗎 |
 * |---|---|---|
 * | **語言構造** | `switch`／`ternary`／`lambda`／`new` | **可以**——原生的，沒有主體可拆 |
 * | **函式庫函式** | `strlen`／`stoi`／`memcpy`／`iota` | **不可以**——它有主體（`strlen` ＝ C 字串的大小） |
 *
 * 抄函式庫的名字，連帶抄了它的縮寫與詞性不一致。而這個判準**不可能純結構地
 * 偵測**（兩者都是單字），所以這份清單是**人的判斷**；護欄只保證「宣告了什麼
 * 就照什麼來」，清單之外的每一個單字名都會被指名。
 */
export const ATOMIC_NAMES = [
  // 通用構造
  'program', 'if', 'if_else', 'break', 'continue', 'return', 'print', 'input',
  'endl', 'comment', 'doc_comment', 'block_comment', 'arithmetic', 'compare',
  'logic', 'logic_not', 'negate', 'bitwise_not', 'increment',
  // C／C++ 家族的**語言構造**
  'switch', 'case', 'default', 'ternary', 'throw', 'try_catch', 'lambda',
  'new', 'delete', 'malloc', 'free', 'sizeof',
  'comma_expr', 'address_of', 'cast', 'constructor', 'destructor',
  'operator_overload', 'typedef', 'using_alias', 'using_namespace',
  'include', 'include_local', 'define', 'ifdef', 'ifndef',
  'forward_decl', 'builtin_constant',
  // 降級標記——不是元件，應走 declareNonComponent
  'raw_code', 'raw_expression',
] as const

/**
 * **接收者參數的名字**——「這個操作作用在哪個既有物件上」。
 *
 * 現況 26 顆叫 `obj`、9 顆叫別的（`name`／`vector`／`ptr_name`）。多數決不是理由，
 * 理由是**同一個角色只能有一個名字**，否則讀的人得記三種寫法。
 */
export const RECEIVER_PARAM = 'obj'

/**
 * 這些操作的第一個識別字參數**是那個東西自己的名字，不是接收者**。
 *
 * | 操作 | 第一個參數是什麼 |
 * |---|---|
 * | `declare` | 正在被創造的名字（`int x` 的 `x`） |
 * | `ref` | 正在被引用的名字 |
 * | `call` | 正在被呼叫的函式名 |
 * | `def`／`literal`／`loop`／`cast` | 同理，不是「對某物做事」 |
 *
 * 判準是**創造／引用 vs 操作**：前者的參數是那個東西的識別字，
 * 後者的參數是被操作的物件。
 */
export const SELF_NAMING_OPERATIONS = ['declare', 'ref', 'call', 'def', 'literal', 'loop', 'cast'] as const

export const CPP_NAMING: NamingVocabulary = {
  subjects: SUBJECTS,
  operations: OPERATIONS,
  kinds: KINDS,
  modifiers: MODIFIERS,
  atomicNames: ATOMIC_NAMES,
}
