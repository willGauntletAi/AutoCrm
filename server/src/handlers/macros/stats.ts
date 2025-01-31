import { db } from '../../db';
import { TRPCError } from '@trpc/server';
import { MacroDataSchema } from '../../types/macros';

interface GetMacroStatsParams {
    macroId: string;
    organizationId: string;
    organizationRoles: Record<string, string>;
}

export async function getMacroStats({ macroId, organizationId, organizationRoles }: GetMacroStatsParams) {
    // Verify the user has access to the organization
    const userRole = organizationRoles[organizationId];
    if (!userRole) {
        throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have access to this organization'
        });
    }

    // Get the macro to verify it exists and get its name
    const macro = await db
        .selectFrom('macros')
        .selectAll()
        .where('id', '=', macroId)
        .where('organization_id', '=', organizationId)
        .where('deleted_at', 'is', null)
        .executeTakeFirst();

    if (!macro) {
        throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Macro not found'
        });
    }

    // Parse and validate the macro data
    const parsedMacroResult = MacroDataSchema.safeParse(macro.macro);
    if (!parsedMacroResult.success) {
        throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid macro data structure'
        });
    }

    const macroData = parsedMacroResult.data;

    // Get statistics from ticket drafts
    const stats = await db
        .selectFrom('ticket_drafts')
        .innerJoin('ticket_draft_macros', 'ticket_draft_macros.ticket_draft_id', 'ticket_drafts.id')
        .where('ticket_draft_macros.macro_id', '=', macroId)
        .where('ticket_drafts.organization_id', '=', organizationId)
        .where('ticket_drafts.deleted_at', 'is', null)
        .select([
            db.fn.avg('latency').as('avgLatency'),
            db.fn.count('ticket_drafts.id').as('totalDrafts'),
            db.fn
                .count(
                    db.case()
                        .when('ticket_drafts.draft_status', '=', 'accepted')
                        .then(1)
                        .end()
                )
                .as('approvedCount'),
            db.fn
                .count(
                    db.case()
                        .when('ticket_drafts.draft_status', '=', 'partially_accepted')
                        .then(1)
                        .when('ticket_drafts.draft_status', '=', 'accepted')
                        .then(1)
                        .end()
                )
                .as('partiallyApprovedCount')
        ])
        .executeTakeFirst();

    if (!stats) {
        return {
            name: macroData.name,
            avgLatency: 0,
            avgCompleteSuccess: 0,
            avgPartialSuccess: 0
        };
    }

    const totalDrafts = Number(stats.totalDrafts) || 1; // Avoid division by zero

    return {
        name: macroData.name,
        avgLatency: Number(stats.avgLatency) || 0,
        avgCompleteSuccess: (Number(stats.approvedCount) / totalDrafts) * 100,
        avgPartialSuccess: (Number(stats.partiallyApprovedCount) / totalDrafts) * 100
    };
} 
