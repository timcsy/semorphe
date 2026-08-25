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
import { BLOCK_TYPE_MIGRATIONS_V9_TO_V10 } from '../migrations/block-type-migrations'
import { mergedIdentities } from '../migrations/merged-identities'
import { staleShapeIn, SHAPE_CHANGES_V12, SHAPE_CHANGES_V13, SHAPE_CHANGES_V14, SHAPE_CHANGES_V15 } from '../migrations/block-shape-changes'
import type { ShapeChange } from '../migrations/block-shape-changes'

/** 目前的存檔格式世代 */
export const CURRENT_VERSION = 15

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
  blocklyState: 1,
  codeHash: 1,
  code: 1,
  language: 1,
  styleId: 1,
  topicId: 1,
  targetId: 1,
  enabledBranches: 1,
  lastModified: 1,
  blockStyleId: 1,
  locale: 1,
} satisfies Record<keyof Required<SavedState>, 1>

/**
 * **每一個欄位屬於誰**——四種歸屬，而它們的生命週期不同。
 *
 * ## 為什麼要宣告它（2026-08-24）
 *
 * 規劃「網頁版有檔案」時查證這個型別，發現一份存檔裡**混了四種歸屬**：
 *
 * ```
 * document   屬於【那個檔案】        換一個檔案就換一份
 * sideCar    屬於【那個檔案的外觀】  可以丟，丟了重算
 * user       屬於【使用者】          跨檔案不變
 * context    屬於【現在在上哪一課】  🔴 歸屬待判——它兩邊都不完全屬於
 * meta       存檔機制自己的
 * ```
 *
 * 🔴 **不宣告的代價會在「多檔案」那天一次付清**：那時每一個欄位都要回答
 * 「跟著檔案走還是跟著使用者走」，而**沒有人記得當初是怎麼想的**。
 *
 * ⚠️ **值域是封閉的**（第六十一條護欄盯著）。第五個值出現時要先問
 * 「它是不是一個新的歸屬」，而不是順手加進來
 * （`concepts/執行機構.md:279`：第三個值就是在替「還沒做」找一個體面的名字）。
 *
 * 設計見 `knowledge/draft/2026-08-24-版面與檔案.md`。
 */
export const FIELD_OWNERSHIP = {
  version: 'meta',
  lastModified: 'meta',
  // 【檔案】——它就是真相
  code: 'document',
  language: 'document',
  // 【外觀】——side-car。⚠️ 它是**快取**不是第二份真相，失效條件是 `codeHash`
  blocklyState: 'sideCar',
  codeHash: 'sideCar',
  // 【使用者】——換一個檔案不該變
  styleId: 'user',
  blockStyleId: 'user',
  locale: 'user',
  // 🔴 【教學情境】——歸屬待判：換檔案不該換課程，而換課程時它要換
  topicId: 'context',
  targetId: 'context',
  enabledBranches: 'context',
} satisfies Record<keyof Required<SavedState>, 'document' | 'sideCar' | 'user' | 'context' | 'meta'>

/** 必填欄位——形狀驗證用。同樣由編譯器釘住 */
export const REQUIRED_FIELDS = {
  version: 1,
  blocklyState: 1,
  code: 1,
  language: 1,
  styleId: 1,
  lastModified: 1,
} satisfies Record<RequiredKeys<SavedState>, 1>

/** 版本 N → N+1 的升級函式 */
export type Upgrade = (raw: Record<string, unknown>) => Record<string, unknown>



/**
 * 就地改寫語義樹裡的舊身分。**只改認得的，其餘原樣通過。**
 *
 * ⚠️ 「認得的」這三個字是規格（FR-006）。不在表裡的身分**原樣保留**，
 * 不丟棄也不猜測——猜錯的節點會安靜地產出別的程式碼，那比留一個
 * 認不得的身分糟得多（後者至少會被 C3 的引用完備性護欄指名）。
 *
 * 對已是新格式的身分是**冪等**的：表裡沒有 `cpp:math_pow`，於是它原樣通過。
 */
