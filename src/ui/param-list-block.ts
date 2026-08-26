/**
 * 從**宣告**替一顆積木接上「可增減的參數列」——`+`／`−` 加減**欄位組**的那一種。
 *
 * ## 為什麼是另一個模組
 *
 * `variadic-block.ts` 的檔頭自己寫著它不處理這一種：
 *
 * > 🔴 不適用　每項一組**多個**欄位（`cpp_func_def` 的 `TYPE_{i}`＋`PARAM_{i}`）
 * >          → 那是同一個宣告的另一種形狀，這一版不處理
 *
 * 兩者的差別是**加減的是什麼**：
 *
 * ```
 * variadic    加減【值插槽】   EXPR0、EXPR1…      每格接一顆積木
 * paramList   加減【欄位組】   PARAM_0、PARAM_1…  每格是一到多個文字／下拉欄位
 * ```
 *
 * ## 🔴 它與 variadic 的另一個關鍵差別：**它不建整顆積木**
 *
 * `defineVariadicBlock` 從零建一顆（因為那種積木除了插槽幾乎沒有別的）。
 * 而參數列長在一顆**本來就有內容**的積木上（`def f(…):` 有名字、有函式體），
 * 所以這裡是**接上去**：`jsonInit` 先建靜態的部分，這個函式再補動態的那一段。
 *
 * > **一個「從零建整顆」的建構子，遇到「只有一部分是動態的」積木時，
 * > 唯一的出路是把靜態的部分也吞進去——而那正是它會弄丟欄位的原因。**
 *
 * ## extraState 的格式是契約
 *
 * `{ paramCount }`——與 `block-registrar` 那份命令式的一字不差。
 * 舊存檔裡就是那個形狀，換一個鍵名等於讓使用者的檔案打不開。
 */
import * as Blockly from 'blockly'

/* eslint-disable @typescript-eslint/no-explicit-any */

const PLUS_IMG = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">' +
  '<circle cx="10" cy="10" r="9" fill="#66CDAA"/>' +
  '<path d="M6 10h8M10 6v8" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>'
)
const MINUS_IMG = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">' +
  '<circle cx="10" cy="10" r="9" fill="#F08080"/>' +
  '<path d="M6 10h8" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>'
)
const MINUS_DISABLED_IMG = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">' +
  '<circle cx="10" cy="10" r="9" fill="#E0E0E0"/>' +
  '<path d="M6 10h8" stroke="#BDBDBD" stroke-width="2" stroke-linecap="round"/></svg>'
)

/**
 * **齒輪裡的那幾顆小積木**——容器一顆，每個參數一顆。
 *
 * 🔴 **與 `cpp_var_declare` 的齒輪同一個形狀**：那一顆用兩種小積木表示
 * 「變數」與「變數 = 值」，而這裡的每個參數用**同一顆小積木 ＋ 幾個勾選格**
 * ——因為型別與預設值是**兩件互相獨立的事**，用型別去表示要四顆小積木。
 *
 * ⚠️ **小積木上要看得到參數的名字**：一疊沒有名字的小積木，
 * 使用者得**數第幾個**才知道自己在改誰。
 */
export const MUTATOR_CONTAINER = 'pl_param_container'

/**
 * 🔴 **每一種勾選格組合各自一個小積木型別**——`pl_param_item__type_default`／
 * `pl_param_item__default`…
 *
 * ⚠️ 只註冊一顆共用的話，**第二個呼叫者的勾選格會被第一個決定**
 * （C++ 的參數只有「預設值」，而它會拿到多一格「型別」）。
 * 名字裡帶著簽章，兩邊就各拿各的。
 */
export function registerParamMutatorBlocks(
  groups: { key: string; labelKey?: string; labelFallback: string }[],
  blockOptions: { key: string; labelKey?: string; labelFallback: string }[] = [],
): string {
  // ⚠️ **容器也照勾選格的組合分型別**——理由與小積木同一條：
  //    只註冊一顆共用的話，第二個呼叫者的整顆勾選格會被第一個決定。
  const containerType = blockOptions.length > 0
    ? `${MUTATOR_CONTAINER}__${blockOptions.map((o) => o.key).join('_')}`
    : MUTATOR_CONTAINER
  if (!Blockly.Blocks[containerType]) {
    Blockly.Blocks[containerType] = {
      init: function (this: Blockly.Block) {
        const head = this.appendDummyInput()
        head.appendField(Blockly.Msg['PL_MUTATOR_TITLE'] || '參數')
        for (const o of blockOptions) {
          head.appendField(Blockly.Msg[o.labelKey ?? ''] || o.labelFallback)
          head.appendField(new Blockly.FieldCheckbox('FALSE') as Blockly.Field, `BLK_${o.key}`)
        }
        this.appendStatementInput('STACK')
        this.setColour(230)
        this.contextMenu = false
      },
    }
  }
  const itemType = `pl_param_item__${groups.map((g) => g.key).join('_')}`
  if (!Blockly.Blocks[itemType]) {
    Blockly.Blocks[itemType] = {
      init: function (this: Blockly.Block) {
        const row = this.appendDummyInput()
        // ⚠️ **名字是唯讀的標籤**——一疊沒有名字的小積木，
        //    使用者得數第幾個才知道自己在改誰。
        row.appendField(new Blockly.FieldLabel('') as Blockly.Field, 'PL_NAME')
        for (const g of groups) {
          row.appendField(Blockly.Msg[g.labelKey ?? ''] || g.labelFallback)
          row.appendField(new Blockly.FieldCheckbox('FALSE') as Blockly.Field, `OPT_${g.key}`)
        }
        this.setPreviousStatement(true)
        this.setNextStatement(true)
        this.setColour(230)
        this.contextMenu = false
      },
    }
  }
  CONTAINER_OF.set(itemType, containerType)
  return itemType
}

