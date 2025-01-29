import { TRPCError } from '@trpc/server';
import { db } from '../../db';
import { type MacroRequirements, type MacroData, type MacroActions, MacroDataSchema } from './types';
import { Insertable, Selectable, ValueExpression } from 'kysely';
import type { DB } from '../../db/types';
import { generateAIComment, generateAIStatusAndPriority, generateAITagSuggestions } from './ai';
import { TagValuesByTicket } from './types';

type TableName = keyof DB;
type InsertObject<T extends TableName> = Insertable<DB[T]>;

interface ApplyMacroParams {
    macroId: string;
    ticketIds: string[];
    organizationId: string;
    userId: string;
    organizationRoles: Record<string, string>;
}

async function validateUserAndMacro({ macroId, organizationId, organizationRoles }: Pick<ApplyMacroParams, 'macroId' | 'organizationId' | 'organizationRoles'>): Promise<MacroData> {
    // Verify the user has access to the organization
    const userRole = organizationRoles[organizationId];
    if (!userRole) {
        throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have access to this organization'
        });
    }

    // Prevent customers from applying macros
    if (userRole === 'customer') {
        throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Customers cannot apply macros'
        });
    }

    // Get the macro
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

    return parsedMacroResult.data;
}

async function getTicketsAndTagValues({ ticketIds, organizationId }: Pick<ApplyMacroParams, 'ticketIds' | 'organizationId'>) {
    // Get all tickets
    const tickets = await db
        .selectFrom('tickets')
        .selectAll()
        .where('id', 'in', ticketIds)
        .where('organization_id', '=', organizationId)
        .where('deleted_at', 'is', null)
        .execute();

    if (tickets.length !== ticketIds.length) {
        throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'One or more tickets not found'
        });
    }

    // Get all tag values for these tickets
    const [dateValues, numberValues, textValues, enumValues] = await Promise.all([
        db.selectFrom('ticket_tag_date_values')
            .selectAll()
            .where('ticket_id', 'in', ticketIds)
            .where('deleted_at', 'is', null)
            .execute(),
        db.selectFrom('ticket_tag_number_values')
            .selectAll()
            .where('ticket_id', 'in', ticketIds)
            .where('deleted_at', 'is', null)
            .execute(),
        db.selectFrom('ticket_tag_text_values')
            .selectAll()
            .where('ticket_id', 'in', ticketIds)
            .where('deleted_at', 'is', null)
            .execute(),
        db.selectFrom('ticket_tag_enum_values')
            .selectAll()
            .where('ticket_id', 'in', ticketIds)
            .where('deleted_at', 'is', null)
            .execute()
    ]);

    // Group tag values by ticket ID
    const tagValuesByTicket = tickets.reduce((acc, ticket) => {
        acc[ticket.id] = {
            date: new Map(dateValues.filter(v => v.ticket_id === ticket.id).map(v => [v.tag_key_id, v])),
            number: new Map(numberValues.filter(v => v.ticket_id === ticket.id).map(v => [v.tag_key_id, v])),
            text: new Map(textValues.filter(v => v.ticket_id === ticket.id).map(v => [v.tag_key_id, v])),
            enum: new Map(enumValues.filter(v => v.ticket_id === ticket.id).map(v => [v.tag_key_id, v]))
        };
        return acc;
    }, {} as Record<string, TagValuesByTicket>);

    return { tickets, tagValuesByTicket };
}