function rewriteIdentity(node: unknown, table: Record<string, string>): unknown {
  if (!node || typeof node !== 'object') return node
  if (Array.isArray(node)) return node.map((n) => rewriteIdentity(n, table))
  const n = node as Record<string, unknown>
  const out: Record<string, unknown> = { ...n }
  const cid = out.componentId
  if (typeof cid === 'string' && table[cid]) out.componentId = table[cid]
  const children = out.children
  if (children && typeof children === 'object' && !Array.isArray(children)) {
    const c: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(children as Record<string, unknown>)) c[k] = rewriteIdentity(v, table)
    out.children = c
  }
  return out
}


/**
 * 2 → 3 的身分改名表——**核心只給機制，資料由擁有那些身分的套件提供**。
 *
 * ## 為什麼不是寫在這裡
 *
 * 第一版就是把 174 筆表寫進這個檔案，而**中立性護欄當場報了 284 筆違規**：
 * `src/core` 不得認得特定語言的元件身分（P9）。那不是護欄太嚴——一個把
 * `cpp_vector_declare` 寫死在核心的檔案，就是核心認得 C++ 了，
 * 而下一個語言進來時沒有人會記得回來改它。
 *
 * > **護欄擋下的不是程式碼風格，是一個設計錯誤。**
 *
 * 於是：`cpp` 套件知道自己的身分曾經叫什麼，通用套件知道自己的，
 * 核心只知道「有一張表要套用」。這與階段 6.5 的方向一致——關於一顆元件的事
 * 都住在它旁邊。
 *
 * ## 「沒人接上」的防線
 *
 * 這個機制天生有 `components/執行機構.md` 的病：套件忘了登錄，存檔就靜靜地
 * 不轉換。防線是 `audit-identity-namespace` 的一支檢查——
 * **已登錄的表必須涵蓋全部舊身分**。少一顆就指名。
 */
const idMigrations: Record<string, string> = {}

/** 套件在載入時登錄自己的身分改名表 */
export function registerIdMigration(m: Record<string, string>): void {
  Object.assign(idMigrations, m)
}

/**
 * **參數改名**——`{ componentId: { 舊屬性名: 新屬性名 } }`。
 *
 * 與身分改名同一個形狀，而且同樣由**套件**提供：核心不得認得
 * `cpp:vector_size` 的參數叫什麼（第二十二條護欄會叫）。
 *
 * ⚠️ 為什麼參數改名也要遷移：**語義樹是存下去的**（`SavedState.tree`），
 * 所以 `properties.vector` 就在使用者的檔案裡。改名不遷移的話，
 * 讀回來的節點會少一個屬性，而產生器會靜靜地用退路值。
 */
const propMigrations: Record<string, Record<string, string>> = {}

export function registerPropertyMigration(m: Record<string, Record<string, string>>): void {
  for (const [cid, map] of Object.entries(m)) {
    propMigrations[cid] = { ...(propMigrations[cid] ?? {}), ...map }
  }
}

/** 目前已登錄的參數改名——給護欄查涵蓋率用 */
export function registeredPropertyMigrations(): Record<string, Record<string, string>> {
  return JSON.parse(JSON.stringify(propMigrations)) as Record<string, Record<string, string>>
}

/** 就地改寫語義樹裡的參數名。**只改認得的，其餘原樣通過。** */
function rewriteParams(node: unknown): unknown {
  if (!node || typeof node !== 'object') return node
  if (Array.isArray(node)) return node.map(rewriteParams)
  const n = node as Record<string, unknown>
  const out: Record<string, unknown> = { ...n }
  const cid = out.componentId
  const map = typeof cid === 'string' ? propMigrations[cid] : undefined
  if (map && out.properties && typeof out.properties === 'object') {
    const props: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(out.properties as Record<string, unknown>)) props[map[k] ?? k] = v
    out.properties = props
  }
  const children = out.children
  if (children && typeof children === 'object' && !Array.isArray(children)) {
    const c: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(children as Record<string, unknown>)) c[k] = rewriteParams(v)
    out.children = c
  }
  return out
}

/** 目前已登錄的全部改名——給護欄查涵蓋率用 */
export function registeredIdMigrations(): Record<string, string> {
  return { ...idMigrations }
}


