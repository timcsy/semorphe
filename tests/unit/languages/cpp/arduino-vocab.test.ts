/**
 * `@cos-mos/arduino` 詞彙套件第一版（draft/2026-11-04-cos-mos-arduino詞彙套件格式）：套件從元件宣告抽出、動作清單從語意樹投影。
 */
import { describe, it, expect } from 'vitest'
import { buildArduinoVocab, canonicalJson, contentHash, structureOf } from '../../../../src/languages/cpp/vocab/arduino'
import { createNode } from '../../../../src/core/semantic-tree'

describe('套件：從 owner＝(arduino) 的元件宣告抽出', () => {
  const { vocab, map } = buildArduinoVocab()

  it('★ 43 顆都在，名字是 arduino:<名字>，對照表一對一', () => {
    const names = Object.keys(vocab.components)
    expect(names.length).toBe(43)
    expect(names.every((n) => /^arduino:[a-z_0-9]+$/.test(n))).toBe(true)
    expect(Object.keys(map).sort()).toEqual([...names].sort())
    expect(new Set(Object.values(map)).size).toBe(43)
    expect(map['arduino:digital_write']).toBe('cpp:digital_write')
  })

  it('★ kind 必寫；params 先屬性後接點、照宣告順序；每一個都有型別', () => {
    const dw = vocab.components['arduino:digital_write']
    expect(dw.kind).toBe('statement')
    expect(Object.keys(dw.params)).toEqual(['pin', 'value'])
    expect(dw.params.value).toEqual({ type: 'enum', values: ['HIGH', 'LOW'], required: true })
    expect(vocab.components['arduino:analog_read'].kind).toBe('expression')
    const sp = vocab.components['arduino:serial_print']
    expect(Object.keys(sp.params)).toEqual(['obj', 'newline', 'value', 'format'])
    expect(sp.params.newline, '只有 true／false 的下拉是布林').toEqual({ type: 'bool', default: true })
    const types = new Set(['int', 'bool', 'enum', 'string', 'expr'])
    for (const [n, c] of Object.entries(vocab.components)) {
      expect(c.pins).toBe('未定')
      for (const [p, d] of Object.entries(c.params)) expect(types.has(d.type), `${n}.${p} 的型別 ${d.type}`).toBe(true)
    }
  })

  it('🔴 必填照實宣告：沒有預設值、不是可變長度、沒有宣告可省略的 ⟹ required（cos-mos 2026-11-04 量到少給參數會被放行）', () => {
    expect(vocab.components['arduino:digital_write'].params.pin).toEqual({ type: 'int', required: true })
    expect(vocab.components['arduino:delay'].params.ms.required).toBe(true)
    // C++ 本來就能省的三個（產生器有「沒接就不寫」那一支）：不寫 required
    expect(vocab.components['arduino:tone'].params.duration).toEqual({ type: 'int' })
    expect(vocab.components['arduino:pulse_read'].params.timeout).toEqual({ type: 'int' })
    expect(vocab.components['arduino:serial_print'].params.format.required).toBeUndefined()
    // 有預設值的、可變長度的不是必填
    expect(vocab.components['arduino:dht_read'].params.quantity.required).toBeUndefined()
    expect(vocab.components['arduino:dht_declare'].params.initializer.required).toBeUndefined()
    // 沒有「required 又帶 default」的衝突
    for (const c of Object.values(vocab.components)) for (const d of Object.values(c.params)) expect(d.required && d.default !== undefined).toBeFalsy()
  })

  it('★ 下拉的選項變成 enum 的 values；簿記用的屬性（ctorCount）不進套件', () => {
    expect(vocab.components['arduino:dht_read'].params.quantity).toMatchObject({ type: 'enum', values: ['humidity', 'temperature'] })
    expect(Object.keys(vocab.components['arduino:dht_declare'].params)).not.toContain('ctorCount')
    expect(vocab.components['arduino:dht_declare'].params.initializer).toEqual({ type: 'expr', variadic: true })
  })

  it('★ 內容雜湊：與 cos-mos 對過的測試向量相同', async () => {
    const c = { 'b:x': { params: { z: { type: 'int' }, a: { type: 'enum', values: ['LOW', 'HIGH'] } }, kind: 'statement', pins: '未定' } }
    expect(canonicalJson(c)).toBe('{"b:x":{"kind":"statement","params":{"a":{"type":"enum","values":["LOW","HIGH"]},"z":{"type":"int"}},"pins":"未定"}}')
    expect(await contentHash(c)).toBe('sha256:73f64748215b7fb660afa65c35fb47f814578be842dbac667338a49934e00a75')
  })

  it('🔴 鍵只准 ASCII（UTF-16 與碼點的排序只在 BMP 以外分歧）', () => {
    expect(() => canonicalJson({ 'é𝔸': 1 })).toThrow(/ASCII/)
  })
})

