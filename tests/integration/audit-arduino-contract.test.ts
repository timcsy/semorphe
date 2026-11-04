/**
 * **我們符合契約 `@cos-mos/arduino` 嗎**（history/015：正本翻轉——契約在 cos-mos，semorphe 核對自己符合它）。
 *
 * 從元件宣告推出一份（`buildArduinoVocab`），與固定在 `tests/fixtures/cos-mos-arduino/` 的契約副本比：
 * - 元件、參數、型別逐欄相同；contentHash 相同；版本相同；
 * - `@semorphe/arduino` 的 `implements` 寫的就是那個 contentHash；對照表是最新的；
 * - 我們自己寫的第 1 層十條（`tests/helpers/vocab-layer1.ts`）對推出來的那一份全過。
 *
 * 🔴 **紅了怎麼辦**：你改了一顆 Arduino 元件的宣告（加參數、改型別…）——那是**契約修改提案**，不是改這裡：
 * ```bash
 * ARDUINO_VOCAB_PROPOSAL=$PWD/build/arduino-proposal npx vitest run tests/probes/propose-arduino-vocab.test.ts
 * ```
 * 把產出的 vocab.json ＋ diff ＋ contentHash 新舊值交給 cos-mos；他們第 1 層過了就合併、回新的版號，
 * 我們再換掉 fixture 與 `implements`，這條才轉綠（使用者 2026-11-04 定：任何一方都能提，cos-mos 收件）。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { buildArduinoVocab, contentHash, VOCAB_VERSION } from '../../src/languages/cpp/vocab/arduino'
import { layer1 } from '../helpers/vocab-layer1'

const ROOT = path.resolve(__dirname, '../..')
const read = (p: string): Record<string, unknown> => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'))
const contract = read('tests/fixtures/cos-mos-arduino/vocab.json') as { name: string; version: string; contentHash: string; components: Record<string, Record<string, unknown>> }
const source = read('tests/fixtures/cos-mos-arduino/source.json') as { version: string; sha256: string }
const pkg = read('packages/semorphe-arduino/package.json') as { name: string; implements: Record<string, string>; files: string[] }

describe('我們符合契約 @cos-mos/arduino', () => {
  it('★ 入口：契約副本是那一份（sha256 對得上 source.json）、有東西', async () => {
    const { createHash } = await import('node:crypto')
    const sha = createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'tests/fixtures/cos-mos-arduino/vocab.json'))).digest('hex')
    expect(sha, '契約副本被改過——它是正本的原樣副本，不在這裡改（見檔頭）').toBe(source.sha256)
    expect(Object.keys(contract.components).length).toBeGreaterThan(0)
    expect(contract.version).toBe(source.version)
  })

  it('🔴 從元件宣告推出的那一份與契約逐欄相同（不同 ⟹ 跑提案工具，見檔頭）', async () => {
    const { vocab } = buildArduinoVocab()
    expect(vocab.name).toBe(contract.name)
    expect(VOCAB_VERSION, '我們實作的版本要寫契約的版本').toBe(contract.version)
    const ours = Object.keys(vocab.components).sort(), theirs = Object.keys(contract.components).sort()
    expect({ oursOnly: ours.filter((k) => !theirs.includes(k)), contractOnly: theirs.filter((k) => !ours.includes(k)) }, '我們多的（oursOnly）、契約多的（contractOnly）').toEqual({ oursOnly: [], contractOnly: [] })
    for (const k of ours) expect(vocab.components[k], k).toEqual(contract.components[k])
    expect(await contentHash(vocab.components)).toBe(contract.contentHash)
  })

  it('🔴 @semorphe/arduino 宣告實作的 contentHash 就是契約的那一個', () => {
    expect(pkg.name).toBe('@semorphe/arduino')
    expect(pkg.implements['@cos-mos/arduino']).toBe(contract.contentHash)
  })

  it('🔴 對照表（契約名 ↔ semorphe 元件身分）是最新的、只指向契約裡的元件', () => {
    const { map } = buildArduinoVocab()
    const shipped = read('packages/semorphe-arduino/semorphe-map.json')
    expect(shipped, '對照表過期——重產 packages/semorphe-arduino/semorphe-map.json').toEqual(map)
    expect(Object.keys(shipped).filter((k) => !(k in contract.components))).toEqual([])
    expect(pkg.files).toContain('semorphe-map.json')
  })

  it('🔴 第 1 層（我們自己寫的十條）：推出的那一份全過', async () => {
    const { vocab } = buildArduinoVocab()
    expect(await layer1({ ...vocab, contentHash: await contentHash(vocab.components) }, 'arduino')).toEqual([])
  })
})

describe('★ 第 1 層的每一條都會紅（反例）', () => {
  const ok = { kind: 'statement', params: { pin: { type: 'int', required: true } }, pins: '未定' }
  const pkgOf = async (components: Record<string, unknown>, hash?: string) => ({ name: '@cos-mos/arduino', components, contentHash: hash ?? await contentHash(components) })
  it.each([
    ['① contentHash 對不上', async () => pkgOf({ 'arduino:x': ok }, 'sha256:00'), /contentHash/],
    ['② 元件名', async () => pkgOf({ 'arduino:X-Y': ok }), /元件名/],
    ['③ 不認得的欄位（元件）', async () => pkgOf({ 'arduino:x': { ...ok, color: 'red' } }), /不認得的欄位 color/],
    ['③ 不認得的欄位（參數）', async () => pkgOf({ 'arduino:x': { ...ok, params: { pin: { type: 'int', shape: 1 } } } }), /不認得的欄位 shape/],
    ['④ kind', async () => pkgOf({ 'arduino:x': { ...ok, kind: 'block' } }), /kind/],
    ['⑤ 參數名', async () => pkgOf({ 'arduino:x': { ...ok, params: { Pin: { type: 'int' } } } }), /參數名/],
    ['⑥ type', async () => pkgOf({ 'arduino:x': { ...ok, params: { pin: { type: 'float' } } } }), /type 是 float/],
    ['⑦ enum 沒有值域', async () => pkgOf({ 'arduino:x': { ...ok, params: { m: { type: 'enum', values: [] } } } }), /enum 沒有值域/],
    ['⑧ required 又有 default', async () => pkgOf({ 'arduino:x': { ...ok, params: { pin: { type: 'int', required: true, default: '1' } } } }), /required 又有 default/],
    ['⑨ variadic 帶 default', async () => pkgOf({ 'arduino:x': { ...ok, params: { v: { type: 'expr', variadic: true, default: 'x' } } } }), /variadic 帶 default/],
    ['⑩ default 不合型別', async () => pkgOf({ 'arduino:x': { ...ok, params: { b: { type: 'bool', default: 'yes' } } } }), /不合 bool/],
  ])('%s', async (_n, make, why) => {
    const bad = await layer1(await make() as never, 'arduino')
    expect(bad.join('\n')).toMatch(why)
  })
  it('對照組：好的那一份零發現', async () => {
    expect(await layer1(await pkgOf({ 'arduino:x': ok }) as never, 'arduino')).toEqual([])
  })
})
