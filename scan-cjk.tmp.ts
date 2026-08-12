/**
 * 掃出所有「含中日韓字元的識別字」——用 TS AST，不是正則。
 *
 * ⚠️ 正則分不出「這個詞在講那個變數」與「這個詞在講那件事」：
 * 字串、註解、JSX 文字裡的中文都會被改到。AST 只看 Identifier 節點。
 */
import ts from 'typescript'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.argv[2] ?? '.'
const CJK = /[一-鿿]/

function allTsFiles(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (!['node_modules', 'dist', '.git', 'test-results', 'playwright-report'].includes(e.name)) allTsFiles(p, out)
    } else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p)
  }
  return out
}

const files = [...allTsFiles(path.join(ROOT, 'src')), ...allTsFiles(path.join(ROOT, 'tests')), ...allTsFiles(path.join(ROOT, 'e2e'))]
const counts = new Map<string, { n: number; files: Set<string> }>()

for (const f of files) {
  const src = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true)
  const visit = (node: ts.Node): void => {
    // 只認識別字與屬性名（物件字面值的鍵也算——它們會變成型別的欄位名）
    if (ts.isIdentifier(node) && CJK.test(node.text)) {
      const cur = counts.get(node.text) ?? { n: 0, files: new Set<string>() }
      cur.n++
      cur.files.add(path.relative(ROOT, f))
      counts.set(node.text, cur)
    }
    ts.forEachChild(node, visit)
  }
  visit(src)
}

const rows = [...counts.entries()].sort((a, b) => b[1].n - a[1].n)
console.log(`不同的中文識別字：${rows.length}　總出現次數：${rows.reduce((s, [, v]) => s + v.n, 0)}　涉及檔案：${new Set(rows.flatMap(([, v]) => [...v.files])).size}`)
console.log('---')
for (const [name, v] of rows) console.log(`${v.n}\t${v.files.size}\t${name}`)
