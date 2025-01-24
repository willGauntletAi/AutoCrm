import { useState } from 'react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { useParams, Link } from 'react-router-dom'
import { Badge } from '../components/ui/badge'
import { CreateTicketDialog } from '../components/CreateTicketDialog'
import { db } from '../lib/db'
import { createTicket } from '../lib/mutations'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAuth } from '@/lib/auth'
import type { TicketTagKey } from '../lib/db'

export default function Tickets() {
    const { organization_id } = useParams<{ organization_id: string }>()
    const [error, setError] = useState<string | null>(null)
    const [isCreatingTicket, setIsCreatingTicket] = useState(false)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const { user } = useAuth()

    const tickets = useLiveQuery(
        async () => {
            const ticketsList = await db.tickets
                .where('organization_id')
                .equals(organization_id!)
                .filter(ticket => !ticket.deleted_at)
                .reverse()
                .toArray()

            // Fetch all tag keys for the organization
            const tagKeys = await db.ticketTagKeys
                .where('organization_id')
                .equals(organization_id!)
                .filter(key => !key.deleted_at)
                .toArray()

            // Get all ticket IDs
            const ticketIds = ticketsList.map(t => t.id)

            // Fetch all tag values for these tickets
            const [dateValues, numberValues, textValues] = await Promise.all([
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
                    .toArray()
            ])

            // Create a map of tag values by ticket ID
            const tagValuesByTicket = new Map(ticketIds.map(id => [id, {
                date: new Map<string, string>(),
                number: new Map<string, string>(),
                text: new Map<string, string>()
            }]))

            // Populate the tag values maps
            dateValues.forEach(v => {
                const ticketTags = tagValuesByTicket.get(v.ticket_id)
                if (ticketTags) {
                    console.log(v.value)
                    // Store the date string directly
                    ticketTags.date.set(v.tag_key_id, v.value.toISOString())
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

            // Attach tag data to tickets
            return ticketsList.map(ticket => ({
                ...ticket,
                tags: {
                    keys: tagKeys,
                    values: tagValuesByTicket.get(ticket.id) || {
                        date: new Map(),
                        number: new Map(),
                        text: new Map()
                    }
                }
            }))
        },
        [organization_id],
        []
    )

    const handleCreateTicket = async (data: { title: string; description: string; priority: 'high' | 'low' | 'medium' }) => {
        if (!user) return

        try {
            setIsCreatingTicket(true)
            setError(null)
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
            setIsDialogOpen(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create ticket')
        } finally {
            setIsCreatingTicket(false)
        }
    }

    if (!tickets) {
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
                <div className="mb-8">
                    <div className="flex justify-between items-center mb-4">
                        <h1 className="text-2xl font-bold">Tickets</h1>
                        <Button onClick={() => setIsDialogOpen(true)}>
                            Create Ticket
                        </Button>
                    </div>
                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-md mb-4">
                            {error}
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    {tickets.map((ticket) => (
                        <Link key={ticket.id} to={`/${organization_id}/tickets/${ticket.id}`}>
                            <Card className="hover:shadow-md transition-shadow">
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <CardTitle>{ticket.title}</CardTitle>
                                        <div className="flex gap-2">
                                            <Badge className={getPriorityColor(ticket.priority)}>
                                                {ticket.priority}
                                            </Badge>
                                            <Badge className={getStatusColor(ticket.status)}>
                                                {ticket.status}
                                            </Badge>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {ticket.description && (
                                        <p className="text-gray-600 mb-4 line-clamp-2">
                                            {ticket.description}
                                        </p>
                                    )}
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {ticket.tags.keys.map((tagKey: TicketTagKey) => {
                                            let value: string | null = null;
                                            switch (tagKey.tag_type) {
                                                case 'date': {
                                                    const dateStr = ticket.tags.values.date.get(tagKey.id);
                                                    if (dateStr) {
                                                        // Format the date while preserving timezone information
                                                        const date = new Date(dateStr);
                                                        value = date.toLocaleString(undefined, {
                                                            year: 'numeric',
                                                            month: 'short',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                            timeZoneName: 'short'
                                                        });
                                                    }
                                                    break;
                                                }
                                                case 'number':
                                                    value = ticket.tags.values.number.get(tagKey.id) || null;
                                                    break;
                                                case 'text':
                                                    value = ticket.tags.values.text.get(tagKey.id) || null;
                                                    break;
                                            }
                                            if (value === null) return null;
                                            return (
                                                <Badge
                                                    key={tagKey.id}
                                                    variant="outline"
                                                    className="bg-blue-50"
                                                >
                                                    {tagKey.name}: {value}
                                                </Badge>
                                            );
                                        })}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        <p>Created {new Date(ticket.created_at || '').toLocaleDateString()}</p>
                                        {ticket.updated_at && (
                                            <p>Updated {new Date(ticket.updated_at).toLocaleDateString()}</p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>

                <CreateTicketDialog
                    open={isDialogOpen}
                    onOpenChange={setIsDialogOpen}
                    onSubmit={handleCreateTicket}
                    isLoading={isCreatingTicket}
                />
            </div>
        </div>
    )
} 