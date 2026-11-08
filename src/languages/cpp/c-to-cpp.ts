/**
 * **C → C++**（跨語言互轉的第一對，見 `knowledge/draft/2026-11-07-Lean4課程與跨語言互轉——以Cella為根基.md`）。
 *
 * 轉換在 semorphe（產道地的寫法），意思由 Cella 判：轉換前後各交給 Cella 判一次，判決相同（含 `assumes`）才算沒失真
 * ——那條斷言住在護欄 `tests/integration/c-to-cpp-verdict.test.ts`。
 *
 * 這一刀換的是 I/O：`printf` → `cout`、`scanf` → `cin`，**只在換了之後印出來（讀進去）的一字不差時**。
 * 判準是格式與 Cella 給的型別（`types().nodes`，同 spec 215 的反方向）：
 *
 * ```
 * printf("%d + %d = %d\n", a, b, a + b)   a、b、a+b 都是 int、%d 是 int 的寫法 → cout << a << " + " << b << … << endl
 * printf("%5.2f\n", x)                     有寬度／精度 → 保留 printf（cout 要 iomanip，那是另一刀）
 * printf("%c", 'A' + i)                    'A'+i 是 int，%c 會印字元、cout 會印數字 → 保留
 * scanf("%d,%d", &a, &b)                   格式裡有逗號，cin 不會跳過它 → 保留
 * ```
 *
 * 🔴 **推不出就保留**（P6）：printf／scanf 本來就是合法的 C++（`<cstdio>`），保留不會錯；換錯會讓輸出變掉。
 * ⚠️ 只換**語句位置**的那一顆——`while (scanf(...) == 1)` 用到回傳值，cin 沒有那個值。
 *
 * 舊的風格例外規則（`style-exceptions.ts` 的 printf → cout）只搬引數、丟掉格式字串的文字與換行
 * （`printf("%d + %d\n", a, b)` 變成 `cout << a << b`）——那條也改走這裡。
 */
import type { SemanticNode } from '../../core/types'
import { bodySlotsOf, ioTraitOf, isAddressable, componentTraits } from '../../core/component/traits'
import { printfOf, scanfOf } from './printf-types'
import { normalizeHeader } from './header-aliases'
import { collectStructNames } from './target-dialect'
import { isIncludeDirective } from './lang/node-traits'
import { buildPrint } from '../../components/cpp/print/lift'
import { buildInput } from '../../components/cpp/input/lift'
import { buildEndl } from '../../components/cpp/endl/lift'
import { buildLiteralString } from '../../components/cpp/literal_string/lift-strategy'
import { isUncastMalloc, castMallocTo, isMalloc, mallocNewShape } from '../../components/cpp/malloc/lift'
import { freedPointer } from '../../components/cpp/free/lift'
import { buildNew } from '../../components/cpp/new/lift-strategy'
import { buildDelete } from '../../components/cpp/delete/build'
import { sizeofTypeTarget } from '../../components/cpp/sizeof/lift-strategy'
import { varRefName } from '../../components/cpp/var_ref/lift'
import { buildIoMode } from '../../components/cpp/io_mode/lift'
import { buildIoModeNumber } from '../../components/cpp/io_mode_number/build'
import { buildLiteralNumber } from '../../components/cpp/literal_number/build'

/** 每個運算式的型別（Cella `types().nodes`，鍵是語意樹節點 id） */
export type ExpressionTypes = Readonly<Record<string, string>>

/** `prec`：只有 `%f`／`%.Nf`（`%f` 是 `%.6f`）——第五刀換成 `fixed << setprecision(N)` */
type Piece = { text: string } | { conv: string; prec?: number }

