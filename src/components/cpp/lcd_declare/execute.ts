/**
 * `cpp:lcd_declare` 的 **execute** 路——**把這個名字登記成一個物件**。
 *
 * 🔴 **不能 `skipPaths`**：後面的 `lcd.someMethod()` 要查得到它，
 * 而跳過會讓直譯器在**下一行**撞上「不是一個物件」——症狀出現在別人身上。
 *
 * ⚠️ 而值本身是一個**空殼**：狀態記在
 * `languages/cpp/core/runtime/arduino-devices.ts`，以變數名為鍵。
 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:lcd_declare', async (node, ctx) => {
    const name = String(node.properties.name ?? 'lcd')
    if (!name) throw new Error('硬體物件的宣告少了名字')
    // 引數要**求值過**——`LiquidCrystal d(DHTPIN, DHTTYPE)` 裡的名字不存在的話要出聲。
    for (const a of node.children.initializer ?? []) await ctx.evaluate(a)
    // ⚠️ 型別記 `'object'`——`RuntimeType` 是一組封閉的值，套件的型別名不在裡面。
    // 🟢 而「這個變數是哪一種硬體」由**辨識期**的作用域記著（`declaresVariableType`），
    //    執行期不需要再記一次。**同一個事實不要有兩份記載。**
    ctx.scope.declare(name, { type: 'object', value: name })
  })
}
