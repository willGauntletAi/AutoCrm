import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { User } from '@supabase/supabase-js'
import { db } from '../lib/db'
import { useLiveQuery } from 'dexie-react-hooks'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState<User | null>(null)
    const location = useLocation()

    const profile = useLiveQuery(
        async () => {
            console.log('user', user)
            if (!user) return null
            const result = await db.profiles.where('id').equals(user.id).first()
            console.log('result', result)
            return result ?? null
        },
        [user],
        null
    )

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
        })

        return () => {
            authSubscription.unsubscribe()
        }
    }, [])

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
    if (!profile && location.pathname !== '/create-profile') {
        return <Navigate to="/create-profile" state={{ from: location }} replace />
    }

    return children
} 