/** 格式字串（原始碼的寫法，跳脫照原樣）切成文字與轉換；有旗標／寬度／精度的轉換回 null。 */
function splitFormat(fmt: string): Piece[] | null {
  const out: Piece[] = []
  let text = ''
  for (let i = 0; i < fmt.length; i++) {
    const ch = fmt[i]
    if (ch === '\\') { text += fmt.slice(i, i + 2); i++; continue }
    if (ch !== '%') { text += ch; continue }
    if (fmt[i + 1] === '%') { text += '%'; i++; continue }
    // 第五刀（2026-11-08）：`%f`、`%.Nf`、`%lf`（printf 的 %lf 與 %f 相同）——精度記下來，換成 `fixed << setprecision(N)`
    const f = /^%l?(?:\.(\d+))?f/.exec(fmt.slice(i))
    if (f) {
      if (text) out.push({ text }); text = ''
      out.push({ conv: '%f', prec: f[1] === undefined ? 6 : Number(f[1]) })
      i += f[0].length - 1
      continue
    }
    const m = /^%(hh|h|ll|l|z|L)?([diucsg])/.exec(fmt.slice(i))
    if (!m) return null
    if (text) out.push({ text }); text = ''
    out.push({ conv: `%${m[1] ?? ''}${m[2] === 'i' ? 'd' : m[2]}` })
    i += m[0].length - 1
  }
  if (text) out.push({ text })
  return out
}

/** `printf(fmt, args…)` 的 cout 寫法；`null` ＝ 換了會印出不一樣的東西（保留 printf）。 */
export function printfAsCout(node: SemanticNode, types: ExpressionTypes, fixedInProgram = false): SemanticNode | null {
  const pieces = splitFormat(String(node.properties.format ?? ''))
  if (!pieces) return null
  // 這支程式有換成 `fixed` 的輸出 ⟹ 換成預設 cout 的 `%g` 會被那個狀態影響（印成 fixed）——保留 printf（printf 不受 cout 的狀態影響）
  if (fixedInProgram && pieces.some((p) => 'conv' in p && /g$/.test(p.conv))) return null
  const args = node.slots.args ?? []
  if (pieces.filter((p) => 'conv' in p).length !== args.length) return null
  const values: SemanticNode[] = []
  let k = 0
  for (const [i, p] of pieces.entries()) {
    if ('conv' in p) {
      const a = args[k++]
      // `%.Nf`：引數是 float／double（Cella 的型別）→ `fixed << setprecision(N) << a`——每一次都明寫，不靠前一行留下的狀態
      if (p.prec !== undefined) {
        if (printfOf(types[a.id])?.conv !== '%g') return null
        values.push(buildIoModeNumber('fixed'), buildIoMode('precision', buildLiteralNumber(String(p.prec))), a)
        continue
      }
      const want = printfOf(types[a.id])
      // `.c_str()` 那種要改寫引數的（std::string）不會出現在 C 程式裡；保守起見也不收
      if (!want || want.conv !== p.conv || want.arg('x') !== 'x') return null
      values.push(a)
      continue
    }
    // 最後一段文字的結尾換行 → endl（初學課的寫法；輸出相同）
    const last = i === pieces.length - 1
    if (last && p.text.endsWith('\\n')) {
      const rest = p.text.slice(0, -2)
      if (rest) values.push(buildLiteralString(rest))
      values.push(buildEndl())
      continue
    }
    values.push(buildLiteralString(p.text))
  }
  if (values.length === 0) return null
  return buildPrint(values)
}

/** `scanf(fmt, &a…)` 的 cin 寫法；`null` ＝ 換了會讀成不一樣（保留 scanf）。 */
export function scanfAsCin(node: SemanticNode, types: ExpressionTypes): SemanticNode | null {
  const fmt = String(node.properties.format ?? '')
  const args = node.slots.args ?? []
  // 只收「轉換之間只有空白」：cin >> 一律先跳過空白，格式裡的其他字元 cin 不會吃掉
  const toks = fmt.match(/\s+|%[a-zA-Z]+|[^%\s]+|%/g) ?? []
  const convs: { conv: string; spaceBefore: boolean }[] = []
  let space = false
  for (const t of toks) {
    if (/^\s+$/.test(t)) { space = true; continue }
    if (!/^%(hh|h|ll|l|z|L)?[diucsfg]$/.test(t)) return null
    convs.push({ conv: t.replace(/^%(.*)i$/, '%$1d'), spaceBefore: space })
    space = false
  }
  // 結尾的空白：scanf 會一直吃到下一個非空白，cin 不會——保守不收
  if (space || convs.length === 0 || convs.length !== args.length) return null
  for (const [i, c] of convs.entries()) {
    const a = args[i]
    const t = types[a.id]
    if (c.conv === '%s') {
      // char 陣列：cin >> buf 與 scanf("%s", buf) 都讀一個不含空白的詞
      if (!t || !/^char ?\[\d+\]$/.test(t.replace(/\s+/g, ' ').trim())) return null
      continue
    }
    if (!isAddressable(a.componentId)) return null
    const want = scanfOf(t)
    if (!want) return null
    // char：scanf 的 %c 不跳空白，cin >> 會 ⟹ 只有前面有空白（或是第一個轉換之前就有空白）才一樣
    if (want === ' %c') { if (c.conv !== '%c' || !c.spaceBefore) return null; continue }
    if (want !== c.conv) return null
  }
  return buildInput(args)
}

