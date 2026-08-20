import type { Topic, LevelNode } from '../../core/types'
import { resolveEnabledBranches } from '../../core/level-tree'

/**
 * Level tree selector: renders a tree of checkboxes for enabling/disabling branches.
 */
export class LevelTreeSelector {
  private container: HTMLElement
  private topic: Topic
  private enabledBranches: Set<string>
  private onChangeCallback: ((branches: Set<string>) => void) | null = null

  constructor(parent: HTMLElement, topic: Topic, enabledBranches: Set<string>) {
    this.topic = topic
    this.enabledBranches = new Set(enabledBranches)

    this.container = document.createElement('div')
    this.container.className = 'level-tree-selector'

    this.render()
    parent.appendChild(this.container)
  }

  onChange(callback: (branches: Set<string>) => void): void {
    this.onChangeCallback = callback
  }

  setTopic(topic: Topic, branches: Set<string>): void {
    this.topic = topic
    this.enabledBranches = new Set(branches)
    this.render()
  }

  setBranches(branches: Set<string>): void {
    this.enabledBranches = new Set(branches)
    this.render()
  }

  private render(): void {
    this.container.innerHTML = ''
    this.renderNode(this.topic.levelTree, this.container, 0)
  }

  private renderNode(node: LevelNode, parent: HTMLElement, depth: number): void {
    const row = document.createElement('div')
    row.className = 'level-tree-row'
    row.style.paddingLeft = `${depth * 16}px`

    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = this.enabledBranches.has(node.id)
    checkbox.id = `branch-${node.id}`

    // Root is always enabled
    if (depth === 0) {
      checkbox.disabled = true
      checkbox.checked = true
    }

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        this.enabledBranches.add(node.id)
      } else {
        this.disableBranchAndDescendants(node)
      }
      // Auto-enable ancestors
      this.enabledBranches = resolveEnabledBranches(this.topic.levelTree, this.enabledBranches)
      this.render()
      this.onChangeCallback?.(new Set(this.enabledBranches))
    })

    const label = document.createElement('label')
    label.htmlFor = checkbox.id
    label.textContent = `${node.label} (${node.components.length})`
    label.title = `${node.components.length} components`

    row.appendChild(checkbox)
    row.appendChild(label)
    parent.appendChild(row)

    for (const child of node.children) {
      this.renderNode(child, parent, depth + 1)
    }
  }

  private disableBranchAndDescendants(node: LevelNode): void {
    this.enabledBranches.delete(node.id)
    for (const child of node.children) {
      this.disableBranchAndDescendants(child)
    }
  }

  getElement(): HTMLElement {
    return this.container
  }
}
