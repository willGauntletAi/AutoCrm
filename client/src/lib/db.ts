import Dexie, { type Table } from 'dexie';
import { z } from 'zod';
import {
    ProfileSchema as ServerProfileSchema,
    OrganizationSchema as ServerOrganizationSchema,
    ProfileOrganizationMemberSchema as ServerProfileOrganizationMemberSchema,
    TicketSchema as ServerTicketSchema,
    TicketCommentSchema as ServerTicketCommentSchema,
    SyncOperationSchema,
} from '../../../server/src/handlers/sync/schema';

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

// Generate types from schemas
export type Profile = z.infer<typeof ProfileSchema>;
export type Organization = z.infer<typeof OrganizationSchema>;
export type ProfileOrganizationMember = z.infer<typeof ProfileOrganizationMemberSchema>;
export type Ticket = z.infer<typeof TicketSchema>;
export type TicketComment = z.infer<typeof TicketCommentSchema>;
export type SystemMetadata = z.infer<typeof SystemMetadataSchema>;
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
    }
}

export const db = new AutoCRMDatabase(); 