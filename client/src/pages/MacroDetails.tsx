import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/lib/trpc';
import { Skeleton } from '@/components/ui/skeleton';

export default function MacroDetails() {
    const { macroId, organization_id } = useParams<{ macroId: string; organization_id: string }>();

    const { data: stats, isLoading } = trpc.getMacroStats.useQuery(
        {
            macroId: macroId!,
            organizationId: organization_id!
        },
        {
            enabled: !!macroId && !!organization_id
        }
    );

    if (!macroId || !organization_id) {
        return <div>Invalid macro or organization</div>;
    }

    return (
        <div className="container mx-auto py-8">
            <h1 className="text-3xl font-bold mb-8">
                {isLoading ? (
                    <Skeleton className="h-9 w-64" />
                ) : (
                    stats?.name
                )}
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Average Latency</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold">
                            {isLoading ? (
                                <Skeleton className="h-9 w-24" />
                            ) : (
                                `${stats?.avgLatency.toFixed(2)}ms`
                            )}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Complete Success Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold">
                            {isLoading ? (
                                <Skeleton className="h-9 w-24" />
                            ) : (
                                `${stats?.avgCompleteSuccess.toFixed(1)}%`
                            )}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Partial Success Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold">
                            {isLoading ? (
                                <Skeleton className="h-9 w-24" />
                            ) : (
                                `${stats?.avgPartialSuccess.toFixed(1)}%`
                            )}
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
} 
