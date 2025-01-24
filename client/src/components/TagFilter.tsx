import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { X } from 'lucide-react'
import type { TicketTagKey } from '@/lib/db'

interface TagFilterProps {
    availableTags: TicketTagKey[]
    filter: {
        tagKeyId: string
        operator: 'eq' | 'lt' | 'gt' | 'prefix'
        value: string
    }
    onDelete: () => void
    onChange: (filter: { tagKeyId: string; operator: 'eq' | 'lt' | 'gt' | 'prefix'; value: string }) => void
}

export function TagFilter({ availableTags, filter, onDelete, onChange }: TagFilterProps) {
    const selectedTag = availableTags.find(tag => tag.id === filter.tagKeyId)

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
                        operator: tag.tag_type === 'text' ? 'eq' : 'eq',
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
                    onValueChange={(value: 'eq' | 'lt' | 'gt' | 'prefix') => {
                        onChange({ ...filter, operator: value })
                    }}
                >
                    <SelectTrigger className="w-[140px]">
                        <SelectValue>
                            {filter.operator === 'eq' && 'Equals'}
                            {filter.operator === 'lt' && 'Less than'}
                            {filter.operator === 'gt' && 'Greater than'}
                            {filter.operator === 'prefix' && 'Starts with'}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="eq">Equals</SelectItem>
                        {selectedTag.tag_type !== 'text' && (
                            <>
                                <SelectItem value="lt">Less than</SelectItem>
                                <SelectItem value="gt">Greater than</SelectItem>
                            </>
                        )}
                        {selectedTag.tag_type === 'text' && (
                            <SelectItem value="prefix">Starts with</SelectItem>
                        )}
                    </SelectContent>
                </Select>
            )}

            {selectedTag && (
                <Input
                    type={selectedTag.tag_type === 'number' ? 'number' : selectedTag.tag_type === 'date' ? 'datetime-local' : 'text'}
                    value={filter.value}
                    onChange={(e) => onChange({ ...filter, value: e.target.value })}
                    className="w-[200px]"
                />
            )}

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