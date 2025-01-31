import { useState, useEffect } from 'react'
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
    createTicketTagEnumValue,
    updateTicketDraftStatus,
    createTicketComment
} from '../lib/mutations'
import { useAuth } from '@/lib/auth'
import type { TicketTagKey } from '../lib/db'
import { formatDateTime, parseYMDDateString, formatDateTagValue } from '@/lib/utils'
import { RichTextEditor } from '../components/RichTextEditor'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { AddTagValue } from '../components/AddTagValue'

// Comment types
type Comment = {
    id: string;
    comment: string;
    user_id: string;
    created_at: string;
    updated_at: string | null;
    deleted_at: string | null;
}

type TicketComment = Comment & {
    ticket_id: string;
}

type DraftComment = Comment & {
    ticket_draft_id: string;
}

const TICKET_STATUS_OPTIONS = ['open', 'in_progress', 'closed'] as const
const TICKET_PRIORITY_OPTIONS = ['low', 'medium', 'high'] as const

type DraftState = {
    id: string;
    title: string;
    description: string;
    status: typeof TICKET_STATUS_OPTIONS[number];
    priority: typeof TICKET_PRIORITY_OPTIONS[number];
    original_ticket_id: string;
    created_at: string;
    updated_at: string | null;
    tags: {
        date: Map<string, string>;
        number: Map<string, string>;
        text: Map<string, string>;
        enum: Map<string, string>;
    };
}

type TagData = {
    keys: {
        id: string;
        organization_id: string;
        name: string;
        description: string | null;
        tag_type: "number" | "date" | "text" | "enum";
        created_at: string | null;
        updated_at: string | null;
        deleted_at: string | null;
    }[];
    values: {
        date: Map<string, {
            id: string;
            value: Date;
            created_at: string | null;
            updated_at: string | null;
            deleted_at: string | null;
            ticket_draft_id: string;
            tag_key_id: string;
        }>;
        number: Map<string, {
            id: string;
            value: number;
            created_at: string | null;
            updated_at: string | null;
            deleted_at: string | null;
            ticket_draft_id: string;
            tag_key_id: string;
        }>;
        text: Map<string, {
            id: string;
            value: string;
            created_at: string | null;
            updated_at: string | null;
            deleted_at: string | null;
            ticket_draft_id: string;
            tag_key_id: string;
        }>;
        enum: Map<string, {
            id: string;
            tag_key_id: string;
            ticket_draft_id: string;
            enum_option_id: string;
            option: {
                id: string;
                description: string | null;
                value: string;
                created_at: string | null;
                updated_at: string | null;
                deleted_at: string | null;
                tag_key_id: string;
            } | undefined;
            allOptions: {
                id: string;
                description: string | null;
                value: string;
                created_at: string | null;
                updated_at: string | null;
                deleted_at: string | null;
                tag_key_id: string;
            }[];
        }>;
    };
}