/** 某一種小積木配哪一顆容器——`decompose` 要建的是那一顆。 */
const CONTAINER_OF = new Map<string, string>()
export const containerTypeFor = (itemType: string): string => CONTAINER_OF.get(itemType) ?? MUTATOR_CONTAINER

export interface ParamListSpec {
  /** 每一格的 input 名（`PARAM_{i}`） */
  itemPattern: string
  /** 每一格裡的欄位。`{i}` 會換成序號 */
  fields: {
    type: string; name: string; text?: string; source?: string; options?: unknown
    /** **第一格**的預設值——沒宣告就跟其餘一樣走 `text` 的 `{i}` 代換。 */
    firstText?: string
  }[]
  /** 每一格之間的分隔字（第一格前面不放） */
  separator?: string
  /** 開／閉括號的 i18n 鍵與 fallback。**沒有參數時兩者都不顯示** */
  openLabelKey?: string
  openLabelFallback?: string
  closeLabelKey?: string
  closeLabelFallback?: string
  /** `+`／`−` 那一列要移到哪個 input 之前（`null` ＝ 放在最後） */
  moveTailTo?: string | null
  /**
   * 開括號那一列與 `+`／`−` 那一列的**插槽名**（預設 `PL_OPEN`／`PL_TAIL`）。
   *
   * ⚠️ **接手一顆既有的命令式積木時要指定成它原本的名字**——那兩列沒有接點、
   * 不會進存檔，而**比對護欄比的是名字**：不一致就永遠到不了「一模一樣」，
   * 於是那顆命令式定義退不了場。（與 `branchList` 的 `tailInput` 同一條。）
   */
  openInput?: string
  tailInput?: string
  /**
   * 要不要那一列 `+`／`−`（預設 **要**）。
   *
   * 🔴 **`false` ＝ 只有齒輪**——2026-08-25 為 `cpp_doc_comment` 加的：
   * 那顆命令式定義只有齒輪，而多一列 `+`／`−` 會讓比對護欄永遠說不出
   * 「一模一樣」，於是它退不了場。
   *
   * ⚠️ 而「`+`／`−` 是不是比較好」**是另一個問題**——`retire-imperative-block`
   * 明令：**不要為了讓比對變綠而改行為，也不要在退場那一刀順手改 UX**。
   * 那個問題記在 `draft/`。
   */
  plusMinus?: boolean
  /**
   * **最少要有幾格**（預設 0）。
   *
   * 🔴 `for` 迴圈是 1：**零個名字的 for 不是合法的 Python**（`for  in xs:`），
   * 而工具箱拖出來的那一顆用的就是初始值——學生看到的是「對 ⬤」，
   * 中間少了那個要被綁定的名字。
   *
   * ⚠️ 而函式定義與匿名函式是 **0**：`def f():` 與 `lambda: 3` 都合法。
   *
   * > **「最少幾格」是那個語言的規則，所以它是一個宣告，不是一個預設值。**
   */
  minCount?: number
  /**
   * **「可有可無」的那幾段**——每一段住在自己的 input，起始收起來，
   * 由**齒輪**（mutator）打開或關掉（2026-08-23）。
   *
   * 🔴 為什麼要它：型別註記與預設值**大多數參數都沒有**，
   * 而固定長在那裡的話每個參數後面都掛著**什麼都沒說的空框**
   * ——使用者回報「參數那邊怪怪的」，指的就是那些框。
   *
   * 🔴 **為什麼是齒輪而不是每一格一個小圖示**（使用者提的）：
   * 這個 repo 既有的分工就是這樣——**齒輪管形狀，`＋`／`−` 管數量**
   * （`cpp_var_declare` 的齒輪選「變數」還是「變數 = 值」，
   * 而它的 `＋`／`−` 只是加減幾個）。每一格塞一個小圖示的話，
   * 三個參數就有三個圖示排在那裡，而**它們說的是同一件事**。
   *
   * ⚠️ 而**不能只是藏起來**：藏了就沒有任何方式再叫出來，
   * 於是「用積木做一個有預設值的函式」變成做不到。
   * **一個看不見的功能等於沒有——所以「藏起來」一定要配一個「叫出來」。**
   *
   * 每一段：`fromField` 起（含）到下一段之前的欄位，整段一起顯示／隱藏。
   */
  optionalGroups?: {
    key: string
    fromField: string
    labelKey?: string
    labelFallback: string
    /**
     * **新加出來的那一格預設就是開著的**（2026-08-26）。
     *
     * 🔴 `cpp_var_declare` 的命令式那份預設是 `['var_init']`——新宣告一個變數
     * 通常**就是**要給它初始值，而 `int x;`（不給）才是那個少見的形態。
     * ⚠️ 其餘用 `optionalGroups` 的積木（函式的預設值、型別註記）預設是**關著**的
     * ——那是刻意的，見上面「固定長在那裡的話每個參數後面都掛著空框」。
     */
    defaultOpen?: boolean
    /**
     * **這一段的結尾是一個接點，不是一個欄位**（2026-08-26）。
     *
     * 🔴 為什麼要能是接點：`cpp_var_declare` 的齒輪選的正是
     * 「變數」還是「變數 **= ⟨運算式⟩**」——而上面那段 doc 本來就拿它當例子。
     * 在此之前這裡只建得出啞輸入，於是**那顆積木退不了場**。
     *
     * `name` 用 `{i}`（例如 `INIT_{i}`）——⚠️ **接手既有積木時要沿用它原本的插槽名**，
     * 因為渲染那一路吐的就是那個名字（`cpp:renderVarDeclare` 吐 `INIT_0`）。
     *
     * ⚠️ **收起來時不清值**（與欄位那一支不同）：一顆接上去的積木清掉就沒了，
     * 而「一個救不回來的動作，不該藏在一個勾選格後面」——見 `setBlockOption_`。
     */
    valueInput?: {
      name: string
      check?: string
      /**
       * **這一段【取代】那一格本身**，而不是在它後面多一列（2026-08-26）。
       *
       * 🔴 為什麼需要：`cpp_var_declare` 的命令式那份，一格**要嘛**是
       * `INIT_j`（接點，`NAME_j = ⟨⟩`）**要嘛**是 `VAR_j`（啞輸入，只有 `NAME_j`）
       * ——**never both**。而 `paramList` 預設會建「那一格 ＋ 選用段」兩列。
       *
       * 兩者**畫面一樣**（`inputsInline`），而插槽名的清單不一樣，
       * 於是比對護欄永遠報 differ。
       *
       * > **一個使用者看不見的形狀差異，仍然會讓那顆命令式定義退不了場
       * > ——而靠上調棘輪吃掉它，與「把宣告改成跟命令式一樣」是同一件事的鏡像。**
       *
       * ⚠️ 開關時要**重建那一格**（換另一種輸入），而欄位的值與接上去的積木
       * 都要接回來——那正是命令式那份 `rebuildInputs_` 在做的事。
       */
      replacesItem?: boolean
    }
  }[]
  /**
   * **存檔寫成一份具名的「形態清單」**，而不是 `{ paramCount, paramOpts }`。
   *
   * 🔴 **接手既有積木時這是存檔契約**：`cpp_var_declare` 的舊存檔長成
   * `{ items: ['var_init', 'var'] }`——每一格是哪一種形態，而不是「幾格 ＋ 開了哪些」。
   *
   * 兩者**攜帶同一份資訊**，所以這是一次純粹的重新編碼：
   * `items[i] = 那一格開著 group 嗎 ? open : closed`。
   * ⚠️ 而它讓舊存檔**不必遷移**——那正是選這條路而不是改渲染策略的理由。
   */
  itemsAs?: { key: string; group: string; open: string; closed: string }
  /**
   * **整顆積木層級的「要不要顯示」**——與參數無關的那些（2026-08-23，使用者提的）。
   *
   * 🔴 例：Python 函式的**回傳型別**。大多數函式沒有回傳註記，
   * 而固定長在那裡就是一個「（不指定）」永遠掛在標頭上。
   *
   * ⚠️ **藏得起來的單位是 `input` 不是 `field`**（`field.setVisible` 標著
   * `@internal`，而且不會重新排版）——所以那一格要自己一段訊息。
   */
  blockOptions?: {
    key: string
    input: string
    /**
     * 跟著一起開關的插槽（`inputsInline` 的積木需要一個空的 end-row 來斷列）。
     */
    extraInputs?: string[]
    /**
     * 這一格在 `extraState` 裡的**鍵名**（例如 `hasReturn`）。
     *
     * 🔴 **接手既有的命令式積木時必須指定成它原本的鍵**——那是**存檔契約**。
     * 不指定的話走預設的 `blockOpts: [key…]` 陣列，而**舊存檔裡沒有那個鍵**，
     * 於是那一列**安靜地不見**（使用者的「回傳」說明沒了，而不報錯）。
     *
     * ⚠️ 這與 `variadic` 的 `countKey` 是同一條規矩，而它 2026-08-24
     * 才付過一次學費：`argCount` vs `itemCount` 讓整個工作區載不進去。
     *
     * > **一個「換個名字也能跑」的鍵，只要有人存過檔就不是了。**
     */
    stateKey?: string
    labelKey?: string
    labelFallback: string
    /**
     * 這一列的欄位——🔴 **給了就代表「用完才建」，不是「藏起來」**。
     *
     * ⚠️ 兩者對**比對護欄**是不同的形狀：藏起來的那一格仍然在插槽清單裡，
     * 而命令式那些積木是 `appendDummyInput` / `removeInput`
     * ——於是「剛建好的樣子」永遠對不上，那顆命令式定義就退不了場。
     *
     * > **「看不見」與「不存在」在使用者眼裡一樣，在比對器眼裡不一樣。**
     */
    fields?: { type: string; name: string; text?: string }[]
  }[]
}

