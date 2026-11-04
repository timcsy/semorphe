/**
 * **換成 printf／scanf 時的型別表**（spec 215）——型別字串 → 格式與引數的寫法。
 *
 * 型別是**意思**，由判決提供者給（Cella 的 `types().nodes`：每個運算式在隱含轉換**之前**的型別，
 * 經核心的 `GeneratorContext.expressionTypes` 傳進來）；這裡只把它翻成 printf 的形式。
 *
 * 🔴 **保守**：表外的型別、查不到的節點、整支程式改過串流格式——一律「不知道」，那一行保留 `cout`／`cin`
 * 並註明（使用者 2026-11-04 定 A）。推錯會讓輸出變掉，而那正是這一刀要修的缺陷。
 *
 * ⚠️ double 用 `%g` 不用 `%f`：`cout << 1.5` 印 `1.5`（預設格式就是 `%g`、精度 6），`%f` 印 `1.500000`。
 * ⚠️ scanf 的 double 是 `%lf`；char 用 `" %c"`（與 `cin >>` 一樣先跳過空白）；`std::string` 讀不進。
 */
import type { SemanticNode } from '../../core/types'
import type { GeneratorContext } from '../../core/projection/code-generator'
import { declareGeneratedNote } from '../../core/projection/generated-notes'
import { changesStreamFormat, unsyncsStdio, ioTraitOf } from './lang/node-traits'

/** 推不出型別的那一行的註明——讀回來時核心會拿掉（`generated-notes`），不收成使用者的註解。 */
export const KEEP_COUT_NOTE = '型別判斷不出來，保留 cout'
export const KEEP_CIN_NOTE = '型別判斷不出來，保留 cin'
export const KEEP_STATE_NOTE = '程式改了串流的格式（fixed／setprecision…），保留 cout'
export const KEEP_UNSYNC_NOTE = 'sync_with_stdio(false) 之下不能混用，保留 iostream'
for (const n of [KEEP_COUT_NOTE, KEEP_CIN_NOTE, KEEP_STATE_NOTE, KEEP_UNSYNC_NOTE]) declareGeneratedNote(n)

/** `const int &` → `int`；`std::size_t` → `size_t`。 */
function normalize(type: string): string {
  return type.replace(/\bconst\b|\bvolatile\b|&+$/g, '').replace(/\s+/g, ' ').trim()
    .replace(/^std::size_t$/, 'size_t').replace(/\s*\*\s*$/, ' *')
}

const PRINTF: Record<string, string> = {
  'char': '%c', 'signed char': '%c', 'unsigned char': '%c',
  'bool': '%d', 'short': '%d', 'unsigned short': '%d', 'int': '%d',
  'unsigned int': '%u', 'unsigned': '%u',
  'long': '%ld', 'unsigned long': '%lu',
  'long long': '%lld', 'unsigned long long': '%llu',
  'size_t': '%zu',
  'float': '%g', 'double': '%g', 'long double': '%Lg',
  'char *': '%s',
}
const STRINGS = new Set(['std::string', 'string', 'std::basic_string<char>'])

/** printf 的轉換與引數寫法；`null` ＝ 不知道。 */
export function printfOf(type: string | undefined): { conv: string; arg: (expr: string) => string } | null {
  if (!type) return null
  const t = normalize(type)
  if (STRINGS.has(t)) return { conv: '%s', arg: (e) => `${/^[\w.]+$/.test(e) ? e : `(${e})`}.c_str()` }
  if (/^char ?\[\d*\]$/.test(t)) return { conv: '%s', arg: (e) => e }
  const conv = PRINTF[t]
  return conv ? { conv, arg: (e) => e } : null
}

const SCANF: Record<string, string> = {
  'char': ' %c', 'short': '%hd', 'int': '%d', 'unsigned int': '%u', 'unsigned': '%u',
  'long': '%ld', 'unsigned long': '%lu', 'long long': '%lld', 'unsigned long long': '%llu', 'size_t': '%zu',
  'float': '%f', 'double': '%lf', 'long double': '%Lf',
}

/** scanf 的轉換；`null` ＝ 不知道（含 `std::string`、`bool`——scanf 讀不進）。 */
export function scanfOf(type: string | undefined): string | null {
  if (!type) return null
  return SCANF[normalize(type)] ?? null
}

/** 這一行的 printf 寫法：格式字串與引數；`null` ＝ 有一個值推不出（整行保留 cout）。 */
export function printfLine(
  values: SemanticNode[], ctx: GeneratorContext, gen: (n: SemanticNode) => string,
  isText: (n: SemanticNode) => string | null, isBreak: (n: SemanticNode) => boolean,
): { fmt: string; args: string[] } | null {
  let fmt = ''
  const args: string[] = []
  for (const v of values) {
    if (isBreak(v)) { fmt += '\\n'; continue }
    const text = isText(v)
    if (text !== null) { fmt += text.replace(/%/g, '%%'); continue }
    const p = printfOf(ctx.expressionTypes?.[v.id])
    if (!p) return null
    fmt += p.conv
    args.push(p.arg(gen(v)))
  }
  return { fmt, args }
}

interface Facts { stateChanged: boolean; unsynced: boolean }
const factsMemo = new WeakMap<SemanticNode, Facts>()

/** 整支程式：改過串流格式嗎、關掉同步了嗎（形式上的保守答案——cella 2026-11-04：精確的要靠執行）。 */
export function streamFacts(root: SemanticNode | undefined): Facts {
  if (!root) return { stateChanged: false, unsynced: false }
  const hit = factsMemo.get(root)
  if (hit) return hit
  const f: Facts = { stateChanged: false, unsynced: false }
  const walk = (n: SemanticNode): void => {
    if (changesStreamFormat(n.componentId)) f.stateChanged = true
    if (unsyncsStdio(n.componentId)) f.unsynced = true
    for (const kids of Object.values(n.slots ?? {})) kids.forEach(walk)
  }
  walk(root)
  factsMemo.set(root, f)
  return f
}

/** 每一顆 iostream 的 I/O 元件自己登記「我換得過去嗎」（print／input 的產生器）；沒登記＝換不過去（保守）。 */
const convertibles = new Map<string, (n: SemanticNode, ctx: GeneratorContext) => boolean>()
export function declareConvertible(componentId: string, f: (n: SemanticNode, ctx: GeneratorContext) => boolean): void {
  convertibles.set(componentId, f)
}

/** 關掉同步的程式：每一行 iostream 的 I/O 都換得過去嗎——有一行不行，整支都不換（混用時輸出順序不保證）。 */
const allMemo = new WeakMap<SemanticNode, WeakMap<object, boolean>>()
const NO_TYPES = {}
export function everyIostreamConvertible(root: SemanticNode, ctx: GeneratorContext): boolean {
  const key = (ctx.expressionTypes as object | undefined) ?? NO_TYPES
  let byTypes = allMemo.get(root)
  if (!byTypes) { byTypes = new WeakMap(); allMemo.set(root, byTypes) }
  const hit = byTypes.get(key)
  if (hit !== undefined) return hit
  let ok = true
  const walk = (n: SemanticNode): void => {
    const io = ioTraitOf(n.componentId)
    if (io?.style === 'iostream' && io.role && !(convertibles.get(n.componentId)?.(n, ctx) ?? false)) ok = false
    for (const kids of Object.values(n.slots ?? {})) kids.forEach(walk)
  }
  walk(root)
  byTypes.set(key, ok)
  return ok
}
