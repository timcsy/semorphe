/**
 * `cpp:lcd_declare` 的 **lift** 路——**一筆資料：「`LiquidCrystal` 這個型別名屬於我」**
 *
 * ⚠️ 走**純型別名**那張表（不是容器樣板表）——語法位置不同：
 * 容器是 `vector<int> v;`（template_type），這個是 `LiquidCrystal x;`（type_identifier）。
 *
 * 🟢 而 `declaresVariableType` 那一格是**這一批的關鍵**：它讓作用域記住
 * `lcd` 的型別是 `LiquidCrystal`，之後 `lcd.someMethod()` 才查得到主人。
 * **型別是宣告出來的，不是猜的**——這一批的辨識因此比零件那一批更穩。
 */
import { registerPlainTypeComponent } from '../../../core/component/container-templates'

export function registerLift(): void {
  // 🔴 **兩個型別名、一個身分。** 盲測抓到 I2C 版佔 20% 而完全不認得——
  //    而它們是同一件事（一片字元液晶），差別只在**接線方式與函式庫**。
  //    ⚠️ 而那個差別由 `decl_type` 參數帶著，**不得被改寫**。
  for (const t of ['LiquidCrystal', 'LiquidCrystal_I2C']) {
    registerPlainTypeComponent(t, 'cpp:lcd_declare', 'cpp/lcd_declare')
  }
}
