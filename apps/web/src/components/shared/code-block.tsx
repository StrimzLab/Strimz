'use client'

import { Highlight, type PrismTheme } from 'prism-react-renderer'

/**
 * Strimz-tuned light theme — used on white/F9FAFB backgrounds (Benefits
 * code mocks, docs callouts). Inspired by GitHub Light + tightened to
 * keep the palette in the green/navy/red triad of the Strimz brand.
 */
const lightTheme: PrismTheme = {
  plain: { color: '#050020', backgroundColor: 'transparent' },
  styles: [
    {
      types: ['comment', 'prolog', 'doctype', 'cdata'],
      style: { color: '#9ca3af', fontStyle: 'italic' },
    },
    { types: ['punctuation'], style: { color: '#58556A' } },
    {
      types: ['property', 'tag', 'boolean', 'number', 'constant', 'symbol', 'deleted'],
      style: { color: '#0969da' },
    },
    {
      types: ['selector', 'attr-name', 'string', 'char', 'builtin', 'inserted'],
      style: { color: '#02865c' },
    },
    { types: ['operator', 'entity', 'url', 'variable'], style: { color: '#cf222e' } },
    { types: ['atrule', 'attr-value', 'keyword'], style: { color: '#cf222e' } },
    { types: ['function', 'class-name'], style: { color: '#8250df' } },
    { types: ['regex', 'important'], style: { color: '#bf3989' } },
  ],
}

/**
 * Strimz-tuned dark theme — used on the #050020 code window in
 * Developers / dashboard mocks. Inspired by GitHub Dark.
 */
const darkTheme: PrismTheme = {
  plain: { color: '#e6edf3', backgroundColor: 'transparent' },
  styles: [
    {
      types: ['comment', 'prolog', 'doctype', 'cdata'],
      style: { color: '#8b949e', fontStyle: 'italic' },
    },
    { types: ['punctuation'], style: { color: '#c9d1d9' } },
    {
      types: ['property', 'tag', 'boolean', 'number', 'constant', 'symbol', 'deleted'],
      style: { color: '#79c0ff' },
    },
    {
      types: ['selector', 'attr-name', 'string', 'char', 'builtin', 'inserted'],
      style: { color: '#a5d6ff' },
    },
    { types: ['operator', 'entity', 'url', 'variable'], style: { color: '#ffa657' } },
    { types: ['atrule', 'attr-value', 'keyword'], style: { color: '#ff7b72' } },
    { types: ['function', 'class-name'], style: { color: '#d2a8ff' } },
    { types: ['regex', 'important'], style: { color: '#f2cc60' } },
  ],
}

export type CodeLanguage = 'tsx' | 'ts' | 'js' | 'jsx' | 'json' | 'bash'

/**
 * Renders a syntax-highlighted code block. Pure presentational —
 * background and padding come from the parent. Pass `tone="light"` on
 * white backgrounds, `tone="dark"` on the navy code window.
 */
export function CodeBlock({
  code,
  language = 'tsx',
  tone = 'light',
  className,
}: {
  code: string
  language?: CodeLanguage
  tone?: 'light' | 'dark'
  className?: string
}) {
  const theme = tone === 'dark' ? darkTheme : lightTheme
  return (
    <Highlight code={code.trim()} language={language} theme={theme}>
      {({ tokens, getLineProps, getTokenProps }) => (
        <pre
          className={['overflow-x-auto font-mono text-[12.5px] leading-[1.7]', className]
            .filter(Boolean)
            .join(' ')}
          style={{ background: 'transparent' }}
        >
          {tokens.map((line, i) => {
            const lineProps = getLineProps({ line })
            return (
              <div key={i} {...lineProps}>
                {line.map((token, key) => {
                  const tokenProps = getTokenProps({ token })
                  return <span key={key} {...tokenProps} />
                })}
              </div>
            )
          })}
        </pre>
      )}
    </Highlight>
  )
}
