/**
 * 從**宣告**替一顆積木接上「**依 `extraState` 換一整份佈局**」。
 *
 * ## 為什麼需要它
 *
 * 有一族積木有**兩種形狀**，而它們用的是同一顆積木：
 *
 * ```
 * a  += 2     把變數 a        加上 2
 * a[i] += 2   把變數 a 的第 [i] 格 加上 2
 * ```
 *
 * 差的**不只是多一格 `INDEX`**——欄位會**換到別的插槽上**（`OP` 從第一列
 * 移到第二列）。所以它不是「可有可無的一格」，是**兩份佈局**。
 *
 * ## 🔴 而在此之前，宣告那側表達不出它——**而有人以為表達得出**
 *
 * `spec 166` 把 `cpp_var_assign_compound` 的命令式定義刪掉，墓碑寫著
 * 「它的 `hasIndex` 宣告表達得出（`extraStateFlags`）——那一點是護欄新增的
 * **第五維**證明的」。
 *
 * ⚠️ **而第五維證明的是「`extraState` 的鍵對得上」，不是「那一格會出現」。**
 * `extraStateFlags` 只管**渲染器要不要吐出** `extraState.hasIndex`；
 * 沒有任何東西照著它把 `INDEX` 那一格建出來。
 *
 * 於是 2026-08-20 起 `a[i] += 2` 的積木**沒有索引那一格**，索引安靜地掉。
 *
 * > **一條護欄的能力邊界被讀成比它大的東西，比沒有那條護欄更危險
 * > ——它讓人停止懷疑。**
 *
 * 🟢 由 `tests/integration/audit-optional-slot.test.ts` 釘住（硬性零）。
 *
 * ## extraState 的格式是契約
 *
 * `{ hasIndex: true }`／關掉時 `{}`——**與命令式那份一字不差**。
 * 舊存檔裡就是那個形狀。
 */
import * as Blockly from 'blockly'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface AltLayoutSpec {
  /**
   * `extraState` 裡的鍵。🔴 **接手既有的命令式積木時必須是它原本的鍵**
   *——那是存檔契約（與 `paramList` 的 `stateKey` 同一條規矩）。
   */
  stateKey: string
  /** 旗標為真時改用的那一份訊息／參數。⚠️ **只放佈局**，不放顏色與接點。 */
  alt: { message0: string; args0: unknown[]; inputsInline?: boolean }
}

/** 這顆積木現在的欄位值與接上去的積木——重建之後要放回去。 */
function capture(block: any): { fields: Record<string, string>; links: Record<string, any> } {
  const fields: Record<string, string> = {}
  const links: Record<string, any> = {}
  for (const input of block.inputList) {
    for (const f of input.fieldRow) {
      if (f.name && f.EDITABLE && typeof f.getValue?.() === 'string') fields[f.name] = f.getValue()
    }
    const t = input.connection?.targetBlock?.()
    if (input.name && t) links[input.name] = t
  }
  return { fields, links }
}

/**
 * 接上去。⚠️ **接在原型上而不是實例上**——`saveExtraState` 要被所有實例看見。
 *
 * @param base 這顆積木原本的 `blockDef`（旗標為假時用的那一份佈局）
 */
export function attachAltLayout(
  type: string,
  base: { message0?: string; args0?: unknown[]; inputsInline?: boolean },
  spec: AltLayoutSpec,
): void {
  const proto = Blockly.Blocks[type] as any
  if (!proto) throw new Error(`attachAltLayout：積木型別 ${type} 還沒被定義——順序反了`)
  const baseInit = proto.init

  proto.altOn_ = false

  proto.rebuildLayout_ = function (this: any): void {
    // 🔴 先收好，**再拆**——反過來的話值已經跟著插槽消失了。
    const saved = capture(this)
    for (const input of [...this.inputList]) {
      if (input.name) this.removeInput(input.name, true)
    }
    const layout = this.altOn_ ? spec.alt : base
    // ⚠️ **只餵佈局**：顏色／接點／tooltip 由第一次 `jsonInit` 定好了，
    //    再餵一次會把已經接上的前後積木斷掉。
    this.jsonInit({
      type,
      message0: layout.message0,
      args0: layout.args0 ?? [],
      ...(layout.inputsInline !== undefined ? { inputsInline: layout.inputsInline } : {}),
    })
    for (const [name, value] of Object.entries(saved.fields)) {
      if (this.getField(name)) this.setFieldValue(value, name)
    }
    for (const [name, block] of Object.entries(saved.links)) {
      const conn = this.getInput(name)?.connection
      if (conn && block.outputConnection) conn.connect(block.outputConnection)
    }
  }

  proto.init = function (this: any): void {
    this.altOn_ = false
    baseInit.call(this)
  }

  proto.saveExtraState = function (this: any): Record<string, boolean> {
    // ⚠️ 關掉時回**空物件**而不是 `null`——與命令式那份一字不差（存檔契約）。
    return this.altOn_ ? { [spec.stateKey]: true } : {}
  }

  proto.loadExtraState = function (this: any, state: Record<string, unknown> | null): void {
    const on = state?.[spec.stateKey] === true
    if (on === this.altOn_) return
    this.altOn_ = on
    this.rebuildLayout_()
  }
}
