import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { User } from '@supabase/supabase-js'
import { ProfileContext } from '../contexts/ProfileContext'
import { trpc } from '../lib/trpc'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState<User | null>(null)
    const location = useLocation()
    const { data, refetch, isRefetching, isLoading } = trpc.getProfile.useQuery(undefined, {
        enabled: !!user,
        refetchOnWindowFocus: false
    })

    useEffect(() => {
        async function loadUser() {
            // Check current auth status
            const { data: { session } } = await supabase.auth.getSession()
            const currentUser = session?.user ?? null
            setUser(currentUser)
            setLoading(false)
        }

        loadUser()

        // Listen for auth changes
        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            const currentUser = session?.user ?? null
            setUser(currentUser)
            if (!currentUser) {
                refetch()
            }
        })

        return () => {
            authSubscription.unsubscribe()
        }
    }, [])

    if (loading || isLoading || isRefetching) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    // Redirect to profile page if user has no profile
    if (!data && location.pathname !== '/create-profile') {
        return <Navigate to="/create-profile" state={{ from: location }} replace />
    }

    return (
        <ProfileContext.Provider value={{ user, profile: data || null, loading }}>
            {children}
        </ProfileContext.Provider>
    )
} 