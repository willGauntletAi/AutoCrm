import { db } from './db';
import { z } from 'zod';

// Define the operation types
const ProfileSchema = z.object({
    id: z.string().uuid(),
    full_name: z.string().nullable(),
    avatar_url: z.string().nullable(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    deleted_at: z.string().optional(),
});

const OrganizationSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    deleted_at: z.string().optional(),
});

const ProfileOrganizationMemberSchema = z.object({
    id: z.string().uuid(),
    profile_id: z.string().uuid(),
    organization_id: z.string().uuid(),
    role: z.string().nullable(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    deleted_at: z.string().optional(),
});

const TicketSchema = z.object({
    id: z.string().uuid(),
    title: z.string(),
    description: z.string().nullable(),
    priority: z.string(),
    organization_id: z.string().uuid(),
    status: z.string(),
    created_by: z.string().uuid(),
    assigned_to: z.string().uuid().nullable(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    deleted_at: z.string().optional(),
});

const TicketCommentSchema = z.object({
    id: z.string().uuid(),
    ticket_id: z.string().uuid(),
    user_id: z.string().uuid(),
    comment: z.string(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    deleted_at: z.string().optional(),
});

const DeleteSchema = z.object({
    id: z.string().uuid(),
});

export const MutationOperationSchema = z.discriminatedUnion('operation', [
    z.object({
        operation: z.literal('create_profile'),
        data: ProfileSchema,
    }),
    z.object({
        operation: z.literal('update_profile'),
        data: ProfileSchema,
    }),
    z.object({
        operation: z.literal('create_organization'),
        data: OrganizationSchema,
    }),
    z.object({
        operation: z.literal('update_organization'),
        data: OrganizationSchema,
    }),
    z.object({
        operation: z.literal('delete_organization'),
        data: DeleteSchema,
    }),
    z.object({
        operation: z.literal('create_profile_organization_member'),
        data: ProfileOrganizationMemberSchema,
    }),
    z.object({
        operation: z.literal('update_profile_organization_member'),
        data: ProfileOrganizationMemberSchema,
    }),
    z.object({
        operation: z.literal('delete_profile_organization_member'),
        data: DeleteSchema,
    }),
    z.object({
        operation: z.literal('create_ticket'),
        data: TicketSchema,
    }),
    z.object({
        operation: z.literal('update_ticket'),
        data: TicketSchema,
    }),
    z.object({
        operation: z.literal('delete_ticket'),
        data: DeleteSchema,
    }),
    z.object({
        operation: z.literal('create_ticket_comment'),
        data: TicketCommentSchema,
    }),
    z.object({
        operation: z.literal('delete_ticket_comment'),
        data: DeleteSchema,
    }),
]);

export type Operation = z.infer<typeof MutationOperationSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type Organization = z.infer<typeof OrganizationSchema>;
export type ProfileOrganizationMember = z.infer<typeof ProfileOrganizationMemberSchema>;
export type Ticket = z.infer<typeof TicketSchema>;
export type TicketComment = z.infer<typeof TicketCommentSchema>;

// Define the mutation schema
const MutationSchema = z.object({
    id: z.number().optional(),
    operation: MutationOperationSchema,
    timestamp: z.number(),
    synced: z.number(),
});

export type Mutation = z.infer<typeof MutationSchema>;

// Add a mutation to the queue
export async function queueMutation(operation: Operation): Promise<void> {
    const mutation: Omit<Mutation, 'id'> = {
        operation,
        timestamp: Date.now(),
        synced: 0,
    };
    await db.mutations.add(mutation);
}

// Helper functions for each operation type
export async function createProfile(data: Profile): Promise<void> {
    await queueMutation({
        operation: 'create_profile',
        data,
    });
}

export async function updateProfile(data: Profile): Promise<void> {
    await queueMutation({
        operation: 'update_profile',
        data,
    });
}

export async function createOrganization(data: Organization): Promise<void> {
    // First create the organization
    await queueMutation({
        operation: 'create_organization',
        data,
    });

    // Then create the profile organization member record
    const userRecord = await db.system.get('currentUser');
    if (!userRecord || typeof userRecord.value === 'string' || !userRecord.value.id) {
        throw new Error('No user found');
    }

    await queueMutation({
        operation: 'create_profile_organization_member',
        data: {
            id: crypto.randomUUID(),
            profile_id: userRecord.value.id,
            organization_id: data.id,
            role: 'admin',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        },
    });
}

export async function updateOrganization(data: Organization): Promise<void> {
    await queueMutation({
        operation: 'update_organization',
        data,
    });
}

export async function deleteOrganization(id: string): Promise<void> {
    await queueMutation({
        operation: 'delete_organization',
        data: { id },
    });
}

export async function createProfileOrganizationMember(data: ProfileOrganizationMember): Promise<void> {
    await queueMutation({
        operation: 'create_profile_organization_member',
        data,
    });
}

export async function updateProfileOrganizationMember(data: ProfileOrganizationMember): Promise<void> {
    await queueMutation({
        operation: 'update_profile_organization_member',
        data,
    });
}

export async function deleteProfileOrganizationMember(id: string): Promise<void> {
    await queueMutation({
        operation: 'delete_profile_organization_member',
        data: { id },
    });
}

export async function createTicket(data: Ticket): Promise<void> {
    await queueMutation({
        operation: 'create_ticket',
        data,
    });
}

export async function updateTicket(data: Ticket): Promise<void> {
    await queueMutation({
        operation: 'update_ticket',
        data,
    });
}

export async function deleteTicket(id: string): Promise<void> {
    await queueMutation({
        operation: 'delete_ticket',
        data: { id },
    });
}

export async function createTicketComment(data: TicketComment): Promise<void> {
    await queueMutation({
        operation: 'create_ticket_comment',
        data,
    });
}

export async function deleteTicketComment(id: string): Promise<void> {
    await queueMutation({
        operation: 'delete_ticket_comment',
        data: { id },
    });
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
            db.mutations.update(id, { synced: 0 })
        )
    );
}

// Apply a mutation locally
export async function applyMutation(operation: Operation): Promise<void> {
    switch (operation.operation) {
        case 'create_profile':
        case 'update_profile':
            await db.profiles.put(operation.data);
            break;

        case 'create_organization':
        case 'update_organization':
            await db.organizations.put(operation.data);
            break;

        case 'delete_organization':
            await db.organizations.update(operation.data.id, {
                deleted_at: new Date().toISOString(),
            });
            break;

        case 'create_profile_organization_member':
        case 'update_profile_organization_member':
            await db.profileOrganizationMembers.put(operation.data);
            break;

        case 'delete_profile_organization_member':
            await db.profileOrganizationMembers.update(operation.data.id, {
                deleted_at: new Date().toISOString(),
            });
            break;

        case 'create_ticket':
        case 'update_ticket':
            await db.tickets.put(operation.data);
            break;

        case 'delete_ticket':
            await db.tickets.update(operation.data.id, {
                deleted_at: new Date().toISOString(),
            });
            break;

        case 'create_ticket_comment':
            await db.ticketComments.put(operation.data);
            break;

        case 'delete_ticket_comment':
            await db.ticketComments.update(operation.data.id, {
                deleted_at: new Date().toISOString(),
            });
            break;
    }
} 