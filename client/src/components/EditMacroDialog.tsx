import { useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from './ui/dialog';
import { db, MacroSchema } from '../lib/db';
import { updateMacro } from '../lib/mutations';
import { useLiveQuery } from 'dexie-react-hooks';
import type { z } from 'zod';
import MacroForm from './MacroForm';

interface EditMacroDialogProps {
    organizationId: string;
    macroId: string;
    trigger: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export default function EditMacroDialog({ organizationId, macroId, trigger, open, onOpenChange }: EditMacroDialogProps) {
    // Fetch the existing macro data
    const macro = useLiveQuery(
        async () => {
            return await db.macros
                .where('id')
                .equals(macroId)
                .filter(m => !m.deleted_at)
                .first();
        },
        [macroId]
    );

    const handleSubmit = async (data: z.infer<typeof MacroSchema>['macro']) => {
        try {
            await updateMacro(macroId, { macro: data });
            onOpenChange?.(false);
        } catch (error) {
            console.error('Error updating macro:', error);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
            modal={true}
        >
            <DialogTrigger asChild>
                {trigger}
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Edit Macro</DialogTitle>
                    <DialogDescription>
                        Edit this automation macro to update tickets based on conditions.
                    </DialogDescription>
                </DialogHeader>

                <MacroForm
                    organizationId={organizationId}
                    initialData={macro?.macro}
                    onSubmit={handleSubmit}
                    onCancel={() => onOpenChange?.(false)}
                />
            </DialogContent>
        </Dialog>
    );
} 
