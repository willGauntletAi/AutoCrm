import Dexie, { type Table } from 'dexie';
import { z } from 'zod';
import {
    ProfileSchema as ServerProfileSchema,
    OrganizationSchema as ServerOrganizationSchema,
    ProfileOrganizationMemberSchema as ServerProfileOrganizationMemberSchema,
    TicketSchema as ServerTicketSchema,
    TicketCommentSchema as ServerTicketCommentSchema,
    OrganizationInvitationSchema as ServerOrganizationInvitationSchema,
    TicketTagKeySchema as ServerTicketTagKeySchema,
    TicketTagDateValueSchema as ServerTicketTagDateValueSchema,
    TicketTagNumberValueSchema as ServerTicketTagNumberValueSchema,
    TicketTagTextValueSchema as ServerTicketTagTextValueSchema,
    TicketTagEnumOptionSchema as ServerTicketTagEnumOptionSchema,
    TicketTagEnumValueSchema as ServerTicketTagEnumValueSchema,
    SyncOperationSchema,
} from '../../../server/src/handlers/sync/schema';
import { MacroSchema as ServerMacroSchema } from '../../../server/src/types/macros';

// Define timestamp fields that are specific to client-side storage
const TimestampFieldsSchema = z.object({
    created_at: z.string().nullable(),
    updated_at: z.string().nullable(),
    deleted_at: z.string().nullable(),
});

// Extend server schemas with timestamp fields
export const ProfileSchema = ServerProfileSchema.extend(TimestampFieldsSchema.shape);
export const OrganizationSchema = ServerOrganizationSchema.extend(TimestampFieldsSchema.shape);
export const ProfileOrganizationMemberSchema = ServerProfileOrganizationMemberSchema.extend(TimestampFieldsSchema.shape);
export const TicketSchema = ServerTicketSchema.extend(TimestampFieldsSchema.shape);
export const TicketCommentSchema = ServerTicketCommentSchema.extend(TimestampFieldsSchema.shape);
export const OrganizationInvitationSchema = ServerOrganizationInvitationSchema.extend(TimestampFieldsSchema.shape);
export const TicketTagKeySchema = ServerTicketTagKeySchema.extend(TimestampFieldsSchema.shape);
export const TicketTagDateValueSchema = ServerTicketTagDateValueSchema.extend(TimestampFieldsSchema.shape);
export const TicketTagNumberValueSchema = ServerTicketTagNumberValueSchema.extend(TimestampFieldsSchema.shape);
export const TicketTagTextValueSchema = ServerTicketTagTextValueSchema.extend(TimestampFieldsSchema.shape);
export const TicketTagEnumOptionSchema = ServerTicketTagEnumOptionSchema.extend(TimestampFieldsSchema.shape);
export const TicketTagEnumValueSchema = ServerTicketTagEnumValueSchema.extend(TimestampFieldsSchema.shape);
export const MacroSchema = ServerMacroSchema.extend(TimestampFieldsSchema.shape);

// Create a modified version of TicketTagNumberValueSchema with number value
export const TicketTagNumberValueWithNumberSchema = z.object({
    id: z.string().uuid(),
    ticket_id: z.string().uuid(),
    tag_key_id: z.string().uuid(),
    value: z.number(),
    created_at: z.string().nullable(),
    updated_at: z.string().nullable(),
    deleted_at: z.string().nullable(),
});
export const TicketTagDateValueWithDateSchema = z.object({
    id: z.string().uuid(),
    ticket_id: z.string().uuid(),
    tag_key_id: z.string().uuid(),
    value: z.date(),
    created_at: z.string().nullable(),
    updated_at: z.string().nullable(),
    deleted_at: z.string().nullable(),
});

export const SystemMetadataSchema = z.object({
    key: z.string(),
    value: z.string(),
});

// Define mutation types that match the sync operation schema
export const MutationOperationSchema = SyncOperationSchema;

export const MutationSchema = z.object({
    id: z.number().optional(),
    operation: MutationOperationSchema,
    timestamp: z.number(),
    synced: z.number(),
});

// Define draft-related schemas
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
    latency: z.number(),
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

// Generate types from schemas
export type Profile = z.infer<typeof ProfileSchema>;
export type Organization = z.infer<typeof OrganizationSchema>;
export type ProfileOrganizationMember = z.infer<typeof ProfileOrganizationMemberSchema>;
export type Ticket = z.infer<typeof TicketSchema>;
export type TicketComment = z.infer<typeof TicketCommentSchema>;
export type SystemMetadata = z.infer<typeof SystemMetadataSchema>;
export type Mutation = z.infer<typeof MutationSchema>;
export type OrganizationInvitation = z.infer<typeof OrganizationInvitationSchema>;
export type TicketTagKey = z.infer<typeof TicketTagKeySchema>;
export type TicketTagDateValueWithDate = z.infer<typeof TicketTagDateValueWithDateSchema>;
export type TicketTagDateValue = z.infer<typeof TicketTagDateValueSchema>;
export type TicketTagNumberValueWithNumber = z.infer<typeof TicketTagNumberValueWithNumberSchema>;
export type TicketTagNumberValue = z.infer<typeof TicketTagNumberValueSchema>;
export type TicketTagTextValue = z.infer<typeof TicketTagTextValueSchema>;
export type TicketTagEnumOption = z.infer<typeof TicketTagEnumOptionSchema>;
export type TicketTagEnumValue = z.infer<typeof TicketTagEnumValueSchema>;
export type Macro = z.infer<typeof MacroSchema>;

