import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog"
import MacroForm from './MacroForm'
import { db } from '../lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { updateMacro } from '../lib/mutations'

interface EditMacroDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    macroId: string;
    organizationId: string;
}

export default function EditMacroDialog({ open, onOpenChange, macroId, organizationId }: EditMacroDialogProps) {
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

    if (!macro) {
        return null;
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Macro</DialogTitle>
                </DialogHeader>
                <MacroForm
                    organizationId={organizationId}
                    initialData={macro.macro}
                    onSubmit={async (data) => {
                        await updateMacro(macroId, {
                            macro: data
                        });
                        onOpenChange(false);
                    }}
                    onCancel={() => onOpenChange(false)}
                />
            </DialogContent>
        </Dialog>
    );
} 
