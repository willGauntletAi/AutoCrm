import { db } from '../../db';

interface CreateTicketParams {
    title: string;
    description?: string;
    organization_id: string;
    userId: string;
}

interface GetTicketsParams {
    organization_id: string;
    userId: string;
}

export async function createTicket({ title, description, organization_id, userId }: CreateTicketParams) {
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
            priority: 'medium'
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