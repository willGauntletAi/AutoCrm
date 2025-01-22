import { v4 as uuidv4 } from 'uuid';
import { db } from './db';
import type { MutationType, Mutation, Profile, Organization, ProfileOrganizationMember, Ticket, TicketComment } from './db';
import type { SyncInput } from '../../../server/src/handlers/sync/schema';
import { client } from './trpc';

type TableTypeMap = {
    profiles: Profile;
    organizations: Organization;
    profile_organization_members: ProfileOrganizationMember;
    tickets: Ticket;
    ticket_comments: TicketComment;
}

// Server response types that use null instead of undefined
type NullableToOptional<T> = {
    [P in keyof T]: T[P] extends null | infer U ? U | undefined : T[P];
};

interface ServerProfile extends Omit<Profile, 'created_at' | 'updated_at' | 'deleted_at'> {
    created_at: string | null;
    updated_at: string | null;
    deleted_at: string | null;
}

interface ServerOrganization extends Omit<Organization, 'created_at' | 'updated_at' | 'deleted_at'> {
    created_at: string | null;
    updated_at: string | null;
    deleted_at: string | null;
}

interface ServerProfileOrganizationMember extends Omit<ProfileOrganizationMember, 'created_at' | 'updated_at' | 'deleted_at'> {
    created_at: string | null;
    updated_at: string | null;
    deleted_at: string | null;
}

interface ServerTicket extends Omit<Ticket, 'created_at' | 'updated_at' | 'deleted_at'> {
    created_at: string | null;
    updated_at: string | null;
    deleted_at: string | null;
}

interface ServerTicketComment extends Omit<TicketComment, 'created_at' | 'updated_at' | 'deleted_at'> {
    created_at: string | null;
    updated_at: string | null;
    deleted_at: string | null;
}

interface SyncResponse {
    profiles?: ServerProfile[];
    organizations?: ServerOrganization[];
    profile_organization_members?: ServerProfileOrganizationMember[];
    tickets?: ServerTicket[];
    ticket_comments?: ServerTicketComment[];
}

type MutationRecord<T extends keyof TableTypeMap, A extends MutationType> =
    A extends 'create' ? Omit<TableTypeMap[T], 'id'> :
    A extends 'update' ? Partial<TableTypeMap[T]> & { id: string } :
    { id: string };

// Helper to add a mutation to the queue
async function addMutation<T extends keyof TableTypeMap>(
    table: T,
    type: MutationType,
    record: MutationRecord<T, typeof type>
): Promise<string> {
    const mutation: Mutation = {
        id: uuidv4(),
        table,
        type,
        record,
        timestamp: new Date().toISOString(),
        synced: 0
    };

    await db.mutations.add(mutation);
    return mutation.id;
}

// Generic CRUD operations that track mutations
export async function create<T extends keyof TableTypeMap>(
    table: T,
    data: Omit<TableTypeMap[T], 'id'>
): Promise<TableTypeMap[T]> {
    const id = uuidv4();
    const record = {
        ...data,
        id,
    } as TableTypeMap[T];

    // Update local DB
    switch (table) {
        case 'profiles':
            await db.profiles.add(record as Profile);
            break;
        case 'organizations':
            await db.organizations.add(record as Organization);
            break;
        case 'profile_organization_members':
            await db.profileOrganizationMembers.add(record as ProfileOrganizationMember);
            break;
        case 'tickets':
            await db.tickets.add(record as Ticket);
            break;
        case 'ticket_comments':
            await db.ticketComments.add(record as TicketComment);
            break;
        default:
            throw new Error(`Unknown table: ${table}`);
    }

    // Track mutation
    await addMutation(table, 'create', data);

    // Trigger sync
    void sync();

    return record;
}

export async function update<T extends keyof TableTypeMap>(
    table: T,
    id: string,
    data: Partial<Omit<TableTypeMap[T], 'id'>>
): Promise<void> {
    const record = {
        ...data,
        id,
        updated_at: new Date().toISOString(),
    };

    // Update local DB
    switch (table) {
        case 'profiles':
            await db.profiles.update(id, record);
            break;
        case 'organizations':
            await db.organizations.update(id, record);
            break;
        case 'profile_organization_members':
            await db.profileOrganizationMembers.update(id, record);
            break;
        case 'tickets':
            await db.tickets.update(id, record);
            break;
        case 'ticket_comments':
            await db.ticketComments.update(id, record);
            break;
        default:
            throw new Error(`Unknown table: ${table}`);
    }

    // Track mutation
    await addMutation(table, 'update', record as MutationRecord<T, 'update'>);

    // Trigger sync
    void sync();
}

export async function remove<T extends keyof TableTypeMap>(
    table: T,
    id: string
): Promise<void> {
    const now = new Date().toISOString();
    const record = {
        id,
        deleted_at: now,
        updated_at: now,
    };

    // Update local DB with soft delete
    switch (table) {
        case 'profiles':
            await db.profiles.update(id, record);
            break;
        case 'organizations':
            await db.organizations.update(id, record);
            break;
        case 'profile_organization_members':
            await db.profileOrganizationMembers.update(id, record);
            break;
        case 'tickets':
            await db.tickets.update(id, record);
            break;
        case 'ticket_comments':
            await db.ticketComments.update(id, record);
            break;
        default:
            throw new Error(`Unknown table: ${table}`);
    }

    // Track mutation
    await addMutation(table, 'delete', { id });

    // Trigger sync
    void sync();
}

