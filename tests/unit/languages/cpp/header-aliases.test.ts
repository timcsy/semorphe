import { describe, it, expect } from 'vitest'
import { normalizeHeader, headersEquivalent, expandHeaderAliases } from '../../../../src/languages/cpp/header-aliases'

describe('header-aliases', () => {
  describe('normalizeHeader', () => {
    it('should map C-style <stdio.h> to <cstdio>', () => {
      expect(normalizeHeader('<stdio.h>')).toBe('<cstdio>')
    })

    it('should map bare stdio.h to <cstdio>', () => {
      expect(normalizeHeader('stdio.h')).toBe('<cstdio>')
    })

    it('should keep <cstdio> as-is', () => {
      expect(normalizeHeader('<cstdio>')).toBe('<cstdio>')
    })

    it('should keep unknown headers as-is', () => {
      expect(normalizeHeader('<vector>')).toBe('<vector>')
      expect(normalizeHeader('<iostream>')).toBe('<iostream>')
    })

    it('should handle all standard C headers', () => {
      expect(normalizeHeader('<stdlib.h>')).toBe('<cstdlib>')
      expect(normalizeHeader('<string.h>')).toBe('<cstring>')
      expect(normalizeHeader('<math.h>')).toBe('<cmath>')
      expect(normalizeHeader('<ctype.h>')).toBe('<cctype>')
      expect(normalizeHeader('<time.h>')).toBe('<ctime>')
      expect(normalizeHeader('<limits.h>')).toBe('<climits>')
      expect(normalizeHeader('<stdint.h>')).toBe('<cstdint>')
    })
  })

  describe('headersEquivalent', () => {
    it('should treat <stdio.h> and <cstdio> as equivalent', () => {
      expect(headersEquivalent('<stdio.h>', '<cstdio>')).toBe(true)
    })

    it('should treat <string.h> and <cstring> as equivalent', () => {
      expect(headersEquivalent('<string.h>', '<cstring>')).toBe(true)
    })

    it('should not treat unrelated headers as equivalent', () => {
      expect(headersEquivalent('<iostream>', '<cstdio>')).toBe(false)
    })

    it('should treat identical headers as equivalent', () => {
      expect(headersEquivalent('<vector>', '<vector>')).toBe(true)
    })
  })

  describe('expandHeaderAliases', () => {
    it('should expand C-style to include C++ equivalent', () => {
      const set = new Set(['<stdio.h>'])
      const expanded = expandHeaderAliases(set)
      expect(expanded.has('<stdio.h>')).toBe(true)
      expect(expanded.has('<cstdio>')).toBe(true)
    })

    it('should expand C++-style to include C equivalent', () => {
      const set = new Set(['<cstdio>'])
      const expanded = expandHeaderAliases(set)
      expect(expanded.has('<cstdio>')).toBe(true)
      expect(expanded.has('<stdio.h>')).toBe(true)
    })

    it('should not expand non-aliased headers', () => {
      const set = new Set(['<vector>'])
      const expanded = expandHeaderAliases(set)
      expect(expanded.size).toBe(1)
      expect(expanded.has('<vector>')).toBe(true)
    })

    it('should handle multiple headers', () => {
      const set = new Set(['<stdio.h>', '<math.h>'])
      const expanded = expandHeaderAliases(set)
      expect(expanded.has('<cstdio>')).toBe(true)
      expect(expanded.has('<cmath>')).toBe(true)
    })
  })
})
