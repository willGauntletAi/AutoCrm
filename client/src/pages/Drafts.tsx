import { useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { db } from '../lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { TicketFilters, type TagFilter } from '../components/TicketFilters'
import { useVirtualizer } from '@tanstack/react-virtual'
import { TicketCard } from '../components/TicketCard'

export default function Drafts() {
    const { organization_id } = useParams<{ organization_id: string }>()
    const [tagFilters, setTagFilters] = useState<TagFilter[]>([])
    const parentRef = useRef<HTMLDivElement>(null)

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

    const virtualizer = useVirtualizer({
        count: drafts?.drafts.length ?? 0,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 100,
        overscan: 5
    })

    const handleTagClick = (filter: TagFilter) => {
        setTagFilters(prev => [...prev, filter])
    }

    if (!drafts) return null

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-4">
                <TicketFilters
                    tagKeys={drafts.tagKeys}
                    tagFilters={tagFilters}
                    setTagFilters={setTagFilters}
                />
            </div>
            <div ref={parentRef} className="flex flex-col gap-4">
                {virtualizer.getVirtualItems().map((virtualItem) => {
                    const draft = drafts.drafts[virtualItem.index]
                    if (!draft) return null

                    return (
                        <div
                            key={virtualItem.key}
                            data-index={virtualItem.index}
                            ref={virtualizer.measureElement}
                        >
                            <TicketCard
                                {...draft}
                                linkPath={`/organizations/${organization_id}/drafts/${draft.id}`}
                                onTagClick={handleTagClick}
                                description={draft.description || undefined}
                                tags={draft.tags ? {
                                    keys: drafts.tagKeys,
                                    values: draft.tags
                                } : undefined}
                            />
                        </div>
                    )
                })}
            </div>
        </div>
    )
} 
