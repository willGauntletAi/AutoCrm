import { useEffect, useState } from 'react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { supabase } from '../lib/supabase'
import { Database } from '../types/database.types'

type Organization = Database['public']['Tables']['organizations']['Row']

type OrganizationResponse = {
    organization: Organization | null
}

export default function Organizations() {
    const [organizations, setOrganizations] = useState<Organization[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function fetchOrganizations() {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                const { data, error } = await supabase
                    .from('profile_organization_members')
                    .select(`
                        organization:organizations (
                            id,
                            name,
                            created_at
                        )
                    `)
                    .eq('profile_id', user.id)
                    .returns<OrganizationResponse[]>()

                if (error) throw error

                // Extract organizations from the nested structure
                const orgs = data
                    .map(item => item.organization)
                    .filter((org): org is Organization => org !== null)

                setOrganizations(orgs)
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch organizations')
            } finally {
                setLoading(false)
            }
        }

        fetchOrganizations()
    }, [])

    const handleCreateOrganization = async () => {
        const name = prompt('Enter organization name:')
        if (!name) return

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Insert new organization
            const { data: orgData, error: orgError } = await supabase
                .from('organizations')
                .insert([{ name }])
                .select()
                .single()

            if (orgError) throw orgError

            // Add current user as a member
            const { error: memberError } = await supabase
                .from('profile_organization_members')
                .insert([{
                    organization_id: orgData.id,
                    profile_id: user.id,
                    role: 'admin'
                }])

            if (memberError) throw memberError

            // Add new organization to state
            setOrganizations(prev => [...prev, orgData])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create organization')
        }
    }

    if (loading) {
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
                    <Button onClick={handleCreateOrganization}>
                        Create Organization
                    </Button>
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
                            <Button
                                variant="link"
                                onClick={handleCreateOrganization}
                                className="mt-2"
                            >
                                Create your first organization
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
} 