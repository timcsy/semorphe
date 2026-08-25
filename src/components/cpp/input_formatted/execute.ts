/**
 * `cpp:input_formatted` 的 **execute** 路（`scanf`）
 *
 * ⚠️ 它原本是 `std/cstdio/executors.ts` 裡一個叫 `execScanf` 的閉包。
 * `isIndexedAccess` 那一句原本寫死 `argNode.componentId === 'cpp:array_at'`
 * ——`scanf("%d", &arr[i])` 讀進來的值要寫回**陣列的某一格**，
 * 而那是 `array_at` 的性質，不是這顆該認得的身分。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
// 🪦 `isIndexedAccess` 的匯入已於 2026-08-26 刪除——那一支手拆形狀的分支
//    換成了 `resolvePlace`，而它是**扣除式**的：加一種新的左值形狀不改這個檔。
import { defaultValue, parseInputValue } from '../../../interpreter/types'
import { resolvePlace } from '../../../interpreter/lvalue'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  const execScanf: ComponentExecutor = async (node, ctx) => {
    const format = String(node.properties.format ?? '%d')
    const argNodes = node.children.args ?? []
    const specifiers = format.match(/%[^%]*?[diouxXeEfgGcsplnDOUaA]/g) ?? []

    let itemsRead = 0
    for (let i = 0; i < argNodes.length; i++) {
      const argNode = argNodes[i]
      const spec = specifiers[i] ?? '%d'

      let targetType = 'int'
      if (/[fFeEgGaA]/.test(spec)) targetType = 'double'
      else if (/[cs]/.test(spec)) targetType = spec.includes('c') ? 'char' : 'string'

      let raw = ctx.readScanfToken()
      if (raw === null) {
        const line = await ctx.awaitInput()
        if (line !== null) {
          const tokens = line.trim().split(/\s+/).filter(t => t.length > 0)
          ctx.scanfTokenBuffer.push(...tokens)
          raw = ctx.readScanfToken()
        }
      }
      if (raw === null) {
        return { type: 'int', value: itemsRead === 0 ? -1 : itemsRead }
      }
      const lastVal = parseInputValue(raw, targetType) ?? defaultValue(targetType)
      itemsRead++

      // 🟢 **每一個 `&x` 都是一個【位置】**（2026-08-26）——走 `resolvePlace`。
      //
      // 🪦 在此之前這裡手拆形狀：`isIndexedAccess(...)` 那一支讀
      // `argNode.properties.obj`（陣列的名字，一個字串），而**它只認得那一種**
      // ——`scanf("%d", &obj.arr[i])`／`&p->x` 都走不通。
      //
      // ⚠️ 型別要**先讀出來**再解析：`%d` 讀進 `double` 的變數時，
      // 既有行為是照那個變數現在的型別重解一次。
      let place: Awaited<ReturnType<typeof resolvePlace>> | null = null
      try { place = await resolvePlace(argNode, ctx) } catch { place = null }
      if (place) {
        let refined = lastVal
        if (targetType === 'int') {
          const cur = place.read().type
          refined = parseInputValue(raw!, cur) ?? defaultValue(cur)
        }
        place.write(refined)
      } else {
        // 位置解不出來（多半是那個名字還沒宣告）——`scanf` 在這個直譯器裡
        // 會順手宣告它，所以留一條退路。
        ctx.scope.set(String(argNode.properties.name ?? 'x'), lastVal)
      }
    }
    return { type: 'int', value: itemsRead }
  }

  register('cpp:input_formatted', execScanf)
}
