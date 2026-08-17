import type { Target, Topic, LevelNode } from '../../core/types'
import { flattenLevelTree, resolveEnabledBranches } from '../../core/level-tree'

/**
 * 目標選擇器：下拉選**目標** ＋ 彈出層級樹控制分支。
 * Layout: [目標 ▼] [🌳]
 *
 * ## 🔴 為什麼下拉的是目標，而不是課程清單（2026-08-17，spec 136）
 *
 * 使用者想的是「**我要教 C**」，而不是「課程清單選 X、風格選 Y，
 * 而且要記得那兩個必須配對」。目標就是那個具名的配對。
 *
 * ⚠️ **而風格選擇器【留著】**——否則 `google`／`competitive` 這兩個
 * 沒有對應目標的風格會**拿不到**（第十九條護欄「可拿性」）。
 * 目標設定的是**起點**，風格選擇器是**微調**。
 *
 * ## ⚠️ 而這個類別的名字沒有改
 *
 * 它管的仍然是「哪些概念可見」這件事，只是**入口從課程清單換成目標**。
 * 改名會動到 `app.ts`／`app-shell.ts`／CSS 類名／`level-selector-mount`
 * 一整串，而**那串改動一個字都不會讓使用者看到不同的東西**。
 */
export class TopicSelector {
  private container: HTMLElement
  private targets: Target[]
  private topicOf: (target: Target) => Topic
  private currentTarget: Target
  private currentTopic: Topic
  private enabledBranches: Set<string>
  private onTargetChangeCallback: ((target: Target, topic: Topic, branches: Set<string>) => void) | null = null
  private onBranchesChangeCallback: ((branches: Set<string>) => void) | null = null
  private popover: HTMLElement | null = null
  private popoverOpen = false
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null

  constructor(
    parent: HTMLElement,
    targets: Target[],
    topicOf: (target: Target) => Topic,
    currentTarget: Target,
    enabledBranches: Set<string>,
  ) {
    this.targets = targets
    this.topicOf = topicOf
    this.currentTarget = currentTarget
    this.currentTopic = topicOf(currentTarget)
    this.enabledBranches = new Set(enabledBranches)

    this.container = document.createElement('div')
    this.container.className = 'topic-selector'

    this.render()
    parent.appendChild(this.container)
  }

  onTargetChange(callback: (target: Target, topic: Topic, branches: Set<string>) => void): void {
    this.onTargetChangeCallback = callback
  }

  onBranchesChange(callback: (branches: Set<string>) => void): void {
    this.onBranchesChangeCallback = callback
  }

  setTarget(target: Target, branches: Set<string>): void {
    this.currentTarget = target
    this.currentTopic = this.topicOf(target)
    this.enabledBranches = new Set(branches)
    this.closePopover()
    this.render()
  }

  private render(): void {
    this.container.innerHTML = ''

    // Target dropdown
    const select = document.createElement('select')
    select.className = 'topic-dropdown toolbar-select'
    for (const target of this.targets) {
      const option = document.createElement('option')
      option.value = target.id
      option.textContent = target.name
      option.selected = target.id === this.currentTarget.id
      select.appendChild(option)
    }
    select.addEventListener('change', () => {
      const target = this.targets.find(t => t.id === select.value)
      if (target && target.id !== this.currentTarget.id) {
        this.currentTarget = target
        this.currentTopic = this.topicOf(target)
        this.enabledBranches = new Set(flattenLevelTree(this.currentTopic.levelTree).map(n => n.id))
        this.closePopover()
        this.render()
        this.onTargetChangeCallback?.(target, this.currentTopic, this.enabledBranches)
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
