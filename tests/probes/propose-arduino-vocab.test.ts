/**
 * **契約修改提案：`@cos-mos/arduino`**（預設跳過；`ARDUINO_VOCAB_PROPOSAL=<目錄>` 才寫檔）。
 *
 * 正本在 cos-mos（history/015）。我們改了 Arduino 元件的宣告、`audit-arduino-contract` 紅了，就跑這一支：
 * 從元件宣告推出一份，與契約副本比，寫出交給 cos-mos 的提案——
 * - `vocab.json`：提案的契約本體（版本照舊，由 cos-mos 合併時定新版號）
 * - `proposal.json`：差在哪（多的、少的、改的元件）、contentHash 新舊值、我們的 commit、vocab.json 的 sha256
 *
 * ⚠️ 這一支只產檔，不改 fixture、不發布——cos-mos 合併、回版號之後，才換 `tests/fixtures/cos-mos-arduino/` 與 `implements`。
 * （前身是 `export-arduino-vocab`：第一版由 semorphe 抽出時的匯出工具；正本翻轉之後改成提案。）
 *
 * ```bash
 * ARDUINO_VOCAB_PROPOSAL=$PWD/build/arduino-proposal npx vitest run tests/probes/propose-arduino-vocab.test.ts
 * ```
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { buildArduinoVocab, contentHash } from '../../src/languages/cpp/vocab/arduino'

const OUT = process.env.ARDUINO_VOCAB_PROPOSAL ?? ''

describe.skipIf(!OUT)('契約修改提案：@cos-mos/arduino', () => {
  it('寫出提案（vocab.json ＋ proposal.json）', async () => {
    const contract = JSON.parse(fs.readFileSync('tests/fixtures/cos-mos-arduino/vocab.json', 'utf8')) as { version: string; contentHash: string; components: Record<string, unknown> }
    const { vocab } = buildArduinoVocab()
    const hash = await contentHash(vocab.components)
    const ours = vocab.components as Record<string, unknown>
    const diff = {
      added: Object.keys(ours).filter((k) => !(k in contract.components)).sort(),
      removed: Object.keys(contract.components).filter((k) => !(k in ours)).sort(),
      changed: Object.keys(ours).filter((k) => k in contract.components && JSON.stringify(ours[k]) !== JSON.stringify(contract.components[k]))
        .sort().map((k) => ({ component: k, contract: contract.components[k], proposed: ours[k] })),
    }
    if (hash === contract.contentHash) {
      console.log(`沒有要提的：推出的那一份與契約 ${contract.version} 相同（${hash}）`)
      return
    }
    fs.mkdirSync(OUT, { recursive: true })
    const body = JSON.stringify({ ...vocab, version: contract.version, contentHash: hash }, null, 2) + '\n'
    fs.writeFileSync(path.join(OUT, 'vocab.json'), body)
    const commit = execSync('git rev-parse --short HEAD').toString().trim()
    fs.writeFileSync(path.join(OUT, 'proposal.json'), JSON.stringify({
      to: '@cos-mos/arduino', baseVersion: contract.version,
      contentHash: { from: contract.contentHash, to: hash },
      semorpheCommit: commit, vocabSha256: createHash('sha256').update(body).digest('hex'), diff,
    }, null, 2) + '\n')
    console.log(`提案 → ${OUT}｜${contract.contentHash} → ${hash}｜多 ${diff.added.length}、少 ${diff.removed.length}、改 ${diff.changed.length}`)
    expect(diff.added.length + diff.removed.length + diff.changed.length).toBeGreaterThan(0)
  })
})