/**
 * 已登錄的積木型別改名——給護欄與遷移用。
 *
 * ⚠️ **與身分改名不同，這張表由核心 `import` 進來而不是套件登錄。**
 * 理由：積木型別是**投影**，而投影的命名規則是核心定的（`deriveBlockType`）；
 * 身分是**真實**，而真實屬於套件。兩者的歸屬不同，機制就不該長一樣。
 */
const blockTypeRenames = () => BLOCK_TYPE_MIGRATIONS_V9_TO_V10

/** 轉換遇到表上沒有的型別時，怎麼處理。 */
export class unknownBlockTypes extends Error {
  readonly types: readonly string[]
  constructor(types: readonly string[]) {
    super(
      `存檔裡有 ${types.length} 種積木型別不在 v9→v10 的改名表上：` +
        `${types.join('、')}。**不靜默丟棄**——一顆被吞掉的積木，` +
        `使用者感覺到的是「我的程式少了一段」而沒有任何錯誤訊息。`,
    )
    this.types = types
    this.name = '未知積木型別'
  }
}

/**
 * 就地改寫**積木狀態**裡的積木型別。
 *
 * ⚠️ **只改 Blockly 積木節點的 `type`，不是所有叫 `type` 的欄位。**
 * Blockly 的積木定義 JSON 裡 `args` 也有 `type`（`input_value`／
 * `field_dropdown`…），字面一模一樣而意思完全無關——**兩邊都是 string，
 * 型別檢查看不到**。上一次「同一個欄位名長在三個型別上」的改名回退了 121 個檔。
 *
 * 判別方式：只在**已知是積木節點**的位置遞迴（`blocks.blocks[]`、`inputs.*.block`
 * ／`.shadow`、`next.block`／`.shadow`）。認不得的結構原樣通過。
 */
function rewriteBlockType(blocklyState: unknown, table: Record<string, string>, unknown: Set<string>): unknown {
  // ⚠️ **已經是新名的不算未知**——否則轉換就不冪等，而不冪等會咬人：
  // 匯出那條路曾經把每一份檔案標成 `version: 1`（2026-08-11 修掉），
  // 於是一份已經轉換過的內容會再被餵進這一步一次。
  // **一個「只跑一次才對」的轉換，遲早會被跑第二次。**
  const newNames = new Set(Object.values(table))
  const oneBlock = (b: unknown): unknown => {
    if (!b || typeof b !== 'object' || Array.isArray(b)) return b
    const n = { ...(b as Record<string, unknown>) }
    if (typeof n.type === 'string') {
      const fresh = table[n.type]
      if (fresh !== undefined) n.type = fresh
      else if (!newNames.has(n.type)) unknown.add(n.type)
    }
    if (n.inputs && typeof n.inputs === 'object') {
      const ins: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(n.inputs as Record<string, unknown>)) {
        const slot = { ...(v as Record<string, unknown>) }
        if (slot.block) slot.block = oneBlock(slot.block)
        if (slot.shadow) slot.shadow = oneBlock(slot.shadow)
        ins[k] = slot
      }
      n.inputs = ins
    }
    if (n.next && typeof n.next === 'object') {
      const nx = { ...(n.next as Record<string, unknown>) }
      if (nx.block) nx.block = oneBlock(nx.block)
      if (nx.shadow) nx.shadow = oneBlock(nx.shadow)
      n.next = nx
    }
    return n
  }

  if (!blocklyState || typeof blocklyState !== 'object') return blocklyState
  const s = { ...(blocklyState as Record<string, unknown>) }
  const blocks = s.blocks as Record<string, unknown> | undefined
  if (blocks && Array.isArray(blocks.blocks)) {
    s.blocks = { ...blocks, blocks: (blocks.blocks as unknown[]).map(oneBlock) }
  }
  return s
}

