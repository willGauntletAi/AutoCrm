import { db } from './db';
import { z } from 'zod';
import { client } from './trpc';
import { CURRENT_USER_KEY } from './sync-from-server';
import {
    MutationOperationSchema,
    type Profile,
    type Organization,
    type ProfileOrganizationMember,
    type Ticket,
    type TicketComment,
    type OrganizationInvitation,
    type Mutation
} from './db';


export type Operation = z.infer<typeof MutationOperationSchema>;

// Add a mutation to the queue
export async function queueMutation(operation: Operation): Promise<void> {
    const mutation: Omit<Mutation, 'id'> = {
        operation,
        timestamp: Date.now(),
        synced: 0,
    };
    await db.mutations.add(mutation);
    await applyMutation(operation);
}

// Helper functions for each operation type
export async function createProfile(data: Omit<Profile, 'created_at' | 'updated_at' | 'deleted_at'>): Promise<void> {
    const timestamp = new Date().toISOString();
    const profileData = {
        ...data,
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
    };
    await db.transaction('rw', [db.mutations, db.profiles], async () => {
        await queueMutation({
            operation: 'create_profile',
            data: profileData,
        });
        await db.profiles.put(profileData);
    });
    syncToServer();
}

export async function updateProfile(id: string, data: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>>): Promise<void> {
    const timestamp = new Date().toISOString();
    await db.transaction('rw', [db.mutations, db.profiles], async () => {
        const profileData = {
            id,
            full_name: data.full_name || null,
            avatar_url: data.avatar_url || null,
            created_at: timestamp,
            updated_at: timestamp,
            deleted_at: null,
        };
        await queueMutation({
            operation: 'update_profile',
            data: profileData
        });
        await db.profiles.update(id, data);
    });
    await syncToServer();
}

export async function createOrganization(data: Omit<Organization, 'created_at' | 'updated_at' | 'deleted_at'>): Promise<void> {
    const timestamp = new Date().toISOString();
    const orgData = {
        ...data,
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
    };
    await db.transaction('rw', [db.mutations, db.organizations, db.profileOrganizationMembers, db.system], async () => {
        await queueMutation({
            operation: 'create_organization',
            data: orgData,
        });
        await db.organizations.put(orgData);

        const userRecord = await db.system.get(CURRENT_USER_KEY);
        if (!userRecord || typeof userRecord.value !== 'string') {
            throw new Error('No user found');
        }

        const memberData = {
            id: crypto.randomUUID(),
            profile_id: userRecord.value,
            organization_id: orgData.id,
            role: 'admin',
            created_at: timestamp,
            updated_at: timestamp,
            deleted_at: null,
        };

        await queueMutation({
            operation: 'create_profile_organization_member',
            data: memberData,
        });
        await db.profileOrganizationMembers.put(memberData);
    });
    await syncToServer();
}

export async function updateOrganization(id: string, data: Partial<Omit<Organization, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>>): Promise<void> {
    const timestamp = new Date().toISOString();
    await db.transaction('rw', [db.mutations, db.organizations], async () => {
        const existing = await db.organizations.get(id);
        if (!existing) {
            throw new Error(`Organization ${id} not found`);
        }
        const orgData = {
            ...existing,
            ...data,
            updated_at: timestamp,
        };
        await queueMutation({
            operation: 'update_organization',
            data: orgData,
        });
        await db.organizations.update(id, orgData);
    });
    await syncToServer();
}

export async function deleteOrganization(id: string): Promise<void> {
    const timestamp = new Date().toISOString();
    await db.transaction('rw', [db.mutations, db.organizations], async () => {
        await queueMutation({
            operation: 'delete_organization',
            data: { id },
        });
        await db.organizations.update(id, {
            deleted_at: timestamp,
            updated_at: timestamp
        });
    });
    await syncToServer();
}

export async function createProfileOrganizationMember(data: Omit<ProfileOrganizationMember, 'created_at' | 'updated_at' | 'deleted_at'>): Promise<void> {
    const timestamp = new Date().toISOString();
    const memberData = {
        ...data,
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
    };
    await db.transaction('rw', [db.mutations, db.profileOrganizationMembers], async () => {
        await queueMutation({
            operation: 'create_profile_organization_member',
            data: memberData,
        });
        await db.profileOrganizationMembers.put(memberData);
    });
    await syncToServer();
}

