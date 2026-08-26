/**
 * `cpp:address_of` 的 **execute** 路——`&x` 與 `&arr[i]`
 *
 * ## 這個直譯器有**兩種**指標，而它們的機制不同
 *
 * ```
 * &x        符號式  value 是變數名字串，配一張 pointerTargets（名字 → scope）
 * &arr[i]   實體式  value 是那個陣列本身（共用，寫得回去）＋ offset
 * ```
 *
 * ⚠️ `&arr[i]` 原本掉進尾端的 `return { type: 'int', value: 0 }`
 * ——因為 `arr[i]` 是 `cpp:array_at`，它沒有 `properties.name`。
 * 症狀是「一個指標變成整數 0」，而後面每次解參考都報 `TYPE_MISMATCH`
 * （第三十二條護欄 18 段缺口裡的 2 段）。
 *
 * ## ⚠️ 為什麼不能用 `slice(i)`
 *
 * 那是**複製**。`*p = 9` 之後 `arr[i]` 不會變，而畫面上看不出來
 * ——與這個專案追了一整年的靜默資料遺失同一個形狀。
 * 所以共用同一個 `value` 陣列，用 `offset` 記位置。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:address_of', async (node, ctx) => {
    const varNodes = node.children.var ?? []
    if (varNodes.length === 0) return { type: 'int', value: 0 }
    const target = varNodes[0]

    // `&arr[i]` —— 取陣列某一格的位址。
    //
    // ⚠️ **判別看結構，不看身分。** 第一版寫的是
    // `target.componentId === 'cpp:array_at'`，而膠囊就近性護欄當場報了兩個方向的
    // 違規（「膠囊裡混進別顆元件」＋「那顆元件出現在自己資料夾外」）——**它是對的**：
    // 一顆元件認得另一顆的身分，就是把兩者黏死。
    //
    // 「有一個**容器**又有 `index` 接點」是**索引存取**這件事的結構特徵，
    // 而任何滿足它的節點（今天是 `array_at`，明天可能是別的容器）都適用。
    //
    // 🔴 **2026-08-26：容器從字串屬性換成接點**（左值那一輪）。
    //    這裡本來只讀 `properties.obj`，於是 `&arr[0]` 當場退到下面的
    //    「符號式」那一支、拿不到名字、丟 `TYPE_MISMATCH: pointer`。
    //    ⚠️ 抓到它的是**第三十二條（行為的誤差）的「只有參照跑得動」那一欄**
    //    ——它從 1 升到 3，而**誤差本身仍然是 0**：一段跑不動的程式不會產生誤差。
    //
    // > **一個「跑不動」的迴歸，不會出現在「答案對不對」那一欄。**
    const objNode = (target.children.obj ?? [])[0]
    const objName = String(objNode?.properties?.name ?? target.properties.obj ?? '')
    const idxNode = (target.children.index ?? [])[0]
    if ((objNode || objName) && idxNode) {
      const base = objNode
        ? await ctx.evaluate(objNode)
        : (ctx.scope.has(objName) ? ctx.scope.get(objName) : null)
      if (base && base.type === 'array' && Array.isArray(base.value)) {
        const i = Number((await ctx.evaluate(idxNode)).value)
        if (!Number.isInteger(i) || i < 0 || i >= base.value.length) {
          throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(i) })
        }
        // ⚠️ 共用 `base.value`，不是複製——見檔頭。
        return { type: 'array', value: base.value as RuntimeValue[], offset: (base.offset ?? 0) + i }
      }
    }

    // `&x` —— 符號式。
    const varName = String(target.properties.name ?? '')
    if (varName) {
      ctx.pointerTargets.set(varName, ctx.scope.findOwner(varName) ?? ctx.scope)
      return { type: 'pointer' as never, value: varName }
    }

    // 取不到位址的東西（`&f()` 之類）。⚠️ 保留既有行為，而它本身是可疑的
    // ——回 0 與「位址剛好是 0」在畫面上相同。改它要先知道哪些語料會走到這裡。
    return { type: 'int', value: 0 }
  })
}
