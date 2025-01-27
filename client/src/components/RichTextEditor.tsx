import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { Button } from './ui/button'
import { Bold, Italic, Link as LinkIcon, List, ListOrdered } from 'lucide-react'
import { cn } from '@/lib/utils'
import DOMPurify from 'dompurify'
import { useEffect } from 'react'

interface RichTextEditorProps {
    content: string
    onChange: (content: string) => void
    disabled?: boolean
    className?: string
}

// Configure DOMPurify to only allow specific tags and attributes
const purifyConfig = {
    ALLOWED_TAGS: ['p', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'br'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
}

export function RichTextEditor({ content, onChange, disabled, className }: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                // Disable potentially dangerous features
                code: false,
                codeBlock: false,
                horizontalRule: false,
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-blue-600 hover:text-blue-800 underline',
                    target: '_blank',
                    rel: 'noopener noreferrer', // Security best practice for external links
                }
            })
        ],
        content: DOMPurify.sanitize(content, purifyConfig),
        editable: !disabled,
        onUpdate: ({ editor }) => {
            // Sanitize the HTML before sending it to the parent
            const sanitizedHtml = DOMPurify.sanitize(editor.getHTML(), purifyConfig)
            onChange(sanitizedHtml)
        }
    })

    // Update editor content when content prop changes
    useEffect(() => {
        if (editor && editor.getHTML() !== content) {
            editor.commands.setContent(DOMPurify.sanitize(content, purifyConfig))
        }
    }, [editor, content])

    if (!editor) {
        return null
    }

    const toggleLink = () => {
        const previousUrl = editor.getAttributes('link').href
        const url = window.prompt('URL', previousUrl)

        if (url === null) {
            return
        }

        if (url === '') {
            editor.chain().focus().unsetLink().run()
            return
        }

        // Basic URL validation
        try {
            new URL(url)
            editor.chain().focus().setLink({ href: url }).run()
        } catch {
            alert('Please enter a valid URL (including http:// or https://)')
        }
    }

    return (
        <div className={cn('space-y-2', className)}>
            <div className="flex gap-1 items-center">
                <Button
                    type="button"
                    variant={editor.isActive('bold') ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    disabled={disabled}
                >
                    <Bold className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    variant={editor.isActive('italic') ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    disabled={disabled}
                >
                    <Italic className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    variant={editor.isActive('link') ? 'default' : 'outline'}
                    size="sm"
                    onClick={toggleLink}
                    disabled={disabled}
                >
                    <LinkIcon className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    variant={editor.isActive('bulletList') ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    disabled={disabled}
                >
                    <List className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    variant={editor.isActive('orderedList') ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    disabled={disabled}
                >
                    <ListOrdered className="h-4 w-4" />
                </Button>
            </div>
            <div className={cn(
                'min-h-[100px] rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-within:outline-none focus-within:ring-1 focus-within:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
            )}>
                <EditorContent
                    editor={editor}
                    className={cn(
                        'prose prose-sm max-w-none [&_p]:m-0 [&_.ProseMirror]:min-h-[80px] [&_.ProseMirror:focus]:outline-none'
                    )}
                />
            </div>
        </div>
    )
}
