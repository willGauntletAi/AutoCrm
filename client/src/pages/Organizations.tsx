import { useState } from 'react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Database } from '../types/database.types'
import { trpc } from '../lib/trpc'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "../components/ui/dialog"
import { Input } from "../components/ui/input"

type Organization = Database['public']['Tables']['organizations']['Row']

export default function Organizations() {
    const [error, setError] = useState<string | null>(null)
    const [newOrgName, setNewOrgName] = useState('')
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    const { data: organizations, isLoading } = trpc.getOrganizations.useQuery<Organization[]>(undefined, {
        onError: (err) => {
            setError(err.message)
        }
    })

    const createOrganization = trpc.createOrganization.useMutation<Organization>({
        onSuccess: () => {
            setNewOrgName('')
            setIsDialogOpen(false)
        },
        onError: (err) => {
            setError(err.message)
        }
    })

    const handleCreateOrganization = async () => {
        if (!newOrgName) return
        createOrganization.mutate({ name: newOrgName })
    }

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen p-4">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-4xl font-bold">Organizations</h1>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>Create Organization</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create New Organization</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="flex flex-col gap-2">
                                    <Input
                                        id="name"
                                        placeholder="Organization name"
                                        value={newOrgName}
                                        onChange={(e) => setNewOrgName(e.target.value)}
                                    />
                                </div>
                                <Button
                                    onClick={handleCreateOrganization}
                                    disabled={createOrganization.isLoading}
                                >
                                    {createOrganization.isLoading ? 'Creating...' : 'Create'}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-md mb-4">
                        {error}
                    </div>
                )}

                <div className="grid gap-4">
                    {organizations?.map((org) => (
                        <Card key={org.id}>
                            <CardHeader>
                                <CardTitle>{org.name}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-gray-500">
                                    Created {new Date(org.created_at || '').toLocaleDateString()}
                                </p>
                            </CardContent>
                        </Card>
                    ))}

                    {organizations?.length === 0 && (
                        <div className="text-center p-8 bg-gray-50 rounded-lg">
                            <p className="text-gray-600">You don't have any organizations yet.</p>
                            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="link" className="mt-2">
                                        Create your first organization
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Create New Organization</DialogTitle>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div className="flex flex-col gap-2">
                                            <Input
                                                id="name"
                                                placeholder="Organization name"
                                                value={newOrgName}
                                                onChange={(e) => setNewOrgName(e.target.value)}
                                            />
                                        </div>
                                        <Button
                                            onClick={handleCreateOrganization}
                                            disabled={createOrganization.isLoading}
                                        >
                                            {createOrganization.isLoading ? 'Creating...' : 'Create'}
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
} 