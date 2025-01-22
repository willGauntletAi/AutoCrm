import { db } from '../../db';
import { DB } from '../../db/types';
import { Selectable } from 'kysely';
import { Kysely } from 'kysely';
import { SyncInputSchema } from './schema';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { AuthUser } from '@/types/auth';

interface Context {
    user: AuthUser,
}

interface SyncParams {
    data: z.infer<typeof SyncInputSchema>;
    ctx: Context;
}

type TableName = keyof Pick<DB, 'profiles' | 'organizations' | 'profile_organization_members' | 'tickets' | 'ticket_comments'>;
type TableRow<T extends TableName> = Selectable<DB[T]>;
type test = TableRow<'profiles'>;

interface SyncResponse {
    profiles?: TableRow<'profiles'>[];
    organizations?: TableRow<'organizations'>[];
    profile_organization_members?: TableRow<'profile_organization_members'>[];
    tickets?: TableRow<'tickets'>[];
    ticket_comments?: TableRow<'ticket_comments'>[];
}

// Profile operations
async function createProfiles(profiles: NonNullable<NonNullable<z.infer<typeof SyncInputSchema>['profiles']>['creates']>, userId: string): Promise<TableRow<'profiles'>[]> {
    const results: TableRow<'profiles'>[] = [];
    if (!profiles.length) return results;

    for (const profile of profiles) {
        // Users can only create their own profile
        if (profile.id === userId) {
            const result = await db.insertInto('profiles')
                .values(profile)
                .returningAll()
                .executeTakeFirst();
            if (result) results.push(result);
        }
    }
    return results;
}

async function updateProfiles(profiles: NonNullable<NonNullable<z.infer<typeof SyncInputSchema>['profiles']>['updates']>, userId: string): Promise<TableRow<'profiles'>[]> {
    const results: TableRow<'profiles'>[] = [];
    if (!profiles.length) return results;

    for (const profile of profiles) {
        // Users can only update their own profile
        if (profile.id === userId) {
            const result = await db.updateTable('profiles')
                .set(profile)
                .where('id', '=', profile.id)
                .returningAll()
                .executeTakeFirst();
            if (result) results.push(result);
        }
    }
    return results;
}

// Organization operations
async function createOrganizations(organizations: NonNullable<NonNullable<z.infer<typeof SyncInputSchema>['organizations']>['creates']>, userId: string, memberships: Record<string, string>): Promise<TableRow<'organizations'>[]> {
    const results: TableRow<'organizations'>[] = [];
    if (!organizations.length) return results;

    for (const org of organizations) {
        const result = await db.insertInto('organizations')
            .values(org)
            .returningAll()
            .executeTakeFirst();
        if (result) {
            // New organizations are always created with the creator as admin
            results.push(result);
        }
    }
    return results;
}

async function updateOrganizations(organizations: NonNullable<NonNullable<z.infer<typeof SyncInputSchema>['organizations']>['updates']>, userId: string, memberships: Record<string, string>): Promise<TableRow<'organizations'>[]> {
    const results: TableRow<'organizations'>[] = [];
    if (!organizations.length) return results;

    for (const org of organizations) {
        // First check if the organization exists and isn't deleted
        const existingOrg = await db.selectFrom('organizations')
            .selectAll()
            .where('id', '=', org.id)
            .executeTakeFirst();

        if (existingOrg) {
            // Only admins can update non-deleted organizations
            if (memberships[org.id] === 'admin' && !existingOrg.deleted_at) {
                const result = await db.updateTable('organizations')
                    .set(org)
                    .where('id', '=', org.id)
                    .returningAll()
                    .executeTakeFirst();
                if (result) results.push(result);
            } else if (existingOrg.deleted_at) {
                // If organization is deleted, add it to results without updating
                results.push(existingOrg);
            }
        }
    }
    return results;
}

async function deleteOrganizations(orgIds: string[], userId: string, memberships: Record<string, string>): Promise<TableRow<'organizations'>[]> {
    const results: TableRow<'organizations'>[] = [];
    if (!orgIds.length) return results;

    for (const id of orgIds) {
        // Only admins can delete organizations
        if (memberships[id] === 'admin') {
            const result = await db.updateTable('organizations')
                .set({
                    deleted_at: new Date().toISOString(),
                })
                .where('id', '=', id)
                .returningAll()
                .executeTakeFirst();
            if (result) results.push(result);
        }
    }
    return results;
}

// Organization member operations
async function createOrganizationMembers(members: NonNullable<NonNullable<z.infer<typeof SyncInputSchema>['profile_organization_members']>['creates']>, memberships: Record<string, string>): Promise<TableRow<'profile_organization_members'>[]> {
    const results: TableRow<'profile_organization_members'>[] = [];
    if (!members.length) return results;

    for (const member of members) {
        // Only admins can create members
        if (memberships[member.organization_id] === 'admin') {
            const result = await db.insertInto('profile_organization_members')
                .values(member)
                .returningAll()
                .executeTakeFirst();
            if (result) results.push(result);
        }
    }
    return results;
}

