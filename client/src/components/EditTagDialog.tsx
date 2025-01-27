import { useState, useEffect } from 'react'
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
import { ScrollArea } from "./ui/scroll-area"
import { updateTicketTagKey } from '../lib/mutations'
import { PlusCircle, X } from 'lucide-react'
import { db } from '../lib/db'
import { useLiveQuery } from 'dexie-react-hooks'

const TAG_TYPES = ['text', 'number', 'date', 'enum'] as const
type TagType = typeof TAG_TYPES[number]

interface EnumValue {
    id?: string
    value: string
    description: string | null
}

interface EditTagDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    tagId: string
    onSuccess?: () => void
}

export function EditTagDialog({ open, onOpenChange, tagId, onSuccess }: EditTagDialogProps) {
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [type, setType] = useState<TagType>('text')
    const [enumValues, setEnumValues] = useState<EnumValue[]>([])
    const [isUpdating, setIsUpdating] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Fetch the tag data
    const tag = useLiveQuery(
        async () => {
            if (!tagId) return null
            return await db.ticketTagKeys
                .where('id')
                .equals(tagId)
                .first()
        },
        [tagId]
    )

    // Fetch enum options if this is an enum tag
    const enumOptions = useLiveQuery(
        async () => {
            if (!tagId || tag?.tag_type !== 'enum') return []
            return await db.ticketTagEnumOptions
                .where('tag_key_id')
                .equals(tagId)
                .filter(option => !option.deleted_at)
                .toArray()
        },
        [tagId, tag?.tag_type]
    )

    // Update form when tag data is loaded
    useEffect(() => {
        if (tag) {
            setName(tag.name)
            setDescription(tag.description || '')
            setType(tag.tag_type as TagType)
        }
    }, [tag])

    // Update enum values when options are loaded
    useEffect(() => {
        if (enumOptions) {
            setEnumValues(enumOptions.map(option => ({
                id: option.id,
                value: option.value,
                description: option.description
            })))
        }
    }, [enumOptions])

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim() || !tagId) return

        try {
            setIsUpdating(true)
            setError(null)

            // Update the tag key
            await updateTicketTagKey(tagId, {
                name: name.trim(),
                description: description.trim() || null,
                tag_type: type,
            })

            // If this is an enum tag, update the enum options
            if (type === 'enum') {
                const timestamp = new Date().toISOString()

                // Delete removed options
                const existingOptionIds = new Set(enumOptions?.map(o => o.id) || [])
                const keptOptionIds = new Set(enumValues.filter(v => v.id).map(v => v.id!))
                const optionsToDelete = [...existingOptionIds].filter(id => !keptOptionIds.has(id))

                for (const id of optionsToDelete) {
                    await db.ticketTagEnumOptions.update(id, {
                        deleted_at: timestamp,
                        updated_at: timestamp
                    })
                    await db.mutations.add({
                        operation: {
                            operation: 'delete_ticket_tag_enum_option',
                            data: { id }
                        },
                        timestamp: Date.now(),
                        synced: 0
                    })
                }

                // Update existing and create new options
                for (const enumValue of enumValues) {
                    if (enumValue.id) {
                        // Update existing option
                        await db.ticketTagEnumOptions.update(enumValue.id, {
                            value: enumValue.value.trim(),
                            description: enumValue.description,
                            updated_at: timestamp
                        })
                        await db.mutations.add({
                            operation: {
                                operation: 'update_ticket_tag_enum_option',
                                data: {
                                    id: enumValue.id,
                                    tag_key_id: tagId,
                                    value: enumValue.value.trim(),
                                    description: enumValue.description
                                }
                            },
                            timestamp: Date.now(),
                            synced: 0
                        })
                    } else {
                        // Create new option
                        const newId = crypto.randomUUID()
                        await db.ticketTagEnumOptions.add({
                            id: newId,
                            tag_key_id: tagId,
                            value: enumValue.value.trim(),
                            description: enumValue.description,
                            created_at: timestamp,
                            updated_at: timestamp,
                            deleted_at: null
                        })
                        await db.mutations.add({
                            operation: {
                                operation: 'create_ticket_tag_enum_option',
                                data: {
                                    id: newId,
                                    tag_key_id: tagId,
                                    value: enumValue.value.trim(),
                                    description: enumValue.description
                                }
                            },
                            timestamp: Date.now(),
                            synced: 0
                        })
                    }
                }
            }

            onOpenChange(false)
            onSuccess?.()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update tag')
        } finally {
            setIsUpdating(false)
        }
    }

    if (!tag) {
        return null
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Edit Tag</DialogTitle>
                    <DialogDescription>
                        Modify the tag's properties.
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
                        <Select
                            value={type}
                            onValueChange={(value) => setType(value as TagType)}
                            disabled={true}
                        >
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
                        <p className="text-sm text-gray-500 mt-1">
                            Tag type cannot be changed after creation
                        </p>
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
                            <ScrollArea className="h-[300px] pr-4">
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
                            </ScrollArea>
                        </div>
                    )}
                    <DialogFooter>
                        <Button
                            type="submit"
                            disabled={isUpdating || !name.trim() || (type === 'enum' && !enumValues.some(ev => ev.value.trim()))}
                        >
                            {isUpdating ? 'Updating...' : 'Update Tag'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
} 