export async function updateProfileOrganizationMember(id: string, data: Partial<Omit<ProfileOrganizationMember, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>>): Promise<void> {
    const timestamp = new Date().toISOString();
    await db.transaction('rw', [db.mutations, db.profileOrganizationMembers], async () => {
        const existing = await db.profileOrganizationMembers.get(id);
        if (!existing) {
            throw new Error(`Profile Organization Member ${id} not found`);
        }
        const memberData = {
            ...existing,
            ...data,
            updated_at: timestamp,
        };
        await queueMutation({
            operation: 'update_profile_organization_member',
            data: memberData,
        });
        await db.profileOrganizationMembers.update(id, memberData);
    });
    await syncToServer();
}

export async function deleteProfileOrganizationMember(id: string): Promise<void> {
    const timestamp = new Date().toISOString();
    await db.transaction('rw', [db.mutations, db.profileOrganizationMembers], async () => {
        await queueMutation({
            operation: 'delete_profile_organization_member',
            data: { id },
        });
        await db.profileOrganizationMembers.update(id, {
            deleted_at: timestamp,
            updated_at: timestamp
        });
    });
    await syncToServer();
}

export async function createTicket(data: Omit<Ticket, 'created_at' | 'updated_at' | 'deleted_at'>): Promise<void> {
    const timestamp = new Date().toISOString();
    const ticketData = {
        ...data,
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
    };
    await db.transaction('rw', [db.mutations, db.tickets], async () => {
        await queueMutation({
            operation: 'create_ticket',
            data: ticketData,
        });
        await db.tickets.put(ticketData);
    });
    await syncToServer();
}

export async function updateTicket(id: string, data: Partial<Omit<Ticket, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>>): Promise<void> {
    const timestamp = new Date().toISOString();
    await db.transaction('rw', [db.mutations, db.tickets], async () => {
        const existing = await db.tickets.get(id);
        if (!existing) {
            throw new Error(`Ticket ${id} not found`);
        }
        const ticketData = {
            ...existing,
            ...data,
            updated_at: timestamp,
        };
        await queueMutation({
            operation: 'update_ticket',
            data: ticketData,
        });
        await db.tickets.update(id, ticketData);
    });
    await syncToServer();
}

export async function deleteTicket(id: string): Promise<void> {
    const timestamp = new Date().toISOString();
    await db.transaction('rw', [db.mutations, db.tickets], async () => {
        await queueMutation({
            operation: 'delete_ticket',
            data: { id },
        });
        await db.tickets.update(id, {
            deleted_at: timestamp,
            updated_at: timestamp
        });
    });
    await syncToServer();
}

export async function createTicketComment(data: Omit<TicketComment, 'created_at' | 'updated_at' | 'deleted_at'>): Promise<void> {
    const timestamp = new Date().toISOString();
    const commentData = {
        ...data,
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
    };
    await db.transaction('rw', [db.mutations, db.ticketComments], async () => {
        await queueMutation({
            operation: 'create_ticket_comment',
            data: commentData,
        });
        await db.ticketComments.put(commentData);
    });
    await syncToServer();
}

export async function deleteTicketComment(id: string): Promise<void> {
    const timestamp = new Date().toISOString();
    await db.transaction('rw', [db.mutations, db.ticketComments], async () => {
        await queueMutation({
            operation: 'delete_ticket_comment',
            data: { id },
        });
        await db.ticketComments.update(id, {
            deleted_at: timestamp,
            updated_at: timestamp
        });
    });
    await syncToServer();
}

export async function createOrganizationInvitation(data: Omit<OrganizationInvitation, 'created_at' | 'updated_at' | 'deleted_at'>): Promise<void> {
    const timestamp = new Date().toISOString();
    const invitationData = {
        ...data,
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
    };
    await db.transaction('rw', [db.mutations, db.organizationInvitations], async () => {
        await queueMutation({
            operation: 'create_organization_invitation',
            data: invitationData,
        });
        await db.organizationInvitations.put(invitationData);
    });
    await syncToServer();
}

export async function updateOrganizationInvitation(id: string, data: Partial<Omit<OrganizationInvitation, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>>): Promise<void> {
    const timestamp = new Date().toISOString();
    await db.transaction('rw', [db.mutations, db.organizationInvitations], async () => {
        const existing = await db.organizationInvitations.get(id);
        if (!existing) {
            throw new Error(`Organization Invitation ${id} not found`);
        }
        const invitationData = {
            ...existing,
            ...data,
            updated_at: timestamp,
        };
        await queueMutation({
            operation: 'update_organization_invitation',
            data: invitationData,
        });
        await db.organizationInvitations.update(id, invitationData);
    });
    await syncToServer();
}

