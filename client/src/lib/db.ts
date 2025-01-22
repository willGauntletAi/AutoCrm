import Dexie, { type Table } from 'dexie';

// Define types for our database tables
export interface Profile {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    created_at?: string;
    updated_at?: string;
    deleted_at?: string;
}

export interface Organization {
    id: string;
    name: string;
    created_at?: string;
    updated_at?: string;
    deleted_at?: string;
}

export interface ProfileOrganizationMember {
    id: string;
    profile_id: string;
    organization_id: string;
    role: string | null;
    created_at?: string;
    updated_at?: string;
    deleted_at?: string;
}

export interface Ticket {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    created_by: string;
    assigned_to: string | null;
    organization_id: string;
    created_at?: string;
    updated_at?: string;
    deleted_at?: string;
}

export interface TicketComment {
    id: string;
    ticket_id: string;
    user_id: string;
    comment: string;
    created_at?: string;
    updated_at?: string;
    deleted_at?: string;
}

export interface SystemMetadata {
    key: string;
    value: string;
}

// Define mutation types that match our sync schema
export type MutationType = 'create' | 'update' | 'delete';

export interface Mutation {
    id: string;
    table: string;
    type: MutationType;
    record: unknown;
    timestamp: string;
    synced: number; // 0 = unsynced, 1 = synced
}

export class AutoCRMDatabase extends Dexie {
    profiles!: Table<Profile>;
    organizations!: Table<Organization>;
    profileOrganizationMembers!: Table<ProfileOrganizationMember>;
    tickets!: Table<Ticket>;
    ticketComments!: Table<TicketComment>;
    mutations!: Table<Mutation>;
    system!: Table<SystemMetadata>;

    constructor() {
        super('autoCRM');

        this.version(1).stores({
            profiles: '&id, full_name, created_at, updated_at',
            organizations: '&id, name, created_at, updated_at',
            profileOrganizationMembers: '&id, profile_id, organization_id, created_at, updated_at',
            tickets: '&id, title, status, priority, created_by, assigned_to, organization_id, created_at, updated_at',
            ticketComments: '&id, ticket_id, user_id, created_at, updated_at',
            mutations: '&id, table, type, timestamp, synced',
            system: 'key'
        });
    }
}

export const db = new AutoCRMDatabase(); 