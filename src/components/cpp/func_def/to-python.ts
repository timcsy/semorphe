/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar, ToPythonContext } from '../../../languages/cpp/to-python/contract'
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

/** 本體裡宣告過的名字（同名而且帶型別——問形狀） */
function declaredNames(nodes: readonly SemanticNode[], acc = new Set<string>()): Set<string> {
  for (const n of nodes) {
    if (typeof n.properties?.name === 'string' && n.properties?.type !== undefined && n.slots?.params === undefined) acc.add(n.properties.name)
    for (const k of Object.keys(n.slots ?? {})) declaredNames(n.slots[k], acc)
  }
  return acc
}

/** 本體裡提到的全域名字（任何帶 name 的節點——寧多不少，後面還要問 Python 的文字裡有沒有指定它） */
function mentionedGlobals(nodes: readonly SemanticNode[], py: ToPythonContext, acc = new Set<string>()): Set<string> {
  for (const n of nodes) {
    for (const v of Object.values(n.properties ?? {})) if (typeof v === 'string' && py.isGlobal(v)) acc.add(v)
    for (const k of Object.keys(n.slots ?? {})) mentionedGlobals(n.slots[k], py, acc)
  }
  return acc
}

/** 本體裡全域變數與區域變數同名的那一個（Python 一個函式／頂層裡同一個名字只能是其中一種——451） */
function shadowedGlobal(nodes: readonly SemanticNode[], py: ToPythonContext): string | undefined {
  return [...declaredNames(nodes)].find((x) => py.isGlobal(x))
}

/**
 * **寫成 Python 之後**，本體裡哪幾個全域名字被重新指定（`g = …`、`g += …`、`a, g = …`、`for g in …`）——
 * Python 的作用域是看 Python 的文字定的（有指定就是區域變數），所以問印出來的那幾行，不猜哪顆元件會寫成指定（451）。
 * `g[k] = …`、`g.x = …` 是改物件裡面，不算。
 */
function assignedGlobals(lines: readonly string[], globalsPy: Map<string, string>): string[] {
  const out = new Set<string>()
  const ID = '[A-Za-z_]\\w*'
  const assign = new RegExp(`^(${ID}(?:\\s*,\\s*${ID})*)\\s*(?:[-+*/%&|^]|//|\\*\\*|<<|>>)?=(?!=)`)
  const loop = new RegExp(`^for\\s+(${ID}(?:\\s*,\\s*${ID})*)\\s+in\\b`)
  for (const l of lines) {
    const t = l.trim()
    const m = t.match(assign) ?? t.match(loop)
    for (const x of m ? m[1].split(',').map((s) => s.trim()) : []) if (globalsPy.has(x)) out.add(x)
  }
  return [...out]
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
      // 攤平到頂層之後 main 的區域變數就是全域變數：與全域同名的話，別的函式讀到的會是 main 那一個（C++ 讀到的是全域那一個）
      const sh = shadowedGlobal(body, py)
      if (sh !== undefined) return [py.keep(n, 'outside-subset', `「${name}」裡宣告了與全域變數「${sh}」同名的變數——攤平到 Python 的頂層之後兩個會變成同一個`)]
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
    const sh = shadowedGlobal(n.slots.body ?? [], py)
    if (sh !== undefined) return [py.keep(n, 'outside-subset', `函式「${name}」裡宣告了與全域變數「${sh}」同名的變數——Python 一個函式裡同一個名字只能是全域或區域其中一種`)]
    const body = py.block(n.slots.body, depth + 1)
    // 451：函式裡重新指定全域變數（`g = 5`、`g++`、`total += x`）——不寫 `global`，Python 把它當成新的區域變數
    // （C++ 印 5、Python 印 0；先讀再改的直接 UnboundLocalError）。參數與全域同名時參數本來就是區域的
    const paramNames = new Set(params)
    const globalsPy = new Map([...mentionedGlobals(n.slots.body ?? [], py)].filter((g) => !paramNames.has(py.name(g))).map((g) => [py.name(g), g]))
    const written = assignedGlobals(body, globalsPy)
    // 一個名字一行：`global a, b` 是合法的 Python，而 Cella（1931）只判得出一行一個名字的
    const head = written.map((g) => `${py.indent(depth + 1)}global ${g}`)
    return [`${py.indent(depth)}def ${py.name(name)}(${params.join(', ')}):`, ...head, ...body]
  })
}
