import { describe, it, expect } from 'vitest'
import { IOSystem } from '../../src/interpreter/io'

describe('IOSystem', () => {
  it('should write to stdout', () => {
    const io = new IOSystem()
    io.write('hello')
    io.write(' world')
    expect(io.getOutput()).toEqual(['hello', ' world'])
  })

  it('should read from stdin queue', () => {
    const io = new IOSystem(['10', '20'])
    expect(io.hasInput()).toBe(true)
    expect(io.read()).toBe('10')
    expect(io.read()).toBe('20')
    expect(io.hasInput()).toBe(false)
  })

  it('should return null when stdin queue is exhausted', () => {
    const io = new IOSystem([])
    expect(io.hasInput()).toBe(false)
    expect(io.read()).toBeNull()
  })

  it('should reset all state', () => {
    const io = new IOSystem(['a'])
    io.write('output')
    io.read()
    io.reset()
    expect(io.getOutput()).toEqual([])
    expect(io.hasInput()).toBe(false)
  })

  it('should reset with new stdin queue', () => {
    const io = new IOSystem()
    io.reset(['x', 'y'])
    expect(io.hasInput()).toBe(true)
    expect(io.read()).toBe('x')
  })

  it('should write newline', () => {
    const io = new IOSystem()
    io.write('a')
    io.writeNewline()
    io.write('b')
    expect(io.getOutput()).toEqual(['a', '\n', 'b'])
  })
})
