import { Link, Outlet, useParams } from 'react-router-dom'
import { Button } from './ui/button'
import { Menu } from 'lucide-react'
import { cn } from '../lib/utils'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from './ui/sheet'

const navItems = [
    { name: 'Dashboard', path: '' },
    { name: 'Tickets', path: 'tickets' },
    { name: 'Customers', path: 'customers' },
    { name: 'Employees', path: 'employees' },
]

export default function OrganizationLayout() {
    const { organization_id } = useParams()

    return (
        <div className="flex h-screen">
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex w-64 flex-col border-r bg-gray-50/40">
                <div className="p-6">
                    <h2 className="text-lg font-semibold">Organization</h2>
                </div>
                <nav className="flex-1 space-y-1 px-4">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={`/${organization_id}/${item.path}`}
                            className={cn(
                                "flex items-center px-4 py-2 text-sm rounded-md hover:bg-gray-100",
                                "transition-colors duration-200"
                            )}
                        >
                            {item.name}
                        </Link>
                    ))}
                </nav>
            </aside>

            {/* Mobile Sidebar */}
            <Sheet>
                <SheetTrigger asChild className="md:hidden">
                    <Button variant="ghost" size="icon" className="h-10 w-10">
                        <Menu className="h-6 w-6" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64">
                    <SheetHeader>
                        <SheetTitle>Organization</SheetTitle>
                    </SheetHeader>
                    <nav className="flex flex-col space-y-1 mt-4">
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                to={`/${organization_id}/${item.path}`}
                                className={cn(
                                    "flex items-center px-4 py-2 text-sm rounded-md hover:bg-gray-100",
                                    "transition-colors duration-200"
                                )}
                            >
                                {item.name}
                            </Link>
                        ))}
                    </nav>
                </SheetContent>
            </Sheet>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                <Outlet />
            </main>
        </div>
    )
} 