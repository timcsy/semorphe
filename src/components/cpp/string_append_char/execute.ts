/** `cpp:string_append_char` 的 **execute** 路——從共用檔原封剪過來（批次第十三批：依型別分派的方法表）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:string_append_char', async (node, ctx) => {
      const obj = String(node.properties.obj)
      const val = ctx.scope.get(obj)
      // ⚠️ 辨識器把引數放在 `value`（見 `METHOD_CHILD_SLOT`），而這裡原本只讀
      // `char`——**於是 push_back 完全沒有作用，而且不出聲**。
      //
      // 076 把 `s.push_back(c)` 從通用容器版導到字串專屬版時，沒有人檢查子槽名
      // 對不對。第十條護欄（宣告的子節點名沒有人讀）抓不到這種——它查「有沒有
      // 人讀」，不查「**讀對不對**」。那條邊界寫在它的「不檢測什麼」裡。
      const charNodes = node.children.value ?? node.children.char ?? []
      if (charNodes.length === 0) return
      const ch = await ctx.evaluate(charNodes[0])
      // 字元字面可能求值成**數字碼**（`'x'` → 120）。直接串接會把 "ab" 變成
      // "ab120"——與 082 在陣列初始化列表遇到的是同一個病。
      const chStr =
        typeof ch.value === 'number' ? String.fromCharCode(ch.value) : String(ch.value)
      ctx.scope.set(obj, { type: 'string', value: String(val.value) + chStr })
    })
}
