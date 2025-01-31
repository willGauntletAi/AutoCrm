import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { User } from '@supabase/supabase-js'
import { db } from '../lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { IS_INITIALIZED_KEY } from '../lib/sync-from-server'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const [authLoading, setAuthLoading] = useState(true)
    const [user, setUser] = useState<User | null>(null)
    const location = useLocation()

    const isInitialized = useLiveQuery(
        async () => {
            const record = await db.system.get(IS_INITIALIZED_KEY)
            console.log('Initialization check:', { IS_INITIALIZED_KEY, record })
            return record?.value === 'true'
        }
    )

    const profile = useLiveQuery(
        async () => {
            console.log('Checking profile for user:', user?.id)
            if (!user) return undefined // Return undefined instead of null during initial load
            const result = await db.profiles.where('id').equals(user.id).first()
            console.log('Profile query result:', { userId: user.id, profile: result })
            return result ?? null
        },
        [user]
    )

    useEffect(() => {
        async function loadUser() {
            // Check current auth status
            const { data: { session } } = await supabase.auth.getSession()
            const currentUser = session?.user ?? null
            console.log('Auth session loaded:', {
                hasSession: !!session,
                userId: currentUser?.id,
                email: currentUser?.email
            })
            setUser(currentUser)
            setAuthLoading(false)
        }

        loadUser()

        // Listen for auth changes
        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            const currentUser = session?.user ?? null
            console.log('Auth state changed:', {
                event: _event,
                userId: currentUser?.id,
                email: currentUser?.email
            })
            setUser(currentUser)
        })

        return () => {
            authSubscription.unsubscribe()
        }
    }, [])

    console.log('ProtectedRoute state:', {
        authLoading,
        hasUser: !!user,
        userId: user?.id,
        hasProfile: !!profile,
        profileState: profile === undefined ? 'loading' : profile === null ? 'not-found' : 'found',
        isInitialized,
        currentPath: location.pathname
    })

    // Only show loading state during initial auth check or when profile is still loading
    if (authLoading || profile === undefined) {
        console.log('Loading state:', {
            authLoading,
            profileUndefined: profile === undefined
        })
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        )
    }

    if (!user) {
        console.log('No user, redirecting to login')
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    // Only redirect to profile page if we're sure the profile doesn't exist and we're not already on the create-profile page
    if (profile === null && location.pathname !== '/create-profile') {
        console.log('No profile found, redirecting to create-profile', {
            userId: user.id,
            currentPath: location.pathname
        })
        return <Navigate to="/create-profile" state={{ from: location }} replace />
    }

    return children
} 