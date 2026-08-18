/**
 * `cpp:servo_declare` 的 **lift** 路——**一筆資料：「`Servo` 這個型別名屬於我」**
 *
 * ⚠️ 走**純型別名**那張表（不是容器樣板表）——語法位置不同：
 * 容器是 `vector<int> v;`（template_type），這個是 `Servo x;`（type_identifier）。
 *
 * 🟢 而 `declaresVariableType` 那一格是**這一批的關鍵**：它讓作用域記住
 * `myServo` 的型別是 `Servo`，之後 `myServo.someMethod()` 才查得到主人。
 * **型別是宣告出來的，不是猜的**——這一批的辨識因此比零件那一批更穩。
 */
import { registerPlainTypeConcept } from '../../../core/component/container-templates'

export function registerLift(): void {
  registerPlainTypeConcept('Servo', 'cpp:servo_declare', 'cpp/servo_declare')
}