function filterValidTickets(tickets: Selectable<DB['tickets']>[], tagValuesByTicket: Record<string, TagValuesByTicket>, requirements: MacroRequirements) {
    return tickets.filter(ticket => {
        // Check ticket status requirement
        if (requirements.status && requirements.status !== ticket.status) {
            return false;
        }

        // Check ticket priority requirement
        if (requirements.priority && requirements.priority !== ticket.priority) {
            return false;
        }

        // Check created_at requirement
        if (requirements.created_at) {
            const ticketCreatedAt = new Date(ticket.created_at || '').getTime();
            if (requirements.created_at.before && ticketCreatedAt >= requirements.created_at.before) {
                return false;
            }
            if (requirements.created_at.after && ticketCreatedAt <= requirements.created_at.after) {
                return false;
            }
        }

        // Check updated_at requirement
        if (requirements.updated_at) {
            const ticketUpdatedAt = new Date(ticket.updated_at || '').getTime();
            if (requirements.updated_at.before && ticketUpdatedAt >= requirements.updated_at.before) {
                return false;
            }
            if (requirements.updated_at.after && ticketUpdatedAt <= requirements.updated_at.after) {
                return false;
            }
        }

        const ticketTags = tagValuesByTicket[ticket.id];

        // Check date tag requirements
        for (const [tagKeyId, requirement] of Object.entries(requirements.date_tag_requirements)) {
            const tagValue = ticketTags.date.get(tagKeyId);
            if (!tagValue) return false;

            const valueDate = new Date(tagValue.value).getTime();
            const now = new Date().getTime();
            const dayInMs = 24 * 60 * 60 * 1000;

            if (requirement.before !== undefined) {
                const beforeDate = now + (requirement.before * dayInMs);
                if (valueDate >= beforeDate) return false;
            }
            if (requirement.after !== undefined) {
                const afterDate = now + (requirement.after * dayInMs);
                if (valueDate <= afterDate) return false;
            }
            if (requirement.equals !== undefined) {
                const equalsDate = now + (Number(requirement.equals) * dayInMs);
                if (Math.abs(valueDate - equalsDate) > dayInMs) return false;
            }
        }

        // Check number tag requirements
        for (const [tagKeyId, requirement] of Object.entries(requirements.number_tag_requirements)) {
            const tagValue = ticketTags.number.get(tagKeyId);
            if (!tagValue) return false;

            const value = Number(tagValue.value);
            if (requirement.min !== undefined && value < requirement.min) return false;
            if (requirement.max !== undefined && value > requirement.max) return false;
            if (requirement.equals !== undefined && value !== requirement.equals) return false;
        }

        // Check text tag requirements
        for (const [tagKeyId, requirement] of Object.entries(requirements.text_tag_requirements)) {
            const tagValue = ticketTags.text.get(tagKeyId);
            if (!tagValue) return false;

            if (requirement.equals !== undefined && tagValue.value !== requirement.equals) return false;
            if (requirement.contains !== undefined && !tagValue.value.includes(requirement.contains)) return false;
            if (requirement.regex !== undefined && !new RegExp(requirement.regex).test(tagValue.value)) return false;
        }

        // Check enum tag requirements
        for (const [tagKeyId, requirement] of Object.entries(requirements.enum_tag_requirements)) {
            const tagValue = ticketTags.enum.get(tagKeyId);
            if (!tagValue) return false;

            if (Array.isArray(requirement)) {
                // If requirement is array, it's a NOT IN condition
                if (requirement.includes(tagValue.enum_option_id)) return false;
            } else {
                // If requirement is string, it's an equals condition
                if (tagValue.enum_option_id !== requirement) return false;
            }
        }

        return true;
    });
}

