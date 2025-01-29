import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Link } from 'react-router-dom'
import { formatDateTime } from '@/lib/utils'
import type { TicketTagKey } from '@/lib/db'
import type { TagFilter } from './TicketFilters'

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

export function TicketCard({
    id,
    title,
    priority,
    status,
    created_at,
    updated_at,
    description,
    organization_id,
    linkPath,
    tags,
    onTagClick
}: TicketCardProps) {
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
                            <div className="flex flex-wrap gap-2">
                                {tags.keys.map((tagKey: TicketTagKey, index) => {
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

                                    // Only show first 4 tags
                                    if (index >= 4) return null;

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
                                            }}
                                        >
                                            {tagKey.name}: {value}
                                        </Badge>
                                    );
                                })}
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
    )
} 
