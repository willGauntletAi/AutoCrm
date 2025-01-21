import { db } from '../../db';
import { AuthUser } from '../../types/auth';

interface Context {
    user: AuthUser;
}

interface CreateTicketParams {
    title: string;
    description?: string;
    priority: string;
    organization_id: string;
    ctx: Context;
}

interface GetTicketsParams {
    organization_id: string;
    ctx: Context;
}

interface GetTicketParams {
    ticket_id: number;
    ctx: Context;
}

interface GetTicketCommentsParams {
    ticket_id: number;
    ctx: Context;
}

interface CreateTicketCommentParams {
    ticket_id: number;
    comment: string;
    ctx: Context;
}

export async function createTicket({ title, description, priority, organization_id, ctx }: CreateTicketParams) {
    // Verify the user is a member of the organization using ctx.user.organizations
    if (!(organization_id in ctx.user.organizations)) {
        throw new Error('You are not a member of this organization');
    }

    const ticket = await db
        .insertInto('tickets')
        .values({
            title,
            description,
            organization_id,
            created_by: ctx.user.id,
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

export async function getTickets({ organization_id, ctx }: GetTicketsParams) {
    // Verify the user is a member of the organization using ctx.user.organizations
    if (!(organization_id in ctx.user.organizations)) {
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

export async function getTicket({ ticket_id, ctx }: GetTicketParams) {
    const ticket = await db
        .selectFrom('tickets')
        .selectAll()
        .where('id', '=', ticket_id.toString())
        .executeTakeFirst();

    if (!ticket) {
        throw new Error('Ticket not found');
    }

    // Verify the user has access to this ticket's organization using ctx.user.organizations
    if (!(ticket.organization_id in ctx.user.organizations)) {
        throw new Error('You do not have access to this ticket');
    }

    return ticket;
}

export async function getTicketComments({ ticket_id, ctx }: GetTicketCommentsParams) {
    // First get the ticket to verify access
    const ticket = await db
        .selectFrom('tickets')
        .select('organization_id')
        .where('id', '=', ticket_id.toString())
        .executeTakeFirst();

    if (!ticket) {
        throw new Error('Ticket not found');
    }

    // Verify the user has access to this ticket's organization using ctx.user.organizations
    if (!(ticket.organization_id in ctx.user.organizations)) {
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

export async function createTicketComment({ ticket_id, comment, ctx }: CreateTicketCommentParams) {
    // First get the ticket to verify access
    const ticket = await db
        .selectFrom('tickets')
        .select('organization_id')
        .where('id', '=', ticket_id.toString())
        .executeTakeFirst();

    if (!ticket) {
        throw new Error('Ticket not found');
    }

    // Verify the user has access to this ticket's organization using ctx.user.organizations
    if (!(ticket.organization_id in ctx.user.organizations)) {
        throw new Error('You do not have access to this ticket');
    }

    const newComment = await db
        .insertInto('ticket_comments')
        .values({
            ticket_id,
            user_id: ctx.user.id,
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
        .where('id', '=', ctx.user.id)
        .executeTakeFirst();

    return {
        ...newComment,
        user_full_name: user?.full_name,
        user_avatar_url: user?.avatar_url
    };
} 