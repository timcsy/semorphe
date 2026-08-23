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
  fields: { type: string; name: string; text?: string; source?: string; options?: unknown }[]
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
  optionalGroups?: { key: string; fromField: string; labelKey?: string; labelFallback: string }[]
  /**
   * **整顆積木層級的「要不要顯示」**——與參數無關的那些（2026-08-23，使用者提的）。
   *
   * 🔴 例：Python 函式的**回傳型別**。大多數函式沒有回傳註記，
   * 而固定長在那裡就是一個「（不指定）」永遠掛在標頭上。
   *
   * ⚠️ **藏得起來的單位是 `input` 不是 `field`**（`field.setVisible` 標著
   * `@internal`，而且不會重新排版）——所以那一格要自己一段訊息。
   */
  blockOptions?: { key: string; input: string; labelKey?: string; labelFallback: string }[]
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
  const proto = Blockly.Blocks[type] as any
  if (!proto) throw new Error(`attachParamList：積木型別 ${type} 還沒被定義——順序反了`)
  const msg = Blockly.Msg as Record<string, string>
  const baseInit = proto.init

  const label = (key: string | undefined, fallback: string | undefined): string | undefined =>
    key ? (msg[key] || fallback) : fallback

  const minCount = spec.minCount ?? 0
  const blockOptions = spec.blockOptions ?? []
  proto.paramCount_ = 0

  /** 某個 input 上的所有欄位——`blockOptions` 要靠它掛驗證器。 */
  const fieldsOfInput = (blk: any, inputName: string): any[] =>
    (blk.getInput(inputName)?.fieldRow ?? []) as any[]

  proto.rebuildTail_ = function (this: any): void {
    if (this.getInput('PL_OPEN')) this.removeInput('PL_OPEN')
    if (this.getInput('PL_TAIL')) this.removeInput('PL_TAIL')
    const open = label(spec.openLabelKey, spec.openLabelFallback)
    const close = label(spec.closeLabelKey, spec.closeLabelFallback)
    if (this.paramCount_ > 0 && open) {
      this.appendDummyInput('PL_OPEN').appendField(open)
      this.moveInputBefore('PL_OPEN', name(spec.itemPattern, 0))
    }
    const tail = this.appendDummyInput('PL_TAIL')
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
    if (spec.moveTailTo && this.getInput(spec.moveTailTo)) this.moveInputBefore('PL_TAIL', spec.moveTailTo)
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
  const optName = (i: number, key: string): string => `${name(spec.itemPattern, i)}_OPT_${key}`

  /** 這一格開著哪幾段——**沒有宣告就永遠是空的**。 */
  const optsOf = (blk: any, i: number): Record<string, boolean> => {
    blk.paramOpts_ = blk.paramOpts_ ?? []
    blk.paramOpts_[i] = blk.paramOpts_[i] ?? {}
    return blk.paramOpts_[i]
  }

  proto.plusParam_ = function (this: any): void {
    const i = this.paramCount_
    const input = this.appendDummyInput(name(spec.itemPattern, i))
    if (i > 0 && spec.separator) input.appendField(spec.separator)

    const addField = (target: any, f: ParamListSpec['fields'][number]): void => {
      const json = { ...f, name: f.name.replace('{i}', String(i)) } as Record<string, unknown>
      if (typeof json.text === 'string') json.text = (json.text as string).replace('{i}', String(i))
      const field = Blockly.fieldRegistry.fromJson(json as never)
      if (field) target.appendField(field, json.name as string)
    }
    const fixed = firstOptionalIndex < 0 ? spec.fields : spec.fields.slice(0, firstOptionalIndex)
    for (const f of fixed) addField(input, f)

    for (const g of groups) {
      const opt = this.appendDummyInput(optName(i, g.key))
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

    this.moveInputBefore(name(spec.itemPattern, i), 'PL_TAIL')
    for (const g of groups) {
      if (this.getInput(optName(i, g.key))) this.moveInputBefore(optName(i, g.key), 'PL_TAIL')
    }
    this.paramCount_++
    this.rebuildTail_()
  }

  /** 打開或關掉某一格的某一段（關掉時**一併清掉值**）。 */
  proto.setOptional_ = function (this: any, i: number, key: string, show: boolean): void {
    const g = groups.find((x) => x.key === key)
    const opt = this.getInput(optName(i, key))
    if (!g || !opt) return
    optsOf(this, i)[key] = show
    if (opt.isVisible() === show) return
    if (!show) {
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

  /** 打開或關掉整顆層級的某一格（關掉時**一併清掉值**）。 */
  proto.setBlockOption_ = function (this: any, key: string, show: boolean): void {
    const o = blockOptions.find((x) => x.key === key)
    const input = o ? this.getInput(o.input) : null
    if (!o || !input) return
    this.blockOpts_ = this.blockOpts_ ?? {}
    this.blockOpts_[key] = show
    if (input.isVisible() === show) return
    if (!show) {
      // 🔴 **只清可編輯的欄位**：標籤（`回傳型別` 那四個字）也是一個 field，
      //    而把它 `setValue('')` 會**把字抹掉**——再打開時那一格只剩下拉。
      //    ⚠️ 症狀不是報錯，是**畫面上少了幾個字**。
      for (const f of fieldsOfInput(this, o.input)) {
        if (f.EDITABLE && typeof f.getValue?.() === 'string' && f.setValue) f.setValue('')
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
    this.removeInput(name(spec.itemPattern, this.paramCount_))
    // ⚠️ 可有可無那幾段各自是**另一個 input**——少刪的話，
    //    下一次 `＋` 會撞到一個已經存在的名字（Blockly 會丟錯）。
    for (const g of groups) {
      const n = optName(this.paramCount_, g.key)
      if (this.getInput(n)) this.removeInput(n)
    }
    this.paramOpts_?.splice(this.paramCount_, 1)
    this.rebuildTail_()
    setMinusState(this, this.paramCount_ <= minCount)
  }

  // ⚠️ **格式是契約**：`{ paramCount }`，與命令式那份一字不差。
  //    而零參數回 `null`——那也是命令式那份的行為（存檔裡不留空物件）。
  proto.saveExtraState = function (this: any): { paramCount: number; paramOpts?: string[][]; blockOpts?: string[] } | null {
    // ⚠️ 零參數時也可能有整顆層級的設定（例如 `def f() -> int:`）——不能直接回 `null`
    if (this.paramCount_ <= 0 && blockOptions.every((o) => !this.getInput(o.input)?.isVisible())) return null
    const base = { paramCount: this.paramCount_ }
    if (groups.length === 0 && blockOptions.length === 0) return base
    // ⚠️ **沒有任何一段被打開時不寫這個鍵**——`{ paramCount }` 是與命令式那份
    //    一字不差的既有契約，多一個永遠是空的鍵只會讓存檔比對變吵。
    const opts = Array.from({ length: this.paramCount_ }, (_, i) =>
      groups.filter((g) => optsOf(this, i)[g.key]).map((g) => g.key))
    const blockOn = blockOptions.filter((o) => this.getInput(o.input)?.isVisible()).map((o) => o.key)
    const extra = {
      ...(opts.some((o) => o.length > 0) ? { paramOpts: opts } : {}),
      ...(blockOn.length > 0 ? { blockOpts: blockOn } : {}),
    }
    return Object.keys(extra).length > 0 ? { ...base, ...extra } : base
  }

  proto.loadExtraState = function (this: any, state: { paramCount?: number; paramOpts?: string[][]; blockOpts?: string[] } | null): void {
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
    if (state?.blockOpts) {
      for (const o of blockOptions) this.setBlockOption_(o.key, state.blockOpts.includes(o.key))
    }
  }
}
