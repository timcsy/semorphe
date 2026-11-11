/**
 * **Python 的 formalize：語義樹 → `python.ast` 的程式 JSON**（spec 195；`@cella-lang/python` 的 `python.syntax`）。
 *
 * ## 翻譯是誰定的
 *
 * Cella 寫好一張「semorphe 的 Python 元件 → python.ast」對照表（`packages/python/docs/components.json`），
 * 參考實作是 `tools/python/component_map_check.py` 的 `Expander`——檔頭逐字：「semorphe 照它寫 formalize 的轉換」。
 * 這支就是那個 `Expander` 的移植；**模板住在每顆元件自己的膠囊**（`src/components/python/<name>/formalize.json`，
 * 由 `tools/sync-python-formalize.py` 從對照表同步），這裡只有展開器、具名轉換與運算子表。
 * ⚠️ C 家族是每顆手寫 `formalize.ts`（第 389 刀）；Python 改成宣告式模板，理由是對照表已經有、而且被 140 個範例驗過——
 *    手寫 99 份會與它漂移。量它的是 `tests/unit/providers/formalize-python.test.ts`（同一批範例）。
 *
 * ## 兩個這裡和參考實作不同的地方
 *
 * - 參數的預設值是原始碼文字：參考實作把它當 Python 重新剖析；這裡只認字面量與名字，其餘照實標 unknown
 *   （對照表的備註本來就建議把它改成運算式的槽）。
 * - 模板查不到、運算子表查不到、`$unknown` → 不猜，列進 `unknown`（P6，`principles.md:160`）。
 */
import type { SemanticNode } from '../../../core/types'
import type { CellaJson } from '../../../core/formalize-contract'
import type { FormalizeResult, Unknown } from './index'
import TABLES from './python-tables.json'

type Tmpl = unknown
const MODULES = import.meta.glob('/src/components/python/*/formalize.json', { eager: true }) as Record<string, { template?: Tmpl; default?: { template: Tmpl } }>

const TEMPLATES = new Map<string, Tmpl>()
for (const [key, mod] of Object.entries(MODULES)) {
  const parts = key.split('/').filter(Boolean)
  const name = parts[parts.indexOf('python') + 1]
  const t = mod.template ?? mod.default?.template
  if (t !== undefined) TEMPLATES.set(`python:${name}`, t)
}

/** 根元件：模板是 `program` 的那一顆——由模板決定，不在這裡寫死身分（膠囊就近性）。 */
const ROOT = [...TEMPLATES].find(([, t]) => isObj(t) && t.k === 'program')?.[0]

/** 敘述角色的元件（其餘的放在敘述位置時包一層 `sExpr <id>/stmt`）——照參考實作的 `STATEMENT_ROLE`。 */
const STATEMENT_ROLE = new Set(['assert', 'assign_chain', 'break', 'class_def', 'comment', 'container_append', 'container_assign', 'container_erase',
  'container_erase_value', 'container_insert', 'container_sort_self', 'continue', 'exception_case', 'func_def', 'global', 'if', 'import',
  'import_from', 'loop_for', 'loop_while', 'member_assign', 'pass', 'print', 'program', 'raw_code', 'return', 'set_append', 'throw',
  'try_catch', 'var_assign', 'var_assign_compound', 'var_assign_sequence', 'with'])

const tables = TABLES as unknown as Record<string, Record<string, string>>

/** 翻不了：帶著節點與理由往外丟，由最外層收進 `unknown`。 */
class Miss extends Error {
  readonly nodeId: string
  readonly construct: string
  readonly reason: string
  constructor(nodeId: string, construct: string, reason: string) {
    super(reason)
    this.nodeId = nodeId
    this.construct = construct
    this.reason = reason
  }
}

const short = (cid: string): string => cid.slice(cid.indexOf(':') + 1)
const kids = (x: SemanticNode, s: string): SemanticNode[] => (x.slots?.[s] ?? []).filter(Boolean) as SemanticNode[]
const prop = (x: SemanticNode, p: string): string => String(x.properties?.[p] ?? '')

