/**
 * `cpp:input` 的 **execute** 路——從共用檔原封剪過來（批次第三十九批）。
 *
 * ## 🔴 `>>` 的失敗狀態會黏住（2026-08-21）
 *
 * 這顆執行器原本每一次 `>>` 都當作全新的一次讀取：格式錯的 token 被**吞掉**、
 * 變數拿到一個 0、然後**繼續讀下一個**。於是 `while (cin >> x)` 餵 `1 abc 3`
 * 在 Semorphe 跑三圈，在真 g++ 跑一圈——**而中間沒有任何東西出聲**。
 *
 * 真 C++：`>>` 一失敗就設 `failbit`，之後每一次 `>>` **立刻失敗**直到 `clear()`。
 *
 * ⚠️ 而 EOF 與「格式不符」**不是同一件事**（實測 Apple clang 16 / libc++）：
 *
 * | | `failbit` | 變數 |
 * |---|---|---|
 * | 還沒讀到字就 EOF | 設 | **不動**（sentry 就失敗了，轉換根本沒跑） |
 * | 讀到 `abc` 但要 `int` | 設 | **設成零值**（`num_get` 跑了而失敗） |
 *
 * 我一度以為兩者都設成 0——**那是照著標準條文猜的，而不是量的**。
 * 護欄 `tests/integration/audit-cin-fail-state.test.ts` 每一條都跟參照編譯器對答案。
 *
 * 🟢 而 `return { type: 'int', value: 0 }` **不是缺陷，不要動它**：
 * 那是 `cin >> a >> b` 的**回傳值**（讀成功幾筆），`while (cin >> x)` 正是靠它終止。
 */
import type { ComponentExecutor, ExecutionContext } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { defaultValue, parseInputValue } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { isIndexedAccess } from '../../../core/component/traits'

/**
 * 一次 `>>` 的結果。
 *
 * 「**有沒有東西要寫進變數**」與「**這次成功了沒有**」是兩件事——
 * 合成一個回傳值正是原本那個病的形狀。
 */
type Extraction = { value: RuntimeValue | null; ok: boolean }

/** 讀一個 token 並轉成 `targetType`。已經在失敗狀態就**什麼都不做**。 */
async function extractOne(ctx: ExecutionContext, targetType: string): Promise<Extraction> {
  if (ctx.cinFailed) return { value: null, ok: false }
  let raw = ctx.readCinToken()
  if (raw === null) {
    const line = await ctx.awaitInput()
    if (line !== null) {
      const tokens = line.trim().split(/\s+/).filter((t) => t.length > 0)
      ctx.scanfTokenBuffer.push(...tokens)
      raw = ctx.readCinToken()
    }
  }
  // EOF：`failbit` 要設，而變數**不動**（見檔頭那張表）
  if (raw === null) { ctx.failCin(); return { value: null, ok: false } }
  const parsed = parseInputValue(raw, targetType)
  // 格式不符：`failbit` 要設，而變數**設成零值**
  if (parsed === null) { ctx.failCin(); return { value: defaultValue(targetType), ok: false } }
  return { value: parsed, ok: true }
}

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:input', async (node, ctx) => {
      const valueNodes = node.children.values ?? []

      // `in >> a >> b` —— 來源是一個**字串串流變數**，不是標準輸入。
      // 串流的狀態是「還沒讀的 token」（見 std/sstream/executors.ts），
      // 每次讀取取走一個。
      const from = node.properties.from
      if (from !== undefined) {
        const streamName = String(from)
        const stream = ctx.scope.get(streamName)
        const tokens = Array.isArray(stream.value) ? [...(stream.value as RuntimeValue[])] : []
        for (const target of valueNodes) {
          const tok = tokens.shift()
          const name = String(target.properties.name)
          const cur = ctx.scope.has(name) ? ctx.scope.get(name) : { type: 'int' as const, value: 0 }
          // 依**目標變數的型別**轉換——與 C++ 的 `>>` 一致
          const parsed = tok === undefined
            ? cur
            : (parseInputValue(String(tok.value), cur.type) ?? cur)
          ctx.scope.set(name, parsed)
        }
        ctx.scope.set(streamName, { type: 'array', value: tokens })
        return
      }
      if (valueNodes.length > 0) {
        let itemsRead = 0
        for (const varRefNode of valueNodes) {
          if (isIndexedAccess(varRefNode.componentId)) {
            const arrName = String(varRefNode.properties.obj)
            const arr = ctx.scope.get(arrName)
            if (arr.type !== 'array' || !Array.isArray(arr.value)) {
              throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
            }
            const indexVal = await ctx.evaluate((varRefNode.children.index ?? [])[0])
            const index = ctx.toNumber(indexVal)
            const elemType = arr.value.length > 0 ? arr.value[0].type : 'int'
            const got = await extractOne(ctx, elemType)
            if (got.value !== null && index >= 0 && index < arr.value.length) {
              arr.value[index] = got.value
            }
            if (!got.ok) return { type: 'int', value: 0 }
            itemsRead++
            continue
          }

          const varName = String(varRefNode.properties.name ?? 'x')
          let targetType = 'string'
          try { const existing = ctx.scope.get(varName); targetType = existing.type } catch { /* variable might not exist yet */ }

          const got = await extractOne(ctx, targetType)
          if (got.value !== null) ctx.scope.set(varName, got.value)
          if (!got.ok) return { type: 'int', value: 0 }
          itemsRead++
        }
        return { type: 'int', value: itemsRead }
      }

      const targetType = String(node.properties.type || 'string')
      const got = await extractOne(ctx, targetType)
      return got.value ?? { type: 'int', value: 0 }
    })
}
