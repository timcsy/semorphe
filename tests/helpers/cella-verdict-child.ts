/**
 * **在子行程裡跑 Cella 判決**——給探針用的「每一支的時間上限」（第 215 刀）。
 *
 * Cella 的判決是同步呼叫：同一個執行緒裡沒辦法中途打斷它。而有一類程式步數不多、每一步卻很貴
 *（`bitset<200007>`、`vector<int> d2[1000005]`——Cella 的陣列讀寫目前是 O(n)），一支就能卡住整支探針一小時以上。
 * 放在子行程裡，逾時就由父行程砍掉、重開一個。
 *
 * 協定：stdin 一行一筆 `{ id, program, stdin, steps }`，stdout 一行一筆 `{ id, verdict }` 或 `{ id, error }`；
 * 準備好時先印 `{ ready: true }`。
 */
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { createCellaChecker } from '../../src/providers/cella/verdict'

const ROOT = path.resolve(import.meta.dirname, '../..')
const read = (pkg: string | null, file: string): Uint8Array =>
  fs.readFileSync(path.join(ROOT, 'node_modules', pkg === null ? 'cella-lang' : `@cella-lang/${pkg}`, file))

const checker = await createCellaChecker(read)
const say = (x: unknown): void => { process.stdout.write(JSON.stringify(x) + '\n') }
say({ ready: true })
for await (const line of readline.createInterface({ input: process.stdin })) {
  if (!line.trim()) continue
  const { id, program, stdin, steps } = JSON.parse(line) as { id: number; program: unknown; stdin: string; steps: number }
  try { say({ id, verdict: checker.verdict(program as never, stdin, steps) }) } catch (e) { say({ id, error: String(e) }) }
}
