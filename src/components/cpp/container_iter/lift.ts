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
import { registerCallBranch, registerMethodBranch } from '../../../core/component/lift-branches'
import { recordedTypeIsDevice } from '../../../core/component/container-templates'
import { createNode } from '../../../core/semantic-tree'

/** 這顆認得的「哪一端」——`which` 屬性的值域，與積木上那格下拉同一份。 */
const ENDS = new Set(['begin', 'end', 'rbegin', 'rend'])

export function registerLift(): void {
  registerMethodBranch('cpp/container_iter', (obj, method, argChildren, ctx, objNode): SemanticNode | null => {
    // ⚠️ **反向那兩端走同一顆**（2026-09-17）——「哪一端是參數」這條規則
    //    本來就涵蓋它們：紀律相同（取得一個位置），差的只是哪一端、往哪走。
    if (!ENDS.has(method)) return null
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
    // 🔴 **接收者是一棵樹**（2026-09-18）——`v[i].begin()`／`m[k].find(x)`
    const recv = objNode ? ctx.lift(objNode) : null
    if (!recv) return null
    return createNode('cpp:container_iter', { which: method, call: 'method' }, { obj: [recv] })
  })

  /**
   * 🔴 **自由函式那一形**（2026-09-18）：`begin(a)`／`end(a)`。
   *
   * 語料 4 支這樣寫，而它們**全部**是原生陣列——那不是巧合：
   * `int a[5]` 沒有成員 `begin`，所以自由函式是**唯一**寫得出來的形式。
   *
   * > **位置不是身分，是形態**——接點結構一樣（一個容器 ＋ 哪一端），
   * > 所以這裡回的是同一顆身分，差別進 `call` 屬性。
   *
   * ⚠️ **只有一個引數時才是我**：`begin` 這個名字很短，而使用者自己也寫得出
   *    `int begin(int l, int r)`。判不出來就讓開。
   * ⚠️ 反向的 `rbegin(x)`／`rend(x)` 在 C++17 才有，而語料 0 處
   *    ——**沒有人接得住的東西補了只會讓失敗的位置往後移**，所以不收。
   */
  registerCallBranch('cpp/container_iter', (funcName, argChildren, ctx, _argsNode): SemanticNode | null => {
    const bare = funcName.startsWith('std::') ? funcName.slice(5) : funcName
    if (bare !== 'begin' && bare !== 'end') return null
    if (argChildren.length !== 1) return null
    const recv = ctx.lift(argChildren[0])
    if (!recv) return null
    return createNode('cpp:container_iter', { which: bare, call: 'free' }, { obj: [recv] })
  })
}
