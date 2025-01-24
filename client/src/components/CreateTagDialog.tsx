import { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select"
import { createTicketTagKey } from '../lib/mutations'

const TAG_TYPES = ['text', 'number', 'date'] as const
type TagType = typeof TAG_TYPES[number]

interface CreateTagDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    organizationId: string
    onSuccess?: () => void
}

export function CreateTagDialog({ open, onOpenChange, organizationId, onSuccess }: CreateTagDialogProps) {
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [type, setType] = useState<TagType>('text')
    const [isCreating, setIsCreating] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) return

        try {
            setIsCreating(true)
            setError(null)
            await createTicketTagKey({
                id: crypto.randomUUID(),
                organization_id: organizationId,
                name: name.trim(),
                description: description.trim() || null,
                tag_type: type,
            })
            onOpenChange(false)
            setName('')
            setDescription('')
            setType('text')
            onSuccess?.()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create tag')
        } finally {
            setIsCreating(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New Tag</DialogTitle>
                    <DialogDescription>
                        Add a new tag to help categorize and filter tickets.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-md">
                            {error}
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Due Date, Story Points, Category"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Description (optional)</Label>
                        <Input
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What this tag is used for"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Type</Label>
                        <Select value={type} onValueChange={(value) => setType(value as TagType)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {TAG_TYPES.map((tagType) => (
                                    <SelectItem key={tagType} value={tagType}>
                                        {tagType.charAt(0).toUpperCase() + tagType.slice(1)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button
                            type="submit"
                            disabled={isCreating || !name.trim()}
                        >
                            {isCreating ? 'Creating...' : 'Create Tag'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
} 