// Add draft-related types
export type TicketDraft = z.infer<typeof TicketDraftSchema>;
export type TicketDraftComment = z.infer<typeof TicketDraftCommentSchema>;
export type TicketDraftTagDateValue = z.infer<typeof TicketDraftTagDateValueSchema>;
export type TicketDraftTagNumberValue = z.infer<typeof TicketDraftTagNumberValueSchema>;
export type TicketDraftTagTextValue = z.infer<typeof TicketDraftTagTextValueSchema>;
export type TicketDraftTagEnumValue = z.infer<typeof TicketDraftTagEnumValueSchema>;

// Define database class
export class AutoCRMDatabase extends Dexie {
    profiles!: Table<Profile>;
    organizations!: Table<Organization>;
    profileOrganizationMembers!: Table<ProfileOrganizationMember>;
    tickets!: Table<Ticket>;
    ticketComments!: Table<TicketComment>;
    system!: Table<SystemMetadata>;
    mutations!: Table<Mutation>;
    organizationInvitations!: Table<OrganizationInvitation>;
    ticketTagKeys!: Table<TicketTagKey>;
    ticketTagDateValues!: Table<TicketTagDateValueWithDate>;
    ticketTagNumberValues!: Table<TicketTagNumberValueWithNumber>;
    ticketTagTextValues!: Table<TicketTagTextValue>;
    ticketTagEnumOptions!: Table<TicketTagEnumOption>;
    ticketTagEnumValues!: Table<TicketTagEnumValue>;
    macros!: Table<Macro>;

    // Add draft-related tables
    ticketDrafts!: Table<TicketDraft>;
    ticketDraftComments!: Table<TicketDraftComment>;
    ticketDraftTagDateValues!: Table<TicketDraftTagDateValue>;
    ticketDraftTagNumberValues!: Table<TicketDraftTagNumberValue>;
    ticketDraftTagTextValues!: Table<TicketDraftTagTextValue>;
    ticketDraftTagEnumValues!: Table<TicketDraftTagEnumValue>;

