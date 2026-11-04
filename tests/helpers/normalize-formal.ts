/**
 * **正規化的程式**（spec 213）：交給 Cella 的程式 JSON，把節點標籤的編號依第一次出現的順序換成 `#1`、`#2`…，後綴保留
 * （`<id>/<角色>`、`<id>#<槽>`、`<id>:<合成>`）；別的欄位裡長得像節點 id 的字串（變數參照拿宣告節點的 id 當名字）也照同一張表換。
 * 兩份正規化後相同 ⟺ 只差節點編號（每次 lift 都會發新的 id）。
 */
/** 語意樹節點 id 的形狀（`createNode` 發的）：`node_<序號>_<時間戳>`，可帶後綴 */
const ID = /^node_\d+_[a-z0-9]+(?:[/#:].*)?$/

export function normalizeFormal(program: unknown): unknown {
  const ids = new Map<string, string>()
  const relabel = (label: string): string => {
    const m = /^([^/#:]+)(.*)$/.exec(label)
    if (!m) return label
    if (!ids.has(m[1])) ids.set(m[1], `#${ids.size + 1}`)
    return ids.get(m[1])! + m[2]
  }
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = k === 'n' && typeof x === 'string' ? relabel(x) : walk(x)
      return out
    }
    // 節點 id 不只在 `n`：變數的參照（`x`）、函式參數也拿宣告那一顆的 id 當名字——長得像 id 的字串一律照同一張表換
    if (typeof v === 'string' && ID.test(v)) return relabel(v)
    return v
  }
  return walk(program)
}

/** 兩份正規化程式第一個不同的路徑（相同回 null）——不一致的報表用。 */
export function firstDifference(a: unknown, b: unknown, path = '$'): string | null {
  if (a === b) return null
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const d = firstDifference(a[i], b[i], `${path}[${i}]`)
      if (d) return d
    }
    return null
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)])
    for (const k of keys) {
      const d = firstDifference((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`)
      if (d) return d
    }
    return null
  }
  return `${path}：${JSON.stringify(a)?.slice(0, 60)} ≠ ${JSON.stringify(b)?.slice(0, 60)}`
}
