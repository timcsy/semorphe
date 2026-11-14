/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { isLineBreak } from '../../../languages/cpp/lang/node-traits'

export function registerToPython(r: ToPythonRegistrar): void {
  // `cout << a << b << endl` → print(a, b, sep="")；沒有 endl 結尾 → end=""。值照型別：double 用 :g（同 cout 預設）、bool 印 0／1
  r.stmt((n, py, depth) => {
    const values = n.slots.values ?? []
    const lines: string[] = []
    let seg: string[] = []
    const flush = (newline: boolean): void => {
      // 只有一個值時不寫 sep（道地的寫法）；好幾個值時 sep="" 讓它們接在一起（同 cout）
      const args = [...seg, ...(seg.length > 1 ? ['sep=""'] : []), ...(newline ? [] : ['end=""'])]
      lines.push(`${py.indent(depth)}print(${args.join(', ')})`)
      seg = []
    }
    for (const v of values) {
      if (isLineBreak(v.componentId)) { flush(true); continue }
      seg.push(shown(v, py))
    }
    if (seg.length > 0) flush(false)
    return lines
  })
}

/** 一個要印的值寫成 Python：字面量照原樣；其餘看 Cella 給的型別 */
function shown(v: import('../../../core/types').SemanticNode, py: import('../../../languages/cpp/to-python/contract').ToPythonContext): string {
  const e = py.expr(v)
  if (v.properties?.value !== undefined && !v.slots?.left && Object.keys(v.slots ?? {}).length === 0 && typeof v.properties.value === 'string' && /^"/.test(e)) return e
  if (py.yieldsBool(v)) return `int(${e})`
  const t = (py.typeOf(v) ?? '').replace(/^const\s+/, '').replace(/\s*&$/, '')
  if (t === 'double' || t === 'float' || t === 'long double') return `format(${e}, "g")`
  if (t === 'bool') return `int(${e})`
  // char：cout 印出字元——Python 那邊是長度 1 的字串，直接印（364）
  if (t === 'char') return e
  if (/^(int|long|long long|short|unsigned( int| long| long long)?|size_t)$/.test(t) || /string|char\s*\[|^(const )?char \*$/.test(t)) return e
  if (t === '') return py.keep(v, 'needs-types', '這個值的型別判斷不出來（印法要看型別：整數、浮點、布林印的樣子不同）')
  return py.keep(v, 'outside-subset', `型別「${t}」的印法還沒有對應`)
}
