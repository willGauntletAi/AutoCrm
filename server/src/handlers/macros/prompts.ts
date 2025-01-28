import { Selectable } from 'kysely';
import type { DB } from '../../db/types';
import { TagValuesByTicket } from './types';
import { TagKeyDetails } from './ai';

export function createTagSuggestionPrompt({
    ticket,
    tagKey,
    comments,
    existingValue,
    getEnumOptionNameById
}: {
    ticket: Selectable<DB['tickets']>;
    tagKey: TagKeyDetails;
    comments: Selectable<DB['ticket_comments']>[];
    existingValue: Selectable<DB['ticket_tag_date_values']> | Selectable<DB['ticket_tag_number_values']> | Selectable<DB['ticket_tag_text_values']> | Selectable<DB['ticket_tag_enum_values']> | undefined;
    getEnumOptionNameById: (options: Array<{ id: string; value: string }>, id: string) => string | undefined;
}) {
    return `Given the following ticket, suggest an appropriate value for the "${tagKey.name}" tag.

Ticket:
Title: ${ticket.title}
Description: ${ticket.description || 'No description'}
Status: ${ticket.status}
Priority: ${ticket.priority}

Comments:
${formatComments(comments)}

Tag Details:
Name: ${tagKey.name}
Type: ${tagKey.tag_type}
Description: ${tagKey.description || 'No description'}
${tagKey.tag_type === 'enum' ? `
Possible Values:
${tagKey.enumOptions.map(opt => `- ${opt.value}${opt.description ? `\n  Description: ${opt.description}` : ''}`).join('\n')}

Note: Please choose one of the above values exactly as written.` : ''}

Current Value: ${existingValue ? (
            tagKey.tag_type === 'enum'
                ? getEnumOptionNameById(tagKey.enumOptions, (existingValue as Selectable<DB['ticket_tag_enum_values']>).enum_option_id) || 'Unknown'
                : tagKey.tag_type === 'date'
                    ? (existingValue as Selectable<DB['ticket_tag_date_values']>).value.toISOString()
                    : tagKey.tag_type === 'number'
                        ? (existingValue as Selectable<DB['ticket_tag_number_values']>).value
                        : (existingValue as Selectable<DB['ticket_tag_text_values']>).value
        ) : 'Not set'}`;
}

export function createCommentPrompt({
    ticket,
    comments,
    existingTags,
    userPrompt
}: {
    ticket: Selectable<DB['tickets']>;
    comments: Selectable<DB['ticket_comments']>[];
    existingTags: TagValuesByTicket;
    userPrompt: string;
}) {
    return `Given the following ticket and its tags, generate a comment based on the provided prompt.

Ticket:
Title: ${ticket.title}
Description: ${ticket.description || 'No description'}
Status: ${ticket.status}
Priority: ${ticket.priority}

Comments:
${formatComments(comments)}

Existing Tags:
${formatExistingTags(existingTags)}

User Prompt: ${userPrompt}`;
}

export function createStatusAndPriorityPrompt({
    ticket,
    comments,
    existingTags,
    suggestStatus,
    suggestPriority
}: {
    ticket: Selectable<DB['tickets']>;
    comments: Selectable<DB['ticket_comments']>[];
    existingTags: TagValuesByTicket;
    suggestStatus: boolean;
    suggestPriority: boolean;
}) {
    return `Given the following ticket and its tags, suggest appropriate ${suggestStatus ? 'status' : ''}${suggestStatus && suggestPriority ? ' and ' : ''}${suggestPriority ? 'priority' : ''}.

Ticket:
Title: ${ticket.title}
Description: ${ticket.description || 'No description'}
Current Status: ${ticket.status}
Current Priority: ${ticket.priority}

Comments:
${formatComments(comments)}

Existing Tags:
${formatExistingTags(existingTags)}`;
}

function formatComments(comments: Selectable<DB['ticket_comments']>[]): string {
    if (comments.length === 0) return 'No comments';
    return comments.map(comment =>
        `[${new Date(comment.created_at || '').toISOString()}] ${comment.comment}`
    ).join('\n');
}

function formatExistingTags(tags: TagValuesByTicket): string {
    const lines: string[] = [];

    // Format date tags
    for (const [_, tag] of tags.date) {
        lines.push(`Date Tag (${tag.tag_key_id}): ${tag.value}`);
    }

    // Format number tags
    for (const [_, tag] of tags.number) {
        lines.push(`Number Tag (${tag.tag_key_id}): ${tag.value}`);
    }

    // Format text tags
    for (const [_, tag] of tags.text) {
        lines.push(`Text Tag (${tag.tag_key_id}): ${tag.value}`);
    }

    // Format enum tags
    for (const [_, tag] of tags.enum) {
        lines.push(`Enum Tag (${tag.tag_key_id}): ${tag.enum_option_id}`);
    }

    return lines.join('\n');
} 