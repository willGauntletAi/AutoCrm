import { db, TicketTagNumberValueWithNumber } from './db';
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
    type TicketTagKey,
    type TicketTagDateValue,
    type TicketTagNumberValue,
    type TicketTagTextValue,
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
        const unsyncedMutations = await db.mutations
            .where('synced')
            .equals(0)
            .toArray();

        if (unsyncedMutations.length === 0) {
            return;
        }

        // We don't wait for this to finish. If it fails, it is fine because we store all mutations in the local db and can retry later.
        client.sync.mutate(unsyncedMutations.map(m => m.operation)).then(async (result) => {
            await db.transaction('rw', [
                db.profiles,
                db.organizations,
                db.profileOrganizationMembers,
                db.tickets,
                db.ticketComments,
                db.organizationInvitations,
                db.ticketTagKeys,
                db.ticketTagDateValues,
                db.ticketTagNumberValues,
                db.ticketTagTextValues,
                db.mutations
            ], async () => {
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
                if (result.organization_invitations?.length) {
                    await db.organizationInvitations.bulkPut(result.organization_invitations);
                }
                if (result.ticket_tag_keys?.length) {
                    await db.ticketTagKeys.bulkPut(result.ticket_tag_keys.map(key => ({
                        ...key,
                        tag_type: key.tag_type as 'date' | 'number' | 'text'
                    })));
                }
                if (result.ticket_tag_date_values?.length) {
                    await db.ticketTagDateValues.bulkPut(result.ticket_tag_date_values.map(value => ({
                        ...value,
                        value: new Date(value.value)
                    })));
                }
                if (result.ticket_tag_number_values?.length) {
                    const vals = result.ticket_tag_number_values.map(v => ({ ...v, value: Number(v.value) }));
                    await db.ticketTagNumberValues.bulkPut(vals);
                }
                if (result.ticket_tag_text_values?.length) {
                    await db.ticketTagTextValues.bulkPut(result.ticket_tag_text_values);
                }

                await markMutationsSynced(unsyncedMutations.map(m => m.id!));
            });
        });
    } catch (error) {
        console.error('Error syncing to server:', error);
        throw error;
    }
}

// Ticket Tag Key operations
export async function createTicketTagKey(data: Omit<TicketTagKey, 'created_at' | 'updated_at' | 'deleted_at'>): Promise<void> {
    const timestamp = new Date().toISOString();
    const tagKeyData = {
        ...data,
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
    };
    await db.transaction('rw', [db.mutations, db.ticketTagKeys], async () => {
        await queueMutation({
            operation: 'create_ticket_tag_key',
            data: tagKeyData,
        });
        await db.ticketTagKeys.put(tagKeyData);
    });
    await syncToServer();
}

export async function updateTicketTagKey(id: string, data: Partial<Omit<TicketTagKey, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>>): Promise<void> {
    const timestamp = new Date().toISOString();
    await db.transaction('rw', [db.mutations, db.ticketTagKeys], async () => {
        const existing = await db.ticketTagKeys.get(id);
        if (!existing) {
            throw new Error(`Ticket Tag Key ${id} not found`);
        }
        const tagKeyData = {
            ...existing,
            ...data,
            updated_at: timestamp,
        };
        await queueMutation({
            operation: 'update_ticket_tag_key',
            data: tagKeyData,
        });
        await db.ticketTagKeys.update(id, tagKeyData);
    });
    await syncToServer();
}

export async function deleteTicketTagKey(id: string): Promise<void> {
    const timestamp = new Date().toISOString();
    await db.transaction('rw', [db.mutations, db.ticketTagKeys], async () => {
        await queueMutation({
            operation: 'delete_ticket_tag_key',
            data: { id },
        });
        await db.ticketTagKeys.update(id, {
            deleted_at: timestamp,
            updated_at: timestamp
        });
    });
    await syncToServer();
}

// Tag Value operations
export async function createTicketTagDateValue(data: Omit<TicketTagDateValue, 'created_at' | 'updated_at' | 'deleted_at'>): Promise<void> {
    const timestamp = new Date().toISOString();
    console.log('Creating ticket tag date value:', { data, timestamp })
    const valueData = {
        ...data,
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
    };
    await db.transaction('rw', [db.mutations, db.ticketTagDateValues], async () => {
        await queueMutation({
            operation: 'create_ticket_tag_date_value',
            data: valueData,
        });
        await db.ticketTagDateValues.put(valueData);
    });
    await syncToServer();
}