async function applyRegularActions(
    validTickets: Selectable<DB['tickets']>[],
    actions: MacroActions,
    userId: string,
    tagValuesByTicket: Record<string, TagValuesByTicket>,
    timestamp: string
) {
    const validTicketIds = validTickets.map(t => t.id);

    // Update ticket status and priority if specified
    if (actions.new_status || actions.new_priority) {
        await db
            .updateTable('tickets')
            .set({
                ...(actions.new_status ? { status: actions.new_status } : {}),
                ...(actions.new_priority ? { priority: actions.new_priority } : {}),
                updated_at: timestamp
            })
            .where('id', 'in', validTicketIds)
            .execute();
    }

    // Remove specified tags
    if (actions.tag_keys_to_remove.length > 0) {
        await Promise.all([
            db.updateTable('ticket_tag_date_values')
                .set({ deleted_at: timestamp, updated_at: timestamp })
                .where('ticket_id', 'in', validTicketIds)
                .where('tag_key_id', 'in', actions.tag_keys_to_remove)
                .execute(),
            db.updateTable('ticket_tag_number_values')
                .set({ deleted_at: timestamp, updated_at: timestamp })
                .where('ticket_id', 'in', validTicketIds)
                .where('tag_key_id', 'in', actions.tag_keys_to_remove)
                .execute(),
            db.updateTable('ticket_tag_text_values')
                .set({ deleted_at: timestamp, updated_at: timestamp })
                .where('ticket_id', 'in', validTicketIds)
                .where('tag_key_id', 'in', actions.tag_keys_to_remove)
                .execute(),
            db.updateTable('ticket_tag_enum_values')
                .set({ deleted_at: timestamp, updated_at: timestamp })
                .where('ticket_id', 'in', validTicketIds)
                .where('tag_key_id', 'in', actions.tag_keys_to_remove)
                .execute()
        ]);
    }

    // Add or update tags
    const { date_tags, number_tags, text_tags, enum_tags } = actions.tags_to_modify;

    // Handle date tags
    for (const [tagKeyId, value] of Object.entries(date_tags)) {
        const date = new Date();
        date.setDate(date.getDate() + Number(value));

        for (const ticketId of validTicketIds) {
            const existingValue = tagValuesByTicket[ticketId].date.get(tagKeyId);
            if (existingValue) {
                await db
                    .updateTable('ticket_tag_date_values')
                    .set({
                        value: date,
                        updated_at: timestamp
                    })
                    .where('id', '=', existingValue.id)
                    .execute();
            } else {
                await db
                    .insertInto('ticket_tag_date_values')
                    .values({
                        id: crypto.randomUUID(),
                        ticket_id: ticketId,
                        tag_key_id: tagKeyId,
                        value: date,
                        created_at: timestamp,
                        updated_at: timestamp
                    })
                    .execute();
            }
        }
    }

    // Handle number tags
    for (const [tagKeyId, value] of Object.entries(number_tags)) {
        for (const ticketId of validTicketIds) {
            const existingValue = tagValuesByTicket[ticketId].number.get(tagKeyId);
            if (existingValue) {
                await db
                    .updateTable('ticket_tag_number_values')
                    .set({
                        value: value.toString(),
                        updated_at: timestamp
                    })
                    .where('id', '=', existingValue.id)
                    .execute();
            } else {
                await db
                    .insertInto('ticket_tag_number_values')
                    .values({
                        id: crypto.randomUUID(),
                        ticket_id: ticketId,
                        tag_key_id: tagKeyId,
                        value: value.toString(),
                        created_at: timestamp,
                        updated_at: timestamp
                    })
                    .execute();
            }
        }
    }

    // Handle text tags
    for (const [tagKeyId, value] of Object.entries(text_tags)) {
        for (const ticketId of validTicketIds) {
            const existingValue = tagValuesByTicket[ticketId].text.get(tagKeyId);
            if (existingValue) {
                await db
                    .updateTable('ticket_tag_text_values')
                    .set({
                        value,
                        updated_at: timestamp
                    })
                    .where('id', '=', existingValue.id)
                    .execute();
            } else {
                await db
                    .insertInto('ticket_tag_text_values')
                    .values({
                        id: crypto.randomUUID(),
                        ticket_id: ticketId,
                        tag_key_id: tagKeyId,
                        value,
                        created_at: timestamp,
                        updated_at: timestamp
                    })
                    .execute();
            }
        }
    }

    // Handle enum tags
    for (const [tagKeyId, enumOptionId] of Object.entries(enum_tags)) {
        for (const ticketId of validTicketIds) {
            const existingValue = tagValuesByTicket[ticketId].enum.get(tagKeyId);
            if (existingValue) {
                await db
                    .updateTable('ticket_tag_enum_values')
                    .set({
                        enum_option_id: enumOptionId,
                        updated_at: timestamp
                    })
                    .where('id', '=', existingValue.id)
                    .execute();
            } else {
                await db
                    .insertInto('ticket_tag_enum_values')
                    .values({
                        id: crypto.randomUUID(),
                        ticket_id: ticketId,
                        tag_key_id: tagKeyId,
                        enum_option_id: enumOptionId,
                        created_at: timestamp,
                        updated_at: timestamp
                    })
                    .execute();
            }
        }
    }

    // Add comment if specified
    if (actions.comment) {
        await Promise.all(validTicketIds.map(ticketId =>
            db.insertInto('ticket_comments')
                .values({
                    id: crypto.randomUUID(),
                    ticket_id: ticketId,
                    comment: actions.comment!,
                    user_id: userId,
                    created_at: timestamp,
                    updated_at: timestamp
                })
                .execute()
        ));
    }

    return validTicketIds;
}

