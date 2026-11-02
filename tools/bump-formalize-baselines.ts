/**
 * **補了 formalize 之後的四份基線**——2026-11-02 一天手動調了七次，每次都是同一組動作（knowie-judge 抓到的技能候選，照推薦做成工具）。
 *
 * 新增一個 `src/components/<scope>/<name>/formalize.ts` 會讓四條護欄同時要求調基線：
 *
 * ```
 * formalize-coverage   還沒對應       −1（這顆有了 formalize）
 * judge-coverage       scanned.cells  +1（多一格：這顆的 formalize 路）
 * layering             掃描檔數       +1（多一個 .ts）
 * locality             limits[id].files +1（這顆的資料夾多一個檔）
 * ```
 *
 * ⚠️ **它只做「新增 formalize.ts」這一種**——語料護欄（declared-props、projection-residual、string-property、behavior-error）
 *    的變動要逐段看長在哪一欄（那幾支的 note 一再寫著「⚠️ 看著數字上調，不要整批重產」），不歸這支工具。
 * ⚠️ **它預測，不量**：寫完之後照樣跑 `npm run test:guard`——護欄紅了就是預測錯了（例如同一刀還刪了一個 formalize）。
 *
 * 用法：
 *   npx tsx tools/bump-formalize-baselines.ts --base main --why "第 230 刀，spec 205"          # 只印出要改什麼
 *   npx tsx tools/bump-formalize-baselines.ts --base main --why "第 230 刀，spec 205" --write  # 寫進四份基線
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..')
const BASE_DIR = path.join(ROOT, 'tests/baselines')

/** 這一刀新增的 formalize（相對於 base；含還沒提交的） */
export function addedFormalize(base: string): string[] {
  const out = execFileSync('git', ['diff', '--name-only', '--diff-filter=A', base, '--', 'src/components'], { cwd: ROOT, encoding: 'utf8' })
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', 'src/components'], { cwd: ROOT, encoding: 'utf8' })
  const files = new Set([...out.split('\n'), ...untracked.split('\n')].filter((f) => /^src\/components\/[^/]+\/[^/]+\/formalize\.ts$/.test(f)))
  // 身分照資料夾：src/components/cpp/range_sum/formalize.ts → cpp:range_sum
  return [...files].map((f) => { const [, , scope, name] = f.split('/'); return `${scope}:${name}` }).sort()
}

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

/** 算出四份基線的新內容（不寫檔）；notes 加在最前面，照既有的寫法 */
export function plan(ids: string[], why: string, read: (name: string) => Json): Record<string, Json> {
  const n = ids.length
  const names = ids.map((id) => id.split(':')[1]).join('、')
  const day = new Date().toISOString().slice(0, 10)
  const fc = read('formalize-coverage')
  const jc = read('judge-coverage')
  const ly = read('layering')
  const lc = read('locality')
  const before = { fc: fc['還沒對應'], jc: jc.scanned.cells, ly: ly['掃描檔數'] }
  fc['還沒對應'] = before.fc - n
  fc.note = `📉 **${day}（${why}）：還沒對應 ${before.fc} → ${fc['還沒對應']}**——補上 ${names} 的 formalize。\n\n${fc.note ?? ''}`
  jc.scanned.cells = before.jc + n
  jc._meta.note = `📈 **${day}（${why}）：cells ${before.jc} → ${jc.scanned.cells}**——${n} 顆元件的 formalize.ts；沒有人量過的路仍是 ${jc.unmeasuredPaths}。\n\n${jc._meta.note ?? ''}`
  ly['掃描檔數'] = before.ly + n
  ly._meta.note = `📈 **${day}（${why}）：掃描檔數 ${before.ly} → ${ly['掃描檔數']}**（${n} 個新的 formalize.ts），跨層相依未動。\n\n${ly._meta.note ?? ''}`
  const missing: string[] = []
  for (const id of ids) {
    const e = lc.limits[id]
    if (!e) { missing.push(id); continue }
    e.files += 1
  }
  if (missing.length > 0) throw new Error(`locality 的上限表裡沒有：${missing.join('、')}——新元件要先有自己的上限（不是這支工具的事）`)
  lc.note = `📈 ${day}（${why}）：${names} 各多一個 formalize.ts，files 各加 1（同一個資料夾）。\n\n${lc.note ?? ''}`
  return { 'formalize-coverage': fc, 'judge-coverage': jc, layering: ly, locality: lc }
}

function main(): void {
  const arg = (k: string): string | undefined => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined }
  const base = arg('--base') ?? 'main'
  const why = arg('--why')
  if (!why) throw new Error('要給 --why（例如 "第 230 刀，spec 205"）——note 要說得出是哪一刀')
  const ids = addedFormalize(base)
  if (ids.length === 0) { console.log(`相對於 ${base} 沒有新增的 formalize.ts`); return }
  const read = (name: string): Json => JSON.parse(fs.readFileSync(path.join(BASE_DIR, `${name}.json`), 'utf8'))
  const next = plan(ids, why, read)
  console.log(`新增的 formalize（${ids.length}）：${ids.join('、')}`)
  for (const [name, json] of Object.entries(next)) {
    const p = path.join(BASE_DIR, `${name}.json`)
    if (process.argv.includes('--write')) fs.writeFileSync(p, JSON.stringify(json, null, 2) + '\n')
    console.log(`${process.argv.includes('--write') ? '寫入' : '（預覽）'} ${path.relative(ROOT, p)}`)
  }
  if (!process.argv.includes('--write')) console.log('加 --write 寫進去；寫完照樣跑 npm run test:guard')
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) main()
