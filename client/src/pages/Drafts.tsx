import { useState, useRef } from 'react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { useParams, Link } from 'react-router-dom'
import { Badge } from '../components/ui/badge'
import { db } from '../lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAuth } from '@/lib/auth'
import type { TicketTagKey } from '../lib/db'
import { TicketFilters, type TagFilter } from '../components/TicketFilters'
import { formatDateTagValue, formatDateTime } from '@/lib/utils'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { TicketCard } from '../components/TicketCard'

export default function Drafts() {
    const { organization_id } = useParams<{ organization_id: string }>()
    const [error, setError] = useState<string | null>(null)
    const [tagFilters, setTagFilters] = useState<TagFilter[]>([])
    const { user } = useAuth()
    const parentRef = useRef<HTMLDivElement>(null)
    const [selectedTicketTags, setSelectedTicketTags] = useState<{
        ticketId: string;
        title: string;
        tags: Array<{ key: TicketTagKey; value: string }>;
    } | null>(null)

    const drafts = useLiveQuery(
        async () => {
            // First get all tag keys for the organization
            const tagKeys = await db.ticketTagKeys
                .where('organization_id')
                .equals(organization_id!)
                .filter(key => !key.deleted_at)
                .toArray()

            // Get all drafts in the organization
            let draftsList = await db.ticketDrafts
                .where('organization_id')
                .equals(organization_id!)
                .filter(draft => !draft.deleted_at)
                .toArray()

            // Apply tag filters
            if (tagFilters.length > 0) {
                const filteredDraftIds = new Set<string>()
                const processedDrafts = new Set<string>()

                for (const filter of tagFilters) {
                    const tagKey = tagKeys.find(tk => tk.id === filter.tagKeyId)
                    if (!tagKey) continue

                    let matchingDrafts: string[] = []

                    switch (tagKey.tag_type) {
                        case 'date': {
                            const dateValues = await db.ticketDraftTagDateValues
                                .where('tag_key_id')
                                .equals(filter.tagKeyId)
                                .filter(v => !v.deleted_at)
                                .toArray()

                            const filterDate = new Date(filter.value)
                            matchingDrafts = dateValues
                                .filter(v => {
                                    const valueDate = new Date(v.value)
                                    switch (filter.operator) {
                                        case 'eq': return valueDate.getTime() === filterDate.getTime()
                                        case 'lt': return valueDate < filterDate
                                        case 'gt': return valueDate > filterDate
                                        default: return false
                                    }
                                })
                                .map(v => v.ticket_draft_id)
                            break
                        }
                        case 'number': {
                            const numberValues = await db.ticketDraftTagNumberValues
                                .where('tag_key_id')
                                .equals(filter.tagKeyId)
                                .filter(v => !v.deleted_at)
                                .toArray()

                            const filterNumber = Number(filter.value)
                            matchingDrafts = numberValues
                                .filter(v => {
                                    switch (filter.operator) {
                                        case 'eq': return v.value === filterNumber
                                        case 'lt': return v.value < filterNumber
                                        case 'gt': return v.value > filterNumber
                                        default: return false
                                    }
                                })
                                .map(v => v.ticket_draft_id)
                            break
                        }
                        case 'text': {
                            const textValues = await db.ticketDraftTagTextValues
                                .where('tag_key_id')
                                .equals(filter.tagKeyId)
                                .filter(v => !v.deleted_at)
                                .toArray()

                            matchingDrafts = textValues
                                .filter(v => {
                                    switch (filter.operator) {
                                        case 'eq': return v.value === filter.value
                                        case 'prefix': return v.value.startsWith(filter.value)
                                        default: return false
                                    }
                                })
                                .map(v => v.ticket_draft_id)
                            break
                        }
                        case 'enum': {
                            const enumValues = await db.ticketDraftTagEnumValues
                                .where('tag_key_id')
                                .equals(filter.tagKeyId)
                                .filter(v => !v.deleted_at)
                                .toArray()

                            matchingDrafts = enumValues
                                .filter(v => {
                                    switch (filter.operator) {
                                        case 'eq': return v.enum_option_id === filter.value
                                        case 'neq': return v.enum_option_id !== filter.value
                                        default: return false
                                    }
                                })
                                .map(v => v.ticket_draft_id)
                            break
                        }
                    }

                    // For the first filter, add all matching drafts
                    if (processedDrafts.size === 0) {
                        matchingDrafts.forEach(id => filteredDraftIds.add(id))
                    } else {
                        // For subsequent filters, only keep drafts that match all filters
                        const newFilteredIds = new Set<string>()
                        matchingDrafts.forEach(id => {
                            if (filteredDraftIds.has(id)) {
                                newFilteredIds.add(id)
                            }
                        })
                        filteredDraftIds.clear()
                        newFilteredIds.forEach(id => filteredDraftIds.add(id))
                    }

                    processedDrafts.add(filter.tagKeyId)
                }

                // Filter drafts to only those matching all filters
                draftsList = draftsList.filter(draft => filteredDraftIds.has(draft.id))
            }

            // Get all draft IDs for fetching tag values
            const draftIds = draftsList.map(t => t.id)

            // Fetch all tag values for these drafts
            const [dateValues, numberValues, textValues, enumValues] = await Promise.all([
                db.ticketDraftTagDateValues
                    .where('ticket_draft_id')
                    .anyOf(draftIds)
                    .filter(v => !v.deleted_at)
                    .toArray(),
                db.ticketDraftTagNumberValues
                    .where('ticket_draft_id')
                    .anyOf(draftIds)
                    .filter(v => !v.deleted_at)
                    .toArray(),
                db.ticketDraftTagTextValues
                    .where('ticket_draft_id')
                    .anyOf(draftIds)
                    .filter(v => !v.deleted_at)
                    .toArray(),
                db.ticketDraftTagEnumValues
                    .where('ticket_draft_id')
                    .anyOf(draftIds)
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

            // Create a map of tag values by draft ID
            const tagValuesByDraft = new Map(draftIds.map(id => [id, {
                date: new Map<string, string>(),
                number: new Map<string, string>(),
                text: new Map<string, string>(),
                enum: new Map<string, { value: string; optionId: string }>()
            }]))

            // Populate the tag values maps
            dateValues.forEach(v => {
                const draftTags = tagValuesByDraft.get(v.ticket_draft_id)
                if (draftTags) {
                    draftTags.date.set(v.tag_key_id, v.value.toDateString())
                }
            })

            numberValues.forEach(v => {
                const draftTags = tagValuesByDraft.get(v.ticket_draft_id)
                if (draftTags) {
                    draftTags.number.set(v.tag_key_id, v.value.toString())
                }
            })

            textValues.forEach(v => {
                const draftTags = tagValuesByDraft.get(v.ticket_draft_id)
                if (draftTags) {
                    draftTags.text.set(v.tag_key_id, v.value)
                }
            })

            enumValues.forEach(v => {
                const draftTags = tagValuesByDraft.get(v.ticket_draft_id)
                const enumOption = enumOptionsMap.get(v.enum_option_id)
                if (draftTags && enumOption) {
                    draftTags.enum.set(v.tag_key_id, {
                        value: enumOption.value,
                        optionId: enumOption.id
                    })
                }
            })

            // Return both drafts and tag keys
            return {
                drafts: draftsList.map(draft => ({
                    ...draft,
                    tags: {
                        date: new Map(dateValues
                            .filter(v => v.ticket_draft_id === draft.id)
                            .map(v => [v.tag_key_id, v.value.toDateString()])),
                        number: new Map(numberValues
                            .filter(v => v.ticket_draft_id === draft.id)
                            .map(v => [v.tag_key_id, v.value.toString()])),
                        text: new Map(textValues
                            .filter(v => v.ticket_draft_id === draft.id)
                            .map(v => [v.tag_key_id, v.value])),
                        enum: new Map(enumValues
                            .filter(v => v.ticket_draft_id === draft.id)
                            .map(v => {
                                const option = enumOptionsMap.get(v.enum_option_id)
                                return [v.tag_key_id, { value: option?.value || '', optionId: v.enum_option_id }]
                            }))
                    }
                })),
                tagKeys
            }
        },
        [organization_id, tagFilters],
        { drafts: [], tagKeys: [] }
    )

    const rowVirtualizer = useVirtualizer({
        count: drafts.drafts.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 200,
        overscan: 5,
    })

    if (!drafts) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        )
    }

    const getPriorityColor = (priority: string) => {
        switch (priority.toLowerCase()) {
            case 'high':
                return 'bg-red-100 text-red-800'
            case 'medium':
                return 'bg-yellow-100 text-yellow-800'
            case 'low':
                return 'bg-green-100 text-green-800'
            default:
                return 'bg-gray-100 text-gray-800'
        }
    }

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'open':
                return 'bg-blue-100 text-blue-800'
            case 'in_progress':
                return 'bg-yellow-100 text-yellow-800'
            case 'closed':
                return 'bg-gray-100 text-gray-800'
            default:
                return 'bg-gray-100 text-gray-800'
        }
    }

    return (
        <div className="min-h-screen p-4">
            <div className="max-w-4xl mx-auto">
                {error && (
                    <div className="mb-4 p-4 bg-red-100 text-red-800 rounded">
                        {error}
                    </div>
                )}
                <div className="space-y-4">
                    <TicketFilters
                        tagKeys={drafts.tagKeys}
                        tagFilters={tagFilters}
                        setTagFilters={setTagFilters}
                    />

                    <div
                        ref={parentRef}
                        className="h-[calc(100vh-180px)] overflow-auto"
                    >
                        <div
                            style={{
                                height: `${rowVirtualizer.getTotalSize()}px`,
                                width: '100%',
                                position: 'relative',
                            }}
                        >
                            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                const draft = drafts.drafts[virtualRow.index]
                                return (
                                    <div
                                        key={draft.id}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: `${virtualRow.size}px`,
                                            transform: `translateY(${virtualRow.start}px)`,
                                        }}
                                    >
                                        <TicketCard
                                            id={draft.id}
                                            title={draft.title}
                                            priority={draft.priority}
                                            status={draft.status}
                                            created_at={draft.created_at}
                                            updated_at={draft.updated_at}
                                            organization_id={organization_id!}
                                            linkPath={`/${organization_id}/drafts/${draft.id}`}
                                            tags={draft.tags ? {
                                                keys: drafts.tagKeys,
                                                values: draft.tags
                                            } : undefined}
                                            onTagClick={(filter) => {
                                                setTagFilters(prev => [...prev, filter])
                                            }}
                                        />
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
} 
