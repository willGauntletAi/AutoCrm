import { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "./ui/dialog"

interface CreateOrganizationDialogProps {
    trigger?: React.ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (name: string) => void;
    isLoading?: boolean;
}

export function CreateOrganizationDialog({
    trigger,
    open,
    onOpenChange,
    onSubmit,
    isLoading = false
}: CreateOrganizationDialogProps) {
    const [orgName, setOrgName] = useState('')

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!orgName) return
        onSubmit(orgName)
        setOrgName('')
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="bg-white">
                <DialogHeader>
                    <DialogTitle className="text-gray-900">Create New Organization</DialogTitle>
                    <DialogDescription>
                        Enter a name for your new organization. You'll be added as an admin automatically.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="flex flex-col gap-2">
                        <Input
                            id="name"
                            placeholder="Organization name"
                            value={orgName}
                            onChange={(e) => setOrgName(e.target.value)}
                            className="bg-white text-gray-900"
                        />
                    </div>
                    <Button
                        type="submit"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Creating...' : 'Create'}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    )
} 