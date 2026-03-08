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
}
