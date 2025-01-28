import { z } from 'zod';

export const MacroRequirementsSchema = z.object({
    date_tag_requirements: z.record(z.string().uuid(), z.object({
        before: z.number().optional(),
        after: z.number().optional(),
        equals: z.string().optional()
    })),
    number_tag_requirements: z.record(z.string().uuid(), z.object({
        min: z.number().optional(),
        max: z.number().optional(),
        equals: z.number().optional()
    })),
    text_tag_requirements: z.record(z.string().uuid(), z.object({
        equals: z.string().optional(),
        contains: z.string().optional(),
        regex: z.string().optional()
    })),
    enum_tag_requirements: z.record(z.string().uuid(), z.union([
        z.string().uuid(), // Single enum option ID - must match this value
        z.array(z.string().uuid()) // Array of enum option IDs - must not match any of these values
    ])),
    created_at: z.object({
        before: z.number().optional(),
        after: z.number().optional()
    }).optional(),
    updated_at: z.object({
        before: z.number().optional(),
        after: z.number().optional()
    }).optional(),
    status: z.string().optional(),
    priority: z.string().optional()
});

export const MacroActionsSchema = z.object({
    tag_keys_to_remove: z.array(z.string().uuid()),
    tags_to_modify: z.object({
        date_tags: z.record(z.string().uuid(), z.number()),
        number_tags: z.record(z.string().uuid(), z.number()),
        text_tags: z.record(z.string().uuid(), z.string()),
        enum_tags: z.record(z.string().uuid(), z.string().uuid())
    }),
    comment: z.string().optional(),
    new_status: z.string().optional(),
    new_priority: z.string().optional()
});

export const AIActionSchema = z.object({
    tagActions: z.array(z.string().uuid()),
    commentAction: z.object({
        prompt: z.string()
    }),
    shouldSuggestStatus: z.boolean(),
    shouldSuggestPriority: z.boolean()
});

export const MacroDataSchema = z.object({
    name: z.string(),
    description: z.string().optional(),
    requirements: MacroRequirementsSchema,
    actions: MacroActionsSchema,
    aiActions: AIActionSchema.optional()
});

export const MacroSchema = z.object({
    id: z.string().uuid(),
    organization_id: z.string().uuid(),
    macro: MacroDataSchema
});

export type MacroRequirements = z.infer<typeof MacroRequirementsSchema>;
export type MacroActions = z.infer<typeof MacroActionsSchema>;
export type MacroData = z.infer<typeof MacroDataSchema>;
export type Macro = z.infer<typeof MacroSchema>;
export type AIAction = z.infer<typeof AIActionSchema>; 