export function formalizePython(tree: SemanticNode): FormalizeResult {
  return run(tree, false)
}

/** 給測試用：一顆元件在（或不在）敘述位置上展開成什麼（同參考實作的 `Expander.node`）。 */
export function expandPython(x: SemanticNode, statement: boolean): FormalizeResult {
  return statement
    ? run({ id: '__root__', componentId: ROOT ?? '', properties: {}, slots: { body: [x] } } as SemanticNode, false)
    : run(x, true)
}

/** 在最外層的逗號切開（括號與引號裡的逗號不算）——參數預設值是原始碼文字，`(1, (2, 3), "a,b")` 要切成三項 */
function splitTopLevel(text: string): string[] {
  const out: string[] = []
  let depth = 0, quote: string | null = null, cur = ''
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quote) { cur += c; if (c === '\\') { cur += text[++i] ?? ''; continue } if (c === quote) quote = null; continue }
    if (c === '"' || c === "'") { quote = c; cur += c; continue }
    if (c === '(' || c === '[' || c === '{') depth++
    if (c === ')' || c === ']' || c === '}') depth--
    if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue }
    cur += c
  }
  out.push(cur.trim())
  return out.length === 1 && out[0] === '' ? [] : out
}

function run(tree: SemanticNode, bare: boolean): FormalizeResult {
  const unknown: Unknown[] = []
  const node = (x: SemanticNode, stmtPos = false): CellaJson => {
    const t = TEMPLATES.get(x.componentId)
    if (t === undefined) throw new Miss(x.id, x.componentId, '這顆元件還沒有對應到 python.ast')
    if (isObj(t) && t.$unknown) throw new Miss(x.id, x.componentId, '這顆元件的內容 Cella 讀不懂（原樣保留的程式碼）')
    // `$only`：這顆只能由父節點的某個轉換處理（例如具名引數只在 `$callArgs` 裡是 keyword）——
    //    出現在別的位置＝對照表沒涵蓋到的組合（`max(xs, key=…)` 的 `math_max` 用 `$slots`），照實標 unknown，不送出不合法的 JSON
    if (isObj(t) && t.$only) throw new Miss(x.id, x.componentId, `這顆只能出現在 ${String(t.$only)} 裡（對照表還沒涵蓋這個組合）`)
    const out = tmpl(t, x) as CellaJson
    if (stmtPos && !STATEMENT_ROLE.has(short(x.componentId))) return { k: 'sExpr', n: `${x.id}/stmt`, value: out }
    // 敘述角色的元件出現在**運算式位置**（`print(xs.sort())`——合法的 Python，印出 None）：模板外層是 `sExpr`，拆出裡面的運算式。
    // ⚠️ 不拆的話送出「運算式裡有一句敘述」，Cella 判 invalid（spec 208 刪直譯器之後 fuzz_2 露出來的；之前直譯器照跑）
    if (!stmtPos && isObj(out) && out.k === 'sExpr' && isObj(out.value)) return out.value as CellaJson
    return out
  }
  /** 一串敘述：每一句各自收 unknown（一句翻不了不拖垮整個身體——同 C 家族的做法，unknown 全部列出） */
  const stmts = (xs: SemanticNode[]): CellaJson[] => xs.flatMap((c) => {
    const t = TEMPLATES.get(c.componentId)
    if (isObj(t) && t.$drop) return []
    try { return [node(c, true)] } catch (e) { if (e instanceof Miss) { unknown.push({ nodeId: e.nodeId, construct: e.construct, reason: e.reason }); return [] } throw e }
  })
  const slot = (x: SemanticNode, s: string): CellaJson => {
    const cs = kids(x, s)
    return cs.length > 0 ? node(cs[0]) : { k: 'eHole', n: `${x.id}#${s}` }
  }
  const op = (table: string, x: SemanticNode, p: string): CellaJson => {
    const v = prop(x, p)
    const c = tables[table]?.[v]
    if (!c) throw new Miss(x.id, x.componentId, `運算子「${v}」還沒有對應`)
    return { k: c }
  }

  function tmpl(t: Tmpl, x: SemanticNode): unknown {
    if (typeof t === 'string') return t.startsWith('$id') ? x.id + t.slice(3) : t
    if (Array.isArray(t)) {
      const out: unknown[] = []
      for (const e of t) {
        if (isObj(e) && '$ifSlot' in e) { if (kids(x, String(e.$ifSlot)).length > 0) out.push(tmpl(e.then, x)) } else out.push(tmpl(e, x))
      }
      return out
    }
    if (!isObj(t)) return t
    if ('$slot' in t) return slot(x, String(t.$slot))
    if ('$opt' in t) { const cs = kids(x, String(t.$opt)); return cs.length > 0 ? node(cs[0]) : null }
    if ('$slots' in t) return [...kids(x, String(t.$slots)).map((c) => node(c)), ...(tmpl(t.$append ?? [], x) as unknown[])]
    if ('$prop' in t) return prop(x, String(t.$prop))
    if ('$propList' in t) return prop(x, String(t.$propList)).split(',').map((p) => p.trim()).filter(Boolean)
    if ('$ifProp' in t) return prop(x, String(t.$ifProp)).trim() ? tmpl(t.then, x) : null
    if ('$op' in t) return op(String(t.$op), x, String(t.of))
    if ('$case' in t) {
      const v = prop(x, String(t.$case))
      const cases = t.cases as Record<string, Tmpl>
      return tmpl(v in cases ? cases[v] : t.else, x)
    }
    if ('$stmts' in t) return stmts(kids(x, String(t.$stmts)))
    if ('$body' in t) { const b = stmts(kids(x, String(t.$body))); return b.length > 0 ? b : [{ k: 'sPass', n: `${x.id}/pass` }] }
    if ('$transform' in t) {
      const fn = TRANSFORMS[String(t.$transform)]
      if (!fn) throw new Miss(x.id, x.componentId, `轉換「${String(t.$transform)}」還沒有實作`)
      return fn(x, t)
    }
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(t)) {
      if (key === '$callArgs') { const [a, kw] = callArgs(kids(x, String(val))); out.args = a; out.keywords = kw } else out[key] = tmpl(val, x)
    }
    return out
  }

  // ── 具名轉換（對照表的 transforms；照參考實作 `Expander.t_*`）──
  const callArgs = (xs: SemanticNode[]): [CellaJson[], CellaJson[]] => {
    const args: CellaJson[] = []
    const kws: CellaJson[] = []
    for (const c of xs) {
      if (short(c.componentId) === 'func_call_named') kws.push({ k: 'keyword', arg: prop(c, 'name'), value: slot(c, 'value') })
      else if (short(c.componentId) === 'splat' && prop(c, 'kind') === 'dict') kws.push({ k: 'keyword', arg: null, value: slot(c, 'value') })
      else args.push(node(c))
    }
    return [args, kws]
  }
  const name = (n: string, id: string): CellaJson => ({ k: 'eName', n, id })
  const targetOf = (x: SemanticNode, namesSlot: string, fallbackProp?: string): CellaJson => {
    const ts = kids(x, namesSlot)
    if (ts.length === 0) return name(`${x.id}/target`, fallbackProp ? prop(x, fallbackProp) : '')
    if (ts.length === 1 && prop(ts[0], 'variadic') !== 'list') return name(`${x.id}/target`, prop(ts[0], 'name'))
    return {
      k: 'eTuple', n: `${x.id}/target`,
      elts: ts.map((p, i) => {
        const e = name(`${x.id}/target/${i}`, prop(p, 'name'))
        return prop(p, 'variadic') === 'list' ? { k: 'eStarred', n: `${x.id}/target/${i}/star`, value: e } : e
      }),
    }
  }
  const textTarget = (x: SemanticNode, p: string): CellaJson => {
    const names = prop(x, p).split(',').map((s) => s.trim())
    if (names.length === 1) return name(`${x.id}/target`, names[0])
    return { k: 'eTuple', n: `${x.id}/target`, elts: names.map((nm, i) => name(`${x.id}/target/${i}`, nm)) }
  }
  const clauses = (x: SemanticNode): CellaJson[] => {
    const out: CellaJson[] = []
    const outer = kids(x, 'outer')
    if (outer.length > 0) out.push(...clauses(outer[0]))
    const cond = kids(x, 'condition')
    // 名字以 `targets` 為準（推導式最裡面那一段，第 411 刀）；外層 `loop_iter` 仍只有 `obj`
    const target = kids(x, 'targets').length > 0 ? targetOf(x, 'targets', 'obj') : textTarget(x, 'obj')
    out.push({ k: 'comprehension', target, iter: slot(x, 'iterable'), ifs: cond.length > 0 ? [node(cond[0])] : [] })
    return out
  }
  const literalOf = (text: string, at: SemanticNode, n: string): CellaJson => {
    // 參數預設值（原始碼文字）：只認字面量與名字
    const s = text.trim()
    if (/^-?[\d.]/.test(s)) return numberNode(s, n, at)
    if (/^(['"]).*\1$/s.test(s)) return { k: 'eConstant', n, value: { k: 'cStr', s: pyUnescape(s.slice(1, -1), at) } }
    if (s === 'True' || s === 'False') return { k: 'eConstant', n, value: { k: 'cBool', b: s === 'True' } }
    if (s === 'None') return { k: 'eConstant', n, value: { k: 'cNone' } }
    if (/^[A-Za-z_]\w*$/.test(s)) return name(n, s)
    // 空的容器字面（`def f(x=[])`）：Python 最有名的陷阱之一——同一個串列在每次呼叫之間共用；交給 Cella 照實跑（spec 208：之前只有直譯器收）
    if (/^\{\s*\}$/.test(s)) return { k: 'eDict', n, keys: [], values: [] }
    // 由字面量組成的串列／元組（`coins=(25, 10, 5, 1)`、`x=[]`）：在最外層的逗號切開，每一項再交給這一支
    const wrap = /^\[([\s\S]*)\]$/.exec(s) ?? /^\(([\s\S]*)\)$/.exec(s)
    if (wrap) {
      const items = splitTopLevel(wrap[1]).filter((x, i, all) => x !== '' || i < all.length - 1)
      const elts = items.map((it, i) => literalOf(it, at, `${n}/${i}`))
      return s.startsWith('[') ? { k: 'eList', n, elts } : { k: 'eTuple', n, elts }
    }
    throw new Miss(at.id, at.componentId, `預設值「${s}」是一段運算式，還不能翻（只認字面量、名字，以及由它們組成的串列／元組）`)
  }
  const argumentsOf = (ps: SemanticNode[]): CellaJson => {
    const args: CellaJson[] = []
    const defaults: CellaJson[] = []
    const ko: CellaJson[] = []
    const kd: (CellaJson | null)[] = []
    let va: CellaJson | null = null
    for (const p of ps) {
      const a = { k: 'arg', n: p.id, name: prop(p, 'name') }
      const d = prop(p, 'default')
      const dflt = d ? literalOf(d, p, `${p.id}/default`) : null
      if (prop(p, 'variadic') === 'list') va = a
      else if (va !== null) { ko.push(a); kd.push(dflt) } else { args.push(a); if (dflt !== null) defaults.push(dflt) }
    }
    return { k: 'arguments', posonlyargs: [], args, vararg: va, kwonlyargs: ko, kwDefaults: kd, kwarg: null, defaults }
  }
  const excType = (x: SemanticNode, text: string): CellaJson | null => {
    const t = text.trim()
    if (!t) return null
    const names = t.replace(/^\(|\)$/g, '').split(',').map((s) => s.trim()).filter(Boolean)
    if (t.includes(',')) return { k: 'eTuple', n: `${x.id}/type`, elts: names.map((nm, i) => name(`${x.id}/type/${i}`, nm)) }
    return name(`${x.id}/type`, names[0])
  }

  /**
   * 自我說明（`{x=}`）要印的運算式原文。只認名字與屬性鏈——lift 只收這兩種（見 `string_make/lift-strategy.ts`），
   * 而積木上換成別的運算式時，Python 會印它的原文、我們算不出一字不差的那一份 ⟹ 照實標 unknown，不猜。
   */
  function sourceTextOf(v: SemanticNode | undefined, owner: SemanticNode): string {
    if (v && short(v.componentId) === 'var_ref') return prop(v, 'name')
    if (v && short(v.componentId) === 'member_at') return `${sourceTextOf(kids(v, 'obj')[0], owner)}.${prop(v, 'member')}`
    throw new Miss((v ?? owner).id, (v ?? owner).componentId, '自我說明（{x=}）只認名字與屬性鏈：其他運算式的原文算不出一字不差的那一份')
  }

  const TRANSFORMS: Record<string, (x: SemanticNode, t: Record<string, unknown>) => unknown> = {
    literalString: (x) => pyUnescape(prop(x, 'value'), x),
    number: (x) => numberNode(prop(x, 'value'), x.id, x),
    dictItems: (x) => {
      const keys: (CellaJson | null)[] = []
      const values: CellaJson[] = []
      for (const p of kids(x, 'pairs')) {
        if (short(p.componentId) === 'pair_make') { keys.push(slot(p, 'key')); values.push(slot(p, 'value')) } else { keys.push(null); values.push(slot(p, 'value')) }
      }
      return { k: 'eDict', n: x.id, keys, values }
    },
    targets: (x, t) => targetOf(x, String(t.slot)),
    forTarget: (x) => (kids(x, 'targets').length > 0 ? targetOf(x, 'targets', 'obj') : textTarget(x, 'obj')),
    comprehension: (x) => {
      const kind = ({ '': 'eListComp', set: 'eSetComp', generator: 'eGeneratorExp' } as Record<string, string>)[prop(x, 'wrap')]
      if (!kind) throw new Miss(x.id, x.componentId, `推導式的包法「${prop(x, 'wrap')}」還沒有對應`)
      return { k: kind, n: x.id, elt: slot(x, 'expression'), generators: clauses(x) }
    },
    dictComprehension: (x) => {
      const cond = kids(x, 'condition')
      const g = { k: 'comprehension', target: targetOf(x, 'targets'), iter: slot(x, 'iterable'), ifs: cond.length > 0 ? [node(cond[0])] : [] }
      return { k: 'eDictComp', n: x.id, key: slot(x, 'key'), value: slot(x, 'value'), generators: [g] }
    },
    fstring: (x) => {
      const vals: Record<string, any>[] = []
      for (const p of kids(x, 'parts')) {
        if (short(p.componentId) === 'literal_string') {
          const text = pyUnescape(prop(p, 'value'), p)
          const last = vals[vals.length - 1]
          if (last && last.k === 'eConstant') last.value.s += text
          else vals.push({ k: 'eConstant', n: p.id, value: { k: 'cStr', s: text } })
        } else {
          const fmt = prop(p, 'format')
          const spec = fmt ? { k: 'eJoinedStr', n: `${p.id}/spec`, values: [{ k: 'eConstant', n: `${p.id}/spec/0`, value: { k: 'cStr', s: fmt } }] } : null
          // 轉換照 CPython AST 的寫法：沒有是 -1，其餘是那個字母的字元碼（`!r` → 114）
          const conv = prop(p, 'conversion')
          // 自我說明 `{x=}`：CPython 的 AST 本來就把它拆成「原文＋等號」一段字面、接一個插值，
          // 而沒寫轉換也沒寫格式時，那個插值預設是 `!r`（有格式時預設不轉換）
          const selfDoc = prop(p, 'selfDoc')
          if (selfDoc) {
            const text = sourceTextOf(kids(p, 'value')[0], p) + selfDoc
            const last = vals[vals.length - 1]
            if (last && last.k === 'eConstant') last.value.s += text
            else vals.push({ k: 'eConstant', n: `${p.id}/doc`, value: { k: 'cStr', s: text } })
          }
          const code = conv ? conv.charCodeAt(0) : selfDoc && !fmt ? 114 : -1
          vals.push({ k: 'eFormattedValue', n: p.id, value: slot(p, 'value'), conversion: code, formatSpec: spec })
        }
      }
      return { k: 'eJoinedStr', n: x.id, values: vals }
    },
    call: (x) => {
      const parts = prop(x, 'name').split('.')
      let f: CellaJson = name(`${x.id}/func`, parts[0])
      parts.slice(1).forEach((a, i) => { f = { k: 'eAttribute', n: `${x.id}/func/${i}`, value: f, attr: a } })
      const [args, keywords] = callArgs(kids(x, 'args'))
      return { k: 'eCall', n: x.id, func: f, args, keywords }
    },
    params: (x, t) => argumentsOf(kids(x, String(t.slot))),
    lambda: (x) => ({ k: 'eLambda', n: x.id, args: argumentsOf(kids(x, 'params')), body: slot(x, 'body') }),
    ifChain: (x) => {
      const section = (xs: SemanticNode[]): CellaJson[] => { const b = stmts(xs); return b.length > 0 ? b : [{ k: 'sPass', n: `${x.id}/pass` }] }
      let orelse = stmts(kids(x, 'else_body'))
      const conds = kids(x, 'elif_condition')
      const bodies = kids(x, 'elif_body')
      for (let i = conds.length - 1; i >= 0; i--) {
        const b = bodies[i]
        const inner = b ? (b.componentId.endsWith('_compound') ? kids(b, 'body') : [b]) : []
        orelse = [{ k: 'sIf', n: `${x.id}/elif${i}`, test: node(conds[i]), body: section(inner), orelse }]
      }
      return { k: 'sIf', n: x.id, test: slot(x, 'condition'), body: section(kids(x, 'body')), orelse }
    },
    handlers: (x, t) => kids(x, String(t.slot)).map((h) => {
      const exc = prop(h, 'exception')
      const alias = exc ? prop(h, 'alias').trim() : ''
      const body = stmts(kids(h, 'body'))
      return { k: 'exceptHandler', n: h.id, type: excType(h, exc), name: alias || null, body: body.length > 0 ? body : [{ k: 'sPass', n: `${h.id}/pass` }] }
    }),
    raise: (x) => {
      let e: CellaJson = name(`${x.id}/exc`, prop(x, 'exception') || 'ValueError')
      const vs = kids(x, 'value')
      if (vs.length > 0) e = { k: 'eCall', n: `${x.id}/call`, func: e, args: [node(vs[0])], keywords: [] }
      return { k: 'sRaise', n: x.id, exc: e, cause: null }
    },
    aliases: (x, t) => prop(x, String(t.prop)).split(',').map((part) => {
      const bits = part.split(' as ')
      return { k: 'alias', name: bits[0].trim(), asname: bits.length > 1 ? bits[1].trim() : null }
    }),
    classDef: (x) => {
      const base = prop(x, 'base').trim()
      const body = stmts([...kids(x, 'fields'), ...kids(x, 'methods')])
      return { k: 'sClassDef', n: x.id, name: prop(x, 'name'), bases: base ? [name(`${x.id}/base`, base)] : [], keywords: [], body: body.length > 0 ? body : [{ k: 'sPass', n: `${x.id}/pass` }], decoratorList: [] }
    },
  }

  let program: CellaJson
  try {
    program = bare || tree.componentId === ROOT ? node(tree) : { k: 'program', n: tree.id, body: stmts([tree]) }
  } catch (e) {
    if (!(e instanceof Miss)) throw e
    unknown.push({ nodeId: e.nodeId, construct: e.construct, reason: e.reason })
    return { program: null, unknown }
  }
  return unknown.length > 0 ? { program: null, unknown } : { program, unknown: [] }
}

function isObj(v: unknown): v is Record<string, any> { return typeof v === 'object' && v !== null && !Array.isArray(v) }

/** Python 的數字字面量 → `eConstant`（整數 `cInt` 十進位文字；其他 `cFloat`，Python `repr` 的文字）；負號是 `eUnaryOp`。 */
function numberNode(raw: string, id: string, at: SemanticNode): CellaJson {
  const text = raw.trim()
  const neg = text.startsWith('-')
  const body = text.replace(/^-\s*/, '').replace(/_/g, '')
  let c: CellaJson
  if (/^0[xX][0-9a-fA-F]+$/.test(body) || /^0[oO][0-7]+$/.test(body) || /^0[bB][01]+$/.test(body) || /^\d+$/.test(body)) {
    c = { k: 'cInt', text: BigInt(/^\d+$/.test(body) ? body.replace(/^0+(?=\d)/, '') : body.toLowerCase()).toString() }
  } else if (/^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(body)) {
    c = { k: 'cFloat', text: pyFloatRepr(Number(body)) }
  } else {
    throw new Miss(at.id, at.componentId, `數字「${text}」讀不懂（複數與其他寫法還沒有對應）`)
  }
  if (neg) return { k: 'eUnaryOp', n: id, op: { k: 'opUSub' }, operand: { k: 'eConstant', n: `${id}/abs`, value: c } }
  return { k: 'eConstant', n: id, value: c }
}

/** Python 的 `repr(float)`：最短的往返文字；1e-4 ≤ |x| < 1e16 用小數（整數也帶 `.0`），其他用科學記號（`1e+16`、`1.5e-05`）。 */
export function pyFloatRepr(x: number): string {
  if (Number.isNaN(x)) return 'nan'
  if (!Number.isFinite(x)) return x > 0 ? 'inf' : '-inf'
  if (x === 0) return Object.is(x, -0) ? '-0.0' : '0.0'
  const [mant, expStr] = x.toExponential().split('e')
  const exp = Number(expStr)
  const sign = mant.startsWith('-') ? '-' : ''
  const digits = mant.replace('-', '').replace('.', '')
  if (exp >= -4 && exp < 16) {
    let s: string
    if (exp >= 0) {
      const intPart = digits.slice(0, exp + 1).padEnd(exp + 1, '0')
      const frac = digits.slice(exp + 1)
      s = `${intPart}.${frac || '0'}`
    } else {
      s = `0.${'0'.repeat(-exp - 1)}${digits}`
    }
    return sign + s
  }
  const m = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits
  return `${sign}${m}e${exp < 0 ? '-' : '+'}${String(Math.abs(exp)).padStart(2, '0')}`
}

/** Python 字串字面量的內容（原始碼的寫法）→ 值：照 Python 的跳脫規則還原；不認得的跳脫照原樣留著（Python 也是）。 */
export function pyUnescape(s: string, at: SemanticNode): string {
  const simple: Record<string, string> = { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"', a: '\x07', b: '\b', f: '\f', v: '\v', '\n': '' }
  return s.replace(/\\(N\{[^}]*\}|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|[0-7]{1,3}|[\s\S])/g, (m, e: string) => {
    if (e in simple) return simple[e]
    if (/^[0-7]+$/.test(e)) return String.fromCodePoint(parseInt(e, 8))
    if (e[0] === 'x' || e[0] === 'u' || e[0] === 'U') return String.fromCodePoint(parseInt(e.slice(1), 16))
    if (e[0] === 'N' && e[1] === '{') throw new Miss(at.id, at.componentId, `具名的跳脫「${m}」還沒有對應`)
    return m
  })
}
