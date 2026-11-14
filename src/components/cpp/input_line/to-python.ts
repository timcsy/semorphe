/**
 * 這顆元件寫成 Python（460）：`getline(cin, s)` → `s = read_line()`——讀**這一行還沒讀的部分**（同 C++：
 * `cin >> n` 之後的 getline 拿到的是那一行剩下的字，常是空字串）；沒有剩下的才讀下一行。只收讀進 string
 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.writes((n) => n.slots.target ?? [])
  r.lineRead()
  r.stmt((n, py, depth) => {
    const t = n.slots.target?.[0]
    if (!t) return [py.keep(n, 'outside-subset', 'getline 沒有讀進的變數')]
    const ty = (py.typeOf(t) ?? '').replace(/^const\s+/, '')
    if (!/string/.test(ty) && !py.isDeclaredString(String(t.properties?.name ?? ''))) return [py.keep(n, 'needs-types', 'getline 讀進的不是判斷得出的 string')]
    return [`${py.indent(depth)}${py.target(t, false).text} = ${py.useLineReader('line')}`]
  })
}
