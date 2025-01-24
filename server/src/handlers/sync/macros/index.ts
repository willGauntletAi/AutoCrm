import { db } from '../../../db';
import { SyncInputSchema, TableRow } from '../schema';
import { z } from 'zod';

// Helper function to validate tag keys exist and match their types
async function validateTagKeys(organizationId: string, macro: any): Promise<boolean> {
    // Collect all tag keys used in requirements and actions
    const dateTagKeys = new Set<string>([
        ...Object.keys(macro.requirements?.date_tag_requirements || {}),
        ...Object.keys(macro.actions?.tags_to_modify?.date_tags || {})
    ]);
    const numberTagKeys = new Set<string>([
        ...Object.keys(macro.requirements?.number_tag_requirements || {}),
        ...Object.keys(macro.actions?.tags_to_modify?.number_tags || {})
    ]);
    const textTagKeys = new Set<string>([
        ...Object.keys(macro.requirements?.text_tag_requirements || {}),
        ...Object.keys(macro.actions?.tags_to_modify?.text_tags || {})
    ]);
    const allTagKeysToRemove = new Set<string>(macro.actions?.tag_keys_to_remove || []);

    // Get all referenced tag keys
    const allTagKeys = new Set([
        ...dateTagKeys,
        ...numberTagKeys,
        ...textTagKeys,
        ...allTagKeysToRemove
    ]);

    if (allTagKeys.size === 0) {
        return true; // No tag keys to validate
    }

    // Fetch all referenced tag keys
    const tagKeys = await db.selectFrom('ticket_tag_keys')
        .select(['id', 'tag_type', 'deleted_at'])
        .where('organization_id', '=', organizationId)
        .where('id', 'in', Array.from(allTagKeys) as string[])
        .execute();

    // Create a map of tag key id to type for quick lookup
    const tagKeyMap = new Map(tagKeys.map(key => [key.id, key]));

    // Check all referenced tag keys exist and aren't deleted
    for (const tagKey of tagKeys) {
        if (tagKey.deleted_at) {
            return false;
        }
    }

    // Validate each tag key is used with the correct type
    for (const dateTagKey of dateTagKeys) {
        const key = tagKeyMap.get(dateTagKey);
        if (!key || key.tag_type !== 'date') {
            return false;
        }
    }

    for (const numberTagKey of numberTagKeys) {
        const key = tagKeyMap.get(numberTagKey);
        if (!key || key.tag_type !== 'number') {
            return false;
        }
    }

    for (const textTagKey of textTagKeys) {
        const key = tagKeyMap.get(textTagKey);
        if (!key || key.tag_type !== 'text') {
            return false;
        }
    }

    // Check all tag keys to remove exist
    for (const tagKeyId of allTagKeysToRemove) {
        if (!tagKeyMap.has(tagKeyId)) {
            return false;
        }
    }

    return true;
}

export async function updateMacro(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'update_macro' }, memberships: Record<string, string>): Promise<TableRow<'macros'> | null> {
    const existingMacro = await db.selectFrom('macros')
        .selectAll()
        .where('id', '=', data.data.id)
        .executeTakeFirst();

    if (!existingMacro) {
        return null;
    }

    // Check if user has access to the organization
    if (!memberships[existingMacro.organization_id]) {
        return null;
    }

    if (existingMacro.deleted_at) {
        return existingMacro;
    }

    // Validate tag keys before updating
    const isValid = await validateTagKeys(existingMacro.organization_id, data.data.macro);
    if (!isValid) {
        return existingMacro; // Return unchanged if validation fails
    }

    try {
        const updated = await db.updateTable('macros')
            .set({
                macro: data.data.macro,
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

    return existingMacro;
}

export async function createMacro(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'create_macro' }, memberships: Record<string, string>): Promise<TableRow<'macros'> | null> {
    // Only create macro if user has access to the organization
    if (!memberships[data.data.organization_id]) {
        return null;
    }

    // Validate tag keys before creating
    const isValid = await validateTagKeys(data.data.organization_id, data.data.macro);
    if (!isValid) {
        const now = new Date();
        return {
            id: data.data.id,
            organization_id: data.data.organization_id,
            macro: data.data.macro,
            created_at: now,
            updated_at: now,
            deleted_at: now, // Mark as deleted if validation fails
        };
    }

    try {
        return await db.insertInto('macros')
            .values({
                id: data.data.id,
                organization_id: data.data.organization_id,
                macro: data.data.macro,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .returningAll()
            .executeTakeFirstOrThrow();
    } catch (error) {
        if (error instanceof Error && error.message.includes('duplicate key')) {
            const existing = await db.selectFrom('macros')
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
            organization_id: data.data.organization_id,
            macro: data.data.macro,
            created_at: now,
            updated_at: now,
            deleted_at: now,
        };
    }
}

export async function deleteMacro(data: z.infer<typeof SyncInputSchema>[number] & { operation: 'delete_macro' }, memberships: Record<string, string>): Promise<TableRow<'macros'> | null> {
    const existingMacro = await db.selectFrom('macros')
        .selectAll()
        .where('id', '=', data.data.id)
        .executeTakeFirst();

    if (!existingMacro) {
        return null;
    }

    // Check if user has access to the organization
    if (!memberships[existingMacro.organization_id]) {
        return null;
    }

    if (existingMacro.deleted_at) {
        return existingMacro;
    }

    try {
        const updated = await db.updateTable('macros')
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

    return existingMacro;
} 