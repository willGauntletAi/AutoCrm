import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { db } from '../lib/db';
import type { TicketTagKey } from '../lib/db';

interface TagRequirementFieldProps {
    organizationId: string;
    onDelete: () => void;
    excludeTagIds?: string[];
    onChange: (requirement: {
        tagKeyId: string;
        type: 'date' | 'number' | 'text';
        values: {
            before?: number;
            after?: number;
            equals?: string;
            min?: number;
            max?: number;
            contains?: string;
            regex?: string;
        };
    }) => void;
}

export function TagRequirementField({ organizationId, onDelete, excludeTagIds = [], onChange }: TagRequirementFieldProps) {
    const [tagKeys, setTagKeys] = useState<TicketTagKey[]>([]);
    const [selectedTagKey, setSelectedTagKey] = useState<string>('');
    const [values, setValues] = useState<{
        before?: string;
        after?: string;
        equals?: string;
        min?: string;
        max?: string;
        contains?: string;
        regex?: string;
    }>({});

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
                setSelectedTagKey(keys[0].id);
            }
        };
        loadTagKeys();
    }, [organizationId, excludeTagIds, selectedTagKey]);

    // Get selected tag key's type
    const selectedTagType = tagKeys.find(k => k.id === selectedTagKey)?.tag_type;

    // Notify parent of changes
    useEffect(() => {
        if (selectedTagKey) {
            const tagKey = tagKeys.find(k => k.id === selectedTagKey);
            if (tagKey) {
                const processedValues = {
                    before: values.before ? parseFloat(values.before) : undefined,
                    after: values.after ? parseFloat(values.after) : undefined,
                    equals: values.equals,
                    min: values.min ? parseFloat(values.min) : undefined,
                    max: values.max ? parseFloat(values.max) : undefined,
                    contains: values.contains,
                    regex: values.regex
                };

                onChange({
                    tagKeyId: selectedTagKey,
                    type: tagKey.tag_type,
                    values: processedValues
                });
            }
        }
    }, [selectedTagKey, values, onChange]);

    const renderInputs = () => {
        if (!selectedTagType) return null;

        switch (selectedTagType) {
            case 'date':
                return (
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Before (days)</Label>
                            <Input
                                type="number"
                                value={values.before || ''}
                                onChange={e => setValues(prev => ({ ...prev, before: e.target.value }))}
                                placeholder="e.g. 7 for a week"
                                step="0.1"
                            />
                        </div>
                        <div>
                            <Label>After (days)</Label>
                            <Input
                                type="number"
                                value={values.after || ''}
                                onChange={e => setValues(prev => ({ ...prev, after: e.target.value }))}
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
                                value={values.min || ''}
                                onChange={e => setValues(prev => ({ ...prev, min: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label>Maximum</Label>
                            <Input
                                type="number"
                                value={values.max || ''}
                                onChange={e => setValues(prev => ({ ...prev, max: e.target.value }))}
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
        }
    };

    return (
        <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex justify-between items-start">
                <div className="space-y-4 flex-1">
                    <div>
                        <Label>Tag</Label>
                        <Select value={selectedTagKey} onValueChange={setSelectedTagKey}>
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