    constructor() {
        super('auto-crm');
        this.version(1).stores({
            profiles: '&id, full_name, created_at, updated_at',
            organizations: '&id, name, created_at, updated_at',
            profileOrganizationMembers: '&id, [organization_id+profile_id], profile_id, organization_id, created_at, updated_at',
            tickets: '&id, title, status, priority, created_by, assigned_to, organization_id, created_at, updated_at',
            ticketComments: '&id, ticket_id, user_id, created_at, updated_at',
            system: '&key',
            mutations: '++id, timestamp, synced',
            organizationInvitations: '&id, organization_id, email, created_at, updated_at',
            ticketTagKeys: '&id, organization_id, name, tag_type, created_at, updated_at',
            ticketTagDateValues: '&id, ticket_id, tag_key_id, value, created_at, updated_at',
            ticketTagNumberValues: '&id, ticket_id, tag_key_id, value, created_at, updated_at',
            ticketTagTextValues: '&id, ticket_id, tag_key_id, value, created_at, updated_at',
            ticketTagEnumOptions: '&id, tag_key_id, value, created_at, updated_at',
            ticketTagEnumValues: '&id, ticket_id, tag_key_id, enum_option_id, created_at, updated_at',
            macros: '&id, organization_id, created_at, updated_at',

            // Add indexes for draft-related tables
            ticketDrafts: '&id, title, status, priority, draft_status, created_by, created_by_macro, assigned_to, organization_id, original_ticket_id, parent_draft_id, latency, created_at, updated_at',
            ticketDraftComments: '&id, ticket_draft_id, user_id, created_at, updated_at',
            ticketDraftTagDateValues: '&id, ticket_draft_id, tag_key_id, value, created_at, updated_at',
            ticketDraftTagNumberValues: '&id, ticket_draft_id, tag_key_id, value, created_at, updated_at',
            ticketDraftTagTextValues: '&id, ticket_draft_id, tag_key_id, value, created_at, updated_at',
            ticketDraftTagEnumValues: '&id, ticket_draft_id, tag_key_id, enum_option_id, created_at, updated_at',
        });

        // Add hooks to validate data
        this.profiles.hook('creating', (_, obj) => {
            ProfileSchema.parse(obj);
        });
        this.profiles.hook('updating', (mods) => {
            ProfileSchema.partial().parse(mods);
        });

        this.organizations.hook('creating', (_, obj) => {
            OrganizationSchema.parse(obj);
        });
        this.organizations.hook('updating', (mods) => {
            OrganizationSchema.partial().parse(mods);
        });

        this.profileOrganizationMembers.hook('creating', (_, obj) => {
            ProfileOrganizationMemberSchema.parse(obj);
        });
        this.profileOrganizationMembers.hook('updating', (mods) => {
            ProfileOrganizationMemberSchema.partial().parse(mods);
        });

        this.tickets.hook('creating', (_, obj) => {
            TicketSchema.parse(obj);
        });
        this.tickets.hook('updating', (mods) => {
            TicketSchema.partial().parse(mods);
        });

        this.ticketComments.hook('creating', (_, obj) => {
            TicketCommentSchema.parse(obj);
        });
        this.ticketComments.hook('updating', (mods) => {
            TicketCommentSchema.partial().parse(mods);
        });

        this.system.hook('creating', (_, obj) => {
            SystemMetadataSchema.parse(obj);
        });
        this.system.hook('updating', (mods) => {
            SystemMetadataSchema.partial().parse(mods);
        });

        this.mutations.hook('creating', (_, obj) => {
            MutationSchema.parse(obj);
        });
        this.mutations.hook('updating', (mods) => {
            MutationSchema.partial().parse(mods);
        });

        this.organizationInvitations.hook('creating', (_, obj) => {
            OrganizationInvitationSchema.parse(obj);
        });
        this.organizationInvitations.hook('updating', (mods) => {
            OrganizationInvitationSchema.partial().parse(mods);
        });

        this.ticketTagKeys.hook('creating', (_, obj) => {
            TicketTagKeySchema.parse(obj);
        });
        this.ticketTagKeys.hook('updating', (mods) => {
            TicketTagKeySchema.partial().parse(mods);
        });

        this.ticketTagDateValues.hook('creating', (_, obj) => {
            TicketTagDateValueWithDateSchema.parse(obj);
        });
        this.ticketTagDateValues.hook('updating', (mods) => {
            TicketTagDateValueWithDateSchema.partial().parse(mods);
        });

        this.ticketTagNumberValues.hook('creating', (_, obj) => {
            TicketTagNumberValueWithNumberSchema.parse(obj);
        });
        this.ticketTagNumberValues.hook('updating', (mods) => {
            TicketTagNumberValueWithNumberSchema.partial().parse(mods);
        });

        this.ticketTagTextValues.hook('creating', (_, obj) => {
            TicketTagTextValueSchema.parse(obj);
        });
        this.ticketTagTextValues.hook('updating', (mods) => {
            TicketTagTextValueSchema.partial().parse(mods);
        });

        this.ticketTagEnumOptions.hook('creating', (_, obj) => {
            TicketTagEnumOptionSchema.parse(obj);
        });
        this.ticketTagEnumOptions.hook('updating', (mods) => {
            TicketTagEnumOptionSchema.partial().parse(mods);
        });

        this.ticketTagEnumValues.hook('creating', (_, obj) => {
            TicketTagEnumValueSchema.parse(obj);
        });
        this.ticketTagEnumValues.hook('updating', (mods) => {
            TicketTagEnumValueSchema.partial().parse(mods);
        });

        this.macros.hook('creating', (_, obj) => {
            MacroSchema.parse(obj);
        });
        this.macros.hook('updating', (mods) => {
            MacroSchema.partial().parse(mods);
        });

        // Add hooks for draft-related tables
        this.ticketDrafts.hook('creating', (_, obj) => {
            TicketDraftSchema.parse(obj);
        });
        this.ticketDrafts.hook('updating', (mods) => {
            TicketDraftSchema.partial().parse(mods);
        });

        this.ticketDraftComments.hook('creating', (_, obj) => {
            TicketDraftCommentSchema.parse(obj);
        });
        this.ticketDraftComments.hook('updating', (mods) => {
            TicketDraftCommentSchema.partial().parse(mods);
        });

        this.ticketDraftTagDateValues.hook('creating', (_, obj) => {
            TicketDraftTagDateValueSchema.parse(obj);
        });
        this.ticketDraftTagDateValues.hook('updating', (mods) => {
            TicketDraftTagDateValueSchema.partial().parse(mods);
        });

        this.ticketDraftTagNumberValues.hook('creating', (_, obj) => {
            TicketDraftTagNumberValueSchema.parse(obj);
        });
        this.ticketDraftTagNumberValues.hook('updating', (mods) => {
            TicketDraftTagNumberValueSchema.partial().parse(mods);
        });

        this.ticketDraftTagTextValues.hook('creating', (_, obj) => {
            TicketDraftTagTextValueSchema.parse(obj);
        });
        this.ticketDraftTagTextValues.hook('updating', (mods) => {
            TicketDraftTagTextValueSchema.partial().parse(mods);
        });

        this.ticketDraftTagEnumValues.hook('creating', (_, obj) => {
            TicketDraftTagEnumValueSchema.parse(obj);
        });
        this.ticketDraftTagEnumValues.hook('updating', (mods) => {
            TicketDraftTagEnumValueSchema.partial().parse(mods);
        });
    }
}

export const db = new AutoCRMDatabase(); 