async function updateOrganizationMembers(members: NonNullable<NonNullable<z.infer<typeof SyncInputSchema>['profile_organization_members']>['updates']>, memberships: Record<string, string>): Promise<TableRow<'profile_organization_members'>[]> {
    const results: TableRow<'profile_organization_members'>[] = [];
    if (!members.length) return results;

    for (const member of members) {
        const existingMember = await db.selectFrom('profile_organization_members')
            .selectAll()
            .where('id', '=', member.id)
            .executeTakeFirst();

        if (existingMember) {
            // Only admins can update members
            if (memberships[existingMember.organization_id] === 'admin') {
                const result = await db.updateTable('profile_organization_members')
                    .set({
                        ...member,
                        // Preserve the original organization_id and profile_id
                        organization_id: existingMember.organization_id,
                        profile_id: existingMember.profile_id,
                        deleted_at: null, // Always undelete when updating
                    })
                    .where('id', '=', member.id)
                    .returningAll()
                    .executeTakeFirst();
                if (result) results.push(result);
            }
        }
    }
    return results;
}

async function deleteOrganizationMembers(memberIds: string[], memberships: Record<string, string>): Promise<TableRow<'profile_organization_members'>[]> {
    const results: TableRow<'profile_organization_members'>[] = [];
    if (!memberIds.length) return results;

    for (const id of memberIds) {
        // First get the member to check organization
        const member = await db.selectFrom('profile_organization_members')
            .selectAll()
            .where('id', '=', id)
            .executeTakeFirst();

        if (member) {
            // Only admins can delete members
            if (memberships[member.organization_id] === 'admin') {
                const result = await db.updateTable('profile_organization_members')
                    .set({
                        deleted_at: new Date().toISOString(),
                    })
                    .where('id', '=', id)
                    .returningAll()
                    .executeTakeFirst();
                if (result) results.push(result);
            }
        }
    }
    return results;
}

// Ticket operations
async function createTickets(tickets: NonNullable<NonNullable<z.infer<typeof SyncInputSchema>['tickets']>['creates']>, memberships: Record<string, string>): Promise<TableRow<'tickets'>[]> {
    const results: TableRow<'tickets'>[] = [];
    if (!tickets.length) return results;

    for (const ticket of tickets) {
        // User must be a member of the organization to create tickets
        if (memberships[ticket.organization_id]) {
            const result = await db.insertInto('tickets')
                .values(ticket)
                .returningAll()
                .executeTakeFirst();
            if (result) results.push(result);
        }
    }
    return results;
}

async function updateTickets(tickets: NonNullable<NonNullable<z.infer<typeof SyncInputSchema>['tickets']>['updates']>, memberships: Record<string, string>, userId: string): Promise<TableRow<'tickets'>[]> {
    const results: TableRow<'tickets'>[] = [];
    if (!tickets.length) return results;

    for (const ticket of tickets) {
        const existingTicket = await db.selectFrom('tickets')
            .selectAll()
            .where('id', '=', ticket.id)
            .executeTakeFirst();

        if (existingTicket) {
            const orgRole = memberships[existingTicket.organization_id];
            // User must be a member of the organization to update tickets
            if (orgRole) {
                // Customers can only update their own tickets
                if (orgRole === 'customer' && existingTicket.created_by !== userId) {
                    continue;
                }

                const result = await db.updateTable('tickets')
                    .set({
                        ...ticket,
                        // Preserve the organization_id and created_by
                        organization_id: existingTicket.organization_id,
                        created_by: existingTicket.created_by,
                    })
                    .where('id', '=', ticket.id)
                    .returningAll()
                    .executeTakeFirst();
                if (result) results.push(result);
            }
        }
    }
    return results;
}

async function deleteTickets(ticketIds: string[], memberships: Record<string, string>, userId: string): Promise<TableRow<'tickets'>[]> {
    const results: TableRow<'tickets'>[] = [];
    if (!ticketIds.length) return results;

    for (const id of ticketIds) {
        // First get the ticket to check organization
        const ticket = await db.selectFrom('tickets')
            .selectAll()
            .where('id', '=', id)
            .executeTakeFirst();

        if (ticket) {
            const orgRole = memberships[ticket.organization_id];
            // User must be a member of the organization to delete tickets
            if (orgRole) {
                // Customers can only delete their own tickets
                if (orgRole === 'customer' && ticket.created_by !== userId) {
                    continue;
                }

                const result = await db.updateTable('tickets')
                    .set({
                        deleted_at: new Date().toISOString(),
                    })
                    .where('id', '=', id)
                    .returningAll()
                    .executeTakeFirst();
                if (result) results.push(result);
            }
        }
    }
    return results;
}

