/**
 * `cpp:string_find_last_not_of` 的 **lift** 路
 *
 * 它原本是 `lifters/io.ts` 一個 switch 的 case 標籤，而**身分是樣板字串組出來的**
 * （`createNode(\`cpp:string_\${method}\`)`）。那一行的註解記著它害過一次：
 * **模板字串組出來的身分，掃描器看不到**——命名空間遷移時它還組著舊前綴，
 * 於是這兩顆概念**安靜地建不出來**。
 *
 * → 搬進膠囊順帶治了它：**身分現在是字面字串，掃描器看得到。**
 */
import { registerMethodComponent } from '../../../core/component/method-components'

export function registerLift(): void {
  registerMethodComponent('find_last_not_of', 'cpp:string_find_last_not_of', 'cpp/string_find_last_not_of', ['arg'])
}
