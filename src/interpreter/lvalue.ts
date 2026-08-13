/**
 * **寫回一個位置** —— 與身分無關的演算法
 *
 * `swap(a[j], a[j+1])` 要對調兩格的值，而 `ctx.evaluate` 給的是**值**。
 * 這裡把「這個節點指的是哪一格」解出來，讀寫各一次。
 *
 * ⚠️ **問角色不問身分**：形狀由元件自己宣告（`declareLvalue`），
 * 這個檔一個 C++ 的名字都沒有。
 */
import type { SemanticNode } from '../core/types'
import type { RuntimeValue } from './types'
import type { ExecutionContext } from './executor-registry'
import { lvalueKindOf } from '../core/component/lvalue-nodes'
import { RuntimeError, RUNTIME_ERRORS } from './errors'

/** 一個解出來的位置：讀得到也寫得回 */
export interface Place {
  read(): RuntimeValue
  write(v: RuntimeValue): void
}

/**
 * 把一個節點解成一個位置。**解不出來就丟錯**——回一個假的位置的話，
 * 寫回會靜靜地丟掉，而程式看起來跑完了。
 */
export async function resolvePlace(node: SemanticNode, ctx: ExecutionContext): Promise<Place> {
  const kind = lvalueKindOf(node.conceptId)

  if (kind === 'name') {
    const name = String(node.properties.name)
    return {
      read: () => ctx.scope.get(name),
      write: (v) => ctx.scope.set(name, v),
    }
  }

  if (kind === 'element') {
    const name = String(node.properties.obj)
    const container = ctx.scope.get(name)
    if (container.type !== 'array' || !Array.isArray(container.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': `${name} 不是容器` })
    }
    const idxNode = (node.children.index ?? [])[0]
    const idx = idxNode ? Math.trunc(ctx.toNumber(await ctx.evaluate(idxNode))) : 0
    const cells = container.value as RuntimeValue[]
    if (idx < 0 || idx >= cells.length) {
      throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(idx) })
    }
    return {
      read: () => cells[idx],
      write: (v) => { cells[idx] = v },
    }
  }

  if (kind === 'field') {
    const objName = String(node.properties.obj)
    const member = String(node.properties.member)
    const obj = ctx.scope.get(objName)
    if (obj.type !== 'object' || !(obj.value instanceof Map)) {
      throw new RuntimeError(RUNTIME_ERRORS.UNDECLARED_VAR, { '%1': `${objName}（不是一個結構）` })
    }
    const fields = obj.value as Map<string, RuntimeValue>
    return {
      read: () => fields.get(member) ?? { type: 'int', value: 0 },
      write: (v) => { fields.set(member, v) },
    }
  }

  throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, {
    '%1': '這個東西不能被指定值（它不是一個位置）',
  })
}
