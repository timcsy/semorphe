/**
 * **formalize：語義樹 → Cella 的程式 JSON**（spec 180，重構階段 4；盟約第 2 條的防腐層）。
 *
 * 格式是 `@cella-lang/cfamily` 的 `cfamily.syntax`（`deriving Json`：`{"k": 建構子, <參數名>: 值}`；
 * Option 是值或 null；列舉是 `{"k": "tInt"}`）。每個建構子的 `n` 是語義節點的 id——Cella 的判決、
 * 除錯器的停點、型別查詢的洞都用它指回積木。展開出來、學生看不到的內部節點用 `<id>/<角色>`。
 *
 * 🔴 **翻不了的不送、也不猜**：回 `unknown`，說出哪一顆節點、哪一種元件（P6；四之十「Cella 還沒做的由 semorphe 判斷」）。
 * 這一版是第一批的**最小子集**；其餘元件逐批加，對照表的覆蓋由護欄盯。
 *
 * 🔴 **每顆元件的翻譯住在它自己的膠囊**（`src/components/<scope>/<name>/formalize.ts`，第 389 刀）——
 * formalize 是元件自己的動詞。這裡只留共用的：作用域走訪的結果、型別解析、洞、呼叫的組法、通用的宣告子；
 * 分派是查表（`./registry`），查不到照舊 unknown。契約在 `core/formalize-contract.ts`。
 */
import type { SemanticNode } from '../../../core/types'
import type { CellaJson, FormalizeContext } from '../../../core/formalize-contract'
import { resolveScopes } from './scope'
import { FORMALIZE } from './registry'

export type { CellaJson } from '../../../core/formalize-contract'

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

/** 範本引數依最外層的逗號切開（`int, vector<int>, greater<int>` → 三個） */
export function splitTypeArgs(s: string): string[] {
  const out: string[] = []
  let depth = 0, cur = ''
  for (const ch of s) {
    if (ch === '<') depth++
    if (ch === '>') depth--
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue }
    cur += ch
  }
  if (cur.trim() !== '') out.push(cur.trim())
  return out
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

/**
 * semorphe 的目標 id → Cella 的板名（`@cella-lang/arduino` 的 README：未知的板子判決是 `invalid`）。
 * 不是板子的目標（`cpp`、`c`）回 undefined。
 */
const CELLA_BOARD: Record<string, string> = {
  'arduino-uno': 'uno', arduino: 'arduino', 'arduino-nano': 'nano',
  esp32: 'esp32', esp32c3: 'esp32c3', esp32s3: 'esp32s3', 'esp32s3-cam': 'esp32s3Cam',
  'nodemcu-esp8266': 'nodemcuEsp8266', 'wemos-d1-mini': 'wemosD1Mini',
}
export function cellaBoardOf(targetId: string): string | undefined {
  return CELLA_BOARD[targetId]
}

/** 深複製一份程式 JSON，每個節點標籤 `n` 加上 `/<tag>`（見契約的 `copy`）。 */
function relabel(json: CellaJson, tag: string): CellaJson {
  if (Array.isArray(json)) return json.map((x) => relabel(x as CellaJson, tag)) as never
  if (!json || typeof json !== 'object') return json
  const out: Record<string, unknown> = {}
  for (const [key, v] of Object.entries(json as Record<string, unknown>)) {
    out[key] = key === 'n' && typeof v === 'string' ? `${v}/${tag}` : relabel(v as CellaJson, tag)
  }
  return out as CellaJson
}

