/**
 * **formalize：語義樹 → Cella 的程式 JSON**（spec 180，重構階段 4；盟約第 2 條的防腐層）。
 *
 * 格式是 `@cella-lang/cfamily` 的 `cfamily.syntax`（`deriving Json`：`{"k": 建構子, <參數名>: 值}`；
 * Option 是值或 null；列舉是 `{"k": "tInt"}`）。每個建構子的 `n` 是語義節點的 id——Cella 的判決、
 * 除錯器的停點、型別查詢的洞都用它指回積木。展開出來、學生看不到的內部節點用 `<id>/<角色>`。
 *
 * 🔴 **翻不了的不送、也不猜**：回 `unknown`，說出哪一顆節點、哪一種元件（P6；四之十「Cella 還沒做的由 semorphe 判斷」）。
 * 這一版是第一批的**最小子集**；其餘元件逐批加，對照表的覆蓋由護欄盯。
 */
import type { SemanticNode } from '../../../core/types'
import { resolveScopes } from './scope'

/** Cella 程式 JSON 的一個節點。 */
export type CellaJson = { k: string; [field: string]: unknown }

export interface Unknown { nodeId: string; construct: string; reason: string }
export type FormalizeResult = { program: CellaJson; unknown: [] } | { program: null; unknown: Unknown[] }

const k = (name: string, fields: Record<string, unknown> = {}): CellaJson => ({ k: name, ...fields })

const BIN: Record<string, string> = {
  '+': 'opAdd', '-': 'opSub', '*': 'opMul', '/': 'opDiv', '%': 'opRem', '<<': 'opShl', '>>': 'opShr',
  '<': 'opLt', '<=': 'opLe', '>': 'opGt', '>=': 'opGe', '==': 'opEq', '!=': 'opNe',
  '&': 'opBitAnd', '|': 'opBitOr', '^': 'opBitXor', '&&': 'opAnd', '||': 'opOr',
}

const SCALAR: Record<string, string> = {
  int: 'tInt', long: 'tLong', 'long long': 'tLongLong', unsigned: 'tUnsigned', 'unsigned int': 'tUnsigned',
  short: 'tShort', 'unsigned short': 'tUShort', 'unsigned long': 'tULong', 'unsigned long long': 'tULongLong',
  double: 'tDouble', float: 'tFloat', char: 'tChar', 'signed char': 'tSChar', 'unsigned char': 'tUChar',
  bool: 'tBool', string: 'tString', 'std::string': 'tString',
}

/** C 的跳脫序列 → 真正的字元（語義樹存的是寫法，Cella 要的是值）。 */
function unescapeC(s: string): string {
  const map: Record<string, string> = { n: '\n', t: '\t', r: '\r', '0': '\0', '\\': '\\', '"': '"', "'": "'", a: '\x07', b: '\b', f: '\f', v: '\v' }
  return s.replace(/\\(x[0-9a-fA-F]+|[0-7]{1,3}|.)/g, (m, e: string) => {
    if (e[0] === 'x') return String.fromCharCode(parseInt(e.slice(1), 16))
    if (/^[0-7]+$/.test(e) && e !== '0') return String.fromCharCode(parseInt(e, 8))
    return map[e] ?? m
  })
}

