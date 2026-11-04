/**
 * **匯出 `@cos-mos/arduino` 詞彙套件**（預設跳過；`ARDUINO_VOCAB_OUT=<目錄>` 才寫檔）。
 *
 * 產出：`<目錄>/package.json`（npm 套件的外殼）、`vocab.json`（套件本體，帶 contentHash）、`semorphe-map.json`（對照表）。
 * 登錄表靠 Vite 的 `import.meta.glob`，所以匯出走 vitest（與 `export-cella-corpus` 同一個做法），不用 tsx。
 * ⚠️ 發布前要問使用者——這一支只產檔，交給 cos-mos 的主持人，不發布。
 *
 * ```bash
 * ARDUINO_VOCAB_OUT=$PWD/build/cos-mos-arduino npx vitest run tests/probes/export-arduino-vocab.test.ts
 * ```
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { buildArduinoVocab, contentHash } from '../../src/languages/cpp/vocab/arduino'

const OUT = process.env.ARDUINO_VOCAB_OUT ?? ''

describe.skipIf(!OUT)('匯出 @cos-mos/arduino 詞彙套件', () => {
  it('寫出套件本體、對照表、內容雜湊', async () => {
    const { vocab, map } = buildArduinoVocab()
    const hash = await contentHash(vocab.components)
    fs.mkdirSync(OUT, { recursive: true })
    const pkg = { name: vocab.name, version: vocab.version, description: '由 semorphe 從 owner=(arduino) 的元件宣告抽出的詞彙套件第一版（未發布）', main: 'vocab.json', files: ['vocab.json', 'semorphe-map.json'], license: 'UNLICENSED' }
    fs.writeFileSync(path.join(OUT, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')
    fs.writeFileSync(path.join(OUT, 'vocab.json'), JSON.stringify({ ...vocab, contentHash: hash }, null, 2) + '\n')
    fs.writeFileSync(path.join(OUT, 'semorphe-map.json'), JSON.stringify(map, null, 2) + '\n')
    console.log(`匯出 ${Object.keys(vocab.components).length} 顆 → ${OUT}｜${hash}`)
    expect(Object.keys(vocab.components).length).toBe(43)
  })
})
