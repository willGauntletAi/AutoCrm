import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { X } from 'lucide-react'
import type { TicketTagKey } from '@/lib/db'
import { db } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'

interface TagFilterProps {
    availableTags: TicketTagKey[]
    filter: {
        tagKeyId: string
        operator: 'eq' | 'lt' | 'gt' | 'prefix' | 'neq'
        value: string
    }
    onDelete: () => void
    onChange: (filter: { tagKeyId: string; operator: 'eq' | 'lt' | 'gt' | 'prefix' | 'neq'; value: string }) => void
}

export function TagFilter({ availableTags, filter, onDelete, onChange }: TagFilterProps) {
    const selectedTag = availableTags.find(tag => tag.id === filter.tagKeyId)

    // Fetch enum options when an enum tag is selected
    const enumOptions = useLiveQuery(
        async () => {
            if (!selectedTag || selectedTag.tag_type !== 'enum') return []
            return await db.ticketTagEnumOptions
                .where('tag_key_id')
                .equals(selectedTag.id)
                .filter(opt => !opt.deleted_at)
                .toArray()
        },
        [selectedTag?.id]
    )

    const renderValueInput = () => {
        if (!selectedTag) return null

        switch (selectedTag.tag_type) {
            case 'date':
                return (
                    <Input
                        type="date"
                        value={filter.value}
                        onChange={(e) => onChange({ ...filter, value: e.target.value })}
                        className="w-[200px]"
                    />
                )
            case 'number':
                return (
                    <Input
                        type="number"
                        value={filter.value}
                        onChange={(e) => onChange({ ...filter, value: e.target.value })}
                        className="w-[200px]"
                    />
                )
            case 'text':
                return (
                    <Input
                        type="text"
                        value={filter.value}
                        onChange={(e) => onChange({ ...filter, value: e.target.value })}
                        className="w-[200px]"
                    />
                )
            case 'enum':
                return (
                    <Select
                        value={filter.value}
                        onValueChange={(value) => onChange({ ...filter, value })}
                    >
                        <SelectTrigger className="w-[200px]">
                            <SelectValue>
                                {enumOptions?.find(opt => opt.id === filter.value)?.value || 'Select value'}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {enumOptions?.map(option => (
                                <SelectItem key={option.id} value={option.id}>
                                    {option.value}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )
        }
    }

    return (
        <div className="flex items-center gap-2">
            <Select
                value={filter.tagKeyId}
                onValueChange={(value) => {
                    const tag = availableTags.find(t => t.id === value)
                    if (!tag) return

                    // Reset operator and value when tag type changes
                    onChange({
                        tagKeyId: value,
                        operator: tag.tag_type === 'text' ? 'eq' :
                            tag.tag_type === 'enum' ? 'eq' : 'eq',
                        value: ''
                    })
                }}
            >
                <SelectTrigger className="w-[200px]">
                    <SelectValue>
                        {selectedTag?.name || 'Select tag'}
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {availableTags.map(tag => (
                        <SelectItem key={tag.id} value={tag.id}>
                            {tag.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {selectedTag && (
                <Select
                    value={filter.operator}
                    onValueChange={(value: 'eq' | 'lt' | 'gt' | 'prefix' | 'neq') => {
                        onChange({ ...filter, operator: value })
                    }}
                >
                    <SelectTrigger className="w-[140px]">
                        <SelectValue>
                            {filter.operator === 'eq' && 'Equals'}
                            {filter.operator === 'lt' && 'Less than'}
                            {filter.operator === 'gt' && 'Greater than'}
                            {filter.operator === 'prefix' && 'Starts with'}
                            {filter.operator === 'neq' && 'Not equal'}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="eq">Equals</SelectItem>
                        {selectedTag.tag_type === 'enum' ? (
                            <SelectItem value="neq">Not equal</SelectItem>
                        ) : selectedTag.tag_type !== 'text' ? (
                            <>
                                <SelectItem value="lt">Less than</SelectItem>
                                <SelectItem value="gt">Greater than</SelectItem>
                            </>
                        ) : (
                            <SelectItem value="prefix">Starts with</SelectItem>
                        )}
                    </SelectContent>
                </Select>
            )}

            {renderValueInput()}

            <Button
                variant="ghost"
                size="icon"
                onClick={onDelete}
                className="h-10 w-10"
            >
                <X className="h-4 w-4" />
            </Button>
        </div>
    )
} 