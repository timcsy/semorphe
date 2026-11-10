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
import { isFunctionDefinition } from '../../../core/component/traits'


export type { CellaJson } from '../../../core/formalize-contract'

export interface Unknown { nodeId: string; construct: string; reason: string }
export type FormalizeResult = { program: CellaJson; unknown: [] } | { program: null; unknown: Unknown[] }

const k = (name: string, fields: Record<string, unknown> = {}): CellaJson => ({ k: name, ...fields })

const BIN: Record<string, string> = {
  '+': 'opAdd', '-': 'opSub', '*': 'opMul', '/': 'opDiv', '%': 'opRem', '<<': 'opShl', '>>': 'opShr',
  '<': 'opLt', '<=': 'opLe', '>': 'opGt', '>=': 'opGe', '==': 'opEq', '!=': 'opNe',
  '&': 'opBitAnd', '|': 'opBitOr', '^': 'opBitXor', '&&': 'opAnd', '||': 'opOr',
  // 替代記號（[lex.digraph]：`a or b`、`a and b`）——第 207 刀，學生的程式這樣寫
  and: 'opAnd', or: 'opOr', bitand: 'opBitAnd', bitor: 'opBitOr', xor: 'opBitXor',
}

const SCALAR: Record<string, string> = {
  int: 'tInt', long: 'tLong', 'long long': 'tLongLong', unsigned: 'tUnsigned', 'unsigned int': 'tUnsigned',
  short: 'tShort', 'unsigned short': 'tUShort', 'unsigned long': 'tULong', 'unsigned long long': 'tULongLong',
  double: 'tDouble', 'long double': 'tLongDouble', float: 'tFloat', char: 'tChar', 'signed char': 'tSChar', 'unsigned char': 'tUChar',
  bool: 'tBool', string: 'tString', 'std::string': 'tString',
  ostream: 'tOstream', 'std::ostream': 'tOstream',
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
  // 只宣告、不是定義的型別名（前置宣告）——型別翻得出來，但不算「有定義」（見契約的 declaresType）
  const declaredTypes = new Set<string>()
  const enumNames = new Set<string>()
  const unionNames = new Set<string>()
  // 類別外的靜態成員定義（361；cella 2026-11-08 的送法）：成員 id → 所屬（有名字的外層）、`類別::成員` → 類別外那份定義。
  //    只問形狀：有名字的節點底下的節點、名字帶 `::` 又有初值槽的宣告——核心不認識任何一顆元件
  const ownerOf = new Map<string, string>()
  const classMembers = new Set<string>()
  const memberIdOf = new Map<string, string>()
  const outsideDefs = new Map<string, SemanticNode>()
  const collect = (n: SemanticNode): void => {
    const ownName = typeof n.properties?.name === 'string' ? n.properties.name : ''
    if (ownName && !ownName.includes('::')) {
      for (const kids of Object.values(n.slots ?? {})) for (const c of kids) {
        ownerOf.set(c.id, ownName)
        if (typeof c.properties?.name === 'string' && c.properties.name) { classMembers.add(`${ownName}::${c.properties.name}`); memberIdOf.set(`${ownName}::${c.properties.name}`, c.id) }
      }
    }
    if (ownName.includes('::') && n.slots?.initializer !== undefined) outsideDefs.set(ownName, n)
    const named = FORMALIZE.definesType.get(n.componentId)
    if (named) structNames.add(named(n))
    const declared = FORMALIZE.declaresType.get(n.componentId)
    if (declared) declaredTypes.add(declared(n))
    const en = FORMALIZE.definesEnum.get(n.componentId)
    if (en) enumNames.add(en(n))
    const un = FORMALIZE.definesUnion.get(n.componentId)
    if (un) unionNames.add(un(n))
    for (const kids of Object.values(n.slots ?? {})) kids.forEach(collect)
  }
  collect(tree)
  const byId = new Map<string, SemanticNode>()
  // 類別的欄位：`members` 槽裡、有型別的那幾顆（成員函式沒有 `type`）——成員函式裡的裸名字指到它們時是 eSelf
  const memberFields = new Set<string>()
  // 程式自己定義的函式名——名字當值用（`sort(a, a + n, cmp)`）時是 eFunc（cpp_to_tree.py 同形；spec 201）
  const functionNames = new Set<string>()
  // 類別成員裡的每一顆節點 → 那個類別的方法名（隱含 this 的呼叫要它；spec 208）
  const ownMethods = new Map<string, Set<string>>()
  // 類別外定義成員函式（第 322 刀）：`類別::鍵` → 類別裡的原型／類別外的定義（鍵由元件的 memberKey 給）；類別的方法名表（類別外定義的本體也看得到它）
  const inClassByKey = new Map<string, SemanticNode>()
  const outsideByKey = new Map<string, SemanticNode>()
  const keyOfInClass = new Map<string, string>()
  const methodsOfClass = new Map<string, Set<string>>()
  // 靜態成員函式（383）：那組方法名 → `類別::名字`（[class.static.mfct] 沒有 this；裸名字呼叫是 `C::f`，cpp_to_tree.py 同形）
  const staticMethodsOf = new Map<Set<string>, Map<string, string>>()
  const staticMethodNames = new Set<string>()
  const index = (n: SemanticNode, methods?: Set<string>): void => {
    byId.set(n.id, n)
    // 類別外的定義：本體裡的裸名字呼叫要認得那個類別的方法（同寫在類別裡）
    const outside = FORMALIZE.memberKey.get(n.componentId)?.(n)
    if (outside?.className !== undefined) {
      outsideByKey.set(`${outside.className}::${outside.key}`, n)
      methods = methodsOfClass.get(outside.className) ?? methods
    }
    if (methods) ownMethods.set(n.id, methods)
    // `int x, y;` 是一顆 `_multi_field` 包著平行的宣告——攤平（第 213 刀，同 struct_declare 的 formalize）
    // spec 203：class 的成員分在 public／protected／private 三個槽（struct 是 members 一個槽）；
    //   有型別、但自己註冊成成員的（靜態成員：所有物件共用一份，參照它是 eVar 不是 eSelf）不是欄位
    const members = ['members', 'public', 'protected', 'private'].flatMap((slot) => n.slots?.[slot] ?? [])
      .flatMap((m) => (m.componentId === '_multi_field' ? m.slots?.fields ?? [] : [m]))
    for (const m of members) if (m.properties?.type !== undefined && !FORMALIZE.member.has(m.componentId)) memberFields.add(m.id)
    if (isFunctionDefinition(n.componentId) && n.properties?.name) functionNames.add(String(n.properties.name))
    const definedFunction = FORMALIZE.definesFunction.get(n.componentId)?.(n)
    if (definedFunction) functionNames.add(definedFunction)
    // 這一顆是類別：成員槽裡註冊成成員、有名字的那幾顆就是它的方法；成員槽底下的節點都看得到這組名字（巢狀類別換成自己的）
    const isClass = members.length > 0
    const own = isClass
      ? new Set(members.filter((m) => FORMALIZE.member.has(m.componentId) && m.properties?.name).map((m) => String(m.properties!.name)))
      : methods
    if (isClass && typeof n.properties?.name === 'string') {
      const cls = n.properties.name
      methodsOfClass.set(cls, own!)
      for (const m of members) {
        const k = FORMALIZE.memberKey.get(m.componentId)?.(m)
        if (k && k.className === undefined) { inClassByKey.set(`${cls}::${k.key}`, m); keyOfInClass.set(m.id, `${cls}::${k.key}`) }
        if (k?.isStatic && m.properties?.name) {
          const statics = staticMethodsOf.get(own!) ?? new Map<string, string>()
          statics.set(String(m.properties.name), `${cls}::${String(m.properties.name)}`)
          staticMethodsOf.set(own!, statics)
          staticMethodNames.add(String(m.properties.name))
        }
      }
    }
    for (const [slot, kids] of Object.entries(n.slots ?? {})) {
      const inMembers = isClass && ['members', 'public', 'protected', 'private'].includes(slot)
      kids.forEach((c) => index(c, inMembers ? own : methods))
    }
  }
  index(tree)
  const unknown: Unknown[] = []
  const miss = (n: SemanticNode, reason: string): CellaJson => {
    unknown.push({ nodeId: n.id, construct: n.componentId, reason })
    return k('eHole', { n: n.id })
  }

  /** 型別巨集展開中的名字（`#define ll long long`；防 `#define T T` 這種自我參照） */
  const expanding = new Set<string>()
  /** 目前所在的函式樣板的型別參數（397） */
  let typeParams: ReadonlySet<string> = new Set()
  function type(t: unknown, at: SemanticNode): CellaJson | null {
    const s = String(t ?? '').trim()
    if (s === '' ) { miss(at, '沒有型別'); return null }
    if (typeParams.has(s)) return k('tParam', { name: s })
    // 型別巨集（spec 199：學生的程式 45 支有 `#define ll long long`）——前端展開，同物件巨集（spec 197）
    const mv = macros.get(s)
    if (mv !== undefined && !expanding.has(s)) {
      expanding.add(s)
      try { return type(mv, at) } finally { expanding.delete(s) }
    }
    // 函式指標：lift 把宣告子拆成名字 ＋ 抽象宣告子 `int (*)(int, int)`（344）→ tPtr(tFunc{ret, params})（cella 2026-11-08 給的形狀；
    // ret 是 Option，void 寫 null；`(void)` 是沒有參數）。參數裡帶了名字（`int (*)(int a)`）時那一格認不得 → 照實標 unknown
    {
      const fp = /^(.+?)\s*\(\*\)\s*\((.*)\)$/.exec(s)
      if (fp) {
        const retText = fp[1].trim()
        const ret = retText === 'void' ? null : type(retText, at)
        if (retText !== 'void' && !ret) return null
        const ps = fp[2].trim() === '' || fp[2].trim() === 'void' ? [] : splitTypeArgs(fp[2]).map((x) => type(x, at))
        if (!ps.every(Boolean)) return null
        return k('tPtr', { t: k('tFunc', { ret, params: ps }) })
      }
    }
    // ⚠️ 先剝參照與指標，再剝 const：`const Node&` 是「參照到 const Node」＝ tRef(tConst(Node))，不是 tConst(tRef(Node))
    //    （spec 201：Cella 判 reject「member reference base type is not a structure or union」抓到的；`const int*` 同理是 tPtr(tConst(int))）
    if (s.endsWith('&')) { const inner = type(s.slice(0, -1), at); return inner && k('tRef', { t: inner }) }
    if (s.endsWith('*')) { const inner = type(s.slice(0, -1), at); return inner && k('tPtr', { t: inner }) }
    if (s.startsWith('const ')) { const inner = type(s.slice(6), at); return inner && k('tConst', { t: inner }) }
    // `int a[]` 只會出現在參數：C++ 把它調成指標（[dcl.fct]p5）——spec 199 量到 4 支
    if (s.endsWith('[]')) { const inner = type(s.slice(0, -2), at); return inner && k('tPtr', { t: inner }) }
    const sc = SCALAR[s]
    if (sc) return k(sc)
    // `void*`／`const void*`（qsort 的比較函式）：tPtr(tVoid)／tPtr(tConst(tVoid))（cella 2026-11-08）。
    // 單獨的 `void` 只會出現在這裡的遞迴底下——回傳型別與 `f(void)` 由呼叫端先接走；寫成變數型別的交給 Cella 判
    if (s === 'void') return k('tVoid')
    // 固定寬度與平台相依的整數型別名（int64_t、size_t…）：照名字送 tName——對到哪個整數型別依平台的 ABI 決定（glibc 的 int64_t 是 long、
    // avr-libc 的 int32_t 是 long），由 Cella 依目標解（cella 2026-11-01；第 208 刀，學生的程式 6 支）
    {
      const fixed = /^(?:std::)?((?:u?int(?:_least|_fast)?(?:8|16|32|64)_t)|u?intmax_t|u?intptr_t|size_t|ssize_t|ptrdiff_t)$/.exec(s)
      if (fixed) return k('tName', { name: fixed[1] })
    }
    const vec = /^(?:std::)?vector\s*<\s*(.+)\s*>$/.exec(s)
    if (vec) { const inner = type(vec[1], at); return inner && k('tVector', { t: inner }) }
    // C++ 的 `auto`（cella 0.1.202610312349 起有 `tAuto`）
    if (s === 'auto' && !isC) return k('tAuto')
    // 標準函式庫的類別範本（cella 照 libc++ 18 實作）：名字不帶 `std::`，同 Cella 用 clang 轉的課文樹（packages/cpp/tools/lessons）
    // `bitset<N>`：N 是非型別範本引數，送 `tVal`（cella 2026-11-01 給的形狀；第 213 刀）——N 要是整數字面或展開得到整數字面的巨集
    const bits = /^(?:std::)?bitset\s*<\s*(\w+)\s*>$/.exec(s)
    if (bits && !isC) {
      const lit = macros.get(bits[1]) ?? bits[1]
      if (/^\d+$/.test(lit)) return k('tTemplate', { name: 'bitset', args: [k('tVal', { v: Number(lit) })] })
      // `const int B = 96; bitset<B>`：tVal 只收整數，前端把常數算出來（cella 2026-11-03）——值由那個宣告自己的 constInt 回答
      const v = constNamed(bits[1])
      if (v !== null) return k('tTemplate', { name: 'bitset', args: [k('tVal', { v })] })
      miss(at, `bitset 的大小「${bits[1]}」不是整數字面`)
      return null
    }
    // numeric_limits（eStaticCall 的 owner）、ostream_iterator（eTemp）：Cella 0.1.202611080524 起有（2026-11-08）
    const tpl = /^(?:std::)?(pair|tuple|queue|stack|priority_queue|set|multiset|map|unordered_map|deque|greater|less|numeric_limits|ostream_iterator)\s*<(.+)>$/.exec(s)
    if (tpl && !isC) {
      const args = splitTypeArgs(tpl[2]).map((x) => type(x, at))
      return args.every(Boolean) ? k('tTemplate', { name: tpl[1], args }) : null
    }
    // 列舉型別名（`Color c`、C 的 `enum Color c`）：tEnum（cella 2026-11-03；檔案範圍與區域的列舉同一個型別形狀）
    const en = /^(?:enum\s+)?([A-Za-z_]\w*)$/.exec(s)
    if (en && enumNames.has(en[1])) return k('tEnum', { name: en[1] })
    // union 型別名（C 的 `union U u`、C++ 的 `U u`）：tUnion（cella 2026-11-08；與 struct 對稱）
    const un = /^(?:union\s+)?([A-Za-z_]\w*)$/.exec(s)
    if (un && (s.startsWith('union ') || unionNames.has(un[1]))) return k('tUnion', { name: un[1] })
    const st = /^(?:struct\s+)?([A-Za-z_]\w*)$/.exec(s)
    if (st && (s.startsWith('struct ') || structNames.has(st[1]) || declaredTypes.has(st[1]))) return k(isC ? 'tStruct' : 'tClass', { name: st[1] })
    // 限定名的類別（`ds::Item`、`Outer::Inner`）：tClass 的 name 照原文帶限定（與 eCall 的 "Math::square" 同一種送法）；裡面定義過才算
    if (!isC && /^[A-Za-z_]\w*(?:::[A-Za-z_]\w*)+$/.test(s)) {
      const parts = s.split('::')
      if (structNames.has(parts[parts.length - 1]) && classMembers.has(parts.slice(-2).join('::'))) return k('tClass', { name: s })
    }
    // 巢狀的型別名：`vector<int>::iterator`、`set<int>::const_iterator`、`string::iterator`——tMember（cella 2026-11-03 給的形狀；
    // 宣告、參數、typedef 三種位置都是它）。⚠️ vector／string 的 iterator 成員型別要等 Cella 補（之前判 reject「unknown type」）——照送，不自己展開成指標
    const mem = /^(.+)::(iterator|const_iterator|reverse_iterator|const_reverse_iterator)$/.exec(s)
    if (mem && !isC) {
      const owner = type(mem[1], at)
      return owner && k('tMember', { owner, name: mem[2] })
    }
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
    // 🟢 接收者的名字交給 Cella 依作用域解析（eName，cella 0.1.202611052225）：宣告過的 → eVar／eSelf；
    //    沒宣告的串流（`cin`）→ eStdin…；板子與標頭的全域物件（`Serial`、`WiFi`）→ eConst，由檢查器找，找不到判 undeclared 指回這一格。
    //    `std::cin` 這種帶限定的名字 Cella 也認得。不是名字的（運算式寫成文字）照實標 unknown
    if (!/^(?:std::)?[A-Za-z_]\w*$/.test(name)) return miss(n, `接收者「${name}」不是單一名字`)
    const obj = k('eName', { n: `${n.id}/obj`, name })
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
  const functionMacros = new Set<string>()
  const collectMacros = (n: SemanticNode): void => {
    const m = FORMALIZE.definesMacro.get(n.componentId)?.(n)
    if (m?.function) functionMacros.add(m.name)
    else if (m) macros.set(m.name, m.value.trim())
    for (const kids of Object.values(n.slots ?? {})) kids.forEach(collectMacros)
  }
  collectMacros(tree)
  const literalNode = (text: string, id: string): SemanticNode | undefined => {
    for (const [componentId, { test, value }] of FORMALIZE.literal) {
      if (test(text)) return { id, componentId, properties: { value: value ? value(text) : text }, slots: {} } as SemanticNode
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
  /**
   * 型別文字裡的常數名（`bitset<B>` 的 B）：沒有節點可以走作用域，就找【會回答 constInt 的宣告】裡叫這個名字的——
   * 哪一顆算宣告、值是不是編譯期常數，都由元件自己登記（decl ＋ constInt），核心不點名。同名而值不同（遮蔽）就不猜。
   */
  const constNamed = (name: string): number | null => {
    const vals = new Set<number | null>()
    const walk = (n: SemanticNode): void => {
      if (n.properties?.name === name && FORMALIZE.decl.has(n.componentId) && FORMALIZE.constInt.has(n.componentId)) vals.add(constInt(n))
      for (const kids of Object.values(n.slots ?? {})) kids.forEach(walk)
    }
    walk(tree)
    return vals.size === 1 ? [...vals][0] : null
  }

  const SCALARS = new Set(Object.values(SCALAR))
  const isScalar = (t: CellaJson): boolean => SCALARS.has(String(t.k)) || t.k === 'tPtr'
  const declInit = (n: SemanticNode, t: CellaJson, init: CellaJson | null, global: boolean): CellaJson[] => {
    const name = String(n.properties?.name ?? '')
    return [global
      ? k('iVar', { n: n.id, x: n.id, name, t, init })
      : k('sDecl', { n: n.id, x: n.id, name, t, init })]
  }
  const declVar = (n: SemanticNode, t: CellaJson, global: boolean): CellaJson[] => {
    const initNode = one(n, 'initializer')
    // 初值走 initOf：大括號串列是 iL，其餘是 iE。
    // ⚠️ 純量不收 iL（Cella：「scalar initializer must be an expression」）——`int h{}` 是值初始化（零）、`int h{5}` 就是 5（spec 201）
    let init = initNode ? initOf(initNode) : null
    if (init?.k === 'iL' && isScalar(t)) {
      const xs = init.xs as CellaJson[]
      if (xs.length > 1) { miss(n, '純量的大括號初值不能有兩個以上'); init = null }
      // 空的大括號是值初始化：數字是 0；而字串是【空字串】（預設建構子）——送 0 等於 `string x = 0`（從空指標建字串，Cella 判 ubNull；
      // 0.1.202611021533 補了 cin.ignore 之後在學生的 6_advanced_inout 露出來）
      else init = xs.length === 1 ? xs[0] : t.k === 'tString' ? null : k('iE', { e: k('eNum', { n: initNode!.id, v: 0 }) })
    }
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

  // 翻一句敘述時，運算式裡要提到它前面的敘述（lambda 的 sLambda）——每一句各收各的（巢狀的本體由內層的 stmt 收）
  let hoisted: CellaJson[] | null = null
  function stmt(n: SemanticNode): CellaJson[] {
    const outer = hoisted
    hoisted = []
    try {
      const out = stmtOnly(n)
      return [...hoisted, ...out]
    } finally { hoisted = outer }
  }
  function stmtOnly(n: SemanticNode): CellaJson[] {
    const fn = FORMALIZE.stmt.get(n.componentId)
    if (fn) return fn(n, ctx)
    if (FORMALIZE.decl.has(n.componentId)) return decl(n, false)
    // 🔴 運算式當敘述（spec 205 T011，D4）：C++ 的任何運算式都可以單獨成一句（[stmt.expr]）。沒有專屬敘述形式、
    //    但認得成運算式的，就是運算式敘述——原本 `cout < "x";`、`Cout << x;` 這種學生打錯的程式在這裡翻不出，
    //    被說成「Cella 還不支援」（把學生的錯說成系統的錯）；照實送出之後，判決說得出它錯在哪裡
    if (FORMALIZE.expr.has(n.componentId)) return [k('sExpr', { n: `${n.id}/stmt`, e: expr(n) })]
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
    hoist: (s) => {
      if (hoisted) hoisted.push(s)
      else miss({ id: String(s.n ?? '-'), componentId: 'hoist', properties: {}, slots: {} } as unknown as SemanticNode, '全域位置的 lambda 還沒有對應（沒有前面的敘述可以放它的定義）')
    },
    identMacro: (name) => {
      const v = macros.get(name)
      return v !== undefined && /^[A-Za-z_]\w*$/.test(v) ? v : name
    },
    functionMacro: (name) => functionMacros.has(name),
    macroDefined: (name) => macros.has(name) || functionMacros.has(name),
    literalExpr: (text, id) => { const probe = literalNode(text.trim(), id); return probe ? expr(probe) : undefined },
    withTypeParams: (names, body) => {
      const outer = typeParams
      typeParams = new Set([...outer, ...names])
      try { return body() } finally { typeParams = outer }
    },
    ownsMember: (n) => FORMALIZE.member.has(n.componentId),
    item: (n) => item(n),
    nodeById: (id) => byId.get(id),
    member: (m) => {
      const fn = FORMALIZE.member.get(m.componentId)
      if (fn) return fn(m, ctx)
      miss(m, '這顆類別成員還沒有對應到 Cella 的建構子')
      return null
    },
    isMemberField: (declId) => memberFields.has(declId),
    isFunctionName: (name) => functionNames.has(name),
    isOwnMethod: (nodeId, name) => ownMethods.get(nodeId)?.has(name) ?? false,
    ownStaticMethod: (nodeId, name) => { const own = ownMethods.get(nodeId); return own ? staticMethodsOf.get(own)?.get(name) : undefined },
    outsideDefinition: (declared) => { const k = keyOfInClass.get(declared.id); return k === undefined ? undefined : outsideByKey.get(k) },
    hasInClassDeclaration: (defined) => {
      const k = FORMALIZE.memberKey.get(defined.componentId)?.(defined)
      return k?.className !== undefined && inClassByKey.has(`${k.className}::${k.key}`)
    },
    defaultArgument: (q) => {
      const text = String(q?.properties?.default ?? '').trim()
      if (!q || text === '') return null
      // 🔴 Cella 0.1.202611101335 的誤判：`const string& n = "anon"` 省略引數時判找不到相符的函式（395 實測，已回報，修好會通知）。
      //    形狀忠實於原始碼，而合法的程式被說成錯的（P6）比翻不出嚴重——修好之前照實標翻不出
      if (text.startsWith('"') && !/\bchar\b/.test(String(q.properties?.type ?? ''))) return miss(q, `參數的預設值是字串字面「${text}」而參數不是 char 指標：Cella 目前判找不到相符的函式（已回報）——還沒有對應`)
      return ctx.literalExpr(text, `${q.id}/default`) ?? miss(q, `參數預設值「${text}」不是字面，還沒有對應`)
    },
    memberAt: (defined) => {
      const key = FORMALIZE.memberKey.get(defined.componentId)?.(defined)
      const declared = key?.className !== undefined ? inClassByKey.get(`${key.className}::${key.key}`) : undefined
      return declared ? k('iMemberAt', { n: `${defined.id}/at`, cls: key!.className, x: declared.id }) : null
    },
    staticMemberAt: (defined) => {
      const qualified = String(defined.properties?.name ?? '')
      const x = memberIdOf.get(qualified)
      return x === undefined ? null : k('iMemberAt', { n: `${defined.id}/at`, cls: qualified.slice(0, qualified.lastIndexOf('::')), x })
    },
    asStatement: (c) => (FORMALIZE.stmt.has(c.componentId) || FORMALIZE.decl.has(c.componentId)
      ? stmt(c)
      : [k('sExpr', { n: `${c.id}/stmt`, e: expr(c) })]),
    programUses: (test) => {
      const walk = (n: SemanticNode): boolean => test(n.componentId) || Object.values(n.slots ?? {}).some((kids) => kids.some(walk))
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
    isQualifiedInstanceCall: (name) => {
      const m = /^(\w+)::(\w+)$/.exec(name)
      return !!m && structNames.has(m[1]) && !structNames.has(m[2]) && !staticMethodNames.has(m[2])
    },
    isTypeName: (name) => structNames.has(name) || declaredTypes.has(name) || unionNames.has(name) || enumNames.has(name),
    staticInitOf: (member) => {
      const owner = ownerOf.get(member.id)
      const def = owner ? outsideDefs.get(`${owner}::${String(member.properties?.name ?? '')}`) : undefined
      return def?.slots?.initializer?.[0]
    },
    isClassMember: (qualifiedName) => classMembers.has(qualifiedName),
    options: { board: options.board, lang: options.lang, isC },
  }

  const items = (tree.slots?.body ?? []).flatMap((c) => item(c))
  if (unknown.length > 0) return { program: null, unknown }
  return {
    program: k('prog', { n: tree.id, lang: k(isC ? 'langC' : 'langCpp'), items, board: options.board ?? null }),
    unknown: [],
  }
}
