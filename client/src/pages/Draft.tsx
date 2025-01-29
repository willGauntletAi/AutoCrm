import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../components/ui/select"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "../components/ui/collapsible"
import { ChevronDown } from 'lucide-react'
import { db } from '../lib/db'
import {
    updateTicket,
    updateTicketTagDateValue,
    updateTicketTagNumberValue,
    updateTicketTagTextValue,
    updateTicketTagEnumValue,
    createTicketTagDateValue,
    createTicketTagNumberValue,
    createTicketTagTextValue,
    createTicketTagEnumValue
} from '../lib/mutations'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAuth } from '@/lib/auth'
import type { TicketTagKey } from '../lib/db'
import { formatDateTime, parseYMDDateString } from '@/lib/utils'
import { RichTextEditor } from '../components/RichTextEditor'
import { Plus } from 'lucide-react'
import { AddTagValue } from '../components/AddTagValue'

const TICKET_STATUS_OPTIONS = ['open', 'in_progress', 'closed'] as const
const TICKET_PRIORITY_OPTIONS = ['low', 'medium', 'high'] as const

type DraftState = {
    title: string;
    description: string;
    status: typeof TICKET_STATUS_OPTIONS[number];
    priority: typeof TICKET_PRIORITY_OPTIONS[number];
    tags: {
        date: Map<string, string>;
        number: Map<string, string>;
        text: Map<string, string>;
        enum: Map<string, string>;
    };
}

