import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { db } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/button';
import { Plus, Pencil } from 'lucide-react';
import { useState } from 'react';
import CreateMacroDialog from '../components/CreateMacroDialog';
import EditMacroDialog from '../components/EditMacroDialog';
import { deleteMacro, deleteTicketTagKey } from '../lib/mutations';
import { CreateTagDialog } from '@/components/CreateTagDialog';
import { EditTagDialog } from '@/components/EditTagDialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "../components/ui/alert-dialog"

export default function AdminPage() {
    const { organization_id } = useParams<{ organization_id: string }>();
    const { user } = useAuth();
    const [isCreateMacroOpen, setIsCreateMacroOpen] = useState(false);
    const [isCreateTagOpen, setIsCreateTagOpen] = useState(false);
    const [tagToEdit, setTagToEdit] = useState<string | null>(null);
    const [tagToDelete, setTagToDelete] = useState<{ id: string; name: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Check if user is admin
    const userRole = useLiveQuery(
        async () => {
            if (!user || !organization_id) return null;
            const member = await db.profileOrganizationMembers
                .where(['organization_id', 'profile_id'])
                .equals([organization_id, user.id])
                .filter(member => !member.deleted_at)
                .first();
            return member?.role ?? null;
        },
        [organization_id, user],
        null
    );

    // Fetch macros for this organization
    const macros = useLiveQuery(
        async () => {
            if (!organization_id) return [];
            return await db.macros
                .where('organization_id')
                .equals(organization_id)
                .filter(macro => !macro.deleted_at)
                .toArray();
        },
        [organization_id],
        []
    );

    // Fetch tags for this organization
    const tags = useLiveQuery(
        async () => {
            if (!organization_id) return [];
            return await db.ticketTagKeys
                .where('organization_id')
                .equals(organization_id)
                .filter(tag => !tag.deleted_at)
                .toArray();
        },
        [organization_id],
        []
    );

    const handleDeleteTag = async () => {
        if (!tagToDelete) return;
        try {
            await deleteTicketTagKey(tagToDelete.id);
            setTagToDelete(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete tag');
        }
    };

    if (!organization_id) {
        return (
            <div className="min-h-screen p-4">
                <div className="text-red-600">Organization ID is required</div>
            </div>
        );
    }

    if (userRole !== 'admin') {
        return (
            <div className="min-h-screen p-4">
                <div className="text-red-600">You must be an admin to view this page</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-4">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                    {error && (
                        <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-md">
                            {error}
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Organization Settings</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-gray-500">
                                Configure organization-wide settings and permissions.
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Tag Management</CardTitle>
                                <CreateTagDialog
                                    organizationId={organization_id}
                                    open={isCreateTagOpen}
                                    onOpenChange={setIsCreateTagOpen}
                                />
                                <Button
                                    size="sm"
                                    className="flex items-center gap-2"
                                    onClick={() => setIsCreateTagOpen(true)}
                                >
                                    <Plus className="h-4 w-4" />
                                    Create Tag
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {tags.length === 0 ? (
                                    <p className="text-sm text-gray-500">
                                        No tags created yet. Create your first tag to help categorize tickets.
                                    </p>
                                ) : (
                                    <div className="divide-y">
                                        {tags.map((tag) => (
                                            <div key={tag.id} className="py-4 first:pt-0 last:pb-0">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="font-medium">{tag.name}</h3>
                                                        {tag.description && (
                                                            <p className="text-sm text-gray-500 mt-1">
                                                                {tag.description}
                                                            </p>
                                                        )}
                                                        <p className="text-sm text-gray-400 mt-1">
                                                            Type: {tag.tag_type}
                                                        </p>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setTagToEdit(tag.id)}
                                                            className="flex items-center gap-2"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={() => setTagToDelete({ id: tag.id, name: tag.name })}
                                                        >
                                                            Delete
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Macro Management</CardTitle>
                                <CreateMacroDialog
                                    organizationId={organization_id}
                                    open={isCreateMacroOpen}
                                    onOpenChange={setIsCreateMacroOpen}
                                    trigger={
                                        <Button
                                            size="sm"
                                            className="flex items-center gap-2"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Create Macro
                                        </Button>
                                    }
                                />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {macros.length === 0 ? (
                                    <p className="text-sm text-gray-500">
                                        No macros created yet. Create your first macro to automate ticket updates.
                                    </p>
                                ) : (
                                    <div className="divide-y">
                                        {macros.map((macro) => (
                                            <div key={macro.id} className="py-4 first:pt-0 last:pb-0">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="font-medium">{macro.macro.name}</h3>
                                                        {macro.macro.description && (
                                                            <p className="text-sm text-gray-500 mt-1">
                                                                {macro.macro.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <EditMacroDialog
                                                            organizationId={organization_id}
                                                            macroId={macro.id}
                                                            trigger={
                                                                <Button variant="outline" size="sm">
                                                                    Edit
                                                                </Button>
                                                            }
                                                        />
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={async () => {
                                                                try {
                                                                    await deleteMacro(macro.id);
                                                                } catch (error) {
                                                                    console.error('Error deleting macro:', error);
                                                                }
                                                            }}
                                                        >
                                                            Delete
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <AlertDialog open={tagToDelete !== null} onOpenChange={(open: boolean) => !open && setTagToDelete(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete the tag "{tagToDelete?.name}"? This will remove the tag from all tickets.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteTag}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>

            <EditTagDialog
                open={tagToEdit !== null}
                onOpenChange={(open) => !open && setTagToEdit(null)}
                tagId={tagToEdit || ''}
                onSuccess={() => setTagToEdit(null)}
            />
        </div>
    );
} 