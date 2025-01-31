import { db } from '../../db';
import { SyncInputSchema, TableRow } from './schema';
import { z } from 'zod';
import { AuthUser } from '../../utils/auth';
import { createTextTagValue, deleteTextTagValue, updateTextTagValue } from './textTagValue';
import { createNumberTagValue, deleteNumberTagValue, updateNumberTagValue } from './numberTagValue';
import { createDateTagValue, deleteDateTagValue, updateDateTagValue } from './dateTagValue';
import { createEnumTagValue, deleteEnumTagValue, updateEnumTagValue } from './enumTagValue';
import { createEnumTagOption, deleteEnumTagOption, updateEnumTagOption } from './enumTagOption';
import { createMacro, deleteMacro, updateMacro } from './macros';
import { updateTicketDraft } from './ticketDraft';
import { createMacroChain, deleteMacroChain, updateMacroChain } from './macroChain';
import { MacroSchema } from '../../types/macros';

interface Context {
    user: AuthUser,
}

interface SyncParams {
    data: z.infer<typeof SyncInputSchema>;
    ctx: Context;
}

export type MacroRow = Omit<TableRow<'macros'>, 'macro'> & {
    macro: z.infer<typeof MacroSchema.shape.macro>;
};

interface SyncResponse {
    profiles?: TableRow<'profiles'>[];
    organizations?: TableRow<'organizations'>[];
    profile_organization_members?: TableRow<'profile_organization_members'>[];
    tickets?: TableRow<'tickets'>[];
    ticket_comments?: TableRow<'ticket_comments'>[];
    organization_invitations?: TableRow<'organization_invitations'>[];
    ticket_tag_keys?: TableRow<'ticket_tag_keys'>[];
    ticket_tag_date_values?: TableRow<'ticket_tag_date_values'>[];
    ticket_tag_number_values?: TableRow<'ticket_tag_number_values'>[];
    ticket_tag_text_values?: TableRow<'ticket_tag_text_values'>[];
    ticket_tag_enum_options?: TableRow<'ticket_tag_enum_options'>[];
    ticket_tag_enum_values?: TableRow<'ticket_tag_enum_values'>[];
    macros?: MacroRow[];
    ticket_drafts?: TableRow<'ticket_drafts'>[];
    macro_chains?: TableRow<'macro_chains'>[];
}

// Profile operations
async function createProfile(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'create_profile' }, userId: string): Promise<TableRow<'profiles'> | null> {
    // Users can only create their own profile
    if (data.data.id !== userId) {
        return null;
    }

    try {
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
    } catch (error) {
        if (error instanceof Error && error.message.includes('duplicate key')) {
            // If it's a unique constraint violation, try to get the existing record
            const existing = await db.selectFrom('profiles')
                .selectAll()
                .where('id', '=', data.data.id)
                .executeTakeFirst();

            if (existing) {
                return existing;
            }
        }
        // For any other error or if we couldn't find the record, return as if created but deleted
        const now = new Date();
        return {
            id: data.data.id,
            full_name: data.data.full_name,
            avatar_url: data.data.avatar_url,
            created_at: now,
            updated_at: now,
            deleted_at: now,
        };
    }
}

