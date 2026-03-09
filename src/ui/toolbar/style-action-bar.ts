/**
 * Non-blocking action bar for style conformance prompts.
 * Replaces confirm() dialogs with an inline notification bar + action buttons.
 */

let currentBar: HTMLElement | null = null
let currentMessage: string | null = null

export interface ActionBarOption {
  label: string
  primary?: boolean
  action: () => void
}

/**
 * Show a non-blocking action bar below the toolbar.
 * De-duplicates: if the same message is already showing, does nothing.
 * Auto-dismisses when any button is clicked or after timeout.
 */
export function showStyleActionBar(
  message: string,
  options: ActionBarOption[],
  timeout = 30000,
): void {
  // De-duplicate: don't rebuild if same message already showing
  if (currentBar && currentMessage === message) return

  // Dismiss any existing bar
  dismissStyleActionBar()

  const bar = document.createElement('div')
  bar.className = 'style-action-bar'

  const msgSpan = document.createElement('span')
  msgSpan.className = 'style-action-bar-msg'
  msgSpan.textContent = message
  bar.appendChild(msgSpan)

  const btnGroup = document.createElement('span')
  btnGroup.className = 'style-action-bar-btns'

  for (const opt of options) {
    const btn = document.createElement('button')
    btn.textContent = opt.label
    btn.className = opt.primary ? 'style-action-btn primary' : 'style-action-btn'
    btn.addEventListener('click', () => {
      dismissStyleActionBar()
      opt.action()
    })
    btnGroup.appendChild(btn)
  }

  bar.appendChild(btnGroup)
  document.body.appendChild(bar)
  currentBar = bar
  currentMessage = message

  // Animate in
  requestAnimationFrame(() => bar.classList.add('show'))

  // Auto-dismiss after timeout
  if (timeout > 0) {
    setTimeout(() => {
      if (currentBar === bar) dismissStyleActionBar()
    }, timeout)
  }
}

export function dismissStyleActionBar(): void {
  if (currentBar) {
    currentBar.remove()
    currentBar = null
    currentMessage = null
  }
}
