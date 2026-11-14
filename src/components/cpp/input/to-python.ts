/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  // `cin >> a` 寫進 values（`cout << a` 的 values 是讀——形狀一樣，所以自己說；453 計次迴圈問上界會不會被改）
  r.writes((n) => n.slots.values ?? [])
  // `cin >> a >> b;` → 一個一個讀詞（同 cin；research R4 的修正）；型別照宣告：int／float／str
  r.stmt((n, py, depth) => {
    const targets = n.slots.values ?? []
    if (targets.length === 0) return []
    const conv = targets.map((t) => {
      const ty = (py.typeOf(t) ?? '').replace(/^const\s+/, '').replace(/\s*&$/, '')
      if (/^(int|long|long long|short)$/.test(ty)) return 'int'
      if (ty === 'double' || ty === 'float') return 'float'
      if (/string/.test(ty)) return 'str'
      // `cin >> s`（s 是 string）走的是函式庫的 operator>>：Cella 在這格報的是那次呼叫的型別（std::istream），不是 s 的型別
      if (ty === 'std::istream' && py.isDeclaredString(String(t.properties?.name ?? ''))) return 'str'
      return ty === '' ? null : undefined
    })
    if (conv.some((c) => c === null)) return [py.keep(n, 'needs-types', '讀入的變數型別判斷不出來')]
    if (conv.some((c) => c === undefined)) return [py.keep(n, 'outside-subset', '讀入這種型別的寫法還沒有對應')]
    // 一個一個讀（同 cin：空白、換行都是分隔）——不假設一句讀一行
    const tok = py.useTokenReader()
    return targets.map((t, k) => `${py.indent(depth)}${py.target(t, false).text} = ${conv[k] === 'str' ? tok : `${conv[k]}(${tok})`}`)
  })
}
