import { db } from '../../../db';
import { TableRow } from '../schema';
import { z } from 'zod';
import { SyncInputSchema } from '../schema';

export async function updateTicketDraft(
    operation: z.infer<typeof SyncInputSchema>[number] & { operation: 'update_ticket_draft' },
    memberships: Record<string, string>
): Promise<TableRow<'ticket_drafts'> | null> {
    console.log('Handling update_ticket_draft operation:', operation);
    try {
        // Get the draft and check permissions
        const existingDraft = await db.selectFrom('ticket_drafts')
            .selectAll()
            .where('id', '=', operation.data.id)
            .executeTakeFirst();

        console.log('Found existing draft:', existingDraft);

        if (!existingDraft) {
            console.log('Draft not found');
            return null;
        }

        // Check if user has access to the organization
        if (!memberships[existingDraft.organization_id]) {
            console.log('User does not have access to organization:', existingDraft.organization_id);
            return null;
        }

        // Update the draft
        const updated = await db.updateTable('ticket_drafts')
            .set({
                ...operation.data,
                updated_at: new Date().toISOString(),
            })
            .where('id', '=', operation.data.id)
            .returningAll()
            .executeTakeFirst();

        console.log('Updated draft:', updated);

        return updated || null;
    } catch (error) {
        console.error('Error updating ticket draft:', error);
        return null;
    }
} 