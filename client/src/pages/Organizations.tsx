import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { CreateOrganizationDialog } from '../components/CreateOrganizationDialog';
import { Link } from 'react-router-dom';
import { db } from '../lib/db';
import type { Organization } from '../lib/db';
import { create } from '../lib/mutations';
import { useState } from 'react';

export default function Organizations() {
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const organizations = useLiveQuery(
        async () => {
            return await db.organizations
                .filter(org => !org.deleted_at)
                .toArray();
        },
        [],
        []
    );

    const handleCreateOrganization = async (name: string) => {
        try {
            setIsCreating(true);
            setError(null);
            await create('organizations', {
                name,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create organization');
        } finally {
            setIsCreating(false);
        }
    };

    if (!organizations) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-4">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-4xl font-bold">Organizations</h1>
                    <CreateOrganizationDialog
                        trigger={<Button>Create Organization</Button>}
                        onCreateOrganization={handleCreateOrganization}
                        isLoading={isCreating}
                    />
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-md mb-4">
                        {error}
                    </div>
                )}

                <div className="grid gap-4">
                    {organizations.map((org: Organization) => (
                        <Card key={org.id}>
                            <CardHeader>
                                <CardTitle>{org.name}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-gray-500">
                                    Created {new Date(org.created_at || '').toLocaleDateString()}
                                </p>
                                <Button variant="link" className="mt-2 p-0" asChild>
                                    <Link to={`/${org.id}/tickets`}>View Tickets</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ))}

                    {organizations.length === 0 && (
                        <div className="text-center p-8 bg-gray-50 rounded-lg">
                            <p className="text-gray-600">You don't have any organizations yet.</p>
                            <CreateOrganizationDialog
                                trigger={
                                    <Button variant="link" className="mt-2">
                                        Create your first organization
                                    </Button>
                                }
                                onCreateOrganization={handleCreateOrganization}
                                isLoading={isCreating}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
} 