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
  'array', 'array_2d', 'cast', 'char', 'class', 'container', 'cstring', 'enum',
  // ⚠️ `exception` 加入日 2026-08-13——`cpp:exception_make`（`runtime_error("…")`）。
  // 主體是「例外」，種類（runtime／logic／out_of_range…）是**參數**不是身分，
  // 與 `container_push` 把容器種類當參數同一個形狀。
  'exception',
  'func', 'ifstream',
  // ⚠️ `bits` 加入日 2026-08-13——`cpp:bits_count`（`__builtin_popcount`）。
  // 主體是「一個整數的二進位表示」，而**不是**那個整數本身：
  // `bits_count` 數的是位元，`math_*` 算的是值。競賽會用到一整族
  // （`popcount`／`clz`／`ctz`），它們共用這個主體。
  'bits',
  // ⚠️ 以下四個加入日 2026-08-17——Arduino 執行期表面（spec 137）。
  //
  // `pin`     ——一個接點。`pin_mode`／`pin_constant` 共用它。
  // `digital` / `analog` ——🔴 **它們是【訊號的種類】而站在主體位**，
  //   而那是刻意的：`digitalWrite` 與 `analogWrite` 對**同一個腳位**做的是
  //   **兩件不同的事**（一個是高低，一個是 0–255），
  //   合成 `pin_write(kind)` 會讓「哪些值合法」變成執行期才知道的事。
  // `serial`  ——序列埠。⚠️ 它與 `io` 並存：`io_sync`／`io_tie` 講的是
  //   **標準輸入輸出的加速**，而 `serial` 是**另一個裝置**。
  'pin', 'digital', 'analog', 'serial',
  // ⚠️ `io` 加入日 2026-08-13——`cpp:io_sync`／`cpp:io_tie`（競賽的加速框架）。
  // 主體是**輸入輸出流本身**，不是流上的一次讀寫：`print`／`input` 作用在
  // 「一筆資料」上，而這兩顆作用在「這條流怎麼運作」上。
  'io',
  'member',
  'input', 'memory', 'print', 'program', 'random', 'range',
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
  'abs', 'append', 'as', 'back', 'compare', 'copy', 'deref', 'exit', 'fill',
  'front', 'gcd', 'is', 'lcm', 'max', 'min', 'next', 'replace', 'reverse',
  'seed', 'sort', 'substr', 'sum', 'to',
  'def', 'empty', 'erase', 'find', 'insert', 'make', 'peek',
  'pop', 'push', 'ref', 'size', 'swap',
  // ⚠️ 兩個都是 2026-08-13 加的，各對一顆競賽加速元件。
  //
  // `sync`  ——「兩邊保持一致」。`ios::sync_with_stdio(false)` 關掉的正是這件事。
  // `tie`   ——「一邊動另一邊跟著動」。`cin.tie(nullptr)` 解除的正是這個連動。
  //
  // 🔴 `tie` 與 `std::tie`（拆解 tuple）撞名，而**那是兩件無關的事**。
  // 這裡取的是「連動」這個語義；如果哪天要收 `std::tie`，它的主體是 `pair`／
  // `tuple`，操作不會是 `tie`——先在這裡把話講明，免得將來有人以為是同一族。
  'sync', 'tie',
  // ⚠️ `iter` 加入日 2026-08-13——`cpp:container_iter`（`v.begin()`／`v.end()`）。
  // 「取得一個指向某一端的位置」。**哪一端是參數**，與 `peek` 那條同一個規則
  // （`stack_top`／`queue_front` 的差別是紀律，而紀律已經在主體裡）。
  'iter',
  // ⚠️ 以下四個加入日 2026-08-17——Arduino 執行期表面（spec 137）。
  //
  // `remap` ——「把一個值從一個區間換算到另一個區間」（`map(v,0,1023,0,255)`）。
  //   🔴 而身分**刻意不叫 `map`**：既有的 `cpp:map_declare` 是 `std::map`，
  //   **兩者語義毫無關係，而它們會出現在同一個工具箱裡**。
  // `mode`  ——「設定一個接點的工作方式」（`pinMode`）。它不是讀也不是寫，
  //   是**在讀寫之前決定方向**——所以它不併進 `read`／`write`。
  // `read` / `write` ——對**外界**的讀寫。⚠️ 與 `at`（讀容器的一格）刻意分開：
  //   `at` 的對象在程式裡，而這兩個的對象**在程式外面**，讀兩次可以不一樣。
  'remap', 'mode', 'read', 'write',
  // `constant` ——「一個由環境提供的具名常數」（`cpp:pin_constant`）。
  //   ⚠️ 與既有的 `cpp:builtin_constant` 是同一個形狀——**而那顆逃過了這條檢查**，
  //   因為 `builtin` 不在主體詞彙表裡。這裡把話講明。
  // `open`    ——「開啟一個裝置」（`Serial.begin(9600)`）。
  //   🔴 **身分刻意不叫 `serial_begin`**：`begin` 在這張表裡已經被
  //   `iter` 那一族用掉了（「取得一端」，`v.begin()`），
  //   而**兩個無關的意思壓在同一個字上**正是 `tie` 那段警告的事。
  //   ⚠️ 語法仍然是 `Serial.begin(...)`——**名字是給人看的，不是給 parser 看的**。
  // `print`   ——它同時是單字名（`cpp:print`）與操作（`cpp:serial_print`）。
  //   那不是矛盾：「輸出」既可以自己成立，也可以是**對某個裝置**做的事。
  'constant', 'open', 'print',
] as const