export default function Draft() {
    const { organization_id, draft_id } = useParams<{ organization_id: string, draft_id: string }>()
    const [error, setError] = useState<string | null>(null)
    const [isTagsOpen, setIsTagsOpen] = useState(false)
    const [isAddingTagValue, setIsAddingTagValue] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
    const [editingCommentText, setEditingCommentText] = useState("")
    const { user } = useAuth()
    const navigate = useNavigate()

    // Local state for draft changes
    const [draftState, setDraftState] = useState<DraftState | null>(null)
    const [tagData, setTagData] = useState<TagData | null>(null)
    const [hasChanges, setHasChanges] = useState(false)
    const [ticketComments, setTicketComments] = useState<TicketComment[]>([])
    const [draftComments, setDraftComments] = useState<DraftComment[]>([])

    // Load initial data
    useEffect(() => {
        const loadData = async () => {
            if (!draft_id || !organization_id) return

            try {
                // Load draft
                const loadedDraft = await db.ticketDrafts
                    .where('id')
                    .equals(draft_id)
                    .filter(draft => !draft.deleted_at)
                    .first()

                if (!loadedDraft) return

                // Load comments for both the original ticket and the draft
                const [loadedTicketComments, loadedDraftComments] = await Promise.all([
                    db.ticketComments
                        .where('ticket_id')
                        .equals(loadedDraft.original_ticket_id || '')
                        .filter(comment => !comment.deleted_at)
                        .toArray(),
                    db.ticketDraftComments
                        .where('ticket_draft_id')
                        .equals(draft_id)
                        .filter(comment => !comment.deleted_at)
                        .toArray()
                ])

                setTicketComments(loadedTicketComments.map(comment => ({
                    ...comment,
                    created_at: comment.created_at || new Date().toISOString(),
                })))
                setDraftComments(loadedDraftComments.map(comment => ({
                    ...comment,
                    created_at: comment.created_at || new Date().toISOString(),
                })))

                // Load tag keys and enum options
                const tagKeys = await db.ticketTagKeys
                    .where('organization_id')
                    .equals(organization_id)
                    .filter(key => !key.deleted_at)
                    .toArray()

                const enumTagKeys = tagKeys.filter(key => key.tag_type === 'enum')
                const enumOptions = await db.ticketTagEnumOptions
                    .where('tag_key_id')
                    .anyOf(enumTagKeys.map(key => key.id))
                    .filter(opt => !opt.deleted_at)
                    .toArray()

                const enumOptionsMap = new Map(enumOptions.map(opt => [opt.id, opt]))
                const enumOptionsByTagKey = new Map(
                    enumTagKeys.map(key => [
                        key.id,
                        enumOptions.filter(opt => opt.tag_key_id === key.id)
                    ])
                )

                // Load tag values
                const [dateValues, numberValues, textValues, enumValues] = await Promise.all([
                    db.ticketDraftTagDateValues
                        .where('ticket_draft_id')
                        .equals(draft_id)
                        .filter(value => !value.deleted_at)
                        .toArray(),
                    db.ticketDraftTagNumberValues
                        .where('ticket_draft_id')
                        .equals(draft_id)
                        .filter(value => !value.deleted_at)
                        .toArray(),
                    db.ticketDraftTagTextValues
                        .where('ticket_draft_id')
                        .equals(draft_id)
                        .filter(value => !value.deleted_at)
                        .toArray(),
                    db.ticketDraftTagEnumValues
                        .where('ticket_draft_id')
                        .equals(draft_id)
                        .filter(value => !value.deleted_at)
                        .toArray()
                ])

                // Set tag data for validation during save
                const enumTagData = new Map()
                for (const tagKey of tagKeys) {
                    if (tagKey.tag_type === 'enum') {
                        const value = enumValues.find(v => v.tag_key_id === tagKey.id)
                        if (value) {
                            enumTagData.set(tagKey.id, {
                                ...value,
                                option: enumOptionsMap.get(value.enum_option_id),
                                allOptions: enumOptionsByTagKey.get(tagKey.id) || []
                            })
                        }
                    }
                }

                setTagData({
                    keys: tagKeys,
                    values: {
                        date: new Map(dateValues.map(v => [v.tag_key_id, v])),
                        number: new Map(numberValues.map(v => [v.tag_key_id, v])),
                        text: new Map(textValues.map(v => [v.tag_key_id, v])),
                        enum: enumTagData
                    }
                })

                // Set initial draft state
                if (!draftState) {
                    const initialEnumTags = new Map()
                    for (const tagKey of tagKeys) {
                        if (tagKey.tag_type === 'enum') {
                            const value = enumValues.find(v => v.tag_key_id === tagKey.id)
                            if (value) {
                                initialEnumTags.set(tagKey.id, value.enum_option_id)
                            }
                        }
                    }

                    const initialTags = {
                        date: new Map(dateValues.map(v => [v.tag_key_id, v.value.toISOString().split('T')[0]])),
                        number: new Map(numberValues.map(v => [v.tag_key_id, v.value.toString()])),
                        text: new Map(textValues.map(v => [v.tag_key_id, v.value])),
                        enum: initialEnumTags
                    }

                    setDraftState({
                        id: loadedDraft.id,
                        title: loadedDraft.title,
                        description: loadedDraft.description || '',
                        status: loadedDraft.status as typeof TICKET_STATUS_OPTIONS[number],
                        priority: loadedDraft.priority as typeof TICKET_PRIORITY_OPTIONS[number],
                        original_ticket_id: loadedDraft.original_ticket_id || '',
                        created_at: loadedDraft.created_at || new Date().toISOString(),
                        updated_at: loadedDraft.updated_at,
                        tags: initialTags
                    })
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load draft data')
            }
        }

        loadData()
    }, [draft_id, organization_id])

    const handleSave = async () => {
        if (!draftState || !tagData || !user || !draftState.original_ticket_id) {
            setError("Cannot save changes - no original ticket found")
            return
        }

        try {
            setIsSaving(true)
            setError(null)

            // Update the original ticket with the draft changes
            await updateTicket(draftState.original_ticket_id, {
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
                        ticket_id: draftState.original_ticket_id
                    }))
                } else {
                    tagPromises.push(createTicketTagDateValue({
                        id: crypto.randomUUID(),
                        value: date,
                        ticket_id: draftState.original_ticket_id,
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
                        ticket_id: draftState.original_ticket_id
                    }))
                } else {
                    tagPromises.push(createTicketTagNumberValue({
                        id: crypto.randomUUID(),
                        value: value.toString(),
                        ticket_id: draftState.original_ticket_id,
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
                        ticket_id: draftState.original_ticket_id
                    }))
                } else {
                    tagPromises.push(createTicketTagTextValue({
                        id: crypto.randomUUID(),
                        value,
                        ticket_id: draftState.original_ticket_id,
                        tag_key_id: tagKeyId
                    }))
                }
            }

            // Update enum tag values
            for (const [tagKeyId, value] of draftState.tags.enum.entries()) {
                const existingTicketValue = await db.ticketTagEnumValues
                    .where({ ticket_id: draftState.original_ticket_id, tag_key_id: tagKeyId })
                    .first()

                if (existingTicketValue) {
                    tagPromises.push(updateTicketTagEnumValue(existingTicketValue.id, {
                        enum_option_id: value,
                        ticket_id: draftState.original_ticket_id
                    }))
                } else {
                    tagPromises.push(createTicketTagEnumValue({
                        id: crypto.randomUUID(),
                        enum_option_id: value,
                        ticket_id: draftState.original_ticket_id,
                        tag_key_id: tagKeyId
                    }))
                }
            }

            // Create comments on the original ticket
            const commentPromises = draftComments.map(comment =>
                createTicketComment({
                    id: crypto.randomUUID(),
                    ticket_id: draftState.original_ticket_id,
                    user_id: comment.user_id,
                    comment: comment.comment
                })
            )

            // Wait for all updates to complete
            await Promise.all([...tagPromises, ...commentPromises])

            // Get the original draft state
            const originalDraft = await db.ticketDrafts.get(draftState.id)
            if (!originalDraft) {
                throw new Error('Original draft not found')
            }

            // Check if basic fields match the original draft
            const basicFieldsMatch =
                originalDraft.title === draftState.title &&
                originalDraft.description === draftState.description &&
                originalDraft.priority === draftState.priority &&
                originalDraft.status === draftState.status

            // Check if tag values match the original draft
            const dateValuesMatch = await Promise.all(
                Array.from(draftState.tags.date.entries()).map(async ([tagKeyId, value]) => {
                    const tagValue = await db.ticketDraftTagDateValues
                        .where({ ticket_draft_id: draftState.id, tag_key_id: tagKeyId })
                        .first()
                    return tagValue && formatDateTagValue(tagValue.value) === value
                })
            )

            const numberValuesMatch = await Promise.all(
                Array.from(draftState.tags.number.entries()).map(async ([tagKeyId, value]) => {
                    const tagValue = await db.ticketDraftTagNumberValues
                        .where({ ticket_draft_id: draftState.id, tag_key_id: tagKeyId })
                        .first()
                    return tagValue && tagValue.value.toString() === value
                })
            )

            const textValuesMatch = await Promise.all(
                Array.from(draftState.tags.text.entries()).map(async ([tagKeyId, value]) => {
                    const tagValue = await db.ticketDraftTagTextValues
                        .where({ ticket_draft_id: draftState.id, tag_key_id: tagKeyId })
                        .first()
                    return tagValue && tagValue.value === value
                })
            )

            const enumValuesMatch = await Promise.all(
                Array.from(draftState.tags.enum.entries()).map(async ([tagKeyId, value]) => {
                    const tagValue = await db.ticketDraftTagEnumValues
                        .where({ ticket_draft_id: draftState.id, tag_key_id: tagKeyId })
                        .first()
                    return tagValue && tagValue.enum_option_id === value
                })
            )

            const allTagValuesMatch = [
                ...dateValuesMatch,
                ...numberValuesMatch,
                ...textValuesMatch,
                ...enumValuesMatch
            ].every(Boolean)

            // Update draft status based on whether all changes match the original draft
            const newStatus = basicFieldsMatch && allTagValuesMatch ? 'accepted' : 'partially_accepted'
            try {
                await updateTicketDraftStatus(draftState.id, newStatus)
                // Navigate back to drafts page only after successful status update
                navigate(`/${organization_id}/drafts`)
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to update draft status')
                return
            }

            // Navigate back to drafts page
            navigate(`/${organization_id}/drafts`)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save changes to ticket')
        } finally {
            setIsSaving(false)
        }
    }

    const handleDiscard = async () => {
        if (!draftState) return

        try {
            setIsSaving(true)
            setError(null)

            // Mark the draft as rejected
            try {
                await updateTicketDraftStatus(draftState.id, 'rejected')
                // Navigate back to drafts list only after successful status update
                navigate(`/${organization_id}/drafts`)
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to update draft status')
                return
            }

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

    const handleAddComment = async (comment: string) => {
        if (!draftState || !user) return

        try {
            const newComment: DraftComment = {
                id: crypto.randomUUID(),
                ticket_draft_id: draftState.id,
                user_id: user.id,
                comment,
                created_at: new Date().toISOString(),
                updated_at: null,
                deleted_at: null
            }

            // Only update local state, don't save to database
            setDraftComments(prev => [newComment, ...prev])
            setHasChanges(true)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add comment')
        }
    }

    const handleEditComment = async (commentId: string) => {
        if (!editingCommentText.trim()) return

        try {
            const comment = draftComments.find(c => c.id === commentId)
            if (!comment) return

            const updatedComment = {
                ...comment,
                comment: editingCommentText,
                updated_at: new Date().toISOString()
            }

            // Only update local state, don't save to database
            setDraftComments(prev => prev.map(c => c.id === commentId ? updatedComment : c))
            setEditingCommentId(null)
            setEditingCommentText("")
            setHasChanges(true)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to edit comment')
        }
    }

    const handleDeleteComment = async (commentId: string) => {
        try {
            // Only update local state, don't save to database
            setDraftComments(prev => prev.filter(c => c.id !== commentId))
            setHasChanges(true)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete comment')
        }
    }

    if (!draftState || !tagData) {
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
                                        {isSaving ? 'Applying...' : 'Apply'}
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
                                            {tagData.keys
                                                .filter(key => key.tag_type === 'date')
                                                .map(tagKey => {
                                                    const value = draftState.tags.date.get(tagKey.id)
                                                    if (!value) return null
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
                                            {tagData.keys
                                                .filter(key => key.tag_type === 'number')
                                                .map(tagKey => {
                                                    const value = draftState.tags.number.get(tagKey.id)
                                                    if (!value) return null
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
                                            {tagData.keys
                                                .filter(key => key.tag_type === 'text')
                                                .map(tagKey => {
                                                    const value = draftState.tags.text.get(tagKey.id)
                                                    if (!value) return null
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
                                            {(() => {
                                                const enumTagKeys = tagData.keys
                                                    .filter(key => {
                                                        const hasValue = draftState.tags.enum.has(key.id)
                                                        const hasEnumData = tagData.values.enum.has(key.id)
                                                        return key.tag_type === 'enum' && (hasValue || hasEnumData)
                                                    })

                                                return enumTagKeys.map(tagKey => {
                                                    const value = draftState.tags.enum.get(tagKey.id)
                                                    const enumData = tagData.values.enum.get(tagKey.id)

                                                    // If we have a value but no enum data, try to find the enum data by the value
                                                    let effectiveEnumData = enumData
                                                    if (value && !enumData) {
                                                        for (const [_, data] of tagData.values.enum) {
                                                            if (data.tag_key_id === tagKey.id) {
                                                                effectiveEnumData = data
                                                                break
                                                            }
                                                        }
                                                    }

                                                    if (!value || !effectiveEnumData) return null

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
                                                                        {effectiveEnumData.allOptions.map(option => (
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
                                                })
                                            })()}

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
                                <p>Created {formatDateTime(draftState.created_at || '')}</p>
                                {draftState.updated_at && (
                                    <p>Updated {formatDateTime(draftState.updated_at)}</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div className="flex-1">
                                <h3 className="text-lg font-medium mb-4">Comments</h3>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-6">
                            <RichTextEditor
                                content=""
                                onChange={(value) => handleAddComment(value)}
                                className="min-h-[100px]"
                            />
                            <p className="text-sm text-gray-500 mt-1">Press Enter to add a comment</p>
                        </div>

                        <div className="space-y-4 mb-8">
                            {draftComments.map(comment => (
                                <Card key={comment.id} className="p-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            {editingCommentId === comment.id ? (
                                                <div className="space-y-2">
                                                    <RichTextEditor
                                                        content={editingCommentText}
                                                        onChange={setEditingCommentText}
                                                    />
                                                    <div className="flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleEditComment(comment.id)}
                                                        >
                                                            Save
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => {
                                                                setEditingCommentId(null)
                                                                setEditingCommentText("")
                                                            }}
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div
                                                    className="prose prose-sm max-w-none"
                                                    dangerouslySetInnerHTML={{ __html: comment.comment }}
                                                />
                                            )}
                                            <div className="text-sm text-gray-500 mt-2">
                                                {formatDateTime(comment.created_at)}
                                                {comment.updated_at && ` (edited ${formatDateTime(comment.updated_at)})`}
                                            </div>
                                        </div>
                                        {editingCommentId !== comment.id && (
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        setEditingCommentId(comment.id)
                                                        setEditingCommentText(comment.comment)
                                                    }}
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleDeleteComment(comment.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            ))}
                        </div>

                        {ticketComments.length > 0 && (
                            <div className="space-y-4">
                                <h4 className="text-sm font-medium text-gray-500">Original Ticket Comments</h4>
                                {ticketComments.map(comment => (
                                    <Card key={comment.id} className="p-4 bg-gray-50">
                                        <div
                                            className="prose prose-sm max-w-none"
                                            dangerouslySetInnerHTML={{ __html: comment.comment }}
                                        />
                                        <div className="text-sm text-gray-500 mt-2">
                                            {formatDateTime(comment.created_at)}
                                            {comment.updated_at && ` (edited ${formatDateTime(comment.updated_at)})`}
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
                <div className="text-sm text-gray-500 mt-8">
                    <p>Created {formatDateTime(draftState?.created_at || '')}</p>
                    {draftState?.updated_at && (
                        <p>Updated {formatDateTime(draftState.updated_at)}</p>
                    )}
                </div>
            </div>
        </div>
    )
} 
