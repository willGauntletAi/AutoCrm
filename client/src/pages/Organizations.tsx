import { useEffect, useState } from 'react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Database } from '../types/database.types'
import { supabase } from '../lib/supabase'
import { trpc } from '../lib/trpc'
import { CreateOrganizationDialog } from '../components/CreateOrganizationDialog'
import { z } from 'zod'

type Organization = Database['public']['Tables']['organizations']['Row']

const organizationSchema = z.object({
    id: z.string(),
    name: z.string(),
    created_at: z.string().nullable()
})

export default function Organizations() {
    const [error, setError] = useState<string | null>(null)
    const [organizations, setOrganizations] = useState<Organization[]>([])

    const { isLoading } = trpc.getOrganizations.useQuery(undefined, {
        onError: (err) => {
            setError(err.message)
        },
        onSuccess: (data) => {
            // Validate and set the initial data
            const orgs = data.map(org => {
                const parseResult = organizationSchema.safeParse(org)
                if (!parseResult.success) {
                    console.error('Invalid organization data:', parseResult.error)
                    return null
                }
                return parseResult.data
            }).filter((org): org is Organization => org !== null)

            setOrganizations(orgs)
        }
    })

    const createOrganization = trpc.createOrganization.useMutation<Organization>({
        onError: (err) => {
            setError(err.message)
        }
    })

    useEffect(() => {
        // Set up real-time subscription
        const subscription = supabase
            .channel('organizations')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'organizations'
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const parseResult = organizationSchema.safeParse(payload.new)
                        if (parseResult.success) {
                            setOrganizations(prev => [...prev, parseResult.data])
                        } else {
                            console.error('Invalid organization data:', parseResult.error)
                        }
                    } else if (payload.eventType === 'DELETE') {
                        setOrganizations(prev => prev.filter(org => org.id !== payload.old.id))
                    } else if (payload.eventType === 'UPDATE') {
                        const parseResult = organizationSchema.safeParse(payload.new)
                        if (parseResult.success) {
                            setOrganizations(prev => prev.map(org =>
                                org.id === parseResult.data.id ? parseResult.data : org
                            ))
                        } else {
                            console.error('Invalid organization data:', parseResult.error)
                        }
                    }
                }
            )
            .subscribe()

        // Cleanup subscription
        return () => {
            subscription.unsubscribe()
        }
    }, [])

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
                    {organizations.map((org) => (
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
                                isLoading={createOrganization.isLoading}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
} 