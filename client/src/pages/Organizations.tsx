import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { CreateOrganizationDialog } from '../components/CreateOrganizationDialog';
import { Link } from 'react-router-dom';
import { db } from '../lib/db';
import type { Organization, OrganizationInvitation } from '../lib/db';
import { createOrganization, createProfileOrganizationMember, deleteOrganizationInvitation } from '../lib/mutations';
import { useState } from 'react';
import OrganizationMembers from '../components/OrganizationMembers';
import { useAuth } from '../lib/auth';

export default function Organizations() {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { user } = useAuth();

    const organizations = useLiveQuery(
        async () => {
            return await db.organizations
                .filter(org => !org.deleted_at)
                .toArray();
        },
        [],
        []
    );

    const invitations = useLiveQuery(
        async () => {
            if (!user?.email) return [];
            return await db.organizationInvitations
                .filter(inv => inv.email === user.email && !inv.deleted_at)
                .toArray();
        },
        [user?.email],
        []
    );

    const handleCreateOrganization = async (name: string) => {
        try {
            setIsCreating(true);
            setError(null);
            await createOrganization({
                id: crypto.randomUUID(),
                name,
            });
            setIsDialogOpen(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create organization');
        } finally {
            setIsCreating(false);
        }
    };

    const handleAcceptInvitation = async (invitation: OrganizationInvitation) => {
        try {
            setError(null);
            if (!user?.id) throw new Error('Not logged in');

            // Create organization membership
            await createProfileOrganizationMember({
                id: crypto.randomUUID(),
                profile_id: user.id,
                organization_id: invitation.organization_id,
                role: invitation.role,
            });

            // Delete the invitation
            await deleteOrganizationInvitation(invitation.id);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to accept invitation');
        }
    };

    const handleRejectInvitation = async (invitation: OrganizationInvitation) => {
        try {
            setError(null);
            await deleteOrganizationInvitation(invitation.id);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to reject invitation');
        }
    };

    if (!organizations || !invitations) {
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
                        open={isDialogOpen}
                        onOpenChange={setIsDialogOpen}
                        onSubmit={handleCreateOrganization}
                        isLoading={isCreating}
                    />
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-md mb-4">
                        {error}
                    </div>
                )}

                {invitations.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4">Invitations</h2>
                        <div className="space-y-4">
                            {invitations.map((invitation) => (
                                <Card key={invitation.id}>
                                    <CardHeader>
                                        <CardTitle>Invitation to join organization</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm text-gray-500">
                                                    Role: {invitation.role}
                                                </p>
                                                <p className="text-sm text-gray-500">
                                                    Invited: {new Date(invitation.created_at || '').toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className="space-x-2">
                                                <Button
                                                    variant="outline"
                                                    onClick={() => handleRejectInvitation(invitation)}
                                                >
                                                    Reject
                                                </Button>
                                                <Button
                                                    onClick={() => handleAcceptInvitation(invitation)}
                                                >
                                                    Accept
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                <div className="space-y-8">
                    {organizations.map((org: Organization) => (
                        <div key={org.id} className="space-y-4">
                            <Card>
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
                            <OrganizationMembers organizationId={org.id} />
                        </div>
                    ))}

                    {organizations.length === 0 && invitations.length === 0 && (
                        <div className="text-center p-8 bg-gray-50 rounded-lg">
                            <p className="text-gray-600">You don't have any organizations yet.</p>
                            <CreateOrganizationDialog
                                trigger={<Button className="mt-4">Create Organization</Button>}
                                open={isDialogOpen}
                                onOpenChange={setIsDialogOpen}
                                onSubmit={handleCreateOrganization}
                                isLoading={isCreating}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
} 