export interface CToCppResult {
  tree: SemanticNode
  /** 換成 cout／cin 的行數 */
  converted: number
  /** 保留 printf／scanf 的行數（換了會變意思） */
  kept: number
}

/**
 * 整棵樹：語句位置的 printf／scanf 能換就換。**不改原樹**（回傳新樹）。
 * `malloc` 沒有轉型（`int *a = malloc(n);`）：C 會把 `void*` 隱含轉成 `int*`，C++ 不會 ⟹ 補上轉型 `(int*)`。
 *   要轉成什麼由**接收它的那一邊**說：宣告的型別（`type` ＋ 元件宣告的 `typeSuffix`），或指定的左邊（Cella 給的型別）。
 *   問不出來的照原樣留著（C++ 判決會說不收——那是誠實的）。
 * `struct Point p;` → `Point p;`：C++ 裡宣告過的 struct 名字本身就是型別（C 才要寫標籤）。只動**型別那幾格**
 *   （屬性名是 `type`／`return_type`／`target_type`…）、只動**這支程式自己宣告的** struct 名字——字串字面不碰。
 *   純形式：Cella 的判決不受影響（兩邊判決相同的護欄照樣量）。不計入「換了幾行」（那是 I/O 與意思的事）。
 * 標頭：原文寫的 C 標頭換成 C++ 的名字（`<stdio.h>` → `<cstdio>`）；新用到的（`<iostream>`）由自動補標頭照元件補（`auto-include.ts`）。
 */
