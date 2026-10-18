'use client'

import { Component, type ReactNode } from 'react'
import dangerIcon from '@iconify-icons/solar/danger-circle-linear'
import { MkIcon } from '../icon'

interface Props {
  name: string
  children: ReactNode
}

interface State {
  error: Error | null
}

/** Keeps one broken section from taking the page down, and lets the visitor retry it. */
export class SectionBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error) {
    console.error(`[marketing] the ${this.props.name} section failed to render`, error)
  }

  override render() {
    if (!this.state.error) return this.props.children
    return (
      <div
        role="alert"
        className="border-border bg-muted mx-auto my-10 flex max-w-[1280px] flex-col items-start gap-4 rounded-3xl border px-6 py-8 sm:mx-10 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-start gap-3">
          <MkIcon icon={dangerIcon} className="text-destructive mt-0.5 size-6 shrink-0" />
          <div>
            <p className="font-sora text-foreground font-semibold">
              The {this.props.name} section didn&apos;t load.
            </p>
            <p className="font-poppins text-muted-foreground mt-1 text-sm">
              Check your connection, then try again. The rest of the page still works.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="font-poppins border-border bg-card text-foreground hover:bg-background focus-visible:ring-accent h-11 rounded-xl border px-5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2"
        >
          Try again
        </button>
      </div>
    )
  }
}
