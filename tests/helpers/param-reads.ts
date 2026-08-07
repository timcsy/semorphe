/**
 * 「哪些程式碼讀了這顆元件的哪個參數」——用 **TypeScript AST**，不是正則
 *
 * ## 為什麼不用正則／大括號配對
 *
 * 這個判準改了三次，三種不同的錯法，而**每一次抓到它的都是已知答案的樣本**：
 *
 * | 版本 | 錯法 | 症狀 |
 * |---|---|---|
 * | 正則 ＋「到下一個註冊呼叫」切區塊 | 區塊會跨到隔壁 | `print.value` 其實屬於 `cpp_define` |
 * | TS AST，但只看 `*.properties.X` | **把子節點的讀取算給父元件** | `print.value` 其實是 `values.map(v => v.properties.value)` |
 * | TS AST ＋ **綁定 callback 第一個參數** | ✅ 五個樣本全過 | |
 *
 * ⚠️ **關鍵在第三列**：只算 `<callback 的第一個參數>.properties.X`。
 * 一個元件的產生器裡到處都是子節點，而子節點的參數不是它的參數。
 *
 * ## 不新增依賴
 *
 * `typescript` 已經是 devDependency（5.9.3）。用編譯器 API 拿精確的節點邊界，
 * 比任何字串處理都可靠，而且**不需要維護一份會漂移的切割規則**。
 *
 * ## 本模組不判定什麼
 *
 * - **不判定參數該不該存在**——它只回報「誰讀了什麼」。
 * - **不追函式呼叫**：產生器把 `node` 傳給另一個函式再讀，這裡看不到。
 *   那類會被**低報**（漏抓），不會被誤報——判定保守（`build-guardrail` 第 5 步）。
 */
import ts from 'typescript'
import fs from 'node:fs'
import path from 'node:path'
import { listSourceFiles, REPO_ROOT } from './guardrail'

/** 註冊元件行為的呼叫名——產生器、執行器、抽取策略都是這個形狀 */
const REGISTRARS = new Set(['set', 'register', 'registerExecutor'])

export interface ParamRead {
  componentId: string
  param: string
  where: string
}

function readsInCallback(fn: ts.Node, selfName: string, sf: ts.SourceFile, file: string): ParamRead[] {
  const out: ParamRead[] = []
  const at = (n: ts.Node): string => `${file}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`

  const isSelfProperties = (n: ts.Node): boolean =>
    ts.isPropertyAccessExpression(n) &&
    n.name.text === 'properties' &&
    ts.isIdentifier(n.expression) &&
    n.expression.text === selfName

  const walk = (n: ts.Node): void => {
    // node.properties.X
    if (ts.isPropertyAccessExpression(n) && isSelfProperties(n.expression)) {
      out.push({ componentId: '', param: n.name.text, where: at(n) })
    }
    // node.properties['X']
    if (
      ts.isElementAccessExpression(n) &&
      isSelfProperties(n.expression) &&
      n.argumentExpression &&
      ts.isStringLiteral(n.argumentExpression)
    ) {
      out.push({ componentId: '', param: n.argumentExpression.text, where: at(n) })
    }
    ts.forEachChild(n, walk)
  }
  walk(fn)
  return out
}

/** 掃描 `src/`（可加合成檔）→ 每顆元件被讀到的參數 */
export function scanParamReads(extra: { file: string; source: string }[] = []): ParamRead[] {
  const files: { file: string; source: string }[] = [
    ...listSourceFiles('src', ['.ts']).map((rel) => ({
      file: rel,
      source: fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'),
    })),
    ...extra,
  ]

  const out: ParamRead[] = []
  for (const { file, source } of files) {
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && node.arguments.length >= 2) {
        const callee = node.expression
        const name = ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : ts.isIdentifier(callee)
            ? callee.text
            : null
        const [idArg, fnArg] = node.arguments
        if (
          name &&
          REGISTRARS.has(name) &&
          ts.isStringLiteral(idArg) &&
          (ts.isArrowFunction(fnArg) || ts.isFunctionExpression(fnArg))
        ) {
          // ⚠️ **綁定第一個參數**——沒有它，子節點的讀取會被算到父元件頭上。
          const p0 = fnArg.parameters[0]
          if (p0 && ts.isIdentifier(p0.name)) {
            for (const r of readsInCallback(fnArg, p0.name.text, sf, file)) {
              out.push({ ...r, componentId: idArg.text })
            }
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
  }
  return out
}

/**
 * `codeTemplate.pattern` 裡的 `${X}` **也是一種讀取**。
 *
 * ⚠️ 少了這一半，宣告式元件會被誤報成「宣告了沒人讀」——實測
 * `cpp_string_find_first_not_of` 的 `obj` 就是這樣被冤枉的：它根本沒有 TS 產生器，
 * 產出走的是 `"${OBJ}.find_first_not_of(${ARG})"`。
 *
 * 模板裡是**積木欄位名**（大寫），對到的參數名是小寫——這是現行的對應慣例，
 * 而它可機械判定。
 */
export function templateReads(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const rel of listSourceFiles('src', ['.json'])) {
    if (rel.includes('/i18n/')) continue
    let arr: unknown
    try {
      arr = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'))
    } catch {
      continue
    }
    if (!Array.isArray(arr)) continue
    for (const e of arr) {
      const proj = e as { conceptId?: string; codeTemplate?: { pattern?: string } }
      const pat = proj?.codeTemplate?.pattern
      if (!proj.conceptId || !pat) continue
      const set = out.get(proj.conceptId) ?? new Set<string>()
      for (const m of pat.matchAll(/\$\{(\w+)\}/g)) set.add(m[1].toLowerCase())
      if (set.size) out.set(proj.conceptId, set)
    }
  }
  return out
}

/** componentId → 被讀到的參數集合 */
export function paramReadsByComponent(
  extra: { file: string; source: string }[] = [],
): Map<string, Map<string, string[]>> {
  const byId = new Map<string, Map<string, string[]>>()
  for (const r of scanParamReads(extra)) {
    const params = byId.get(r.componentId) ?? new Map<string, string[]>()
    const wheres = params.get(r.param) ?? []
    wheres.push(r.where)
    params.set(r.param, wheres)
    byId.set(r.componentId, params)
  }
  return byId
}
