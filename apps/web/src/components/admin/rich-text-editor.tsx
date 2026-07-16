'use client'

import { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import {
  Bold as BoldIcon,
  Heading2,
  Italic as ItalicIcon,
  Link as LinkIcon,
  List as ListIcon,
  ListOrdered,
} from 'lucide-react'

interface RichTextEditorProps {
  /** Controlled HTML string. Empty string = empty editor. */
  value: string
  onChange(html: string): void
  placeholder?: string
  disabled?: boolean
}

/**
 * Thin TipTap wrapper used by the admin broadcast composer. We restrict
 * the toolset deliberately. Bold, italic, heading-2, bullet + ordered
 * lists, links. Because the output goes straight into a transactional
 * email. Heading H1 lives in the email template's title; anything
 * heavier (images, tables, colour) would fight the template design.
 *
 * The editor stores TipTap-flavoured HTML on the parent state. The
 * `AdminBroadcastEmail` template renders this HTML directly (with a
 * light sanitiser) so operators see what they wrote in the merchant's
 * inbox.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write to your merchants…',
  disabled,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({ placeholder }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
    ],
    content: value,
    editable: !disabled,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none min-h-[180px] focus:outline-none px-4 py-3 text-[#050020]',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    // Server-render is fine. Next 15 warns without this being set.
    immediatelyRender: false,
  })

  // Sync external value changes into the editor (e.g. form reset).
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (value !== current) {
      editor.commands.setContent(value, false)
    }
  }, [value, editor])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [editor, disabled])

  if (!editor) {
    return <div className="border-border/60 h-[220px] rounded-md border bg-[#F9FAFB]" />
  }

  const btn = (active: boolean) =>
    `inline-flex size-8 items-center justify-center rounded-md text-xs transition-colors ${
      active
        ? 'bg-[#02C76A]/15 text-[#02C76A]'
        : 'text-[#58556A] hover:bg-muted hover:text-[#050020]'
    }`

  function addLink() {
    if (!editor) return
    const prior = editor.getAttributes('link').href
    const url = window.prompt('Link URL', prior ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div className="border-border/60 overflow-hidden rounded-md border bg-white transition-colors focus-within:border-[#02C76A]/60">
      <div className="border-border/60 flex items-center gap-1 border-b bg-[#F9FAFB] px-2 py-1.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={btn(editor.isActive('bold'))}
          aria-label="Bold"
          disabled={disabled}
        >
          <BoldIcon className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={btn(editor.isActive('italic'))}
          aria-label="Italic"
          disabled={disabled}
        >
          <ItalicIcon className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={btn(editor.isActive('heading', { level: 2 }))}
          aria-label="Heading"
          disabled={disabled}
        >
          <Heading2 className="size-4" />
        </button>
        <span className="mx-1 h-4 w-px bg-[#E5E7EB]" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={btn(editor.isActive('bulletList'))}
          aria-label="Bulleted list"
          disabled={disabled}
        >
          <ListIcon className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={btn(editor.isActive('orderedList'))}
          aria-label="Numbered list"
          disabled={disabled}
        >
          <ListOrdered className="size-4" />
        </button>
        <span className="mx-1 h-4 w-px bg-[#E5E7EB]" />
        <button
          type="button"
          onClick={addLink}
          className={btn(editor.isActive('link'))}
          aria-label="Add link"
          disabled={disabled}
        >
          <LinkIcon className="size-4" />
        </button>
        <span className="ml-auto text-[10px] text-[#58556A]">
          Rich text · {editor.storage.characterCount?.characters?.() ?? ''}
        </span>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
