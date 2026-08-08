import { it } from 'vitest'
import ts from 'typescript'
import fs from 'node:fs'
import { execSync } from 'node:child_process'

it('baseline', () => {
const cf = execSync("grep -rl conceptId src --include=*concepts*.json").toString().trim().split('\n')
const ids = new Set<string>()
for (const f of cf) for (const c of JSON.parse(fs.readFileSync(f,'utf8'))) if (c.conceptId) ids.add(c.conceptId)
const cppIds = [...ids].filter(i => i.startsWith('cpp_'))
const bareIds = [...ids].filter(i => !i.includes(':') && !i.startsWith('cpp_'))
console.log(`cpp_ ${cppIds.length} 顆｜裸名 ${bareIds.length} 顆`)

// A) cpp_ 的純字串計數（不可能是英文字，零誤報）
let cppTs = 0, cppJson = 0, cppBlockType = 0
for (const dir of ['src','tests']) {
  for (const f of execSync(`grep -rl '' ${dir} --include=*.ts`).toString().trim().split('\n')) {
    const s = fs.readFileSync(f,'utf8')
    for (const id of cppIds) cppTs += (s.match(new RegExp("['\"]"+id+"['\"]",'g')) ?? []).length
  }
  for (const f of execSync(`grep -rl '' ${dir} --include=*.json`).toString().trim().split('\n')) {
    let a: unknown; try { a = JSON.parse(fs.readFileSync(f,'utf8')) } catch { continue }
    const walk = (v: unknown, key?: string): void => {
      if (typeof v === 'string') { if (ids.has(v)) { if (key === 'type') cppBlockType++; else if (v.startsWith('cpp_')) cppJson++ } ; return }
      if (Array.isArray(v)) { v.forEach(x => walk(x, key)); return }
      if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k)
    }
    walk(a)
  }
}
console.log(`A) cpp_ ：.ts ${cppTs} 處｜.json（非 blockDef.type）${cppJson} 處｜JSON 裡的 blockDef.type ${cppBlockType} 處（**不得改**）`)

// B) 裸名：只算角色分類得出來的
const CONCEPT_CALLS = new Set(['createNode','getByConceptId','getFormsByConceptId','getWithOverride','register','set','registerExecutor'])
let bareRole = 0
const 殘留: string[] = []
for (const dir of ['src','tests']) {
  for (const f of execSync(`grep -rl '' ${dir} --include=*.ts`).toString().trim().split('\n')) {
    const src = fs.readFileSync(f,'utf8')
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true)
    const visit = (n: ts.Node): void => {
      if (ts.isStringLiteral(n) && bareIds.includes(n.text)) {
        const p = n.parent
        let hit = false
        if (ts.isCallExpression(p) && p.arguments[0] === n) {
          const c = p.expression
          const name = ts.isPropertyAccessExpression(c) ? c.name.text : ts.isIdentifier(c) ? c.text : ''
          hit = CONCEPT_CALLS.has(name)
        } else if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && /conceptId|abstractConcept/.test(p.name.text)) hit = true
        else if (ts.isBinaryExpression(p) && /conceptId/.test((p.left === n ? p.right : p.left).getText(sf))) hit = true
        if (hit) bareRole++
        else if (殘留.length < 10) {
          const line = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1
          const t = src.split('\n')[line-1].trim()
          if (/concept|Node|tree|lift|conceptId/i.test(t)) 殘留.push(`${f}:${line}  ${t.slice(0,88)}`)
        }
      }
      ts.forEachChild(n, visit)
    }
    visit(sf)
  }
}
console.log(`B) 裸名（角色分類得出的）${bareRole} 處`)
console.log('\n角色分類不到、但看起來與概念有關的殘留：\n  ' + 殘留.join('\n  '))
})