export async function updateTicketTagDateValue(id: string, data: Partial<Omit<TicketTagDateValue, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>>): Promise<void> {
    const timestamp = new Date().toISOString();
    console.log('Updating ticket tag date value:', { id, data, timestamp })
    await db.transaction('rw', [db.mutations, db.ticketTagDateValues], async () => {
        const existing = await db.ticketTagDateValues.get(id);
        if (!existing) {
            throw new Error(`Ticket Tag Date Value ${id} not found`);
        }
        const valueData = {
            ...existing,
            ...data,
            updated_at: timestamp,
        };
        await queueMutation({
            operation: 'update_ticket_tag_date_value',
            data: valueData,
        });
        await db.ticketTagDateValues.update(id, valueData);
    });
    await syncToServer();
}

export async function deleteTicketTagDateValue(id: string): Promise<void> {
    const timestamp = new Date().toISOString();
    console.log('Deleting ticket tag date value:', { id, timestamp })
    await db.transaction('rw', [db.mutations, db.ticketTagDateValues], async () => {
        await queueMutation({
            operation: 'delete_ticket_tag_date_value',
            data: { id },
        });
        await db.ticketTagDateValues.update(id, {
            deleted_at: timestamp,
            updated_at: timestamp
        });
    });
    await syncToServer();
}

export async function createTicketTagNumberValue(data: Omit<TicketTagNumberValue, 'created_at' | 'updated_at' | 'deleted_at'>): Promise<void> {
    const timestamp = new Date().toISOString();
    const valueData = {
        ...data,
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
    };
    await db.transaction('rw', [db.mutations, db.ticketTagNumberValues], async () => {
        await queueMutation({
            operation: 'create_ticket_tag_number_value',
            data: valueData,
        });
        await db.ticketTagNumberValues.put({ ...valueData, value: Number(valueData.value) });
    });
    await syncToServer();
}

export async function updateTicketTagNumberValue(id: string, data: Partial<Omit<TicketTagNumberValue, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>>): Promise<void> {
    const timestamp = new Date().toISOString();
    await db.transaction('rw', [db.mutations, db.ticketTagNumberValues], async () => {
        const existing = await db.ticketTagNumberValues.get(id);
        if (!existing) {
            throw new Error(`Ticket Tag Number Value ${id} not found`);
        }
        const valueData = {
            ...existing,
            ...data,
            updated_at: timestamp,
        };
        if (typeof valueData.value === 'number') {
            valueData.value = String(valueData.value);
        }
        await queueMutation({
            operation: 'update_ticket_tag_number_value',
            data: valueData as TicketTagNumberValue,
        });
        await db.ticketTagNumberValues.update(id, valueData as TicketTagNumberValueWithNumber);
    });
    await syncToServer();
}

export async function deleteTicketTagNumberValue(id: string): Promise<void> {
    const timestamp = new Date().toISOString();
    await db.transaction('rw', [db.mutations, db.ticketTagNumberValues], async () => {
        await queueMutation({
            operation: 'delete_ticket_tag_number_value',
            data: { id },
        });
        await db.ticketTagNumberValues.update(id, {
            deleted_at: timestamp,
            updated_at: timestamp
        });
    });
    await syncToServer();
}

export async function createTicketTagTextValue(data: Omit<TicketTagTextValue, 'created_at' | 'updated_at' | 'deleted_at'>): Promise<void> {
    const timestamp = new Date().toISOString();
    const valueData = {
        ...data,
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
    };
    await db.transaction('rw', [db.mutations, db.ticketTagTextValues], async () => {
        await queueMutation({
            operation: 'create_ticket_tag_text_value',
            data: valueData,
        });
        await db.ticketTagTextValues.put(valueData);
    });
    await syncToServer();
}

export async function updateTicketTagTextValue(id: string, data: Partial<Omit<TicketTagTextValue, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>>): Promise<void> {
    const timestamp = new Date().toISOString();
    await db.transaction('rw', [db.mutations, db.ticketTagTextValues], async () => {
        const existing = await db.ticketTagTextValues.get(id);
        if (!existing) {
            throw new Error(`Ticket Tag Text Value ${id} not found`);
        }
        const valueData = {
            ...existing,
            ...data,
            updated_at: timestamp,
        };
        await queueMutation({
            operation: 'update_ticket_tag_text_value',
            data: valueData,
        });
        await db.ticketTagTextValues.update(id, valueData);
    });
    await syncToServer();
}

export async function deleteTicketTagTextValue(id: string): Promise<void> {
    const timestamp = new Date().toISOString();
    await db.transaction('rw', [db.mutations, db.ticketTagTextValues], async () => {
        await queueMutation({
            operation: 'delete_ticket_tag_text_value',
            data: { id },
        });
        await db.ticketTagTextValues.update(id, {
            deleted_at: timestamp,
            updated_at: timestamp
        });
    });
    await syncToServer();
} 