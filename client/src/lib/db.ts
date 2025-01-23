import Dexie, { type Table } from 'dexie';
import { z } from 'zod';

// Define base schemas for each table
export const ProfileSchema = z.object({
    id: z.string().uuid(),
    full_name: z.string().nullable(),
    avatar_url: z.string().nullable(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    deleted_at: z.string().optional(),
});

export const OrganizationSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    deleted_at: z.string().optional(),
});

export const ProfileOrganizationMemberSchema = z.object({
    id: z.string().uuid(),
    profile_id: z.string().uuid(),
    organization_id: z.string().uuid(),
    role: z.string().nullable(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    deleted_at: z.string().optional(),
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
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    deleted_at: z.string().optional(),
});

export const TicketCommentSchema = z.object({
    id: z.string().uuid(),
    ticket_id: z.string().uuid(),
    user_id: z.string().uuid(),
    comment: z.string(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    deleted_at: z.string().optional(),
});

export const SystemMetadataSchema = z.object({
    key: z.string(),
    value: z.union([
        z.object({
            id: z.string().uuid(),
        }),
        z.string()
    ]),
});

// Define mutation types that match the sync operation schema
export const MutationOperationSchema = z.discriminatedUnion('operation', [
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
    })
]);

export const MutationSchema = z.object({
    id: z.number().optional(),
    operation: MutationOperationSchema,
    timestamp: z.number(),
    synced: z.number(),
});

// Generate types from schemas
export type SystemMetadata = z.infer<typeof SystemMetadataSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type Organization = z.infer<typeof OrganizationSchema>;
export type ProfileOrganizationMember = z.infer<typeof ProfileOrganizationMemberSchema>;
export type Ticket = z.infer<typeof TicketSchema>;
export type TicketComment = z.infer<typeof TicketCommentSchema>;
export type Mutation = z.infer<typeof MutationSchema>;

// Define database class
export class AutoCRMDatabase extends Dexie {
    profiles!: Table<Profile>;
    organizations!: Table<Organization>;
    profileOrganizationMembers!: Table<ProfileOrganizationMember>;
    tickets!: Table<Ticket>;
    ticketComments!: Table<TicketComment>;
    system!: Table<SystemMetadata>;
    mutations!: Table<Mutation>;

    constructor() {
        super('auto-crm');
        this.version(1).stores({
            profiles: '&id, full_name, created_at, updated_at',
            organizations: '&id, name, created_at, updated_at',
            profileOrganizationMembers: '&id, profile_id, organization_id, created_at, updated_at',
            tickets: '&id, title, status, priority, created_by, assigned_to, organization_id, created_at, updated_at',
            ticketComments: '&id, ticket_id, user_id, created_at, updated_at',
            system: '&key',
            mutations: '++id, timestamp, synced',
        });

        // Add hooks to validate data
        this.profiles.hook('creating', (_, obj) => {
            ProfileSchema.parse(obj);
            return obj;
        });
        this.profiles.hook('updating', (mods) => {
            ProfileSchema.partial().parse(mods);
            return mods;
        });

        this.organizations.hook('creating', (_, obj) => {
            OrganizationSchema.parse(obj);
            return obj;
        });
        this.organizations.hook('updating', (mods) => {
            OrganizationSchema.partial().parse(mods);
            return mods;
        });

        this.profileOrganizationMembers.hook('creating', (_, obj) => {
            ProfileOrganizationMemberSchema.parse(obj);
            return obj;
        });
        this.profileOrganizationMembers.hook('updating', (mods) => {
            ProfileOrganizationMemberSchema.partial().parse(mods);
            return mods;
        });

        this.tickets.hook('creating', (_, obj) => {
            TicketSchema.parse(obj);
            return obj;
        });
        this.tickets.hook('updating', (mods) => {
            TicketSchema.partial().parse(mods);
            return mods;
        });

        this.ticketComments.hook('creating', (_, obj) => {
            TicketCommentSchema.parse(obj);
            return obj;
        });
        this.ticketComments.hook('updating', (mods) => {
            TicketCommentSchema.partial().parse(mods);
            return mods;
        });

        this.system.hook('creating', (_, obj) => {
            SystemMetadataSchema.parse(obj);
            return obj;
        });
        this.system.hook('updating', (mods) => {
            SystemMetadataSchema.partial().parse(mods);
            return mods;
        });

        this.mutations.hook('creating', (_, obj) => {
            MutationSchema.parse(obj);
            return obj;
        });
        this.mutations.hook('updating', (mods) => {
            MutationSchema.partial().parse(mods);
            return mods;
        });
    }
}

export const db = new AutoCRMDatabase(); 