/**
 * **第 1 層的反例檔——給 cos-mos 交叉核對**（預設跳過；`LAYER1_CASES_OUT=<檔案>` 才寫）。
 *
 * 契約 `@cos-mos/arduino` 的第 1 層檢查兩邊各寫一份（我們的 `tests/helpers/vocab-layer1.ts`、cos-mos 的 `hosts/js/vocab-check.mjs`），
 * 用同一批反例比：cos-mos 把這個檔固定成夾具，要求每一筆兩邊觸發的規則數相同（2026-11-05，cos-mos 173f72f）。
 * 🔴 **改了第 1 層的規則就重產這個檔**，附 sha256 與 commit 交給 cos-mos 換夾具。
 * 每一筆只觸發一條（產生時斷言）；contentHash 照實算，只有 ① 那一筆故意填錯。
 *
 * ```bash
 * LAYER1_CASES_OUT=$PWD/build/cos-mos/layer1-cases.json npx vitest run tests/probes/export-layer1-cases.test.ts
 * ```
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { contentHash } from '../../src/languages/cpp/vocab/arduino'
import { layer1 } from '../helpers/vocab-layer1'
describe.skipIf(!process.env.LAYER1_CASES_OUT)('第 1 層的反例檔', () => {
it('寫出反例檔（每一筆只觸發一條）', async () => {
  const ok = { kind: 'statement', params: { pin: { type: 'int', required: true } }, pins: '未定' }
  const C: [string, string, Record<string, unknown>, boolean?][] = [
    ['①', 'contentHash 與 components 對不上', { 'arduino:x': ok }, true],
    ['②', '元件名不是 arduino:<小寫底線>', { 'arduino:X-Y': ok }],
    ['③a', '元件有契約不認得的欄位', { 'arduino:x': { ...ok, color: 'red' } }],
    ['③b', '參數有契約不認得的欄位', { 'arduino:x': { ...ok, params: { pin: { type: 'int', shape: 1 } } } }],
    ['④', 'kind 不是兩種之一', { 'arduino:x': { ...ok, kind: 'block' } }],
    ['⑤', '參數名不是小寫底線', { 'arduino:x': { ...ok, params: { Pin: { type: 'int' } } } }],
    ['⑥', 'type 不是五種之一', { 'arduino:x': { ...ok, params: { pin: { type: 'float' } } } }],
    ['⑦', 'enum 沒有值域', { 'arduino:x': { ...ok, params: { m: { type: 'enum', values: [] } } } }],
    ['⑦b', 'enum 的值不是字串', { 'arduino:x': { ...ok, params: { m: { type: 'enum', values: ['a', 1] } } } }],
    ['⑧', 'required 與 default 並存', { 'arduino:x': { ...ok, params: { pin: { type: 'int', required: true, default: '1' } } } }],
    ['⑨', 'variadic 帶 default', { 'arduino:x': { ...ok, params: { v: { type: 'expr', variadic: true, default: { expr: 'x' } } } } }],
    ['⑩', 'default 不合型別（bool）', { 'arduino:x': { ...ok, params: { b: { type: 'bool', default: 'yes' } } } }],
    ['⑩b', 'int 的 default 是 JSON 數字', { 'arduino:x': { ...ok, params: { baud: { type: 'int', default: 9600 } } } }],
    ['⑩c', 'int 的 default 有前導零', { 'arduino:x': { ...ok, params: { baud: { type: 'int', default: '09' } } } }],
    ['⑩d', 'int 的 default 帶 +', { 'arduino:x': { ...ok, params: { baud: { type: 'int', default: '+5' } } } }],
    ['⑩e', 'expr 的 default 是裸字串', { 'arduino:x': { ...ok, params: { v: { type: 'expr', default: 'x' } } } }],
    ['⑩f', 'expr 的 default 多一個鍵', { 'arduino:x': { ...ok, params: { v: { type: 'expr', default: { expr: 'x', color: 'red' } } } } }],
    ['ok', '對照組：全過', { 'arduino:x': ok }],
    ['ok2', '對照組：數字開頭的元件名、int／expr 的合格 default', { 'arduino:7seg': { ...ok, params: { baud: { type: 'int', default: '-9600' }, v: { type: 'expr', default: { expr: 'a + 1' } } } } }],
  ]
  const out = []
  for (const [rule, what, components, badHash] of C) {
    const hash = await contentHash(components)
    const vocab = { name: '@cos-mos/arduino', version: '0.1.2', contentHash: badHash ? 'sha256:' + '0'.repeat(64) : hash, components }
    const found = await layer1(vocab as never, 'arduino')
    const pass = rule.startsWith('ok')
    expect(found.length, `${rule} 應該只觸發一條：${found.join('｜')}`).toBe(pass ? 0 : 1)
    out.push({ check: rule, what, vocab, semorphe: { fails: pass ? [] : [rule.replace(/[a-f]$/, '')], messages: found } })
  }
  fs.writeFileSync(process.env.LAYER1_CASES_OUT!, JSON.stringify(out, null, 2) + '\n')
})
})
