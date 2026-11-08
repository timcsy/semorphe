/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const name = String(n.properties.name ?? '')
    // 骨架的進入點（C++ 的 main）本體攤平到頂層（Python 的程式從頂層開始跑）
    if (py.isEntryFunction(name) && depth === 0) {
      // 最後一句 `return 0;` 拿掉（問形狀：只有 value 槽、值是字面 0）；中途的 return 由 return 那顆保留（後面的程式不會跑）
      const body = [...(n.slots.body ?? [])]
      const last = body[body.length - 1]
      const lastV = last?.slots?.value?.[0]
      if (last && Object.keys(last.slots ?? {}).join() === 'value' && lastV?.properties?.value === '0' && !lastV.slots?.left) body.pop()
      return py.blockAsMain(body)
    }
    const params: string[] = []
    for (const p of n.slots.params ?? []) {
      const t = String(p.properties.type ?? '')
      // 參考與容器的傳遞語意兩邊不同（C++ 傳值會複製 vector、Python 傳的是同一個 list）——第一版不換
      // string 以值或 const 參考傳：Python 的字串不能改 ⟹ 兩邊意思相同；其餘參考、指標、容器照舊保留
      const okString = /^(const\s+)?(std::)?string(\s*&)?$/.test(t.trim()) && (!t.includes('&') || /^const/.test(t.trim()))
      if (!okString && /[&*]|vector|\[|string/.test(t)) return [py.keep(p, 'outside-subset', `參數「${t} ${String(p.properties.name ?? '')}」的傳遞方式兩個語言不同`)]
      params.push(py.name(String(p.properties.name ?? '')))
    }
    return [`${py.indent(depth)}def ${py.name(name)}(${params.join(', ')}):`, ...py.block(n.slots.body, depth + 1)]
  })
}
