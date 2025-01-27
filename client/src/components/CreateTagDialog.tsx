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
import { createTicketTagEnumOption } from '../lib/mutations'
import { PlusCircle, X } from 'lucide-react'

const TAG_TYPES = ['text', 'number', 'date', 'enum'] as const
type TagType = typeof TAG_TYPES[number]

interface EnumValue {
    value: string
    description: string | null
}

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
    const [enumValues, setEnumValues] = useState<EnumValue[]>([{ value: '', description: null }])
    const [isCreating, setIsCreating] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) return

        try {
            setIsCreating(true)
            setError(null)

            // Create the tag key first
            const tagKeyId = crypto.randomUUID()
            await createTicketTagKey({
                id: tagKeyId,
                organization_id: organizationId,
                name: name.trim(),
                description: description.trim() || null,
                tag_type: type,
            })

            // If it's an enum type, create the enum options
            if (type === 'enum') {
                const validEnumValues = enumValues.filter(ev => ev.value.trim())
                if (validEnumValues.length === 0) {
                    throw new Error('At least one enum value is required')
                }

                await Promise.all(
                    validEnumValues.map(ev =>
                        createTicketTagEnumOption({
                            id: crypto.randomUUID(),
                            tag_key_id: tagKeyId,
                            value: ev.value.trim(),
                            description: ev.description?.trim() || null,
                        })
                    )
                )
            }

            onOpenChange(false)
            setName('')
            setDescription('')
            setType('text')
            setEnumValues([{ value: '', description: null }])
            onSuccess?.()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create tag')
        } finally {
            setIsCreating(false)
        }
    }

    const addEnumValue = () => {
        setEnumValues([...enumValues, { value: '', description: null }])
    }

    const updateEnumValue = (index: number, field: keyof EnumValue, value: string) => {
        const newValues = [...enumValues]
        newValues[index] = { ...newValues[index], [field]: value || null }
        setEnumValues(newValues)
    }

    const removeEnumValue = (index: number) => {
        if (enumValues.length > 1) {
            setEnumValues(enumValues.filter((_, i) => i !== index))
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
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
                    {type === 'enum' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label>Enum Values</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addEnumValue}
                                    className="flex items-center gap-2"
                                >
                                    <PlusCircle className="h-4 w-4" />
                                    Add Value
                                </Button>
                            </div>
                            <div className="space-y-4">
                                {enumValues.map((enumValue, index) => (
                                    <div key={index} className="flex gap-4 items-start">
                                        <div className="flex-1 space-y-2">
                                            <Label>Value</Label>
                                            <Input
                                                value={enumValue.value}
                                                onChange={(e) => updateEnumValue(index, 'value', e.target.value)}
                                                placeholder="e.g. High, Medium, Low"
                                            />
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <Label>Description (optional)</Label>
                                            <Input
                                                value={enumValue.description || ''}
                                                onChange={(e) => updateEnumValue(index, 'description', e.target.value)}
                                                placeholder="Description of this value"
                                            />
                                        </div>
                                        {enumValues.length > 1 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeEnumValue(index)}
                                                className="mt-8"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button
                            type="submit"
                            disabled={isCreating || !name.trim() || (type === 'enum' && !enumValues.some(ev => ev.value.trim()))}
                        >
                            {isCreating ? 'Creating...' : 'Create Tag'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
} 