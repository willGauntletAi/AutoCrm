import { Selectable } from 'kysely';
import type { DB } from '../../db/types';
import { TagValuesByTicket } from './types';
import { OpenAI } from 'openai';
import { env } from '../../utils/env';
import { db } from '../../db';
import { createTagSuggestionPrompt, createCommentPrompt, createStatusAndPriorityPrompt, createNextMacroPrompt } from './prompts';

const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY
});

export interface AITagSuggestion {
    type: 'date' | 'number' | 'text' | 'enum';
    tagKeyId: string;
    value: Date | number | string;
}

interface GenerateAITagSuggestionsParams {
    ticket: Selectable<DB['tickets']>;
    tagKeyIds: string[];
    existingTags: TagValuesByTicket;
}

interface GenerateAICommentParams {
    ticket: Selectable<DB['tickets']>;
    prompt: string;
    existingTags: TagValuesByTicket;
}

interface GenerateAIStatusAndPriorityParams {
    ticket: Selectable<DB['tickets']>;
    suggestStatus: boolean;
    suggestPriority: boolean;
    existingTags: TagValuesByTicket;
}

interface SelectNextMacroParams {
    ticket: Selectable<DB['tickets']>;
    draft: { id: string; content?: string | null };
    childMacros: Array<{ id: string; name: string; description: string | null }>;
    existingTags: TagValuesByTicket;
}

export interface TagKeyDetails extends Selectable<DB['ticket_tag_keys']> {
    enumOptions: Array<{
        id: string;
        value: string;
        description: string | null;
    }>;
}

// Helper function to get tag key details
async function getTagKeyDetails(tagKeyId: string): Promise<TagKeyDetails> {
    const tagKey = await db.selectFrom('ticket_tag_keys')
        .selectAll()
        .where('id', '=', tagKeyId)
        .where('deleted_at', 'is', null)
        .executeTakeFirst();

    if (!tagKey) {
        throw new Error(`Tag key ${tagKeyId} not found`);
    }

    // If it's an enum tag, get the possible options
    let enumOptions: Array<{ id: string; value: string; description: string | null }> = [];
    if (tagKey.tag_type === 'enum') {
        enumOptions = await db.selectFrom('ticket_tag_enum_options')
            .select(['id', 'value', 'description'])
            .where('tag_key_id', '=', tagKeyId)
            .where('deleted_at', 'is', null)
            .execute();
    }

    return {
        ...tagKey,
        enumOptions
    };
}

// Helper function to get enum option ID from name
function getEnumOptionIdByName(options: Array<{ id: string; value: string }>, name: string): string | undefined {
    return options.find(opt => opt.value === name)?.id;
}

// Helper function to get enum option name from ID
function getEnumOptionNameById(options: Array<{ id: string; value: string }>, id: string): string | undefined {
    return options.find(opt => opt.id === id)?.value;
}

// Helper function to get ticket comments
async function getTicketComments(ticketId: string): Promise<Selectable<DB['ticket_comments']>[]> {
    return await db.selectFrom('ticket_comments')
        .selectAll()
        .where('ticket_id', '=', ticketId)
        .where('deleted_at', 'is', null)
        .orderBy('created_at', 'asc')
        .execute();
}

