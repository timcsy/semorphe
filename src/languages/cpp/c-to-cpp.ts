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
import { bodySlotsOf, ioTraitOf, isAddressable } from '../../core/component/traits'
import { printfOf, scanfOf } from './printf-types'
import { normalizeHeader } from './header-aliases'
import { isIncludeDirective } from './lang/node-traits'
import { buildPrint } from '../../components/cpp/print/lift'
import { buildInput } from '../../components/cpp/input/lift'
import { buildEndl } from '../../components/cpp/endl/lift'
import { buildLiteralString } from '../../components/cpp/literal_string/lift-strategy'

/** 每個運算式的型別（Cella `types().nodes`，鍵是語意樹節點 id） */
export type ExpressionTypes = Readonly<Record<string, string>>

type Piece = { text: string } | { conv: string }

/** 格式字串（原始碼的寫法，跳脫照原樣）切成文字與轉換；有旗標／寬度／精度的轉換回 null。 */
function splitFormat(fmt: string): Piece[] | null {
  const out: Piece[] = []
  let text = ''
  for (let i = 0; i < fmt.length; i++) {
    const ch = fmt[i]
    if (ch === '\\') { text += fmt.slice(i, i + 2); i++; continue }
    if (ch !== '%') { text += ch; continue }
    if (fmt[i + 1] === '%') { text += '%'; i++; continue }
    const m = /^%(hh|h|ll|l|z|L)?([diucsgf])/.exec(fmt.slice(i))
    if (!m) return null
    if (text) out.push({ text }); text = ''
    out.push({ conv: `%${m[1] ?? ''}${m[2] === 'i' ? 'd' : m[2]}` })
    i += m[0].length - 1
  }
  if (text) out.push({ text })
  return out
}

/** `printf(fmt, args…)` 的 cout 寫法；`null` ＝ 換了會印出不一樣的東西（保留 printf）。 */
export function printfAsCout(node: SemanticNode, types: ExpressionTypes): SemanticNode | null {
  const pieces = splitFormat(String(node.properties.format ?? ''))
  if (!pieces) return null
  const args = node.slots.args ?? []
  if (pieces.filter((p) => 'conv' in p).length !== args.length) return null
  const values: SemanticNode[] = []
  let k = 0
  for (const [i, p] of pieces.entries()) {
    if ('conv' in p) {
      const a = args[k++]
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
 * 標頭：原文寫的 C 標頭換成 C++ 的名字（`<stdio.h>` → `<cstdio>`）；新用到的（`<iostream>`）由自動補標頭照元件補（`auto-include.ts`）。
 */
export function convertCToCpp(root: SemanticNode, types: ExpressionTypes): CToCppResult {
  let converted = 0
  let kept = 0
  const visit = (n: SemanticNode): SemanticNode => {
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
          const made = io.role === 'print' ? printfAsCout(kid, types) : scanfAsCin(kid, types)
          if (made) { converted++; return made }
          kept++
          return kid
        }
        return visit(kid)
      })
    }
    return { ...n, slots }
  }
  return { tree: visit(root), converted, kept }
}