// Ticket comment operations
async function createTicketComments(comments: NonNullable<NonNullable<z.infer<typeof SyncInputSchema>['ticket_comments']>['creates']>, memberships: Record<string, string>): Promise<TableRow<'ticket_comments'>[]> {
    const results: TableRow<'ticket_comments'>[] = [];
    if (!comments.length) return results;

    for (const comment of comments) {
        // First check if the ticket exists and get its organization
        const ticket = await db.selectFrom('tickets')
            .select(['organization_id'])
            .where('id', '=', comment.ticket_id)
            .executeTakeFirst();

        // Only create comment if user has access to the ticket's organization
        if (ticket && memberships[ticket.organization_id]) {
            const result = await db.insertInto('ticket_comments')
                .values(comment)
                .returningAll()
                .executeTakeFirst();
            if (result) results.push(result);
        }
    }
    return results;
}

async function deleteTicketComments(commentIds: string[], userId: string): Promise<TableRow<'ticket_comments'>[]> {
    const results: TableRow<'ticket_comments'>[] = [];
    if (!commentIds.length) return results;

    for (const id of commentIds) {
        // First get the comment to check ownership
        const comment = await db.selectFrom('ticket_comments')
            .selectAll()
            .where('id', '=', id)
            .executeTakeFirst();

        // Users can only delete their own comments
        if (comment && comment.user_id === userId) {
            const result = await db.updateTable('ticket_comments')
                .set({
                    deleted_at: new Date().toISOString(),
                })
                .where('id', '=', id)
                .returningAll()
                .executeTakeFirst();
            if (result) results.push(result);
        }
    }
    return results;
}

export async function sync({ data: input, ctx }: SyncParams): Promise<SyncResponse> {
    const results: SyncResponse = {};

    if (input.profiles) {
        const profileResults: TableRow<'profiles'>[] = [];
        if (input.profiles.creates) {
            profileResults.push(...await createProfiles(input.profiles.creates, ctx.user.id));
        }
        if (input.profiles.updates) {
            profileResults.push(...await updateProfiles(input.profiles.updates, ctx.user.id));
        }
        if (profileResults.length > 0) {
            results.profiles = profileResults;
        }
    }

    if (input.organizations) {
        const orgResults: TableRow<'organizations'>[] = [];
        if (input.organizations.creates) {
            orgResults.push(...await createOrganizations(input.organizations.creates, ctx.user.id, ctx.user.organizations));
        }
        if (input.organizations.updates) {
            orgResults.push(...await updateOrganizations(input.organizations.updates, ctx.user.id, ctx.user.organizations));
        }
        if (input.organizations.deletes) {
            orgResults.push(...await deleteOrganizations(input.organizations.deletes, ctx.user.id, ctx.user.organizations));
        }
        if (orgResults.length > 0) {
            results.organizations = orgResults;
        }
    }

    if (input.profile_organization_members) {
        const memberResults: TableRow<'profile_organization_members'>[] = [];
        if (input.profile_organization_members.creates) {
            memberResults.push(...await createOrganizationMembers(input.profile_organization_members.creates, ctx.user.organizations));
        }
        if (input.profile_organization_members.updates) {
            memberResults.push(...await updateOrganizationMembers(input.profile_organization_members.updates, ctx.user.organizations));
        }
        if (input.profile_organization_members.deletes) {
            memberResults.push(...await deleteOrganizationMembers(input.profile_organization_members.deletes, ctx.user.organizations));
        }
        if (memberResults.length > 0) {
            results.profile_organization_members = memberResults;
        }
    }

    if (input.tickets) {
        const ticketResults: TableRow<'tickets'>[] = [];
        if (input.tickets.creates) {
            ticketResults.push(...await createTickets(input.tickets.creates, ctx.user.organizations));
        }
        if (input.tickets.updates) {
            ticketResults.push(...await updateTickets(input.tickets.updates, ctx.user.organizations, ctx.user.id));
        }
        if (input.tickets.deletes) {
            ticketResults.push(...await deleteTickets(input.tickets.deletes, ctx.user.organizations, ctx.user.id));
        }
        if (ticketResults.length > 0) {
            results.tickets = ticketResults;
        }
    }

    if (input.ticket_comments) {
        const commentResults: TableRow<'ticket_comments'>[] = [];
        if (input.ticket_comments.creates) {
            commentResults.push(...await createTicketComments(input.ticket_comments.creates, ctx.user.organizations));
        }
        if (input.ticket_comments.deletes) {
            commentResults.push(...await deleteTicketComments(input.ticket_comments.deletes, ctx.user.id));
        }
        if (commentResults.length > 0) {
            results.ticket_comments = commentResults;
        }
    }

    return results;
} 