export async function deleteOrganizationInvitation(id: string): Promise<void> {
    const timestamp = new Date().toISOString();
    await db.transaction('rw', [db.mutations, db.organizationInvitations], async () => {
        await queueMutation({
            operation: 'delete_organization_invitation',
            data: { id },
        });
        await db.organizationInvitations.update(id, {
            deleted_at: timestamp,
            updated_at: timestamp
        });
    });
    await syncToServer();
}

// Get all unsynced mutations
export async function getUnsyncedMutations(): Promise<Operation[]> {
    const mutations = await db.mutations
        .where('synced')
        .equals(0)
        .sortBy('timestamp');

    return mutations.map(m => m.operation);
}

// Mark mutations as synced
export async function markMutationsSynced(ids: number[]): Promise<void> {
    await Promise.all(
        ids.map(id =>
            db.mutations.update(id, { synced: 1 })
        )
    );
}

// Apply a mutation locally
export async function applyMutation(operation: Operation): Promise<void> {
    switch (operation.operation) {
        case 'create_profile':
        case 'update_profile':
            await db.profiles.put({ ...operation.data, created_at: null, updated_at: null, deleted_at: null });
            break;

        case 'create_organization':
        case 'update_organization':
            await db.organizations.put({ ...operation.data, created_at: null, updated_at: null, deleted_at: null });
            break;

        case 'delete_organization':
            await db.organizations.update(operation.data.id, {
                deleted_at: new Date().toISOString(),
            });
            break;

        case 'create_profile_organization_member':
        case 'update_profile_organization_member':
            await db.profileOrganizationMembers.put({ ...operation.data, created_at: null, updated_at: null, deleted_at: null });
            break;

        case 'delete_profile_organization_member':
            await db.profileOrganizationMembers.update(operation.data.id, {
                deleted_at: new Date().toISOString(),
            });
            break;

        case 'create_ticket':
        case 'update_ticket':
            await db.tickets.put({ ...operation.data, created_at: null, updated_at: null, deleted_at: null });
            break;

        case 'delete_ticket':
            await db.tickets.update(operation.data.id, {
                deleted_at: new Date().toISOString(),
            });
            break;

        case 'create_ticket_comment':
            await db.ticketComments.put({ ...operation.data, created_at: null, updated_at: null, deleted_at: null });
            break;

        case 'delete_ticket_comment':
            await db.ticketComments.update(operation.data.id, {
                deleted_at: new Date().toISOString(),
            });
            break;

        case 'create_organization_invitation':
        case 'update_organization_invitation':
            await db.organizationInvitations.put({ ...operation.data, created_at: null, updated_at: null, deleted_at: null });
            break;
    }
}

// Sync local mutations to server
export async function syncToServer(): Promise<void> {
    try {
        // Get all unsynced mutations
        const unsyncedMutations = await db.mutations
            .where('synced')
            .equals(0)
            .toArray();

        if (unsyncedMutations.length === 0) {
            return;
        }

        // Send mutations to server
        await client.sync.mutate(unsyncedMutations.map(m => m.operation)).then(async (result) => {

            // Update local records with server timestamps
            await db.transaction('rw', [
                db.profiles,
                db.organizations,
                db.profileOrganizationMembers,
                db.tickets,
                db.ticketComments,
                db.mutations
            ], async () => {
                // Update each type of record with server response
                if (result.profiles?.length) {
                    await db.profiles.bulkPut(result.profiles);
                }
                if (result.organizations?.length) {
                    await db.organizations.bulkPut(result.organizations);
                }
                if (result.profile_organization_members?.length) {
                    await db.profileOrganizationMembers.bulkPut(result.profile_organization_members);
                }
                if (result.tickets?.length) {
                    await db.tickets.bulkPut(result.tickets);
                }
                if (result.ticket_comments?.length) {
                    await db.ticketComments.bulkPut(result.ticket_comments);
                }

                // Mark mutations as synced
                await markMutationsSynced(unsyncedMutations.map(m => m.id!));
            });

        });
    } catch (error) {
        console.error('Error syncing to server:', error);
        throw error;
    }
} 