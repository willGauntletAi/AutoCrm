import { useEffect, useState } from 'react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Database } from '../types/database.types'
import { supabase } from '../lib/supabase'
import { trpc } from '../lib/trpc'
import { z } from 'zod'
import { useParams } from 'react-router-dom'
import { Badge } from '../components/ui/badge'
import { CreateTicketDialog } from '../components/CreateTicketDialog'

type Ticket = Database['public']['Tables']['tickets']['Row']

const ticketSchema = z.object({
    id: z.union([z.number(), z.string()]).transform(val => Number(val)),
    title: z.string(),
    description: z.string().nullable(),
    status: z.string(),
    priority: z.string(),
    created_by: z.string(),
    assigned_to: z.string().nullable(),
    organization_id: z.string(),
    created_at: z.string().nullable(),
    updated_at: z.string().nullable()
})

export default function Tickets() {
    const { organization_id } = useParams<{ organization_id: string }>()
    const [error, setError] = useState<string | null>(null)
    const [tickets, setTickets] = useState<Ticket[]>([])

    const { isLoading } = trpc.getTickets.useQuery(
        { organization_id: organization_id! },
        {
            onError: (err) => {
                setError(err.message)
            },
            onSuccess: (data) => {
                // Validate and set the initial data
                console.log(data)
                const validTickets = data.map(ticket => {
                    const parseResult = ticketSchema.safeParse(ticket)
                    if (!parseResult.success) {
                        console.error('Invalid ticket data:', parseResult.error)
                        return null
                    }
                    return parseResult.data
                }).filter((ticket) => ticket !== null)

                setTickets(validTickets)
            }
        }
    )

    const createTicket = trpc.createTicket.useMutation<Ticket>({
        onError: (err) => {
            setError(err.message)
        }
    })

    useEffect(() => {
        // Set up real-time subscription
        const subscription = supabase
            .channel('tickets')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'tickets',
                    filter: `organization_id=eq.${organization_id}`
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const parseResult = ticketSchema.safeParse(payload.new)
                        if (parseResult.success) {
                            setTickets(prev => [parseResult.data, ...prev])
                        } else {
                            console.error('Invalid ticket data:', parseResult.error)
                        }
                    } else if (payload.eventType === 'DELETE') {
                        setTickets(prev => prev.filter(ticket => ticket.id !== payload.old.id))
                    } else if (payload.eventType === 'UPDATE') {
                        const parseResult = ticketSchema.safeParse(payload.new)
                        if (parseResult.success) {
                            setTickets(prev => prev.map(ticket =>
                                ticket.id === parseResult.data.id ? parseResult.data : ticket
                            ))
                        } else {
                            console.error('Invalid ticket data:', parseResult.error)
                        }
                    }
                }
            )
            .subscribe()

        // Cleanup subscription
        return () => {
            subscription.unsubscribe()
        }
    }, [organization_id])

    const handleCreateTicket = (title: string, description: string) => {
        createTicket.mutate({
            title,
            description,
            organization_id: organization_id!
        })
    }

    if (isLoading) {
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
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-4xl font-bold">Tickets</h1>
                    <CreateTicketDialog
                        trigger={<Button>Create Ticket</Button>}
                        onCreateTicket={handleCreateTicket}
                        isLoading={createTicket.isLoading}
                    />
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-md mb-4">
                        {error}
                    </div>
                )}

                <div className="grid gap-4">
                    {tickets.map((ticket) => (
                        <Card key={ticket.id}>
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
                                    <p className="text-gray-600 mb-4">{ticket.description}</p>
                                )}
                                <div className="text-sm text-gray-500">
                                    <p>Created {new Date(ticket.created_at || '').toLocaleDateString()}</p>
                                    {ticket.updated_at && (
                                        <p>Updated {new Date(ticket.updated_at).toLocaleDateString()}</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {tickets.length === 0 && (
                        <div className="text-center p-8 bg-gray-50 rounded-lg">
                            <p className="text-gray-600">No tickets found for this organization.</p>
                            <CreateTicketDialog
                                trigger={
                                    <Button variant="link" className="mt-2">
                                        Create your first ticket
                                    </Button>
                                }
                                onCreateTicket={handleCreateTicket}
                                isLoading={createTicket.isLoading}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
} 