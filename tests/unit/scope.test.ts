import { describe, it, expect } from 'vitest'
import { Scope } from '../../src/interpreter/scope'
import { RuntimeError } from '../../src/interpreter/errors'

describe('Scope', () => {
  it('should declare and get a variable', () => {
    const scope = new Scope()
    scope.declare('x', { type: 'int', value: 42 })
    expect(scope.get('x')).toEqual({ type: 'int', value: 42 })
  })

  it('should set an existing variable', () => {
    const scope = new Scope()
    scope.declare('x', { type: 'int', value: 1 })
    scope.set('x', { type: 'int', value: 2 })
    expect(scope.get('x')).toEqual({ type: 'int', value: 2 })
  })

  it('should look up parent scope for get', () => {
    const parent = new Scope()
    parent.declare('x', { type: 'int', value: 10 })
    const child = parent.createChild()
    expect(child.get('x')).toEqual({ type: 'int', value: 10 })
  })

  it('should set variable in parent scope when it exists there', () => {
    const parent = new Scope()
    parent.declare('x', { type: 'int', value: 5 })
    const child = parent.createChild()
    child.set('x', { type: 'int', value: 99 })
    expect(parent.get('x')).toEqual({ type: 'int', value: 99 })
  })

  it('should throw on get for undeclared variable', () => {
    const scope = new Scope()
    expect(() => scope.get('nope')).toThrow(RuntimeError)
  })

  it('should throw on duplicate declaration in same scope', () => {
    const scope = new Scope()
    scope.declare('x', { type: 'int', value: 1 })
    expect(() => scope.declare('x', { type: 'int', value: 2 })).toThrow(RuntimeError)
  })

  it('should allow same name declaration in child scope (shadowing)', () => {
    const parent = new Scope()
    parent.declare('x', { type: 'int', value: 1 })
    const child = parent.createChild()
    child.declare('x', { type: 'int', value: 2 })
    expect(child.get('x')).toEqual({ type: 'int', value: 2 })
    expect(parent.get('x')).toEqual({ type: 'int', value: 1 })
  })

  it('should return all visible variables via getAll', () => {
    const parent = new Scope()
    parent.declare('a', { type: 'int', value: 1 })
    const child = parent.createChild()
    child.declare('b', { type: 'string', value: 'hi' })
    const all = child.getAll()
    expect(all.get('a')).toEqual({ type: 'int', value: 1 })
    expect(all.get('b')).toEqual({ type: 'string', value: 'hi' })
  })

  it('should set variable in current scope if not found anywhere', () => {
    const scope = new Scope()
    scope.set('y', { type: 'int', value: 7 })
    expect(scope.get('y')).toEqual({ type: 'int', value: 7 })
  })
})