async function applyAIActions(
    ticket: Selectable<DB['tickets']>,
    draft: { id: string },
    aiActions: NonNullable<MacroData['aiActions']>,
    userId: string,
    ticketTags: TagValuesByTicket
) {
    // Generate AI suggestions in parallel
    const [tagSuggestions, commentSuggestion, statusAndPrioritySuggestion] = await Promise.all([
        // Generate tag suggestions if requested
        aiActions.tagActions.length > 0
            ? generateAITagSuggestions({
                ticket,
                tagKeyIds: aiActions.tagActions,
                existingTags: ticketTags
            })
            : Promise.resolve(null),

        // Generate comment if requested
        aiActions.commentAction
            ? generateAIComment({
                ticket,
                prompt: aiActions.commentAction.prompt,
                existingTags: ticketTags
            })
            : Promise.resolve(null),

        // Generate status and priority if requested
        (aiActions.shouldSuggestStatus || aiActions.shouldSuggestPriority)
            ? generateAIStatusAndPriority({
                ticket,
                suggestStatus: aiActions.shouldSuggestStatus,
                suggestPriority: aiActions.shouldSuggestPriority,
                existingTags: ticketTags
            })
            : Promise.resolve(null)
    ]);

    // Apply tag suggestions
    if (tagSuggestions) {
        for (const suggestion of tagSuggestions) {
            switch (suggestion.type) {
                case 'date': {
                    const dateInsert: InsertObject<'ticket_draft_tag_date_values'> = {
                        ticket_draft_id: draft.id,
                        tag_key_id: suggestion.tagKeyId,
                        value: suggestion.value as Date
                    };
                    await db.insertInto('ticket_draft_tag_date_values')
                        .values(dateInsert)
                        .execute();
                    break;
                }
                case 'number': {
                    const numberInsert: InsertObject<'ticket_draft_tag_number_values'> = {
                        ticket_draft_id: draft.id,
                        tag_key_id: suggestion.tagKeyId,
                        value: suggestion.value.toString()
                    };
                    await db.insertInto('ticket_draft_tag_number_values')
                        .values(numberInsert)
                        .execute();
                    break;
                }
                case 'text': {
                    const textInsert: InsertObject<'ticket_draft_tag_text_values'> = {
                        ticket_draft_id: draft.id,
                        tag_key_id: suggestion.tagKeyId,
                        value: suggestion.value as string
                    };
                    await db.insertInto('ticket_draft_tag_text_values')
                        .values(textInsert)
                        .execute();
                    break;
                }
                case 'enum': {
                    const enumInsert: InsertObject<'ticket_draft_tag_enum_values'> = {
                        ticket_draft_id: draft.id,
                        tag_key_id: suggestion.tagKeyId,
                        enum_option_id: suggestion.value as string
                    };
                    await db.insertInto('ticket_draft_tag_enum_values')
                        .values(enumInsert)
                        .execute();
                    break;
                }
            }
        }
    }

    // Apply comment suggestion
    if (commentSuggestion) {
        const commentInsert: InsertObject<'ticket_draft_comments'> = {
            ticket_draft_id: draft.id,
            user_id: userId,
            comment: commentSuggestion
        };
        await db.insertInto('ticket_draft_comments')
            .values(commentInsert)
            .execute();
    }

    // Apply status and priority suggestions
    if (statusAndPrioritySuggestion) {
        const updateValues: Partial<InsertObject<'ticket_drafts'>> = {
            ...(statusAndPrioritySuggestion.status ? { status: statusAndPrioritySuggestion.status } : {}),
            ...(statusAndPrioritySuggestion.priority ? { priority: statusAndPrioritySuggestion.priority } : {})
        };
        await db.updateTable('ticket_drafts')
            .set(updateValues)
            .where('id', '=', draft.id)
            .execute();
    }
}

