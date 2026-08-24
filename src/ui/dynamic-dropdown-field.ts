/**
 * 宣告式的**動態下拉欄位**——`blockDef` 說「這個欄位的選項從哪來」。
 *
 * ## 為什麼有這個模組
 *
 * 六顆積木（`cpp_var_ref`／`cpp_var_assign`／`cpp_increment`／`cpp_input`／
 * `cpp_func_call`／`cpp_var_assign_compound`）的下拉是**跟著工作區長的**
 * ——有哪些變數、有哪些函式。
 *
 * 而在此之前那件事**只有命令式表達得出來**（`createOpenDropdown(() => self.getXxx())`），
 * 於是這六顆的宣告只能退成一個靜態的 `field_input`。
 * 比對護欄（spec 163）把它印了出來：
 *
 * ```
 * cpp_var_ref   欄位 變數,(自訂) vs x
 *                        ↑命令式的活下拉    ↑宣告的死文字
 * ```
 *
 * 🔴 **而使用者看到的是命令式那份**——所以今天沒事，
 * 直到有人刪掉命令式的那一天，**變數下拉會變成一個文字框**。
 *
 * ## ⚠️ 這個欄位「認不得的值不丟掉」
 *
 * 與 `createOpenDropdown` 同一個行為，理由也同一個（spec 150 實測）：
 *
 * > **一個會把它不認得的值換掉的下拉，等於在使用者沒看的時候改掉他的程式。**
 */
import * as Blockly from 'blockly'
import { dropdownSource } from '../core/dropdown-sources'
import { msg } from '../core/messages'

/* eslint-disable @typescript-eslint/no-explicit-any */

// 🔴 **登記處搬到 `core/dropdown-sources.ts` 了**（2026-08-24）。
//
// 理由不是分層潔癖，是一個在 Node 裡量到的事實：語言套件只需要那張 Map，
// 而它住在這個檔案裡，於是 `languages/<lang>/pack.ts` 為了登記一個下拉
// **把整個 Blockly（連帶 jsdom）拖進了出貨的核心**。
//
// ⚠️ 這裡**轉出**它們，是因為既有呼叫端（積木宣告、比對器、護欄）都指著這個檔。
// 一個檔案可以既是實作的家、又是別人的門面——但**登記處不該與它的欄位綁在一起**。
export { declareDropdownSource, dropdownSourceNames } from '../core/dropdown-sources'

const FIELD_TYPE = 'field_dynamic_dropdown'

/** 「自訂…」那一筆的哨兵值——**不可能與任何真的選項撞**（真值不會長這樣） */
const CUSTOM_VALUE = '\u0000__custom__'
const CUSTOM_LABEL = (): string => msg('FIELD_CUSTOM_VALUE', '自訂…')
const CUSTOM_PROMPT = (): string => msg('FIELD_CUSTOM_PROMPT', '輸入自訂的值')

/**
 * 讓 Blockly 認得這三種寫法：
 *
 * ```json
 * { "type": "field_dynamic_dropdown", "name": "VAR",  "source": "vars" }
 * { "type": "field_dynamic_dropdown", "name": "TYPE", "options": [["int","int"]] }
 * { "type": "field_dynamic_dropdown", "name": "TYPE", "options": [...], "allowCustom": true }
 * ```
 *
 * ## ⚠️ 為什麼靜態清單也走這個欄位（2026-08-24）
 *
 * 使用者：「C++ 那邊的 function return type 是不是**無法自訂**？例如我要 `int**` 就找不到了。」
 *
 * 實測：語義樹與積木狀態**都收得下** `int**`，卡在 Blockly 的 `field_dropdown`
 * ——它把清單外的值當成非法。於是這個系統的行為是
 *
 * > **讀得回來，寫不出去。**
 *
 * 而值域**在現實中開放**的欄位有 29 個（型別、標頭檔、函式名、裝置…），
 * 值域封閉的有 33 個（`+ - * /`、`public/private`、`begin/end`）。
 * **封閉的那些下拉是對的**——清單外的值本來就不該存在。
 *
 * 判準見 `concepts/投影.md`「可逆性量不到使用者造不造得出來」：
 * **一個投影可以完全可逆，而同時是一個不完備的編輯器。**
 */
export function registerDynamicDropdownField(): void {
  if ((Blockly.fieldRegistry as any).fromJson?.__semorpheRegistered) return
  class DynamicDropdown extends Blockly.FieldDropdown {
    private allowCustom_: boolean

    constructor(spec: { source?: string; options?: Array<[string, string]>; allowCustom?: boolean }) {
      const allowCustom = spec.allowCustom === true
      super(() => {
        const base = spec.source
          ? (() => {
              const gen = dropdownSource(spec.source as string)
              if (!gen) throw new Error(`下拉來源沒註冊：${spec.source}——組裝點要先呼叫 declareDropdownSource`)
              return gen()
            })()
          : (spec.options ?? []).map((o) => [o[0], o[1]] as [string, string])
        const opts = allowCustom ? [...base, [CUSTOM_LABEL(), CUSTOM_VALUE] as [string, string]] : base
        // Blockly 不接受空的選項清單
        return opts.length > 0 ? opts : [['(自訂)', '']]
      })
      this.allowCustom_ = allowCustom
    }

    /**
     * 選到「自訂…」時問使用者要什麼。
     *
     * ⚠️ **不驗合法性**——P6：我們不是編譯器。使用者打 `int**`／`vector<vector<int>>`／
     * 一個自訂類別名，都直接收下。**驗它等於把「我們沒實作」講成「你寫錯了」。**
     */
    protected override onItemSelected_(menu: never, menuItem: never): void {
      const value = (menuItem as unknown as { getValue(): string }).getValue()
      if (this.allowCustom_ && value === CUSTOM_VALUE) {
        const current = String(this.getValue() ?? '')
        Blockly.dialog.prompt(CUSTOM_PROMPT(), current, (text) => {
          if (text !== null && text.trim() !== '') this.setValue(text.trim())
        })
        return
      }
      super.onItemSelected_(menu, menuItem)
    }
    /**
     * 🔴 **它是一個會查外部的下拉**。
     *
     * Blockly 用這個方法區分「寫死選項」與「每次現查」，
     * 而**護欄也用它**：一個死的下拉與一個活的下拉，
     * 在空工作區裡看起來一樣（都沒有選項），**只有這個方法分得出來**。
     */
    override isOptionListDynamic(): boolean {
      return true
    }

    /** 認不得的值**加進選項**，不換掉它（見檔頭）。 */
    protected override doClassValidation_(newValue?: string): string | null {
      if (newValue === null || newValue === undefined) return null
      const options = this.getOptions(false)
      if (!options.some((o) => o[1] === newValue)) options.push([newValue, newValue])
      return newValue
    }
    // ⚠️ 簽章要與 Blockly 的 `FieldDropdown.fromJson` 相容，
    //    所以參數型別放寬、在函式內收窄——**收窄發生在邊界**。
    static override fromJson(o: never): DynamicDropdown {
      const spec = o as unknown as { source?: string; options?: Array<[string, string]>; allowCustom?: boolean }
      // 🔴 兩種來源**至少要有一種**——都沒有的話它是一個永遠空的下拉，
      //    而空下拉與「還沒接上」長得一模一樣（同這個檔原本那條）。
      if (!spec.source && !spec.options) {
        throw new Error('field_dynamic_dropdown 要嘛給 `source`（動態）要嘛給 `options`（靜態清單）')
      }
      return new DynamicDropdown(spec)
    }
  }
  Blockly.fieldRegistry.register(FIELD_TYPE, DynamicDropdown as never)
}
