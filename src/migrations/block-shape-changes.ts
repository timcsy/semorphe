/**
 * **哪幾顆積木的「形狀」在哪一版變了** —— 快取失效的宣告表
 *
 * ## 為什麼這不是一張改名表
 *
 * `block-type-migrations.ts` 處理的是**同一顆積木換了名字**——舊存檔改個字串就好。
 * 這裡處理的是**同一顆積木換了骨架**：一個欄位變成一個接點。
 *
 * ```
 * 改名   fields.NAME 還在，只是積木叫別的名字      → 改字串
 * 換骨架 fields.NAME 這一格【不存在了】            → 改不動
 * ```
 *
 * ## 🔴 而正解不是「手修它」，是「讓它失效」
 *
 * `v11`（2026-08-24）把 `blocklyState` 降格成**帶失效條件的快取**，
 * 真相是 `code`（`app.ts` 的 `sideCarUsable` 逐字：
 * 「**對不上的時候，寧可重排版，也不要拿一份與程式碼不一致的積木**」）。
 *
 * 所以形狀變了的時候：**丟掉快取，讓它從程式碼重 lift**。
 * 重 lift 會免費得到正確的新形狀——`nums[0] += 1` 的左邊會是一顆
 * 巢狀的節點，而**不需要在遷移裡寫一個 parser**。
 *
 * > **要把一個字串 parse 回結構才能搬運的存檔欄位，
 * > 代表那個欄位不該是被搬運的那一份。**
 *
 * ⚠️ 反過來說，這一招**只在 `code` 是真相的前提下成立**。
 * 哪天有一種東西只活在積木上（座標不算——那本來就可以丟），
 * 這張表就不適用，那時要的是真的轉換。
 *
 * ## ⚠️ 只在【確定是那個東西】的位置判斷
 *
 * `storage-version.ts` 記著一次回退了 121 個檔的教訓：
 * 「`field_dropdown`……**字面一模一樣而意思完全無關**」。
 * 所以這裡比對的是「**這個 `type` 的積木身上有這個退場欄位**」兩個條件的合取，
 * 不是「任何地方出現過 NAME」。
 */

/** 一顆積木的骨架變了：它身上這些欄位已經不存在。 */
export interface ShapeChange {
  /** 積木型別（**遷移當下的名字**——改名表先跑，所以這裡用新名） */
  blockType: string
  /** 已經退場的欄位名 */
  retiredFields: string[]
  /**
   * 已經退場的 `extraState` 鍵（2026-08-26 加）。
   *
   * 🔴 **一顆積木的骨架不只有欄位**：`cpp_input` 的命令式定義存的是
   * `{ args: [{ mode, text }] }`，而宣告式的可變參數建構子存的是
   * `{ itemCount }`——**沒有任何欄位改變**，而舊快取載進去會少掉格子。
   *
   * > **一個只看得見欄位的失效判定，看不見「同一顆積木換了記憶方式」。**
   */
  retiredExtraState?: string[]
  /**
   * 已經退場的**接點名**（2026-09-19 加）。
   *
   * 🔴 **在此之前這個機制看不見接點改名，而那是一整類的缺口。**
   * `staleShapeIn` 只讀 `n.fields` 與 `n.extraState`——它**遞迴進** `n.inputs`
   * 去找巢狀積木，卻從來不看那些 input 叫什麼名字。
   *
   * 於是把一顆積木的 `input_value` 從 `VALUE` 改名成 `OBJ` 時，
   * 一筆 `retiredFields: ['VALUE']` **完全不會命中**——
   * 而**症狀不是報錯**：舊存檔裡接在 `VALUE` 的那顆積木安靜地消失。
   *
   * > **一個只看得見欄位的失效判定，看不見「同一顆積木換了接點的名字」。**
   *（上面那一條 2026-08-26 寫的是「換了記憶方式」——**這是同一句話的第三種**。）
   */
  retiredInputs?: string[]
  /** 為什麼——會被印進報表 */
  why: string
}

/**
 * `v11 → v12`：**左值從欄位換成接點**（路線圖「左值是接點，不是字串」）。
 *
 * ⚠️ 往後每還一顆就往這張表加一筆，並開一個新的版號
 * ——**同一個版號裡加第二筆是無效的**：已經升到 v12 的存檔不會再跑一次 v12。
 */