export const UPGRADES: Record<number, Upgrade> = {
  1: (raw) => ({ ...raw, tree: rewriteIdentity(raw.tree, mergedIdentities), version: 2 }),
  2: (raw) => ({ ...raw, tree: rewriteIdentity(raw.tree, idMigrations), version: 3 }),
  // 3 → 4：**接收者參數統一叫 `obj`**（G 項第 1 步，2026-08-09）。
  // 10 顆元件的接收者原本叫 `name`／`vector`／`ptr_name`／`ptr`——
  // 同一個角色四個名字。統一之後，`lifters/io.ts` 裡那張只為了容納不一致
  // 而存在的 `METHOD_OBJ_PROP` 對應表整個消失了。
  3: (raw) => ({ ...raw, tree: rewriteParams(raw.tree), version: 4 }),
  // 4 → 5：**D1**——`lang:` scope 退場，32 顆歸 `cpp:`。
  // 沿用同一張 `idMigrations`（套件登錄的表是累積的）。
  4: (raw) => ({ ...raw, tree: rewriteIdentity(raw.tree, idMigrations), version: 5 }),
  // 5 → 6：G 項第 3 步——主體移到前面（`count_loop` → `loop_count`）
  5: (raw) => ({ ...raw, tree: rewriteIdentity(raw.tree, idMigrations), version: 6 }),
  // 6 → 7：G 項第 4 步——同義操作詞合併（`length` → `size` 等）
  6: (raw) => ({ ...raw, tree: rewriteIdentity(raw.tree, idMigrations), version: 7 }),
  // 7 → 8：G 項第 5 步——抄來的函式庫名拆成「主體 ＋ 操作」
  7: (raw) => ({ ...raw, tree: rewriteIdentity(raw.tree, idMigrations), version: 8 }),
  // 8 → 9：G 項第 6 步——修飾詞從主體位置移到種差位置
  8: (raw) => ({ ...raw, tree: rewriteIdentity(raw.tree, idMigrations), version: 9 }),
  // 9 → 10：**積木型別從概念身分導出**（spec 116）。
  //
  // ⚠️ **這是第一個改寫 `blocklyState` 的升級步驟**——上面八個都只碰 `tree`。
  // 理由見 `migrations/block-type-migrations.ts` 的檔頭：積木狀態是載入時的
  // **主要還原來源**，所以它行為上是真實，適用 P8 的例外條款。
  9: (raw) => {
    const unknown = new Set<string>()
    const newState = rewriteBlockType(raw.blocklyState, blockTypeRenames(), unknown)
    // 表是空的時候（改名還沒開始）不該把每一顆都當成未知——那會讓
    // 一個還沒做的遷移把所有舊檔擋在門外。
    if (Object.keys(blockTypeRenames()).length > 0 && unknown.size > 0) {
      throw new unknownBlockTypes([...unknown].sort())
    }
    return { ...raw, blocklyState: newState, version: 10 }
  },
  // 10 → 11：**`tree` 停止儲存**（2026-08-24）。
  //
  // 🔴 查證：**沒有任何還原路徑在讀它**（`app.ts` 的兩處還原只讀
  //    `blocklyState` 與 `code`），而上面**有 8 個升級步驟在認真地改寫它**。
  //
  // > **一個沒有人讀的存檔欄位，會被每一次遷移認真地搬運下去。**
  //
  // 而拿掉它不只是清理——它是**真相模型的改變**：
  // 從「樹是存下來的」變成「樹是**從程式碼導出的**」。
  // ⚠️ 同時把 `blocklyState` 降格成**帶失效條件的快取**（`codeHash`）：
  //    程式碼變了而快取沒跟上時，**寧可重排版也不要拿一份對不上的積木**。
  10: (raw) => {
    const { tree: _dropped, ...rest } = raw as Record<string, unknown>
    return { ...rest, codeHash: hashCode(String((rest as { code?: string }).code ?? '')), version: 11 }
  },
  // 11 → 12：**左值從欄位換成接點**（路線圖「左值是接點，不是字串」，2026-08-25）。
  //
  // 🔴 **這一版不改寫快取，它【丟掉】快取。** 理由在
  //    `migrations/block-shape-changes.ts` 的檔頭：`python_var_assign_compound`
  //    的 `NAME` 欄位不見了，而那一格裝的是 `nums[0]`／`self.n`／`a.b.c`
  //    ——**要把它搬過去，就得在遷移裡寫一個 parser**，而那正是這一刀在刪的東西。
  //
  // > **要把一個字串 parse 回結構才能搬運的存檔欄位，
  // > 代表那個欄位不該是被搬運的那一份。**
  //
  // 🟢 而 v11 已經把 `blocklyState` 降格成**帶失效條件的快取**，真相是 `code`
  //    ——所以丟掉它之後會從程式碼重 lift，**免費得到正確的巢狀左值**。
  // ⚠️ 代價是**那一份的積木排版會重算**（座標屬於 `sideCar`，本來就可以丟）。
  // ⚠️ **冪等**：丟過之後這裡找不到東西，第二次跑是 no-op。
  11: (raw) => dropStaleCache(raw, SHAPE_CHANGES_V12, 12),
  // 12 → 13：**C++ 的複合指定**——同一個路線圖項目的第二筆。
  // ⚠️ 不能加進 v12：**已經升到 v12 的存檔不會再跑一次 v12**。
  12: (raw) => dropStaleCache(raw, SHAPE_CHANGES_V13, 13),
  // 13 → 14：**普通指派**的左值。⚠️ 一樣要開新版號，不能塞進 v13。
  13: (raw) => dropStaleCache(raw, SHAPE_CHANGES_V14, 14),
  // 14 → 15：**`cin >>` 換建構子**——⚠️ 這一筆**沒有欄位改變**，
  //    靠的是 `retiredExtraState`（`{args}` → `{itemCount}`）。
  14: (raw) => dropStaleCache(raw, SHAPE_CHANGES_V15, 15),
}

