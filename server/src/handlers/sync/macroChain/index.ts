import { db } from '../../../db';
import { TableRow } from '../schema';

export async function createMacroChain(
    operation: { data: { id: string; parent_macro_id: string; child_macro_id: string } },
    memberships: Record<string, string>
): Promise<TableRow<'macro_chains'> | null> {
    // First check if both macros exist and get their organization IDs
    const [parentMacro, childMacro] = await Promise.all([
        db.selectFrom('macros')
            .select(['organization_id', 'deleted_at'])
            .where('id', '=', operation.data.parent_macro_id)
            .executeTakeFirst(),
        db.selectFrom('macros')
            .select(['organization_id', 'deleted_at'])
            .where('id', '=', operation.data.child_macro_id)
            .executeTakeFirst(),
    ]);

    // Check if both macros exist and belong to the same organization
    if (!parentMacro || !childMacro || parentMacro.organization_id !== childMacro.organization_id) {
        return null;
    }

    // Check if either macro is deleted
    if (parentMacro.deleted_at || childMacro.deleted_at) {
        return null;
    }

    // Check if user has admin access to the organization
    if (memberships[parentMacro.organization_id] !== 'admin') {
        return null;
    }

    try {
        return await db.insertInto('macro_chains')
            .values({
                id: operation.data.id,
                parent_macro_id: operation.data.parent_macro_id,
                child_macro_id: operation.data.child_macro_id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .returningAll()
            .executeTakeFirstOrThrow();
    } catch (error) {
        if (error instanceof Error && error.message.includes('duplicate key')) {
            const existing = await db.selectFrom('macro_chains')
                .selectAll()
                .where('id', '=', operation.data.id)
                .executeTakeFirst();

            if (existing) {
                return existing;
            }
        }
        const now = new Date();
        return {
            id: operation.data.id,
            parent_macro_id: operation.data.parent_macro_id,
            child_macro_id: operation.data.child_macro_id,
            created_at: now,
            updated_at: now,
            deleted_at: now,
        };
    }
}

export async function updateMacroChain(
    operation: { data: { id: string; parent_macro_id: string; child_macro_id: string } },
    memberships: Record<string, string>
): Promise<TableRow<'macro_chains'> | null> {
    // First check if the chain exists
    const existingChain = await db.selectFrom('macro_chains')
        .selectAll()
        .where('id', '=', operation.data.id)
        .executeTakeFirst();

    if (!existingChain) {
        return null;
    }

    // If deleted, return as-is
    if (existingChain.deleted_at) {
        return existingChain;
    }

    // Check if both macros exist and get their organization IDs
    const [parentMacro, childMacro] = await Promise.all([
        db.selectFrom('macros')
            .select(['organization_id', 'deleted_at'])
            .where('id', '=', operation.data.parent_macro_id)
            .executeTakeFirst(),
        db.selectFrom('macros')
            .select(['organization_id', 'deleted_at'])
            .where('id', '=', operation.data.child_macro_id)
            .executeTakeFirst(),
    ]);

    // Check if both macros exist and belong to the same organization
    if (!parentMacro || !childMacro || parentMacro.organization_id !== childMacro.organization_id) {
        return null;
    }

    // Check if either macro is deleted
    if (parentMacro.deleted_at || childMacro.deleted_at) {
        return null;
    }

    // Check if user has admin access to the organization
    if (memberships[parentMacro.organization_id] !== 'admin') {
        return null;
    }

    try {
        const updated = await db.updateTable('macro_chains')
            .set({
                parent_macro_id: operation.data.parent_macro_id,
                child_macro_id: operation.data.child_macro_id,
                updated_at: new Date().toISOString(),
            })
            .where('id', '=', operation.data.id)
            .returningAll()
            .executeTakeFirst();

        if (updated) {
            return updated;
        }
    } catch (error) {
        // Fall through to return unchanged value
    }

    return existingChain;
}

export async function deleteMacroChain(
    operation: { data: { id: string } },
    memberships: Record<string, string>
): Promise<TableRow<'macro_chains'> | null> {
    // First check if the chain exists
    const existingChain = await db.selectFrom('macro_chains')
        .selectAll()
        .where('id', '=', operation.data.id)
        .executeTakeFirst();

    if (!existingChain) {
        return null;
    }

    // If already deleted, return as-is
    if (existingChain.deleted_at) {
        return existingChain;
    }

    // Get the parent macro to check organization access
    const parentMacro = await db.selectFrom('macros')
        .select(['organization_id'])
        .where('id', '=', existingChain.parent_macro_id)
        .executeTakeFirst();

    if (!parentMacro) {
        return null;
    }

    // Check if user has admin access to the organization
    if (memberships[parentMacro.organization_id] !== 'admin') {
        return null;
    }

    try {
        const updated = await db.updateTable('macro_chains')
            .set({
                deleted_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .where('id', '=', operation.data.id)
            .returningAll()
            .executeTakeFirst();

        if (updated) {
            return updated;
        }
    } catch (error) {
        // Fall through to return unchanged value
    }

    return existingChain;
} 
