/**
 * C-style ↔ C++-style header equivalence mapping.
 *
 * When the user writes `#include <stdio.h>`, auto-include should recognize
 * it as equivalent to `<cstdio>` and not add a duplicate.
 */

/** Map from C-style header to C++-style equivalent (both without angle brackets) */
const C_TO_CPP: Record<string, string> = {
  'stdio.h': 'cstdio',
  'stdlib.h': 'cstdlib',
  'string.h': 'cstring',
  'math.h': 'cmath',
  'ctype.h': 'cctype',
  'time.h': 'ctime',
  'limits.h': 'climits',
  'float.h': 'cfloat',
  'assert.h': 'cassert',
  'errno.h': 'cerrno',
  'signal.h': 'csignal',
  'stddef.h': 'cstddef',
  'stdarg.h': 'cstdarg',
  'stdint.h': 'cstdint',
  'stdbool.h': 'cstdbool',
  'wchar.h': 'cwchar',
  'wctype.h': 'cwctype',
  'setjmp.h': 'csetjmp',
  'locale.h': 'clocale',
}

/** Map from C++-style header to C-style equivalent */
const CPP_TO_C: Record<string, string> = Object.fromEntries(
  Object.entries(C_TO_CPP).map(([c, cpp]) => [cpp, c])
)

/**
 * Given a header name (with or without angle brackets),
 * return the normalized C++-style header in `<cstdio>` format.
 * If the header has no known alias, returns it unchanged (with angle brackets).
 *
 * Examples:
 *   normalizeHeader('<stdio.h>') → '<cstdio>'
 *   normalizeHeader('<cstdio>')  → '<cstdio>'
 *   normalizeHeader('stdio.h')  → '<cstdio>'
 *   normalizeHeader('<vector>') → '<vector>'
 */
export function normalizeHeader(header: string): string {
  const bare = header.replace(/^<|>$/g, '')
  const mapped = C_TO_CPP[bare]
  if (mapped) return `<${mapped}>`
  return header.startsWith('<') ? header : `<${header}>`
}

/**
 * Check if two headers (with or without angle brackets) are equivalent.
 * e.g., `<stdio.h>` and `<cstdio>` are equivalent.
 */
export function headersEquivalent(a: string, b: string): boolean {
  return normalizeHeader(a) === normalizeHeader(b)
}

/**
 * Given a set of header strings (e.g., `<stdio.h>`, `<cstdio>`),
 * return a new set containing all headers plus their C/C++ equivalents.
 * Useful for deduplication: if manual includes contain `<stdio.h>`,
 * the expanded set will also contain `<cstdio>`.
 */
export function expandHeaderAliases(headers: Set<string>): Set<string> {
  const expanded = new Set(headers)
  for (const h of headers) {
    const bare = h.replace(/^<|>$/g, '')
    const cppEquiv = C_TO_CPP[bare]
    if (cppEquiv) expanded.add(`<${cppEquiv}>`)
    const cEquiv = CPP_TO_C[bare]
    if (cEquiv) expanded.add(`<${cEquiv}>`)
  }
  return expanded
}
