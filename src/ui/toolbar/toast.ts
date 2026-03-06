type ToastType = 'success' | 'error' | 'warning'

const DURATION: Record<ToastType, number> = {
  success: 2000,
  error: 4000,
  warning: 3000,
}

let currentToast: HTMLElement | null = null

export function showToast(message: string, type: ToastType = 'success'): void {
  if (currentToast) {
    currentToast.remove()
  }

  const el = document.createElement('div')
  el.className = `toast toast-${type}`
  el.textContent = message
  document.body.appendChild(el)
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
