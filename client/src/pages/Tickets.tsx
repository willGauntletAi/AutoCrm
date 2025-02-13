import { useState, useRef } from 'react'
import { Button } from '../components/ui/button'
import { useParams } from 'react-router-dom'
import { Badge } from '../components/ui/badge'
import { CreateTicketDialog } from '../components/CreateTicketDialog'
import { db } from '../lib/db'
import { createTicket } from '../lib/mutations'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAuth } from '@/lib/auth'
import type { TicketTagKey } from '../lib/db'
import { TicketFilters, type TagFilter } from '../components/TicketFilters'
import { useVirtualizer } from '@tanstack/react-virtual'
import { TicketCard } from '../components/TicketCard'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

export default function Tickets() {
    const { organization_id } = useParams<{ organization_id: string }>()
    const [isCreatingTicket, setIsCreatingTicket] = useState(false)
    const [tagFilters, setTagFilters] = useState<TagFilter[]>([])
    const { user } = useAuth()
    const parentRef = useRef<HTMLDivElement>(null)
    const [selectedTicketTags, setSelectedTicketTags] = useState<{
        ticketId: string;
        title: string;
        tags: Array<{ key: TicketTagKey; value: string }>;
    } | null>(null)

    if (!organization_id) {
        return <div>No organization selected</div>;
    }

    const tickets = useLiveQuery(
        async () => {
            // First get all tag keys for the organization
            const tagKeys = await db.ticketTagKeys
                .where('organization_id')
                .equals(organization_id!)
                .filter(key => !key.deleted_at)
                .toArray()

            // Start with all tickets in the organization
            let ticketsList = await db.tickets
                .where('organization_id')
                .equals(organization_id!)
                .filter(ticket => !ticket.deleted_at)
                .toArray()

            // Apply tag filters
            if (tagFilters.length > 0) {
                const filteredTicketIds = new Set<string>()
                const processedTickets = new Set<string>()

                for (const filter of tagFilters) {
                    const tagKey = tagKeys.find(tk => tk.id === filter.tagKeyId)
                    if (!tagKey) continue

                    let matchingTickets: string[] = []

                    switch (tagKey.tag_type) {
                        case 'date': {
                            const dateValues = await db.ticketTagDateValues
                                .where('tag_key_id')
                                .equals(filter.tagKeyId)
                                .filter(v => !v.deleted_at)
                                .toArray()

                            const filterDate = new Date(filter.value)
                            matchingTickets = dateValues
                                .filter(v => {
                                    const valueDate = new Date(v.value)
                                    switch (filter.operator) {
                                        case 'eq': return valueDate.getTime() === filterDate.getTime()
                                        case 'lt': return valueDate < filterDate
                                        case 'gt': return valueDate > filterDate
                                        default: return false
                                    }
                                })
                                .map(v => v.ticket_id)
                            break
                        }
                        case 'number': {
                            const numberValues = await db.ticketTagNumberValues
                                .where('tag_key_id')
                                .equals(filter.tagKeyId)
                                .filter(v => !v.deleted_at)
                                .toArray()

                            const filterNumber = Number(filter.value)
                            matchingTickets = numberValues
                                .filter(v => {
                                    switch (filter.operator) {
                                        case 'eq': return v.value === filterNumber
                                        case 'lt': return v.value < filterNumber
                                        case 'gt': return v.value > filterNumber
                                        default: return false
                                    }
                                })
                                .map(v => v.ticket_id)
                            break
                        }
                        case 'text': {
                            const textValues = await db.ticketTagTextValues
                                .where('tag_key_id')
                                .equals(filter.tagKeyId)
                                .filter(v => !v.deleted_at)
                                .toArray()

                            matchingTickets = textValues
                                .filter(v => {
                                    switch (filter.operator) {
                                        case 'eq': return v.value === filter.value
                                        case 'prefix': return v.value.startsWith(filter.value)
                                        default: return false
                                    }
                                })
                                .map(v => v.ticket_id)
                            break
                        }
                        case 'enum': {
                            const enumValues = await db.ticketTagEnumValues
                                .where('tag_key_id')
                                .equals(filter.tagKeyId)
                                .filter(v => !v.deleted_at)
                                .toArray()

                            matchingTickets = enumValues
                                .filter(v => {
                                    switch (filter.operator) {
                                        case 'eq': return v.enum_option_id === filter.value
                                        case 'neq': return v.enum_option_id !== filter.value
                                        default: return false
                                    }
                                })
                                .map(v => v.ticket_id)
                            break
                        }
                    }

                    // For the first filter, add all matching tickets
                    if (processedTickets.size === 0) {
                        matchingTickets.forEach(id => filteredTicketIds.add(id))
                    } else {
                        // For subsequent filters, only keep tickets that match all filters
                        const newFilteredIds = new Set<string>()
                        matchingTickets.forEach(id => {
                            if (filteredTicketIds.has(id)) {
                                newFilteredIds.add(id)
                            }
                        })
                        filteredTicketIds.clear()
                        newFilteredIds.forEach(id => filteredTicketIds.add(id))
                    }

                    processedTickets.add(filter.tagKeyId)
                }

                // Filter tickets to only those matching all filters
                ticketsList = ticketsList.filter(ticket => filteredTicketIds.has(ticket.id))
            }

            // Get all ticket IDs for fetching tag values
            const ticketIds = ticketsList.map(t => t.id)

            // Fetch all tag values for these tickets
            const [dateValues, numberValues, textValues, enumValues] = await Promise.all([
                db.ticketTagDateValues
                    .where('ticket_id')
                    .anyOf(ticketIds)
                    .filter(v => !v.deleted_at)
                    .toArray(),
                db.ticketTagNumberValues
                    .where('ticket_id')
                    .anyOf(ticketIds)
                    .filter(v => !v.deleted_at)
                    .toArray(),
                db.ticketTagTextValues
                    .where('ticket_id')
                    .anyOf(ticketIds)
                    .filter(v => !v.deleted_at)
                    .toArray(),
                db.ticketTagEnumValues
                    .where('ticket_id')
                    .anyOf(ticketIds)
                    .filter(v => !v.deleted_at)
                    .toArray()
            ])

            // Fetch enum options for all enum values
            const enumOptions = await db.ticketTagEnumOptions
                .where('id')
                .anyOf(enumValues.map(v => v.enum_option_id))
                .filter(opt => !opt.deleted_at)
                .toArray()

            // Create a map of enum options by ID for quick lookup
            const enumOptionsMap = new Map(enumOptions.map(opt => [opt.id, opt]))

            // Create a map of tag values by ticket ID
            const tagValuesByTicket = new Map(ticketIds.map(id => [id, {
                date: new Map<string, string>(),
                number: new Map<string, string>(),
                text: new Map<string, string>(),
                enum: new Map<string, { value: string; optionId: string }>()
            }]))

            // Populate the tag values maps
            dateValues.forEach(v => {
                const ticketTags = tagValuesByTicket.get(v.ticket_id)
                if (ticketTags) {
                    // Convert Date to ISO string for storage
                    ticketTags.date.set(v.tag_key_id, v.value.toDateString())
                }
            })

            numberValues.forEach(v => {
                const ticketTags = tagValuesByTicket.get(v.ticket_id)
                if (ticketTags) {
                    ticketTags.number.set(v.tag_key_id, v.value.toString())
                }
            })

            textValues.forEach(v => {
                const ticketTags = tagValuesByTicket.get(v.ticket_id)
                if (ticketTags) {
                    ticketTags.text.set(v.tag_key_id, v.value)
                }
            })

            enumValues.forEach(v => {
                const ticketTags = tagValuesByTicket.get(v.ticket_id)
                const enumOption = enumOptionsMap.get(v.enum_option_id)
                if (ticketTags && enumOption) {
                    ticketTags.enum.set(v.tag_key_id, {
                        value: enumOption.value,
                        optionId: enumOption.id
                    })
                }
            })

            return {
                tickets: ticketsList.map(ticket => ({
                    ...ticket,
                    tags: {
                        keys: tagKeys,
                        values: tagValuesByTicket.get(ticket.id) || {
                            date: new Map(),
                            number: new Map(),
                            text: new Map(),
                            enum: new Map()
                        }
                    }
                })),
                tagKeys
            };
        },
        [organization_id, tagFilters],
        { tickets: [], tagKeys: [] }
    )

    const virtualizer = useVirtualizer({
        count: tickets?.tickets.length ?? 0,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 100,
        overscan: 5
    })

    const handleCreateTicket = async (data: { title: string; description: string; priority: 'high' | 'low' | 'medium' }) => {
        if (!user) return

        try {
            setIsCreatingTicket(true)
            await createTicket({
                id: crypto.randomUUID(),
                title: data.title,
                description: data.description,
                priority: data.priority,
                organization_id: organization_id!,
                status: 'open',
                created_by: user.id,
                assigned_to: null,
            })
            setIsCreatingTicket(false)
        } catch (err) {
            console.error('Failed to create ticket:', err)
        }
    }

    const handleTagClick = (filter: TagFilter) => {
        setTagFilters(prev => [...prev, filter])
    }

    if (!tickets) return null

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex justify-between items-center">
                <Button
                    onClick={() => setIsCreatingTicket(true)}
                >
                    Create Ticket
                </Button>
            </div>

            <div className="flex flex-col gap-4">
                <TicketFilters
                    tagKeys={tickets.tagKeys}
                    tagFilters={tagFilters}
                    setTagFilters={setTagFilters}
                />
            </div>

            <div ref={parentRef} className="flex flex-col gap-4 h-[calc(100vh-200px)] overflow-auto">
                <div
                    style={{
                        height: `${virtualizer.getTotalSize()}px`,
                        width: '100%',
                        position: 'relative'
                    }}
                >
                    {virtualizer.getVirtualItems().map((virtualItem) => {
                        const ticket = tickets.tickets[virtualItem.index]
                        if (!ticket) return null

                        return (
                            <div
                                key={virtualItem.key}
                                data-index={virtualItem.index}
                                ref={virtualizer.measureElement}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    transform: `translateY(${virtualItem.start}px)`
                                }}
                            >
                                <TicketCard
                                    {...ticket}
                                    linkPath={`/${organization_id}/tickets/${ticket.id}`}
                                    onTagClick={handleTagClick}
                                    tags={ticket.tags && tickets.tagKeys.length > 0 ? {
                                        keys: tickets.tagKeys,
                                        values: ticket.tags.values
                                    } : undefined}
                                />
                            </div>
                        )
                    })}
                </div>
            </div>

            {isCreatingTicket && (
                <CreateTicketDialog
                    open={isCreatingTicket}
                    onOpenChange={setIsCreatingTicket}
                    onSubmit={handleCreateTicket}
                    isLoading={false}
                />
            )}

            <Dialog
                open={selectedTicketTags !== null}
                onOpenChange={(open) => {
                    if (!open) setSelectedTicketTags(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Tags for {selectedTicketTags?.title}</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-wrap gap-2">
                        {selectedTicketTags?.tags.map((tag) => (
                            <Badge
                                key={tag.key.id}
                                variant="outline"
                                className="bg-blue-50 cursor-pointer hover:bg-blue-100"
                                onClick={() => {
                                    setTagFilters(prev => [
                                        ...prev,
                                        {
                                            tagKeyId: tag.key.id,
                                            operator: tag.key.tag_type === 'text' ? 'eq' :
                                                tag.key.tag_type === 'enum' ? 'eq' : 'eq',
                                            value: tag.key.tag_type === 'enum' ?
                                                tag.value :
                                                tag.value
                                        }
                                    ]);
                                    setSelectedTicketTags(null);
                                }}
                            >
                                {tag.key.name}: {tag.value}
                            </Badge>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
} 