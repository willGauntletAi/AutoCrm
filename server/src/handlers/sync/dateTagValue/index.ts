import { db } from '../../../db';
import { SyncInputSchema, TableRow } from '../schema';
import { z } from 'zod';

export async function updateDateTagValue(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'update_ticket_tag_date_value' }, memberships: Record<string, string>): Promise<TableRow<'ticket_tag_date_values'> | null> {
    const existingValue = await db.selectFrom('ticket_tag_date_values')
        .selectAll()
        .where('id', '=', data.data.id)
        .executeTakeFirst();

    if (!existingValue) {
        return null;
    }

    const tagKey = await db.selectFrom('ticket_tag_keys')
        .select(['organization_id'])
        .where('id', '=', existingValue.tag_key_id)
        .executeTakeFirst();

    if (!tagKey || !memberships[tagKey.organization_id]) {
        return null;
    }

    if (existingValue.deleted_at) {
        return existingValue;
    }

    try {
        const updated = await db.updateTable('ticket_tag_date_values')
            .set({
                value: data.data.value,
                updated_at: new Date().toISOString(),
            })
            .where('id', '=', data.data.id)
            .returningAll()
            .executeTakeFirst();

        if (updated) {
            return updated;
        }
    } catch (error) {
        // Fall through to return unchanged value
    }

    return existingValue;
}

export async function createDateTagValue(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'create_ticket_tag_date_value' }, memberships: Record<string, string>): Promise<TableRow<'ticket_tag_date_values'> | null> {
    // First check if the tag key exists and get its organization
    const tagKey = await db.selectFrom('ticket_tag_keys')
        .select(['organization_id', 'deleted_at'])
        .where('id', '=', data.data.tag_key_id)
        .executeTakeFirst();

    // Can't use deleted tag keys
    if (!tagKey || tagKey.deleted_at) {
        return null;
    }

    // Only create value if user has access to the organization
    if (!memberships[tagKey.organization_id]) {
        return null;
    }

    try {
        return await db.insertInto('ticket_tag_date_values')
            .values({
                id: data.data.id,
                ticket_id: data.data.ticket_id,
                tag_key_id: data.data.tag_key_id,
                value: data.data.value,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .returningAll()
            .executeTakeFirstOrThrow();
    } catch (error) {
        if (error instanceof Error && error.message.includes('duplicate key')) {
            const existing = await db.selectFrom('ticket_tag_date_values')
                .selectAll()
                .where('id', '=', data.data.id)
                .executeTakeFirst();

            if (existing) {
                return existing;
            }
        }
        const now = new Date();
        return {
            id: data.data.id,
            ticket_id: data.data.ticket_id,
            tag_key_id: data.data.tag_key_id,
            value: new Date(data.data.value),
            created_at: now,
            updated_at: now,
            deleted_at: now,
        };
    }
}

export async function deleteDateTagValue(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'delete_ticket_tag_date_value' }, memberships: Record<string, string>): Promise<TableRow<'ticket_tag_date_values'> | null> {
    const existingValue = await db.selectFrom('ticket_tag_date_values')
        .selectAll()
        .where('id', '=', data.data.id)
        .executeTakeFirst();

    if (!existingValue) {
        return null;
    }

    const tagKey = await db.selectFrom('ticket_tag_keys')
        .select(['organization_id'])
        .where('id', '=', existingValue.tag_key_id)
        .executeTakeFirst();

    if (!tagKey || !memberships[tagKey.organization_id]) {
        return null;
    }

    if (existingValue.deleted_at) {
        return existingValue;
    }

    try {
        const updated = await db.updateTable('ticket_tag_date_values')
            .set({
                deleted_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .where('id', '=', data.data.id)
            .returningAll()
            .executeTakeFirst();

        if (updated) {
            return updated;
        }
    } catch (error) {
        // Fall through to return unchanged value
    }

    return existingValue;
}