export function convertCToCpp(root: SemanticNode, types: ExpressionTypes): CToCppResult {
  let converted = 0
  let kept = 0
  const pointerType = (t: string | undefined): string | null => {
    const c = t?.replace(/\s+/g, '').trim()
    return c && c.endsWith('*') && c !== 'void*' ? c : null
  }
  const declaredType = (d: SemanticNode): string | undefined => {
    if (typeof d.properties.type !== 'string') return undefined
    const suffix = componentTraits(d.componentId)?.typeSuffix
    return `${d.properties.type}${typeof suffix === 'string' ? suffix : ''}`
  }
  // 名字 → 宣告的型別：指定的左邊是一個左值，Cella 的型別表不一定有它（實測 `s = malloc(4)` 的 `s` 沒有）。
  // ⚠️ 不分作用域（同名的遮蔽取第一個）——問錯的代價是補錯轉型，而兩邊判決的護欄會抓到
  const declared = new Map<string, string>()
  const collect = (n: SemanticNode): void => {
    const t = declaredType(n)
    if (t && typeof n.properties.name === 'string' && !declared.has(n.properties.name)) declared.set(n.properties.name, t)
    for (const kids of Object.values(n.slots ?? {})) kids.forEach(collect)
  }
  collect(root)
  // 🟢 第四刀：malloc／free → new[]／delete[]（2026-11-08）——整支程式全有或全無（見 `mallocAsNew`）
  // 指到的型別取宣告原本的寫法（`struct P`，不去空白）——`pointerType` 會把空白拿掉，那是給比對用的
  const mn = mallocAsNew(root, (d) => (pointerType(declaredType(d)) ? declaredType(d)!.trim().replace(/\s*\*$/, '') : null))
  root = mn.tree
  converted += mn.converted
  kept += mn.kept
  /** 接收 `n` 的槽要的型別：宣告的初值 → 宣告的型別；指定的值 → 左邊的型別（判決給的，沒有就查宣告） */
  const receiverType = (parent: SemanticNode, slot: string): string | null => {
    if (slot === 'initializer') return pointerType(declaredType(parent))
    if (slot === 'value') {
      const target = parent.slots.target?.[0]
      if (!target) return null
      const byName = typeof target.properties.name === 'string' ? declared.get(target.properties.name) : undefined
      return pointerType(types[target.id]) ?? pointerType(byName)
    }
    return null
  }
  // 第五刀：整支程式有沒有 `%f`／`%.Nf` 的 printf（有的話 `%g` 那幾行保留——見 printfAsCout）。保守：不管它最後換不換，有就算
  let fixedInProgram = false
  const scanFixed = (n: SemanticNode): void => {
    const io = ioTraitOf(n.componentId)
    if (io?.style === 'cstdio' && io.role === 'print' && splitFormat(String(n.properties.format ?? ''))?.some((p) => 'prec' in p && p.prec !== undefined)) fixedInProgram = true
    for (const kids of Object.values(n.slots ?? {})) kids.forEach(scanFixed)
  }
  scanFixed(root)
  const structs = collectStructNames(root)
  const tagRe = structs.size > 0 ? new RegExp(`\\bstruct\\s+(${[...structs].map((x) => x.replace(/\W/g, '')).join('|')})\\b`, 'g') : null
  const untag = (n: SemanticNode): SemanticNode => {
    if (!tagRe) return n
    let props: Record<string, unknown> | null = null
    const isTypeKey = (k: string): boolean => /(^|_)type\d?$/.test(k)
    for (const [k, v] of Object.entries(n.properties ?? {})) {
      if (typeof v === 'string' && isTypeKey(k)) {
        const t = v.replace(tagRe, '$1')
        if (t !== v) (props ??= { ...n.properties })[k] = t
      } else if (Array.isArray(v) && v.some((e) => e && typeof e === 'object')) {
        // 參數表（`params: [{ type, name }]`）——同一條規則套到每一格的型別欄
        let changed = false
        const arr = v.map((e) => {
          if (!e || typeof e !== 'object') return e
          const o = e as Record<string, unknown>
          let out: Record<string, unknown> | null = null
          for (const [ek, ev] of Object.entries(o)) {
            if (typeof ev !== 'string' || !isTypeKey(ek)) continue
            const t = ev.replace(tagRe, '$1')
            if (t !== ev) { (out ??= { ...o })[ek] = t; changed = true }
          }
          return out ?? e
        })
        if (changed) (props ??= { ...n.properties })[k] = arr
      }
    }
    return props ? { ...n, properties: props as SemanticNode['properties'] } : n
  }
  const visit = (raw: SemanticNode): SemanticNode => {
    const n = untag(raw)
    if (isIncludeDirective(n.componentId) && typeof n.properties.header === 'string') {
      const header = normalizeHeader(n.properties.header).replace(/^<|>$/g, '')
      if (header !== n.properties.header) return { ...n, properties: { ...n.properties, header } }
    }
    const bodies = new Set(bodySlotsOf(n.componentId))
    const slots: Record<string, SemanticNode[]> = {}
    for (const [slot, kids] of Object.entries(n.slots ?? {})) {
      slots[slot] = kids.map((kid) => {
        const io = ioTraitOf(kid.componentId)
        if (bodies.has(slot) && io?.style === 'cstdio' && (io.role === 'print' || io.role === 'input')) {
          const made = io.role === 'print' ? printfAsCout(kid, types, fixedInProgram) : scanfAsCin(kid, types)
          if (made) { converted++; return made }
          kept++
          return kid
        }
        if (isUncastMalloc(kid)) {
          const t = receiverType(n, slot)
          if (t) { converted++; return visit(castMallocTo(kid, t)) }
          kept++
        }
        return visit(kid)
      })
    }
    return { ...n, slots }
  }
  return { tree: visit(root), converted, kept }
}