describe('動作清單：從語意樹投影（只放敘述、值用字串、非字面值寫 expr）', () => {
  const { vocab, map } = buildArduinoVocab()
  const num = (v: string) => createNode('cpp:literal_number', { value: v }, {})
  const codeOf = (n: { componentId: string; properties: Record<string, unknown> }) => String(n.properties.name ?? n.componentId)

  it('★ pin_mode／digital_write：字面值寫字串，變數寫 { expr }，每筆附節點 id', () => {
    const pm = createNode('cpp:pin_mode', {}, { pin: [num('13')], mode: [createNode('cpp:pin_constant', { value: 'OUTPUT' }, {})] })
    const dw = createNode('cpp:digital_write', {}, { pin: [num('13')], value: [createNode('cpp:var_ref', { name: 'state' }, {})] })
    const loop = createNode('cpp:loop_for', {}, { body: [dw] })
    const tree = createNode('cpp:program', {}, { body: [pm, loop] })
    const s = structureOf(tree, { vocab, map, revision: 3, codeOf })
    expect(s.vocab).toBe(`@cos-mos/arduino@${vocab.version}`)
    expect(s.at).toBe(3)
    expect(s.actions).toEqual([
      { op: 'arduino:pin_mode', args: { pin: '13', mode: 'OUTPUT' }, at: pm.id },
      { op: 'arduino:digital_write', args: { pin: '13', value: { expr: 'state' } }, at: dw.id },
    ])
    expect(s.unmapped).toEqual([])
  })

  it('★ 運算式元件不自成一筆，出現在別的動作的 args 裡（{ expr }）', () => {
    const ar = createNode('cpp:analog_read', {}, { pin: [num('0')] })
    const aw = createNode('cpp:analog_write', {}, { pin: [num('9')], value: [ar] })
    const s = structureOf(createNode('cpp:program', {}, { body: [aw] }), { vocab, map, revision: 1, codeOf })
    expect(s.actions).toEqual([{ op: 'arduino:analog_write', args: { pin: '9', value: { expr: 'cpp:analog_read' } }, at: aw.id }])
  })

  it('★ 布林參數給真的布林；接收者照屬性寫字串', () => {
    const sp = createNode('cpp:serial_print', { obj: 'Serial', newline: 'false' }, { value: [num('7')] })
    const s = structureOf(createNode('cpp:program', {}, { body: [sp] }), { vocab, map, revision: 4, codeOf })
    expect(s.actions[0].args).toEqual({ obj: 'Serial', newline: false, value: '7' })
  })

  it('🔴 認不出來的那一段不靜默丟：進 unmapped', () => {
    const raw = createNode('cpp:raw_code', { code: 'asm("nop");' }, {})
    const s = structureOf(createNode('cpp:program', {}, { body: [raw] }), { vocab, map, revision: 2, codeOf })
    expect(s.unmapped).toEqual([{ at: raw.id, componentId: 'cpp:raw_code' }])
  })
})