export const SHAPE_CHANGES_V12: ShapeChange[] = [
  {
    blockType: 'python_var_assign_compound',
    retiredFields: ['NAME'],
    why: '左值 `NAME`（變數下拉）換成 `TARGET` 接點——'
      + '下拉列的是變數清單，而左值可以是 `a[i]`／`o.x`／`a.b.c`，點一下就毀掉它們。',
  },
]

/**
 * 這份積木快取裡，有沒有哪一顆的骨架已經變了。
 *
 * **只在已知結構上遞迴**（`blocks.blocks[]`、`inputs.*.block`／`.shadow`、
 * `next.block`／`.shadow`），認不得的原樣略過——不猜。
 *
 * 對已經升過的存檔是**冪等**的：快取被丟掉之後這裡找不到東西，回 `null`。
 */
export function staleShapeIn(
  blocklyState: unknown,
  changes: ShapeChange[],
): ShapeChange | null {
  if (changes.length === 0) return null
  const byType = new Map(changes.map((c) => [c.blockType, c]))
  let hit: ShapeChange | null = null

  const oneBlock = (b: unknown): void => {
    if (hit || !b || typeof b !== 'object' || Array.isArray(b)) return
    const n = b as Record<string, unknown>
    const change = typeof n.type === 'string' ? byType.get(n.type) : undefined
    if (change) {
      // 🔴 **合取**：型別對得上 ＋ 身上真的有那個退場的東西。
      //    少了後半，一顆已經是新形狀的積木也會讓整份快取被丟掉。
      const fields = (n.fields && typeof n.fields === 'object') ? n.fields as Record<string, unknown> : {}
      if (change.retiredFields.some((f) => f in fields)) { hit = change; return }
      const extra = (n.extraState && typeof n.extraState === 'object')
        ? n.extraState as Record<string, unknown> : {}
      if ((change.retiredExtraState ?? []).some((k) => k in extra)) { hit = change; return }
      /**
       * 🔴 **接點也會退場**（2026-09-19）——見 `retiredInputs` 的檔頭。
       * ⚠️ 這一段要在下面那個「遞迴進 inputs」**之前**：那一段找的是巢狀的積木，
       *    而這一段問的是**這一顆自己的 input 叫什麼名字**。兩件事。
       */
      const ins = (n.inputs && typeof n.inputs === 'object')
        ? n.inputs as Record<string, unknown> : {}
      if ((change.retiredInputs ?? []).some((k) => k in ins)) { hit = change; return }
    }
    if (n.inputs && typeof n.inputs === 'object') {
      for (const v of Object.values(n.inputs as Record<string, unknown>)) {
        const slot = v as Record<string, unknown> | undefined
        oneBlock(slot?.block); oneBlock(slot?.shadow)
      }
    }
    if (n.next && typeof n.next === 'object') {
      const nx = n.next as Record<string, unknown>
      oneBlock(nx.block); oneBlock(nx.shadow)
    }
  }

  if (!blocklyState || typeof blocklyState !== 'object') return null
  const blocks = (blocklyState as Record<string, unknown>).blocks as Record<string, unknown> | undefined
  if (blocks && Array.isArray(blocks.blocks)) (blocks.blocks as unknown[]).forEach(oneBlock)
  return hit
}

/**
 * `v12 → v13`：**C++ 的複合指定**（同一個路線圖項目的第二筆）。
 *
 * ⚠️ **為什麼不加進 `SHAPE_CHANGES_V12`**：`v12` 已經送出去了，
 * 而**已經升到 v12 的存檔不會再跑一次 v12**。同一個版號裡加第二筆是無效的。
 *
 * 🪦 這兩顆的舊形狀還帶著 `altLayout`（依 `extraState` 換一整份佈局，
 * 為了讓 `a[i] += 2` 的索引顯示出來）——**那是這個病的症狀**，
 * 左值變成接點之後它一起退場。所以舊快取裡可能有 `fields.NAME`
 * ＋ 一個 `inputs.INDEX`，兩種佈局都靠 `NAME` 認得出來。
 */
