import { z } from 'zod';
import type { DB } from '../../db/types';
import type { Selectable } from 'kysely';
import { MacroSchema } from '../../types/macros';

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

export const ProfileOrganizationMemberSchema = z.object({
    id: z.string().uuid(),
    profile_id: z.string().uuid(),
    organization_id: z.string().uuid(),
    role: z.string().nullable(),
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

// Ticket Tag Schemas
export const TicketTagKeySchema = z.object({
    id: z.string().uuid(),
    organization_id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable(),
    tag_type: z.enum(['date', 'number', 'text', 'enum']),
});

export const TicketTagDateValueSchema = z.object({
    id: z.string().uuid(),
    ticket_id: z.string().uuid(),
    tag_key_id: z.string().uuid(),
    value: z.string(),
});

export const TicketTagNumberValueSchema = z.object({
    id: z.string().uuid(),
    ticket_id: z.string().uuid(),
    tag_key_id: z.string().uuid(),
    value: z.coerce.string(),
});

export const TicketTagTextValueSchema = z.object({
    id: z.string().uuid(),
    ticket_id: z.string().uuid(),
    tag_key_id: z.string().uuid(),
    value: z.string(),
});

// Add new schemas for enum tags
export const TicketTagEnumOptionSchema = z.object({
    id: z.string().uuid(),
    tag_key_id: z.string().uuid(),
    value: z.string(),
    description: z.string().nullable(),
});

export const TicketTagEnumValueSchema = z.object({
    id: z.string().uuid(),
    ticket_id: z.string().uuid(),
    tag_key_id: z.string().uuid(),
    enum_option_id: z.string().uuid(),
});

export const TicketDraftSchema = z.object({
    id: z.string().uuid(),
    title: z.string(),
    description: z.string().nullable(),
    status: z.string(),
    priority: z.string(),
    draft_status: z.enum(['unreviewed', 'partially_accepted', 'accepted', 'rejected']),
    created_by: z.string().uuid(),
    assigned_to: z.string().uuid().nullable(),
    organization_id: z.string().uuid(),
    original_ticket_id: z.string().uuid().nullable(),
    parent_draft_id: z.string().uuid().nullable(),
    latency: z.number(),
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

    // Ticket Tag Key operations
    z.object({
        operation: z.literal('create_ticket_tag_key'),
        data: TicketTagKeySchema
    }),
    z.object({
        operation: z.literal('update_ticket_tag_key'),
        data: TicketTagKeySchema
    }),
    z.object({
        operation: z.literal('delete_ticket_tag_key'),
        data: z.object({ id: z.string().uuid() })
    }),

    // Tag Value operations
    z.object({
        operation: z.literal('create_ticket_tag_date_value'),
        data: TicketTagDateValueSchema
    }),
    z.object({
        operation: z.literal('update_ticket_tag_date_value'),
        data: TicketTagDateValueSchema
    }),
    z.object({
        operation: z.literal('delete_ticket_tag_date_value'),
        data: z.object({ id: z.string().uuid() })
    }),
    z.object({
        operation: z.literal('create_ticket_tag_number_value'),
        data: TicketTagNumberValueSchema
    }),
    z.object({
        operation: z.literal('update_ticket_tag_number_value'),
        data: TicketTagNumberValueSchema
    }),
    z.object({
        operation: z.literal('delete_ticket_tag_number_value'),
        data: z.object({ id: z.string().uuid() })
    }),
    z.object({
        operation: z.literal('create_ticket_tag_text_value'),
        data: TicketTagTextValueSchema
    }),
    z.object({
        operation: z.literal('update_ticket_tag_text_value'),
        data: TicketTagTextValueSchema
    }),
    z.object({
        operation: z.literal('delete_ticket_tag_text_value'),
        data: z.object({ id: z.string().uuid() })
    }),
    z.object({
        operation: z.literal('create_ticket_tag_enum_option'),
        data: TicketTagEnumOptionSchema
    }),
    z.object({
        operation: z.literal('update_ticket_tag_enum_option'),
        data: TicketTagEnumOptionSchema
    }),
    z.object({
        operation: z.literal('delete_ticket_tag_enum_option'),
        data: z.object({ id: z.string().uuid() })
    }),
    z.object({
        operation: z.literal('create_ticket_tag_enum_value'),
        data: TicketTagEnumValueSchema
    }),
    z.object({
        operation: z.literal('update_ticket_tag_enum_value'),
        data: TicketTagEnumValueSchema
    }),
    z.object({
        operation: z.literal('delete_ticket_tag_enum_value'),
        data: z.object({ id: z.string().uuid() })
    }),

    // Macro operations
    z.object({
        operation: z.literal('create_macro'),
        data: MacroSchema
    }),
    z.object({
        operation: z.literal('update_macro'),
        data: MacroSchema
    }),
    z.object({
        operation: z.literal('delete_macro'),
        data: z.object({ id: z.string().uuid() })
    }),

    // Ticket Draft operations
    z.object({
        operation: z.literal('create_ticket_draft'),
        data: TicketDraftSchema
    }),
    z.object({
        operation: z.literal('update_ticket_draft'),
        data: TicketDraftSchema
    }),
    z.object({
        operation: z.literal('delete_ticket_draft'),
        data: z.object({ id: z.string().uuid() })
    }),

    // Macro Chain operations
    z.object({
        operation: z.literal('create_macro_chain'),
        data: z.object({
            id: z.string().uuid(),
            parent_macro_id: z.string().uuid(),
            child_macro_id: z.string().uuid(),
        }),
    }),
    z.object({
        operation: z.literal('update_macro_chain'),
        data: z.object({
            id: z.string().uuid(),
            parent_macro_id: z.string().uuid(),
            child_macro_id: z.string().uuid(),
        }),
    }),
    z.object({
        operation: z.literal('delete_macro_chain'),
        data: z.object({
            id: z.string().uuid(),
        }),
    }),
]);

export const SyncInputSchema = z.array(SyncOperationSchema);

export type SyncInput = z.infer<typeof SyncInputSchema>;
export type TableRow<T extends TableName> = Selectable<DB[T]>;
export type TableName = keyof Pick<DB,
    'profiles' |
    'organizations' |
    'profile_organization_members' |
    'tickets' |
    'ticket_comments' |
    'organization_invitations' |
    'ticket_tag_keys' |
    'ticket_tag_date_values' |
    'ticket_tag_number_values' |
    'ticket_tag_text_values' |
    'ticket_tag_enum_options' |
    'ticket_tag_enum_values' |
    'macros' |
    'ticket_drafts' |
    'macro_chains'
>;

