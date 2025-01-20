import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from "../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"

export default function Register() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        // TODO: Implement registration logic
        console.log('Register attempt:', { email, password, confirmPassword })
    }

    return (
        <div className="flex items-center justify-center bg-gray-50 h-screen w-screen ">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-center text-gray-900">Create an account</CardTitle>
                    <CardDescription className="text-center text-gray-600">
                        Already have an account?{' '}
                        <Link to="/login" className="text-blue-600 hover:text-blue-800 font-medium">
                            Sign in here
                        </Link>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-gray-900">Email address</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="Enter your email"
                                className="text-gray-900"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-gray-900">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="Create a password"
                                className="text-gray-900"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword" className="text-gray-900">Confirm Password</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                placeholder="Confirm your password"
                                className="text-gray-900"
                            />
                        </div>
                        <Button type="submit" className="w-full">
                            Create account
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
} 