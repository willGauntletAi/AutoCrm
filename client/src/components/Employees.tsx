import { useLiveQuery } from 'dexie-react-hooks';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { db } from '../lib/db';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { useState } from 'react';
import { Input } from './ui/input';
import { createOrganizationInvitation, deleteOrganizationInvitation } from '../lib/mutations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface EmployeesProps {
    organizationId: string;
}

export default function Employees({ organizationId }: EmployeesProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'admin' | 'member'>('member');
    const [error, setError] = useState<string | null>(null);
    const [isInviting, setIsInviting] = useState(false);

    const employees = useLiveQuery(
        async () => {
            const memberRecords = await db.profileOrganizationMembers
                .where('organization_id')
                .equals(organizationId)
                .filter(member => !member.deleted_at && member.role !== 'customer')
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

    const invitations = useLiveQuery(
        async () => {
            return await db.organizationInvitations
                .where('organization_id')
                .equals(organizationId)
                .filter(invitation => !invitation.deleted_at)
                .toArray();
        },
        [organizationId],
        []
    );

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        try {
            setIsInviting(true);
            setError(null);
            await createOrganizationInvitation({
                id: crypto.randomUUID(),
                organization_id: organizationId,
                email,
                role,
            });
            setIsDialogOpen(false);
            setEmail('');
            setRole('member');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send invitation');
        } finally {
            setIsInviting(false);
        }
    };

    const handleCancelInvitation = async (invitationId: string) => {
        try {
            await deleteOrganizationInvitation(invitationId);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to cancel invitation');
        }
    };

    if (!employees || !invitations) {
        return (
            <div className="animate-pulse">
                <Card>
                    <CardHeader>
                        <div className="h-7 bg-gray-200 rounded w-1/4"></div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-16 bg-gray-100 rounded-lg"></div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Employees</CardTitle>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>Invite Employee</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Invite Employee</DialogTitle>
                                <DialogDescription>
                                    Send an invitation to a new employee. They will receive an email to join the organization.
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleInvite} className="space-y-4">
                                {error && (
                                    <div className="text-red-600 text-sm">{error}</div>
                                )}
                                <div className="space-y-2">
                                    <label htmlFor="email" className="text-sm font-medium">
                                        Email
                                    </label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="employee@example.com"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="role" className="text-sm font-medium">
                                        Role
                                    </label>
                                    <Select value={role} onValueChange={(value: 'admin' | 'member') => setRole(value)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="member">Member</SelectItem>
                                            <SelectItem value="admin">Admin</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button type="submit" className="w-full" disabled={isInviting}>
                                    {isInviting ? 'Sending Invitation...' : 'Send Invitation'}
                                </Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {employees.map((employee) => (
                            <div key={employee.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <div>
                                    <div className="font-medium">{employee.profile?.full_name || 'Unknown User'}</div>
                                    <Badge>{employee.role}</Badge>
                                </div>
                            </div>
                        ))}
                        {employees.length === 0 && (
                            <div className="text-center p-4 text-gray-500">
                                No employees found
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {invitations.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Pending Invitations</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {invitations.map((invitation) => (
                                <div key={invitation.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                    <div>
                                        <div className="font-medium">{invitation.email}</div>
                                        <div className="flex gap-2 items-center">
                                            <Badge variant="outline">{invitation.role}</Badge>
                                            <span className="text-sm text-gray-500">
                                                Invited {new Date(invitation.created_at || '').toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleCancelInvitation(invitation.id)}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
} 