export const SHAPE_CHANGES_V13: ShapeChange[] = [
  {
    blockType: 'cpp_var_assign_compound',
    retiredFields: ['NAME'],
    why: '左值 `NAME`（變數下拉）＋ 可有可無的 `INDEX` 換成一個 `TARGET` 接點——'
      + '那兩格是左值形狀的列舉，而它列了兩種（`o.x`／`p->x`／`*q`／`a[i][j]` 都不在內）。',
  },
  {
    blockType: 'cpp_var_assign_compound_expression',
    retiredFields: ['NAME'],
    why: '同上——運算式形態。',
  },
  {
    blockType: 'cpp_increment',
    retiredFields: ['NAME'],
    why: '運算元 `NAME`（變數下拉）＋ 可有可無的 `INDEX` 換成一個 `TARGET` 接點——'
      + '`++` 的運算元是一個左值（`o.x++`／`p->x++`／`(*q)++` 都合法），而它列了兩種。',
  },
  {
    blockType: 'cpp_increment_expression',
    retiredFields: ['NAME'],
    why: '同上——運算式形態。',
  },
]

/**
 * `v13 → v14`：**普通指派**的左值（同一個路線圖項目的第四筆）。
 */
export const SHAPE_CHANGES_V14: ShapeChange[] = [
  {
    blockType: 'cpp:input_line',
    retiredFields: ['NAME'],
    why: '`getline(cin, …)` 讀進去的那一格換成 `TARGET` 接點——'
      + '`getline(cin, o.name)` 在 C++ 合法，而它本來被抄成字串。',
  },
  {
    blockType: 'cpp_var_assign',
    retiredFields: ['NAME'],
    why: '左值 `NAME`（變數下拉）換成 `TARGET` 接點——語料上那個字串裝著 12 種'
      + '非原子的值（`r.x`／`p.x`…），而執行器只認得一個點號。',
  },
]

/**
 * `v14 → v15`：**`cin >>` 改成與 `cout <<` 同一個建構子**。
 *
 * 🔴 這一筆**沒有任何欄位改變**——舊的命令式定義存 `{ args: [{ mode, text }] }`，
 * 而可變參數建構子存 `{ itemCount }`。`select` 模式那些還多一個 `SEL_i` 欄位，
 * 而 `compose` 模式的**一個欄位都沒有**：只靠欄位判的話會漏掉一半。
 */
export const SHAPE_CHANGES_V15: ShapeChange[] = [
  {
    blockType: 'cpp_input',
    retiredFields: ['SEL_0'],
    retiredExtraState: ['args'],
    why: '`cin >> a >> b` 改成與 `cout << a << b` 同一個可變參數建構子——'
      + '每一格從「變數下拉／接點二選一」變成單純的接點。',
  },
  {
    blockType: 'cpp_input_expression',
    retiredFields: ['SEL_0'],
    retiredExtraState: ['args'],
    why: '同上——運算式形態。',
  },
]

/**
 * `v15 → v16`：**兩顆格式化 I/O 也改用可變參數建構子**。
 *
 * 與 v15 同一個形狀：`{ args: [{ mode, text }] }` → `{ itemCount }`，
 * 而 `select` 模式那些多一個 `SEL_i` 欄位、`compose` 模式的一個欄位都沒有。
 */
export const SHAPE_CHANGES_V16: ShapeChange[] = [
  {
    blockType: 'cpp_print_formatted',
    retiredFields: ['SEL_0'],
    retiredExtraState: ['args'],
    why: '`printf` 的每一格從「變數下拉／接點二選一」變成單純的接點。',
  },
  {
    blockType: 'cpp_input_formatted',
    retiredFields: ['SEL_0'],
    retiredExtraState: ['args'],
    why: '同上——`scanf`。',
  },
  {
    blockType: 'cpp_input_formatted_expression',
    retiredFields: ['SEL_0'],
    retiredExtraState: ['args'],
    why: '同上——運算式形態。',
  },
]

/**
 * `v18 → v19`：**接收者從欄位換成接點**（39 顆積木）。
 *
 * 舊存檔裡那一格是一個**欄位值**（一個變數名），而新的是一個**接點**。
 * 照這個檔的機構：**丟掉快取，讓它從程式碼重 lift**——重 lift 會免費得到
 * 正確的新形狀（`m[k].push_back(x)` 的接收者會是一棵樹），
 * **而不需要在遷移裡寫一個 parser**。
 *
 * ⚠️ 這正是檔頭那句話的實例：「**要把一個字串 parse 回結構才能搬運的存檔欄位，
 * 代表那個欄位不該是被搬運的那一份。**」
 */
