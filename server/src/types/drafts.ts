import { z } from 'zod';

export const TicketDraftSchema = z.object({
    id: z.string().uuid(),
    title: z.string(),
    description: z.string().nullable(),
    status: z.string(),
    priority: z.string(),
    draft_status: z.string(),
    created_by: z.string().uuid(),
    created_by_macro: z.string().uuid(),
    assigned_to: z.string().uuid().nullable(),
    organization_id: z.string().uuid(),
    original_ticket_id: z.string().uuid().nullable(),
    parent_draft_id: z.string().uuid().nullable(),
    latency: z.number().nullable(),
    created_at: z.string().nullable(),
    updated_at: z.string().nullable(),
    deleted_at: z.string().nullable(),
});

export const TicketDraftCommentSchema = z.object({
    id: z.string().uuid(),
    ticket_draft_id: z.string().uuid(),
    user_id: z.string().uuid(),
    comment: z.string(),
    created_at: z.string().nullable(),
    updated_at: z.string().nullable(),
    deleted_at: z.string().nullable(),
});

export const TicketDraftTagDateValueSchema = z.object({
    id: z.string().uuid(),
    ticket_draft_id: z.string().uuid(),
    tag_key_id: z.string().uuid(),
    value: z.date(),
    created_at: z.string().nullable(),
    updated_at: z.string().nullable(),
    deleted_at: z.string().nullable(),
});

export const TicketDraftTagNumberValueSchema = z.object({
    id: z.string().uuid(),
    ticket_draft_id: z.string().uuid(),
    tag_key_id: z.string().uuid(),
    value: z.number(),
    created_at: z.string().nullable(),
    updated_at: z.string().nullable(),
    deleted_at: z.string().nullable(),
});

export const TicketDraftTagTextValueSchema = z.object({
    id: z.string().uuid(),
    ticket_draft_id: z.string().uuid(),
    tag_key_id: z.string().uuid(),
    value: z.string(),
    created_at: z.string().nullable(),
    updated_at: z.string().nullable(),
    deleted_at: z.string().nullable(),
});

export const TicketDraftTagEnumValueSchema = z.object({
    id: z.string().uuid(),
    ticket_draft_id: z.string().uuid(),
    tag_key_id: z.string().uuid(),
    enum_option_id: z.string().uuid(),
    created_at: z.string().nullable(),
    updated_at: z.string().nullable(),
    deleted_at: z.string().nullable(),
}); 