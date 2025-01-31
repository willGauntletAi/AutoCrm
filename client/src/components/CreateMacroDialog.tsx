import { v4 as uuidv4 } from 'uuid';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from './ui/dialog';
import { createMacro, createMacroChain } from '../lib/mutations';
import type { z } from 'zod';
import { MacroSchema } from '../lib/db';
import MacroForm from './MacroForm';
import { useState } from 'react';

interface CreateMacroDialogProps {
    organizationId: string;
    trigger: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export default function CreateMacroDialog({ organizationId, trigger, open, onOpenChange }: CreateMacroDialogProps) {
    const [selectedNextMacros, setSelectedNextMacros] = useState<string[]>([]);

    const handleSubmit = async (data: z.infer<typeof MacroSchema>['macro']) => {
        try {
            // Create macro using the mutations system
            const macroId = uuidv4();
            await createMacro({
                id: macroId,
                organization_id: organizationId,
                macro: data
            });

            // Create macro chains for each selected next macro
            await Promise.all(selectedNextMacros.map(async (childMacroId) => {
                const chainId = uuidv4();
                await createMacroChain({
                    id: chainId,
                    parent_macro_id: macroId,
                    child_macro_id: childMacroId
                });
            }));

            // Close dialog
            onOpenChange?.(false);
        } catch (error) {
            console.error('Error creating macro:', error);
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
                    <DialogTitle>Create Macro</DialogTitle>
                    <DialogDescription>
                        Create a new automation macro to update tickets based on conditions.
                    </DialogDescription>
                </DialogHeader>

                <MacroForm
                    organizationId={organizationId}
                    onSubmit={handleSubmit}
                    onCancel={() => onOpenChange?.(false)}
                    selectedNextMacros={selectedNextMacros}
                    onNextMacrosChange={setSelectedNextMacros}
                />
            </DialogContent>
        </Dialog>
    );
} 