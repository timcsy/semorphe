/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'
import { cppString } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  // print(a, b, sep=…, end=…) → cout << a << sep << b << end。sep／end 只收字串字面量（research R5）
  r.stmt((n, cpp, depth) => {
    const values = n.slots.values ?? []
    const named = (k: string) => values.find((v) => v.componentId.endsWith(':func_call_named') && v.properties?.name === k)
    const lit = (k: string, dflt: string): string | null => {
      const v = named(k)
      if (!v) return dflt
      const x = v.slots?.value?.[0]
      return x?.componentId.endsWith(':literal_string') ? String(x.properties?.value ?? '') : null
    }
    const sep = lit('sep', ' '), end = lit('end', '\n')
    if (sep === null || end === null) return [cpp.keep(n, 'outside-subset', 'print 的 sep／end 不是字串字面量')]
    const parts: string[] = []
    for (const v of values.filter((x) => !x.componentId.endsWith(':func_call_named'))) {
      // 印字串字面量：直接寫字面量（string("…") 是給 + 串接用的）
      if (v.componentId.endsWith(':literal_string')) { parts.push(cppString(String(v.properties?.value ?? ''))); continue }
      const t = cpp.pyType(v)
      // 浮點：Python 印 repr（2.0、0.30000000000000004）、cout 預設印 2——換成小函式 float_text 照 repr 的規則印（404）
      if (t === 'float') { parts.push(`${cpp.useHelper('float_text')}(${cpp.expr(v)})`); continue }
      if (t === 'list[int]' || t === 'list[str]') { parts.push(`${cpp.useHelper(t === 'list[int]' ? 'list_text_int' : 'list_text_str')}(${cpp.expr(v)})`); continue }
      if (t && /^(list|dict|set|tuple)/.test(t)) { cpp.keep(v, 'outside-subset', `印 ${t}：Python 會印出整個容器的樣子`); continue }
      if (t === 'bool') { parts.push(`(${cpp.expr(v)} ? "True" : "False")`); continue }
      if (!t && !v.componentId.endsWith(':literal_string')) { cpp.keep(v, 'type-uncertain', '印出的值型別說不準'); continue }
      parts.push(cpp.expr(v))
    }
    const items: string[] = []
    parts.forEach((p, i) => { if (i > 0 && sep !== '') items.push(cppString(sep)); items.push(p) })
    if (end !== '') items.push(cppString(end))
    return items.length === 0 ? [] : [`${cpp.indent(depth)}cout << ${items.join(' << ')};`]
  })
}
