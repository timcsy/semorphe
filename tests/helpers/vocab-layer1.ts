/**
 * **契約的第 1 層檢查——我們自己寫的一份**（history/015：契約本身健全）。
 *
 * cos-mos 也有一份（`hosts/js/vocab-check.mjs`），刻意**不匯入**它：兩邊各寫各的，結果不同就是其中一邊有缺陷
 * （cos-mos 主持人 2026-11-04 的建議，與我們「不把另一方的程式拉進來」同一條理由）。
 * 十條，每一條在 `audit-arduino-contract` 都有一個反例守著。
 */
import { contentHash } from '../../src/languages/cpp/vocab/arduino'

const KINDS = new Set(['statement', 'expression'])
const TYPES = new Set(['int', 'bool', 'enum', 'string', 'expr'])
const COMPONENT_KEYS = new Set(['kind', 'params', 'pins'])
const PARAM_KEYS = new Set(['type', 'values', 'required', 'default', 'variadic'])

export async function layer1(pkg: { name?: unknown; components?: Record<string, Record<string, unknown>>; contentHash?: unknown }, domain: string): Promise<string[]> {
  const bad: string[] = []
  const comps = pkg.components ?? {}
  // ① contentHash：鍵遞迴排序、ASCII、sha256
  if (pkg.contentHash !== await contentHash(comps)) bad.push(`contentHash 與 components 對不上（宣告 ${String(pkg.contentHash)}）`)
  for (const [name, c] of Object.entries(comps)) {
    // ② 元件名 <領域>:<小寫底線>
    if (!new RegExp(`^${domain}:[a-z][a-z0-9_]*$`).test(name)) bad.push(`${name}：元件名不是 ${domain}:<小寫底線>`)
    // ③ 元件與參數不得有契約不認得的欄位
    for (const k of Object.keys(c)) if (!COMPONENT_KEYS.has(k)) bad.push(`${name}：不認得的欄位 ${k}`)
    // ④ kind 必填、只有兩種
    if (!KINDS.has(c.kind as string)) bad.push(`${name}：kind 是 ${String(c.kind)}`)
    for (const [pn, p] of Object.entries((c.params ?? {}) as Record<string, Record<string, unknown>>)) {
      const at = `${name}.${pn}`
      for (const k of Object.keys(p)) if (!PARAM_KEYS.has(k)) bad.push(`${at}：不認得的欄位 ${k}`)
      // ⑤ 參數名
      if (!/^[a-z][a-z0-9_]*$/.test(pn)) bad.push(`${at}：參數名不是小寫底線`)
      // ⑥ type 只有五種
      if (!TYPES.has(p.type as string)) bad.push(`${at}：type 是 ${String(p.type)}`)
      // ⑦ enum 的值域非空
      if (p.type === 'enum' && !(Array.isArray(p.values) && p.values.length > 0)) bad.push(`${at}：enum 沒有值域`)
      // ⑧ required 與 default 不並存
      if (p.required === true && p.default !== undefined) bad.push(`${at}：required 又有 default`)
      // ⑨ variadic 不帶 default
      if (p.variadic === true && p.default !== undefined) bad.push(`${at}：variadic 帶 default`)
      // ⑩ default 合型別
      if (p.default !== undefined) {
        const d = p.default
        const ok = p.type === 'bool' ? typeof d === 'boolean'
          : p.type === 'int' ? (typeof d === 'number' && Number.isInteger(d)) || (typeof d === 'string' && /^-?\d+$/.test(d))
            : p.type === 'enum' ? Array.isArray(p.values) && p.values.includes(d)
              : typeof d === 'string'
        if (!ok) bad.push(`${at}：default ${JSON.stringify(d)} 不合 ${String(p.type)}`)
      }
    }
  }
  return bad
}
