import defaultMdxComponents from 'fumadocs-ui/mdx'
import { Callout } from 'fumadocs-ui/components/callout'
import { Card, Cards } from 'fumadocs-ui/components/card'
import { Step, Steps } from 'fumadocs-ui/components/steps'
import { Tab, Tabs } from 'fumadocs-ui/components/tabs'
import { File, Files, Folder } from 'fumadocs-ui/components/files'
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion'
import { TypeTable } from 'fumadocs-ui/components/type-table'
import type { ComponentType } from 'react'

export type MDXComponents = Record<string, ComponentType<Record<string, unknown>>>

/**
 * Resolves the MDX component set used inside docs pages. Surfaces the
 * full Fumadocs component library by default so authors can drop in
 * `<Cards>`, `<Callout>`, `<Steps>`, `<Tabs>`, `<Files>`, `<Accordions>`,
 * `<TypeTable>` without per-page imports.
 */
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...(defaultMdxComponents as unknown as MDXComponents),
    Callout: Callout as unknown as ComponentType<Record<string, unknown>>,
    Card: Card as unknown as ComponentType<Record<string, unknown>>,
    Cards: Cards as unknown as ComponentType<Record<string, unknown>>,
    Step: Step as unknown as ComponentType<Record<string, unknown>>,
    Steps: Steps as unknown as ComponentType<Record<string, unknown>>,
    Tab: Tab as unknown as ComponentType<Record<string, unknown>>,
    Tabs: Tabs as unknown as ComponentType<Record<string, unknown>>,
    File: File as unknown as ComponentType<Record<string, unknown>>,
    Files: Files as unknown as ComponentType<Record<string, unknown>>,
    Folder: Folder as unknown as ComponentType<Record<string, unknown>>,
    Accordion: Accordion as unknown as ComponentType<Record<string, unknown>>,
    Accordions: Accordions as unknown as ComponentType<Record<string, unknown>>,
    TypeTable: TypeTable as unknown as ComponentType<Record<string, unknown>>,
    ...components,
  }
}
