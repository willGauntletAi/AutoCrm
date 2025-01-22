import { z } from 'zod';

// Define base schemas for each table
export const ProfileSchema = z.object({
    id: z.string().uuid(),
    full_name: z.string().nullable(),
    avatar_url: z.string().nullable(),
});

export const OrganizationSchema = z.object({
    name: z.string(),
});

export const OrganizationUpdateSchema = OrganizationSchema.extend({
    id: z.string().uuid(),
});

export const ProfileOrganizationMemberSchema = z.object({
    profile_id: z.string().uuid(),
    organization_id: z.string().uuid(),
    role: z.string().nullable(),
});

export const ProfileOrganizationMemberUpdateSchema = ProfileOrganizationMemberSchema.extend({
    id: z.string(),
});

export const TicketCreateSchema = z.object({
    title: z.string(),
    description: z.string().nullable(),
    status: z.string(),
    priority: z.string(),
    created_by: z.string().uuid(),
    assigned_to: z.string().uuid().nullable(),
    organization_id: z.string().uuid(),
});

export const TicketUpdateSchema = z.object({
    id: z.string(),
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    assigned_to: z.string().uuid().nullable().optional(),
    organization_id: z.string().uuid().optional(),
});

export const TicketCommentCreateSchema = z.object({
    ticket_id: z.string(),
    user_id: z.string().uuid(),
    comment: z.string(),
});

export const TicketCommentUpdateSchema = TicketCommentCreateSchema.extend({
    id: z.string(),
});

export const SyncInputSchema = z.object({
    profiles: z.object({
        creates: z.array(ProfileSchema).optional(),
        updates: z.array(ProfileSchema.extend({ id: z.string().uuid() })).optional(),
    }).optional(),
    organizations: z.object({
        creates: z.array(OrganizationSchema).optional(),
        updates: z.array(OrganizationUpdateSchema).optional(),
        deletes: z.array(z.string().uuid()).optional(),
    }).optional(),
    profile_organization_members: z.object({
        creates: z.array(ProfileOrganizationMemberSchema).optional(),
        updates: z.array(ProfileOrganizationMemberUpdateSchema).optional(),
        deletes: z.array(z.string()).optional(),
    }).optional(),
    tickets: z.object({
        creates: z.array(TicketCreateSchema).optional(),
        updates: z.array(TicketUpdateSchema).optional(),
        deletes: z.array(z.string()).optional(),
    }).optional(),
    ticket_comments: z.object({
        creates: z.array(TicketCommentCreateSchema).optional(),
        deletes: z.array(z.string()).optional(),
    }).optional(),
});

export type SyncInput = z.infer<typeof SyncInputSchema>; 