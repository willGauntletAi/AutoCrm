import { db } from '../../../db';
import { SyncInputSchema, TableRow } from '../schema';
import { z } from 'zod';

export async function updateTextTagValue(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'update_ticket_tag_text_value' }, memberships: Record<string, string>): Promise<TableRow<'ticket_tag_text_values'> | null> {
    const existingValue = await db.selectFrom('ticket_tag_text_values')
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
        const updated = await db.updateTable('ticket_tag_text_values')
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

export async function createTextTagValue(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'create_ticket_tag_text_value' }, memberships: Record<string, string>): Promise<TableRow<'ticket_tag_text_values'> | null> {
    const tagKey = await db.selectFrom('ticket_tag_keys')
        .select(['organization_id', 'deleted_at'])
        .where('id', '=', data.data.tag_key_id)
        .executeTakeFirst();

    if (!tagKey || tagKey.deleted_at) {
        return null;
    }

    if (!memberships[tagKey.organization_id]) {
        return null;
    }

    try {
        return await db.insertInto('ticket_tag_text_values')
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
            const existing = await db.selectFrom('ticket_tag_text_values')
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
            value: data.data.value,
            created_at: now,
            updated_at: now,
            deleted_at: now,
        };
    }
}

export async function deleteTextTagValue(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'delete_ticket_tag_text_value' }, memberships: Record<string, string>): Promise<TableRow<'ticket_tag_text_values'> | null> {
    const existingValue = await db.selectFrom('ticket_tag_text_values')
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
        const updated = await db.updateTable('ticket_tag_text_values')
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
