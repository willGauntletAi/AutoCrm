import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import { Database } from '../types/database.types'
import { supabase } from '../lib/supabase'
import { trpc } from '../lib/trpc'
import { z } from 'zod'

type Ticket = Database['public']['Tables']['tickets']['Row']
type TicketComment = {
    id: number
    ticket_id: number
    user_id: string
    comment: string
    created_at: string | null
    user_full_name: string | null
    user_avatar_url: string | null
}

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

const ticketCommentSchema = z.object({
    id: z.union([z.number(), z.string()]).transform(val => Number(val)),
    ticket_id: z.union([z.number(), z.string()]).transform(val => Number(val)),
    user_id: z.string(),
    comment: z.string(),
    created_at: z.string().nullable(),
    user_full_name: z.string().nullable(),
    user_avatar_url: z.string().nullable()
})

export default function Ticket() {
    const { organization_id, ticket_id } = useParams<{ organization_id: string, ticket_id: string }>()
    const [error, setError] = useState<string | null>(null)
    const [ticket, setTicket] = useState<Ticket | null>(null)
    const [comments, setComments] = useState<TicketComment[]>([])
    const [newComment, setNewComment] = useState('')

    const { isLoading: isLoadingTicket } = trpc.getTicket.useQuery(
        { ticket_id: Number(ticket_id) },
        {
            onError: (err) => {
                setError(err.message)
            },
            onSuccess: (data) => {
                const parseResult = ticketSchema.safeParse(data)
                if (parseResult.success) {
                    setTicket(parseResult.data)
                } else {
                    console.error('Invalid ticket data:', parseResult.error)
                }
            }
        }
    )

    const { isLoading: isLoadingComments } = trpc.getTicketComments.useQuery(
        { ticket_id: Number(ticket_id) },
        {
            onError: (err) => {
                setError(err.message)
            },
            onSuccess: (data) => {
                const validComments = data.map(comment => {
                    // Ensure ticket_id is present
                    const commentWithTicketId = {
                        ...comment,
                        ticket_id: Number(ticket_id)
                    }
                    const parseResult = ticketCommentSchema.safeParse(commentWithTicketId)
                    if (!parseResult.success) {
                        console.error('Invalid comment data:', parseResult.error)
                        return null
                    }
                    return parseResult.data
                }).filter((comment): comment is TicketComment => comment !== null)

                setComments(validComments)
            }
        }
    )

    const createComment = trpc.createTicketComment.useMutation({
        onError: (err) => {
            setError(err.message)
        },
        onSuccess: (data) => {
            const parseResult = ticketCommentSchema.safeParse(data)
            if (parseResult.success) {
                setComments(prev => [parseResult.data, ...prev])
            }
            setNewComment('')
        }
    })

    useEffect(() => {
        // Set up real-time subscription for ticket updates
        const ticketSubscription = supabase
            .channel('ticket')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'tickets',
                    filter: `id=eq.${ticket_id}`
                },
                (payload) => {
                    if (payload.eventType === 'UPDATE') {
                        const parseResult = ticketSchema.safeParse(payload.new)
                        if (parseResult.success) {
                            setTicket(parseResult.data)
                        } else {
                            console.error('Invalid ticket data:', parseResult.error)
                        }
                    }
                }
            )
            .subscribe()

        // Set up real-time subscription for comments
        const commentsSubscription = supabase
            .channel('ticket_comments')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'ticket_comments',
                    filter: `ticket_id=eq.${ticket_id}`
                },
                async (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const session = await supabase.auth.getSession()
                        if (payload.new.user_id === session.data.session?.user.id) return

                        // Fetch user info for the new comment
                        const { data: userData } = await supabase
                            .from('profiles')
                            .select('full_name, avatar_url')
                            .eq('id', payload.new.user_id)
                            .single()

                        const newComment = {
                            ...payload.new,
                            id: Number(payload.new.id),
                            ticket_id: Number(payload.new.ticket_id),
                            user_full_name: userData?.full_name ?? null,
                            user_avatar_url: userData?.avatar_url ?? null
                        }

                        const parseResult = ticketCommentSchema.safeParse(newComment)
                        if (parseResult.success) {
                            setComments(prev => [parseResult.data, ...prev])
                        } else {
                            console.error('Invalid comment data:', parseResult.error)
                        }
                    } else if (payload.eventType === 'UPDATE') {
                        const session = await supabase.auth.getSession()
                        if (payload.new.user_id === session.data.session?.user.id) return

                        // Fetch user info for the updated comment
                        const { data: userData } = await supabase
                            .from('profiles')
                            .select('full_name, avatar_url')
                            .eq('id', payload.new.user_id)
                            .single()

                        const updatedComment = {
                            ...payload.new,
                            id: Number(payload.new.id),
                            ticket_id: Number(payload.new.ticket_id),
                            user_full_name: userData?.full_name ?? null,
                            user_avatar_url: userData?.avatar_url ?? null
                        }

                        const parseResult = ticketCommentSchema.safeParse(updatedComment)
                        if (parseResult.success) {
                            setComments(prev => prev.map(comment =>
                                comment.id === parseResult.data.id ? parseResult.data : comment
                            ))
                        } else {
                            console.error('Invalid comment data:', parseResult.error)
                        }
                    } else if (payload.eventType === 'DELETE') {
                        setComments(prev => prev.filter(comment => comment.id !== Number(payload.old.id)))
                    }
                }
            )
            .subscribe()

        // Cleanup subscriptions
        return () => {
            ticketSubscription.unsubscribe()
            commentsSubscription.unsubscribe()
        }
    }, [ticket_id])

    const handleSubmitComment = (e: React.FormEvent) => {
        e.preventDefault()
        if (!newComment.trim()) return

        createComment.mutate({
            ticket_id: Number(ticket_id),
            comment: newComment.trim()
        })
    }

    if (isLoadingTicket || isLoadingComments) {
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
                    {ticket && (
                        <Card>
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <CardTitle className="text-2xl">{ticket.title}</CardTitle>
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
                                    <p className="text-gray-600 mb-4 whitespace-pre-wrap">
                                        {ticket.description}
                                    </p>
                                )}
                                <div className="text-sm text-gray-500">
                                    <p>Created {new Date(ticket.created_at || '').toLocaleDateString()}</p>
                                    {ticket.updated_at && (
                                        <p>Updated {new Date(ticket.updated_at).toLocaleDateString()}</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                <div className="space-y-4">
                    <form onSubmit={handleSubmitComment} className="space-y-4">
                        <Textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Write a comment..."
                            className="min-h-[100px]"
                        />
                        <Button
                            type="submit"
                            disabled={createComment.isLoading || !newComment.trim()}
                        >
                            {createComment.isLoading ? 'Posting...' : 'Post Comment'}
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
                                            <p className="text-gray-700 whitespace-pre-wrap">{comment.comment}</p>
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