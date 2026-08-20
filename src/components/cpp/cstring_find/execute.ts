/**
 * `cpp:cstring_find` 的 **execute** 路——**出聲，不要靜默回 0**
 *
 * `strchr`／`strstr` 回傳**指向陣列中間的指標**。這個直譯器的指標存的是
 * 「被指變數的名字」，表示不了「指向 s 的第 3 個字元」——那需要
 * (基底, 位移) 的表示法，是一個真的功能。
 *
 * ⚠️ **原本的做法是靜默回傳 0**，於是 `strchr(s, 'l') != 0` 對一個找得到的
 * 字元也是假：`while ((p = strchr(...)) != 0)` **一次都不跑**，
 * 而程式照樣跑完、印出後面的東西。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:cstring_find', async () => {
    throw new RuntimeError(RUNTIME_ERRORS.UNDEFINED_FUNCTION, {
      '%1': 'cstring_find 回傳指向陣列中間的指標，這個直譯器還表示不了',
    })
  })
}