function setMinusState(block: any, atMin: boolean): void {
  const f = block.getField('PL_MINUS')
  if (f) f.setValue(atMin ? MINUS_DISABLED_IMG : MINUS_IMG)
}

const name = (pattern: string, i: number): string => pattern.replace('{i}', String(i))

/**
 * 把參數列接到一個**已經 `jsonInit` 過**的積木原型上。
 *
 * ⚠️ **接在原型（`Blockly.Blocks[type]`）上而不是實例上**——
 * `init` 在每一顆積木被建立時跑，而 `plus_`／`saveExtraState` 要在原型上才被所有實例看見。
 */
export function attachParamList(type: string, spec: ParamListSpec): void {
  const OPEN = spec.openInput ?? 'PL_OPEN'
  const TAIL = spec.tailInput ?? 'PL_TAIL'
  const proto = Blockly.Blocks[type] as any
  if (!proto) throw new Error(`attachParamList：積木型別 ${type} 還沒被定義——順序反了`)
  const msg = Blockly.Msg as Record<string, string>
  const baseInit = proto.init

  const label = (key: string | undefined, fallback: string | undefined): string | undefined =>
    key ? (msg[key] || fallback) : fallback

  const minCount = spec.minCount ?? 0
  const blockOptions = spec.blockOptions ?? []
  /**
   * 新加的參數列要排在**誰前面**。
   *
   * ```
   * 有 +／− 那一列   →  排在它前面
   * 沒有（只有齒輪） →  排在「用完才建」的那幾列前面（例如「回傳」）
   * 都沒有           →  null ＝ 就接在最後
   * ```
   *
   * 🔴 這一支存在的理由：`moveInputBefore` 指到一個**不存在**的插槽會丟錯，
   * 而那個錯發生在**載入存檔**的路上——症狀是整段程式碼進不了工作區
   *（第五十一條護欄 2026-08-25 抓到四段）。
   */
  const anchorInput = (block: any): string | null => {
    if (block.getInput(TAIL)) return TAIL
    for (const o of blockOptions) if (block.getInput(o.input)) return o.input
    return null
  }
  proto.paramCount_ = 0

  /** 某個 input 上的所有欄位——`blockOptions` 要靠它掛驗證器。 */
  const fieldsOfInput = (blk: any, inputName: string): any[] =>
    (blk.getInput(inputName)?.fieldRow ?? []) as any[]

  proto.rebuildTail_ = function (this: any): void {
    if (this.getInput(OPEN)) this.removeInput(OPEN)
    if (this.getInput(TAIL)) this.removeInput(TAIL)
    const open = label(spec.openLabelKey, spec.openLabelFallback)
    const close = label(spec.closeLabelKey, spec.closeLabelFallback)
    if (this.paramCount_ > 0 && open) {
      this.appendDummyInput(OPEN).appendField(open)
      this.moveInputBefore(OPEN, name(spec.itemPattern, 0))
    }
    // 🔴 只有齒輪的那一種**不建這一列**（見 `plusMinus`）。
    if (spec.plusMinus === false) return
    const tail = this.appendDummyInput(TAIL)
    // ⚠️ 閉括號只在**有參數時**顯示——零參數時 `def f():` 的括號由產生器補，
    //    而積木上顯示一對空括號會讓「沒有參數」看起來像「有一個空參數」。
    if (this.paramCount_ > 0 && close) tail.appendField(close)
    tail
      .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plusParam_()))
      .appendField(
        new Blockly.FieldImage(
          this.paramCount_ <= minCount ? MINUS_DISABLED_IMG : MINUS_IMG, 20, 20, '-', () => this.minusParam_(),
        ),
        'PL_MINUS',
      )
    if (spec.moveTailTo && this.getInput(spec.moveTailTo)) this.moveInputBefore(TAIL, spec.moveTailTo)
  }

  proto.init = function (this: any): void {
    baseInit.call(this)
    this.paramCount_ = 0
    this.paramOpts_ = []
    this.rebuildTail_()
    // 🔴 **最少那幾格要在【建的當下】就長出來**——工具箱拖出來的那一顆
    //    用的就是這個狀態，而 `for` 少了那個名字產不出合法的 Python。
    while (this.paramCount_ < minCount) this.plusParam_()
    // 齒輪只長在**有可有可無那幾段**的積木上——其餘的積木一個字都不變
    if (groups.length > 0 || blockOptions.length > 0) {
      const itemType = registerParamMutatorBlocks(groups, blockOptions)
      this.setMutator(new Blockly.icons.MutatorIcon([itemType], this as Blockly.BlockSvg))
      // ⚠️ **整顆層級的那幾格起始收起來**，而**有值的會自己打開**（見下面的驗證器）
      for (const o of blockOptions) {
        const input = this.getInput(o.input)
        if (input) input.setVisible(false)
        for (const f of fieldsOfInput(this, o.input)) {
          if (!f?.setValidator) continue
          f.setValidator((v: string) => {
            if (v) queueMicrotask(() => this.setBlockOption_(o.key, true))
            return v
          })
        }
      }
    }
  }

  /**
   * 「可有可無」那幾段的切點——每一段從 `fromField` 起，到下一段之前。
   * 沒有宣告 `optionalGroups` 時回空陣列（其餘的積木完全不受影響）。
   */
  const groups = (spec.optionalGroups ?? []).map((g, gi, all) => {
    const from = spec.fields.findIndex((f) => f.name === g.fromField)
    const nextFrom = gi + 1 < all.length
      ? spec.fields.findIndex((f) => f.name === all[gi + 1].fromField)
      : spec.fields.length
    if (from < 0) throw new Error(`optionalGroups 指到一個不存在的欄位：${g.fromField}`)
    return { ...g, fields: spec.fields.slice(from, nextFrom) }
  })
  const firstOptionalIndex = groups.length > 0
    ? spec.fields.findIndex((f) => f.name === groups[0].fromField)
    : -1
  /** 某一格某一段的 input 名。 */
  const optName = (i: number, key: string): string => {
    // ⚠️ **接點群用宣告給的插槽名**——渲染那一路吐的就是那個名字
    //    （`cpp:renderVarDeclare` 吐 `INIT_0`），衍生一個 `PARAM_0_OPT_init` 會對不上。
    const g = (spec.optionalGroups ?? []).find((x) => x.key === key)
    if (g?.valueInput) return name(g.valueInput.name, i)
    return `${name(spec.itemPattern, i)}_OPT_${key}`
  }

  /** 這一格開著哪幾段——**沒有宣告就永遠是空的**。 */
  /** 取代模式下那一格可能用的**兩個**名字（其餘情況只有一個）。 */
  const itemNamesOf = (i: number): string[] => {
    const g = (spec.optionalGroups ?? []).find((x) => x.valueInput?.replacesItem)
    return g ? [name(spec.itemPattern, i), name(g.valueInput!.name, i)] : [name(spec.itemPattern, i)]
  }

  const optsOf = (blk: any, i: number): Record<string, boolean> => {
    blk.paramOpts_ = blk.paramOpts_ ?? []
    blk.paramOpts_[i] = blk.paramOpts_[i] ?? {}
    return blk.paramOpts_[i]
  }

  proto.plusParam_ = function (this: any): void {
    const i = this.paramCount_
    // 🔴 **取代模式**（`replacesItem`）：那一格**要嘛是接點要嘛是啞輸入**，
    //    而不是「啞輸入 ＋ 後面多一列」——見 `valueInput.replacesItem` 的說明。
    const replaceG = (spec.optionalGroups ?? []).find((x) => x.valueInput?.replacesItem)
    // ⚠️ **`defaultOpen` 只在「這一格還沒有意見」時生效**——載入舊存檔時
    //    `loadExtraState` 會在建完之後把每一格設成存檔裡的形態，
    //    而那時這裡已經跑過了，所以兩者不會打架。
    for (const g of spec.optionalGroups ?? []) {
      if (g.defaultOpen && optsOf(this, i)[g.key] === undefined) optsOf(this, i)[g.key] = true
    }
    const replaceOpen = replaceG ? optsOf(this, i)[replaceG.key] === true : false
    const input = replaceG
      ? (replaceOpen
          ? this.appendValueInput(name(replaceG.valueInput!.name, i))
          : this.appendDummyInput(name(spec.itemPattern, i)))
      : this.appendDummyInput(name(spec.itemPattern, i))
    if (replaceG && replaceOpen && replaceG.valueInput!.check) input.setCheck(replaceG.valueInput!.check)
    if (i > 0 && spec.separator) input.appendField(spec.separator)

    const addField = (target: any, f: ParamListSpec['fields'][number]): void => {
      const json = { ...f, name: f.name.replace('{i}', String(i)) } as Record<string, unknown>
      // ⚠️ **第一格的預設值可以不一樣**（2026-08-26）：`cpp_var_declare` 的命令式
      //    第一格叫 `x`（`component.json` 的 `name` 預設也是 `x`），加出來的才是 `v1`／`v2`。
      //    少了這一格，工具箱裡那顆積木會從 `int x;` 變成 `int v0;`
      //    ——**一個沒有人會說它壞了、而它確實變差了的改動**。
      if (i === 0 && typeof (f as { firstText?: string }).firstText === 'string') {
        json.text = (f as { firstText?: string }).firstText
        delete (json as { firstText?: unknown }).firstText
      }
      if (typeof json.text === 'string') json.text = (json.text as string).replace('{i}', String(i))
      delete (json as { firstText?: unknown }).firstText
      const field = Blockly.fieldRegistry.fromJson(json as never)
      if (field) target.appendField(field, json.name as string)
    }
    const fixed = firstOptionalIndex < 0 ? spec.fields : spec.fields.slice(0, firstOptionalIndex)
    for (const f of fixed) addField(input, f)

    for (const g of groups) {
      const decl = (spec.optionalGroups ?? []).find((x) => x.key === g.key)
      // 取代模式：這一段的欄位掛在**那一格自己**上（開著時），關著時整段不存在。
      if (decl?.valueInput?.replacesItem) {
        if (replaceOpen) for (const f of g.fields) addField(input, f)
        continue
      }
      const opt = decl?.valueInput
        ? this.appendValueInput(optName(i, g.key))
        : this.appendDummyInput(optName(i, g.key))
      if (decl?.valueInput?.check) opt.setCheck(decl.valueInput.check)
      for (const f of g.fields) addField(opt, f)
      opt.setVisible(optsOf(this, i)[g.key] === true)
      // ⚠️ **驗證器不是為了驗證**：它是「值被設進來」的唯一通知，而
      //    「程式碼→積木」正是這樣把型別與預設值放回去的
      //    ——少了它，一段 `def f(x: int)` 貼進來會把註記藏起來。
      for (const f of g.fields) {
        const field = this.getField(f.name.replace('{i}', String(i)))
        if (field?.setValidator) {
          field.setValidator((v: string) => {
            if (v) queueMicrotask(() => this.setOptional_(i, g.key, true))
            return v
          })
        }
      }
    }

    // 🔴 **沒有 `+`／`−` 那一列時，錨點是「用完才建」的那幾列**（`plusMinus: false`）。
    //    ⚠️ 直接指著 `TAIL` 會丟 `Reference input "…" not found`
    //    ——而症狀不是畫面歪掉，是**整段語料載不進工作區**
    //    （第五十一條護欄 2026-08-25 抓到四段）。
    const anchor = anchorInput(this)
    // ⚠️ 取代模式下那一格的名字**跟著形態走**——用寫死的 `itemPattern` 會丟
    //    `Reference input not found`（而症狀是整段語料載不進工作區）。
    const itemName = replaceG && replaceOpen ? name(replaceG.valueInput!.name, i) : name(spec.itemPattern, i)
    if (anchor) this.moveInputBefore(itemName, anchor)
    for (const g of groups) {
      if ((spec.optionalGroups ?? []).find((x) => x.key === g.key)?.valueInput?.replacesItem) continue
      if (anchor && this.getInput(optName(i, g.key))) this.moveInputBefore(optName(i, g.key), anchor)
    }
    this.paramCount_++
    this.rebuildTail_()
  }

  /** 打開或關掉某一格的某一段（關掉時**一併清掉值**）。 */
  proto.setOptional_ = function (this: any, i: number, key: string, show: boolean): void {
    const g = groups.find((x) => x.key === key)
    if (!g) return
    // 🔴 **取代模式：換形態＝重建那一格**（命令式那份的 `rebuildInputs_` 在做同一件事）。
    //    ⚠️ 欄位的值與**接上去的積木**都要接回來——後者清掉就沒了。
    const decl = (spec.optionalGroups ?? []).find((x) => x.key === key)
    if (decl?.valueInput?.replacesItem) {
      if (optsOf(this, i)[key] === show) return
      const oldName = itemNamesOf(i).find((n) => this.getInput(n))
      const savedFields: Record<string, string> = {}
      for (const f of spec.fields) {
        const fn = f.name.replace('{i}', String(i))
        const v = this.getFieldValue(fn)
        if (typeof v === 'string') savedFields[fn] = v
      }
      // 🔴 **接上去的那顆積木要【寄放】起來，不是丟著**（2026-08-26）。
      //    第一版只 `disconnect()`——於是關掉 `x = 1` 之後那顆 `1`
      //    **浮成工作區裡的一顆孤兒積木**，而再打開時 `x = ?`。
      //    ⚠️ 命令式那份更糟：`removeInput` 直接把它 dispose 掉。
      //    > **一個救不回來的動作，不該藏在一個勾選格後面**（同檔 `setBlockOption_`）。
      this.itemStash_ = this.itemStash_ ?? {}
      const savedBlock = oldName ? this.getInput(oldName)?.connection?.targetBlock() ?? null : null
      if (savedBlock) {
        savedBlock.outputConnection?.disconnect()
        if (!show) {
          this.itemStash_[i] = Blockly.serialization.blocks.save(savedBlock)
          savedBlock.dispose(false)
        }
      }
      if (oldName) this.removeInput(oldName)
      optsOf(this, i)[key] = show
      // 重建：把那一格從尾巴長回來，再搬到原本的位置
      const newName = show ? name(decl.valueInput.name, i) : name(spec.itemPattern, i)
      const input = show ? this.appendValueInput(newName) : this.appendDummyInput(newName)
      if (show && decl.valueInput.check) input.setCheck(decl.valueInput.check)
      if (i > 0 && spec.separator) input.appendField(spec.separator)
      const wanted = show ? spec.fields : spec.fields.slice(0, firstOptionalIndex < 0 ? spec.fields.length : firstOptionalIndex)
      for (const f of wanted) {
        const fn = f.name.replace('{i}', String(i))
        const json = { ...f, name: fn } as Record<string, unknown>
        if (typeof json.text === 'string') json.text = (json.text as string).replace('{i}', String(i))
        delete (json as { firstText?: unknown }).firstText
        const field = Blockly.fieldRegistry.fromJson(json as never)
        if (field) input.appendField(field, fn)
        if (savedFields[fn] !== undefined && this.getField(fn)?.setValue) this.getField(fn).setValue(savedFields[fn])
      }
      // 位置：排在下一格（或尾巴）之前
      const after = itemNamesOf(i + 1).find((n) => this.getInput(n)) ?? anchorInput(this)
      if (after && this.getInput(after)) this.moveInputBefore(newName, after)
      if (show) {
        const back = savedBlock ?? (this.itemStash_[i]
          ? Blockly.serialization.blocks.append(this.itemStash_[i], this.workspace)
          : null)
        if (back) input.connection?.connect(back.outputConnection)
        delete this.itemStash_[i]
      }
      this.queueRender?.()
      return
    }
    const opt = this.getInput(optName(i, key))
    if (!opt) return
    optsOf(this, i)[key] = show
    if (opt.isVisible() === show) return
    // 🔴 **接點群不清值**（2026-08-26）：那一格接的是一顆積木，
    //    清掉就沒了，而 Blockly 照樣把隱藏插槽底下的積木存進存檔
    //    ——收起來再打開，它會回來。
    //    > **一個救不回來的動作，不該藏在一個勾選格後面。**
    const isValueGroup = Boolean((spec.optionalGroups ?? []).find((x) => x.key === key)?.valueInput)
    if (!show && !isValueGroup) {
      for (const f of g.fields) {
        const field = this.getField(f.name.replace('{i}', String(i))) as any
        // 🔴 標籤（`：`／`＝`）也是 field——清掉它等於把那個符號抹掉（見上面同一條）
        if (field?.EDITABLE && typeof field.getValue?.() === 'string' && field.setValue) field.setValue('')
      }
    }
    opt.setVisible(show)
    // ⚠️ `setVisible` 只改狀態，畫面要自己叫它重排
    this.queueRender?.()
  }

  /**
   * 打開或關掉整顆層級的某一格。
   *
   * **關掉＝那一格的值從程式碼裡收起來**，而**不是燒掉**（2026-08-23）：
   * 收起來的字寄放在 `blockOptText_`（跟著存檔走），再打開就回來。
   *
   * 🔴 為什麼要寄放：第一版直接清空，而開瀏覽器一試就看到代價——
   * **「還原」救不回來**（被清掉的欄位值不在 Blockly 的復原事件裡）。
   *
   * > **一個救不回來的動作，不該藏在一個勾選格後面。**
   */
  proto.setBlockOption_ = function (this: any, key: string, show: boolean): void {
    const o = blockOptions.find((x) => x.key === key)
    if (!o) return
    this.blockOpts_ = this.blockOpts_ ?? {}
    this.blockOpts_[key] = show

    // 🔴 **宣告了 `fields` ＝「用完才建」**（見那一格的說明）：
    //    這一列在關掉時**不存在**，不是藏起來——比對護欄看得出差別。
    if (o.fields) {
      const existing = this.getInput(o.input)
      if (show && !existing) {
        const row = this.appendDummyInput(o.input)
        for (const f of o.fields) {
          if (f.type === 'field_label') row.appendField(String(f.text ?? ''), f.name)
          else row.appendField(new Blockly.FieldTextInput(String(f.text ?? '')) as Blockly.Field, f.name)
        }
        // ⚠️ 這一列永遠在最後——參數列與 `+`／`−` 都排在它前面。
      } else if (!show && existing) {
        // 值先收起來：關掉再打開時使用者打的字要回得來。
        this.blockOptText_ = this.blockOptText_ ?? {}
        for (const f of fieldsOfInput(this, o.input)) {
          if (f.EDITABLE && f.name && typeof f.getValue?.() === 'string') this.blockOptText_[f.name] = f.getValue()
        }
        this.removeInput(o.input)
      }
      return
    }

    const input = this.getInput(o.input)
    if (!input) return
    if (input.isVisible() === show) return
    if (!show) {
      // 🔴 **只清可編輯的欄位**：標籤（`回傳型別` 那四個字）也是一個 field，
      //    而把它 `setValue('')` 會**把字抹掉**——再打開時那一格只剩下拉。
      //    ⚠️ 症狀不是報錯，是**畫面上少了幾個字**。
      this.blockOptText_ = this.blockOptText_ ?? {}
      for (const f of fieldsOfInput(this, o.input)) {
        if (!(f.EDITABLE && typeof f.getValue?.() === 'string' && f.setValue)) continue
        if (f.name) this.blockOptText_[f.name] = f.getValue()
        f.setValue('')
      }
    } else {
      for (const f of fieldsOfInput(this, o.input)) {
        const kept = f.name ? this.blockOptText_?.[f.name] : undefined
        if (kept && f.EDITABLE && f.setValue) f.setValue(kept)
      }
    }
    input.setVisible(show)
    this.queueRender?.()
  }

  /**
   * 齒輪打開時：**照現在的樣子攤成一疊小積木**。
   *
   * ⚠️ 名字是**唯讀的標籤**——在這裡改名字沒有意義（本體那一格才是真的），
   * 而它必須在，否則使用者要數第幾個才知道自己在改誰。
   */
  proto.decompose = function (this: any, workspace: Blockly.WorkspaceSvg): Blockly.Block {
    const itemType = registerParamMutatorBlocks(groups, blockOptions)
    const container = workspace.newBlock(containerTypeFor(itemType))
    ;(container as Blockly.BlockSvg).initSvg()
    for (const o of blockOptions) {
      container.setFieldValue(this.getInput(o.input)?.isVisible() ? 'TRUE' : 'FALSE', `BLK_${o.key}`)
    }
    let connection = container.getInput('STACK')!.connection!
    for (let i = 0; i < this.paramCount_; i++) {
      const item = workspace.newBlock(itemType)
      ;(item as Blockly.BlockSvg).initSvg()
      const nameField = spec.fields[0]?.name.replace('{i}', String(i))
      item.setFieldValue(String(this.getFieldValue(nameField) ?? `#${i + 1}`), 'PL_NAME')
      for (const g of groups) {
        item.setFieldValue(optsOf(this, i)[g.key] ? 'TRUE' : 'FALSE', `OPT_${g.key}`)
      }
      connection.connect(item.previousConnection!)
      connection = item.nextConnection!
    }
    return container
  }

  /** 齒輪關上時：**幾個參數、每個開哪幾段**照那一疊重新擺一次。 */
  proto.compose = function (this: any, container: Blockly.Block): void {
    for (const o of blockOptions) {
      this.setBlockOption_(o.key, container.getFieldValue(`BLK_${o.key}`) === 'TRUE')
    }
    const wants: Record<string, boolean>[] = []
    let item = container.getInputTargetBlock('STACK')
    while (item) {
      const opts: Record<string, boolean> = {}
      for (const g of groups) opts[g.key] = item.getFieldValue(`OPT_${g.key}`) === 'TRUE'
      wants.push(opts)
      item = item.getNextBlock()
    }
    while (wants.length < minCount) wants.push({})

    // ⚠️ **先對齊數量再對齊形狀**——反過來的話，多出來的那幾格還不存在
    while (this.paramCount_ < wants.length) this.plusParam_()
    while (this.paramCount_ > wants.length) this.minusParam_()
    for (let i = 0; i < wants.length; i++) {
      for (const g of groups) this.setOptional_(i, g.key, wants[i][g.key] === true)
    }
    setMinusState(this, this.paramCount_ <= minCount)
  }

  proto.minusParam_ = function (this: any): void {
    if (this.paramCount_ <= minCount) return
    this.paramCount_--
    // ⚠️ 取代模式：那一格可能叫 `INIT_i`（開著）或 `VAR_i`（關著）——兩個都試。
    for (const n of itemNamesOf(this.paramCount_)) if (this.getInput(n)) this.removeInput(n)
    // ⚠️ 可有可無那幾段各自是**另一個 input**——少刪的話，
    //    下一次 `＋` 會撞到一個已經存在的名字（Blockly 會丟錯）。
    for (const g of groups) {
      const n = optName(this.paramCount_, g.key)
      if (this.getInput(n)) this.removeInput(n)
    }
    this.paramOpts_?.splice(this.paramCount_, 1)
    // ⚠️ 寄放是**按格號**的——少刪一格，下一次那個號會拿到別人的東西
    if (this.itemStash_) delete this.itemStash_[this.paramCount_]
    this.rebuildTail_()
    setMinusState(this, this.paramCount_ <= minCount)
  }

  // ⚠️ **格式是契約**：`{ paramCount }`，與命令式那份一字不差。
  //    而零參數回 `null`——那也是命令式那份的行為（存檔裡不留空物件）。
  proto.saveExtraState = function (this: any): { paramCount: number; paramOpts?: string[][]; blockOpts?: string[]; blockOptText?: Record<string, string> } | null {
    // 收起來的那幾格的值要跟著存檔走，否則「再打開」拿回來的是空的
    const stash: Record<string, string> = {}
    for (const [k, v] of Object.entries((this.blockOptText_ ?? {}) as Record<string, string>)) if (v) stash[k] = v
    // ⚠️ 零參數時也可能有整顆層級的設定（例如 `def f() -> int:`）——不能直接回 `null`
    //    ⚠️ **寄放的字也算「有東西」**——否則 `def f()` 收起來的那句註解會在存檔時蒸發
    if (this.paramCount_ <= 0 && Object.keys(stash).length === 0
        && blockOptions.every((o) => !this.getInput(o.input)?.isVisible())) return null
    // 🔴 **具名的形態清單**（`itemsAs`）——接手既有積木時的存檔契約。
    //    `{ items: ['var_init','var'] }` 與 `{ paramCount, paramOpts }` 攜帶同一份資訊，
    //    而**用它原本的形狀寫，舊存檔就不必遷移**。
    if (spec.itemsAs) {
      const a = spec.itemsAs
      const items = Array.from({ length: this.paramCount_ }, (_, i) =>
        optsOf(this, i)[a.group] ? a.open : a.closed)
      return { [a.key]: items } as never
    }
    const base = { paramCount: this.paramCount_ }
    if (groups.length === 0 && blockOptions.length === 0) return base
    // ⚠️ **沒有任何一段被打開時不寫這個鍵**——`{ paramCount }` 是與命令式那份
    //    一字不差的既有契約，多一個永遠是空的鍵只會讓存檔比對變吵。
    const opts = Array.from({ length: this.paramCount_ }, (_, i) =>
      groups.filter((g) => optsOf(this, i)[g.key]).map((g) => g.key))
    // ⚠️ **有 `stateKey` 的那幾格用自己的鍵**（存檔契約）——其餘照舊進 `blockOpts`
    const named: Record<string, boolean> = {}
    for (const o of blockOptions) {
      if (!o.stateKey) continue
      if (this.getInput(o.input)?.isVisible()) named[o.stateKey] = true
    }
    const blockOn = blockOptions.filter((o) => !o.stateKey && this.getInput(o.input)?.isVisible()).map((o) => o.key)
    const extra = {
      ...(opts.some((o) => o.length > 0) ? { paramOpts: opts } : {}),
      ...(blockOn.length > 0 ? { blockOpts: blockOn } : {}),
      ...named,
      ...(Object.keys(stash).length > 0 ? { blockOptText: stash } : {}),
    }
    return Object.keys(extra).length > 0 ? { ...base, ...extra } : base
  }

  proto.loadExtraState = function (this: any, state: { paramCount?: number; paramOpts?: string[][]; blockOpts?: string[]; blockOptText?: Record<string, string> } | null): void {
    // 🔴 **具名形態清單那一支**（`itemsAs`）——見 `saveExtraState` 的說明。
    if (spec.itemsAs) {
      const a = spec.itemsAs
      const items = (state as Record<string, unknown> | null)?.[a.key]
      const list = Array.isArray(items) ? (items as string[]) : []
      // ⚠️ 舊存檔沒有這個鍵時退到**最少幾格**，不是 0——與下面同一條。
      const n = Math.max(list.length, minCount)
      while (this.paramCount_ < n) this.plusParam_()
      while (this.paramCount_ > n) this.minusParam_()
      for (let i = 0; i < n; i++) {
        // ⚠️ **沒寫到的那幾格維持預設**——不是被判成 closed 再關一次
        if (i < list.length) this.setOptional_(i, a.group, list[i] === a.open)
      }
      return
    }
    this.blockOptText_ = { ...(state?.blockOptText ?? {}) }
    // ⚠️ **舊存檔沒有這個鍵時要退到【最少幾格】不是 0**——`for` 的舊檔
    //    若被載回 0 格，產出的會是 `for  in xs:`。
    const want = Math.max(state?.paramCount ?? 0, minCount)
    // ⚠️ **靠反覆呼叫 `plusParam_` 重建，不要直接設 `paramCount_`。**
    // 舊存檔只存了數字，插槽是這裡長出來的——改掉這個機制，舊存檔就載不回來。
    while (this.paramCount_ < want) this.plusParam_()
    while (this.paramCount_ > want) this.minusParam_()
    // 🔴 **「程式碼→積木」那條路不會帶這個鍵**（它只知道有幾格），
    //    而那時哪幾段要打開由**欄位的值**決定——見 `plusParam_` 裡的驗證器。
    //    所以這裡只處理「有寫」的情形，沒寫時什麼都不做。
    for (let i = 0; i < want; i++) {
      const keys = state?.paramOpts?.[i]
      if (!keys) continue
      for (const g of groups) this.setOptional_(i, g.key, keys.includes(g.key))
    }
    for (const o of blockOptions) {
      if (!o.stateKey) continue
      // ⚠️ **有寫才動**——沒寫的舊存檔維持預設（收起來），而不是被判成 false 再關一次
      const v = (state as Record<string, unknown> | null)?.[o.stateKey]
      if (v !== undefined) this.setBlockOption_(o.key, v === true)
    }
    if (state?.blockOpts) {
      for (const o of blockOptions) {
        if (o.stateKey) continue
        this.setBlockOption_(o.key, state.blockOpts.includes(o.key))
      }
    }
  }
}