/**
 * 積木的骨架變了 → **丟掉快取**，讓它從程式碼重 lift。
 * 見 `migrations/block-shape-changes.ts` 的檔頭。⚠️ 冪等。
 */
function dropStaleCache(
  raw: Record<string, unknown>, changes: ShapeChange[], to: number,
): Record<string, unknown> {
  if (!staleShapeIn(raw.blocklyState, changes)) return { ...raw, version: to }
  const { blocklyState: _dropped, ...rest } = raw
  return { ...rest, blocklyState: {}, version: to }
}

/**
 * side-car 的失效條件。
 *
 * ⚠️ **不是雜湊學上的雜湊**——它只要在「同一份程式碼」上穩定、
 * 在「不同程式碼」上幾乎必然不同就夠了。
 *
 * > **side-car 是快取，不是第二份真相——而快取要有失效條件。**
 */
export function hashCode(code: string): string {
  let h = 0
  for (let i = 0; i < code.length; i++) h = (Math.imul(31, h) + code.charCodeAt(i)) | 0
  return `${code.length.toString(36)}_${(h >>> 0).toString(36)}`
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
  /**
   * 升到哪一版為止——**預設是最新**。
   *
   * ⚠️ 它存在的理由是一個**具名的例外**：v11 拿掉了 `tree`，而 v1→v9 那八個
   * 步驟改寫的正是它。要驗那八步仍然正確，只能停在 `tree` 還在的最後一版（10）。
   * **一個沒有辦法被單獨驗證的升級步驟，等於沒有被驗證過。**
   */
  to: number = CURRENT_VERSION,
): { ok: true; value: Record<string, unknown> } | { ok: false; reason: string } {
  let current = raw
  for (let v = from; v < to; v++) {
    const step = UPGRADES[v]
    if (!step) return { ok: false, reason: `沒有從版本 ${v} 到 ${v + 1} 的升級路徑` }
    try {
      current = { ...step(current), version: v + 1 }
    } catch (e) {
      return { ok: false, reason: `版本 ${v} → ${v + 1} 的升級失敗：${String(e)}` }
    }
  }
  // ⚠️ **只有升到最新才驗形狀**——停在中途（具名例外，見 `to`）的結果
  //    本來就不是一份「可用的存檔」，拿完整性判定去驗它會得到一個誤導的訊息。
  if (to !== CURRENT_VERSION) return { ok: true, value: current }
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
