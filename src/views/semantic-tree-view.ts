import type { SemanticNode } from '../core/types'

/**
 * Dummy read-only view that renders a SemanticTree as HTML.
 * Only depends on src/core/ types — no Blockly, no projections, no panels.
 * Used to verify that the concept/blockDef split enables views
 * independent of the Blockly projection layer.
 */
export class SemanticTreeView {
  render(root: SemanticNode): string {
    return `<div class="semantic-tree">${this.renderNode(root, 0)}</div>`
  }

  private renderNode(node: SemanticNode, depth: number): string {
    const indent = '  '.repeat(depth)
    const props = Object.entries(node.properties)
      .map(([k, v]) => `<span class="prop">${k}=${String(v)}</span>`)
      .join(' ')

    const childrenHtml = Object.entries(node.children)
      .map(([name, nodes]) =>
        `${indent}  <div class="child-group" data-name="${name}">` +
        nodes.map(child => this.renderNode(child, depth + 2)).join('') +
        `${indent}  </div>`
      )
      .join('')

    return (
      `${indent}<div class="node" data-concept="${node.concept}">` +
      `<span class="concept">${node.concept}</span>` +
      (props ? ` ${props}` : '') +
      (childrenHtml ? `\n${childrenHtml}\n${indent}` : '') +
      `</div>\n`
    )
  }
}
