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
    trigger: React.ReactNode;
    onCreateOrganization: (name: string) => void;
    isLoading?: boolean;
}

export function CreateOrganizationDialog({
    trigger,
    onCreateOrganization,
    isLoading = false
}: CreateOrganizationDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [orgName, setOrgName] = useState('')

    const handleCreate = () => {
        if (!orgName) return
        onCreateOrganization(orgName)
        setOrgName('')
        setIsOpen(false)
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger}
            </DialogTrigger>
            <DialogContent className="bg-white">
                <DialogHeader>
                    <DialogTitle className="text-gray-900">Create New Organization</DialogTitle>
                    <DialogDescription>
                        Enter a name for your new organization. You'll be added as an admin automatically.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
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
                        onClick={handleCreate}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Creating...' : 'Create'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
} 