const WHY = '接收者 `OBJ` 從欄位換成接點——`m[k]`／`v[i]`／`it->second` 當接收者時，'
  + '一個欄位只裝得下一串文字，而解那串文字的地方只認得「名字、數字、以及它們的加減」。'

export const SHAPE_CHANGES_V19: ShapeChange[] = [
  { blockType: 'cpp_struct_at_ptr', retiredFields: ['PTR'], why: WHY },
  { blockType: 'cpp_container_append', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_container_clear', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_container_count', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_container_empty', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_container_erase', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_container_find', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_container_iter', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_container_pop', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_container_pop_stack', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_container_pop_queue', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_container_pop_front', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_container_push', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_container_push_stack', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_container_push_queue', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_container_push_front', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_method_call', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_method_call_expression', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_priority_queue_peek', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_queue_back', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_queue_front', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_set_insert', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_stack_peek', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_string_append', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_string_append_char', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_string_as_cstring', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_string_at', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_string_clear', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_string_empty', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_string_erase', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_string_find', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_string_find_first_not_of', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_string_find_last_not_of', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_string_insert', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_string_replace', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_string_size', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_string_substr', retiredFields: ['OBJ'], why: WHY },
  { blockType: 'cpp_vector_back', retiredFields: ['VECTOR'], why: WHY },
  { blockType: 'cpp_vector_pop', retiredFields: ['VECTOR'], why: WHY },
  { blockType: 'cpp_vector_size', retiredFields: ['VECTOR'], why: WHY },
]


/**
 * `v19 → v20`：**走訪的容器從欄位換成接點**（範圍 for）。
 *
 * 一個欄位只裝得下一串文字，而 `for (int i : d2[pt])` 的容器是一個**運算式**
 * ——執行期拿那串文字去查變數，說「沒有宣告過 `d2[pt]`」。
 * **錯誤看起來像學生打錯字，而問題在我們把它壓成了文字。**
 *
 * 🔴 同一個病 2026-09-18 早上才在接收者那一族治過一次（`SHAPE_CHANGES_V19`，39 顆）
 * ——而**這一顆不在那 39 顆裡**，因為它的那一格叫 `CONTAINER` 不叫 `OBJ`。
 *
 * > **一次批次的治療，治得到的是被列進那份名單的；
 * > 而名單是按【欄位名】列的，同一個病換一個欄位名就會被漏掉。**
 */
export const SHAPE_CHANGES_V20: ShapeChange[] = [
  {
    blockType: 'cpp_loop_range',
    retiredFields: ['CONTAINER'],
    why: '走訪的容器 `CONTAINER` 從欄位換成接點——`d2[pt]`／`m[k]` 是運算式，'
      + '而一個欄位只裝得下一串文字。',
  },
]

/**
 * ## V21：範圍演算法的兩端從欄位換成接點（2026-09-18）
 *
 * 十顆範圍演算法的 `BEGIN`／`END`（`sort` 與 `reverse`／`fill` 那三顆叫
 * `CONTAINER`，因為它們的積木上**只有一格**）＋ 前綴和的 `DEST`。
 *
 * 一個欄位只裝得下一串文字，而執行期用一條 regex 把那串文字解析回
 * 「哪個陣列、從哪到哪」——那條 regex 只認得**一個裸識別字**開頭的東西，
 * 於是學生真的寫的 `begin(a)`、`d2[i].begin()`、`d2[0]` 全部斷在那裡。
 *
 * 🔴 **同一個病的第三次**（`SHAPE_CHANGES_V19` 的接收者 39 顆 ·
 * `V20` 的走訪對象 1 顆 · 這裡 10 顆）。而三次的判準都一樣：
 *
 * > **需要 parse 回結構才能用的字串，就不該是字串。**
 *
 * ⚠️ 而 V20 的註解已經寫下了「為什麼漏掉」的形狀，這一次它又成立了一次：
 * 那 39 顆是按**欄位名** `OBJ` 列的，而這一族的欄位叫 `BEGIN`／`END`／`CONTAINER`。
 *
 * 🟢 **`cpp_range_sort` 那一格特別要記住**：它的積木上**只有 `CONTAINER` 一格**，
 * 對到 `begin` 屬性——也就是說 **`end` 在積木上從來沒有落點**。
 * 第三十一條（投影遺失）看不到它，因為那條掃的是**接點**而 `end` 當時是屬性。
 *
 * > **一個「還沒結構化」的欄位，連「它有沒有被畫出來」都不會被問。**
 */
export const SHAPE_CHANGES_V21: ShapeChange[] = [
  { blockType: 'cpp_range_sort', retiredFields: ['CONTAINER'],
    why: '範圍的兩端從欄位換成接點；而這一顆的積木上只有一格，`end` 從來沒有落點。' },
  { blockType: 'cpp_range_reverse', retiredFields: ['CONTAINER'],
    why: '範圍的兩端從欄位換成接點；而這一顆的積木上只有一格，`end` 從來沒有落點。' },
  { blockType: 'cpp_range_fill', retiredFields: ['CONTAINER'],
    why: '範圍的兩端從欄位換成接點；而這一顆的積木上只有一格，`end` 從來沒有落點。' },
  { blockType: 'cpp_range_fill_sequence', retiredFields: ['BEGIN', 'END'],
    why: '範圍的兩端從欄位換成接點——一個欄位只裝得下一串文字。' },
  { blockType: 'cpp_range_sum', retiredFields: ['BEGIN', 'END'],
    why: '範圍的兩端從欄位換成接點——一個欄位只裝得下一串文字。' },
  { blockType: 'cpp_range_sum_partial', retiredFields: ['BEGIN', 'END', 'DEST'],
    why: '範圍的兩端與寫入的目的地從欄位換成接點——目的地也是一個位置（`b+1` 是合法的）。' },
  { blockType: 'cpp_range_max', retiredFields: ['BEGIN', 'END'],
    why: '範圍的兩端從欄位換成接點——一個欄位只裝得下一串文字。' },
  { blockType: 'cpp_range_min', retiredFields: ['BEGIN', 'END'],
    why: '範圍的兩端從欄位換成接點——一個欄位只裝得下一串文字。' },
  { blockType: 'cpp_range_find_lower', retiredFields: ['BEGIN', 'END'],
    why: '範圍的兩端從欄位換成接點——一個欄位只裝得下一串文字。' },
  { blockType: 'cpp_range_find_upper', retiredFields: ['BEGIN', 'END'],
    why: '範圍的兩端從欄位換成接點——一個欄位只裝得下一串文字。' },
]

/**
 * ## V22：二維陣列的維度從欄位換成接點（2026-09-19）
 *
 * `ROWS`／`COLS` 兩格。一個欄位只裝得下一串文字，而執行期 `Number(那串文字)`
 * 對 `n`／`x*2` 都是 `NaN`——於是那個陣列**零列**，
 * 而錯誤出現在**下一行**的 `d2[i][j]`。
 *
 * > **一個錯誤訊息指著最後一個碰到它的人，而不是造成它的人。**
 *
 * 🔴 **同一個病的第四次**（`V19` 接收者 39 顆 · `V20` 走訪對象 1 顆 ·
 * `V21` 範圍的兩端 10 顆 · 這裡 1 顆），而判準四次都一樣：
 *
 * > **需要 parse 回結構才能用的字串，就不該是字串。**
 *
 * ⚠️ 而這一顆特別值得記住：**同族那顆一維陣列的 `size` 早就是接點**
 * ——它是一個**不對稱**，而第七十二條護欄看不到它，
 * 因為測試語料裡的維度永遠是數字字面值。
 *
 * > **語料乾淨不代表模型對：它代表語料是照著模型長的。**
 */
export const SHAPE_CHANGES_V23: ShapeChange[] = [
  {
    blockType: 'cpp_bits_count',
    retiredFields: [],
    retiredInputs: ['VALUE'],
    why: '它多了第二種寫法（`bs.count()`），而方法那一路把接收者放進 `obj`'
      + '——由**宣告**決定（`io.ts` 的 `receiverInto`）。插槽因此從 `VALUE` 改名成 `OBJ`。'
      + '⚠️ 不改名的症狀不是報錯：接收者掉進一串文字屬性，執行時數出 0 而不出聲。',
  },
]

export const SHAPE_CHANGES_V22: ShapeChange[] = [
  {
    blockType: 'cpp_array_2d_declare',
    retiredFields: ['ROWS', 'COLS'],
    why: '維度從欄位換成接點——`int a[n][5]` 與 `int a[x*2][7]` 是運算式，'
      + '而一個欄位只裝得下一串文字。',
  },
]
