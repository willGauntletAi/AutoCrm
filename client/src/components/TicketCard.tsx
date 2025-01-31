import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Link } from 'react-router-dom'
import { formatDateTime } from '@/lib/utils'
import type { TicketTagKey } from '@/lib/db'
import type { TagFilter } from './TicketFilters'
import { useState, useRef } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from './ui/dialog'
import { Button } from './ui/button'

interface TicketCardProps {
    id: string;
    title: string;
    priority: string;
    status: string;
    created_at: string | null;
    updated_at?: string | null;
    description?: string;
    organization_id: string;
    linkPath: string;
    tags?: {
        keys: TicketTagKey[];
        values: {
            date: Map<string, string>;
            number: Map<string, string>;
            text: Map<string, string>;
            enum: Map<string, { value: string; optionId: string }>;
        };
    };
    onTagClick?: (filter: TagFilter) => void;
}

function TagsDialog({
    open,
    onOpenChange,
    tags,
    onTagClick
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tags: NonNullable<TicketCardProps['tags']>;
    onTagClick?: (filter: TagFilter) => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>All Tags</DialogTitle>
                </DialogHeader>
                <div className="flex flex-wrap gap-2 mt-4">
                    {tags.keys.map((tagKey: TicketTagKey) => {
                        let value: string | null = null;
                        switch (tagKey.tag_type) {
                            case 'date': {
                                const dateStr = tags.values.date.get(tagKey.id);
                                if (dateStr) {
                                    const date = new Date(dateStr);
                                    value = date.toDateString();
                                }
                                break;
                            }
                            case 'number':
                                value = tags.values.number.get(tagKey.id) || null;
                                break;
                            case 'text':
                                value = tags.values.text.get(tagKey.id) || null;
                                break;
                            case 'enum': {
                                const enumValue = tags.values.enum.get(tagKey.id);
                                value = enumValue?.value || null;
                                break;
                            }
                        }
                        if (value === null) return null;

                        return (
                            <Badge
                                key={tagKey.id}
                                variant="outline"
                                className="bg-blue-50 cursor-pointer hover:bg-blue-100"
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (onTagClick) {
                                        onTagClick({
                                            tagKeyId: tagKey.id,
                                            operator: tagKey.tag_type === 'text' ? 'eq' :
                                                tagKey.tag_type === 'enum' ? 'eq' : 'eq',
                                            value: tagKey.tag_type === 'enum' ?
                                                tags.values.enum.get(tagKey.id)?.optionId || '' :
                                                value || ''
                                        });
                                    }
                                    onOpenChange(false);
                                }}
                            >
                                {tagKey.name}: {value}
                            </Badge>
                        );
                    })}
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function TicketCard({
    title,
    priority,
    status,
    created_at,
    updated_at,
    description,
    linkPath,
    tags,
    onTagClick
}: TicketCardProps) {
    const [isTagsDialogOpen, setIsTagsDialogOpen] = useState(false);
    const tagsContainerRef = useRef<HTMLDivElement>(null);

    // Get total tag count
    const totalTagCount = tags?.keys.reduce((count, tagKey) => {
        let value: string | null = null;
        switch (tagKey.tag_type) {
            case 'date': {
                const dateStr = tags.values.date.get(tagKey.id);
                if (dateStr) value = dateStr;
                break;
            }
            case 'number':
                value = tags.values.number.get(tagKey.id) || null;
                break;
            case 'text':
                value = tags.values.text.get(tagKey.id) || null;
                break;
            case 'enum': {
                const enumValue = tags.values.enum.get(tagKey.id);
                value = enumValue?.value || null;
                break;
            }
        }
        return value !== null ? count + 1 : count;
    }, 0) || 0;

    const renderTags = () => {
        if (!tags || !tags.values) return null;

        const visibleTags: JSX.Element[] = [];
        let currentRowWidth = 0;
        let rowCount = 1;
        const containerWidth = 400; // Fixed width matching the card's content area

        // Function to estimate tag width (including gap)
        const estimateTagWidth = (tagKey: TicketTagKey): number => {
            let value: string | null = null;
            switch (tagKey.tag_type) {
                case 'date': {
                    const dateStr = tags.values.date.get(tagKey.id);
                    if (dateStr) {
                        const date = new Date(dateStr);
                        value = date.toDateString();
                    }
                    break;
                }
                case 'number':
                    value = tags.values.number.get(tagKey.id) || null;
                    break;
                case 'text':
                    value = tags.values.text.get(tagKey.id) || null;
                    break;
                case 'enum': {
                    const enumValue = tags.values.enum.get(tagKey.id);
                    value = enumValue?.value || null;
                    break;
                }
            }
            if (value === null) return 0;

            // Estimate width based on text length (rough approximation)
            const text = `${tagKey.name}: ${value}`;
            return text.length * 8 + 32; // 8px per character + padding
        };

        for (const tagKey of tags.keys) {
            const tagWidth = estimateTagWidth(tagKey);
            if (tagWidth === 0) continue;

            // Check if this tag would start a new row
            if (currentRowWidth + tagWidth > containerWidth) {
                rowCount++;
                currentRowWidth = tagWidth;
            } else {
                currentRowWidth += tagWidth;
            }

            // If we're starting a third row, show the "more" button instead
            if (rowCount > 2) {
                break;
            }

            let value: string | null = null;
            switch (tagKey.tag_type) {
                case 'date': {
                    const dateStr = tags.values.date.get(tagKey.id);
                    if (dateStr) {
                        const date = new Date(dateStr);
                        value = date.toDateString();
                    }
                    break;
                }
                case 'number':
                    value = tags.values.number.get(tagKey.id) || null;
                    break;
                case 'text':
                    value = tags.values.text.get(tagKey.id) || null;
                    break;
                case 'enum': {
                    const enumValue = tags.values.enum.get(tagKey.id);
                    value = enumValue?.value || null;
                    break;
                }
            }
            if (value === null) continue;

            visibleTags.push(
                <Badge
                    key={tagKey.id}
                    variant="outline"
                    className="bg-blue-50 cursor-pointer hover:bg-blue-100"
                    onClick={(e) => {
                        e.preventDefault();
                        if (onTagClick) {
                            onTagClick({
                                tagKeyId: tagKey.id,
                                operator: tagKey.tag_type === 'text' ? 'eq' :
                                    tagKey.tag_type === 'enum' ? 'eq' : 'eq',
                                value: tagKey.tag_type === 'enum' ?
                                    tags.values.enum.get(tagKey.id)?.optionId || '' :
                                    value || ''
                            });
                        }
                    }}
                >
                    {tagKey.name}: {value}
                </Badge>
            );
        }

        // If we have more tags than what's visible, add the "more" button
        if (visibleTags.length < totalTagCount) {
            visibleTags.push(
                <Button
                    key="more"
                    variant="outline"
                    size="sm"
                    className="h-6"
                    onClick={(e) => {
                        e.preventDefault();
                        setIsTagsDialogOpen(true);
                    }}
                >
                    +{totalTagCount - visibleTags.length} more
                </Button>
            );
        }

        return visibleTags;
    };

    const getPriorityColor = (priority: string) => {
        switch (priority.toLowerCase()) {
            case 'high':
                return 'bg-red-100 text-red-800'
            case 'medium':
                return 'bg-yellow-100 text-yellow-800'
            case 'low':
                return 'bg-green-100 text-green-800'
            default:
                return 'bg-gray-100 text-gray-800'
        }
    }

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'open':
                return 'bg-blue-100 text-blue-800'
            case 'in_progress':
                return 'bg-yellow-100 text-yellow-800'
            case 'closed':
                return 'bg-gray-100 text-gray-800'
            default:
                return 'bg-gray-100 text-gray-800'
        }
    }

    return (
        <>
            <Link to={linkPath}>
                <Card className="hover:shadow-md transition-shadow h-[180px] mb-4">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <CardTitle>{title}</CardTitle>
                            <div className="flex gap-2">
                                <Badge className={getPriorityColor(priority)}>
                                    {priority}
                                </Badge>
                                <Badge className={getStatusColor(status)}>
                                    {status}
                                </Badge>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {description && (
                            <p className="text-gray-600 mb-4 line-clamp-2">
                                {description}
                            </p>
                        )}
                        {tags && tags.values && (
                            <div className="mb-4">
                                <div ref={tagsContainerRef} className="flex flex-wrap gap-2">
                                    {renderTags()}
                                </div>
                            </div>
                        )}
                        <div className="text-sm text-gray-500">
                            <p>Created {created_at ? formatDateTime(created_at) : 'Unknown'}</p>
                            {updated_at && (
                                <p>Updated {formatDateTime(updated_at)}</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </Link>
            {tags && (
                <TagsDialog
                    open={isTagsDialogOpen}
                    onOpenChange={setIsTagsDialogOpen}
                    tags={tags}
                    onTagClick={onTagClick}
                />
            )}
        </>
    )
} 
