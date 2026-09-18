/**
 * `cpp:io_mode` 的 **lift** 路——**一個帶真邏輯的分支**（三個函式名對同一顆身分）。
 *
 * ⚠️ 用分支而不是純資料：那張「名字 → 身分」的表放不下 `setting`
 * ——與同族那顆取容器一端的元件同一個理由。
 */
import type { SemanticNode } from '../../../core/types'
import { registerCallBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'

/** 這顆認得的三個名字 → `setting` 的值。與積木上那格下拉同一份。 */
const SETTINGS: Record<string, string> = {
  setw: 'width',
  setprecision: 'precision',
  setfill: 'fill',
}

export function registerLift(): void {
  registerCallBranch('cpp/io_mode', (funcName, argChildren, ctx, _argsNode): SemanticNode | null => {
    const bare = funcName.startsWith('std::') ? funcName.slice(5) : funcName
    const setting = SETTINGS[bare]
    if (!setting) return null
    // ⚠️ **恰好一個引數才是我**——`setw()` 與 `setw(a, b)` 都不是合法的 C++，
    //    而使用者自己也寫得出同名的函式。判不出來就讓開。
    if (argChildren.length !== 1) return null
    const value = ctx.lift(argChildren[0])
    if (!value) return null
    return createNode('cpp:io_mode', { setting }, { value: [value] })
  })
}
