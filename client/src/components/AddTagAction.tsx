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

interface AddTagActionProps {
    tagKeys: TicketTagKey[]
    onSubmit: (tagKey: TicketTagKey, value: string) => void
    onCancel: () => void
    excludeTagIds?: string[]
}

export function AddTagAction({ tagKeys, onSubmit, onCancel, excludeTagIds = [] }: AddTagActionProps) {
    const [open, setOpen] = useState(false)
    const [selectedKey, setSelectedKey] = useState<TicketTagKey | null>(null)
    const [value, setValue] = useState('')

    // Filter out already used tags
    const availableTags = tagKeys.filter(tag => !excludeTagIds.includes(tag.id))

    // Reset value when tag key changes
    const handleTagSelect = (key: TicketTagKey) => {
        setSelectedKey(key)
        setValue('')
        setOpen(false)
    }

    const handleAdd = () => {
        if (!selectedKey || !value.trim()) return
        // Convert days to milliseconds for date tags
        onSubmit(selectedKey, value);
    }

    return (
        <>
            <div className="flex gap-4">
                <div className="flex-1">
                    <Label className="mb-2 block">Tag</Label>
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={open}
                                className="w-full justify-between"
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
                                        {availableTags.map((key) => (
                                            <CommandItem
                                                key={key.id}
                                                value={key.name}
                                                className="hover:bg-gray-100"
                                                onSelect={() => handleTagSelect(key)}
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

                {selectedKey && (
                    <div className="flex-1">
                        <Label className="mb-2 block">
                            {selectedKey.tag_type === 'date' ? 'Days from now' : 'Value'}
                        </Label>
                        <Input
                            type={selectedKey.tag_type === 'text' ? 'text' : 'number'}
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            className="w-full"
                            placeholder={selectedKey.tag_type === 'date' ? 'e.g. 1 for tomorrow' : ''}
                            step={selectedKey.tag_type === 'date' ? '0.1' : undefined}
                        />
                    </div>
                )}
            </div>

            <div className="space-x-2">
                <Button
                    type="submit"
                    disabled={!selectedKey || !value.trim()}
                    onClick={handleAdd}
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