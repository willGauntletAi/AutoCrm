import { useState, useEffect } from 'react'
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TicketTagKey } from '../lib/db'
import { db } from '../lib/db'
import { useLiveQuery } from 'dexie-react-hooks'

interface AddTagValueProps {
    tagKeys: TicketTagKey[]
    onSubmit: (tagKey: TicketTagKey, value: string) => Promise<void>
    onCancel: () => void
    isSubmitting?: boolean
}

export function AddTagValue({ tagKeys, onSubmit, onCancel, isSubmitting }: AddTagValueProps) {
    const [open, setOpen] = useState(false)
    const [selectedKey, setSelectedKey] = useState<TicketTagKey | null>(null)
    const [value, setValue] = useState('')

    // Fetch enum options when an enum tag is selected
    const enumOptions = useLiveQuery(
        async () => {
            if (!selectedKey || selectedKey.tag_type !== 'enum') return []
            return await db.ticketTagEnumOptions
                .where('tag_key_id')
                .equals(selectedKey.id)
                .filter(opt => !opt.deleted_at)
                .toArray()
        },
        [selectedKey]
    )

    // Reset value when tag key changes
    useEffect(() => {
        setValue('')
    }, [selectedKey])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedKey || !value.trim()) return
        await onSubmit(selectedKey, value)
    }

    const renderValueInput = () => {
        if (!selectedKey) return null

        switch (selectedKey.tag_type) {
            case 'date':
                return (
                    <Input
                        type="date"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className="w-[200px]"
                        disabled={isSubmitting}
                    />
                )
            case 'number':
                return (
                    <Input
                        type="number"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className="w-[200px]"
                        disabled={isSubmitting}
                    />
                )
            case 'text':
                return (
                    <Input
                        type="text"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className="w-[200px]"
                        disabled={isSubmitting}
                    />
                )
            case 'enum':
                return (
                    <Select
                        value={value}
                        onValueChange={setValue}
                        disabled={isSubmitting}
                    >
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Select value..." />
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
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <div className="flex flex-col w-[200px] gap-2">
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            className="justify-between w-full"
                            disabled={isSubmitting}
                        >
                            <span className="truncate flex-1 text-left">
                                {selectedKey ? selectedKey.name : "Select tag..."}
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
                                            onSelect={() => {
                                                setSelectedKey(key)
                                                setOpen(false)
                                            }}
                                        >
                                            {key.name}
                                            <Check
                                                className={cn(
                                                    "ml-auto h-4 w-4",
                                                    selectedKey?.id === key.id ? "opacity-100" : "opacity-0"
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

            {renderValueInput()}

            <div className="space-x-2">
                <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmitting || !selectedKey || !value.trim()}
                >
                    {isSubmitting ? 'Adding...' : 'Add'}
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onCancel}
                    disabled={isSubmitting}
                >
                    Cancel
                </Button>
            </div>
        </form>
    )
} 