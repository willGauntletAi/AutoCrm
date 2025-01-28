import { TRPCError } from '@trpc/server';
import { db } from '../../db';
import { MacroData } from './types';

interface ApplyMacroParams {
    macroId: string;
    ticketIds: string[];
    organizationId: string;
    userId: string;
}

export async function applyMacro({ macroId, ticketIds, organizationId, userId }: ApplyMacroParams) {
    // First verify the user has access to the organization
    const membership = await db
        .selectFrom('profile_organization_members')
        .selectAll()
        .where('profile_id', '=', userId)
        .where('organization_id', '=', organizationId)
        .where('deleted_at', 'is', null)
        .executeTakeFirst();

    if (!membership) {
        throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have access to this organization'
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
    }, {} as Record<string, {
        date: Map<string, typeof dateValues[number]>,
        number: Map<string, typeof numberValues[number]>,
        text: Map<string, typeof textValues[number]>,
        enum: Map<string, typeof enumValues[number]>
    }>);

    // Check requirements for each ticket
    const macroData = macro.macro as MacroData;
    const requirements = macroData.requirements;
    const actions = macroData.actions;
    const timestamp = new Date().toISOString();

    // Filter tickets that meet requirements
    const validTickets = tickets.filter(ticket => {
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

    if (validTickets.length === 0) {
        throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'No tickets meet the macro requirements'
        });
    }

    // Apply actions to valid tickets
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

    return {
        appliedToTickets: validTicketIds
    };
} 
