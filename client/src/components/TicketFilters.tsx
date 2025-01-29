import { Button } from './ui/button'
import { TagFilter } from './TagFilter'
import type { TicketTagKey } from '../lib/db'

export type TagFilter = {
    tagKeyId: string;
    operator: 'eq' | 'lt' | 'gt' | 'prefix' | 'neq';
    value: string;
}

interface TicketFiltersProps {
    tagKeys: TicketTagKey[];
    tagFilters: TagFilter[];
    setTagFilters: (filters: TagFilter[]) => void;
}

export function TicketFilters({ tagKeys, tagFilters, setTagFilters }: TicketFiltersProps) {
    return (
        <div className="space-y-2">
            {tagFilters.map((filter, index) => (
                <TagFilter
                    key={index}
                    availableTags={tagKeys}
                    filter={filter}
                    onDelete={() => {
                        const newFilters = [...tagFilters]
                        newFilters.splice(index, 1)
                        setTagFilters(newFilters)
                    }}
                    onChange={(updatedFilter) => {
                        const newFilters = [...tagFilters]
                        newFilters[index] = updatedFilter
                        setTagFilters(newFilters)
                    }}
                />
            ))}
            <Button
                variant="outline"
                onClick={() => {
                    setTagFilters([
                        ...tagFilters,
                        { tagKeyId: '', operator: 'eq', value: '' }
                    ])
                }}
                className="w-full"
            >
                Add Filter
            </Button>
        </div>
    )
} 