export async function generateAITagSuggestions({ ticket, tagKeyIds, existingTags }: GenerateAITagSuggestionsParams): Promise<AITagSuggestion[]> {
    const suggestions: AITagSuggestion[] = [];
    const comments = await getTicketComments(ticket.id);

    // Process each tag key separately
    for (const tagKeyId of tagKeyIds) {
        const tagKey = await getTagKeyDetails(tagKeyId);
        const existingValue = existingTags[tagKey.tag_type as keyof TagValuesByTicket].get(tagKeyId);

        // Define the function schema based on tag type
        const functionSchema = {
            name: 'suggest_tag_value',
            description: `Suggest a value for the ${tagKey.name} tag based on the ticket content`,
            parameters: {
                type: 'object',
                required: ['value'],
                properties: {
                    value: tagKey.tag_type === 'date' ? {
                        type: 'string',
                        format: 'date-time',
                        description: 'The suggested date value in ISO format'
                    } : tagKey.tag_type === 'number' ? {
                        type: 'number',
                        description: 'The suggested numeric value'
                    } : tagKey.tag_type === 'enum' ? {
                        type: 'string',
                        enum: tagKey.enumOptions.map(opt => opt.value),
                        description: 'The name of the suggested enum option'
                    } : {
                        type: 'string',
                        description: 'The suggested text value'
                    }
                }
            }
        };

        const prompt = createTagSuggestionPrompt({
            ticket,
            tagKey,
            comments,
            existingValue,
            getEnumOptionNameById
        });

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant that suggests tag values for tickets based on their content and context. Your suggestions should be logical and consistent with the ticket's content."
                },
                { role: "user", content: prompt }
            ],
            tools: [{
                type: 'function',
                function: functionSchema
            }],
            tool_choice: { type: 'function', function: { name: 'suggest_tag_value' } },
            temperature: 0.7,
        });

        const functionCall = completion?.choices[0]?.message?.tool_calls?.[0]?.function;
        if (functionCall?.arguments) {
            const args = JSON.parse(functionCall.arguments);

            // Type guard to check if args has the expected shape based on tag type
            function isValidResponse(args: unknown): args is { value: string | number } {
                if (typeof args !== 'object' || args === null) {
                    console.error(`[AI Tags] Invalid response for '${tagKey.name}': not an object`);
                    throw new Error('Function call response must be an object');
                }

                if (!('value' in args)) {
                    console.error(`[AI Tags] Invalid response for '${tagKey.name}': missing value property`);
                    throw new Error('Response must include a value property');
                }

                try {
                    switch (tagKey.tag_type) {
                        case 'date':
                            if (typeof args.value !== 'string') {
                                throw new Error('Date value must be a string');
                            }
                            // Validate ISO date format
                            const date = new Date(args.value);
                            if (isNaN(date.getTime())) {
                                throw new Error(`Invalid date format: ${args.value}`);
                            }
                            break;

                        case 'number':
                            if (typeof args.value !== 'number') {
                                throw new Error('Number value must be a number');
                            }
                            break;

                        case 'enum':
                            if (typeof args.value !== 'string') {
                                throw new Error('Enum value must be a string');
                            }
                            if (!tagKey.enumOptions.some(opt => opt.value === args.value)) {
                                throw new Error(`Invalid enum value: ${args.value}. Must be one of: ${tagKey.enumOptions.map(opt => opt.value).join(', ')}`);
                            }
                            break;

                        case 'text':
                            if (typeof args.value !== 'string') {
                                throw new Error('Text value must be a string');
                            }
                            break;

                        default:
                            throw new Error(`Unsupported tag type: ${tagKey.tag_type}`);
                    }
                } catch (error) {
                    console.error(`[AI Tags] Validation error for '${tagKey.name}':`, error);
                    throw error;
                }

                return true;
            }

            if (!isValidResponse(args)) {
                throw new Error('Invalid response format from function call');
            }

            const suggestion = {
                type: tagKey.tag_type as 'date' | 'number' | 'text' | 'enum',
                tagKeyId,
                value: tagKey.tag_type === 'date'
                    ? new Date(args.value as string)
                    : tagKey.tag_type === 'enum'
                        ? getEnumOptionIdByName(tagKey.enumOptions, args.value as string) || args.value
                        : args.value
            };
            console.log(`[AI Tags] Suggested value for '${tagKey.name}':`,
                tagKey.tag_type === 'enum'
                    ? args.value
                    : suggestion.value
            );
            suggestions.push(suggestion);
        } else {
            console.warn(`[AI Tags] No suggestion received for '${tagKey.name}'`);
        }
    }

    return suggestions;
}

export async function generateAIComment({ ticket, prompt: userPrompt, existingTags }: GenerateAICommentParams) {
    const comments = await getTicketComments(ticket.id);

    const systemPrompt = createCommentPrompt({
        ticket,
        comments,
        existingTags,
        userPrompt
    });

    const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: "You are a helpful assistant that generates relevant comments for tickets based on their content and context."
            },
            { role: "user", content: systemPrompt }
        ],
        temperature: 0.7,
    });

    return completion.choices[0]?.message.content || null;
}

