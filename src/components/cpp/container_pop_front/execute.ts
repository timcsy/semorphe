import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:container_pop_front', async (node, ctx) => {
    // 🔴 **接收者求值，不再解析一串文字**（2026-09-18）——見 `component.json` 的 `_slots_why`
    /**
     * ⚠️ **接收者要走 `receiverOf`**——`d2[3].pop_front()` 這種帶下標的接收者
     * 在組裝時被壓成字串 `"d2[3]"`，直接 `scope.get` 會找不到那個名字。
     * 見 `interpreter/receiver.ts` 的檔頭。
     */
    const arr = await ctx.evaluate((node.slots.obj ?? [])[0])
    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
    }
    /**
     * ⚠️ **空容器上 `pop_front()` 在 C++ 是未定義行為**——我們選擇「什麼都不做」，
     * 與 `cpp:vector_pop` 逐字相同（它也是 `if (length > 0)`）。
     *
     * 🔴 而這個選擇**不得寫進拿 g++ 當權威的那條護欄**：
     * 一條拿參照實作當權威的護欄，不得把「它也沒有答案的地方」寫進判準
     * （見 `tests/integration/interpreter-matches-compiler.test.ts` 的檔頭）。
     */
    if (arr.value.length > 0) {
      arr.value.shift()
    }
  })
}
