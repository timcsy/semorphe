/**
 * 手寫的 Python 型別表（spec 225 Phase 1）——形狀照與 cella 談定的 `{nodes, basis}`。
 * ⚠️ 不是型別推導：照名字給變數型別、其餘照字面推，只為了在 Cella 發布 `python.observedTypes` 之前餵引擎。
 */
import type { ObservedTypes } from '../../src/languages/python/to-cpp/contract'
import type { SemanticNode } from '../../src/core/types'

export function fakeObserved(tree: SemanticNode, vars: Record<string, string>, opts: { unreached?: (n: SemanticNode) => boolean } = {}): ObservedTypes {
  const nodes: Record<string, string> = {}
  const basis: Record<string, 'observed' | 'unreached'> = {}
  const ty = (n: SemanticNode): string | undefined => {
    const c = n.componentId.replace('python:', '')
    const kid = (s: string) => n.slots?.[s]?.[0]
    switch (c) {
      case 'var_ref': return vars[String(n.properties.name)]
      case 'literal_number': return String(n.properties.value).includes('.') ? 'float' : 'int'
      case 'literal_string': return 'str'
      case 'literal_bool': case 'compare': case 'logic': case 'logic_not': return 'bool'
      case 'input': return 'str'
      case 'cast': return ({ int: 'int', float: 'float', str: 'str' } as Record<string, string>)[String(n.properties.target_type)]
      case 'arithmetic': { const l = ty(kid('left')!), r = ty(kid('right')!); const op = String(n.properties.operator); if (op === '/') return 'float'; if (l === 'str' && r === 'str') return 'str'; return l === 'float' || r === 'float' ? 'float' : 'int' }
      case 'negate': return ty(kid('value')!)
      case 'container_size': case 'container_sum': return 'int'
      case 'container_at': { const t = ty(kid('target')!); return t?.replace(/^list\[(.+)\]$/, '$1') }
      case 'math_max': case 'math_min': { const v = n.slots.values ?? []; return v.length === 1 ? ty(v[0])?.replace(/^list\[(.+)\]$/, '$1') : ty(v[0]) }
      case 'func_call': return vars[`${n.properties.name}()`]
      case 'array_make': return (n.slots.items ?? []).length ? `list[${ty(n.slots.items[0])}]` : 'list[?]'
    }
    return undefined
  }
  const walk = (n: SemanticNode): void => {
    const t = ty(n)
    if (opts.unreached?.(n)) basis[n.id] = 'unreached'
    else if (t !== undefined) { nodes[n.id] = t; basis[n.id] = 'observed' }
    for (const k of Object.values(n.slots ?? {})) k.forEach(walk)
  }
  walk(tree)
  return { nodes, basis }
}

