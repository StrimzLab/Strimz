/**
 * @strimz/ui
 *
 * shadcn/ui primitives configured with Strimz brand tokens.
 * Consumers import components directly; Tailwind in the consuming app
 * compiles the classes emitted here.
 *
 * Always import `@strimz/ui/globals.css` once in the consuming app's root
 * layout so the design tokens are available.
 */

export { cn } from './lib/cn.js'

export * from './components/button.js'
export * from './components/input.js'
export * from './components/textarea.js'
export * from './components/label.js'
export * from './components/card.js'
export * from './components/badge.js'
export * from './components/separator.js'
export * from './components/skeleton.js'
export * from './components/avatar.js'
export * from './components/dialog.js'
export * from './components/alert-dialog.js'
export * from './components/dropdown-menu.js'
export * from './components/select.js'
export * from './components/tabs.js'
export * from './components/switch.js'
export * from './components/checkbox.js'
export * from './components/radio-group.js'
export * from './components/table.js'
export * from './components/tooltip.js'
export * from './components/sonner.js'
export * from './components/form.js'

export { ThemeProvider } from './providers/theme-provider.js'
export type { ThemeProviderProps } from './providers/theme-provider.js'
