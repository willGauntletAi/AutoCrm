import { useParams } from 'react-router-dom';
import Employees from '../components/Employees';

export default function EmployeesPage() {
    const { organization_id } = useParams<{ organization_id: string }>();

    if (!organization_id) {
        return (
            <div className="min-h-screen p-4">
                <div className="text-red-600">Organization ID is required</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-4">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold">Employees</h1>
                </div>
                <Employees organizationId={organization_id} />
            </div>
        </div>
    );
} 