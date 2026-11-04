/**
 * **結構頻道**（`@cos-mos/arduino` 第一版的最後一步）：語意樹每換一次就推一份動作清單給宿主。
 * 形狀與規則見 `knowledge/draft/2026-11-04-cos-mos-arduino詞彙套件格式.md`（與 cos-mos 對過：at 是樹的版本、單調遞增；帶 contentHash）。
 */
import { describe, it, expect } from 'vitest'
import { SemanticBus } from '../../../../src/core/sync/semantic-bus'
import { createNode } from '../../../../src/core/semantic-tree'
import { createStructureChannel } from '../../../../src/languages/cpp/vocab/structure-channel'
import { buildArduinoVocab, contentHash } from '../../../../src/languages/cpp/vocab/arduino'
import type { StructureMessage } from '../../../../src/languages/cpp/vocab/arduino'

const prog = (pin: string) => createNode('cpp:program', {}, {
  body: [createNode('cpp:digital_write', {}, { pin: [createNode('cpp:literal_number', { value: pin }, {})], value: [createNode('cpp:pin_constant', { value: 'HIGH' }, {})] })],
})

describe('結構頻道', () => {
  it('★ 樹每換一次推一份；at 單調遞增；帶 vocab 與 contentHash', async () => {
    const bus = new SemanticBus()
    const ch = await createStructureChannel(bus, { codeOf: () => '?' })
    const got: StructureMessage[] = []
    ch.onStructure((m) => got.push(m))
    bus.emit('semantic:update', { tree: prog('13') })
    bus.emit('semantic:update', { tree: prog('12') })
    expect(got.map((m) => m.at)).toEqual([1, 2])
    expect(got[1].actions).toEqual([{ op: 'arduino:digital_write', args: { pin: '12', value: 'HIGH' }, at: expect.any(String) }])
    const { vocab } = buildArduinoVocab()
    expect(got[0].vocab).toBe(`@cos-mos/arduino@${vocab.version}`)
    expect(got[0].contentHash).toBe(await contentHash(vocab.components))
    expect(ch.last()).toBe(got[1])
  })

  it('★ 同一棵樹重發（骨架告示之類）不推——輸入沒變，不佔一個版本號', async () => {
    const bus = new SemanticBus()
    const ch = await createStructureChannel(bus, { codeOf: () => '?' })
    const got: number[] = []
    ch.onStructure((m) => got.push(m.at))
    const t = prog('13')
    bus.emit('semantic:update', { tree: t })
    bus.emit('semantic:update', { tree: t })
    expect(got).toEqual([1])
  })

  it('★ 晚訂閱的拿得到最後一份；退訂之後不再收到', async () => {
    const bus = new SemanticBus()
    const ch = await createStructureChannel(bus, { codeOf: () => '?' })
    bus.emit('semantic:update', { tree: prog('13') })
    const late: number[] = []
    const off = ch.onStructure((m) => late.push(m.at))
    expect(late).toEqual([1])
    off()
    bus.emit('semantic:update', { tree: prog('12') })
    expect(late).toEqual([1])
  })
})
