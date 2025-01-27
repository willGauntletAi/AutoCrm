import { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "./ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "./ui/popover"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TicketTagKey } from '../lib/db'
import { Label } from './ui/label'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"

interface AddTagActionProps {
    tagKeys: Array<{
        id: string;
        name: string;
        tag_type: string;
    }>;
    excludeTagIds: string[];
    onSubmit: (tagKey: { id: string; name: string; tag_type: string }, value: string) => void;
    onCancel: () => void;
}

export function AddTagAction({ tagKeys, excludeTagIds, onSubmit, onCancel }: AddTagActionProps) {
    const [selectedTagKey, setSelectedTagKey] = useState<string>('')
    const [value, setValue] = useState('')

    const selectedTag = tagKeys.find(k => k.id === selectedTagKey)

    // Fetch enum options for selected tag
    const enumOptions = useLiveQuery(
        async () => {
            if (!selectedTagKey || selectedTag?.tag_type !== 'enum') return []
            return await db.ticketTagEnumOptions
                .where('tag_key_id')
                .equals(selectedTagKey)
                .filter(opt => !opt.deleted_at)
                .toArray()
        },
        [selectedTagKey, selectedTag?.tag_type],
        []
    )

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const tag = tagKeys.find(k => k.id === selectedTagKey)
        if (!tag || !value) return
        onSubmit(tag, value)
    }

    const renderValueInput = () => {
        if (!selectedTag) return null

        switch (selectedTag.tag_type) {
            case 'date':
                return (
                    <Input
                        type="number"
                        value={value}
                        onChange={e => setValue(e.target.value)}
                    />
                )
            case 'number':
                return (
                    <Input
                        type="number"
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        step="0.1"
                    />
                )
            case 'text':
                return (
                    <Input
                        type="text"
                        value={value}
                        onChange={e => setValue(e.target.value)}
                    />
                )
            case 'enum':
                return (
                    <Select
                        value={value}
                        onValueChange={setValue}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select value" />
                        </SelectTrigger>
                        <SelectContent>
                            {enumOptions.map(option => (
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
        <>
            <div className="flex gap-4">
                <div className="flex-1">
                    <Label className="mb-2 block">Tag</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between"
                            >
                                <span className="truncate flex-1 text-left">
                                    {selectedTag ? selectedTag.name : "Select tag..."}
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-0" align="start">
                            <Command className="rounded-lg bg-white">
                                <CommandInput placeholder="Search tags..." className="h-9" />
                                <CommandList>
                                    <CommandEmpty>No tag found.</CommandEmpty>
                                    <CommandGroup>
                                        {tagKeys.map((key) => (
                                            <CommandItem
                                                key={key.id}
                                                value={key.name}
                                                className="hover:bg-gray-100"
                                                onSelect={() => setSelectedTagKey(key.id)}
                                            >
                                                {key.name}
                                                <Check
                                                    className={cn(
                                                        "ml-auto h-4 w-4",
                                                        selectedTag?.id === key.id ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>

                {selectedTag && (
                    <div className="flex-1">
                        <Label className="mb-2 block">
                            {selectedTag.tag_type === 'date' ? 'Days from now' : selectedTag.tag_type === 'enum' ? 'Value' : 'Value'}
                        </Label>
                        {renderValueInput()}
                    </div>
                )}
            </div>

            <div className="space-x-2">
                <Button
                    type="submit"
                    disabled={!selectedTag || !value.trim()}
                    onClick={handleSubmit}
                >
                    Add
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    onClick={onCancel}
                >
                    Cancel
                </Button>
            </div>
        </>
    )
} 