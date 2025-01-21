import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { User } from '@supabase/supabase-js'
import { Database } from '../types/database.types'
import { ProfileContext } from '../contexts/ProfileContext'

type Profile = Database['public']['Tables']['profiles']['Row']

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const location = useLocation()

    useEffect(() => {
        async function loadUserAndProfile() {
            // Check current auth status
            const { data: { session } } = await supabase.auth.getSession()
            const currentUser = session?.user ?? null
            setUser(currentUser)

            if (currentUser) {
                // Fetch user's profile
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', currentUser.id)
                    .single()

                setProfile(profile)
            }

            setLoading(false)
        }

        loadUserAndProfile()

        // Listen for auth changes
        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            const currentUser = session?.user ?? null
            setUser(currentUser)

            if (currentUser) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', currentUser.id)
                    .single()

                setProfile(profile)
            } else {
                setProfile(null)
            }
        })

        // Subscribe to profile changes
        const profileSubscription = supabase
            .channel('profile-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${user?.id}`,
                },
                (payload) => {
                    if (payload.eventType === 'DELETE') {
                        setProfile(null)
                    } else {
                        // For INSERT and UPDATE events
                        setProfile(payload.new as Profile)
                    }
                }
            )
            .subscribe()

        return () => {
            authSubscription.unsubscribe()
            profileSubscription.unsubscribe()
        }
    }, [user?.id])

    if (loading) {
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
    if (!profile && location.pathname !== '/profile') {
        return <Navigate to="/profile" state={{ from: location }} replace />
    }

    return (
        <ProfileContext.Provider value={{ user, profile, loading }}>
            {children}
        </ProfileContext.Provider>
    )
} 