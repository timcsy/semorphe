/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import type { SemanticNode } from '../../../core/types'

/**
 * `vector<T>&`／`const vector<T>&`／`const vector<T>` 的參數（447）：Python 的 list 傳進函式本來就是同一個物件
 * ⟹ 改元素、`push_back` 兩邊都改到呼叫端那一個，意思相同。只有一件事兩邊不同：**整個重新指定**（C++ 的 `a = b`
 * 把 b 複製進呼叫端那一個；Python 的 `a = …` 只換掉函式裡的名字）——本體裡有就照舊保留。
 * 元素型別限 vector 那顆換得過去的幾種（int／long／long long／short／double／string）；傳值而且不是 const 的會複製，照舊保留。
 */
function sharedListParam(t: string, name: string, fn: SemanticNode): boolean {
  const m = t.trim().match(/^(const\s+)?(?:std::)?vector\s*<\s*(int|long|long long|short|double|(?:std::)?string)\s*>\s*(&?)$/)
  if (!m || (!m[1] && !m[3])) return false
  return !rebinds(fn.slots.body ?? [], name)
}

/**
 * 本體裡有沒有一句把這個名字整個重新指定（`a = …`）或在裡面另外宣告同名的變數——**問形狀，不點名別顆元件**（就近性護欄）：
 * 指定 ＝ 只有 target／value 兩個槽；目標是「同名、沒有子節點」的葉子；宣告 ＝ 同名而且帶型別。寧可多保留，不可漏掉
 */
function rebinds(nodes: readonly SemanticNode[], name: string): boolean {
  const isName = (x: SemanticNode | undefined): boolean => !!x && x.properties?.name === name && Object.values(x.slots ?? {}).every((v) => !v?.length)
  for (const n of nodes) {
    const keys = Object.keys(n.slots ?? {}).filter((k) => n.slots[k]?.length)
    if (keys.includes('target') && keys.every((k) => k === 'target' || k === 'value') && isName(n.slots.target[0])) return true
    if (n.properties?.name === name && n.properties?.type !== undefined) return true
    for (const k of Object.keys(n.slots ?? {})) if (rebinds(n.slots[k], name)) return true
  }
  return false
}

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
      // 樣板型別（`<`：stack／queue／map…）以值傳也是複製一份 ⟹ 一律保留（448：stack 換得過去之後，傳值的 stack 參數不能漏掉）
      // string 以值或 const 參考傳：Python 的字串不能改 ⟹ 兩邊意思相同；其餘參考、指標、容器照舊保留
      const okString = /^(const\s+)?(std::)?string(\s*&)?$/.test(t.trim()) && (!t.includes('&') || /^const/.test(t.trim()))
      if (!okString && !sharedListParam(t, String(p.properties.name ?? ''), n) && /[&*<]|vector|\[|string/.test(t)) return [py.keep(p, 'outside-subset', `參數「${t} ${String(p.properties.name ?? '')}」的傳遞方式兩個語言不同`)]
      params.push(py.name(String(p.properties.name ?? '')))
    }
    return [`${py.indent(depth)}def ${py.name(name)}(${params.join(', ')}):`, ...py.block(n.slots.body, depth + 1)]
  })
}