/**
 * **C → C++ 第四刀：`malloc`／`free` → `new`／`delete`**（2026-11-08；c-bridge 第 4 課整課在講它）。
 *
 * 換錯的代價是未定義行為（`free` 一塊 `new` 出來的記憶體、`delete` 用錯形式），所以**整支程式全有或全無**，三個條件都成立才換：
 * 1. 每一個 malloc 都是某個指標宣告的初值，而且換得成 `new T[n]`／`new T`（元素型別對得上，見 `mallocNewShape`）；
 * 2. 每一個 free 的對象都是那些指標之一（`q = p; free(q)`、在函式裡 free 參數 ⟹ 不換）；
 * 3. 那些指標的每一次出現都只是 `free(p)` 的對象，或透過它取一個位置（`p[i]`、`*p`、`p->x`——元件宣告了 `addressable`；p 本身不變）；
 *    比較、傳給函式、`p++`、`&p` 都不換（保守：寧可留 C 寫法）。
 * 名字宣告了不只一次（遮蔽）也不換。不換的時候 malloc 照舊由後面那一步補轉型。
 */
function mallocAsNew(root: SemanticNode, pointeeOf: (decl: SemanticNode) => string | null): { tree: SemanticNode; converted: number; kept: number } {
  const decls = new Map<string, { count: SemanticNode | null } | null>()
  const declCount = new Map<string, number>()
  let mallocs = 0, frees = 0, ok = true
  const uses: { name: string; parent: SemanticNode }[] = []
  const walk = (n: SemanticNode, parent: SemanticNode | null): void => {
    if (typeof n.properties?.name === 'string' && n.slots?.initializer) declCount.set(n.properties.name, (declCount.get(n.properties.name) ?? 0) + 1)
    const init = n.slots?.initializer?.[0]
    if (init && isMalloc(init) && typeof n.properties.name === 'string') {
      const elem = pointeeOf(n)
      const shape = elem ? mallocNewShape(init, elem, sizeofTypeTarget) : null
      decls.set(n.properties.name, shape)
      if (!shape) ok = false
    }
    if (isMalloc(n)) { mallocs++; if (!parent || parent.slots?.initializer?.[0] !== n) ok = false }
    const freed = freedPointer(n)
    if (freed) { frees++; if (!varRefName(freed)) ok = false }
    const ref = varRefName(n)
    if (ref && parent) uses.push({ name: ref, parent })
    for (const kids of Object.values(n.slots ?? {})) kids.forEach((k) => walk(k, n))
  }
  walk(root, null)
  if (mallocs === 0 && frees === 0) return { tree: root, converted: 0, kept: 0 }
  const names = new Set([...decls].filter(([, s]) => s).map(([k]) => k))
  if (ok) {
    for (const [name] of decls) if ((declCount.get(name) ?? 0) !== 1) ok = false
    for (const u of uses) {
      if (!names.has(u.name)) continue
      if (!(freedPointer(u.parent) || isAddressable(u.parent.componentId))) ok = false
    }
    // 每一個 free 的對象都要在名單裡
    const checkFrees = (n: SemanticNode): void => {
      const f = freedPointer(n)
      if (f && !names.has(varRefName(f) ?? '')) ok = false
      for (const kids of Object.values(n.slots ?? {})) kids.forEach(checkFrees)
    }
    checkFrees(root)
  }
  if (!ok || names.size === 0) return { tree: root, converted: 0, kept: mallocs + frees }
  const rewrite = (n: SemanticNode): SemanticNode => {
    const f = freedPointer(n)
    if (f) return buildDelete(f, decls.get(varRefName(f)!)!.count !== null)
    const slots: Record<string, SemanticNode[]> = {}
    for (const [slot, kids] of Object.entries(n.slots ?? {})) {
      slots[slot] = kids.map((k) => {
        if (slot === 'initializer' && isMalloc(k) && typeof n.properties.name === 'string') {
          const shape = decls.get(n.properties.name)!
          return buildNew(pointeeOf(n)!, shape.count)
        }
        return rewrite(k)
      })
    }
    return { ...n, slots }
  }
  return { tree: rewrite(root), converted: mallocs + frees, kept: 0 }
}
