/**
 * **中文識別字 → 英文**，用 TypeScript LanguageService 的 `findRenameLocations`。
 *
 * ⚠️ 為什麼不能用正則（`vision.md:336` 已經寫過一次，而我 2026-08-12 又犯了）：
 *
 * ```
 * `視圖 id「${view.viewId}」被登錄兩次`   →   `views id「…」被登錄兩次`
 * ```
 *
 * > **一個識別字改名腳本分不出「這個詞在講那個變數」與「這個詞在講那件事」。**
 *
 * LanguageService 只會改真正的識別字位置——字串、註解、JSX 文字都不碰。
 *
 * 用法：`npx tsx rename-cjk.tmp.ts <對照表.json>`
 * 對照表格式：`{ "中文": "english", ... }`
 */
import ts from 'typescript'
import fs from 'node:fs'
import path from 'node:path'

const mapPath = process.argv[2]
if (!mapPath) throw new Error('要一個對照表 JSON')
const renames: Record<string, string> = JSON.parse(fs.readFileSync(mapPath, 'utf8'))

const ROOT = process.cwd()
function allTsFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (!['node_modules', 'dist', '.git', 'test-results', 'playwright-report'].includes(e.name)) allTsFiles(p, out)
    } else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p)
  }
  return out
}

const fileNames = [...allTsFiles(path.join(ROOT, 'src')), ...allTsFiles(path.join(ROOT, 'tests')), ...allTsFiles(path.join(ROOT, 'e2e'))]

// 記憶體中的檔案內容——rename 是逐個做的，每次都要看到前一次的結果
const contents = new Map<string, string>()
for (const f of fileNames) contents.set(f, fs.readFileSync(f, 'utf8'))
const versions = new Map<string, number>(fileNames.map((f) => [f, 0]))

const host: ts.LanguageServiceHost = {
  getScriptFileNames: () => fileNames,
  getScriptVersion: (f) => String(versions.get(f) ?? 0),
  getScriptSnapshot: (f) => {
    const c = contents.get(f) ?? (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : undefined)
    return c === undefined ? undefined : ts.ScriptSnapshot.fromString(c)
  },
  getCurrentDirectory: () => ROOT,
  getCompilationSettings: () => ({
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    allowJs: false,
    resolveJsonModule: true,
    skipLibCheck: true,
  }),
  getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
  fileExists: ts.sys.fileExists,
  readFile: ts.sys.readFile,
  readDirectory: ts.sys.readDirectory,
  directoryExists: ts.sys.directoryExists,
  getDirectories: ts.sys.getDirectories,
}
const service = ts.createLanguageService(host, ts.createDocumentRegistry())
const CJK = /[一-鿿]/

/** 目前檔案內容裡，這個名字的所有「識別字位置」。 */
function identifierPositions(file: string, name: string): number[] {
  const src = ts.createSourceFile(file, contents.get(file)!, ts.ScriptTarget.Latest, true)
  const out: number[] = []
  const visit = (n: ts.Node): void => {
    if (ts.isIdentifier(n) && n.text === name) out.push(n.getStart(src))
    ts.forEachChild(n, visit)
  }
  visit(src)
  return out
}

let renamed = 0
const failed: string[] = []

for (const [from, to] of Object.entries(renames)) {
  if (!CJK.test(from)) continue
  // ⚠️ **同一個中文名可能對應多個獨立的符號**（一個函式的參數、一個型別的欄位、
  // 另一個檔的區域變數）。只 rename 一次會把 shorthand 屬性拆成一半：
  //
  //   function f(來源: string) { g({ 來源 }) }   →   function f(來源: string) { g({ source }) }
  //
  // 而 `tsc` 報的是「shorthand property 'source' 沒有對應的值」——
  // 看起來像 codemod 壞了，實際上是**它只做了該做的一部分**。
  //
  // 所以要**重複做到這個名字消失**（或沒有進展為止）。
  let rounds = 0
  let done = false
  while (rounds++ < 50) {
    const before = renamed
    for (const file of fileNames) {
      for (const pos of identifierPositions(file, from)) {
        const locs = service.findRenameLocations(file, pos, false, false, {})
        if (!locs || locs.length === 0) continue
      // 依檔案分組，由後往前套用（位移才不會亂）
      const byFile = new Map<string, ts.RenameLocation[]>()
      for (const l of locs) {
        if (!byFile.has(l.fileName)) byFile.set(l.fileName, [])
        byFile.get(l.fileName)!.push(l)
      }
      for (const [f, ls] of byFile) {
        let text = contents.get(f)
        if (text === undefined) continue
        for (const l of [...ls].sort((a, b) => b.textSpan.start - a.textSpan.start)) {
          const prefix = l.prefixText ?? ''
          const suffix = l.suffixText ?? ''
          text = text.slice(0, l.textSpan.start) + prefix + to + suffix + text.slice(l.textSpan.start + l.textSpan.length)
        }
        contents.set(f, text)
        versions.set(f, (versions.get(f) ?? 0) + 1)
      }
        renamed++
        done = true
        break
      }
    }
    if (renamed === before) break
  }
  if (!done) failed.push(from)
}

for (const [f, c] of contents) {
  if (c !== fs.readFileSync(f, 'utf8')) fs.writeFileSync(f, c)
}

/**
 * ⚠️ **基線與判定的 JSON，它們的鍵就是 interface 的欄位名。**
 *
 * 第一批改完之後三支護欄變紅：`理由` → `reason` 之後，測試讀 `d.reason`
 * 而 JSON 裡還是 `理由` → 全部 undefined → 「沒有理由的判定」。
 *
 * > **一個型別的欄位名同時是一份磁碟資料的鍵時，改名有兩個現場。**
 *
 * ⚠️ **只改鍵，不改值**——值裡的中文是資料（元件身分、語料、人寫的理由）。
 */
function renameJsonKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(renameJsonKeys)
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[renames[k] ?? k] = renameJsonKeys(val)
    }
    return out
  }
  return v
}
let jsonChanged = 0
for (const dir of ['tests/assets', 'tests/baselines']) {
  const d = path.join(ROOT, dir)
  if (!fs.existsSync(d)) continue
  for (const name of fs.readdirSync(d)) {
    if (!name.endsWith('.json')) continue
    const f = path.join(d, name)
    const before = fs.readFileSync(f, 'utf8')
    const after = JSON.stringify(renameJsonKeys(JSON.parse(before)), null, 2) + '\n'
    if (after !== before) {
      fs.writeFileSync(f, after)
      jsonChanged++
    }
  }
}
console.log(`JSON 檔同步鍵：${jsonChanged}`)
console.log(`改名 ${renamed} 個；找不到位置的 ${failed.length} 個${failed.length ? '：' + failed.slice(0, 20).join(' ') : ''}`)
