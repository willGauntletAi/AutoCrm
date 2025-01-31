import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog"
import MacroForm from './MacroForm'
import { db } from '../lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { updateMacro, deleteMacroChain, createMacroChain } from '../lib/mutations'
import { useState, useEffect } from 'react'

interface EditMacroDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    macroId: string;
    organizationId: string;
}

export default function EditMacroDialog({ open, onOpenChange, macroId, organizationId }: EditMacroDialogProps) {
    const [selectedNextMacros, setSelectedNextMacros] = useState<string[]>([]);

    const macro = useLiveQuery(
        async () => {
            return await db.macros
                .where('id')
                .equals(macroId)
                .filter(macro => !macro.deleted_at)
                .first();
        },
        [macroId]
    );

    // Fetch existing macro chains
    const macroChains = useLiveQuery(
        async () => {
            if (!macroId) return [];
            return await db.macroChains
                .where('parent_macro_id')
                .equals(macroId)
                .filter(chain => !chain.deleted_at)
                .toArray();
        },
        [macroId],
        []
    );

    // Update selectedNextMacros when macroChains changes
    useEffect(() => {
        setSelectedNextMacros(macroChains.map(chain => chain.child_macro_id));
    }, [macroChains]);

    if (!macro) {
        return null;
    }

    const handleSubmit = async (data: typeof macro.macro) => {
        // Update the macro
        await updateMacro(macroId, {
            macro: data
        });

        // Get existing chain IDs for comparison
        const existingChainIds = new Set(macroChains.map(chain => chain.child_macro_id));
        const newChainIds = new Set(selectedNextMacros);

        // Delete removed chains
        await Promise.all(
            macroChains
                .filter(chain => !newChainIds.has(chain.child_macro_id))
                .map(chain => deleteMacroChain(chain.id))
        );

        // Create new chains
        await Promise.all(
            selectedNextMacros
                .filter(childId => !existingChainIds.has(childId))
                .map(async (childId) => {
                    await createMacroChain({
                        id: crypto.randomUUID(),
                        parent_macro_id: macroId,
                        child_macro_id: childId
                    });
                })
        );

        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Macro</DialogTitle>
                </DialogHeader>
                <MacroForm
                    organizationId={organizationId}
                    initialData={macro.macro}
                    onSubmit={handleSubmit}
                    onCancel={() => onOpenChange(false)}
                    selectedNextMacros={selectedNextMacros}
                    onNextMacrosChange={setSelectedNextMacros}
                />
            </DialogContent>
        </Dialog>
    );
} 