export async function generateAIStatusAndPriority({ ticket, suggestStatus, suggestPriority, existingTags }: GenerateAIStatusAndPriorityParams) {
    const comments = await getTicketComments(ticket.id);

    const prompt = createStatusAndPriorityPrompt({
        ticket,
        comments,
        existingTags,
        suggestStatus,
        suggestPriority
    });

    // Define the function schema based on what we're suggesting
    const functionSchema = {
        name: 'suggest_status_and_priority',
        description: `Suggest ${suggestStatus ? 'status' : ''}${suggestStatus && suggestPriority ? ' and ' : ''}${suggestPriority ? 'priority' : ''} for the ticket`,
        parameters: {
            type: 'object',
            required: [],
            properties: {
                ...(suggestStatus ? {
                    status: {
                        type: 'string',
                        enum: ['open', 'in_progress', 'resolved', 'closed'],
                        description: 'The suggested status for the ticket'
                    }
                } : {}),
                ...(suggestPriority ? {
                    priority: {
                        type: 'string',
                        enum: ['high', 'medium', 'low'],
                        description: 'The suggested priority for the ticket'
                    }
                } : {})
            }
        }
    };

    const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: `You are a helpful assistant that suggests ${suggestStatus ? 'status' : ''}${suggestStatus && suggestPriority ? ' and ' : ''}${suggestPriority ? 'priority' : ''} for tickets based on their content and context.`
            },
            { role: "user", content: prompt }
        ],
        tools: [{
            type: 'function',
            function: functionSchema
        }],
        tool_choice: { type: 'function', function: { name: 'suggest_status_and_priority' } },
        temperature: 0.7,
    });

    const functionCall = completion?.choices[0]?.message?.tool_calls?.[0]?.function;
    if (!functionCall?.arguments) return null;

    const args = JSON.parse(functionCall.arguments);

    // Type guard to check if args has the expected shape
    function isValidResponse(args: unknown): args is { status?: string; priority?: string } {
        if (typeof args !== 'object' || args === null) {
            throw new Error('Function call response must be an object');
        }

        // Check status if it was requested
        if (suggestStatus) {
            if (!('status' in args)) {
                throw new Error('Status was requested but not provided in response');
            }
            if (typeof args.status !== 'string') {
                throw new Error('Status must be a string');
            }
            if (!['open', 'in_progress', 'blocked', 'resolved', 'closed'].includes(args.status)) {
                throw new Error(`Invalid status value: ${args.status}`);
            }
        }

        // Check priority if it was requested
        if (suggestPriority) {
            if (!('priority' in args)) {
                throw new Error('Priority was requested but not provided in response');
            }
            if (typeof args.priority !== 'string') {
                throw new Error('Priority must be a string');
            }
            if (!['high', 'medium', 'low'].includes(args.priority)) {
                throw new Error(`Invalid priority value: ${args.priority}`);
            }
        }

        return true;
    }

    if (!isValidResponse(args)) {
        throw new Error('Invalid response format from function call');
    }

    return {
        status: suggestStatus ? args.status : undefined,
        priority: suggestPriority ? args.priority : undefined
    };
}

export async function selectNextMacro({ ticket, draft, childMacros, existingTags }: SelectNextMacroParams): Promise<string | null> {
    if (childMacros.length === 0) return null;

    const prompt = createNextMacroPrompt({ ticket, draft, childMacros, existingTags });

    // Define the function schema
    const functionSchema = {
        name: 'select_next_macro',
        description: 'Select the next macro to apply in the chain',
        parameters: {
            type: 'object',
            required: ['macroName'],
            properties: {
                macroName: {
                    type: 'string',
                    enum: [...childMacros.map(m => m.name), 'none'],
                    description: 'The name of the selected macro, or "none" if no macro should be applied'
                },
                reasoning: {
                    type: 'string',
                    description: 'A brief explanation of why this macro was selected or why none was chosen'
                }
            }
        }
    };

    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: 'You are a helpful assistant that selects the most appropriate macro to apply next in a support ticket workflow.' },
            { role: 'user', content: prompt }
        ],
        tools: [{
            type: 'function',
            function: functionSchema
        }],
        tool_choice: { type: 'function', function: { name: 'select_next_macro' } },
        temperature: 0
    });

    const functionCall = response?.choices[0]?.message?.tool_calls?.[0]?.function;
    if (!functionCall?.arguments) return null;

    const args = JSON.parse(functionCall.arguments);

    // Type guard to check if args has the expected shape
    function isValidResponse(args: unknown): args is { macroName: string; reasoning?: string } {
        if (typeof args !== 'object' || args === null) {
            console.error('[Next Macro] Invalid response: not an object');
            return false;
        }

        if (!('macroName' in args)) {
            console.error('[Next Macro] Invalid response: missing macroName');
            return false;
        }

        if (typeof args.macroName !== 'string') {
            console.error('[Next Macro] Invalid response: macroName is not a string');
            return false;
        }

        if (args.macroName !== 'none' && !childMacros.some(m => m.name === args.macroName)) {
            console.error(`[Next Macro] Invalid response: invalid macroName ${args.macroName}`);
            return false;
        }

        if ('reasoning' in args && typeof args.reasoning !== 'string') {
            console.error('[Next Macro] Invalid response: reasoning is not a string');
            return false;
        }

        return true;
    }

    if (!isValidResponse(args)) {
        console.error('[Next Macro] Invalid response format from function call');
        return null;
    }

    if (args.reasoning) {
        console.log(`[Next Macro] Selected ${args.macroName === 'none' ? 'none' : `macro "${args.macroName}"`} because: ${args.reasoning}`);
    }

    // Convert the selected name back to an ID
    if (args.macroName === 'none') return null;
    const selectedMacro = childMacros.find(m => m.name === args.macroName);
    return selectedMacro?.id ?? null;
}