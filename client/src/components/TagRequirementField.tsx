import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { db } from '../lib/db';
import type { TicketTagKey } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, X } from 'lucide-react';

interface TagRequirementFieldProps {
    organizationId: string;
    onDelete: () => void;
    excludeTagIds?: string[];
    onChange: (requirement: {
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
    }) => void;
}

export function TagRequirementField({ organizationId, onDelete, excludeTagIds = [], onChange }: TagRequirementFieldProps) {
    const [tagKeys, setTagKeys] = useState<TicketTagKey[]>([]);
    const [selectedTagKey, setSelectedTagKey] = useState<string>('');
    const [values, setValues] = useState<{
        before?: number;
        after?: number;
        min?: number;
        max?: number;
        equals?: string;
        contains?: string;
        regex?: string;
        enumComparison?: 'equal' | 'not_equal';
        enumValues?: string[];
    }>({
        enumComparison: 'equal',
        enumValues: ['']
    });

    // Get selected tag
    const selectedTag = tagKeys.find(k => k.id === selectedTagKey);

    // Load tag keys
    useEffect(() => {
        const loadTagKeys = async () => {
            const keys = await db.ticketTagKeys
                .where('organization_id')
                .equals(organizationId)
                .filter(key => !key.deleted_at && !excludeTagIds.includes(key.id))
                .toArray();
            setTagKeys(keys);
            if (keys.length > 0 && !selectedTagKey) {
                const key = keys[0];
                setSelectedTagKey(key.id);
                if (key.tag_type === 'enum') {
                    setValues({
                        enumComparison: 'equal',
                        enumValues: ['']
                    });
                } else {
                    setValues({});
                }
            }
        };
        loadTagKeys();
    }, [organizationId, excludeTagIds]);

    // Fetch enum options for selected tag
    const enumOptions = useLiveQuery(
        async () => {
            if (!selectedTagKey || selectedTag?.tag_type !== 'enum') return [];
            return await db.ticketTagEnumOptions
                .where('tag_key_id')
                .equals(selectedTagKey)
                .filter(opt => !opt.deleted_at)
                .toArray();
        },
        [selectedTagKey, selectedTag?.tag_type],
        []
    );

    // Notify parent of changes
    useEffect(() => {
        if (selectedTagKey && selectedTag) {
            const processedValues = {
                before: values.before ? parseFloat(values.before.toString()) : undefined,
                after: values.after ? parseFloat(values.after.toString()) : undefined,
                min: values.min ? parseFloat(values.min.toString()) : undefined,
                max: values.max ? parseFloat(values.max.toString()) : undefined,
                equals: values.equals,
                contains: values.contains,
                regex: values.regex,
                enumComparison: values.enumComparison,
                enumValues: values.enumValues
            };

            onChange({
                tagKeyId: selectedTagKey,
                type: selectedTag.tag_type,
                values: processedValues
            });
        }
    }, [selectedTagKey, selectedTag, values, onChange]);

    // Handle tag selection
    const handleTagSelect = (tagKey: string) => {
        setSelectedTagKey(tagKey);
        const tag = tagKeys.find(k => k.id === tagKey);
        if (tag?.tag_type === 'enum') {
            setValues({
                enumComparison: 'equal',
                enumValues: ['']
            });
        } else {
            setValues({});
        }
    };

    const renderInputs = () => {
        if (!selectedTag?.tag_type) return null;

        switch (selectedTag.tag_type) {
            case 'date':
                return (
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Before (days)</Label>
                            <Input
                                type="number"
                                value={values.before?.toString() || ''}
                                onChange={e => setValues(prev => ({ ...prev, before: parseFloat(e.target.value) }))}
                                placeholder="e.g. 7 for a week"
                                step="0.1"
                            />
                        </div>
                        <div>
                            <Label>After (days)</Label>
                            <Input
                                type="number"
                                value={values.after?.toString() || ''}
                                onChange={e => setValues(prev => ({ ...prev, after: parseFloat(e.target.value) }))}
                                placeholder="e.g. -7 for a week ago"
                                step="0.1"
                            />
                        </div>
                        <div>
                            <Label>Equals (days)</Label>
                            <Input
                                type="number"
                                value={values.equals || ''}
                                onChange={e => setValues(prev => ({ ...prev, equals: e.target.value }))}
                                placeholder="e.g. 1 for tomorrow"
                                step="0.1"
                            />
                        </div>
                    </div>
                );
            case 'number':
                return (
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Minimum</Label>
                            <Input
                                type="number"
                                value={values.min?.toString() || ''}
                                onChange={e => setValues(prev => ({ ...prev, min: parseFloat(e.target.value) }))}
                            />
                        </div>
                        <div>
                            <Label>Maximum</Label>
                            <Input
                                type="number"
                                value={values.max?.toString() || ''}
                                onChange={e => setValues(prev => ({ ...prev, max: parseFloat(e.target.value) }))}
                            />
                        </div>
                        <div>
                            <Label>Equals</Label>
                            <Input
                                type="number"
                                value={values.equals || ''}
                                onChange={e => setValues(prev => ({ ...prev, equals: e.target.value }))}
                            />
                        </div>
                    </div>
                );
            case 'text':
                return (
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Equals</Label>
                            <Input
                                type="text"
                                value={values.equals || ''}
                                onChange={e => setValues(prev => ({ ...prev, equals: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label>Contains</Label>
                            <Input
                                type="text"
                                value={values.contains || ''}
                                onChange={e => setValues(prev => ({ ...prev, contains: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label>Regex</Label>
                            <Input
                                type="text"
                                value={values.regex || ''}
                                onChange={e => setValues(prev => ({ ...prev, regex: e.target.value }))}
                            />
                        </div>
                    </div>
                );
            case 'enum':
                return (
                    <div className="space-y-4">
                        <div>
                            <Label>Comparison</Label>
                            <Select
                                value={values.enumComparison || 'equal'}
                                onValueChange={value => {
                                    const newValues = {
                                        ...values,
                                        enumComparison: value as 'equal' | 'not_equal',
                                        enumValues: value === 'equal' ?
                                            [''] : // Initialize with empty value for equal to
                                            (values.enumValues?.length ? values.enumValues : ['']) // Keep existing values or initialize with empty for not equal
                                    };
                                    setValues(newValues);
                                    onChange({
                                        tagKeyId: selectedTagKey,
                                        type: 'enum',
                                        values: newValues
                                    });
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="equal">Equal to</SelectItem>
                                    <SelectItem value="not_equal">Not equal to</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            {(values.enumValues || ['']).map((value, index) => (
                                <div key={index} className="flex gap-2 items-center">
                                    <div className="flex-1">
                                        <Select
                                            value={value}
                                            onValueChange={newValue => {
                                                const newValues = [...(values.enumValues || [''])];
                                                newValues[index] = newValue;
                                                const updatedValues = {
                                                    ...values,
                                                    enumValues: newValues
                                                };
                                                setValues(updatedValues);
                                                onChange({
                                                    tagKeyId: selectedTagKey,
                                                    type: 'enum',
                                                    values: updatedValues
                                                });
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select value" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {enumOptions.map(option => (
                                                    <SelectItem key={option.id} value={option.id}>
                                                        {option.value}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {values.enumComparison === 'not_equal' && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                const newValues = {
                                                    ...values,
                                                    enumValues: values.enumValues?.filter((_, i) => i !== index)
                                                };
                                                setValues(newValues);
                                                onChange({
                                                    tagKeyId: selectedTagKey,
                                                    type: 'enum',
                                                    values: newValues
                                                });
                                            }}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}

                            {values.enumComparison === 'not_equal' && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="w-full mt-2"
                                    onClick={() => {
                                        const newValues = {
                                            ...values,
                                            enumValues: [...(values.enumValues || []), '']
                                        };
                                        setValues(newValues);
                                        onChange({
                                            tagKeyId: selectedTagKey,
                                            type: 'enum',
                                            values: newValues
                                        });
                                    }}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Value
                                </Button>
                            )}
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex justify-between items-start">
                <div className="space-y-4 flex-1">
                    <div>
                        <Label>Tag</Label>
                        <Select value={selectedTagKey} onValueChange={handleTagSelect}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a tag" />
                            </SelectTrigger>
                            <SelectContent>
                                {tagKeys.map(key => (
                                    <SelectItem key={key.id} value={key.id}>
                                        {key.name} ({key.tag_type})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {renderInputs()}
                </div>
                <Button
                    variant="destructive"
                    size="sm"
                    onClick={onDelete}
                    className="ml-4"
                >
                    Remove
                </Button>
            </div>
        </div>
    );
} 