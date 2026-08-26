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