async function updateProfile(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'update_profile' }, userId: string): Promise<TableRow<'profiles'> | null> {
    // Users can only update their own profile
    if (data.data.id !== userId) {
        return null;
    }

    try {
        const updated = await db.updateTable('profiles')
            .set({
                ...data.data,
                updated_at: new Date().toISOString(),
            })
            .where('id', '=', data.data.id)
            .returningAll()
            .executeTakeFirst();

        if (updated) {
            return updated;
        }
    } catch (error) {
        // Fall through to return unchanged value
    }

    // On error or if record not found, return the unchanged value
    const existing = await db.selectFrom('profiles')
        .selectAll()
        .where('id', '=', data.data.id)
        .executeTakeFirst();
    return existing ?? null;
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
        if (error instanceof Error && error.message.includes('duplicate key')) {
            // If it's a unique constraint violation, try to get the existing record
            const existing = await db.selectFrom('organizations')
                .selectAll()
                .where('id', '=', data.data.id)
                .executeTakeFirst();

            if (existing) {
                return existing;
            }
        }
        // For any other error or if we couldn't find the record, return as if created but deleted
        const now = new Date();
        return {
            id: data.data.id,
            name: data.data.name,
            created_at: now,
            updated_at: now,
            deleted_at: now,
        };
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

    try {
        const updated = await db.updateTable('organizations')
            .set({
                id: data.data.id,
                name: data.data.name,
                updated_at: new Date().toISOString(),
            })
            .where('id', '=', data.data.id)
            .returningAll()
            .executeTakeFirst();

        if (updated) {
            return updated;
        }
    } catch (error) {
        // Fall through to return unchanged value
    }

    return existingOrg;
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

    try {
        const updated = await db.updateTable('organizations')
            .set({
                deleted_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .where('id', '=', data.data.id)
            .returningAll()
            .executeTakeFirst();

        if (updated) {
            return updated;
        }
    } catch (error) {
        // Fall through to return unchanged value
    }

    return existingOrg;
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

    try {
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
    } catch (error) {
        if (error instanceof Error && error.message.includes('duplicate key')) {
            // If it's a unique constraint violation, try to get the existing record
            const existing = await db.selectFrom('profile_organization_members')
                .selectAll()
                .where('id', '=', data.data.id)
                .executeTakeFirst();

            if (existing) {
                return existing;
            }
        }
        // For any other error or if we couldn't find the record, return as if created but deleted
        const now = new Date();
        return {
            id: data.data.id,
            profile_id: data.data.profile_id,
            organization_id: data.data.organization_id,
            role: data.data.role,
            created_at: now,
            updated_at: now,
            deleted_at: now,
        };
    }
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

    try {
        const updated = await db.updateTable('profile_organization_members')
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
            .executeTakeFirst();

        if (updated) {
            return updated;
        }
    } catch (error) {
        // Fall through to return unchanged value
    }

    return existingMember;
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

    try {
        const updated = await db.updateTable('profile_organization_members')
            .set({
                deleted_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .where('id', '=', data.data.id)
            .returningAll()
            .executeTakeFirst();

        if (updated) {
            return updated;
        }
    } catch (error) {
        // Fall through to return unchanged value
    }

    return existingMember;
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
        if (error instanceof Error && error.message.includes('duplicate key')) {
            // If it's a unique constraint violation, try to get the existing record
            const existing = await db.selectFrom('tickets')
                .selectAll()
                .where('id', '=', data.data.id)
                .executeTakeFirst();

            if (existing) {
                return existing;
            }
        }
        // For any other error or if we couldn't find the record, return as if created but deleted
        const now = new Date();
        return {
            id: data.data.id,
            title: data.data.title,
            description: data.data.description,
            status: data.data.status,
            priority: data.data.priority,
            created_by: data.data.created_by,
            assigned_to: data.data.assigned_to,
            organization_id: data.data.organization_id,
            created_at: now,
            updated_at: now,
            deleted_at: now,
        };
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

    try {
        const updated = await db.updateTable('tickets')
            .set({
                ...data.data,
                // Preserve the organization_id and created_by
                organization_id: existingTicket.organization_id,
                created_by: existingTicket.created_by,
                updated_at: new Date().toISOString(),
            })
            .where('id', '=', data.data.id)
            .returningAll()
            .executeTakeFirst();

        if (updated) {
            return updated;
        }
    } catch (error) {
        // Fall through to return unchanged value
    }

    return existingTicket;
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

    try {
        const updated = await db.updateTable('tickets')
            .set({
                deleted_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .where('id', '=', data.data.id)
            .returningAll()
            .executeTakeFirst();

        if (updated) {
            return updated;
        }
    } catch (error) {
        // Fall through to return unchanged value
    }

    return existingTicket;
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
        if (error instanceof Error && error.message.includes('duplicate key')) {
            // If it's a unique constraint violation, try to get the existing record
            const existing = await db.selectFrom('ticket_comments')
                .selectAll()
                .where('id', '=', data.data.id)
                .executeTakeFirst();

            if (existing) {
                return existing;
            }
        }
        // For any other error or if we couldn't find the record, return as if created but deleted
        const now = new Date();
        return {
            id: data.data.id,
            ticket_id: data.data.ticket_id,
            user_id: data.data.user_id,
            comment: data.data.comment,
            created_at: now,
            updated_at: now,
            deleted_at: now,
        };
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

    try {
        const updated = await db.updateTable('ticket_comments')
            .set({
                deleted_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .where('id', '=', data.data.id)
            .returningAll()
            .executeTakeFirst();

        if (updated) {
            return updated;
        }
    } catch (error) {
        // Fall through to return unchanged value
    }

    return existingComment;
}

// Organization Invitation operations
async function createOrganizationInvitation(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'create_organization_invitation' }, memberships: Record<string, string>): Promise<TableRow<'organization_invitations'> | null> {
    // Check if user is an admin of the organization
    if (memberships[data.data.organization_id] !== 'admin') {
        return null;
    }

    try {
        return await db.insertInto('organization_invitations')
            .values({
                id: data.data.id,
                organization_id: data.data.organization_id,
                email: data.data.email,
                role: data.data.role,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .returningAll()
            .executeTakeFirstOrThrow();
    } catch (error) {
        if (error instanceof Error && error.message.includes('duplicate key')) {
            // If it's a unique constraint violation, try to get the existing record
            const existing = await db.selectFrom('organization_invitations')
                .selectAll()
                .where('id', '=', data.data.id)
                .executeTakeFirst();

            if (existing) {
                return existing;
            }
        }
        // For any other error or if we couldn't find the record, return as if created but deleted
        const now = new Date();
        return {
            id: data.data.id,
            organization_id: data.data.organization_id,
            email: data.data.email,
            role: data.data.role,
            created_at: now,
            updated_at: now,
            deleted_at: now,
        };
    }
}

async function updateOrganizationInvitation(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'update_organization_invitation' }, memberships: Record<string, string>): Promise<TableRow<'organization_invitations'> | null> {
    // First check if invitation exists
    const existingInvitation = await db.selectFrom('organization_invitations')
        .selectAll()
        .where('id', '=', data.data.id)
        .executeTakeFirst();

    // Check read permissions
    if (!existingInvitation || !memberships[existingInvitation.organization_id]) {
        return null;
    }

    // If deleted, return as-is
    if (existingInvitation.deleted_at) {
        return existingInvitation;
    }

    // Check write permissions
    if (memberships[existingInvitation.organization_id] !== 'admin') {
        return null;
    }

    try {
        const updated = await db.updateTable('organization_invitations')
            .set({
                ...data.data,
                // Preserve the organization_id
                organization_id: existingInvitation.organization_id,
                updated_at: new Date().toISOString(),
            })
            .where('id', '=', data.data.id)
            .returningAll()
            .executeTakeFirst();

        if (updated) {
            return updated;
        }
    } catch (error) {
        // Fall through to return unchanged value
    }

    return existingInvitation;
}

async function deleteOrganizationInvitation(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'delete_organization_invitation' }, memberships: Record<string, string>): Promise<TableRow<'organization_invitations'> | null> {
    // First check if invitation exists
    const existingInvitation = await db.selectFrom('organization_invitations')
        .selectAll()
        .where('id', '=', data.data.id)
        .executeTakeFirst();

    // Check read permissions
    if (!existingInvitation || !memberships[existingInvitation.organization_id]) {
        return null;
    }

    // If deleted, return as-is
    if (existingInvitation.deleted_at) {
        return existingInvitation;
    }

    // Check delete permissions
    if (memberships[existingInvitation.organization_id] !== 'admin') {
        return null;
    }

    try {
        const updated = await db.updateTable('organization_invitations')
            .set({
                deleted_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .where('id', '=', data.data.id)
            .returningAll()
            .executeTakeFirst();

        if (updated) {
            return updated;
        }
    } catch (error) {
        // Fall through to return unchanged value
    }

    return existingInvitation;
}

// Ticket Tag Key operations
async function createTicketTagKey(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'create_ticket_tag_key' }, memberships: Record<string, string>): Promise<TableRow<'ticket_tag_keys'> | null> {
    // Check if user is an admin of the organization
    if (memberships[data.data.organization_id] !== 'admin') {
        return {
            id: data.data.id,
            organization_id: data.data.organization_id,
            name: data.data.name,
            description: data.data.description,
            tag_type: data.data.tag_type,
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: new Date(),
        };
    }

    try {
        return await db.insertInto('ticket_tag_keys')
            .values({
                id: data.data.id,
                organization_id: data.data.organization_id,
                name: data.data.name,
                description: data.data.description,
                tag_type: data.data.tag_type,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .returningAll()
            .executeTakeFirstOrThrow();
    } catch (error) {
        if (error instanceof Error && error.message.includes('duplicate key')) {
            const existing = await db.selectFrom('ticket_tag_keys')
                .selectAll()
                .where('id', '=', data.data.id)
                .executeTakeFirst();

            if (existing) {
                return existing;
            }
        }
        const now = new Date();
        return {
            id: data.data.id,
            organization_id: data.data.organization_id,
            name: data.data.name,
            description: data.data.description,
            tag_type: data.data.tag_type,
            created_at: now,
            updated_at: now,
            deleted_at: now,
        };
    }
}

async function updateTicketTagKey(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'update_ticket_tag_key' }, memberships: Record<string, string>): Promise<TableRow<'ticket_tag_keys'> | null> {
    const existingKey = await db.selectFrom('ticket_tag_keys')
        .selectAll()
        .where('id', '=', data.data.id)
        .executeTakeFirst();

    if (!existingKey || !memberships[existingKey.organization_id]) {
        return null;
    }

    if (existingKey.deleted_at) {
        return existingKey;
    }

    if (memberships[existingKey.organization_id] !== 'admin') {
        return null;
    }

    try {
        const updated = await db.updateTable('ticket_tag_keys')
            .set({
                ...data.data,
                organization_id: existingKey.organization_id,
                updated_at: new Date().toISOString(),
            })
            .where('id', '=', data.data.id)
            .returningAll()
            .executeTakeFirst();

        if (updated) {
            return updated;
        }
    } catch (error) {
        // Fall through to return unchanged value
    }

    return existingKey;
}

async function deleteTicketTagKey(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'delete_ticket_tag_key' }, memberships: Record<string, string>): Promise<TableRow<'ticket_tag_keys'> | null> {
    const existingKey = await db.selectFrom('ticket_tag_keys')
        .selectAll()
        .where('id', '=', data.data.id)
        .executeTakeFirst();

    if (!existingKey || !memberships[existingKey.organization_id]) {
        return null;
    }

    if (existingKey.deleted_at) {
        return existingKey;
    }

    if (memberships[existingKey.organization_id] !== 'admin') {
        return null;
    }

    try {
        const updated = await db.updateTable('ticket_tag_keys')
            .set({
                deleted_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .where('id', '=', data.data.id)
            .returningAll()
            .executeTakeFirst();

        if (updated) {
            return updated;
        }
    } catch (error) {
        // Fall through to return unchanged value
    }

    return existingKey;
}

// Tag Value operations

export async function sync({ data: operations, ctx }: SyncParams): Promise<SyncResponse> {
    const response: SyncResponse = {};
    const userId = ctx.user.id;

    // Get user's organization memberships
    const memberships = ctx.user.organizations;

    for (const operation of operations) {
        switch (operation.operation) {
            // Profile operations
            case 'create_profile': {
                const result = await createProfile(operation, userId);
                if (result) {
                    if (!response.profiles) response.profiles = [];
                    response.profiles.push(result);
                }
                break;
            }
            case 'update_profile': {
                const result = await updateProfile(operation, userId);
                if (result) {
                    if (!response.profiles) response.profiles = [];
                    response.profiles.push(result);
                }
                break;
            }

            // Organization operations
            case 'create_organization': {
                const result = await createOrganization(operation);
                if (result) {
                    if (!response.organizations) response.organizations = [];
                    response.organizations.push(result);
                }
                break;
            }
            case 'update_organization': {
                const result = await updateOrganization(operation, ctx.user.organizations);
                if (result) {
                    if (!response.organizations) response.organizations = [];
                    response.organizations.push(result);
                }
                break;
            }
            case 'delete_organization': {
                const result = await deleteOrganization(operation, ctx.user.organizations);
                if (result) {
                    if (!response.organizations) response.organizations = [];
                    response.organizations.push(result);
                }
                break;
            }

            // Profile Organization Member operations
            case 'create_profile_organization_member': {
                const result = await createProfileOrganizationMember(operation, ctx.user.organizations);
                if (result) {
                    if (!response.profile_organization_members) response.profile_organization_members = [];
                    response.profile_organization_members.push(result);
                }
                break;
            }
            case 'update_profile_organization_member': {
                const result = await updateProfileOrganizationMember(operation, ctx.user.organizations);
                if (result) {
                    if (!response.profile_organization_members) response.profile_organization_members = [];
                    response.profile_organization_members.push(result);
                }
                break;
            }
            case 'delete_profile_organization_member': {
                const result = await deleteProfileOrganizationMember(operation, ctx.user.organizations);
                if (result) {
                    if (!response.profile_organization_members) response.profile_organization_members = [];
                    response.profile_organization_members.push(result);
                }
                break;
            }

            // Ticket operations
            case 'create_ticket': {
                const result = await createTicket(operation, ctx.user.organizations);
                if (result) {
                    if (!response.tickets) response.tickets = [];
                    response.tickets.push(result);
                }
                break;
            }
            case 'update_ticket': {
                const result = await updateTicket(operation, ctx.user.organizations, userId);
                if (result) {
                    if (!response.tickets) response.tickets = [];
                    response.tickets.push(result);
                }
                break;
            }
            case 'delete_ticket': {
                const result = await deleteTicket(operation, ctx.user.organizations, userId);
                if (result) {
                    if (!response.tickets) response.tickets = [];
                    response.tickets.push(result);
                }
                break;
            }

            // Ticket Comment operations
            case 'create_ticket_comment': {
                const result = await createTicketComment(operation, ctx.user.organizations);
                if (result) {
                    if (!response.ticket_comments) response.ticket_comments = [];
                    response.ticket_comments.push(result);
                }
                break;
            }
            case 'delete_ticket_comment': {
                const result = await deleteTicketComment(operation, userId);
                if (result) {
                    if (!response.ticket_comments) response.ticket_comments = [];
                    response.ticket_comments.push(result);
                }
                break;
            }

            // Organization Invitation operations
            case 'create_organization_invitation': {
                const result = await createOrganizationInvitation(operation, ctx.user.organizations);
                if (result) {
                    if (!response.organization_invitations) response.organization_invitations = [];
                    response.organization_invitations.push(result);
                }
                break;
            }
            case 'update_organization_invitation': {
                const result = await updateOrganizationInvitation(operation, ctx.user.organizations);
                if (result) {
                    if (!response.organization_invitations) response.organization_invitations = [];
                    response.organization_invitations.push(result);
                }
                break;
            }
            case 'delete_organization_invitation': {
                const result = await deleteOrganizationInvitation(operation, ctx.user.organizations);
                if (result) {
                    if (!response.organization_invitations) response.organization_invitations = [];
                    response.organization_invitations.push(result);
                }
                break;
            }

            // Ticket Tag Key operations
            case 'create_ticket_tag_key': {
                const result = await createTicketTagKey(operation, ctx.user.organizations);
                if (result) {
                    if (!response.ticket_tag_keys) response.ticket_tag_keys = [];
                    response.ticket_tag_keys.push(result);
                }
                break;
            }
            case 'update_ticket_tag_key': {
                const result = await updateTicketTagKey(operation, ctx.user.organizations);
                if (result) {
                    if (!response.ticket_tag_keys) response.ticket_tag_keys = [];
                    response.ticket_tag_keys.push(result);
                }
                break;
            }
            case 'delete_ticket_tag_key': {
                const result = await deleteTicketTagKey(operation, ctx.user.organizations);
                if (result) {
                    if (!response.ticket_tag_keys) response.ticket_tag_keys = [];
                    response.ticket_tag_keys.push(result);
                }
                break;
            }

            // Tag Value operations

            case 'create_ticket_tag_date_value': {
                const result = await createDateTagValue(operation, ctx.user.organizations);
                if (result) {
                    if (!response.ticket_tag_date_values) response.ticket_tag_date_values = [];
                    response.ticket_tag_date_values.push(result);
                }
                break;
            }
            case 'update_ticket_tag_date_value': {
                const result = await updateDateTagValue(operation, ctx.user.organizations);
                if (result) {
                    if (!response.ticket_tag_date_values) response.ticket_tag_date_values = [];
                    response.ticket_tag_date_values.push(result);
                }
                break;
            }
            case 'delete_ticket_tag_date_value': {
                const result = await deleteDateTagValue(operation, ctx.user.organizations);
                if (result) {
                    if (!response.ticket_tag_date_values) response.ticket_tag_date_values = [];
                    response.ticket_tag_date_values.push(result);
                }
                break;
            }

            case 'create_ticket_tag_number_value': {
                const result = await createNumberTagValue(operation, ctx.user.organizations);
                if (result) {
                    if (!response.ticket_tag_number_values) response.ticket_tag_number_values = [];
                    response.ticket_tag_number_values.push(result);
                }
                break;
            }
            case 'update_ticket_tag_number_value': {
                const result = await updateNumberTagValue(operation, ctx.user.organizations);
                if (result) {
                    if (!response.ticket_tag_number_values) response.ticket_tag_number_values = [];
                    response.ticket_tag_number_values.push(result);
                }
                break;
            }
            case 'delete_ticket_tag_number_value': {
                const result = await deleteNumberTagValue(operation, ctx.user.organizations);
                if (result) {
                    if (!response.ticket_tag_number_values) response.ticket_tag_number_values = [];
                    response.ticket_tag_number_values.push(result);
                }
                break;
            }

            case 'create_ticket_tag_text_value': {
                const result = await createTextTagValue(operation, ctx.user.organizations);
                if (result) {
                    if (!response.ticket_tag_text_values) response.ticket_tag_text_values = [];
                    response.ticket_tag_text_values.push(result);
                }
                break;
            }
            case 'update_ticket_tag_text_value': {
                const result = await updateTextTagValue(operation, ctx.user.organizations);
                if (result) {
                    if (!response.ticket_tag_text_values) response.ticket_tag_text_values = [];
                    response.ticket_tag_text_values.push(result);
                }
                break;
            }
            case 'delete_ticket_tag_text_value': {
                const result = await deleteTextTagValue(operation, ctx.user.organizations);
                if (result) {
                    if (!response.ticket_tag_text_values) response.ticket_tag_text_values = [];
                    response.ticket_tag_text_values.push(result);
                }
                break;
            }

            case 'create_macro': {
                const result = await createMacro(operation, memberships);
                if (result) {
                    response.macros = response.macros || [];
                    response.macros.push(result);
                }
                break;
            }
            case 'update_macro': {
                const result = await updateMacro(operation, memberships);
                if (result) {
                    response.macros = response.macros || [];
                    response.macros.push(result);
                }
                break;
            }
            case 'delete_macro': {
                const result = await deleteMacro(operation, memberships);
                if (result) {
                    response.macros = response.macros || [];
                    response.macros.push(result);
                }
                break;
            }

            // Enum tag option operations
            case 'create_ticket_tag_enum_option': {
                const result = await createEnumTagOption(operation, memberships);
                if (result) {
                    response.ticket_tag_enum_options = response.ticket_tag_enum_options || [];
                    response.ticket_tag_enum_options.push(result);
                }
                break;
            }
            case 'update_ticket_tag_enum_option': {
                const result = await updateEnumTagOption(operation, memberships);
                if (result) {
                    response.ticket_tag_enum_options = response.ticket_tag_enum_options || [];
                    response.ticket_tag_enum_options.push(result);
                }
                break;
            }
            case 'delete_ticket_tag_enum_option': {
                const result = await deleteEnumTagOption(operation, memberships);
                if (result) {
                    response.ticket_tag_enum_options = response.ticket_tag_enum_options || [];
                    response.ticket_tag_enum_options.push(result);
                }
                break;
            }

            // Enum tag value operations
            case 'create_ticket_tag_enum_value': {
                const result = await createEnumTagValue(operation, memberships);
                if (result) {
                    response.ticket_tag_enum_values = response.ticket_tag_enum_values || [];
                    response.ticket_tag_enum_values.push(result);
                }
                break;
            }
            case 'update_ticket_tag_enum_value': {
                const result = await updateEnumTagValue(operation, memberships);
                if (result) {
                    response.ticket_tag_enum_values = response.ticket_tag_enum_values || [];
                    response.ticket_tag_enum_values.push(result);
                }
                break;
            }
            case 'delete_ticket_tag_enum_value': {
                const result = await deleteEnumTagValue(operation, memberships);
                if (result) {
                    response.ticket_tag_enum_values = response.ticket_tag_enum_values || [];
                    response.ticket_tag_enum_values.push(result);
                }
                break;
            }

            case 'update_ticket_draft': {
                const result = await updateTicketDraft(operation, memberships);
                if (result) {
                    response.ticket_drafts = response.ticket_drafts || [];
                    response.ticket_drafts.push(result);
                }
                break;
            }

            case 'create_macro_chain': {
                const result = await createMacroChain(operation, memberships);
                if (result) {
                    response.macro_chains = response.macro_chains || [];
                    response.macro_chains.push(result);
                }
                break;
            }
            case 'update_macro_chain': {
                const result = await updateMacroChain(operation, memberships);
                if (result) {
                    response.macro_chains = response.macro_chains || [];
                    response.macro_chains.push(result);
                }
                break;
            }
            case 'delete_macro_chain': {
                const result = await deleteMacroChain(operation, memberships);
                if (result) {
                    response.macro_chains = response.macro_chains || [];
                    response.macro_chains.push(result);
                }
                break;
            }
        }
    }

    console.log('Sync response:', response);
    return response;
} 