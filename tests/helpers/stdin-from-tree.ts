/**
 * **測資怎麼來：問程式自己**（從 `tests/probes/studycpp-behaves.test.ts` 搬出來，spec 199 的 Cella 覆蓋缺口探針也用）。
 *
 * 語義樹裡有每一次讀取的型別與順序——照那個順序生一份輸入。判準不是「這份輸入對那一題有意義」，是**兩邊餵同一份**。
 */
import type { SemanticNode } from '../../src/core/types'

/** 走遍整棵樹（含所有槽）。 */
function walk(n: SemanticNode | undefined, fn: (x: SemanticNode) => void): void {
  if (!n || typeof n !== 'object') return
  fn(n)
  for (const v of Object.values(n.slots ?? {})) {
    if (Array.isArray(v)) for (const c of v) walk(c as SemanticNode, fn)
    else walk(v as SemanticNode, fn)
  }
}

/** 名字 → 宣告的型別。⚠️ 同名重複宣告時**後面的贏**，與 C++ 的遮蔽方向一致。 */
function typeOfNames(tree: SemanticNode): Map<string, string> {
  const m = new Map<string, string>()
  walk(tree, (n) => {
    if (!n.componentId?.endsWith(':var_declare') && !n.componentId?.endsWith(':array_declare')) return
    const t = String((n.properties as Record<string, unknown>)?.type ?? '')
    const name = String((n.properties as Record<string, unknown>)?.name ?? '')
    if (name) m.set(name, t)
  })
  return m
}

/** 一次讀取要吃掉什麼型別的一個 token。 */
export type Kind = 'int' | 'double' | 'char' | 'string'

function kindOf(t: string): Kind {
  const s = t.replace(/[&*]/g, '').trim()
  if (/^(double|float|long double)$/.test(s)) return 'double'
  if (s === 'char') return 'char'
  if (/string/.test(s)) return 'string'
  return 'int'
}

/** 這支程式的讀取排程——**照原始碼順序**，而且標出哪些在迴圈裡。 */
export function readSchedule(tree: SemanticNode): { kinds: Kind[]; inLoop: Kind[] } {
  const types = typeOfNames(tree)
  const kinds: Kind[] = []
  const inLoop: Kind[] = []
  const visit = (n: SemanticNode | undefined, depth: number): void => {
    if (!n || typeof n !== 'object') return
    const id = n.componentId ?? ''
    const isLoop = /:(loop_while|loop_for|loop_count|loop_do|container_iter)$/.test(id)
    if (/:(input|input_formatted|input_line)$/.test(id)) {
      const vals = (n.slots?.values ?? []) as SemanticNode[]
      for (const v of Array.isArray(vals) ? vals : [vals]) {
        // 目標可能是 `a`、`a[i]`、`s` —— 一律從名字查宣告
        let name = ''
        walk(v, (x) => {
          const nm = String((x.properties as Record<string, unknown>)?.name ?? '')
          if (nm && !name) name = nm
        })
        const k = kindOf(types.get(name) ?? 'int')
        kinds.push(k)
        if (depth > 0) inLoop.push(k)
      }
      if (/:input_line$/.test(id) && (n.slots?.values ?? []).length === 0) kinds.push('string')
    }
    for (const v of Object.values(n.slots ?? {})) {
      if (Array.isArray(v)) for (const c of v) visit(c as SemanticNode, depth + (isLoop ? 1 : 0))
      else visit(v as SemanticNode, depth + (isLoop ? 1 : 0))
    }
  }
  visit(tree, 0)
  return { kinds, inLoop }
}

/**
 * 照排程生一份輸入。
 *
 * 🔴 **第一個整數刻意小**（3–8）——競賽題幾乎都是「先讀 n，再讀 n 筆」，
 *    而 n 大一點就會讀到餓死或跑很久。
 * ⚠️ 判準**不是「這份輸入對那一題有意義」**，是【兩邊餵同一份】：
 *    輸入合不合題意，不影響「g++ 印 A 而我們印 B」這個判定。
 */
export function makeStdin(
  sch: { kinds: Kind[]; inLoop: Kind[] }, seed: number, tail = 200,
): string[] {
  let x = seed * 2654435761 % 2147483647
  const rnd = (n: number): number => { x = (x * 48271) % 2147483647; return x % n }
  const tok = (k: Kind, first: boolean): string =>
    k === 'double' ? `${1 + rnd(9)}.${rnd(9)}`
      : k === 'char' ? String.fromCharCode(97 + rnd(26))
        : k === 'string' ? ['ab', 'cd', 'hello', 'xy', 'semorphe'][rnd(5)]
          : String(first ? 3 + rnd(6) : 1 + rnd(20))
  const out: string[] = []
  sch.kinds.forEach((k, i) => out.push(tok(k, i === 0)))
  // 迴圈裡的讀取不知道會跑幾圈——多給一些，餓死比多餵更難查
  const cycle = sch.inLoop.length > 0 ? sch.inLoop : []
  for (let i = 0; i < tail && cycle.length > 0; i++) out.push(tok(cycle[i % cycle.length], false))
  return out
}
