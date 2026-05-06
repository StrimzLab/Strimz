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

export { cn } from './lib/cn'

export * from './components/button'
export * from './components/input'
export * from './components/textarea'
export * from './components/label'
export * from './components/card'
export * from './components/badge'
export * from './components/separator'
export * from './components/skeleton'
export * from './components/avatar'
export * from './components/dialog'
export * from './components/alert-dialog'
export * from './components/dropdown-menu'
export * from './components/select'
export * from './components/tabs'
export * from './components/switch'
export * from './components/checkbox'
export * from './components/radio-group'
export * from './components/table'
export * from './components/tooltip'
export * from './components/sonner'
export * from './components/form'
export * from './components/sheet'
export * from './components/accordion'
