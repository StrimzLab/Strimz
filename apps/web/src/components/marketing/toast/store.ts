export type ToastTone = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  tone: ToastTone
  title: string
  description?: string
  duration: number
}

export type ToastAction =
  | { type: 'add'; toast: ToastItem }
  | { type: 'dismiss'; id: string }
  | { type: 'clear' }

export const TOAST_LIMIT = 4

export function toastReducer(state: ToastItem[], action: ToastAction): ToastItem[] {
  switch (action.type) {
    case 'add':
      return [action.toast, ...state.filter((t) => t.id !== action.toast.id)].slice(0, TOAST_LIMIT)
    case 'dismiss':
      return state.some((t) => t.id === action.id) ? state.filter((t) => t.id !== action.id) : state
    case 'clear':
      return []
  }
}

let toasts: ToastItem[] = []
const listeners = new Set<() => void>()
let counter = 0

function dispatch(action: ToastAction) {
  toasts = toastReducer(toasts, action)
  listeners.forEach((l) => l())
}

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const getToasts = () => toasts
const NO_TOASTS: ToastItem[] = []
export const getServerToasts = () => NO_TOASTS

type Options = { id?: string; description?: string; duration?: number }

function show(tone: ToastTone, title: string, options: Options = {}) {
  const id = options.id ?? `toast-${++counter}`
  dispatch({
    type: 'add',
    toast: {
      id,
      tone,
      title,
      description: options.description,
      duration: options.duration ?? (tone === 'error' ? 7000 : 4000),
    },
  })
  return id
}

export const toast = {
  success: (title: string, options?: Options) => show('success', title, options),
  error: (title: string, options?: Options) => show('error', title, options),
  info: (title: string, options?: Options) => show('info', title, options),
  dismiss: (id: string) => dispatch({ type: 'dismiss', id }),
  clear: () => dispatch({ type: 'clear' }),
}
