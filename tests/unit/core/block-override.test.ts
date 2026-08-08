import { describe, it, expect } from 'vitest'
import { applyBlockOverride, mergeArgs } from '../../../src/core/block-override'
import type { BlockSpec, BlockOverride } from '../../../src/core/types'

function makeBlockSpec(overrides: Partial<BlockSpec> = {}): BlockSpec {
  return {
    id: 'test_block',
    language: 'cpp',
    category: 'io',
    version: '1.0.0',
    conceptMapping: { conceptId: 'lang:print' },
    blockDef: {
      type: 'c_print',
      message0: 'print %1',
      args0: [
        { type: 'input_value', name: 'VALUE' },
      ],
      tooltip: 'Print a value',
    },
    codeTemplate: { pattern: 'cout << %VALUE%', imports: ['<iostream>'], order: 1 },
    astPattern: { nodeType: 'call_expression', constraints: [] },
    ...overrides,
  }
}

describe('mergeArgs', () => {
  const baseArgs = [
    { name: 'VALUE', type: 'input_value' },
    { name: 'ENDL', type: 'field_checkbox' },
  ]

  it('should keep base args when no overrides', () => {
    const result = mergeArgs(baseArgs, [])
    expect(result).toEqual(baseArgs)
  })

  it('should override same-name arg', () => {
    const result = mergeArgs(baseArgs, [
      { name: 'VALUE', type: 'input_statement' },
    ])
    expect(result.find((a) => a.name === 'VALUE')?.type).toBe('input_statement')
    expect(result).toHaveLength(2)
  })

  it('should append new arg', () => {
    const result = mergeArgs(baseArgs, [
      { name: 'SERIAL_PORT', type: 'field_dropdown' },
    ])
    expect(result).toHaveLength(3)
    expect(result[2].name).toBe('SERIAL_PORT')
  })

  it('should remove arg with _remove: true', () => {
    const result = mergeArgs(baseArgs, [
      { name: 'ENDL', _remove: true },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('VALUE')
  })

  it('should handle override + append + remove together', () => {
    const result = mergeArgs(baseArgs, [
      { name: 'VALUE', type: 'input_statement' },
      { name: 'ENDL', _remove: true },
      { name: 'FORMAT', type: 'field_input' },
    ])
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('VALUE')
    expect(result[0].type).toBe('input_statement')
    expect(result[1].name).toBe('FORMAT')
  })

  it('should preserve unmentioned args', () => {
    const result = mergeArgs(baseArgs, [
      { name: 'NEW_FIELD', type: 'field_input' },
    ])
    expect(result[0]).toEqual(baseArgs[0])
    expect(result[1]).toEqual(baseArgs[1])
  })
})

describe('applyBlockOverride', () => {
  it('should return original spec when override is empty', () => {
    const spec = makeBlockSpec()
    const override: BlockOverride = {}
    const result = applyBlockOverride(spec, override)
    expect(result.blockDef).toEqual(spec.blockDef)
  })

  it('should override message', () => {
    const spec = makeBlockSpec()
    const override: BlockOverride = { message: 'Serial.print %1' }
    const result = applyBlockOverride(spec, override)
    expect((result.blockDef as Record<string, unknown>).message0).toBe('Serial.print %1')
  })

  it('should override tooltip', () => {
    const spec = makeBlockSpec()
    const override: BlockOverride = { tooltip: 'Print to serial' }
    const result = applyBlockOverride(spec, override)
    expect((result.blockDef as Record<string, unknown>).tooltip).toBe('Print to serial')
  })

  it('should merge args', () => {
    const spec = makeBlockSpec()
    const override: BlockOverride = {
      args: [{ name: 'SERIAL_PORT', type: 'field_dropdown' }],
    }
    const result = applyBlockOverride(spec, override)
    const args = (result.blockDef as Record<string, unknown>).args0 as Array<{ name: string }>
    expect(args.some((a) => a.name === 'SERIAL_PORT')).toBe(true)
    expect(args.some((a) => a.name === 'VALUE')).toBe(true)
  })

  it('should override renderMapping partially', () => {
    const spec = makeBlockSpec({
      renderMapping: {
        fields: { VALUE: 'value' },
        inputs: {},
        statementInputs: {},
      },
    })
    const override: BlockOverride = {
      renderMapping: {
        fields: { VALUE: 'format_string' },
      },
    }
    const result = applyBlockOverride(spec, override)
    expect(result.renderMapping?.fields.VALUE).toBe('format_string')
    expect(result.renderMapping?.inputs).toEqual({})
  })

  it('should not mutate original spec', () => {
    const spec = makeBlockSpec()
    const originalDef = JSON.stringify(spec.blockDef)
    applyBlockOverride(spec, { message: 'changed' })
    expect(JSON.stringify(spec.blockDef)).toBe(originalDef)
  })
})
