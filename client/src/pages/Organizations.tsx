import { useState } from 'react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Database } from '../types/database.types'
import { trpc } from '../lib/trpc'
import { CreateOrganizationDialog } from '../components/CreateOrganizationDialog'

type Organization = Database['public']['Tables']['organizations']['Row']

export default function Organizations() {
    const [error, setError] = useState<string | null>(null)

    const { data: organizations, isLoading } = trpc.getOrganizations.useQuery<Organization[]>(undefined, {
        onError: (err) => {
            setError(err.message)
        }
    })

    const createOrganization = trpc.createOrganization.useMutation<Organization>({
        onError: (err) => {
            setError(err.message)
        }
    })

    const handleCreateOrganization = (name: string) => {
        createOrganization.mutate({ name })
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
                    <CreateOrganizationDialog
                        trigger={<Button>Create Organization</Button>}
                        onCreateOrganization={handleCreateOrganization}
                        isLoading={createOrganization.isLoading}
                    />
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
                            <CreateOrganizationDialog
                                trigger={
                                    <Button variant="link" className="mt-2">
                                        Create your first organization
                                    </Button>
                                }
                                onCreateOrganization={handleCreateOrganization}
                                isLoading={createOrganization.isLoading}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
} 