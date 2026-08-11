import type { RuntimeValue } from '../types'

/**
 * ⚠️ **導出，而且只能有這一份。**
 *
 * 訊號類別靠 `instanceof` 辨識。複製成第二份的話 `instanceof` 一律為假，
 * 而症狀是「控制流程靜靜地穿過去了」——這個專案已經被同一件事咬過：
 * `BreakSignal` 在一次搬移中變成兩個類別，於是 `break` 逃出了迴圈，
 * 而型別檢查與清冊都是綠的。
 */
export class ReturnSignal {
  value: RuntimeValue
  constructor(value: RuntimeValue) { this.value = value }
}


/**
 * ⚠️ **這個模組不再註冊任何執行器**——它的元件都搬進膠囊了。
 * 檔案留著因為 `ReturnSignal` 在這裡——**訊號必須是同一個，複製一份
 * `instanceof` 就失敗，而失敗的樣子是「return 沒有被接住」不是編譯錯誤。**
 */
