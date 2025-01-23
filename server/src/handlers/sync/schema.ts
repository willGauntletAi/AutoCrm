import { z } from 'zod';

// Define base schemas for each table
export const ProfileSchema = z.object({
    id: z.string().uuid(),
    full_name: z.string().nullable(),
    avatar_url: z.string().nullable(),
});

export const OrganizationSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
});

export const OrganizationUpdateSchema = OrganizationSchema.extend({
    id: z.string().uuid(),
});

export const ProfileOrganizationMemberSchema = z.object({
    id: z.string().uuid(),
    profile_id: z.string().uuid(),
    organization_id: z.string().uuid(),
    role: z.string().nullable(),
});

export const ProfileOrganizationMemberUpdateSchema = ProfileOrganizationMemberSchema.extend({
    id: z.string(),
});

export const TicketSchema = z.object({
    id: z.string().uuid(),
    title: z.string(),
    description: z.string().nullable(),
    status: z.string(),
    priority: z.string(),
    created_by: z.string().uuid(),
    assigned_to: z.string().uuid().nullable(),
    organization_id: z.string().uuid(),
});

export const TicketCommentSchema = z.object({
    id: z.string().uuid(),
    ticket_id: z.string().uuid(),
    user_id: z.string().uuid(),
    comment: z.string(),
});

export const OrganizationInvitationSchema = z.object({
    id: z.string().uuid(),
    organization_id: z.string().uuid(),
    email: z.string(),
    role: z.string(),
});

// Define the sync operation schema using a discriminated union
export const SyncOperationSchema = z.discriminatedUnion('operation', [
    // Profile operations
    z.object({
        operation: z.literal('create_profile'),
        data: ProfileSchema
    }),
    z.object({
        operation: z.literal('update_profile'),
        data: ProfileSchema
    }),

    // Organization operations
    z.object({
        operation: z.literal('create_organization'),
        data: OrganizationSchema
    }),
    z.object({
        operation: z.literal('update_organization'),
        data: OrganizationSchema
    }),
    z.object({
        operation: z.literal('delete_organization'),
        data: z.object({ id: z.string().uuid() })
    }),

    // Profile Organization Member operations
    z.object({
        operation: z.literal('create_profile_organization_member'),
        data: ProfileOrganizationMemberSchema
    }),
    z.object({
        operation: z.literal('update_profile_organization_member'),
        data: ProfileOrganizationMemberSchema
    }),
    z.object({
        operation: z.literal('delete_profile_organization_member'),
        data: z.object({ id: z.string().uuid() })
    }),

    // Ticket operations
    z.object({
        operation: z.literal('create_ticket'),
        data: TicketSchema
    }),
    z.object({
        operation: z.literal('update_ticket'),
        data: TicketSchema
    }),
    z.object({
        operation: z.literal('delete_ticket'),
        data: z.object({ id: z.string().uuid() })
    }),

    // Ticket Comment operations
    z.object({
        operation: z.literal('create_ticket_comment'),
        data: TicketCommentSchema
    }),
    z.object({
        operation: z.literal('delete_ticket_comment'),
        data: z.object({ id: z.string().uuid() })
    }),

    // Organization Invitation operations
    z.object({
        operation: z.literal('create_organization_invitation'),
        data: OrganizationInvitationSchema
    }),
    z.object({
        operation: z.literal('update_organization_invitation'),
        data: OrganizationInvitationSchema
    }),
    z.object({
        operation: z.literal('delete_organization_invitation'),
        data: z.object({ id: z.string().uuid() })
    }),
    z.object({
        operation: z.literal('accept_invitation'),
        data: z.object({
            invitation_id: z.string().uuid(),
        })
    }),
]);

export const SyncInputSchema = z.array(SyncOperationSchema);

export type SyncInput = z.infer<typeof SyncInputSchema>; 