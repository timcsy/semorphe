/**
 * 型別感知的 `.concept` 改名工具。
 *
 * 058 用正規表示式試過，翻車：除了改錯欄位，還刪掉一整段執行器、
 * 把一個刻意擺在建構式最後的區塊移到中間。
 *
 * 這一版問 TypeScript 的型別檢查器「這個 `.concept` 的接收者是什麼型別」
 * ——那是正則答不出來的唯一問題，也是翻車的直接原因。
 */
import ts from 'typescript'
import path from 'node:path'
import fs from 'node:fs'

const ROOT = process.argv[2]
const TARGET_TYPE = process.argv[3]   // 例如 SemanticNode
const NEW_NAME = process.argv[4]      // 例如 conceptId
const APPLY = process.argv[5] === '--apply'

const cfgPath = ts.findConfigFile(ROOT, ts.sys.fileExists, 'tsconfig.json')
const cfg = ts.parseJsonConfigFileContent(
  ts.readConfigFile(cfgPath, ts.sys.readFile).config, ts.sys, path.dirname(cfgPath))
const extra = []
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  const f = path.join(d, e.name)
  if (e.isDirectory()) walk(f)
  else if (f.endsWith('.ts') && !f.endsWith('.d.ts')) extra.push(f)
} }
walk(path.join(ROOT, 'tests'))
const program = ts.createProgram([...cfg.fileNames, ...extra], cfg.options)
const checker = program.getTypeChecker()

/** 這個型別（含它的聯集成員與 alias）叫什麼名字？ */
function typeNames(type) {
  const out = new Set()
  const push = (t) => {
    const s = t.getSymbol?.() ?? t.aliasSymbol
    if (s) out.add(s.getName())
    if (t.isUnionOrIntersection?.()) t.types.forEach(push)
  }
  push(type)
  return out
}

const edits = new Map()   // file → [{start, end}]
let skipped = 0
const skippedList = []

for (const sf of program.getSourceFiles()) {
  if (sf.isDeclarationFile || !(sf.fileName.includes(`${path.sep}src${path.sep}`) || sf.fileName.includes(`${path.sep}tests${path.sep}`))) continue
  const visit = (node) => {
    if (ts.isPropertyAccessExpression(node) && node.name.text === 'concept') {
      const t = checker.getTypeAtLocation(node.expression)
      const names = typeNames(t)
      if (names.has(TARGET_TYPE)) {
        const arr = edits.get(sf.fileName) ?? []
        arr.push({ start: node.name.getStart(sf), end: node.name.getEnd() })
        edits.set(sf.fileName, arr)
      } else {
        skipped++
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
        skippedList.push(`${path.relative(ROOT, sf.fileName)}:${line + 1}  接收者型別=${[...names].join('|') || '(推不出)'}  ${node.getText(sf).slice(0, 50)}`)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
}

const total = [...edits.values()].reduce((n, a) => n + a.length, 0)
console.log(`接收者是 ${TARGET_TYPE} 的 .concept：${total} 處／${edits.size} 檔`)
console.log(`接收者是**別的型別**、刻意不動：${skipped} 處`)
for (const s of skippedList) console.log('    ↳ ' + s)
for (const [f, arr] of [...edits].sort((a, b) => b[1].length - a[1].length).slice(0, 8))
  console.log(`  ${arr.length.toString().padStart(3)}  ${path.relative(ROOT, f)}`)

if (APPLY) {
  for (const [f, arr] of edits) {
    let src = fs.readFileSync(f, 'utf8')
    for (const e of [...arr].sort((a, b) => b.start - a.start))
      src = src.slice(0, e.start) + NEW_NAME + src.slice(e.end)
    fs.writeFileSync(f, src)
  }
  console.log(`✓ 已套用到 ${edits.size} 個檔`)
}
