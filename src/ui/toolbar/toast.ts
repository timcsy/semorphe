type ToastType = 'success' | 'error' | 'warning'

const DURATION: Record<ToastType, number> = {
  success: 2000,
  error: 4000,
  warning: 3000,
}

let currentToast: HTMLElement | null = null

/**
 * Show a toast notification.
 * @param anchor - If provided, toast is positioned at the bottom of this
 *   container (position: absolute) instead of the viewport (position: fixed).
 */
export function showToast(
  message: string,
  type: ToastType = 'success',
  anchor?: HTMLElement,
): void {
  if (currentToast) {
    currentToast.remove()
  }

  const el = document.createElement('div')
  el.className = `toast toast-${type}`
  el.textContent = message

  if (anchor) {
    // Ensure anchor is a positioning context
    const pos = getComputedStyle(anchor).position
    if (pos === 'static') anchor.style.position = 'relative'
    el.style.position = 'absolute'
    anchor.appendChild(el)
  } else {
    document.body.appendChild(el)
  }
  currentToast = el

  requestAnimationFrame(() => {
    el.classList.add('show')
  })

  setTimeout(() => {
    el.classList.remove('show')
    setTimeout(() => {
      el.remove()
      if (currentToast === el) currentToast = null
    }, 300)
  }, DURATION[type])
}
