import { db } from '../../db';

interface CreateTicketParams {
    title: string;
    description?: string;
    priority: string;
    organization_id: string;
    userId: string;
}

interface GetTicketsParams {
    organization_id: string;
    userId: string;
}

interface GetTicketParams {
    ticket_id: number;
    userId: string;
}

interface GetTicketCommentsParams {
    ticket_id: number;
    userId: string;
}

interface CreateTicketCommentParams {
    ticket_id: number;
    comment: string;
    userId: string;
}

export async function createTicket({ title, description, priority, organization_id, userId }: CreateTicketParams) {
    // First verify the user is a member of the organization
    const membership = await db
        .selectFrom('profile_organization_members')
        .select('id')
        .where('profile_id', '=', userId)
        .where('organization_id', '=', organization_id)
        .executeTakeFirst();

    if (!membership) {
        throw new Error('You are not a member of this organization');
    }

    const ticket = await db
        .insertInto('tickets')
        .values({
            title,
            description,
            organization_id,
            created_by: userId,
            status: 'open',
            priority
        })
        .returningAll()
        .executeTakeFirst();

    if (!ticket) {
        throw new Error('Failed to create ticket');
    }

    return ticket;
}

export async function getTickets({ organization_id, userId }: GetTicketsParams) {
    // First verify the user is a member of the organization
    const membership = await db
        .selectFrom('profile_organization_members')
        .select('id')
        .where('profile_id', '=', userId)
        .where('organization_id', '=', organization_id)
        .executeTakeFirst();

    if (!membership) {
        throw new Error('You are not a member of this organization');
    }

    const tickets = await db
        .selectFrom('tickets')
        .selectAll()
        .where('organization_id', '=', organization_id)
        .orderBy('created_at', 'desc')
        .execute();

    return tickets;
}

export async function getTicket({ ticket_id, userId }: GetTicketParams) {
    const ticket = await db
        .selectFrom('tickets')
        .selectAll()
        .where('id', '=', ticket_id.toString())
        .executeTakeFirst();

    if (!ticket) {
        throw new Error('Ticket not found');
    }

    // Verify the user has access to this ticket's organization
    const membership = await db
        .selectFrom('profile_organization_members')
        .select('id')
        .where('profile_id', '=', userId)
        .where('organization_id', '=', ticket.organization_id)
        .executeTakeFirst();

    if (!membership) {
        throw new Error('You do not have access to this ticket');
    }

    return ticket;
}

export async function getTicketComments({ ticket_id, userId }: GetTicketCommentsParams) {
    // First get the ticket to verify access
    const ticket = await db
        .selectFrom('tickets')
        .select('organization_id')
        .where('id', '=', ticket_id.toString())
        .executeTakeFirst();

    if (!ticket) {
        throw new Error('Ticket not found');
    }

    // Verify the user has access to this ticket's organization
    const membership = await db
        .selectFrom('profile_organization_members')
        .select('id')
        .where('profile_id', '=', userId)
        .where('organization_id', '=', ticket.organization_id)
        .executeTakeFirst();

    if (!membership) {
        throw new Error('You do not have access to this ticket');
    }

    // Get comments with user information
    const comments = await db
        .selectFrom('ticket_comments')
        .innerJoin('profiles', 'profiles.id', 'ticket_comments.user_id')
        .select([
            'ticket_comments.id',
            'ticket_comments.ticket_id',
            'ticket_comments.comment',
            'ticket_comments.created_at',
            'ticket_comments.user_id',
            'profiles.full_name as user_full_name',
            'profiles.avatar_url as user_avatar_url'
        ])
        .where('ticket_id', '=', ticket_id.toString())
        .orderBy('ticket_comments.created_at', 'desc')
        .execute();

    return comments;
}

export async function createTicketComment({ ticket_id, comment, userId }: CreateTicketCommentParams) {
    // First get the ticket to verify access
    const ticket = await db
        .selectFrom('tickets')
        .select('organization_id')
        .where('id', '=', ticket_id.toString())
        .executeTakeFirst();

    if (!ticket) {
        throw new Error('Ticket not found');
    }

    // Verify the user has access to this ticket's organization
    const membership = await db
        .selectFrom('profile_organization_members')
        .select('id')
        .where('profile_id', '=', userId)
        .where('organization_id', '=', ticket.organization_id)
        .executeTakeFirst();

    if (!membership) {
        throw new Error('You do not have access to this ticket');
    }

    const newComment = await db
        .insertInto('ticket_comments')
        .values({
            ticket_id,
            user_id: userId,
            comment
        })
        .returningAll()
        .executeTakeFirst();

    if (!newComment) {
        throw new Error('Failed to create comment');
    }

    // Get the user info for the new comment
    const user = await db
        .selectFrom('profiles')
        .select(['id', 'full_name', 'avatar_url'])
        .where('id', '=', userId)
        .executeTakeFirst();

    return {
        ...newComment,
        user_full_name: user?.full_name,
        user_avatar_url: user?.avatar_url
    };
} 