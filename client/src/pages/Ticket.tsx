import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
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
    createTicketComment,
    updateTicket,
    createTicketTagDateValue,
    createTicketTagNumberValue,
    createTicketTagTextValue,
    updateTicketTagDateValue,
    updateTicketTagNumberValue,
    updateTicketTagTextValue,
    deleteTicketTagDateValue,
    deleteTicketTagNumberValue,
    deleteTicketTagTextValue
} from '../lib/mutations'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAuth } from '../lib/auth'
import type { TicketTagKey, Macro } from '../lib/db'
import { AddTagValue } from '../components/AddTagValue'
import { Plus } from 'lucide-react'
import { formatDateTagValue, formatDateTime, parseYMDDateString } from '@/lib/utils'
import { RichTextEditor } from '../components/RichTextEditor'
import DOMPurify from 'dompurify'

const TICKET_STATUS_OPTIONS = ['open', 'in_progress', 'closed'] as const
const TICKET_PRIORITY_OPTIONS = ['low', 'medium', 'high'] as const

// Configure DOMPurify to only allow specific tags and attributes
const purifyConfig = {
    ALLOWED_TAGS: ['p', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'br'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
}

export default function Ticket() {
    const { organization_id, ticket_id } = useParams<{ organization_id: string, ticket_id: string }>()
    const [error, setError] = useState<string | null>(null)
    const [newComment, setNewComment] = useState('')
    const [isCreatingComment, setIsCreatingComment] = useState(false)
    const [isUpdatingTicket, setIsUpdatingTicket] = useState(false)
    const [isUpdatingTags, setIsUpdatingTags] = useState(false)
    const [isAddingTagValue, setIsAddingTagValue] = useState(false)
    const [isApplyingMacro, setIsApplyingMacro] = useState(false)
    const { user } = useAuth()
    const [isTagsOpen, setIsTagsOpen] = useState(false)

    // Add state for edited values
    const [editedValues, setEditedValues] = useState<{
        date: Map<string, string>,
        number: Map<string, string>,
        text: Map<string, string>
    }>({
        date: new Map(),
        number: new Map(),
        text: new Map()
    })

    const ticket = useLiveQuery(
        async () => {
            return await db.tickets
                .where('id')
                .equals(ticket_id!)
                .filter(ticket => !ticket.deleted_at)
                .first()
        },
        [ticket_id]
    )

    const comments = useLiveQuery(
        async () => {
            const ticketComments = (await db.ticketComments
                .where('ticket_id')
                .equals(ticket_id!)
                .filter(comment => !comment.deleted_at)
                .sortBy('created_at'))
                .reverse()

            // Fetch user info for each comment
            const userIds = [...new Set(ticketComments.map(comment => comment.user_id))]
            const users = await db.profiles
                .where('id')
                .anyOf(userIds)
                .toArray()

            // Create a map of user info
            const userMap = new Map(users.map(user => [user.id, user]))

            // Attach user info to comments
            return ticketComments.map(comment => ({
                ...comment,
                user_full_name: userMap.get(comment.user_id)?.full_name ?? null,
                user_avatar_url: userMap.get(comment.user_id)?.avatar_url ?? null
            }))
        },
        [ticket_id],
        []
    )

    // Check if user has edit permissions (not a customer)
    const canEdit = useLiveQuery(
        async () => {
            if (!user || !organization_id) return false

            const member = await db.profileOrganizationMembers
                .where(['organization_id+profile_id'])
                .equals([organization_id, user.id])
                .filter(member => !member.deleted_at)
                .first()

            return member && member.role !== 'customer'
        },
        [user, organization_id],
        false
    )

    // Fetch tag keys and values
    const tagData = useLiveQuery(
        async () => {
            if (!organization_id || !ticket_id) return null

            const tagKeys = await db.ticketTagKeys
                .where('organization_id')
                .equals(organization_id)
                .filter(key => !key.deleted_at)
                .toArray()

            const dateValues = await db.ticketTagDateValues
                .where('ticket_id')
                .equals(ticket_id)
                .filter(value => !value.deleted_at)
                .toArray()

            const numberValues = await db.ticketTagNumberValues
                .where('ticket_id')
                .equals(ticket_id)
                .filter(value => !value.deleted_at)
                .toArray()

            const textValues = await db.ticketTagTextValues
                .where('ticket_id')
                .equals(ticket_id)
                .filter(value => !value.deleted_at)
                .toArray()

            return {
                keys: tagKeys,
                values: {
                    date: new Map(dateValues.map(v => [v.tag_key_id, v])),
                    number: new Map(numberValues.map(v => [v.tag_key_id, v])),
                    text: new Map(textValues.map(v => [v.tag_key_id, v]))
                }
            }
        },
        [organization_id, ticket_id]
    )

    // Fetch available macros
    const macros = useLiveQuery(
        async () => {
            if (!organization_id || !ticket || !tagData) return []

            const allMacros = await db.macros
                .where('organization_id')
                .equals(organization_id)
                .filter(macro => !macro.deleted_at)
                .toArray()

            // Filter macros based on requirements
            return allMacros.filter(macro => {
                const requirements = macro.macro.requirements

                // Check ticket status requirement
                if (requirements.status && requirements.status !== ticket.status) {
                    return false
                }

                // Check ticket priority requirement
                if (requirements.priority && requirements.priority !== ticket.priority) {
                    return false
                }

                // Check created_at requirement
                if (requirements.created_at) {
                    const ticketCreatedAt = new Date(ticket.created_at || '').getTime()
                    if (requirements.created_at.before && ticketCreatedAt >= requirements.created_at.before) {
                        return false
                    }
                    if (requirements.created_at.after && ticketCreatedAt <= requirements.created_at.after) {
                        return false
                    }
                }

                // Check updated_at requirement
                if (requirements.updated_at) {
                    const ticketUpdatedAt = new Date(ticket.updated_at || '').getTime()
                    if (requirements.updated_at.before && ticketUpdatedAt >= requirements.updated_at.before) {
                        return false
                    }
                    if (requirements.updated_at.after && ticketUpdatedAt <= requirements.updated_at.after) {
                        return false
                    }
                }

                // Check date tag requirements
                for (const [tagKeyId, requirement] of Object.entries(requirements.date_tag_requirements)) {
                    const tagValue = tagData.values.date.get(tagKeyId)
                    if (!tagValue) return false

                    const valueDate = new Date(tagValue.value).getTime()
                    const now = new Date().getTime()
                    const dayInMs = 24 * 60 * 60 * 1000

                    if (requirement.before !== undefined) {
                        const beforeDate = now + (requirement.before * dayInMs)
                        if (valueDate >= beforeDate) return false
                    }
                    if (requirement.after !== undefined) {
                        const afterDate = now + (requirement.after * dayInMs)
                        if (valueDate <= afterDate) return false
                    }
                    if (requirement.equals !== undefined) {
                        const equalsDate = now + (Number(requirement.equals) * dayInMs)
                        if (Math.abs(valueDate - equalsDate) > dayInMs) return false
                    }
                }

                // Check number tag requirements
                for (const [tagKeyId, requirement] of Object.entries(requirements.number_tag_requirements)) {
                    const tagValue = tagData.values.number.get(tagKeyId)
                    if (!tagValue) return false

                    const value = Number(tagValue.value)
                    if (requirement.min !== undefined && value < requirement.min) return false
                    if (requirement.max !== undefined && value > requirement.max) return false
                    if (requirement.equals !== undefined && value !== requirement.equals) return false
                }

                // Check text tag requirements
                for (const [tagKeyId, requirement] of Object.entries(requirements.text_tag_requirements)) {
                    const tagValue = tagData.values.text.get(tagKeyId)
                    if (!tagValue) return false

                    if (requirement.equals !== undefined && tagValue.value !== requirement.equals) return false
                    if (requirement.contains !== undefined && !tagValue.value.includes(requirement.contains)) return false
                    if (requirement.regex !== undefined && !new RegExp(requirement.regex).test(tagValue.value)) return false
                }

                return true
            })
        },
        [organization_id, ticket, tagData],
        []
    )

    const handleSubmitComment = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newComment.trim() || !user) return

        try {
            setIsCreatingComment(true)
            setError(null)
            await createTicketComment({
                id: crypto.randomUUID(),
                ticket_id: ticket_id!,
                comment: newComment.trim(),
                user_id: user.id,
            })
            setNewComment('')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create comment')
        } finally {
            setIsCreatingComment(false)
        }
    }

    const handleUpdateTicket = async (field: 'status' | 'priority', value: string) => {
        if (!ticket || !canEdit) return

        try {
            setIsUpdatingTicket(true)
            setError(null)
            await updateTicket(ticket.id, {
                [field]: value,
            })
        } catch (err) {
            setError(err instanceof Error ? err.message : `Failed to update ticket ${field}`)
        } finally {
            setIsUpdatingTicket(false)
        }
    }

    const handleAddTag = async (tagKey: TicketTagKey, value: string) => {
        if (!ticket || !canEdit) return

        try {
            setIsUpdatingTags(true)
            setError(null)

            // Create new value based on tag type
            switch (tagKey.tag_type) {
                case 'date': {
                    const date = parseYMDDateString(value)
                    await createTicketTagDateValue({
                        id: crypto.randomUUID(),
                        ticket_id: ticket_id!,
                        tag_key_id: tagKey.id,
                        value: date
                    })
                    break
                }
                case 'number': {
                    const number = parseFloat(value)
                    if (isNaN(number)) {
                        setError('Invalid number value')
                        return
                    }
                    await createTicketTagNumberValue({
                        id: crypto.randomUUID(),
                        ticket_id: ticket_id!,
                        tag_key_id: tagKey.id,
                        value: number.toString()
                    })
                    break
                }
                case 'text': {
                    await createTicketTagTextValue({
                        id: crypto.randomUUID(),
                        ticket_id: ticket_id!,
                        tag_key_id: tagKey.id,
                        value
                    })
                    break
                }
            }
            setIsAddingTagValue(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : `Failed to add tag`)
        } finally {
            setIsUpdatingTags(false)
        }
    }

    const handleUpdateTag = async (tagKey: TicketTagKey, valueId: string) => {
        if (!ticket || !canEdit) return

        try {
            setIsUpdatingTags(true)
            setError(null)

            const value = editedValues[tagKey.tag_type].get(tagKey.id)
            if (!value) return

            const existingValues = tagData?.values
            if (!existingValues) return

            // Update existing value based on tag type
            switch (tagKey.tag_type) {
                case 'date': {
                    const date = parseYMDDateString(value)
                    await updateTicketTagDateValue(valueId, {
                        value: date
                    })
                    break
                }
                case 'number': {
                    const number = parseFloat(value)
                    if (isNaN(number)) {
                        setError('Invalid number value')
                        return
                    }
                    await updateTicketTagNumberValue(valueId, {
                        // ts go away for now
                        value: number as unknown as string
                    })
                    break
                }
                case 'text': {
                    await updateTicketTagTextValue(valueId, {
                        value
                    })
                    break
                }
            }

            // Clear the edited value after successful update
            const newEditedValues = { ...editedValues }
            newEditedValues[tagKey.tag_type].delete(tagKey.id)
            setEditedValues(newEditedValues)

        } catch (err) {
            setError(err instanceof Error ? err.message : `Failed to update tag`)
        } finally {
            setIsUpdatingTags(false)
        }
    }

    const handleDeleteTag = async (tagKey: TicketTagKey, valueId: string) => {
        if (!ticket || !canEdit) return

        try {
            setIsUpdatingTags(true)
            setError(null)

            switch (tagKey.tag_type) {
                case 'date':
                    await deleteTicketTagDateValue(valueId)
                    break
                case 'number':
                    await deleteTicketTagNumberValue(valueId)
                    break
                case 'text':
                    await deleteTicketTagTextValue(valueId)
                    break
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : `Failed to delete tag`)
        } finally {
            setIsUpdatingTags(false)
        }
    }

    const handleApplyMacro = async (macro: Macro) => {
        if (!ticket || !canEdit) return

        try {
            setIsApplyingMacro(true)
            setError(null)

            const macroData = macro.macro
            const actions = macroData.actions

            // Apply status change if specified
            if (actions.new_status) {
                await updateTicket(ticket.id, {
                    status: actions.new_status
                })
            }

            // Apply priority change if specified
            if (actions.new_priority) {
                await updateTicket(ticket.id, {
                    priority: actions.new_priority
                })
            }

            // Remove specified tags
            for (const tagKeyId of actions.tag_keys_to_remove) {
                const dateValue = tagData?.values.date.get(tagKeyId)
                if (dateValue) {
                    await deleteTicketTagDateValue(dateValue.id)
                }
                const numberValue = tagData?.values.number.get(tagKeyId)
                if (numberValue) {
                    await deleteTicketTagNumberValue(numberValue.id)
                }
                const textValue = tagData?.values.text.get(tagKeyId)
                if (textValue) {
                    await deleteTicketTagTextValue(textValue.id)
                }
            }

            // Modify or add tags
            const { date_tags, number_tags, text_tags } = actions.tags_to_modify

            // Handle date tags
            for (const [tagKeyId, value] of Object.entries(date_tags)) {
                const existingValue = tagData?.values.date.get(tagKeyId)
                const date = new Date()
                date.setDate(date.getDate() + Number(value))

                if (existingValue) {
                    await updateTicketTagDateValue(existingValue.id, {
                        value: date
                    })
                } else {
                    await createTicketTagDateValue({
                        id: crypto.randomUUID(),
                        ticket_id: ticket_id!,
                        tag_key_id: tagKeyId,
                        value: date
                    })
                }
            }

            // Handle number tags
            for (const [tagKeyId, value] of Object.entries(number_tags)) {
                const existingValue = tagData?.values.number.get(tagKeyId)
                if (existingValue) {
                    await updateTicketTagNumberValue(existingValue.id, {
                        value: value.toString()
                    })
                } else {
                    await createTicketTagNumberValue({
                        id: crypto.randomUUID(),
                        ticket_id: ticket_id!,
                        tag_key_id: tagKeyId,
                        value: value.toString()
                    })
                }
            }

            // Handle text tags
            for (const [tagKeyId, value] of Object.entries(text_tags)) {
                const existingValue = tagData?.values.text.get(tagKeyId)
                if (existingValue) {
                    await updateTicketTagTextValue(existingValue.id, {
                        value
                    })
                } else {
                    await createTicketTagTextValue({
                        id: crypto.randomUUID(),
                        ticket_id: ticket_id!,
                        tag_key_id: tagKeyId,
                        value
                    })
                }
            }

            // Add comment if specified
            if (actions.comment) {
                await createTicketComment({
                    id: crypto.randomUUID(),
                    ticket_id: ticket_id!,
                    comment: actions.comment,
                    user_id: user!.id,
                })
            }

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to apply macro')
        } finally {
            setIsApplyingMacro(false)
        }
    }

    if (!ticket || !comments || !tagData) {
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
            ...Array.from(tagData.values.date.keys()),
            ...Array.from(tagData.values.number.keys()),
            ...Array.from(tagData.values.text.keys())
        ])

        return tagData.keys.filter(key => !usedTagIds.has(key.id))
    }

    return (
        <div className="min-h-screen p-4">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <Link
                        to={`/${organization_id}/tickets`}
                        className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
                    >
                        ← Back to Tickets
                    </Link>
                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-md mb-4">
                            {error}
                        </div>
                    )}
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-2xl">{ticket.title}</CardTitle>
                                <div className="flex gap-2">
                                    {canEdit ? (
                                        <>
                                            <Select
                                                disabled={isUpdatingTicket}
                                                value={ticket.priority}
                                                onValueChange={(value) => handleUpdateTicket('priority', value)}
                                            >
                                                <SelectTrigger className={`w-[100px] ${getPriorityColor(ticket.priority)}`}>
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
                                                disabled={isUpdatingTicket}
                                                value={ticket.status}
                                                onValueChange={(value) => handleUpdateTicket('status', value)}
                                            >
                                                <SelectTrigger className={`w-[120px] ${getStatusColor(ticket.status)}`}>
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
                                        </>
                                    ) : (
                                        <>
                                            <Badge className={getPriorityColor(ticket.priority)}>
                                                {ticket.priority}
                                            </Badge>
                                            <Badge className={getStatusColor(ticket.status)}>
                                                {ticket.status}
                                            </Badge>
                                        </>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {ticket.description && (
                                <p className="text-gray-600 mb-4 whitespace-pre-wrap">
                                    {ticket.description}
                                </p>
                            )}
                            <div className="mb-4">
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
                                            {Array.from(tagData.values.date.entries()).map(([tagKeyId, value]) => {
                                                const tagKey = tagData.keys.find(k => k.id === tagKeyId)
                                                if (!tagKey) return null
                                                const isEdited = editedValues.date.has(tagKey.id)
                                                const editedValue = editedValues.date.get(tagKey.id)
                                                return (
                                                    <div key={tagKey.id} className="flex items-center gap-2">
                                                        <span className="text-sm text-gray-500 w-24 truncate" title={tagKey.name}>{tagKey.name}:</span>
                                                        {canEdit ? (
                                                            <div className="flex items-center gap-2">
                                                                <Input
                                                                    type="date"
                                                                    className="w-[200px]"
                                                                    value={editedValue || (value.value instanceof Date ? value.value.toISOString().split('T')[0] : new Date(value.value).toISOString().split('T')[0])}
                                                                    onChange={(e) => {
                                                                        const newEditedValues = { ...editedValues }
                                                                        newEditedValues.date.set(tagKey.id, e.target.value)
                                                                        setEditedValues(newEditedValues)
                                                                    }}
                                                                    disabled={isUpdatingTags}
                                                                />
                                                                {isEdited && (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => handleUpdateTag(tagKey, value.id)}
                                                                        disabled={isUpdatingTags}
                                                                    >
                                                                        Save
                                                                    </Button>
                                                                )}
                                                                <Button
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    onClick={() => handleDeleteTag(tagKey, value.id)}
                                                                    disabled={isUpdatingTags}
                                                                >
                                                                    Delete
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <Badge variant="secondary">
                                                                {formatDateTagValue(value.value)}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                            {/* Number tag values */}
                                            {Array.from(tagData.values.number.entries()).map(([tagKeyId, value]) => {
                                                const tagKey = tagData.keys.find(k => k.id === tagKeyId)
                                                if (!tagKey) return null
                                                const isEdited = editedValues.number.has(tagKey.id)
                                                const editedValue = editedValues.number.get(tagKey.id)
                                                return (
                                                    <div key={tagKey.id} className="flex items-center gap-2">
                                                        <span className="text-sm text-gray-500 w-24 truncate" title={tagKey.name}>{tagKey.name}:</span>
                                                        {canEdit ? (
                                                            <div className="flex items-center gap-2">
                                                                <Input
                                                                    type="number"
                                                                    className="w-[200px]"
                                                                    value={editedValue || value.value}
                                                                    onChange={(e) => {
                                                                        const newEditedValues = { ...editedValues }
                                                                        newEditedValues.number.set(tagKey.id, e.target.value)
                                                                        setEditedValues(newEditedValues)
                                                                    }}
                                                                    disabled={isUpdatingTags}
                                                                />
                                                                {isEdited && (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => handleUpdateTag(tagKey, value.id)}
                                                                        disabled={isUpdatingTags}
                                                                    >
                                                                        Save
                                                                    </Button>
                                                                )}
                                                                <Button
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    onClick={() => handleDeleteTag(tagKey, value.id)}
                                                                    disabled={isUpdatingTags}
                                                                >
                                                                    Delete
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <Badge variant="secondary">
                                                                {value.value}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                            {/* Text tag values */}
                                            {Array.from(tagData.values.text.entries()).map(([tagKeyId, value]) => {
                                                const tagKey = tagData.keys.find(k => k.id === tagKeyId)
                                                if (!tagKey) return null
                                                const isEdited = editedValues.text.has(tagKey.id)
                                                const editedValue = editedValues.text.get(tagKey.id)
                                                return (
                                                    <div key={tagKey.id} className="flex items-center gap-2">
                                                        <span className="text-sm text-gray-500 w-24 truncate" title={tagKey.name}>{tagKey.name}:</span>
                                                        {canEdit ? (
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-[200px] relative">
                                                                    <Input
                                                                        type="text"
                                                                        className="w-[200px]"
                                                                        value={editedValue || value.value}
                                                                        onChange={(e) => {
                                                                            const newEditedValues = { ...editedValues }
                                                                            newEditedValues.text.set(tagKey.id, e.target.value)
                                                                            setEditedValues(newEditedValues)
                                                                        }}
                                                                        disabled={isUpdatingTags}
                                                                        title={editedValue || value.value}
                                                                        style={{
                                                                            textOverflow: 'ellipsis',
                                                                            whiteSpace: 'nowrap',
                                                                            overflow: 'hidden'
                                                                        }}
                                                                    />
                                                                </div>
                                                                {isEdited && (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => handleUpdateTag(tagKey, value.id)}
                                                                        disabled={isUpdatingTags}
                                                                    >
                                                                        Save
                                                                    </Button>
                                                                )}
                                                                <Button
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    onClick={() => handleDeleteTag(tagKey, value.id)}
                                                                    disabled={isUpdatingTags}
                                                                >
                                                                    Delete
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <Badge variant="secondary">
                                                                {value.value}
                                                            </Badge>
                                                        )}
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
                                                    isSubmitting={isUpdatingTags}
                                                />
                                            )}
                                            {canEdit && !isAddingTagValue && getUnusedTagKeys().length > 0 && (
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
                                <p>Created {formatDateTime(ticket.created_at || '')}</p>
                                {ticket.updated_at && (
                                    <p>Updated {formatDateTime(ticket.updated_at)}</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-4">
                    {/* Add macro section above comment form */}
                    {canEdit && macros.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Available Macros</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-2">
                                    {macros.map((macro) => (
                                        <Button
                                            key={macro.id}
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleApplyMacro(macro)}
                                            disabled={isApplyingMacro}
                                        >
                                            {macro.macro.name}
                                        </Button>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <form onSubmit={handleSubmitComment} className="space-y-4">
                        <RichTextEditor
                            content={newComment}
                            onChange={setNewComment}
                            disabled={isCreatingComment}
                        />
                        <Button
                            type="submit"
                            disabled={isCreatingComment || !newComment.trim()}
                        >
                            {isCreatingComment ? 'Posting...' : 'Post Comment'}
                        </Button>
                    </form>

                    <div className="space-y-4">
                        {comments.map((comment) => (
                            <Card key={comment.id}>
                                <CardContent className="pt-6">
                                    <div className="flex items-start gap-4">
                                        {comment.user_avatar_url ? (
                                            <img
                                                src={comment.user_avatar_url}
                                                alt={comment.user_full_name || ''}
                                                className="w-10 h-10 rounded-full"
                                            />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                                <span className="text-gray-500 text-sm">
                                                    {(comment.user_full_name || 'U')[0].toUpperCase()}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium">
                                                    {comment.user_full_name || 'Unknown User'}
                                                </span>
                                                <span className="text-sm text-gray-500">
                                                    {new Date(comment.created_at || '').toLocaleString()}
                                                </span>
                                            </div>
                                            <div
                                                className="text-gray-700 prose prose-sm max-w-none"
                                                dangerouslySetInnerHTML={{
                                                    __html: DOMPurify.sanitize(comment.comment, purifyConfig)
                                                }}
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
} 