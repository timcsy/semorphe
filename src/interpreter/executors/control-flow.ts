
/** Break/Continue signals (non-error, used for flow control) */
export class BreakSignal { readonly _brand = 'break' }
export class ContinueSignal { readonly _brand = 'continue' }
export class ThrownSignal {
  readonly _brand = 'thrown'
  readonly value: unknown
  constructor(value: unknown) { this.value = value }
}

/**
 * ⚠️ **這個模組不再註冊任何執行器**——它的元件都搬進膠囊了。
 * 檔案留著因為裡面還有**訊號類別**（`BreakSignal`／`ContinueSignal`／`ThrownSignal`），
 * 而那些不屬於任何一顆元件——**訊號必須是同一個，複製一份 `instanceof` 就失敗。**
 */
