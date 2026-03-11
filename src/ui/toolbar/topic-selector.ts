import type { Topic, LevelNode } from '../../core/types'
import { flattenLevelTree, resolveEnabledBranches } from '../../core/level-tree'

/**
 * Topic selector: compact dropdown + popover level tree for branch control.
 * Layout: [Topic ▼] [🌳] — clicking the tree icon opens a popover with checkboxes.
 */
export class TopicSelector {
  private container: HTMLElement
  private topics: Topic[]
  private currentTopic: Topic
  private enabledBranches: Set<string>
  private onTopicChangeCallback: ((topic: Topic, branches: Set<string>) => void) | null = null
  private onBranchesChangeCallback: ((branches: Set<string>) => void) | null = null
  private popover: HTMLElement | null = null
  private popoverOpen = false
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null

  constructor(parent: HTMLElement, topics: Topic[], currentTopic: Topic, enabledBranches: Set<string>) {
    this.topics = topics
    this.currentTopic = currentTopic
    this.enabledBranches = new Set(enabledBranches)

    this.container = document.createElement('div')
    this.container.className = 'topic-selector'

    this.render()
    parent.appendChild(this.container)
  }

  onTopicChange(callback: (topic: Topic, branches: Set<string>) => void): void {
    this.onTopicChangeCallback = callback
  }

  onBranchesChange(callback: (branches: Set<string>) => void): void {
    this.onBranchesChangeCallback = callback
  }

  setTopic(topic: Topic, branches: Set<string>): void {
    this.currentTopic = topic
    this.enabledBranches = new Set(branches)
    this.closePopover()
    this.render()
  }

  private render(): void {
    this.container.innerHTML = ''

    // Topic dropdown
    const select = document.createElement('select')
    select.className = 'topic-dropdown toolbar-select'
    for (const topic of this.topics) {
      const option = document.createElement('option')
      option.value = topic.id
      option.textContent = topic.name
      option.selected = topic.id === this.currentTopic.id
      select.appendChild(option)
    }
    select.addEventListener('change', () => {
      const topic = this.topics.find(t => t.id === select.value)
      if (topic && topic.id !== this.currentTopic.id) {
        this.currentTopic = topic
        this.enabledBranches = new Set(flattenLevelTree(topic.levelTree).map(n => n.id))
        this.closePopover()
        this.render()
        this.onTopicChangeCallback?.(topic, this.enabledBranches)
      }
    })
    this.container.appendChild(select)

    // Tree toggle button
    const treeBtn = document.createElement('button')
    treeBtn.className = 'topic-tree-btn toolbar-btn'
    treeBtn.title = '展開/收摺層級樹'
    treeBtn.textContent = '▾'
    treeBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      if (this.popoverOpen) {
        this.closePopover()
      } else {
        this.openPopover(treeBtn)
      }
    })
    this.container.appendChild(treeBtn)
  }

  private openPopover(anchor: HTMLElement): void {
    this.closePopover()
    this.popoverOpen = true

    const popover = document.createElement('div')
    popover.className = 'topic-tree-popover'
    this.renderTree(this.currentTopic.levelTree, popover, 0)

    // Position below the anchor, clamped to viewport
    const rect = anchor.getBoundingClientRect()
    popover.style.position = 'fixed'
    popover.style.top = `${rect.bottom + 4}px`

    document.body.appendChild(popover)

    // Clamp horizontal position so popover stays within viewport
    const popRect = popover.getBoundingClientRect()
    const maxLeft = window.innerWidth - popRect.width - 8
    popover.style.left = `${Math.max(8, Math.min(rect.left, maxLeft))}px`
    this.popover = popover

    // Close on outside click
    this.outsideClickHandler = (e: MouseEvent) => {
      if (!popover.contains(e.target as Node) && e.target !== anchor) {
        this.closePopover()
      }
    }
    setTimeout(() => {
      document.addEventListener('click', this.outsideClickHandler!)
    }, 0)
  }

  private closePopover(): void {
    if (this.popover) {
      this.popover.remove()
      this.popover = null
    }
    if (this.outsideClickHandler) {
      document.removeEventListener('click', this.outsideClickHandler)
      this.outsideClickHandler = null
    }
    this.popoverOpen = false
  }

  private renderTree(node: LevelNode, parent: HTMLElement, depth: number): void {
    const row = document.createElement('label')
    row.className = 'topic-tree-row'
    row.style.paddingLeft = `${depth * 14 + 6}px`

    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = this.enabledBranches.has(node.id)

    // Root is always enabled
    if (depth === 0) {
      checkbox.disabled = true
      checkbox.checked = true
    }

    checkbox.addEventListener('change', (e) => {
      e.stopPropagation()
      if (checkbox.checked) {
        this.enabledBranches.add(node.id)
      } else {
        this.disableBranchAndDescendants(node)
      }
      this.enabledBranches = resolveEnabledBranches(this.currentTopic.levelTree, this.enabledBranches)
      this.refreshPopover()
      this.onBranchesChangeCallback?.(new Set(this.enabledBranches))
    })

    const text = document.createElement('span')
    text.className = 'topic-tree-label'
    text.textContent = `${node.label} (${node.concepts.length})`

    row.appendChild(checkbox)
    row.appendChild(text)
    parent.appendChild(row)

    for (const child of node.children) {
      this.renderTree(child, parent, depth + 1)
    }
  }

  private refreshPopover(): void {
    if (!this.popover) return
    const style = this.popover.style.cssText
    this.popover.innerHTML = ''
    this.renderTree(this.currentTopic.levelTree, this.popover, 0)
    this.popover.style.cssText = style
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
