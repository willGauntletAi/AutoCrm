import { Selectable } from 'kysely';
import type { DB } from '../../db/types';

export {
    MacroRequirementsSchema,
    MacroActionsSchema,
    MacroDataSchema,
    MacroSchema,
    type MacroRequirements,
    type MacroActions,
    type MacroData,
    type Macro
} from '../../types/macros';

export interface TagValuesByTicket {
    date: Map<string, Selectable<DB['ticket_tag_date_values']>>;
    number: Map<string, Selectable<DB['ticket_tag_number_values']>>;
    text: Map<string, Selectable<DB['ticket_tag_text_values']>>;
    enum: Map<string, Selectable<DB['ticket_tag_enum_values']>>;
} 