export function formalize(tree: SemanticNode, options: { board?: string; lang?: 'c' | 'cpp' } = {}): FormalizeResult {
  // C 與 C++ 是同一個核心的兩個分支（`@cella-lang/c`／`@cella-lang/cpp`）；差在 lang 與 struct 的寫法（cella 2026-10-31）
  const isC = options.lang === 'c'
  const { declOf } = resolveScopes(tree)
  // C++ 的 struct 就是 class：寫不寫 `struct` 都是 tClass（cella 2026-10-31；tStruct 只給 C 程式）。
  // 不帶關鍵字的型別名（`Node*`）要先知道它是程式裡定義過的 struct，才認得出來——哪一顆定義型別名由元件自己註冊（`definesType`）。
  const structNames = new Set<string>()
  const collect = (n: SemanticNode): void => {
    const named = FORMALIZE.definesType.get(n.componentId)
    if (named) structNames.add(named(n))
    for (const kids of Object.values(n.slots ?? {})) kids.forEach(collect)
  }
  collect(tree)
  const byId = new Map<string, SemanticNode>()
  const index = (n: SemanticNode): void => { byId.set(n.id, n); for (const kids of Object.values(n.slots ?? {})) kids.forEach(index) }
  index(tree)
  const unknown: Unknown[] = []
  const miss = (n: SemanticNode, reason: string): CellaJson => {
    unknown.push({ nodeId: n.id, construct: n.componentId, reason })
    return k('eHole', { n: n.id })
  }

  /** 型別巨集展開中的名字（`#define ll long long`；防 `#define T T` 這種自我參照） */
  const expanding = new Set<string>()
  function type(t: unknown, at: SemanticNode): CellaJson | null {
    const s = String(t ?? '').trim()
    if (s === '' ) { miss(at, '沒有型別'); return null }
    // 型別巨集（spec 199：學生的程式 45 支有 `#define ll long long`）——前端展開，同物件巨集（spec 197）
    const mv = macros.get(s)
    if (mv !== undefined && !expanding.has(s)) {
      expanding.add(s)
      try { return type(mv, at) } finally { expanding.delete(s) }
    }
    if (s.startsWith('const ')) { const inner = type(s.slice(6), at); return inner && k('tConst', { t: inner }) }
    if (s.endsWith('&')) { const inner = type(s.slice(0, -1), at); return inner && k('tRef', { t: inner }) }
    if (s.endsWith('*')) { const inner = type(s.slice(0, -1), at); return inner && k('tPtr', { t: inner }) }
    // `int a[]` 只會出現在參數：C++ 把它調成指標（[dcl.fct]p5）——spec 199 量到 4 支
    if (s.endsWith('[]')) { const inner = type(s.slice(0, -2), at); return inner && k('tPtr', { t: inner }) }
    const sc = SCALAR[s]
    if (sc) return k(sc)
    const vec = /^(?:std::)?vector\s*<\s*(.+)\s*>$/.exec(s)
    if (vec) { const inner = type(vec[1], at); return inner && k('tVector', { t: inner }) }
    // C++ 的 `auto`（cella 0.1.202610312349 起有 `tAuto`）
    if (s === 'auto' && !isC) return k('tAuto')
    // 標準函式庫的類別範本（cella 照 libc++ 18 實作）：名字不帶 `std::`，同 Cella 用 clang 轉的課文樹（packages/cpp/tools/lessons）
    const tpl = /^(?:std::)?(pair|queue|stack|priority_queue|set|map|deque|greater|less)\s*<(.+)>$/.exec(s)
    if (tpl && !isC) {
      const args = splitTypeArgs(tpl[2]).map((x) => type(x, at))
      return args.every(Boolean) ? k('tTemplate', { name: tpl[1], args }) : null
    }
    const st = /^(?:struct\s+)?([A-Za-z_]\w*)$/.exec(s)
    if (st && (s.startsWith('struct ') || structNames.has(st[1]))) return k(isC ? 'tStruct' : 'tClass', { name: st[1] })
    miss(at, `型別「${s}」還沒有對應`)
    return null
  }

  const one = (n: SemanticNode, slot: string): SemanticNode | undefined => n.slots?.[slot]?.[0]
  const exprOf = (n: SemanticNode, slot: string): CellaJson => {
    const c = one(n, slot)
    return c ? expr(c) : k('eHole', { n: `${n.id}#${slot}` })
  }

  /** 函式呼叫：引數依槽的順序，沒填的選擇性引數（如 tone 的 duration）不送。 */
  const call = (n: SemanticNode, f: string, slots: string[]): CellaJson =>
    k('eCall', { n: n.id, f, args: slots.filter((sl) => one(n, sl)).map((sl) => expr(one(n, sl)!)) })
  /**
   * 方法呼叫，接收者是文字屬性 `obj`：程式裡宣告過的物件（`dht`）照常指到宣告；
   * 沒宣告過的（`Serial`、`Serial1`）是板子的全域物件——照 Cella 的板子常數那樣寫成 `eConst`。
   * 全域物件寫成 eConst：cella 2026-10-31 確認（同 cpp_to_tree.py：別的標頭宣告的全域變數一律 eConst）。
   */
  const mcall = (n: SemanticNode, f: string, slots: string[]): CellaJson => {
    const name = String(n.properties?.obj ?? '')
    const x = declOf.get(`${n.id}#obj`)
    // 沒宣告的接收者（`Serial`、`Serial1`、`WiFi`）是標頭的全域物件：eConst（cella 2026-10-31 確認）
    const obj = x ? k('eVar', { n: `${n.id}/obj`, x }) : options.board && /^[A-Za-z_]\w*$/.test(name) ? k('eConst', { n: `${n.id}/obj`, name }) : null
    if (!obj) return miss(n, `接收者「${name}」指不到宣告`)
    return k('eMCall', { n: n.id, obj, arrow: false, f, args: slots.filter((sl) => one(n, sl)).map((sl) => expr(one(n, sl)!)) })
  }

  /** 二元運算：算術、比較、邏輯三顆共用。 */
  const binary = (n: SemanticNode): CellaJson => {
    const op = BIN[String(n.properties?.operator ?? '')]
    if (!op) return miss(n, `運算子「${String(n.properties?.operator)}」還沒有對應`)
    return k('eBin', { n: n.id, op: k(op), a: exprOf(n, 'left'), b: exprOf(n, 'right') })
  }

  function expr(n: SemanticNode): CellaJson {
    const fn = FORMALIZE.expr.get(n.componentId)
    return fn ? fn(n, ctx) : miss(n, '這顆元件還沒有對應到 Cella 的建構子')
  }

  const block = (n: SemanticNode, slot: string): CellaJson =>
    k('sBlock', { n: `${n.id}/${slot}`, body: (n.slots?.[slot] ?? []).flatMap((c) => stmt(c)) })

  /** 大括號初值串列——巢狀的那一顆由元件自己註冊（`init`），其餘是 `iE` 包運算式。 */
  const initOf = (c: SemanticNode): CellaJson => {
    const fn = FORMALIZE.init.get(c.componentId)
    return fn ? fn(c, ctx) : k('iE', { e: expr(c) })
  }
  const braceList = (n: SemanticNode, slot: string): CellaJson =>
    k('iL', { n: `${n.id}/${slot}`, xs: (n.slots?.[slot] ?? []).map((c) => initOf(c)) })

  // 物件巨集（spec 197）：哪一顆定義巨集、哪一顆認得字面量的文字，都由元件自己登記——核心不認識任何一顆元件
  const macros = new Map<string, string>()
  const collectMacros = (n: SemanticNode): void => {
    const m = FORMALIZE.definesMacro.get(n.componentId)?.(n)
    if (m) macros.set(m.name, m.value.trim())
    for (const kids of Object.values(n.slots ?? {})) kids.forEach(collectMacros)
  }
  collectMacros(tree)
  const literalNode = (text: string, id: string): SemanticNode | undefined => {
    for (const [componentId, test] of FORMALIZE.literal) {
      if (test(text)) return { id, componentId, properties: { value: text }, slots: {} } as SemanticNode
    }
    return undefined
  }
  const macro = (name: string): { expr(usageId: string): CellaJson; int: number | null } | undefined => {
    const v = macros.get(name)
    const probe = v === undefined ? undefined : literalNode(v, `macro:${name}`)
    if (!probe) return undefined
    return { expr: (usageId) => expr({ ...probe, id: usageId }), int: constInt(probe) }
  }

  /** 編譯期的非負整數字面——哪一顆是由元件自己註冊（`constInt`）。 */
  const constInt = (c: SemanticNode | undefined): number | null => {
    if (!c) return null
    const fn = FORMALIZE.constInt.get(c.componentId)
    return fn ? fn(c, ctx) : null
  }

  const declInit = (n: SemanticNode, t: CellaJson, init: CellaJson | null, global: boolean): CellaJson[] => {
    const name = String(n.properties?.name ?? '')
    return [global
      ? k('iVar', { n: n.id, x: n.id, name, t, init })
      : k('sDecl', { n: n.id, x: n.id, name, t, init })]
  }
  const declVar = (n: SemanticNode, t: CellaJson, global: boolean): CellaJson[] => {
    const initNode = one(n, 'initializer')
    // 初值走 initOf：大括號串列是 iL（`int h{}` 是空的 iL——cpp_to_tree.py 的 init 同形；spec 199 量到 176 處），其餘是 iE
    const init = initNode ? initOf(initNode) : null
    return declInit(n, t, init, global)
  }
  const declCtor = (n: SemanticNode, t: CellaJson, args: CellaJson[], global: boolean): CellaJson[] => {
    const name = String(n.properties?.name ?? '')
    return [global ? k('iVarC', { n: n.id, x: n.id, name, t, args }) : k('sDeclC', { n: n.id, x: n.id, name, t, args })]
  }
  function libraryObject(n: SemanticNode, cls: string, global: boolean): CellaJson[] {
    const t = k('tClass', { name: cls })
    const args = (n.slots?.initializer ?? []).map((c) => expr(c))
    return declCtor(n, t, args, global)
  }

  /**
   * 宣告：元件註冊了就用它的；沒註冊的照**通用宣告子**的形狀——多個宣告子逐一遞迴（`int a, b[3];`
   * 的每一個宣告子由它自己的註冊翻），單一個是「型別 名字 = 初值」。
   */
  function decl(n: SemanticNode, global: boolean): CellaJson[] {
    const fn = FORMALIZE.decl.get(n.componentId)
    if (fn) return fn(n, ctx, global)
    return plainDecl(n, global)
  }
  function plainDecl(n: SemanticNode, global: boolean): CellaJson[] {
    const kids = n.slots?.declarators
    if (kids && kids.length > 0) return kids.flatMap((d) => decl(d, global))
    const t = type(n.properties?.type, n)
    if (!t) return []
    return declVar(n, t, global)
  }

  function stmt(n: SemanticNode): CellaJson[] {
    const fn = FORMALIZE.stmt.get(n.componentId)
    if (fn) return fn(n, ctx)
    if (FORMALIZE.decl.has(n.componentId)) return decl(n, false)
    miss(n, '這顆敘述元件還沒有對應到 Cella 的建構子')
    return [k('sHole', { n: n.id })]
  }

  function item(n: SemanticNode): CellaJson[] {
    const fn = FORMALIZE.item.get(n.componentId)
    if (fn) return fn(n, ctx)
    if (FORMALIZE.decl.has(n.componentId)) return decl(n, true)
    miss(n, '這顆頂層元件還沒有對應到 Cella 的建構子')
    return []
  }

  const ctx: FormalizeContext = {
    k, expr, stmt, decl, one, exprOf, block, initOf, braceList, type, miss, call, mcall, binary,
    exprStmt: (n) => [k('sExpr', { n: `${n.id}/stmt`, e: expr(n) })],
    copy: (json, tag) => relabel(json, tag),
    declVar, declInit, declCtor, libraryObject, constInt,
    declOf: (key) => declOf.get(key),
    macro,
    nodeById: (id) => byId.get(id),
    asStatement: (c) => (FORMALIZE.stmt.has(c.componentId) || FORMALIZE.decl.has(c.componentId)
      ? stmt(c)
      : [k('sExpr', { n: `${c.id}/stmt`, e: expr(c) })]),
    programUses: (ids) => {
      const want = new Set(ids)
      const walk = (n: SemanticNode): boolean => want.has(n.componentId) || Object.values(n.slots ?? {}).some((kids) => kids.some(walk))
      return walk(tree)
    },
    isTypeText: (text) => {
      const before = unknown.length
      const ok = type(text, tree) !== null
      unknown.length = before   // 只是問一句，不記 unknown
      return ok
    },
    unescapeC,
    binOp: (op) => BIN[op],
    scalar: (name) => SCALAR[name],
    isStructName: (name) => structNames.has(name),
    options: { board: options.board, lang: options.lang, isC },
  }

  const items = (tree.slots?.body ?? []).flatMap((c) => item(c))
  if (unknown.length > 0) return { program: null, unknown }
  return {
    program: k('prog', { n: tree.id, lang: k(isC ? 'langC' : 'langCpp'), items, board: options.board ?? null }),
    unknown: [],
  }
}
