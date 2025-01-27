import { useState } from 'react';
import { Button } from './ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { db, MacroSchema, TicketTagEnumOption } from '../lib/db';
import { createMacro } from '../lib/mutations';
import { useLiveQuery } from 'dexie-react-hooks';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { v4 as uuidv4 } from 'uuid';
import { RichTextEditor } from './RichTextEditor';
import { Plus, ChevronsUpDown } from 'lucide-react';
import type { z } from 'zod';
import { TagRequirementField } from './TagRequirementField';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { AddTagAction } from './AddTagAction';

interface CreateMacroDialogProps {
    organizationId: string;
    trigger: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

type MacroData = z.infer<typeof MacroSchema>['macro'];

type TagType = 'text' | 'number' | 'date' | 'enum';
const TAG_TYPES: TagType[] = ['text', 'number', 'date', 'enum'];

export default function CreateMacroDialog({ organizationId, trigger, open, onOpenChange }: CreateMacroDialogProps) {
    const [activeTab, setActiveTab] = useState('basic');
    const [formData, setFormData] = useState<MacroData>({
        name: '',
        description: '',
        requirements: {
            date_tag_requirements: {},
            number_tag_requirements: {},
            text_tag_requirements: {},
            enum_tag_requirements: {},
            created_at: undefined,
            updated_at: undefined,
            status: undefined,
            priority: undefined
        },
        actions: {
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
        }
    });
    const [tagRequirements, setTagRequirements] = useState<Array<{ id: string; tagKeyId?: string }>>([]);
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            // Create macro using the mutations system
            const macroId = uuidv4();
            await createMacro({
                id: macroId,
                organization_id: organizationId,
                macro: formData
            });

            // Close dialog
            onOpenChange?.(false);
        } catch (error) {
            console.error('Error creating macro:', error);
        }
    };

    const handleTagRequirementChange = (requirement: {
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

            console.log('Updated requirements:', requirements); // Add this for debugging
            return { ...prev, requirements };
        });
    };

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
            modal={true}
        >
            <DialogTrigger asChild>
                {trigger}
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Create Macro</DialogTitle>
                    <DialogDescription>
                        Create a new automation macro to update tickets based on conditions.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="basic">Basic Info</TabsTrigger>
                            <TabsTrigger value="requirements">Requirements</TabsTrigger>
                            <TabsTrigger value="actions">Actions</TabsTrigger>
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
                    </Tabs>

                    <div className="mt-6 flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>
                            Cancel
                        </Button>
                        <Button type="submit">
                            Create Macro
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
} 