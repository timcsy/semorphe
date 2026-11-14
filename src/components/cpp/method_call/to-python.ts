/**
 * 這顆元件寫成 Python（460）：只收 `cin.ignore()`（不帶引數：丟掉一個字元——`cin >> n` 之後丟掉行尾的換行，接著 getline）。
 * 其餘的方法呼叫還沒有對應
 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const obj = n.slots.obj?.[0]
    const isCin = obj?.properties?.name === 'cin' && Object.values(obj.slots ?? {}).every((k) => k.length === 0)
    if (isCin && n.properties.method === 'ignore' && (n.slots.args?.length ?? 0) === 0) return [`${py.indent(depth)}${py.useLineReader('ignore')}`]
    return [py.keep(n, 'outside-subset', `「${String(obj?.properties?.name ?? '…')}.${String(n.properties.method ?? '')}()」還沒有對應`)]
  })
}
