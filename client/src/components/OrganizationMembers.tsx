import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { db } from '../lib/db';
import { useAuth } from '../lib/auth';
import { useState } from 'react';
import { deleteProfileOrganizationMember, updateProfileOrganizationMember } from '../lib/mutations';

interface OrganizationMembersProps {
    organizationId: string;
}

export default function OrganizationMembers({ organizationId }: OrganizationMembersProps) {
    const { user } = useAuth();
    const [error, setError] = useState<string | null>(null);

    const members = useLiveQuery(
        async () => {
            const memberRecords = await db.profileOrganizationMembers
                .where('organization_id')
                .equals(organizationId)
                .filter(member => !member.deleted_at)
                .toArray();

            // Fetch user info for each member
            const userIds = memberRecords.map(member => member.profile_id);
            const profiles = await db.profiles
                .where('id')
                .anyOf(userIds)
                .toArray();

            // Create a map of user info
            const profileMap = new Map(profiles.map(profile => [profile.id, profile]));

            // Attach user info to members
            return memberRecords.map(member => ({
                ...member,
                profile: profileMap.get(member.profile_id) ?? null
            }));
        },
        [organizationId],
        []
    );

    const userRole = useLiveQuery(
        async () => {
            if (!user) return null;
            const member = await db.profileOrganizationMembers
                .where(['organization_id', 'profile_id'])
                .equals([organizationId, user.id])
                .filter(member => !member.deleted_at)
                .first();
            return member?.role ?? null;
        },
        [organizationId, user],
        null
    );

    const handleUpdateRole = async (memberId: string, newRole: string) => {
        try {
            setError(null);
            await updateProfileOrganizationMember(memberId, { role: newRole });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update member role');
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        try {
            setError(null);
            await deleteProfileOrganizationMember(memberId);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to remove member');
        }
    };

    const isAdmin = userRole === 'admin';

    return (
        <Card>
            <CardHeader>
                <CardTitle>Organization Members</CardTitle>
            </CardHeader>
            <CardContent>
                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-md mb-4">
                        {error}
                    </div>
                )}
                <div className="space-y-4">
                    {members.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div>
                                <div className="font-medium">{member.profile?.full_name || 'Unknown User'}</div>
                                <Badge>{member.role}</Badge>
                            </div>
                            {isAdmin && member.profile_id !== user?.id && (
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => handleUpdateRole(member.id, member.role === 'admin' ? 'member' : 'admin')}
                                    >
                                        {member.role === 'admin' ? 'Make Member' : 'Make Admin'}
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={() => handleRemoveMember(member.id)}
                                    >
                                        Remove
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
} 