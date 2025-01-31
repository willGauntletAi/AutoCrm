import { useState, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { db, TicketTagEnumOption } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { RichTextEditor } from './RichTextEditor';
import { Plus, ChevronsUpDown, X } from 'lucide-react';
import { TagRequirementField } from './TagRequirementField';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { AddTagAction } from './AddTagAction';
import { Checkbox } from './ui/checkbox';

interface MacroFormProps {
    organizationId: string;
    initialData?: Omit<MacroData, 'aiActions'> & { aiActions?: MacroData['aiActions'] };
    onSubmit: (data: MacroData) => Promise<void>;
    onCancel: () => void;
    selectedNextMacros?: string[];
    onNextMacrosChange?: (macros: string[]) => void;
}

interface MacroData {
    name: string;
    description?: string;
    requirements: {
        date_tag_requirements: Record<string, { before?: number; after?: number; equals?: string }>;
        number_tag_requirements: Record<string, { min?: number; max?: number; equals?: number }>;
        text_tag_requirements: Record<string, { equals?: string; contains?: string; regex?: string }>;
        enum_tag_requirements: Record<string, string | string[]>;
        created_at?: { before?: number; after?: number };
        updated_at?: { before?: number; after?: number };
        status?: string;
        priority?: string;
    };
    actions: {
        tag_keys_to_remove: string[];
        tags_to_modify: {
            date_tags: Record<string, number>;
            number_tags: Record<string, number>;
            text_tags: Record<string, string>;
            enum_tags: Record<string, string>;
        };
        comment?: string;
        new_status?: string;
        new_priority?: string;
    };
    aiActions: {
        tagActions: string[];
        commentAction: {
            prompt: string;
        };
        shouldSuggestStatus: boolean;
        shouldSuggestPriority: boolean;
    };
}

export default function MacroForm({ organizationId, initialData, onSubmit, onCancel, selectedNextMacros = [], onNextMacrosChange }: MacroFormProps) {
    const [activeTab, setActiveTab] = useState('basic');
    const [formData, setFormData] = useState<MacroData>(() => ({
        name: initialData?.name || '',
        description: initialData?.description || '',
        requirements: initialData?.requirements || {
            date_tag_requirements: {},
            number_tag_requirements: {},
            text_tag_requirements: {},
            enum_tag_requirements: {},
            created_at: undefined,
            updated_at: undefined,
            status: undefined,
            priority: undefined
        },
        actions: initialData?.actions || {
            tag_keys_to_remove: [],
            tags_to_modify: {
                date_tags: {},
                number_tags: {},
                text_tags: {},
                enum_tags: {}
            },
            comment: undefined,
            new_status: undefined,
            new_priority: undefined
        },
        aiActions: initialData?.aiActions || {
            tagActions: [],
            commentAction: {
                prompt: ''
            },
            shouldSuggestStatus: false,
            shouldSuggestPriority: false
        }
    }));
    const [tagRequirements, setTagRequirements] = useState<Array<{ id: string; tagKeyId?: string }>>(() => {
        if (!initialData) return [];

        const requirements: Array<{ id: string; tagKeyId: string }> = [];

        // Add date tag requirements
        Object.keys(initialData.requirements.date_tag_requirements).forEach(tagKeyId => {
            requirements.push({ id: crypto.randomUUID(), tagKeyId });
        });

        // Add number tag requirements
        Object.keys(initialData.requirements.number_tag_requirements).forEach(tagKeyId => {
            requirements.push({ id: crypto.randomUUID(), tagKeyId });
        });

        // Add text tag requirements
        Object.keys(initialData.requirements.text_tag_requirements).forEach(tagKeyId => {
            requirements.push({ id: crypto.randomUUID(), tagKeyId });
        });

        // Add enum tag requirements
        Object.keys(initialData.requirements.enum_tag_requirements).forEach(tagKeyId => {
            requirements.push({ id: crypto.randomUUID(), tagKeyId });
        });

        return requirements;
    });
    const [isAddingTagValue, setIsAddingTagValue] = useState(false);

    // Fetch tag keys for this organization
    const tagKeys = useLiveQuery(
        async () => {
            return await db.ticketTagKeys
                .where('organization_id')
                .equals(organizationId)
                .filter(key => !key.deleted_at)
                .toArray();
        },
        [organizationId],
        []
    );

    // Fetch enum options for tag keys
    const enumOptions = useLiveQuery(
        async () => {
            const options = await db.ticketTagEnumOptions
                .filter(opt => !opt.deleted_at)
                .toArray();

            // Group options by tag key ID
            return options.reduce((acc, option) => {
                if (!acc[option.tag_key_id]) {
                    acc[option.tag_key_id] = [];
                }
                acc[option.tag_key_id].push(option);
                return acc;
            }, {} as Record<string, TicketTagEnumOption[]>);
        },
        [],
        {} as Record<string, TicketTagEnumOption[]>
    );

    // Fetch available macros for this organization
    const availableMacros = useLiveQuery(
        async () => {
            return await db.macros
                .where('organization_id')
                .equals(organizationId)
                .filter(macro => !macro.deleted_at)
                .toArray();
        },
        [organizationId],
        []
    );


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await onSubmit(formData);
        } catch (error) {
            console.error('Error submitting macro:', error);
        }
    };

    const handleCancel = (e: React.MouseEvent) => {
        e.preventDefault();
        onCancel();
    };

    const handleTagRequirementChange = useCallback((requirement: {
        tagKeyId: string;
        type: 'date' | 'number' | 'text' | 'enum';
        values: {
            before?: number;
            after?: number;
            min?: number;
            max?: number;
            equals?: string;
            contains?: string;
            regex?: string;
            enumComparison?: 'equal' | 'not_equal';
            enumValues?: string[];
        };
    }, requirementId: string) => {
        const { tagKeyId, type, values } = requirement;
        // Update the tag requirement's tagKeyId
        setTagRequirements(prev =>
            prev.map(r =>
                r.id === requirementId ? { ...r, tagKeyId } : r
            )
        );

        setFormData(prev => {
            // Remove any existing requirements for this tag key
            const {
                [tagKeyId]: _,
                ...dateReqs
            } = prev.requirements.date_tag_requirements;
            const {
                [tagKeyId]: __,
                ...numberReqs
            } = prev.requirements.number_tag_requirements;
            const {
                [tagKeyId]: ___,
                ...textReqs
            } = prev.requirements.text_tag_requirements;
            const {
                [tagKeyId]: ____,
                ...enumReqs
            } = prev.requirements.enum_tag_requirements;

            // Add the new requirement
            const requirements = {
                ...prev.requirements,
                date_tag_requirements: dateReqs,
                number_tag_requirements: numberReqs,
                text_tag_requirements: textReqs,
                enum_tag_requirements: enumReqs,
            };

            switch (type) {
                case 'date':
                    requirements.date_tag_requirements[tagKeyId] = {
                        before: values.before,
                        after: values.after,
                        equals: values.equals
                    };
                    break;
                case 'number':
                    requirements.number_tag_requirements[tagKeyId] = {
                        min: values.min,
                        max: values.max,
                        equals: values.equals ? parseFloat(values.equals) : undefined
                    };
                    break;
                case 'text':
                    requirements.text_tag_requirements[tagKeyId] = {
                        equals: values.equals,
                        contains: values.contains,
                        regex: values.regex
                    };
                    break;
                case 'enum':
                    if (values.enumComparison === 'equal' && values.enumValues?.[0]) {
                        requirements.enum_tag_requirements[tagKeyId] = values.enumValues[0];
                    } else if (values.enumComparison === 'not_equal' && values.enumValues?.length) {
                        requirements.enum_tag_requirements[tagKeyId] = values.enumValues;
                    } else {
                        // If no valid values, remove the requirement
                        delete requirements.enum_tag_requirements[tagKeyId];
                    }
                    break;
            }

            return { ...prev, requirements };
        });
    }, []);

    return (
        <form onSubmit={handleSubmit}>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="basic">Basic</TabsTrigger>
                    <TabsTrigger value="requirements">Requirements</TabsTrigger>
                    <TabsTrigger value="actions">Actions</TabsTrigger>
                    <TabsTrigger value="ai">AI</TabsTrigger>
                    <TabsTrigger value="nextMacros">Next Macros</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Enter macro name"
                            />
                        </div>
                        <div>
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Enter macro description"
                            />
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="requirements" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Tag Requirements</CardTitle>
                                {tagKeys.length > tagRequirements.length && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        className="flex items-center gap-2"
                                        onClick={() => setTagRequirements(prev => [...prev, { id: crypto.randomUUID() }])}
                                    >
                                        <Plus className="h-4 w-4" />
                                        Add Requirement
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                {tagRequirements.map((req) => (
                                    <TagRequirementField
                                        key={req.id}
                                        organizationId={organizationId}
                                        excludeTagIds={tagRequirements
                                            .filter(r => r.id !== req.id && r.tagKeyId)
                                            .map(r => r.tagKeyId!)}
                                        onDelete={() => {
                                            setTagRequirements(prev => prev.filter(r => r.id !== req.id));
                                        }}
                                        onChange={requirement => {
                                            handleTagRequirementChange(requirement, req.id);
                                        }}
                                    />
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Ticket Requirements</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div>
                                    <Label>Status</Label>
                                    <Select
                                        value={formData.requirements.status}
                                        onValueChange={value => setFormData(prev => ({
                                            ...prev,
                                            requirements: {
                                                ...prev.requirements,
                                                status: value
                                            }
                                        }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="open">Open</SelectItem>
                                            <SelectItem value="in_progress">In Progress</SelectItem>
                                            <SelectItem value="closed">Closed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label>Priority</Label>
                                    <Select
                                        value={formData.requirements.priority}
                                        onValueChange={value => setFormData(prev => ({
                                            ...prev,
                                            requirements: {
                                                ...prev.requirements,
                                                priority: value
                                            }
                                        }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select priority" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="low">Low</SelectItem>
                                            <SelectItem value="medium">Medium</SelectItem>
                                            <SelectItem value="high">High</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="actions" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Tag Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <div>
                                <Label>Tags to Remove</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            className="w-full justify-between"
                                        >
                                            {formData.actions.tag_keys_to_remove.length > 0
                                                ? `${formData.actions.tag_keys_to_remove.length} tags selected`
                                                : "Select tags to remove..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="p-0" align="start">
                                        <Command className="rounded-lg bg-white">
                                            <CommandInput placeholder="Search tags..." className="h-9" />
                                            <CommandList>
                                                <CommandEmpty>No tags found.</CommandEmpty>
                                                <CommandGroup>
                                                    {tagKeys.map((key) => (
                                                        <CommandItem
                                                            key={key.id}
                                                            value={key.name}
                                                            className="hover:bg-gray-100"
                                                            onSelect={() => {
                                                                setFormData(prev => {
                                                                    const isSelected = prev.actions.tag_keys_to_remove.includes(key.id);
                                                                    return {
                                                                        ...prev,
                                                                        actions: {
                                                                            ...prev.actions,
                                                                            tag_keys_to_remove: isSelected
                                                                                ? prev.actions.tag_keys_to_remove.filter(id => id !== key.id)
                                                                                : [...prev.actions.tag_keys_to_remove, key.id]
                                                                        }
                                                                    };
                                                                });
                                                            }}
                                                        >
                                                            {key.name}
                                                            <Check
                                                                className={cn(
                                                                    "ml-auto h-4 w-4",
                                                                    formData.actions.tag_keys_to_remove.includes(key.id) ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <Label>Tags to Add/Modify</Label>
                                    <Button
                                        type="button"
                                        size="sm"
                                        className="flex items-center gap-2"
                                        onClick={() => setIsAddingTagValue(true)}
                                    >
                                        <Plus className="h-4 w-4" />
                                        Add Tag
                                    </Button>
                                </div>
                                {isAddingTagValue && (
                                    <AddTagAction
                                        tagKeys={tagKeys}
                                        excludeTagIds={[
                                            ...Object.keys(formData.actions.tags_to_modify.date_tags),
                                            ...Object.keys(formData.actions.tags_to_modify.number_tags),
                                            ...Object.keys(formData.actions.tags_to_modify.text_tags),
                                            ...Object.keys(formData.actions.tags_to_modify.enum_tags)
                                        ]}
                                        onSubmit={(tagKey, value) => {
                                            setFormData(prev => {
                                                const actions = { ...prev.actions };
                                                switch (tagKey.tag_type) {
                                                    case 'date':
                                                        actions.tags_to_modify.date_tags[tagKey.id] = parseFloat(value);
                                                        break;
                                                    case 'number':
                                                        actions.tags_to_modify.number_tags[tagKey.id] = parseFloat(value);
                                                        break;
                                                    case 'text':
                                                        actions.tags_to_modify.text_tags[tagKey.id] = value;
                                                        break;
                                                    case 'enum':
                                                        actions.tags_to_modify.enum_tags[tagKey.id] = value;
                                                        break;
                                                }
                                                return { ...prev, actions };
                                            });
                                            setIsAddingTagValue(false);
                                        }}
                                        onCancel={() => setIsAddingTagValue(false)}
                                    />
                                )}
                                <div className="space-y-2 mt-4">
                                    {Object.entries(formData.actions.tags_to_modify.date_tags).map(([tagId, value]) => {
                                        const tag = tagKeys.find(k => k.id === tagId);
                                        if (!tag) return null;
                                        return (
                                            <div key={tagId} className="flex items-center justify-between gap-2 p-2 border rounded">
                                                <span>{tag.name}: {value}</span>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => {
                                                        setFormData(prev => {
                                                            const { [tagId]: _, ...rest } = prev.actions.tags_to_modify.date_tags;
                                                            return {
                                                                ...prev,
                                                                actions: {
                                                                    ...prev.actions,
                                                                    tags_to_modify: {
                                                                        ...prev.actions.tags_to_modify,
                                                                        date_tags: rest
                                                                    }
                                                                }
                                                            };
                                                        });
                                                    }}
                                                >
                                                    Remove
                                                </Button>
                                            </div>
                                        );
                                    })}
                                    {Object.entries(formData.actions.tags_to_modify.number_tags).map(([tagId, value]) => {
                                        const tag = tagKeys.find(k => k.id === tagId);
                                        if (!tag) return null;
                                        return (
                                            <div key={tagId} className="flex items-center justify-between gap-2 p-2 border rounded">
                                                <span>{tag.name}: {value}</span>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => {
                                                        setFormData(prev => {
                                                            const { [tagId]: _, ...rest } = prev.actions.tags_to_modify.number_tags;
                                                            return {
                                                                ...prev,
                                                                actions: {
                                                                    ...prev.actions,
                                                                    tags_to_modify: {
                                                                        ...prev.actions.tags_to_modify,
                                                                        number_tags: rest
                                                                    }
                                                                }
                                                            };
                                                        });
                                                    }}
                                                >
                                                    Remove
                                                </Button>
                                            </div>
                                        );
                                    })}
                                    {Object.entries(formData.actions.tags_to_modify.text_tags).map(([tagId, value]) => {
                                        const tag = tagKeys.find(k => k.id === tagId);
                                        if (!tag) return null;
                                        return (
                                            <div key={tagId} className="flex items-center justify-between gap-2 p-2 border rounded">
                                                <span>{tag.name}: {value}</span>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => {
                                                        setFormData(prev => {
                                                            const { [tagId]: _, ...rest } = prev.actions.tags_to_modify.text_tags;
                                                            return {
                                                                ...prev,
                                                                actions: {
                                                                    ...prev.actions,
                                                                    tags_to_modify: {
                                                                        ...prev.actions.tags_to_modify,
                                                                        text_tags: rest
                                                                    }
                                                                }
                                                            };
                                                        });
                                                    }}
                                                >
                                                    Remove
                                                </Button>
                                            </div>
                                        );
                                    })}
                                    {Object.entries(formData.actions.tags_to_modify.enum_tags).map(([tagId, optionId]) => {
                                        const tag = tagKeys.find(k => k.id === tagId);
                                        const option = enumOptions[tagId]?.find(o => o.id === optionId);
                                        if (!tag || !option) return null;
                                        return (
                                            <div key={tagId} className="flex items-center justify-between gap-2 p-2 border rounded">
                                                <span>{tag.name}: {option.value}</span>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => {
                                                        setFormData(prev => {
                                                            const { [tagId]: _, ...rest } = prev.actions.tags_to_modify.enum_tags;
                                                            return {
                                                                ...prev,
                                                                actions: {
                                                                    ...prev.actions,
                                                                    tags_to_modify: {
                                                                        ...prev.actions.tags_to_modify,
                                                                        enum_tags: rest
                                                                    }
                                                                }
                                                            };
                                                        });
                                                    }}
                                                >
                                                    Remove
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Ticket Actions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div>
                                    <Label>New Status</Label>
                                    <Select
                                        value={formData.actions.new_status}
                                        onValueChange={value => setFormData(prev => ({
                                            ...prev,
                                            actions: {
                                                ...prev.actions,
                                                new_status: value
                                            }
                                        }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select new status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="open">Open</SelectItem>
                                            <SelectItem value="in_progress">In Progress</SelectItem>
                                            <SelectItem value="closed">Closed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label>New Priority</Label>
                                    <Select
                                        value={formData.actions.new_priority}
                                        onValueChange={value => setFormData(prev => ({
                                            ...prev,
                                            actions: {
                                                ...prev.actions,
                                                new_priority: value
                                            }
                                        }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select new priority" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="low">Low</SelectItem>
                                            <SelectItem value="medium">Medium</SelectItem>
                                            <SelectItem value="high">High</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label>Comment</Label>
                                    <RichTextEditor
                                        content={formData.actions.comment || ''}
                                        onChange={content => setFormData(prev => ({
                                            ...prev,
                                            actions: {
                                                ...prev.actions,
                                                comment: content
                                            }
                                        }))}
                                        disabled={false}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="ai" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>AI Tag Actions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div>
                                    <Label>Tags for AI Processing</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                className="w-full justify-between"
                                            >
                                                {formData.aiActions.tagActions.length > 0
                                                    ? `${formData.aiActions.tagActions.length} tags selected`
                                                    : "Select tags for AI..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="p-0" align="start">
                                            <Command className="rounded-lg bg-white">
                                                <CommandInput placeholder="Search tags..." className="h-9" />
                                                <CommandList>
                                                    <CommandEmpty>No tags found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {tagKeys.map((key) => (
                                                            <CommandItem
                                                                key={key.id}
                                                                value={key.name}
                                                                className="hover:bg-gray-100"
                                                                onSelect={() => {
                                                                    setFormData(prev => {
                                                                        const isSelected = prev.aiActions.tagActions.includes(key.id);
                                                                        return {
                                                                            ...prev,
                                                                            aiActions: {
                                                                                ...prev.aiActions,
                                                                                tagActions: isSelected
                                                                                    ? prev.aiActions.tagActions.filter(id => id !== key.id)
                                                                                    : [...prev.aiActions.tagActions, key.id]
                                                                            }
                                                                        };
                                                                    });
                                                                }}
                                                            >
                                                                {key.name}
                                                                <Check
                                                                    className={cn(
                                                                        "ml-auto h-4 w-4",
                                                                        formData.aiActions.tagActions.includes(key.id) ? "opacity-100" : "opacity-0"
                                                                    )}
                                                                />
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>AI Comment Action</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div>
                                    <Label>Comment Prompt</Label>
                                    <Textarea
                                        value={formData.aiActions.commentAction.prompt}
                                        onChange={e => setFormData(prev => ({
                                            ...prev,
                                            aiActions: {
                                                ...prev.aiActions,
                                                commentAction: {
                                                    prompt: e.target.value
                                                }
                                            }
                                        }))}
                                        placeholder="Enter prompt for AI-generated comment..."
                                        className="min-h-[100px]"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>AI Suggestions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="suggest-status"
                                        checked={formData.aiActions.shouldSuggestStatus}
                                        onCheckedChange={(checked) =>
                                            setFormData(prev => ({
                                                ...prev,
                                                aiActions: {
                                                    ...prev.aiActions,
                                                    shouldSuggestStatus: checked === true
                                                }
                                            }))
                                        }
                                    />
                                    <Label htmlFor="suggest-status">Suggest Status</Label>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="suggest-priority"
                                        checked={formData.aiActions.shouldSuggestPriority}
                                        onCheckedChange={(checked) =>
                                            setFormData(prev => ({
                                                ...prev,
                                                aiActions: {
                                                    ...prev.aiActions,
                                                    shouldSuggestPriority: checked === true
                                                }
                                            }))
                                        }
                                    />
                                    <Label htmlFor="suggest-priority">Suggest Priority</Label>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="nextMacros">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Next Macros</CardTitle>
                                {availableMacros.length > selectedNextMacros.filter(Boolean).length && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        className="flex items-center gap-2"
                                        onClick={() => {
                                            // Add an empty selection that will be populated by the dropdown
                                            onNextMacrosChange?.([...selectedNextMacros, '']);
                                        }}
                                    >
                                        <Plus className="h-4 w-4" />
                                        Add Next Macro
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                {selectedNextMacros.map((macroId, index) => {
                                    return (
                                        <div key={index} className="flex items-center gap-2">
                                            <div className="flex-1">
                                                <Select
                                                    value={macroId}
                                                    onValueChange={(value) => {
                                                        const newMacros = [...selectedNextMacros];
                                                        newMacros[index] = value;
                                                        onNextMacrosChange?.(newMacros.filter(Boolean));
                                                    }}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select a macro" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {availableMacros
                                                            .filter(m => !selectedNextMacros.includes(m.id) || m.id === macroId)
                                                            .map((m) => (
                                                                <SelectItem key={m.id} value={m.id}>
                                                                    {m.macro.name}
                                                                </SelectItem>
                                                            ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    const newMacros = selectedNextMacros.filter((_, i) => i !== index);
                                                    onNextMacrosChange?.(newMacros.filter(Boolean));
                                                }}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <div className="mt-4 flex justify-end space-x-2">
                <Button variant="outline" onClick={handleCancel}>
                    Cancel
                </Button>
                <Button type="submit">
                    Create Macro
                </Button>
            </div>
        </form>
    );
} 