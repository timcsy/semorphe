/**
 * **收集膠囊的 formalize 註冊**（第 389 刀）。
 *
 * 每顆有翻譯的元件在自己的資料夾裡有 `formalize.ts`，匯出 `registerFormalize(r)`；
 * 這裡用 `import.meta.glob` 把它們全部收進來，排成查表（引擎與作用域走訪共用這一份）。
 * 形狀見 `core/formalize-contract.ts`。
 *
 * 🔴 註冊的身分必須是**它所在資料夾的那一顆**——不一致就 throw（複製膠囊忘了改 id，只信註冊抓不到）。
 * 同一個位置註冊兩次也 throw（兩份翻譯 ＝ 雙重真相）。
 */
import type { SemanticNode } from '../../../core/types'
import type { CellaJson, FormalizeContext, FormalizeRegistrar, RegisterFormalize, ScopeWalker } from '../../../core/formalize-contract'
import { idToDir } from '../../../core/component/types'

// ⚠️ 樣式必須是字面常數（Vite 在建置時展開；同 `core/component/registry.ts`）。
const MODULES = import.meta.glob('/src/components/*/*/formalize.ts', { eager: true }) as Record<
  string,
  { registerFormalize?: RegisterFormalize }
>

export interface FormalizeTables {
  expr: Map<string, (n: SemanticNode, f: FormalizeContext) => CellaJson>
  stmt: Map<string, (n: SemanticNode, f: FormalizeContext) => CellaJson[]>
  item: Map<string, (n: SemanticNode, f: FormalizeContext) => CellaJson[]>
  member: Map<string, (n: SemanticNode, f: FormalizeContext) => CellaJson>
  decl: Map<string, (n: SemanticNode, f: FormalizeContext, global: boolean) => CellaJson[]>
  init: Map<string, (n: SemanticNode, f: FormalizeContext) => CellaJson>
  constInt: Map<string, (n: SemanticNode, f: FormalizeContext) => number | null>
  definesType: Map<string, (n: SemanticNode) => string>
  declaresType: Map<string, (n: SemanticNode) => string>
  memberKey: Map<string, (n: SemanticNode) => { className?: string; key: string }>
  definesEnum: Map<string, (n: SemanticNode) => string>
  definesUnion: Map<string, (n: SemanticNode) => string>
  definesMacro: Map<string, (n: SemanticNode) => { name: string; value: string; function?: boolean } | null>
  literal: Map<string, { test: (text: string) => boolean; value?: (text: string) => string }>
  scope: Map<string, (n: SemanticNode, w: ScopeWalker) => void>
}

function build(): FormalizeTables {
  const t: FormalizeTables = {
    expr: new Map(), stmt: new Map(), item: new Map(), member: new Map(), decl: new Map(),
    init: new Map(), constInt: new Map(), definesType: new Map(), declaresType: new Map(), memberKey: new Map(), definesEnum: new Map(), definesUnion: new Map(), scope: new Map(),
    definesMacro: new Map(), literal: new Map(),
  }
  for (const [key, mod] of Object.entries(MODULES)) {
    // 用 split 不用正則（同 `core/component/registry.ts` 的 pathToDir）
    const parts = key.split('/').filter(Boolean) // src, components, <scope>, <name>, formalize.ts
    const i = parts.indexOf('components')
    if (i < 0 || parts.length !== i + 4) throw new Error(`formalize 的路徑不符 <scope>/<name> 版型：${key}`)
    const dir = `${parts[i + 1]}/${parts[i + 2]}`
    if (typeof mod.registerFormalize !== 'function') throw new Error(`${key} 沒有匯出 registerFormalize`)
    const put = <F>(table: Map<string, F>, where: string) => (id: string, fn: F): void => {
      if (idToDir(id) !== dir) throw new Error(`${key} 註冊了不屬於自己資料夾的身分 ${id}`)
      if (table.has(id)) throw new Error(`${id} 的 ${where} 註冊了兩次`)
      table.set(id, fn)
    }
    const r: FormalizeRegistrar = {
      expr: put(t.expr, 'expr'), stmt: put(t.stmt, 'stmt'), item: put(t.item, 'item'), member: put(t.member, 'member'), decl: put(t.decl, 'decl'),
      init: put(t.init, 'init'), constInt: put(t.constInt, 'constInt'), definesType: put(t.definesType, 'definesType'), declaresType: put(t.declaresType, 'declaresType'), memberKey: put(t.memberKey, 'memberKey'), definesEnum: put(t.definesEnum, 'definesEnum'), definesUnion: put(t.definesUnion, 'definesUnion'),
      scope: put(t.scope, 'scope'), definesMacro: put(t.definesMacro, 'definesMacro'),
      literal: (id, test, value) => put(t.literal, 'literal')(id, { test, value }),
    }
    mod.registerFormalize(r)
  }
  return t
}

export const FORMALIZE: FormalizeTables = build()
