/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { writeTo } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  // `cin >> a` 寫進 values（`cout << a` 的 values 是讀——形狀一樣，所以自己說；453 計次迴圈問上界會不會被改）
  r.writes((n) => n.slots.values ?? [])
  // 當條件（`while (cin >> x)`，459）時由迴圈那顆換：它問的是「這一顆是不是串流讀入」
  r.streamRead()
  // `cin >> a >> b;` → 一個一個讀詞（同 cin；research R4 的修正）；型別照宣告：int／float／str
  r.stmt((n, py, depth) => {
    const targets = n.slots.values ?? []
    if (targets.length === 0) return []
    // 目標的寫法先問（465：pair 的成員要重建整個 tuple；目標自己知道成員的型別）
    const tgs = targets.map((t) => py.target(t, false))
    const conv = targets.map((t, k) => {
      const ty = (py.typeOf(t) ?? tgs[k].type ?? '').replace(/^const\s+/, '').replace(/\s*&$/, '')
      if (/^(int|long|long long|short)$/.test(ty)) return 'int'
      if (ty === 'double' || ty === 'float') return 'float'
      if (/string/.test(ty)) return 'str'
      // char 讀一個非空白字元、bool 讀 0／1（468）——各自一支小工具
      if (ty === 'char') return 'char'
      if (ty === 'bool') return 'bool'
      // `cin >> s`（s 是 string）走的是函式庫的 operator>>：Cella 在這格報的是那次呼叫的型別（std::istream），不是 s 的型別
      if (ty === 'std::istream' && py.isDeclaredString(String(t.properties?.name ?? ''))) return 'str'
      return ty === '' ? null : undefined
    })
    if (conv.some((c) => c === null)) return [py.keep(n, 'needs-types', '讀入的變數型別判斷不出來')]
    if (conv.some((c) => c === undefined)) return [py.keep(n, 'outside-subset', '讀入這種型別的寫法還沒有對應')]
    // 一個一個讀（同 cin：空白、換行都是分隔）——不假設一句讀一行
    const tok = py.useTokenReader()
    const read = (c: string | null | undefined): string => c === 'str' ? tok : c === 'char' || c === 'bool' ? py.useValueReader(c) : `${c}(${tok})`
    return tgs.map((tg, k) => `${py.indent(depth)}${writeTo(tg, read(conv[k]))}`)
  })
}