export function formalize(tree: SemanticNode, options: { board?: string } = {}): FormalizeResult {
  const { declOf } = resolveScopes(tree)
  const unknown: Unknown[] = []
  const miss = (n: SemanticNode, reason: string): CellaJson => {
    unknown.push({ nodeId: n.id, construct: n.componentId, reason })
    return k('eHole', { n: n.id })
  }

  function type(t: unknown, at: SemanticNode): CellaJson | null {
    const s = String(t ?? '').trim()
    if (s === '' ) { miss(at, '沒有型別'); return null }
    if (s.startsWith('const ')) { const inner = type(s.slice(6), at); return inner && k('tConst', { t: inner }) }
    if (s.endsWith('&')) { const inner = type(s.slice(0, -1), at); return inner && k('tRef', { t: inner }) }
    if (s.endsWith('*')) { const inner = type(s.slice(0, -1), at); return inner && k('tPtr', { t: inner }) }
    const sc = SCALAR[s]
    if (sc) return k(sc)
    const vec = /^(?:std::)?vector\s*<\s*(.+)\s*>$/.exec(s)
    if (vec) { const inner = type(vec[1], at); return inner && k('tVector', { t: inner }) }
    const st = /^struct\s+([A-Za-z_]\w*)$/.exec(s)
    if (st) return k('tStruct', { name: st[1] })
    miss(at, `型別「${s}」還沒有對應`)
    return null
  }

  const one = (n: SemanticNode, slot: string): SemanticNode | undefined => n.slots?.[slot]?.[0]
  const exprOf = (n: SemanticNode, slot: string): CellaJson => {
    const c = one(n, slot)
    return c ? expr(c) : k('eHole', { n: `${n.id}#${slot}` })
  }

  function expr(n: SemanticNode): CellaJson {
    const p = n.properties ?? {}
    switch (n.componentId) {
      case 'cpp:literal_number': {
        const v = String(p.value ?? '')
        if (/^[0-9]+$/.test(v)) return k('eNum', { n: n.id, v: Number(v) })
        // 負數字面：Cella 的 eNum 是整數值，負號照 C++ 的文法是一元運算子
        if (/^-[0-9]+$/.test(v)) return k('eUn', { n: n.id, op: k('opNeg'), a: k('eNum', { n: `${n.id}/abs`, v: Number(v.slice(1)) }) })
        // 帶後綴（`1LL`）：Cella 的 eNum 沒有後綴，型別要靠轉型保住——`1000000LL * 1000000LL` 不能變成 int 的溢位
        const suf = /^([0-9]+)(ll|LL|l|L|u|U|ul|UL|ull|ULL|lu|LU|llu|LLU)$/.exec(v)
        if (suf) {
          const t = ({ ll: 'tLongLong', l: 'tLong', u: 'tUnsigned', ul: 'tULong', lu: 'tULong', ull: 'tULongLong', llu: 'tULongLong' } as Record<string, string>)[suf[2].toLowerCase()]
          return k('eCast', { n: n.id, t: k(t), a: k('eNum', { n: `${n.id}/value`, v: Number(suf[1]) }) })
        }
        if (/^[0-9]*\.[0-9]*([eE][-+]?[0-9]+)?[fF]?$|^[0-9]+[eE][-+]?[0-9]+[fF]?$/.test(v)) {
          return k('eFloat', { n: n.id, text: v.replace(/[fF]$/, ''), single: /[fF]$/.test(v) })
        }
        return miss(n, `數字字面「${v}」還沒有對應`)
      }
      case 'cpp:literal_string': return k('eStr', { n: n.id, s: unescapeC(String(p.value ?? '')) })
      case 'cpp:literal_char': {
        const c = unescapeC(String(p.char ?? ''))
        return c.length === 1 ? k('eChar', { n: n.id, c: c.charCodeAt(0) }) : miss(n, '字元字面不是單一字元')
      }
      case 'cpp:builtin_constant': {
        const v = String(p.value ?? '')
        if (v === 'true' || v === 'false') return k('eBool', { n: n.id, b: v === 'true' })
        return k('eConst', { n: n.id, name: v })
      }
      case 'cpp:var_ref': {
        const x = declOf.get(n.id)
        return x ? k('eVar', { n: n.id, x }) : miss(n, `名字「${String(p.name)}」指不到宣告`)
      }
      case 'cpp:arithmetic': case 'cpp:compare': case 'cpp:logic': {
        const op = BIN[String(p.operator ?? '')]
        if (!op) return miss(n, `運算子「${String(p.operator)}」還沒有對應`)
        return k('eBin', { n: n.id, op: k(op), a: exprOf(n, 'left'), b: exprOf(n, 'right') })
      }
      case 'cpp:logic_not': return k('eUn', { n: n.id, op: k('opNot'), a: exprOf(n, 'operand') })
      case 'cpp:negate': return k('eUn', { n: n.id, op: k('opNeg'), a: exprOf(n, 'value') })
      case 'cpp:var_assign': return k('eAssign', { n: n.id, lhs: exprOf(n, 'target'), op: null, e: exprOf(n, 'value') })
      case 'cpp:var_assign_compound': {
        const op = BIN[String(p.operator ?? '').replace(/=$/, '')]
        if (!op) return miss(n, `複合賦值「${String(p.operator)}」還沒有對應`)
        return k('eAssign', { n: n.id, lhs: exprOf(n, 'target'), op: k(op), e: exprOf(n, 'value') })
      }
      case 'cpp:increment':
        return k('eIncDec', { n: n.id, lhs: exprOf(n, 'target'), inc: p.operator === '++', post: p.position === 'postfix' })
      case 'cpp:func_call':
        return k('eCall', { n: n.id, f: String(p.name ?? ''), args: (n.slots?.args ?? []).map(expr) })
      case 'cpp:endl': return k('eEndl', { n: n.id })
      case 'cpp:array_at': return k('eIndex', { n: n.id, a: exprOf(n, 'obj'), i: exprOf(n, 'index') })
      case 'cpp:struct_at_ptr': return k('eArrow', { n: n.id, a: exprOf(n, 'obj'), f: String(p.member ?? '') })
      case 'cpp:container_iter': {
        const which = String(p.which ?? 'begin')
        return p.call === 'free'
          ? k('eCall', { n: n.id, f: which, args: [exprOf(n, 'obj')] })
          : k('eMCall', { n: n.id, obj: exprOf(n, 'obj'), arrow: false, f: which, args: [] })
      }
      case 'cpp:array_2d_at':
        return k('eIndex', { n: n.id, a: k('eIndex', { n: `${n.id}/row`, a: exprOf(n, 'obj'), i: exprOf(n, 'row') }), i: exprOf(n, 'col') })
      // 函式庫的函式：Cella 依名字解析（`using namespace std;` 下不帶前綴的也對到內建，四之十）；沒有模型的由支援清單擋
      case 'cpp:math_unary': return k('eCall', { n: n.id, f: String(p.func ?? ''), args: [exprOf(n, 'value')] })
      case 'cpp:math_pow': return k('eCall', { n: n.id, f: 'pow', args: [exprOf(n, 'base'), exprOf(n, 'exponent')] })
      case 'cpp:math_max': return k('eCall', { n: n.id, f: 'max', args: [exprOf(n, 'a'), exprOf(n, 'b')] })
      case 'cpp:random_seed': return k('eCall', { n: n.id, f: 'srand', args: [exprOf(n, 'seed')] })
      case 'cpp:random_next': return k('eCall', { n: n.id, f: 'rand', args: [] })
      case 'cpp:free': return k('eCall', { n: n.id, f: 'free', args: [exprOf(n, 'ptr')] })
      case 'cpp:range_sort': {
        const args = [exprOf(n, 'begin'), exprOf(n, 'end'), ...(one(n, 'comparator') ? [exprOf(n, 'comparator')] : [])]
        return k('eCall', { n: n.id, f: 'sort', args })
      }
      case 'cpp:address_of': return k('eAddr', { n: n.id, a: exprOf(n, 'var') })
      case 'cpp:pointer_deref': return k('eDeref', { n: n.id, a: exprOf(n, 'ptr') })
      case 'cpp:string_size': return k('eMCall', { n: n.id, obj: exprOf(n, 'obj'), arrow: false, f: 'size', args: [] })
      case 'cpp:container_empty': return k('eMCall', { n: n.id, obj: exprOf(n, 'obj'), arrow: false, f: 'empty', args: [] })
      case 'cpp:container_pop': return k('eMCall', { n: n.id, obj: exprOf(n, 'obj'), arrow: false, f: 'pop', args: [] })
      case 'cpp:container_push':
        return k('eMCall', { n: n.id, obj: exprOf(n, 'obj'), arrow: false, f: 'push', args: (n.slots?.value ?? []).map(expr) })
      case 'cpp:set_insert':
        return k('eMCall', { n: n.id, obj: exprOf(n, 'obj'), arrow: false, f: String(p.method ?? 'insert'), args: (n.slots?.value ?? []).map(expr) })
      case 'cpp:string_at': {
        const x = declOf.get(`${n.id}#obj`)
        if (!x) return miss(n, `字串名「${String(p.obj)}」指不到宣告（或不是單一名字）`)
        return k('eIndex', { n: n.id, a: k('eVar', { n: `${n.id}/obj`, x }), i: exprOf(n, 'index') })
      }
      case 'cpp:pointer_assign': {
        const x = declOf.get(`${n.id}#obj`)
        if (!x) return miss(n, `指標名「${String(p.obj)}」指不到宣告（或不是單一名字）`)
        return k('eAssign', { n: n.id, lhs: k('eDeref', { n: `${n.id}/lhs`, a: k('eVar', { n: `${n.id}/obj`, x }) }), op: null, e: exprOf(n, 'value') })
      }
      case 'cpp:struct_at_member': return k('eMember', { n: n.id, a: exprOf(n, 'obj'), f: String(p.member ?? '') })
      case 'cpp:vector_size': return k('eMCall', { n: n.id, obj: exprOf(n, 'obj'), arrow: false, f: 'size', args: [] })
      case 'cpp:container_append':
        return k('eMCall', { n: n.id, obj: exprOf(n, 'obj'), arrow: false, f: String(p.method ?? 'push_back'), args: (n.slots?.value ?? []).map(expr) })
      case 'cpp:array_assign': {
        const x = declOf.get(`${n.id}#obj`)
        if (!x) return miss(n, `陣列名「${String(p.obj)}」指不到宣告（或不是單一名字）`)
        return k('eAssign', { n: n.id, lhs: k('eIndex', { n: `${n.id}/lhs`, a: k('eVar', { n: `${n.id}/obj`, x }), i: exprOf(n, 'index') }), op: null, e: exprOf(n, 'value') })
      }
      default:
        return miss(n, '這顆元件還沒有對應到 Cella 的建構子')
    }
  }

  const block = (n: SemanticNode, slot: string): CellaJson =>
    k('sBlock', { n: `${n.id}/${slot}`, body: (n.slots?.[slot] ?? []).flatMap(stmt) })

  /** 大括號初值串列。 */
  /** 大括號初值串列——巢狀的（`{{1,2},{3,4}}`）是 `cpp:initializer_list`，遞迴成 iL。 */
  const initOf = (c: SemanticNode): CellaJson =>
    c.componentId === 'cpp:initializer_list'
      ? k('iL', { n: c.id, xs: (c.slots?.values ?? []).map(initOf) })
      : k('iE', { e: expr(c) })
  const braceList = (n: SemanticNode, slot: string): CellaJson =>
    k('iL', { n: `${n.id}/${slot}`, xs: (n.slots?.[slot] ?? []).map(initOf) })

  function containerDecl(n: SemanticNode, global: boolean): CellaJson[] {
    const elem = type(n.properties?.type, n)
    if (!elem) return []
    const name = String(n.properties?.name ?? '')
    let t: CellaJson
    let init: CellaJson | null = null
    let args: CellaJson[] | null = null
    if (n.componentId === 'cpp:vector_declare') {
      t = k('tVector', { t: elem })
      if ((n.slots?.values ?? []).length > 0) init = braceList(n, 'values')
      else if (one(n, 'source')) init = k('iE', { e: expr(one(n, 'source')!) })
      else if (one(n, 'size')) args = [exprOf(n, 'size'), ...(one(n, 'fill') ? [exprOf(n, 'fill')] : [])]
    } else if (n.componentId === 'cpp:array_2d_declare') {
      const lit = (slot: string): number | null => {
        const c = one(n, slot)
        return c?.componentId === 'cpp:literal_number' && /^[0-9]+$/.test(String(c.properties?.value)) ? Number(c.properties?.value) : null
      }
      const rows = lit('rows'), cols = lit('cols')
      if (rows === null || cols === null) { miss(n, '二維陣列的長度不是整數字面'); return [] }
      t = k('tArr', { t: k('tArr', { t: elem, n: cols }), n: rows })
      if ((n.slots?.values ?? []).length > 0) init = braceList(n, 'values')
    } else {
      const size = one(n, 'size')
      const len = size?.componentId === 'cpp:literal_number' && /^[0-9]+$/.test(String(size.properties?.value)) ? Number(size.properties?.value) : null
      if (len === null) { miss(n, '陣列長度不是整數字面（VLA 或常數名字還沒有對應）'); return [] }
      t = k('tArr', { t: elem, n: len })
      if ((n.slots?.values ?? []).length > 0) init = braceList(n, 'values')
    }
    if (args) {
      if (global) return [k('iVarC', { n: n.id, x: n.id, name, t, args })]
      return [k('sDeclC', { n: n.id, x: n.id, name, t, args })]
    }
    return [global ? k('iVar', { n: n.id, x: n.id, name, t, init }) : k('sDecl', { n: n.id, x: n.id, name, t, init })]
  }

  function decl(n: SemanticNode, global: boolean): CellaJson[] {
    if (['cpp:vector_declare', 'cpp:array_declare', 'cpp:array_2d_declare'].includes(n.componentId)) return containerDecl(n, global)
    if (n.componentId === 'cpp:pointer_declare' || n.componentId === 'cpp:string_declare') {
      const base = n.componentId === 'cpp:string_declare' ? k('tString') : type(n.properties?.type, n)
      if (!base) return []
      const t = n.componentId === 'cpp:pointer_declare' ? k('tPtr', { t: base }) : base
      const initNode = one(n, 'initializer')
      const init = initNode ? k('iE', { e: expr(initNode) }) : null
      const name = String(n.properties?.name ?? '')
      return [global ? k('iVar', { n: n.id, x: n.id, name, t, init }) : k('sDecl', { n: n.id, x: n.id, name, t, init })]
    }
    const kids = n.slots?.declarators
    if (kids && kids.length > 0) return kids.flatMap((d) => decl(d, global))
    const t = type(n.properties?.type, n)
    if (!t) return []
    const initNode = one(n, 'initializer')
    const init = initNode ? k('iE', { e: expr(initNode) }) : null
    const name = String(n.properties?.name ?? '')
    return [global
      ? k('iVar', { n: n.id, x: n.id, name, t, init })
      : k('sDecl', { n: n.id, x: n.id, name, t, init })]
  }

  function stmt(n: SemanticNode): CellaJson[] {
    const p = n.properties ?? {}
    switch (n.componentId) {
      case 'cpp:var_declare': case 'cpp:vector_declare': case 'cpp:array_declare':
      case 'cpp:pointer_declare': case 'cpp:string_declare': return decl(n, false)
      case 'cpp:array_2d_declare': return decl(n, false)
      case 'cpp:input_formatted':
        return [k('sScanf', { n: n.id, fmt: unescapeC(String(p.format ?? '')), args: (n.slots?.args ?? []).map(expr) })]
      case 'cpp:loop_for': {
        const init = (n.slots?.init ?? []).flatMap(stmt)
        if (init.length > 1) { miss(n, 'for 的 init 有多個宣告還沒有對應'); return [k('sHole', { n: n.id })] }
        const c = one(n, 'cond'), st = one(n, 'update')
        return [k('sFor', { n: n.id, init: init[0] ?? null, c: c ? expr(c) : null, step: st ? expr(st) : null, body: block(n, 'body') })]
      }
      case 'cpp:print_formatted':
        return [k('sPrintf', { n: n.id, fmt: unescapeC(String(p.format ?? '')), args: (n.slots?.args ?? []).map(expr) })]
      case 'cpp:break': return [k('sBreak', { n: n.id })]
      case 'cpp:continue': return [k('sContinue', { n: n.id })]
      case 'cpp:loop_range': {
        if ((n.slots?.targets ?? []).length > 0) { miss(n, '結構化繫結的 range-for 還沒有對應'); return [k('sHole', { n: n.id })] }
        const vt = String(p.var_type ?? '')
        const byRef = vt.endsWith('&')
        const t = type(byRef ? vt.slice(0, -1).trim() : vt, n)
        if (!t) return [k('sHole', { n: n.id })]
        return [k('sForRange', { n: n.id, x: n.id, name: String(p.var_name ?? ''), t, byRef, range: exprOf(n, 'iterable'), body: block(n, 'body') })]
      }
      case 'cpp:print':
        return [k('sCout', { n: n.id, items: (n.slots?.values ?? []).map(expr) })]
      case 'cpp:input':
        return [k('sExpr', { n: `${n.id}/stmt`, e: k('eCin', { n: n.id, targets: (n.slots?.values ?? []).map(expr) }) })]
      case 'cpp:return': {
        const v = one(n, 'value')
        return [k('sReturn', { n: n.id, e: v ? expr(v) : null })]
      }
      case 'cpp:if':
        return [k('sIf', { n: n.id, c: exprOf(n, 'condition'), t: block(n, 'then_body'), e: block(n, 'else_body') })]
      case 'cpp:loop_while':
        return [k('sWhile', { n: n.id, c: exprOf(n, 'condition'), body: block(n, 'body') })]
      case 'cpp:loop_count': {
        // 計數迴圈是比語法高一層的元件：展開成 for，迴圈變數以這顆節點為宣告（作用域走訪也是這樣認的）
        const name = String(p.var_name ?? 'i')
        const v = (role: string): CellaJson => k('eVar', { n: `${n.id}/${role}`, x: n.id })
        return [k('sFor', {
          n: n.id,
          init: k('sDecl', { n: `${n.id}/init`, x: n.id, name, t: k('tInt'), init: k('iE', { e: exprOf(n, 'from') }) }),
          c: k('eBin', { n: `${n.id}/cond`, op: k(p.inclusive === 'TRUE' ? 'opLe' : 'opLt'), a: v('cond-var'), b: exprOf(n, 'to') }),
          step: k('eIncDec', { n: `${n.id}/step`, lhs: v('step-var'), inc: true, post: true }),
          body: block(n, 'body'),
        })]
      }
      case 'cpp:block': return [block(n, 'body')]
      case 'cpp:var_assign': case 'cpp:var_assign_compound': case 'cpp:increment': case 'cpp:func_call':
      case 'cpp:container_append': case 'cpp:array_assign': case 'cpp:container_push': case 'cpp:container_pop':
      case 'cpp:set_insert': case 'cpp:pointer_assign': case 'cpp:range_sort': case 'cpp:random_seed': case 'cpp:free':
        return [k('sExpr', { n: `${n.id}/stmt`, e: expr(n) })]
      default:
        miss(n, '這顆敘述元件還沒有對應到 Cella 的建構子')
        return [k('sHole', { n: n.id })]
    }
  }

  function item(n: SemanticNode): CellaJson[] {
    const p = n.properties ?? {}
    switch (n.componentId) {
      case 'cpp:include': return [k('iInclude', { n: n.id, header: String(p.header ?? '') })]
      case 'cpp:struct_declare': {
        const fields: CellaJson[] = []
        for (const m of n.slots?.members ?? []) {
          const t = type(m.properties?.type, m)
          if (t) fields.push(k('fld', { name: String(m.properties?.name ?? ''), t }))
        }
        return [k('iStruct', { d: k('sdef', { n: n.id, name: String(p.name ?? ''), fields }) })]
      }
      case 'cpp:array_2d_declare': return decl(n, true)
      case 'cpp:using_namespace': return [k('iUsing', { n: n.id, name: String(p.ns ?? '') })]
      case 'cpp:var_declare': case 'cpp:vector_declare': case 'cpp:array_declare':
      case 'cpp:pointer_declare': case 'cpp:string_declare': return decl(n, true)
      case 'cpp:func_def': {
        const ret = String(p.return_type ?? '') === 'void' ? null : type(p.return_type, n)
        const params = (n.slots?.params ?? []).map((q) =>
          k('param', { x: q.id, name: String(q.properties?.name ?? ''), t: type(q.properties?.type, q), dflt: null }))
        return [k('iFun', { f: k('fdef', { n: n.id, noexc: false, name: String(p.name ?? ''), ret, params, body: block(n, 'body') }) })]
      }
      default:
        miss(n, '這顆頂層元件還沒有對應到 Cella 的建構子')
        return []
    }
  }

  const items = (tree.slots?.body ?? []).flatMap(item)
  if (unknown.length > 0) return { program: null, unknown }
  return {
    program: k('prog', { n: tree.id, lang: k('langCpp'), items, board: options.board ?? null }),
    unknown: [],
  }
}
