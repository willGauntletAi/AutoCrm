import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from "../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { trpc } from '../lib/trpc'

export default function CreateProfile() {
    const [fullName, setFullName] = useState('')
    const [avatarUrl, setAvatarUrl] = useState('')
    const [error, setError] = useState('')
    const navigate = useNavigate()
    const utils = trpc.useContext()

    const createProfile = trpc.createProfile.useMutation({
        onSuccess: () => {
            // Invalidate the profile query so it refetches when we navigate back
            utils.getProfile.invalidate()
            navigate('/')
        },
        onError: (error) => {
            setError(error.message)
        }
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        createProfile.mutate({
            fullName,
            avatarUrl: avatarUrl || undefined
        })
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-center text-gray-900">Create Your Profile</CardTitle>
                    <CardDescription className="text-center text-gray-600">
                        Please provide some information about yourself
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
                                {error}
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="fullName">Full Name</Label>
                            <div className="mt-2">
                                <Input
                                    id="fullName"
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    required
                                    placeholder="Enter your full name"
                                    className="text-gray-900"
                                    disabled={createProfile.isLoading}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="avatarUrl">Avatar URL (optional)</Label>
                            <div className="mt-2">
                                <Input
                                    id="avatarUrl"
                                    type="url"
                                    value={avatarUrl}
                                    onChange={(e) => setAvatarUrl(e.target.value)}
                                    placeholder="Enter your avatar URL"
                                    className="text-gray-900"
                                    disabled={createProfile.isLoading}
                                />
                            </div>
                        </div>
                        <Button
                            type="submit"
                            disabled={createProfile.isLoading}
                            className="w-full"
                        >
                            {createProfile.isLoading ? 'Creating Profile...' : 'Create Profile'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
} 