// Function to sync mutations with the server
export async function sync(): Promise<void> {
    try {
        // Get all unsynced mutations
        const mutations = await db.mutations
            .where('synced')
            .equals(0)
            .sortBy('timestamp');

        if (mutations.length === 0) return;

        // Group mutations by table and type
        const groupedMutations = mutations.reduce((acc, mutation) => {
            const table = mutation.table as keyof TableTypeMap;

            // Initialize table group if it doesn't exist
            if (!acc[table]) {
                switch (table) {
                    case 'profiles':
                        acc.profiles = { creates: [], updates: [] };
                        break;
                    case 'organizations':
                        acc.organizations = { creates: [], updates: [], deletes: [] };
                        break;
                    case 'profile_organization_members':
                        acc.profile_organization_members = { creates: [], updates: [], deletes: [] };
                        break;
                    case 'tickets':
                        acc.tickets = { creates: [], updates: [], deletes: [] };
                        break;
                    case 'ticket_comments':
                        acc.ticket_comments = { creates: [], deletes: [] };
                        break;
                }
            }

            // Add mutation to the appropriate group
            switch (table) {
                case 'profiles':
                    if (mutation.type === 'create') {
                        acc.profiles?.creates?.push(mutation.record as Profile);
                    } else if (mutation.type === 'update') {
                        acc.profiles?.updates?.push(mutation.record as Profile);
                    }
                    break;
                case 'organizations':
                    if (mutation.type === 'create') {
                        acc.organizations?.creates?.push(mutation.record as Omit<Organization, 'id'>);
                    } else if (mutation.type === 'update') {
                        acc.organizations?.updates?.push(mutation.record as Organization);
                    } else if (mutation.type === 'delete') {
                        acc.organizations?.deletes?.push((mutation.record as { id: string }).id);
                    }
                    break;
                case 'profile_organization_members':
                    if (mutation.type === 'create') {
                        acc.profile_organization_members?.creates?.push(mutation.record as Omit<ProfileOrganizationMember, 'id'>);
                    } else if (mutation.type === 'update') {
                        acc.profile_organization_members?.updates?.push(mutation.record as ProfileOrganizationMember);
                    } else if (mutation.type === 'delete') {
                        acc.profile_organization_members?.deletes?.push((mutation.record as { id: string }).id);
                    }
                    break;
                case 'tickets':
                    if (mutation.type === 'create') {
                        acc.tickets?.creates?.push(mutation.record as Omit<Ticket, 'id'>);
                    } else if (mutation.type === 'update') {
                        acc.tickets?.updates?.push(mutation.record as Partial<Ticket> & { id: string });
                    } else if (mutation.type === 'delete') {
                        acc.tickets?.deletes?.push((mutation.record as { id: string }).id);
                    }
                    break;
                case 'ticket_comments':
                    if (mutation.type === 'create') {
                        acc.ticket_comments?.creates?.push(mutation.record as Omit<TicketComment, 'id'>);
                    } else if (mutation.type === 'delete') {
                        acc.ticket_comments?.deletes?.push((mutation.record as { id: string }).id);
                    }
                    break;
            }

            return acc;
        }, {} as SyncInput);

        // Send mutations to server
        const response = await client.sync.mutate(groupedMutations);

        // Update local DB with server response
        await db.transaction('rw', [
            db.profiles,
            db.organizations,
            db.profileOrganizationMembers,
            db.tickets,
            db.ticketComments,
            db.mutations
        ], async () => {
            // Update profiles
            if (response.profiles?.length) {
                const profiles: Profile[] = response.profiles.map(profile => ({
                    ...profile,
                    created_at: profile.created_at ?? undefined,
                    updated_at: profile.updated_at ?? undefined,
                    deleted_at: profile.deleted_at ?? undefined,
                }));
                await db.profiles.bulkPut(profiles);
            }

            // Update organizations
            if (response.organizations?.length) {
                const organizations: Organization[] = response.organizations.map(org => ({
                    ...org,
                    created_at: org.created_at ?? undefined,
                    updated_at: org.updated_at ?? undefined,
                    deleted_at: org.deleted_at ?? undefined,
                }));
                await db.organizations.bulkPut(organizations);
            }

            // Update profile organization members
            if (response.profile_organization_members?.length) {
                const members: ProfileOrganizationMember[] = response.profile_organization_members.map(member => ({
                    ...member,
                    created_at: member.created_at ?? undefined,
                    updated_at: member.updated_at ?? undefined,
                    deleted_at: member.deleted_at ?? undefined,
                }));
                await db.profileOrganizationMembers.bulkPut(members);
            }

            // Update tickets
            if (response.tickets?.length) {
                const tickets: Ticket[] = response.tickets.map(ticket => ({
                    ...ticket,
                    created_at: ticket.created_at ?? undefined,
                    updated_at: ticket.updated_at ?? undefined,
                    deleted_at: ticket.deleted_at ?? undefined,
                }));
                await db.tickets.bulkPut(tickets);
            }

            // Update ticket comments
            if (response.ticket_comments?.length) {
                const comments: TicketComment[] = response.ticket_comments.map(comment => ({
                    ...comment,
                    created_at: comment.created_at ?? undefined,
                    updated_at: comment.updated_at ?? undefined,
                    deleted_at: comment.deleted_at ?? undefined,
                }));
                await db.ticketComments.bulkPut(comments);
            }

            // Mark mutations as synced
            await Promise.all(
                mutations.map(m =>
                    db.mutations.update(m.id, { synced: 1 })
                )
            );
        });

    } catch (error) {
        console.error('Sync failed:', error);
        // We don't throw here - the mutations will remain unsynced
        // and will be retried on the next sync
    }
} 