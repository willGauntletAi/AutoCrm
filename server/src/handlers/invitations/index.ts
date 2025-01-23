import { z } from 'zod';
import { db } from '../../db';
import { TRPCError } from '@trpc/server';

export const acceptInvitationSchema = z.object({
    invitation_id: z.string().uuid(),
});

export async function acceptInvitation(input: z.infer<typeof acceptInvitationSchema>, userId: string) {
    // First get the invitation
    const invitation = await db
        .selectFrom('organization_invitations')
        .selectAll()
        .where('id', '=', input.invitation_id)
        .where('deleted_at', 'is', null)
        .executeTakeFirst();

    if (!invitation) {
        throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Invitation not found',
        });
    }

    // Verify the user's email matches the invitation
    const user = await db
        .selectFrom('auth.users')
        .select(['email'])
        .where('id', '=', userId)
        .executeTakeFirst();

    if (!user || user.email !== invitation.email) {
        throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You are not authorized to accept this invitation',
        });
    }

    // Create organization member
    await db
        .insertInto('profile_organization_members')
        .values({
            profile_id: userId,
            organization_id: invitation.organization_id,
            role: invitation.role,
        })
        .execute();

    // Delete the invitation
    await db
        .updateTable('organization_invitations')
        .set({ deleted_at: new Date().toISOString() })
        .where('id', '=', input.invitation_id)
        .execute();

    // Fetch organization data
    const organization = await db
        .selectFrom('organizations')
        .selectAll()
        .where('id', '=', invitation.organization_id)
        .where('deleted_at', 'is', null)
        .executeTakeFirst();

    if (!organization) {
        throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Organization not found',
        });
    }

    // Always fetch the user's own member record and profile
    const member = await db
        .selectFrom('profile_organization_members')
        .selectAll()
        .where('organization_id', '=', invitation.organization_id)
        .where('profile_id', '=', userId)
        .where('deleted_at', 'is', null)
        .executeTakeFirst();

    const profile = await db
        .selectFrom('profiles')
        .selectAll()
        .where('id', '=', userId)
        .where('deleted_at', 'is', null)
        .executeTakeFirst();

    if (invitation.role === 'customer') {
        // Customers only see their own tickets
        const tickets = await db
            .selectFrom('tickets')
            .selectAll()
            .where('organization_id', '=', invitation.organization_id)
            .where('created_by', '=', userId)
            .where('deleted_at', 'is', null)
            .execute();

        const ticketIds = tickets.map(ticket => ticket.id);
        const comments = ticketIds.length > 0 ? await db
            .selectFrom('ticket_comments')
            .selectAll()
            .where('ticket_id', 'in', ticketIds)
            .where('deleted_at', 'is', null)
            .execute()
            : [];

        return {
            success: true,
            organization,
            member,
            profile,
            tickets,
            comments,
        };
    } else {
        // Workers and admins see all organization data
        const members = await db
            .selectFrom('profile_organization_members')
            .selectAll()
            .where('organization_id', '=', invitation.organization_id)
            .where('deleted_at', 'is', null)
            .execute();

        const memberIds = members.map(m => m.profile_id);
        const profiles = await db
            .selectFrom('profiles')
            .selectAll()
            .where('id', 'in', memberIds)
            .where('deleted_at', 'is', null)
            .execute();

        const tickets = await db
            .selectFrom('tickets')
            .selectAll()
            .where('organization_id', '=', invitation.organization_id)
            .where('deleted_at', 'is', null)
            .execute();

        const ticketIds = tickets.map(ticket => ticket.id);
        const comments = ticketIds.length > 0 ? await db
            .selectFrom('ticket_comments')
            .selectAll()
            .where('ticket_id', 'in', ticketIds)
            .where('deleted_at', 'is', null)
            .execute()
            : [];

        const invitations = await db
            .selectFrom('organization_invitations')
            .selectAll()
            .where('organization_id', '=', invitation.organization_id)
            .where('deleted_at', 'is', null)
            .execute();

        return {
            success: true,
            organization,
            members,
            profiles,
            tickets,
            comments,
            invitations,
        };
    }
} 