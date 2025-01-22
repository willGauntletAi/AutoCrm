import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import { db } from '../lib/db'
import { create } from '../lib/mutations'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAuth } from '../lib/auth'

export default function Ticket() {
    const { organization_id, ticket_id } = useParams<{ organization_id: string, ticket_id: string }>()
    const [error, setError] = useState<string | null>(null)
    const [newComment, setNewComment] = useState('')
    const [isCreatingComment, setIsCreatingComment] = useState(false)
    const { user } = useAuth()

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
            const ticketComments = await db.ticketComments
                .where('ticket_id')
                .equals(ticket_id!)
                .filter(comment => !comment.deleted_at)
                .reverse()
                .toArray()

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

    const handleSubmitComment = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newComment.trim() || !user) return

        try {
            setIsCreatingComment(true)
            setError(null)
            await create('ticket_comments', {
                ticket_id: ticket_id!,
                comment: newComment.trim(),
                user_id: user.id,
                created_at: new Date().toISOString()
            })
            setNewComment('')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create comment')
        } finally {
            setIsCreatingComment(false)
        }
    }

    if (!ticket || !comments) {
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