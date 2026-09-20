export type TransformFn = (text: string) => string

export class TransformRegistry {
  private transforms = new Map<string, TransformFn>()

  register(name: string, fn: TransformFn): void {
    this.transforms.set(name, fn)
  }

  get(name: string): TransformFn | null {
    return this.transforms.get(name) ?? null
  }

  has(name: string): boolean {
    return this.transforms.has(name)
  }
}

/** Unescape C/C++ string escape sequences */
export function unescapeC(s: string): string {
  return s.replace(/\\(.)/g, (_match, ch) => {
    switch (ch) {
      case 'n': return '\n'
      case 't': return '\t'
      case 'r': return '\r'
      case '\\': return '\\'
      case '\'': return "'"
      case '"': return '"'
      case '0': return '\0'
      case 'a': return '\x07'
      case 'b': return '\b'
      case 'f': return '\f'
      case 'v': return '\v'
      default: return '\\' + ch
    }
  })
}

/** Register core transforms that ship with the engine */
export function registerCoreTransforms(registry: TransformRegistry): void {
  // stripQuotes keeps escape sequences as-is (e.g. \t stays as \t)
  // Unescaping happens only at interpreter execution time
  registry.register('stripQuotes', (text) => {
    if ((text.startsWith('"') && text.endsWith('"')) ||
        (text.startsWith("'") && text.endsWith("'"))) {
      return text.slice(1, -1)
    }
    return text
  })

  registry.register('stripAngleBrackets', (text) => {
    if (text.startsWith('<') && text.endsWith('>')) {
      return text.slice(1, -1)
    }
    return text
  })

  /**
   * `(i,n)` → `i,n`。**與上面兩支同一個形狀**——文法把括號算進那個節點的原文裡，
   * 而要存的是括號裡面那一段。
   *
   * ⚠️ 只剝**最外層**的一對，而且兩端都要在：`(a)(b)` 不動它
   * （那不是「一對括號包住全部」，剝掉會改變意思）。
   */
  registry.register('stripParens', (text) => {
    const t = text.trim()
    if (!t.startsWith('(') || !t.endsWith(')')) return text
    let depth = 0
    for (let i = 0; i < t.length; i++) {
      if (t[i] === '(') depth++
      else if (t[i] === ')') {
        depth--
        // 最外層那一對在中途就收掉了 ⟹ 它不是「包住全部」的那一對
        if (depth === 0 && i !== t.length - 1) return text
      }
    }
    return t.slice(1, -1)
  })
}
