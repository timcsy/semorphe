/**
 * 收集每顆 C++ 膠囊的 `to-python.ts`（spec 219）——同 formalize 的收法：`import.meta.glob` 掃膠囊，排成查表。
 * 核心與這個檔都不認識任何一顆元件；身分只寫在膠囊裡。
 */
import type { SemanticNode } from '../../../core/types'
import type { ExprFn, RegisterToPython, StmtFn, TargetFn, TypeAliasFn } from './contract'

const MODULES = import.meta.glob('/src/components/cpp/*/to-python.ts', { eager: true }) as Record<string, { registerToPython?: RegisterToPython }>
const DECLS = import.meta.glob('/src/components/cpp/*/component.json', { eager: true, import: 'default' }) as Record<string, { componentId?: string }>

export interface ToPythonTables { expr: Map<string, ExprFn>; stmt: Map<string, StmtFn>; target: Map<string, TargetFn>; bool: Set<string>; typeAlias: Map<string, TypeAliasFn>; writes: Map<string, (n: SemanticNode) => readonly SemanticNode[]> }

export function collectToPython(): ToPythonTables {
  const t: ToPythonTables = { expr: new Map(), stmt: new Map(), target: new Map(), bool: new Set(), typeAlias: new Map(), writes: new Map() }
  for (const [path, m] of Object.entries(MODULES)) {
    if (typeof m.registerToPython !== 'function') throw new Error(`${path} 沒有匯出 registerToPython`)
    // 膠囊不寫自己的身分：同一個目錄的 component.json 說了算
    const id = DECLS[path.replace(/to-python\.ts$/, 'component.json')]?.componentId
    if (!id) throw new Error(`${path} 的目錄裡找不到 component.json 的身分`)
    m.registerToPython({
      expr: (fn) => { if (t.expr.has(id)) throw new Error(`${id} 的 Python 運算式印法登記了兩次`); t.expr.set(id, fn) },
      stmt: (fn) => { if (t.stmt.has(id)) throw new Error(`${id} 的 Python 敘述印法登記了兩次`); t.stmt.set(id, fn) },
      target: (fn) => { if (t.target.has(id)) throw new Error(`${id} 的 Python 目標寫法登記了兩次`); t.target.set(id, fn) },
      yieldsBool: () => { t.bool.add(id) },
      writes: (fn) => { t.writes.set(id, fn) },
      typeAlias: (fn) => { if (t.typeAlias.has(id)) throw new Error(`${id} 的型別別名登記了兩次`); t.typeAlias.set(id, fn) },
    })
  }
  return t
}