export default function Draft() {
    const { organization_id, draft_id } = useParams<{ organization_id: string, draft_id: string }>()
    const [error, setError] = useState<string | null>(null)
    const [isTagsOpen, setIsTagsOpen] = useState(false)
    const [isAddingTagValue, setIsAddingTagValue] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const { user } = useAuth()
    const navigate = useNavigate()

    // Local state for draft changes
    const [draftState, setDraftState] = useState<DraftState | null>(null)
    const [hasChanges, setHasChanges] = useState(false)

    // Fetch the draft and its tags
    const draft = useLiveQuery(
        async () => {
            const draft = await db.ticketDrafts
                .where('id')
                .equals(draft_id!)
                .filter(draft => !draft.deleted_at)
                .first()

            if (!draft) return null

            // If we haven't initialized the draft state yet, do it now
            if (!draftState) {
                setDraftState({
                    title: draft.title,
                    description: draft.description || '',
                    status: draft.status as typeof TICKET_STATUS_OPTIONS[number],
                    priority: draft.priority as typeof TICKET_PRIORITY_OPTIONS[number],
                    tags: {
                        date: new Map(),
                        number: new Map(),
                        text: new Map(),
                        enum: new Map()
                    }
                })
            }

            return draft
        },
        [draft_id]
    )

    // Fetch tag data
    const tagData = useLiveQuery(
        async () => {
            if (!organization_id || !draft_id) return null

            const tagKeys = await db.ticketTagKeys
                .where('organization_id')
                .equals(organization_id)
                .filter(key => !key.deleted_at)
                .toArray()

            const dateValues = await db.ticketDraftTagDateValues
                .where('ticket_draft_id')
                .equals(draft_id)
                .filter(value => !value.deleted_at)
                .toArray()

            const numberValues = await db.ticketDraftTagNumberValues
                .where('ticket_draft_id')
                .equals(draft_id)
                .filter(value => !value.deleted_at)
                .toArray()

            const textValues = await db.ticketDraftTagTextValues
                .where('ticket_draft_id')
                .equals(draft_id)
                .filter(value => !value.deleted_at)
                .toArray()

            const enumValues = await db.ticketDraftTagEnumValues
                .where('ticket_draft_id')
                .equals(draft_id)
                .filter(value => !value.deleted_at)
                .toArray()

            // Fetch all enum options for all enum tag keys
            const enumTagKeys = tagKeys.filter(key => key.tag_type === 'enum')
            const enumOptions = await db.ticketTagEnumOptions
                .where('tag_key_id')
                .anyOf(enumTagKeys.map(key => key.id))
                .filter(opt => !opt.deleted_at)
                .toArray()

            // Create maps for quick lookups
            const enumOptionsMap = new Map(enumOptions.map(opt => [opt.id, opt]))
            const enumOptionsByTagKey = new Map(
                enumTagKeys.map(key => [
                    key.id,
                    enumOptions.filter(opt => opt.tag_key_id === key.id)
                ])
            )

            // If we haven't initialized the tag values in draft state yet, do it now
            if (draftState && !hasChanges) {
                const newDraftState = { ...draftState }

                dateValues.forEach(v => {
                    newDraftState.tags.date.set(v.tag_key_id, v.value.toISOString().split('T')[0])
                })

                numberValues.forEach(v => {
                    newDraftState.tags.number.set(v.tag_key_id, v.value.toString())
                })

                textValues.forEach(v => {
                    newDraftState.tags.text.set(v.tag_key_id, v.value)
                })

                enumValues.forEach(v => {
                    newDraftState.tags.enum.set(v.tag_key_id, v.enum_option_id)
                })

                setDraftState(newDraftState)
            }

            return {
                keys: tagKeys,
                values: {
                    date: new Map(dateValues.map(v => [v.tag_key_id, v])),
                    number: new Map(numberValues.map(v => [v.tag_key_id, v])),
                    text: new Map(textValues.map(v => [v.tag_key_id, v])),
                    enum: new Map(enumValues.map(v => [v.tag_key_id, {
                        ...v,
                        option: enumOptionsMap.get(v.enum_option_id),
                        allOptions: enumOptionsByTagKey.get(v.tag_key_id) || []
                    }]))
                }
            }
        },
        [organization_id, draft_id]
    )

    const handleSave = async () => {
        if (!draft || !draftState || !tagData || !user || !draft.original_ticket_id) {
            setError("Cannot save changes - no original ticket found")
            return
        }

        try {
            setIsSaving(true)
            setError(null)

            // Update the original ticket with the draft changes
            await updateTicket(draft.original_ticket_id, {
                title: draftState.title,
                description: draftState.description,
                priority: draftState.priority,
                status: draftState.status,
            })

            // Update all tag values for the original ticket
            const tagPromises: Promise<void>[] = []

            // Update date tag values
            for (const [tagKeyId, value] of draftState.tags.date.entries()) {
                const existingValue = tagData.values.date.get(tagKeyId)
                const date = parseYMDDateString(value)
                if (existingValue) {
                    tagPromises.push(updateTicketTagDateValue(existingValue.id, {
                        value: date,
                        ticket_id: draft.original_ticket_id
                    }))
                } else {
                    tagPromises.push(createTicketTagDateValue({
                        id: crypto.randomUUID(),
                        value: date,
                        ticket_id: draft.original_ticket_id,
                        tag_key_id: tagKeyId
                    }))
                }
            }

            // Update number tag values
            for (const [tagKeyId, value] of draftState.tags.number.entries()) {
                const existingValue = tagData.values.number.get(tagKeyId)
                if (existingValue) {
                    tagPromises.push(updateTicketTagNumberValue(existingValue.id, {
                        value: value.toString(),
                        ticket_id: draft.original_ticket_id
                    }))
                } else {
                    tagPromises.push(createTicketTagNumberValue({
                        id: crypto.randomUUID(),
                        value: value.toString(),
                        ticket_id: draft.original_ticket_id,
                        tag_key_id: tagKeyId
                    }))
                }
            }

            // Update text tag values
            for (const [tagKeyId, value] of draftState.tags.text.entries()) {
                const existingValue = tagData.values.text.get(tagKeyId)
                if (existingValue) {
                    tagPromises.push(updateTicketTagTextValue(existingValue.id, {
                        value,
                        ticket_id: draft.original_ticket_id
                    }))
                } else {
                    tagPromises.push(createTicketTagTextValue({
                        id: crypto.randomUUID(),
                        value,
                        ticket_id: draft.original_ticket_id,
                        tag_key_id: tagKeyId
                    }))
                }
            }

            // Update enum tag values
            for (const [tagKeyId, value] of draftState.tags.enum.entries()) {
                const existingValue = tagData.values.enum.get(tagKeyId)
                if (existingValue) {
                    tagPromises.push(updateTicketTagEnumValue(existingValue.id, {
                        enum_option_id: value,
                        ticket_id: draft.original_ticket_id
                    }))
                } else {
                    tagPromises.push(createTicketTagEnumValue({
                        id: crypto.randomUUID(),
                        enum_option_id: value,
                        ticket_id: draft.original_ticket_id,
                        tag_key_id: tagKeyId
                    }))
                }
            }

            // Wait for all tag updates to complete
            await Promise.all(tagPromises)

            // Delete the draft since changes are now saved
            await db.ticketDrafts.update(draft.id, { deleted_at: new Date().toISOString() })

            // Navigate to the original ticket
            navigate(`/${organization_id}/tickets/${draft.original_ticket_id}`)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save changes to ticket')
        } finally {
            setIsSaving(false)
        }
    }

    const handleDiscard = async () => {
        if (!draft) return

        try {
            setIsSaving(true)
            setError(null)

            // Delete the draft
            await db.ticketDrafts.update(draft.id, { deleted_at: new Date().toISOString() })

            // Navigate back to drafts list
            navigate(`/${organization_id}/drafts`)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to discard draft')
        } finally {
            setIsSaving(false)
        }
    }

    const handleAddTag = async (tagKey: TicketTagKey, value: string) => {
        if (!draftState) return

        const newDraftState = { ...draftState }

        switch (tagKey.tag_type) {
            case 'date':
                newDraftState.tags.date.set(tagKey.id, value)
                break
            case 'number':
                newDraftState.tags.number.set(tagKey.id, value)
                break
            case 'text':
                newDraftState.tags.text.set(tagKey.id, value)
                break
            case 'enum':
                newDraftState.tags.enum.set(tagKey.id, value)
                break
        }

        setDraftState(newDraftState)
        setHasChanges(true)
        setIsAddingTagValue(false)
    }

    const handleDeleteTag = (tagKey: TicketTagKey) => {
        if (!draftState) return

        const newDraftState = { ...draftState }

        switch (tagKey.tag_type) {
            case 'date':
                newDraftState.tags.date.delete(tagKey.id)
                break
            case 'number':
                newDraftState.tags.number.delete(tagKey.id)
                break
            case 'text':
                newDraftState.tags.text.delete(tagKey.id)
                break
            case 'enum':
                newDraftState.tags.enum.delete(tagKey.id)
                break
        }

        setDraftState(newDraftState)
        setHasChanges(true)
    }

    if (!draft || !draftState || !tagData) {
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

    const getUnusedTagKeys = () => {
        if (!tagData) return []

        const usedTagIds = new Set([
            ...Array.from(draftState.tags.date.keys()),
            ...Array.from(draftState.tags.number.keys()),
            ...Array.from(draftState.tags.text.keys()),
            ...Array.from(draftState.tags.enum.keys())
        ])

        return tagData.keys.filter(key => !usedTagIds.has(key.id))
    }

    return (
        <div className="min-h-screen p-4">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <Link
                        to={`/${organization_id}/drafts`}
                        className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
                    >
                        ← Back to Drafts
                    </Link>
                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-md mb-4">
                            {error}
                        </div>
                    )}
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <Input
                                        value={draftState.title}
                                        onChange={(e) => {
                                            setDraftState({
                                                ...draftState,
                                                title: e.target.value
                                            })
                                            setHasChanges(true)
                                        }}
                                        className="text-2xl font-bold mb-4"
                                        placeholder="Draft Title"
                                    />
                                    <div className="flex gap-2">
                                        <Select
                                            value={draftState.priority}
                                            onValueChange={(value) => {
                                                setDraftState({
                                                    ...draftState,
                                                    priority: value as typeof TICKET_PRIORITY_OPTIONS[number]
                                                })
                                                setHasChanges(true)
                                            }}
                                        >
                                            <SelectTrigger className={`w-[100px] ${getPriorityColor(draftState.priority)}`}>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {TICKET_PRIORITY_OPTIONS.map((priority) => (
                                                    <SelectItem key={priority} value={priority}>
                                                        {priority}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Select
                                            value={draftState.status}
                                            onValueChange={(value) => {
                                                setDraftState({
                                                    ...draftState,
                                                    status: value as typeof TICKET_STATUS_OPTIONS[number]
                                                })
                                                setHasChanges(true)
                                            }}
                                        >
                                            <SelectTrigger className={`w-[120px] ${getStatusColor(draftState.status)}`}>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {TICKET_STATUS_OPTIONS.map((status) => (
                                                    <SelectItem key={status} value={status}>
                                                        {status.replace('_', ' ')}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Badge variant="secondary">Draft</Badge>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={handleDiscard}
                                        disabled={isSaving}
                                    >
                                        Discard
                                    </Button>
                                    <Button
                                        onClick={handleSave}
                                        disabled={isSaving || !hasChanges}
                                    >
                                        {isSaving ? 'Saving...' : 'Save'}
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <RichTextEditor
                                content={draftState.description}
                                onChange={(value) => {
                                    setDraftState({
                                        ...draftState,
                                        description: value
                                    })
                                    setHasChanges(true)
                                }}
                            />
                            <div className="mb-4 mt-4">
                                <Collapsible open={isTagsOpen} onOpenChange={setIsTagsOpen}>
                                    <div className="flex items-center justify-between mb-2">
                                        <CollapsibleTrigger asChild>
                                            <div className="flex items-center gap-2 cursor-pointer">
                                                <h3 className="text-sm font-medium">Tags</h3>
                                                <ChevronDown className={`h-4 w-4 transition-transform ${isTagsOpen ? 'transform rotate-180' : ''}`} />
                                            </div>
                                        </CollapsibleTrigger>
                                    </div>
                                    <CollapsibleContent>
                                        <div className="space-y-2">
                                            {/* Date tag values */}
                                            {Array.from(draftState.tags.date.entries()).map(([tagKeyId, value]) => {
                                                const tagKey = tagData.keys.find(k => k.id === tagKeyId)
                                                if (!tagKey) return null
                                                return (
                                                    <div key={tagKey.id} className="flex items-center gap-2">
                                                        <span className="text-sm text-gray-500 w-24 truncate" title={tagKey.name}>{tagKey.name}:</span>
                                                        <div className="flex items-center gap-2">
                                                            <Input
                                                                type="date"
                                                                className="w-[200px]"
                                                                value={value}
                                                                onChange={(e) => {
                                                                    const newDraftState = { ...draftState }
                                                                    newDraftState.tags.date.set(tagKey.id, e.target.value)
                                                                    setDraftState(newDraftState)
                                                                    setHasChanges(true)
                                                                }}
                                                            />
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                onClick={() => handleDeleteTag(tagKey)}
                                                            >
                                                                Delete
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                            {/* Number tag values */}
                                            {Array.from(draftState.tags.number.entries()).map(([tagKeyId, value]) => {
                                                const tagKey = tagData.keys.find(k => k.id === tagKeyId)
                                                if (!tagKey) return null
                                                return (
                                                    <div key={tagKey.id} className="flex items-center gap-2">
                                                        <span className="text-sm text-gray-500 w-24 truncate" title={tagKey.name}>{tagKey.name}:</span>
                                                        <div className="flex items-center gap-2">
                                                            <Input
                                                                type="number"
                                                                className="w-[200px]"
                                                                value={value}
                                                                onChange={(e) => {
                                                                    const newDraftState = { ...draftState }
                                                                    newDraftState.tags.number.set(tagKey.id, e.target.value)
                                                                    setDraftState(newDraftState)
                                                                    setHasChanges(true)
                                                                }}
                                                            />
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                onClick={() => handleDeleteTag(tagKey)}
                                                            >
                                                                Delete
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                            {/* Text tag values */}
                                            {Array.from(draftState.tags.text.entries()).map(([tagKeyId, value]) => {
                                                const tagKey = tagData.keys.find(k => k.id === tagKeyId)
                                                if (!tagKey) return null
                                                return (
                                                    <div key={tagKey.id} className="flex items-center gap-2">
                                                        <span className="text-sm text-gray-500 w-24 truncate" title={tagKey.name}>{tagKey.name}:</span>
                                                        <div className="flex items-center gap-2">
                                                            <Input
                                                                type="text"
                                                                className="w-[200px]"
                                                                value={value}
                                                                onChange={(e) => {
                                                                    const newDraftState = { ...draftState }
                                                                    newDraftState.tags.text.set(tagKey.id, e.target.value)
                                                                    setDraftState(newDraftState)
                                                                    setHasChanges(true)
                                                                }}
                                                            />
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                onClick={() => handleDeleteTag(tagKey)}
                                                            >
                                                                Delete
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                            {/* Enum tag values */}
                                            {Array.from(draftState.tags.enum.entries()).map(([tagKeyId, value]) => {
                                                const tagKey = tagData.keys.find(k => k.id === tagKeyId)
                                                const enumValue = tagData.values.enum.get(tagKeyId)
                                                if (!tagKey || !enumValue) return null
                                                return (
                                                    <div key={tagKey.id} className="flex items-center gap-2">
                                                        <span className="text-sm text-gray-500 w-24 truncate" title={tagKey.name}>{tagKey.name}:</span>
                                                        <div className="flex items-center gap-2">
                                                            <Select
                                                                value={value}
                                                                onValueChange={(newValue) => {
                                                                    const newDraftState = { ...draftState }
                                                                    newDraftState.tags.enum.set(tagKey.id, newValue)
                                                                    setDraftState(newDraftState)
                                                                    setHasChanges(true)
                                                                }}
                                                            >
                                                                <SelectTrigger className="w-[200px]">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {enumValue.allOptions.map(option => (
                                                                        <SelectItem key={option.id} value={option.id}>
                                                                            {option.value}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                onClick={() => handleDeleteTag(tagKey)}
                                                            >
                                                                Delete
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                            {!isAddingTagValue && tagData.keys.length === 0 && (
                                                <div className="flex items-center justify-between">
                                                    <p className="text-sm text-gray-500">No tags defined</p>
                                                </div>
                                            )}
                                            {isAddingTagValue && (
                                                <AddTagValue
                                                    tagKeys={getUnusedTagKeys()}
                                                    onSubmit={handleAddTag}
                                                    onCancel={() => setIsAddingTagValue(false)}
                                                    isSubmitting={false}
                                                />
                                            )}
                                            {!isAddingTagValue && getUnusedTagKeys().length > 0 && (
                                                <div className="mt-4">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setIsAddingTagValue(true)}
                                                    >
                                                        <Plus className="h-4 w-4 mr-1" />
                                                        Add Tag
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            </div>
                            <div className="text-sm text-gray-500">
                                <p>Created {formatDateTime(draft.created_at || '')}</p>
                                {draft.updated_at && (
                                    <p>Updated {formatDateTime(draft.updated_at)}</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
} 
