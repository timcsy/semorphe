#!/usr/bin/env node
/**
 * **semorphe 的巡查**：CI 紅、部署或換版出事時發 macOS 通知——不叫醒任何工作階段（由 cron 跑，安裝的那一行在 ~/.cache/semorphe-patrol/cron.txt）。
 *
 *   node tools/patrol.mjs [--print] [--seen <檔案>]
 *     --print       只印出來：不發通知、不寫 alerts.log（試跑用）
 *     --seen <檔案>  用另一份「通知過了」的紀錄（試跑用，不污染正式的 seen.json）
 *
 * 看什麼（都是 main 這條線）：
 *   run-failed   workflow 跑完是失敗（Deploy to GitHub Pages、Extension (vsix)）
 *   stuck        排隊或執行超過 90 分鐘（11-07 有一輪 e2e 卡了十一小時，佔著部署的排隊，之後九輪全被取消）
 *   not-promoted 部署那一輪沒紅，但換版被跳過（線上沒換版）
 *   site         semorphe.com 連續 3 小時打不開（這台機器的網路可能被擋，所以要持續才算）
 *   no-ci        查不到 CI 持續 3 小時
 *
 * 出事時先寫一行到 alerts.log，再發通知；同一件事只通知一次（seen.json）。
 * 第一次跑（沒有 seen.json）：舊的紅燈只記下、不通知，除非它是那個 workflow 最新的一輪。
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const DIR = join(homedir(), '.cache', 'semorphe-patrol')
const ALERTS = join(DIR, 'alerts.log')
const STUCK_MS = 90 * 60_000
const OUTAGE_MS = 3 * 3600_000
const BAD = new Set(['failure', 'timed_out', 'startup_failure'])
const MAX_SEEN = 500

const args = process.argv.slice(2)
const print = args.includes('--print')
const seenPath = args.includes('--seen') ? args[args.indexOf('--seen') + 1] : join(DIR, 'seen.json')
if (!seenPath) { console.error('--seen 後面要接檔案路徑'); process.exit(2) }

const firstRun = !existsSync(seenPath)
/** @type {{ keys: string[], outage: Record<string, number> }} */
let state = { keys: [], outage: {} }
if (!firstRun) { try { state = { keys: [], outage: {}, ...JSON.parse(readFileSync(seenPath, 'utf8')) } } catch { /* 壞掉的紀錄當成空的：最多重複通知一次 */ } }
const seen = new Set(state.keys)

function notify(message) {
  try {
    // 文字從 argv 傳進去，不拼進 AppleScript 原始碼（commit 訊息裡的引號不會弄壞它）
    execFileSync('osascript', ['-e', 'on run argv', '-e', 'display notification (item 1 of argv) with title "semorphe 巡查"', '-e', 'end run', message], { timeout: 15_000 })
  } catch (e) { console.error('通知發不出去：', e instanceof Error ? e.message : e) }
}

function alert(key, message) {
  if (seen.has(key)) return
  seen.add(key)
  state.keys.push(key)
  if (print) { console.log(`[會通知] ${message}`); return }
  mkdirSync(DIR, { recursive: true })
  appendFileSync(ALERTS, `${new Date().toISOString()} ${message}\n`)
  notify(message)
}

/** 第一次跑時的舊事件：記下、不通知 */
function remember(key) { if (!seen.has(key)) { seen.add(key); state.keys.push(key) } }

/** 持續出事才算：回傳已經持續多久；好了就清掉，下一次斷線再通知 */
function outage(name, ok) {
  if (ok) { delete state.outage[name]; seen.delete(`outage:${name}`); state.keys = state.keys.filter((k) => k !== `outage:${name}`); return 0 }
  state.outage[name] ??= Date.now()
  return Date.now() - state.outage[name]
}

const gh = (...a) => JSON.parse(execFileSync('gh', a, { encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'] }))

function checkCi() {
  const runs = gh('run', 'list', '--branch', 'main', '--limit', '15', '--json', 'databaseId,name,status,conclusion,headSha,createdAt,attempt,url')
  const newest = new Set()
  const byWorkflow = new Set()
  for (const r of runs) if (!byWorkflow.has(r.name)) { byWorkflow.add(r.name); newest.add(r.databaseId) }
  for (const r of runs) {
    const tag = `${r.name} ${r.headSha.slice(0, 8)}`
    const key = `${r.databaseId}:${r.attempt}`
    if (r.status !== 'completed') {
      const age = Date.now() - Date.parse(r.createdAt)
      if (age > STUCK_MS) alert(`stuck:${key}`, `卡住超過 90 分鐘：${tag}（${r.status}）${r.url}`)
      continue
    }
    if (BAD.has(r.conclusion)) {
      const k = `run-failed:${key}`
      if (firstRun && !newest.has(r.databaseId)) remember(k)
      else alert(k, `CI 紅了：${tag}（${r.conclusion}）${r.url}`)
    }
  }
  // 部署那一輪沒紅、換版卻被跳過 ⟹ 線上沒換版。只看最新一輪，一次 API
  const deploy = runs.find((r) => r.name === 'Deploy to GitHub Pages' && r.status === 'completed')
  if (deploy && deploy.conclusion === 'success') {
    const { jobs } = gh('run', 'view', String(deploy.databaseId), '--json', 'jobs')
    const promote = jobs.find((j) => j.name === 'promote')
    if (promote && promote.conclusion !== 'success') alert(`not-promoted:${deploy.databaseId}:${deploy.attempt}`, `線上沒換版：${deploy.headSha.slice(0, 8)} 的 promote 是 ${promote.conclusion} ${deploy.url}`)
  }
}

async function checkSite() {
  const res = await fetch('https://semorphe.com/', { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(20_000) })
  return res.ok
}

try { checkCi(); outage('no-ci', true) } catch (e) {
  console.error('查不到 CI：', e instanceof Error ? e.message.split('\n')[0] : e)
  if (outage('no-ci', false) >= OUTAGE_MS) alert('outage:no-ci', '查不到 CI 已持續 3 小時（gh 或網路）')
}
let siteOk = false
try { siteOk = await checkSite() } catch { /* 下面當成打不開 */ }
if (outage('site', siteOk) >= OUTAGE_MS) alert('outage:site', 'semorphe.com 已連續 3 小時打不開')

state.keys = state.keys.slice(-MAX_SEEN)
mkdirSync(dirname(seenPath), { recursive: true })
writeFileSync(seenPath, JSON.stringify(state, null, 2))
console.log(`巡查完成：${new Date().toISOString()}｜記錄 ${state.keys.length} 筆`)
