import type { SemanticNode, CodeTemplate, UniversalTemplate, StylePreset } from '../types'

interface GenerateContext {
  indent: number
  style: StylePreset
}

/**
 * JSON-driven template generator engine.
 * Generates code from SemanticNodes using codeTemplate patterns.
 */
export class TemplateGenerator {
  private templates = new Map<string, CodeTemplate>()
  private universalTemplates: UniversalTemplate[] = []
  private collectedImports = new Set<string>()

  /** Register a code template for a specific conceptId */
  registerTemplate(conceptId: string, template: CodeTemplate): void {
    this.templates.set(conceptId, template)
  }

  /** Load universal templates (with style variants) */
  loadUniversalTemplates(templates: UniversalTemplate[]): void {
    this.universalTemplates.push(...templates)
  }

  /** Get imports collected during generation */
  getCollectedImports(): string[] {
    return [...this.collectedImports]
  }

  /** Reset collected imports */
  resetImports(): void {
    this.collectedImports.clear()
  }

  /** Generate code for a semantic node. Returns null if no template found. */
  generate(node: SemanticNode, ctx: GenerateContext): string | null {
    // 1. Try direct template lookup
    let template = this.templates.get(node.concept)

    // 2. Try universal template with style variants
    if (!template) {
      template = this.resolveUniversalTemplate(node.concept, ctx.style)
    }

    if (!template) return null

    // Collect imports
    for (const imp of template.imports) {
      this.collectedImports.add(imp)
    }

    // Expand template pattern
    return this.expandPattern(template.pattern, node, ctx)
  }

  private resolveUniversalTemplate(conceptId: string, style: StylePreset): CodeTemplate | null {
    for (const ut of this.universalTemplates) {
      if (ut.conceptId !== conceptId) continue

      // Try style variants
      if (ut.styleVariants && ut.styleKey) {
        const styleValue = (style as Record<string, unknown>)[ut.styleKey] as string
        const variant = ut.styleVariants[styleValue]
        if (variant) return variant
      }

      // Try single pattern
      if (ut.pattern) {
        return {
          pattern: ut.pattern,
          imports: ut.imports ?? [],
          order: ut.order,
        }
      }
    }
    return null
  }

  private expandPattern(pattern: string, node: SemanticNode, ctx: GenerateContext): string {
    // Replace ${FIELD} tokens
    return pattern.replace(/\$\{([^}]+)\}/g, (_match, key: string) => {
      // Check if it's a property (exact match first, then case-insensitive)
      const propKey = this.findPropKey(key, node.properties)
      if (propKey !== null) {
        return String(node.properties[propKey])
      }

      // Check if it's a child (exact match first, then case-insensitive)
      const childKey = this.findChildKey(key, node.children)
      const children = childKey !== null ? node.children[childKey] : undefined
      if (children && children.length > 0) {
        // If the key suggests a body/statements, generate as indented block
        if (this.isBodyKey(key)) {
          return this.generateBody(children, { ...ctx, indent: ctx.indent + 1 })
        }
        // Otherwise generate as expression
        return this.generateExpression(children[0], ctx)
      }

      // Check for CHILDREN:separator syntax
      if (key.includes(':')) {
        const [childName, separator] = key.split(':', 2)
        const resolvedChildName = this.findChildKey(childName.trim(), node.children)
        const childList = resolvedChildName !== null ? node.children[resolvedChildName] : undefined
        if (childList && childList.length > 0) {
          return childList
            .map(c => this.generateExpression(c, ctx))
            .join(separator.trimStart())
        }
      }

      // Check for conditional syntax ${?CHILD:template}
      if (key.startsWith('?')) {
        const colonIdx = key.indexOf(':')
        if (colonIdx !== -1) {
          const childName = key.substring(1, colonIdx)
          const subTemplate = key.substring(colonIdx + 1)
          const children = node.children[childName]
          if (children && children.length > 0) {
            return this.expandPattern(subTemplate, node, ctx)
          }
          return ''
        }
      }

      return `\${${key}}`
    })
  }

  private generateExpression(node: SemanticNode, ctx: GenerateContext): string {
    const result = this.generate(node, ctx)
    if (result !== null) return result
    return node.metadata?.rawCode as string ?? `/* ${node.concept} */`
  }

  private generateBody(nodes: SemanticNode[], ctx: GenerateContext): string {
    const indentStr = ' '.repeat(ctx.indent * ctx.style.indent_size)
    return nodes.map(n => {
      const code = this.generate(n, ctx)
      if (code === null) return `${indentStr}/* unknown: ${n.concept} */`
      // Add indent and newline for statement-level nodes
      return `${indentStr}${code}`
    }).join('\n')
  }

  private isBodyKey(key: string): boolean {
    const bodyKeys = ['body', 'then', 'else', 'then_body', 'else_body', 'cases',
                      'BODY', 'THEN', 'ELSE', 'THEN_BODY', 'ELSE_BODY', 'CASES',
                      'public', 'private', 'PUBLIC', 'PRIVATE', 'MEMBERS', 'members']
    return bodyKeys.includes(key) || key.endsWith('_BODY') || key.endsWith('_body')
  }

  private findPropKey(key: string, props: Record<string, unknown>): string | null {
    if (key in props) return key
    const lower = key.toLowerCase()
    if (lower in props) return lower
    for (const k of Object.keys(props)) {
      if (k.toLowerCase() === lower) return k
    }
    return null
  }

  private findChildKey(key: string, children: Record<string, SemanticNode[]>): string | null {
    if (key in children) return key
    const lower = key.toLowerCase()
    if (lower in children) return lower
    for (const k of Object.keys(children)) {
      if (k.toLowerCase() === lower) return k
    }
    return null
  }
}
