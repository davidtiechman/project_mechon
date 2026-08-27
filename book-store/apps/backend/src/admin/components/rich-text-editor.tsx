import Link from "@tiptap/extension-link"
import TextAlign from "@tiptap/extension-text-align"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Button } from "@medusajs/ui"

export function RichTextEditor({ value, onChange, rtl }: { value: string; onChange: (value: string) => void; rtl: boolean }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3, 4] } }), Link.configure({ openOnClick: false }), TextAlign.configure({ types: ["heading", "paragraph"] })],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: { attributes: { class: "min-h-40 rounded-b-lg border border-t-0 border-ui-border-base bg-ui-bg-field p-3 outline-none", dir: rtl ? "rtl" : "ltr" } },
  })
  if (!editor) return null
  const action = (label: string, handler: () => void, active = false) => <Button type="button" size="small" variant={active ? "primary" : "secondary"} onClick={handler}>{label}</Button>
  const editLink = () => {
    const currentUrl = editor.getAttributes("link").href || ""
    const url = window.prompt("כתובת הקישור (לדוגמה: /il/pages/shipping)", currentUrl)
    if (url === null) return
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run()
  }
  return <div>
    <div className="flex flex-wrap gap-1 rounded-t-lg border border-ui-border-base bg-ui-bg-subtle p-2">
      {action("P", () => editor.chain().focus().setParagraph().run(), editor.isActive("paragraph"))}
      {action("H2", () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive("heading", { level: 2 }))}
      {action("H3", () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive("heading", { level: 3 }))}
      {action("B", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}
      {action("I", () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"))}
      {action("קישור", editLink, editor.isActive("link"))}
      {editor.isActive("link") && action("הסרת קישור", () => editor.chain().focus().extendMarkRange("link").unsetLink().run())}
      {action("•", () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"))}
      {action("1.", () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"))}
      {action("❝", () => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote"))}
      {action("↶", () => editor.chain().focus().undo().run())}
      {action("↷", () => editor.chain().focus().redo().run())}
    </div>
    <EditorContent editor={editor} />
  </div>
}
