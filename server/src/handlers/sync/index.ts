import { db } from '../../db';
import { DB } from '../../db/types';
import { Selectable } from 'kysely';
import { SyncInputSchema } from './schema';
import { z } from 'zod';
import { AuthUser } from '../..//utils/auth';

interface Context {
    user: AuthUser,
}

interface SyncParams {
    data: z.infer<typeof SyncInputSchema>;
    ctx: Context;
}

type TableName = keyof Pick<DB, 'profiles' | 'organizations' | 'profile_organization_members' | 'tickets' | 'ticket_comments'>;
type TableRow<T extends TableName> = Selectable<DB[T]>;

interface SyncResponse {
    profiles?: TableRow<'profiles'>[];
    organizations?: TableRow<'organizations'>[];
    profile_organization_members?: TableRow<'profile_organization_members'>[];
    tickets?: TableRow<'tickets'>[];
    ticket_comments?: TableRow<'ticket_comments'>[];
}

// Profile operations
async function createProfile(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'create_profile' }, userId: string): Promise<TableRow<'profiles'> | null> {
    // Users can only create their own profile
    if (data.data.id !== userId) {
        return null;
    }

    return await db.insertInto('profiles')
        .values({
            id: data.data.id,
            full_name: data.data.full_name,
            avatar_url: data.data.avatar_url,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();
}

async function updateProfile(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'update_profile' }, userId: string): Promise<TableRow<'profiles'> | null> {
    // Users can only update their own profile
    if (data.data.id !== userId) {
        return null;
    }

    return await db.updateTable('profiles')
        .set({
            ...data.data,
            updated_at: new Date().toISOString(),
        })
        .where('id', '=', data.data.id)
        .returningAll()
        .executeTakeFirstOrThrow();
}

// Organization operations
async function createOrganization(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'create_organization' }): Promise<TableRow<'organizations'>> {
    try {
        return await db.insertInto('organizations')
            .values({
                id: data.data.id,
                name: data.data.name,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .returningAll()
            .executeTakeFirstOrThrow();
    } catch (error) {
        // If it's a unique constraint violation, return the existing record
        if (error instanceof Error && error.message.includes('duplicate key')) {
            return await db.selectFrom('organizations')
                .selectAll()
                .where('id', '=', data.data.id)
                .executeTakeFirstOrThrow();
        }
        throw error;
    }
}

async function updateOrganization(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'update_organization' }, memberships: Record<string, string>): Promise<TableRow<'organizations'> | null> {
    // First check if the organization exists
    const existingOrg = await db.selectFrom('organizations')
        .selectAll()
        .where('id', '=', data.data.id)
        .executeTakeFirst();

    // Check read permissions
    if (!existingOrg || !memberships[data.data.id]) {
        return null;
    }

    // If deleted, return as-is
    if (existingOrg.deleted_at) {
        return existingOrg;
    }

    // Check write permissions
    if (memberships[data.data.id] !== 'admin') {
        return null;
    }

    return await db.updateTable('organizations')
        .set({
            id: data.data.id,
            name: data.data.name,
            updated_at: new Date().toISOString(),
        })
        .where('id', '=', data.data.id)
        .returningAll()
        .executeTakeFirstOrThrow();
}

async function deleteOrganization(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'delete_organization' }, memberships: Record<string, string>): Promise<TableRow<'organizations'> | null> {
    // First check if the organization exists
    const existingOrg = await db.selectFrom('organizations')
        .selectAll()
        .where('id', '=', data.data.id)
        .executeTakeFirst();

    // Check read permissions
    if (!existingOrg || !memberships[data.data.id]) {
        return null;
    }

    // If deleted, return as-is
    if (existingOrg.deleted_at) {
        return existingOrg;
    }

    // Check delete permissions
    if (memberships[data.data.id] !== 'admin') {
        return null;
    }

    return await db.updateTable('organizations')
        .set({
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .where('id', '=', data.data.id)
        .returningAll()
        .executeTakeFirstOrThrow();
}

// Profile Organization Member operations
async function createProfileOrganizationMember(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'create_profile_organization_member' }, memberships: Record<string, string>): Promise<TableRow<'profile_organization_members'> | null> {
    // Check if this is the first member of the organization
    const existingMembers = await db.selectFrom('profile_organization_members')
        .selectAll()
        .where('organization_id', '=', data.data.organization_id)
        .where('deleted_at', 'is', null)
        .execute();

    // Allow if this is the first member, otherwise require admin permission
    if (existingMembers.length > 0 && memberships[data.data.organization_id] !== 'admin') {
        return null;
    }

    const duplicate = existingMembers.find(m => m.id === data.data.id);
    if (duplicate) {
        return duplicate;
    }
    return await db.insertInto('profile_organization_members')
        .values({
            id: data.data.id,
            profile_id: data.data.profile_id,
            organization_id: data.data.organization_id,
            role: data.data.role,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();
}

async function updateProfileOrganizationMember(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'update_profile_organization_member' }, memberships: Record<string, string>): Promise<TableRow<'profile_organization_members'> | null> {
    // First check if member exists
    const existingMember = await db.selectFrom('profile_organization_members')
        .selectAll()
        .where('id', '=', data.data.id)
        .executeTakeFirst();

    // Check read permissions
    if (!existingMember || !memberships[existingMember.organization_id]) {
        return null;
    }

    // If deleted, return as-is
    if (existingMember.deleted_at) {
        return existingMember;
    }

    // Check write permissions
    if (memberships[existingMember.organization_id] !== 'admin') {
        return null;
    }

    return await db.updateTable('profile_organization_members')
        .set({
            ...data.data,
            // Preserve the original organization_id and profile_id
            organization_id: existingMember.organization_id,
            profile_id: existingMember.profile_id,
            deleted_at: null, // Always undelete when updating
            updated_at: new Date().toISOString(),
        })
        .where('id', '=', data.data.id)
        .returningAll()
        .executeTakeFirstOrThrow();
}

async function deleteProfileOrganizationMember(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'delete_profile_organization_member' }, memberships: Record<string, string>): Promise<TableRow<'profile_organization_members'> | null> {
    // First check if member exists
    const existingMember = await db.selectFrom('profile_organization_members')
        .selectAll()
        .where('id', '=', data.data.id)
        .executeTakeFirst();

    // Check read permissions
    if (!existingMember || !memberships[existingMember.organization_id]) {
        return null;
    }

    // If deleted, return as-is
    if (existingMember.deleted_at) {
        return existingMember;
    }

    // Check delete permissions
    if (memberships[existingMember.organization_id] !== 'admin') {
        return null;
    }

    return await db.updateTable('profile_organization_members')
        .set({
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .where('id', '=', data.data.id)
        .returningAll()
        .executeTakeFirstOrThrow();
}

// Ticket operations
async function createTicket(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'create_ticket' }, memberships: Record<string, string>): Promise<TableRow<'tickets'> | null> {
    // User must be a member of the organization to create tickets
    if (!memberships[data.data.organization_id]) {
        return null;
    }

    try {
        return await db.insertInto('tickets')
            .values({
                id: data.data.id,
                title: data.data.title,
                description: data.data.description,
                status: data.data.status,
                priority: data.data.priority,
                created_by: data.data.created_by,
                assigned_to: data.data.assigned_to,
                organization_id: data.data.organization_id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .returningAll()
            .executeTakeFirstOrThrow();
    } catch (error) {
        // If it's a unique constraint violation, return the existing record
        if (error instanceof Error && error.message.includes('duplicate key')) {
            return await db.selectFrom('tickets')
                .selectAll()
                .where('id', '=', data.data.id)
                .executeTakeFirstOrThrow();
        }
        throw error;
    }
}

async function updateTicket(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'update_ticket' }, memberships: Record<string, string>, userId: string): Promise<TableRow<'tickets'> | null> {
    // First check if ticket exists
    const existingTicket = await db.selectFrom('tickets')
        .selectAll()
        .where('id', '=', data.data.id)
        .executeTakeFirst();

    // Check read permissions
    if (!existingTicket || !memberships[existingTicket.organization_id]) {
        return null;
    }

    // If deleted, return as-is
    if (existingTicket.deleted_at) {
        return existingTicket;
    }

    // Check write permissions
    const orgRole = memberships[existingTicket.organization_id];
    if (orgRole === 'customer' && existingTicket.created_by !== userId) {
        return null;
    }

    return await db.updateTable('tickets')
        .set({
            ...data.data,
            // Preserve the organization_id and created_by
            organization_id: existingTicket.organization_id,
            created_by: existingTicket.created_by,
            updated_at: new Date().toISOString(),
        })
        .where('id', '=', data.data.id)
        .returningAll()
        .executeTakeFirstOrThrow();
}

async function deleteTicket(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'delete_ticket' }, memberships: Record<string, string>, userId: string): Promise<TableRow<'tickets'> | null> {
    // First check if ticket exists
    const existingTicket = await db.selectFrom('tickets')
        .selectAll()
        .where('id', '=', data.data.id)
        .executeTakeFirst();

    // Check read permissions
    if (!existingTicket || !memberships[existingTicket.organization_id]) {
        return null;
    }

    // If deleted, return as-is
    if (existingTicket.deleted_at) {
        return existingTicket;
    }

    // Check delete permissions
    const orgRole = memberships[existingTicket.organization_id];
    if (orgRole === 'customer' && existingTicket.created_by !== userId) {
        return null;
    }

    return await db.updateTable('tickets')
        .set({
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .where('id', '=', data.data.id)
        .returningAll()
        .executeTakeFirstOrThrow();
}

// Ticket Comment operations
async function createTicketComment(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'create_ticket_comment' }, memberships: Record<string, string>): Promise<TableRow<'ticket_comments'> | null> {
    // First check if the ticket exists and get its organization
    const ticket = await db.selectFrom('tickets')
        .select(['organization_id', 'deleted_at'])
        .where('id', '=', data.data.ticket_id)
        .executeTakeFirst();

    // Can't comment on deleted tickets
    if (!ticket || ticket.deleted_at) {
        return null;
    }

    // Only create comment if user has access to the ticket's organization
    if (!memberships[ticket.organization_id]) {
        return null;
    }

    try {
        return await db.insertInto('ticket_comments')
            .values({
                id: data.data.id,
                ticket_id: data.data.ticket_id,
                user_id: data.data.user_id,
                comment: data.data.comment,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .returningAll()
            .executeTakeFirstOrThrow();
    } catch (error) {
        // If it's a unique constraint violation, return the existing record
        if (error instanceof Error && error.message.includes('duplicate key')) {
            return await db.selectFrom('ticket_comments')
                .selectAll()
                .where('id', '=', data.data.id)
                .executeTakeFirstOrThrow();
        }
        throw error;
    }
}

async function deleteTicketComment(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'delete_ticket_comment' }, userId: string): Promise<TableRow<'ticket_comments'> | null> {
    // First check if comment exists
    const existingComment = await db.selectFrom('ticket_comments')
        .selectAll()
        .where('id', '=', data.data.id)
        .executeTakeFirst();

    // Check read permissions (anyone who can see the comment can read it)
    if (!existingComment) {
        return null;
    }

    // If deleted, return as-is
    if (existingComment.deleted_at) {
        return existingComment;
    }

    // Check delete permissions (only comment owner can delete)
    if (existingComment.user_id !== userId) {
        return null;
    }

    return await db.updateTable('ticket_comments')
        .set({
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .where('id', '=', data.data.id)
        .returningAll()
        .executeTakeFirstOrThrow();
}

export async function sync({ data: operations, ctx }: SyncParams): Promise<SyncResponse> {
    const results: SyncResponse = {};

    for (const operation of operations) {
        switch (operation.operation) {
            // Profile operations
            case 'create_profile': {
                const result = await createProfile(operation, ctx.user.id);
                if (result) {
                    if (!results.profiles) results.profiles = [];
                    results.profiles.push(result);
                }
                break;
            }
            case 'update_profile': {
                const result = await updateProfile(operation, ctx.user.id);
                if (result) {
                    if (!results.profiles) results.profiles = [];
                    results.profiles.push(result);
                }
                break;
            }

            // Organization operations
            case 'create_organization': {
                const result = await createOrganization(operation);
                if (result) {
                    if (!results.organizations) results.organizations = [];
                    results.organizations.push(result);
                }
                break;
            }
            case 'update_organization': {
                const result = await updateOrganization(operation, ctx.user.organizations);
                if (result) {
                    if (!results.organizations) results.organizations = [];
                    results.organizations.push(result);
                }
                break;
            }
            case 'delete_organization': {
                const result = await deleteOrganization(operation, ctx.user.organizations);
                if (result) {
                    if (!results.organizations) results.organizations = [];
                    results.organizations.push(result);
                }
                break;
            }

            // Profile Organization Member operations
            case 'create_profile_organization_member': {
                const result = await createProfileOrganizationMember(operation, ctx.user.organizations);
                if (result) {
                    if (!results.profile_organization_members) results.profile_organization_members = [];
                    results.profile_organization_members.push(result);
                }
                break;
            }
            case 'update_profile_organization_member': {
                const result = await updateProfileOrganizationMember(operation, ctx.user.organizations);
                if (result) {
                    if (!results.profile_organization_members) results.profile_organization_members = [];
                    results.profile_organization_members.push(result);
                }
                break;
            }
            case 'delete_profile_organization_member': {
                const result = await deleteProfileOrganizationMember(operation, ctx.user.organizations);
                if (result) {
                    if (!results.profile_organization_members) results.profile_organization_members = [];
                    results.profile_organization_members.push(result);
                }
                break;
            }

            // Ticket operations
            case 'create_ticket': {
                const result = await createTicket(operation, ctx.user.organizations);
                if (result) {
                    if (!results.tickets) results.tickets = [];
                    results.tickets.push(result);
                }
                break;
            }
            case 'update_ticket': {
                const result = await updateTicket(operation, ctx.user.organizations, ctx.user.id);
                if (result) {
                    if (!results.tickets) results.tickets = [];
                    results.tickets.push(result);
                }
                break;
            }
            case 'delete_ticket': {
                const result = await deleteTicket(operation, ctx.user.organizations, ctx.user.id);
                if (result) {
                    if (!results.tickets) results.tickets = [];
                    results.tickets.push(result);
                }
                break;
            }

            // Ticket Comment operations
            case 'create_ticket_comment': {
                const result = await createTicketComment(operation, ctx.user.organizations);
                if (result) {
                    if (!results.ticket_comments) results.ticket_comments = [];
                    results.ticket_comments.push(result);
                }
                break;
            }
            case 'delete_ticket_comment': {
                const result = await deleteTicketComment(operation, ctx.user.id);
                if (result) {
                    if (!results.ticket_comments) results.ticket_comments = [];
                    results.ticket_comments.push(result);
                }
                break;
            }
        }
    }

    return results;
} 