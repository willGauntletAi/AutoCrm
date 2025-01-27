import { db } from '../../../db';
import { SyncInputSchema, TableRow } from '../schema';
import { z } from 'zod';

export async function updateEnumTagOption(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'update_ticket_tag_enum_option' }, memberships: Record<string, string>): Promise<TableRow<'ticket_tag_enum_options'> | null> {
    const existingOption = await db.selectFrom('ticket_tag_enum_options')
        .selectAll()
        .where('id', '=', data.data.id)
        .executeTakeFirst();

    if (!existingOption) {
        return null;
    }

    const tagKey = await db.selectFrom('ticket_tag_keys')
        .select(['organization_id'])
        .where('id', '=', existingOption.tag_key_id)
        .executeTakeFirst();

    if (!tagKey || !memberships[tagKey.organization_id]) {
        return null;
    }

    if (existingOption.deleted_at) {
        return existingOption;
    }

    try {
        const updated = await db.updateTable('ticket_tag_enum_options')
            .set({
                value: data.data.value,
                description: data.data.description,
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

    return existingOption;
}

export async function createEnumTagOption(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'create_ticket_tag_enum_option' }, memberships: Record<string, string>): Promise<TableRow<'ticket_tag_enum_options'> | null> {
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
        return await db.insertInto('ticket_tag_enum_options')
            .values({
                id: data.data.id,
                tag_key_id: data.data.tag_key_id,
                value: data.data.value,
                description: data.data.description,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .returningAll()
            .executeTakeFirstOrThrow();
    } catch (error) {
        if (error instanceof Error && error.message.includes('duplicate key')) {
            const existing = await db.selectFrom('ticket_tag_enum_options')
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
            tag_key_id: data.data.tag_key_id,
            value: data.data.value,
            description: data.data.description,
            created_at: now,
            updated_at: now,
            deleted_at: now,
        };
    }
}

export async function deleteEnumTagOption(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'delete_ticket_tag_enum_option' }, memberships: Record<string, string>): Promise<TableRow<'ticket_tag_enum_options'> | null> {
    const existingOption = await db.selectFrom('ticket_tag_enum_options')
        .selectAll()
        .where('id', '=', data.data.id)
        .executeTakeFirst();

    if (!existingOption) {
        return null;
    }

    const tagKey = await db.selectFrom('ticket_tag_keys')
        .select(['organization_id'])
        .where('id', '=', existingOption.tag_key_id)
        .executeTakeFirst();

    if (!tagKey || !memberships[tagKey.organization_id]) {
        return null;
    }

    if (existingOption.deleted_at) {
        return existingOption;
    }

    try {
        const updated = await db.updateTable('ticket_tag_enum_options')
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

    return existingOption;
} 