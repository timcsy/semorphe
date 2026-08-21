/**
 * `python:class_def` 的 **execute** 路——登記方法，不執行。
 *
 * ## 這個直譯器怎麼看「物件」
 *
 * 一個實例是一個 `object` 值（欄位 → 值）。方法登記在函式表裡，
 * 名字是 `類別.方法`；呼叫 `d.bark()` 時由呼叫那顆元件把接收者當第一個引數傳進去。
 *
 * ⚠️ **`self` 沒有特別處理**——它就是第一個參數，而 Python 也是這樣。
 * 🔴 而**建構式的名字是一個約定**（`__init__`），寫在這裡：
 * `Dog("小黑")` 會找 `Dog.__init__`。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:class_def', async (node, ctx) => {
    const cls = String(node.properties.name ?? 'MyClass')
    // 🔴 **繼承：先把父類別的方法抄一份過來**，再讓自己的覆蓋掉。
    //
    // ⚠️ **這是「定義的當下抄一份」不是「呼叫時往上找」**，而差別看得見：
    // 父類別在子類別**定義之後**才長出新方法時，子類別不會有它
    // （真 Python 會）。教學語料裡類別一律先定義完才用，
    // 而**寫在這裡是為了讓它是已知的**，不是沒有人記得的巧合。
    const base = String(node.properties.base ?? '')
    if (base) {
      const prefix = `${base}.`
      for (const [key, fn] of [...ctx.functions]) {
        if (key.startsWith(prefix)) ctx.functions.set(`${cls}.${key.slice(prefix.length)}`, fn)
      }
    }
    for (const m of node.children.methods ?? []) {
      const mName = String(m.properties.name ?? '')
      if (!mName) continue
      const params = (m.children.params ?? [])
        .map((p) => ({ name: String(p.properties.name ?? ''), type: '' }))
        .filter((p) => p.name)
      ctx.functions.set(`${cls}.${mName}`, { name: mName, params, body: m.children.body ?? [], returnType: '' })
    }
    // 類別本身也要在函式表裡——`Dog("小黑")` 是一個呼叫
    ctx.functions.set(cls, { name: cls, params: [], body: [], returnType: cls })
  })
}
