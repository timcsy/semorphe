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

/* eslint-disable @typescript-eslint/no-explicit-any */

/** 選項來源——**由組裝點注入**，這個模組一個 C++ 的字都不認識。 */
const SOURCES = new Map<string, () => Array<[string, string]>>()

/**
 * 註冊一個選項來源。
 *
 * ⚠️ **沒註冊就丟錯**，不回空陣列——一個空的下拉與「還沒接上」長得一模一樣，
 * 而使用者會以為是自己沒宣告變數。
 */
export function declareDropdownSource(name: string, options: () => Array<[string, string]>): void {
  SOURCES.set(name, options)
}

export function dropdownSourceNames(): string[] {
  return [...SOURCES.keys()]
}

const FIELD_TYPE = 'field_dynamic_dropdown'

/** 讓 Blockly 認得 `{ "type": "field_dynamic_dropdown", "name": "NAME", "source": "vars" }`。 */
export function registerDynamicDropdownField(): void {
  if ((Blockly.fieldRegistry as any).fromJson?.__semorpheRegistered) return
  class DynamicDropdown extends Blockly.FieldDropdown {
    constructor(source: string) {
      super(() => {
        const gen = SOURCES.get(source)
        if (!gen) throw new Error(`下拉來源沒註冊：${source}——組裝點要先呼叫 declareDropdownSource`)
        const opts = gen()
        // Blockly 不接受空的選項清單
        return opts.length > 0 ? opts : [['(自訂)', '']]
      })
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
      const source = (o as unknown as { source?: string }).source
      if (!source) throw new Error('field_dynamic_dropdown 少了 `source`——它要說選項從哪來')
      return new DynamicDropdown(source)
    }
  }
  Blockly.fieldRegistry.register(FIELD_TYPE, DynamicDropdown as never)
}