/**
 * 種類——名詞性的種差。
 *
 * `literal` 與 `loop` 從**操作**改成**主體**（`literal_char`／`loop_while`），
 * 於是第二段變成種類。理由是「排序即分群」：`count_loop`／`while_loop`／`for_loop`
 * 排不在一起，`loop_*` 排得在一起——而登錄表、工具箱、目錄都吃這個順序。
 */
export const KINDS = [
  'char', 'number', 'string', 'count', 'for', 'while', 'range', 'do_while',
  // 種差可以再細分：`find_first_not_of` 是 `find` 這個操作的一個種類
  'first_not_of', 'last_not_of', 'unary', 'binary', 'pow', 'function',
  'member', 'ptr', 'cstring',
  // 第 5 步（裸的函式庫名）帶進來的種差
  'alpha', 'digit', 'lower', 'upper', 'int', 'double',
  'bounded', 'formatted', 'line', 'sequence', 'partial',
  // 第 6 步：**修飾詞從主體位置移到種差位置**。
  // `static` 曾同時是 `static_cast`／`static_declare`／`static_member` 的「主體」
  // ——而它三次都是修飾詞。移到後面之後它們各自歸到真正的主體底下
  // （`cast_*`／`var_declare_*`／`member_*`），而**「這些只差一個修飾詞」
  // 也就一目了然了**——那正是 C1 查證過的「修飾詞是參數不是身分」。
  'auto', 'const', 'constexpr', 'static', 'ref', 'compound', 'dynamic', 'reinterpret',
  'virtual', 'virtual_pure', 'override',
] as const

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
  // ⚠️ `block` ＝ 一個獨立的 `{ … }`。它是**語言構造**（作用域），不是抄來的
  // 函式庫名——與 `program` 同一類：一個結構本身就是那個概念，沒有「主體＋操作」
  // 可以拆。加入日 2026-08-13（見 `src/components/cpp/block/execute.ts` 的檔頭）。
  'program', 'block', 'if', 'if_else', 'break', 'continue', 'return', 'print', 'input',
  'endl', 'comment', 'doc_comment', 'block_comment', 'arithmetic', 'compare',
  'logic', 'logic_not', 'negate', 'bitwise_not', 'increment',
  // C／C++ 家族的**語言構造**
  'switch', 'case', 'default', 'ternary', 'throw', 'try_catch', 'lambda',
  'new', 'delete', 'malloc', 'free', 'sizeof',
  // ⚠️ 兩個加入日 2026-08-17——Arduino 的時間（spec 137）。
  // `delay`／`millis` 是**單字名**：它們沒有主體可拆
  //（「等待」與「開機到現在」都不是作用在某個東西上），與 `sizeof` 同一類。
  'delay', 'millis',
  // ⚠️ `initializer_list` 加入日 2026-08-14——`{1, 2, 3}` 這個**語法本身**。
  // 它是語言構造（聚合初始化列），不是抄來的函式庫名：`std::initializer_list`
  // 是那個語法的**型別**，而這顆元件是那個語法。與 `lambda`／`ternary` 同類。
  'initializer_list',
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
export const SELF_NAMING_OPERATIONS = [
  'declare', 'ref', 'call', 'def', 'literal', 'loop', 'cast',
  // ⚠️ `swap` 是**對稱的**——兩個運算元，沒有哪一個是「被操作的那個」。
  // 「接收者」這個角色只在「一個東西被操作」時才存在。
  'swap',
] as const

export const CPP_NAMING: NamingVocabulary = {
  subjects: SUBJECTS,
  operations: OPERATIONS,
  kinds: KINDS,
  modifiers: MODIFIERS,
  atomicNames: ATOMIC_NAMES,
}
