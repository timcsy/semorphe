/**
 * 這顆元件寫成 Python（467）。C++ 的 switch 是「跳到符合的那個標籤（沒有就跳到 default），然後一路往下跑到 break」。
 *
 * ① 每一段都以 break（或 return）結尾、default 在最後、中間沒有別的 break ⟹ `if x in (1, 3): … elif …: … else: …`（最後的 break 拿掉）
 * ② 其餘（有掉下去的 fallthrough、段落中間的 break、default 不在最後）⟹ 照 C++ 的跳法寫：
 *      while True:                      ← 只跑一次；裡面的 break 跳出它，同 C++ 跳出 switch
 *          if hit or x in (1, 3):       ← hit：已經在往下跑了
 *              hit = True
 *              …
 *          if hit or x not in (所有 case 的值):   ← default 那一段
 *              …
 *          break
 *    ② 裡面有屬於這個 switch 外層迴圈的 continue ⟹ 保留（它會跳到 while True 的下一圈，不是外層迴圈）。
 *
 * 被比的值是單一名字或字面量就直接用（段落裡改了它也沒關係：改它的那一段已經在往下跑，後面的條件被 hit 短路），
 * 否則先算一次存起來（C++ 只算一次）。
 * 一個標籤的形狀：有 value 槽的是 case、只有 body 的是 default（問形狀，不點名那兩顆）。
 */
import type { ToPythonRegistrar, ToPythonContext } from '../../../languages/cpp/to-python/contract'
import type { SemanticNode } from '../../../core/types'
import { isSimple, isBreakNode, isReturnNode, hasOwnBreak, hasOwnContinue } from '../../../languages/cpp/to-python/contract'

interface Group { values: SemanticNode[]; isDefault: boolean; body: SemanticNode[] }

/** `{ … }` 的形狀：只有 body 槽、沒有屬性 */
const isBlock = (x: SemanticNode): boolean => Object.keys(x.slots ?? {}).join() === 'body' && Object.keys(x.properties ?? {}).length === 0

/** 一段的最後一句（走進結尾的 `{ … }`） */
function lastStmt(body: readonly SemanticNode[]): SemanticNode | undefined {
  const last = body[body.length - 1]
  return last && isBlock(last) ? lastStmt(last.slots.body ?? []) : last
}

/** 拿掉結尾的 break（走進結尾的 `{ … }`） */
function dropTrailingBreak(body: readonly SemanticNode[]): SemanticNode[] {
  const last = body[body.length - 1]
  if (!last) return []
  if (isBreakNode(last)) return body.slice(0, -1)
  if (isBlock(last)) return [...body.slice(0, -1), { ...last, slots: { ...last.slots, body: dropTrailingBreak(last.slots.body ?? []) } }]
  return [...body]
}

/** 連續的標籤併成一段：空本體的 case 掉進下一個（`case 1: case 3: …`） */
function groupsOf(cases: readonly SemanticNode[]): Group[] {
  const out: Group[] = []
  let pending: Group = { values: [], isDefault: false, body: [] }
  for (const c of cases) {
    const v = c.slots?.value?.[0]
    if (v) pending.values.push(v)
    else pending.isDefault = true
    const body = c.slots?.body ?? []
    if (body.length) { out.push({ ...pending, body: [...body] }); pending = { values: [], isDefault: false, body: [] } }
  }
  if (pending.values.length || pending.isDefault) out.push(pending)
  return out
}

const tupleOf = (xs: readonly string[]): string => `(${xs.join(', ')}${xs.length === 1 ? ',' : ''})`

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py: ToPythonContext, depth) => {
    const cases = n.slots.cases ?? []
    if (cases.some((c) => !c.slots?.body)) return [py.keep(n, 'outside-subset', 'switch 裡有不是 case／default 的東西')]
    const groups = groupsOf(cases)
    const scrut = n.slots.expr?.[0]
    const pre: string[] = []
    let x = py.expr(scrut)
    if (!isSimple(scrut)) { const tmp = `switch_value_${depth}`; pre.push(`${py.indent(depth)}${tmp} = ${x}`); x = tmp }
    const caseVals = (g: Group): string[] => g.values.map((v) => py.expr(v))
    const allVals = groups.flatMap(caseVals)
    const test = (g: Group): string => {
      const own = caseVals(g)
      const m = own.length === 1 ? `${x} == ${own[0]}` : own.length ? `${x} in ${tupleOf(own)}` : ''
      if (!g.isDefault) return m
      const dflt = allVals.length ? `${x} not in ${tupleOf(allVals.filter((v) => !own.includes(v)))}` : 'True'
      return allVals.length && allVals.length === own.length ? 'True' : dflt
    }
    if (groups.length === 0) return [...pre, `${py.indent(depth)}pass`]

    // ① 乾淨的形狀
    const defaultIdx = groups.findIndex((g) => g.isDefault)
    const ends = (g: Group): boolean => { const l = lastStmt(g.body); return isBreakNode(l) || isReturnNode(l) }
    const clean = (defaultIdx === -1 || defaultIdx === groups.length - 1)
      && groups.slice(0, -1).every(ends)
      && groups.every((g) => !hasOwnBreak(dropTrailingBreak(g.body)))
    if (clean) {
      const out = [...pre]
      groups.forEach((g, i) => {
        const body = py.block(dropTrailingBreak(g.body), depth + 1)
        if (g.isDefault) out.push(i === 0 ? `${py.indent(depth)}if True:` : `${py.indent(depth)}else:`, ...body)
        else out.push(`${py.indent(depth)}${i === 0 ? 'if' : 'elif'} ${test(g)}:`, ...body)
      })
      return out
    }

    // ② 照 C++ 的跳法
    if (groups.some((g) => hasOwnContinue(g.body))) return [py.keep(n, 'outside-subset', 'switch 有掉下去的段落，而裡面有 continue（寫成 while True 之後它跳的是那一圈）')]
    const hit = `switch_hit_${depth}`
    const out = [...pre, `${py.indent(depth)}${hit} = False`, `${py.indent(depth)}while True:`]
    groups.forEach((g, i) => {
      out.push(`${py.indent(depth + 1)}if ${hit} or ${test(g)}:`)
      if (i < groups.length - 1) out.push(`${py.indent(depth + 2)}${hit} = True`)
      out.push(...py.block(g.body, depth + 2))
    })
    out.push(`${py.indent(depth + 1)}break`)
    return out
  })
}
