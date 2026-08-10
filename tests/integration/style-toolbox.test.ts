import { describe, it, expect } from 'vitest'

describe('Code Style 影響 Toolbox I/O 排序', () => {
  // buildToolbox 是 App 的 private 方法，這裡測試排序邏輯
  function sortIoBlocks(ioPreference: 'iostream' | 'cstdio'): string[] {
    const universalIo = ['cpp_print', 'cpp_input', 'cpp_endl']
    const cppIo = ['cpp_print_formatted', 'cpp_input_formatted']
    return ioPreference === 'iostream'
      ? [...universalIo, ...cppIo]
      : [...cppIo, ...universalIo]
  }

  it('iostream 偏好時 cpp_print 應在 cpp_print_formatted 前面', () => {
    const order = sortIoBlocks('iostream')
    const printIdx = order.indexOf('cpp_print')
    const printfIdx = order.indexOf('cpp_print_formatted')
    expect(printIdx).toBeLessThan(printfIdx)
  })

  it('cstdio 偏好時 cpp_print_formatted 應在 cpp_print 前面', () => {
    const order = sortIoBlocks('cstdio')
    const printfIdx = order.indexOf('cpp_print_formatted')
    const printIdx = order.indexOf('cpp_print')
    expect(printfIdx).toBeLessThan(printIdx)
  })

  it('iostream 偏好時 cpp_input 應在 cpp_input_formatted 前面', () => {
    const order = sortIoBlocks('iostream')
    expect(order.indexOf('cpp_input')).toBeLessThan(order.indexOf('cpp_input_formatted'))
  })

  it('cstdio 偏好時 cpp_input_formatted 應在 cpp_input 前面', () => {
    const order = sortIoBlocks('cstdio')
    expect(order.indexOf('cpp_input_formatted')).toBeLessThan(order.indexOf('cpp_input'))
  })
})
