/**
 * `cpp:malloc` 的 **lift** 路——**建構子**
 *
 * 判別（AST 節點長什麼樣）是 C++ 語法的知識，留在共用檔；
 * **節點的形狀**是這顆元件的知識，在這裡。
 *
 * ⚠️ `type` 是**轉型型別**（指標），不是元素型別——產生器寫的是 `(${type})malloc(…)`。
 * `void*` ＝ **沒有轉型**（`int *a = malloc(n);`，C 的慣用寫法；malloc 本來就回傳 `void*`）——產生器不寫轉型。
 */
import type { SemanticNode } from '../../../core/types'
import type { AstNode } from '../../../core/lift/types'
import { createNode } from '../../../core/semantic-tree'

export function buildMalloc(type: string, size: SemanticNode | null, sizeofType = 'none'): SemanticNode {
  return createNode('cpp:malloc', { type, sizeof_type: sizeofType }, { size: size ? [size] : [] })
}

/** 積木上「乘以 sizeof 哪個型別」的下拉選得到的（`forms/blocks.json` 的 SIZEOF_TYPE） */
const SIZEOF_CHOICES = new Set(['int', 'float', 'double', 'char'])

/**
 * malloc 的引數拆成「個數 × sizeof(型別)」——**積木上那兩格的形狀**。
 *
 * 🔴 2026-11-07 瀏覽器驗收抓到：lift 只把整個引數放進 `size`、`sizeof_type` 空著，而積木的下拉一定有值（預設 int）
 *    ⟹ 走一趟積木 `malloc(3 * sizeof(int))` 變成 `malloc(3 * sizeof(int) * sizeof(int))`、`(char*)malloc(10)` 變成
 *    `malloc(10 * sizeof(int))`——**配置的大小靜靜地變了**。
 * 拆得開（`X * sizeof(T)`、T 在下拉裡）就拆；拆不開的 `sizeof_type` 是 `none`（直接寫位元組數）。
 */
export function liftMallocArg(
  arg: AstNode | undefined, lift: (n: AstNode) => SemanticNode | null,
): { size: SemanticNode | null; sizeofType: string } {
  if (!arg) return { size: null, sizeofType: 'none' }
  if (arg.type === 'binary_expression' && arg.childForFieldName('operator')?.text === '*') {
    const left = arg.childForFieldName('left')
    const right = arg.childForFieldName('right')
    const t = right?.type === 'sizeof_expression' ? right.childForFieldName('type')?.text?.trim() : undefined
    if (left && t && SIZEOF_CHOICES.has(t)) return { size: lift(left), sizeofType: t }
  }
  return { size: lift(arg), sizeofType: 'none' }
}

/** 這顆由共用檔**呼叫**建構子，不是被問判別。 */
export function registerLift(): void {}

/** 沒有轉型的 malloc 嗎（`void*`；舊的樹寫 `void`）——C → C++ 要替它補轉型（`src/languages/cpp/c-to-cpp.ts`）。 */
export function isUncastMalloc(n: SemanticNode): boolean {
  return n.componentId === 'cpp:malloc' && (n.properties.type === 'void*' || n.properties.type === 'void')
}

/** 同一顆 malloc，轉型成 `type`（不改原節點） */
export function castMallocTo(n: SemanticNode, type: string): SemanticNode {
  return { ...n, properties: { ...n.properties, type } }
}

/**
 * 這顆 malloc 換成 `new` 會是什麼樣子（C → C++，2026-11-08）：
 * - `malloc(n * sizeof(T))`（積木的「乘以 sizeof」選了 T）→ 陣列 `new T[n]`
 * - `malloc(sizeof(T))` → 單一 `new T`
 * T 要等於接收那一邊的元素型別（`elem`）；轉型若有寫，也要是 `T*`。其餘回 null（照舊補轉型、不換）。
 * `sizeofTarget` 由呼叫端給（sizeof 是另一顆膠囊的身分）。
 */
export function mallocNewShape(
  n: SemanticNode, elem: string, sizeofTarget: (n: SemanticNode | undefined) => string | null,
): { count: SemanticNode | null } | null {
  if (n.componentId !== 'cpp:malloc') return null
  const norm = (t: string | null | undefined): string => String(t ?? '').replace(/\s+/g, '')
  const cast = norm(n.properties.type as string)
  if (!(cast === 'void*' || cast === 'void' || cast === `${norm(elem)}*`)) return null
  const size = n.slots.size?.[0]
  const st = String(n.properties.sizeof_type ?? 'none')
  if (st !== 'none') return norm(st) === norm(elem) && size ? { count: size } : null
  return norm(sizeofTarget(size)) === norm(elem) ? { count: null } : null
}

/** 是一顆 malloc 嗎（不論有沒有轉型）——C → C++ 數「整支程式的 malloc 是不是都換得了」時用 */
export function isMalloc(n: SemanticNode): boolean {
  return n.componentId === 'cpp:malloc'
}

/** 積木上「乘以 sizeof」下拉選得到這個型別嗎——C++ → C 把 `new T[n]` 換成 `malloc(n * sizeof(T))` 時用（357） */
export function isSizeofChoice(t: string): boolean {
  return SIZEOF_CHOICES.has(t.trim())
}