async function createDraftForTicket(
    ticket: Selectable<DB['tickets']>,
    macroId: string,
    userId: string,
    organizationId: string,
    ticketTags: TagValuesByTicket
): Promise<{ id: string }> {
    const draftInsert: InsertObject<'ticket_drafts'> = {
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        draft_status: 'unreviewed',
        created_by: userId,
        created_by_macro: macroId,
        assigned_to: ticket.assigned_to,
        organization_id: organizationId,
        original_ticket_id: ticket.id
    };

    const draft = await db
        .insertInto('ticket_drafts')
        .values(draftInsert)
        .returning(['id'])
        .executeTakeFirstOrThrow();

    // Copy over the tag values to the draft
    await Promise.all([
        // Copy date tags
        ...Array.from(ticketTags.date.values()).map((tag: Selectable<DB['ticket_tag_date_values']>) => {
            const dateInsert: InsertObject<'ticket_draft_tag_date_values'> = {
                ticket_draft_id: draft.id,
                tag_key_id: tag.tag_key_id,
                value: tag.value
            };
            return db.insertInto('ticket_draft_tag_date_values')
                .values(dateInsert)
                .execute();
        }),

        // Copy number tags
        ...Array.from(ticketTags.number.values()).map((tag: Selectable<DB['ticket_tag_number_values']>) => {
            const numberInsert: InsertObject<'ticket_draft_tag_number_values'> = {
                ticket_draft_id: draft.id,
                tag_key_id: tag.tag_key_id,
                value: tag.value
            };
            return db.insertInto('ticket_draft_tag_number_values')
                .values(numberInsert)
                .execute();
        }),

        // Copy text tags
        ...Array.from(ticketTags.text.values()).map((tag: Selectable<DB['ticket_tag_text_values']>) => {
            const textInsert: InsertObject<'ticket_draft_tag_text_values'> = {
                ticket_draft_id: draft.id,
                tag_key_id: tag.tag_key_id,
                value: tag.value
            };
            return db.insertInto('ticket_draft_tag_text_values')
                .values(textInsert)
                .execute();
        }),

        // Copy enum tags
        ...Array.from(ticketTags.enum.values()).map((tag: Selectable<DB['ticket_tag_enum_values']>) => {
            const enumInsert: InsertObject<'ticket_draft_tag_enum_values'> = {
                ticket_draft_id: draft.id,
                tag_key_id: tag.tag_key_id,
                enum_option_id: tag.enum_option_id
            };
            return db.insertInto('ticket_draft_tag_enum_values')
                .values(enumInsert)
                .execute();
        })
    ]);

    return draft;
}

export async function applyMacro({ macroId, ticketIds, organizationId, userId, organizationRoles }: ApplyMacroParams) {
    // Step 1: Validate user permissions and get macro data
    const macroData = await validateUserAndMacro({ macroId, organizationId, organizationRoles });

    // Step 2: Get tickets and their tag values
    const { tickets, tagValuesByTicket } = await getTicketsAndTagValues({ ticketIds, organizationId });

    // Step 3: Filter tickets that meet requirements
    const validTickets = filterValidTickets(tickets, tagValuesByTicket, macroData.requirements);

    if (validTickets.length === 0) {
        throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'No tickets meet the macro requirements'
        });
    }

    const timestamp = new Date().toISOString();

    // Step 4: Apply regular actions if any exist
    if (macroData.actions.new_status || macroData.actions.new_priority || macroData.actions.tag_keys_to_remove.length > 0 ||
        Object.keys(macroData.actions.tags_to_modify.date_tags).length > 0 ||
        Object.keys(macroData.actions.tags_to_modify.number_tags).length > 0 ||
        Object.keys(macroData.actions.tags_to_modify.text_tags).length > 0 ||
        Object.keys(macroData.actions.tags_to_modify.enum_tags).length > 0 ||
        macroData.actions.comment) {

        const validTicketIds = await applyRegularActions(validTickets, macroData.actions, userId, tagValuesByTicket, timestamp);
        return { appliedToTickets: validTicketIds };
    }

    // Step 5: Handle AI actions if present
    if (macroData.aiActions) {
        const drafts = await Promise.all(validTickets.map(async ticket => {
            // Create draft with ticket data
            const draft = await createDraftForTicket(ticket, macroId, userId, organizationId, tagValuesByTicket[ticket.id]);

            // Apply AI actions to the draft
            await applyAIActions(ticket, draft, macroData.aiActions!, userId, tagValuesByTicket[ticket.id]);

            return draft.id;
        }));

        return {
            createdDrafts: drafts,
            appliedToTickets: [] // No direct changes were made to tickets
        };
    }

    return {
        appliedToTickets: validTickets.map(t => t.id)
    };
} 
