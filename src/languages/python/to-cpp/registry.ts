/**
 * 收集每顆 Python 膠囊的 `to-cpp.ts`（spec 225）——同 spec 219 的收法：`import.meta.glob` 掃膠囊，身分由同目錄的 component.json 說了算。
 */
import type { ExprFn, RegisterToCpp, StmtFn } from './contract'

const MODULES = import.meta.glob('/src/components/python/*/to-cpp.ts', { eager: true }) as Record<string, { registerToCpp?: RegisterToCpp }>
const DECLS = import.meta.glob('/src/components/python/*/component.json', { eager: true, import: 'default' }) as Record<string, { componentId?: string }>

export interface ToCppTables { expr: Map<string, ExprFn>; stmt: Map<string, StmtFn> }

export function collectToCpp(): ToCppTables {
  const t: ToCppTables = { expr: new Map(), stmt: new Map() }
  for (const [path, m] of Object.entries(MODULES)) {
    if (typeof m.registerToCpp !== 'function') throw new Error(`${path} 沒有匯出 registerToCpp`)
    const id = DECLS[path.replace(/to-cpp\.ts$/, 'component.json')]?.componentId
    if (!id) throw new Error(`${path} 的目錄裡找不到 component.json 的身分`)
    m.registerToCpp({
      expr: (fn) => { if (t.expr.has(id)) throw new Error(`${id} 的 C++ 運算式寫法登記了兩次`); t.expr.set(id, fn) },
      stmt: (fn) => { if (t.stmt.has(id)) throw new Error(`${id} 的 C++ 敘述寫法登記了兩次`); t.stmt.set(id, fn) },
    })
  }
  return t
}
