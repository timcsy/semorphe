/**
 * 列舉常數的值（語義樹裡是一段原文）→ Cella 的運算式（344）。
 *
 * cella 2026-11-08：`enumC.v` 本來就是運算式，`1 << 2`、`A + 1` 都交給模型照常數運算式算。
 * 所以這裡**只解析、不求值**：把文字拆成運算子與運算元，值與合不合法歸 Cella（「意思歸 Cella」）。
 *
 * 認得的：整數／字元字面（交給已登記的字面量，`f.literalExpr`）、名字（巨集先展開，其餘送 eName 由 Cella 依作用域解析）、
 * 括號、一元 `- ~ !`（`+` 不改值，略過）、二元運算子（對照表同 `binOp`）。認不得的（三元、sizeof、轉型、呼叫）回 undefined
 * ——呼叫端照實標 unknown，不猜。
 */
import type { FormalizeContext, CellaJson } from '../../../core/formalize-contract'

const PREC: Record<string, number> = {
  '||': 1, '&&': 2, '|': 3, '^': 4, '&': 5, '==': 6, '!=': 6,
  '<': 7, '<=': 7, '>': 7, '>=': 7, '<<': 8, '>>': 8, '+': 9, '-': 9, '*': 10, '/': 10, '%': 10,
}
const UN: Record<string, string> = { '-': 'opNeg', '~': 'opBitNot', '!': 'opNot' }

const TOKEN = /\s*(0[xX][0-9a-fA-F]+[uUlL]*|\d+[uUlL]*|'(?:\\.|[^'\\])+'|[A-Za-z_]\w*|<<|>>|<=|>=|==|!=|&&|\|\||[-+*/%<>&|^~!()])/y

function tokenize(text: string): string[] | null {
  const out: string[] = []
  TOKEN.lastIndex = 0
  while (TOKEN.lastIndex < text.length) {
    if (/^\s*$/.test(text.slice(TOKEN.lastIndex))) break
    const m = TOKEN.exec(text)
    if (!m) return null
    out.push(m[1])
  }
  return out
}

export function constExpr(text: string, id: string, f: FormalizeContext): CellaJson | undefined {
  const toks = tokenize(text)
  if (!toks || toks.length === 0) return undefined
  let i = 0
  let seq = 0
  const next = (): string => `${id}/${seq++}`
  const fail = Symbol('fail')

  const primary = (): CellaJson | typeof fail => {
    const t = toks[i++]
    if (t === undefined) return fail
    if (t === '(') {
      const e = binary(0)
      if (e === fail || toks[i++] !== ')') return fail
      return e
    }
    if (t === '+') return primary()
    if (UN[t]) {
      const a = primary()
      return a === fail ? fail : f.k('eUn', { n: next(), op: f.k(UN[t]), a })
    }
    if (/^[A-Za-z_]/.test(t)) {
      if (t === 'sizeof' || toks[i] === '(') return fail // sizeof、呼叫：還沒有對應
      const m = f.macro(t)
      if (m) return m.expr(next())
      return f.k('eName', { n: next(), name: t })
    }
    return f.literalExpr(t, next()) ?? fail
  }

  const binary = (min: number): CellaJson | typeof fail => {
    let left = primary()
    if (left === fail) return fail
    for (;;) {
      const op = toks[i]
      const p = op === undefined ? undefined : PREC[op]
      const cop = op === undefined ? undefined : f.binOp(op)
      if (p === undefined || p < min || !cop) return left
      i++
      const right = binary(p + 1)
      if (right === fail) return fail
      left = f.k('eBin', { n: next(), op: f.k(cop), a: left, b: right })
    }
  }

  const e = binary(0)
  return e === fail || i !== toks.length ? undefined : e
}
