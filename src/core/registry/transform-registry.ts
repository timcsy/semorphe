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

/** Register core transforms that ship with the engine */
export function registerCoreTransforms(registry: TransformRegistry): void {
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
