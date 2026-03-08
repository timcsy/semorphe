import { describe, it, expect } from 'vitest'
import { TransformRegistry, unescapeC, registerCoreTransforms } from '../../../src/core/registry/transform-registry'

describe('TransformRegistry', () => {
  it('should register and retrieve transforms', () => {
    const registry = new TransformRegistry()
    registry.register('upper', (s) => s.toUpperCase())
    expect(registry.has('upper')).toBe(true)
    expect(registry.get('upper')!('hello')).toBe('HELLO')
  })

  it('should return null for unknown transform', () => {
    const registry = new TransformRegistry()
    expect(registry.get('nope')).toBeNull()
    expect(registry.has('nope')).toBe(false)
  })
})

describe('registerCoreTransforms', () => {
  it('should register stripQuotes', () => {
    const registry = new TransformRegistry()
    registerCoreTransforms(registry)
    expect(registry.has('stripQuotes')).toBe(true)
  })

  it('stripQuotes should remove double quotes', () => {
    const registry = new TransformRegistry()
    registerCoreTransforms(registry)
    const fn = registry.get('stripQuotes')!
    expect(fn('"hello"')).toBe('hello')
  })

  it('stripQuotes should remove single quotes', () => {
    const registry = new TransformRegistry()
    registerCoreTransforms(registry)
    const fn = registry.get('stripQuotes')!
    expect(fn("'a'")).toBe('a')
  })

  it('stripQuotes should leave non-quoted strings unchanged', () => {
    const registry = new TransformRegistry()
    registerCoreTransforms(registry)
    const fn = registry.get('stripQuotes')!
    expect(fn('hello')).toBe('hello')
  })

  it('stripQuotes should NOT unescape sequences', () => {
    const registry = new TransformRegistry()
    registerCoreTransforms(registry)
    const fn = registry.get('stripQuotes')!
    expect(fn('"hello\\nworld"')).toBe('hello\\nworld')
  })

  it('stripAngleBrackets should remove angle brackets', () => {
    const registry = new TransformRegistry()
    registerCoreTransforms(registry)
    const fn = registry.get('stripAngleBrackets')!
    expect(fn('<iostream>')).toBe('iostream')
  })

  it('stripAngleBrackets should leave non-bracketed strings unchanged', () => {
    const registry = new TransformRegistry()
    registerCoreTransforms(registry)
    const fn = registry.get('stripAngleBrackets')!
    expect(fn('iostream')).toBe('iostream')
  })
})

describe('unescapeC', () => {
  it('should unescape \\n', () => {
    expect(unescapeC('hello\\nworld')).toBe('hello\nworld')
  })

  it('should unescape \\t', () => {
    expect(unescapeC('a\\tb')).toBe('a\tb')
  })

  it('should unescape \\r', () => {
    expect(unescapeC('a\\rb')).toBe('a\rb')
  })

  it('should unescape \\\\', () => {
    expect(unescapeC('a\\\\b')).toBe('a\\b')
  })

  it('should unescape \\\'', () => {
    expect(unescapeC("a\\'b")).toBe("a'b")
  })

  it('should unescape \\"', () => {
    expect(unescapeC('a\\"b')).toBe('a"b')
  })

  it('should unescape \\0', () => {
    expect(unescapeC('a\\0b')).toBe('a\0b')
  })

  it('should unescape \\a (bell)', () => {
    expect(unescapeC('a\\ab')).toBe('a\x07b')
  })

  it('should unescape \\b (backspace)', () => {
    expect(unescapeC('a\\bb')).toBe('a\bb')
  })

  it('should unescape \\f (form feed)', () => {
    expect(unescapeC('a\\fb')).toBe('a\fb')
  })

  it('should unescape \\v (vertical tab)', () => {
    expect(unescapeC('a\\vb')).toBe('a\vb')
  })

  it('should keep unknown escape sequences', () => {
    expect(unescapeC('a\\xb')).toBe('a\\xb')
  })

  it('should handle multiple escapes', () => {
    expect(unescapeC('a\\nb\\tc')).toBe('a\nb\tc')
  })

  it('should handle empty string', () => {
    expect(unescapeC('')).toBe('')
  })

  it('should handle string with no escapes', () => {
    expect(unescapeC('hello world')).toBe('hello world')
  })
})
