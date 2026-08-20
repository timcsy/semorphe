/**
 * `cpp:container_iter` 的 **lift** 路——**一個帶真邏輯的分支**
 *
 * ⚠️ 兩個方法名（`begin`／`end`）對**同一顆身分**，差別進 `which` 屬性。
 * 那是「哪一端變成參數」這條命名規則的直接後果——與 `container_peek`
 * 用同一個理由：兩者的**紀律相同**（取得一個位置），差的只是哪一端。
 *
 * 用分支而不是 `registerMethodComponent`，因為那張純資料表產不出 `which`
 * ——它只放得下「名字 → 身分」。
 */
import type { SemanticNode } from '../../../core/types'
import { registerMethodBranch } from '../../../core/component/lift-branches'
import { recordedTypeIsDevice } from '../../../core/component/container-templates'
import { createNode } from '../../../core/semantic-tree'

export function registerLift(): void {
  registerMethodBranch('cpp/container_iter', (obj, method, argChildren, ctx): SemanticNode | null => {
    if (method !== 'begin' && method !== 'end') return null
    // `v.begin(x)` 不是這顆——迭代器取得不吃引數。**判不出來就說不是我。**
    if (argChildren.length > 0) return null
    // 🔴 **這個接收者的型別已經被別人認領了嗎。**
    //
    // 2026-08-18 加。`begin()` 是**每個 Arduino 套件都有**的方法
    // （`dht.begin()`／`lcd.begin(16,2)`／`myServo` 那一族），而它們一個引數都沒有
    // ——於是全部被這裡認成「取得迭代器」。
    //
    // ⚠️ 而登錄型別方法**搶不回來**：這個分支跑在型別查詢**之前**
    //（`lifters/io.ts` 的 `tryMethodBranches` 早於 `typedMethodComponent`）。
    //
    // > **一個靠方法名認人的樣式，會把別人的方法搶走。**
    // > ——與腳位常數那顆付過的學費同一條，只是這次是【方法名】不是識別字名。
    //
    // 🟢 處置就是這個檔頭自己寫的判準：**判不出來就說不是我。**
    //
    // ⚠️ 而判準**不能是「這個型別有沒有主」**——`string` 也有主，
    //    而 `str.begin()` **確實是**迭代器。第一版就是那樣寫的，它會弄壞字串。
    //    改成問**擁有者**：硬體元件宣告 `owner: '(arduino)'`，容器與標準庫不是。
    //
    // > **「我是不是硬體」是那顆元件自己宣告的事實，不是這裡該猜的。**
    //
    // ⚠️ 查不到型別時**照舊認**——絕大多數 `v.begin()` 的 `v` 型別查不到，
    //    而那些正是真的迭代器。**不改既有行為，只讓硬體走開。**
    const type = obj ? ctx.data.getType(obj) : null
    if (type && recordedTypeIsDevice(type)) return null
    return createNode('cpp:container_iter', { obj, which: method })
  })
}
