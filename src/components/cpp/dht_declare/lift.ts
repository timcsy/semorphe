/**
 * `cpp:dht_declare` 的 **lift** 路——**一筆資料：「`DHT` 這個型別名屬於我」**
 *
 * ⚠️ 走**純型別名**那張表（不是容器樣板表）——語法位置不同：
 * 容器是 `vector<int> v;`（template_type），這個是 `DHT x;`（type_identifier）。
 *
 * 🟢 而 `declaresVariableType` 那一格是**這一批的關鍵**：它讓作用域記住
 * `dht` 的型別是 `DHT`，之後 `dht.someMethod()` 才查得到主人。
 * **型別是宣告出來的，不是猜的**——這一批的辨識因此比零件那一批更穩。
 */
import { registerPlainTypeComponent } from '../../../core/component/container-templates'

export function registerLift(): void {
  registerPlainTypeComponent('DHT', 'cpp:dht_declare', 'cpp/dht_declare')
}
