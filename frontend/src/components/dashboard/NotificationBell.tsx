import { useEffect, useState, useRef } from 'react';
import { fetchWithAuth } from '@/lib/api';
import { Bell, AlertTriangle, Clock, CreditCard } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface LowStockItem {
    product_id: number;
    name: string;
    reorder_threshold: number;
    current_stock_level: number;
}

interface NearExpiryItem {
    product_id: number;
    name: string;
    expiring_dates: string[];
    current_stock_level: number;
}

interface PendingCheck {
    invoice_id: number;
    supplier_name: string;
    supplier_invoice_number: string;
    total_amount: string;
    check_number: string;
    check_date: string;
}

export default function NotificationBell() {
    const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
    const [nearExpiry, setNearExpiry] = useState<NearExpiryItem[]>([]);
    const [pendingChecks, setPendingChecks] = useState<PendingCheck[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const prevNotifCount = useRef<number>(0);
    
    // The logged-in user
    const user = JSON.parse(localStorage.getItem('user') || '{}') as Record<string, unknown>;
    const userPerms: string[] = (user.permissions as string[]) || [];
    
    const canViewInventory = userPerms.includes('VIEW_TAB_INVENTORY');
    const canViewFinance = userPerms.includes('VIEW_TAB_FINANCE');

    useEffect(() => {
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                let newLs = 0;
                let newNe = 0;
                let newPc = 0;

                if (canViewInventory) {
                    const alertsData = await fetchWithAuth('/inventory/alerts');
                    if (alertsData) {
                        setLowStock(alertsData.lowStock || []);
                        setNearExpiry(alertsData.nearExpiry || []);
                        newLs = (alertsData.lowStock || []).length;
                        newNe = (alertsData.nearExpiry || []).length;
                    }
                }
                if (canViewFinance) {
                    const checksData = await fetchWithAuth('/finance/pending-checks');
                    if (checksData && Array.isArray(checksData)) {
                        const now = new Date();
                        const in7Days = new Date();
                        in7Days.setDate(now.getDate() + 7);
                        
                        const upcomingOrOverdue = checksData.filter((check: PendingCheck) => {
                            const checkDate = new Date(check.check_date);
                            return checkDate <= in7Days;
                        });
                        setPendingChecks(upcomingOrOverdue);
                        newPc = upcomingOrOverdue.length;
                    }
                }

                const newTotal = newLs + newNe + newPc;
                
                if (newTotal > prevNotifCount.current) {
                    if ("Notification" in window && Notification.permission === "granted") {
                        const diff = newTotal - prevNotifCount.current;
                        new Notification("Pharmacy POS Alert", {
                            body: `You have ${diff} new alert${diff > 1 ? 's' : ''}. Please check the Notification Bell.`,
                        });
                    }
                }
                prevNotifCount.current = newTotal;

            } catch (error) {
                console.error('Failed to fetch notifications', error);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 60000); // Poll every minute
        return () => clearInterval(interval);
    }, [canViewInventory, canViewFinance]);

    const totalNotifications = lowStock.length + nearExpiry.length + pendingChecks.length;

    if (!canViewInventory && !canViewFinance) return null;

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="relative h-10 w-10 border-slate-200 hover:bg-slate-50">
                    <Bell className="h-5 w-5 text-slate-600" />
                    {totalNotifications > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                            {totalNotifications > 99 ? '99+' : totalNotifications}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50/50">
                    <h4 className="font-semibold text-sm">Notifications</h4>
                    <Badge variant="secondary" className="text-xs">{totalNotifications} new</Badge>
                </div>
                
                <div className="max-h-[400px] overflow-y-auto">
                    {totalNotifications === 0 ? (
                        <div className="p-8 text-center text-sm text-slate-500">
                            You're all caught up!
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {lowStock.map((item) => (
                                <div key={`ls-${item.product_id}`} className="px-4 py-3 border-b hover:bg-slate-50 transition-colors flex gap-3 items-start">
                                    <div className="mt-0.5 bg-orange-100 p-1.5 rounded-md text-orange-600">
                                        <AlertTriangle className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Low Stock: {item.name}</p>
                                        <p className="text-xs text-slate-500">Current: {item.current_stock_level} (Threshold: {item.reorder_threshold})</p>
                                    </div>
                                </div>
                            ))}
                            
                            {nearExpiry.map((item) => (
                                <div key={`ne-${item.product_id}`} className="px-4 py-3 border-b hover:bg-slate-50 transition-colors flex gap-3 items-start">
                                    <div className="mt-0.5 bg-red-100 p-1.5 rounded-md text-red-600">
                                        <Clock className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Expiring Soon: {item.name}</p>
                                        <p className="text-xs text-slate-500">Dates: {item.expiring_dates.map(d => new Date(d).toLocaleDateString()).join(', ')}</p>
                                    </div>
                                </div>
                            ))}
                            
                            {pendingChecks.map((check) => (
                                <div key={`pc-${check.invoice_id}`} className="px-4 py-3 border-b hover:bg-slate-50 transition-colors flex gap-3 items-start">
                                    <div className="mt-0.5 bg-blue-100 p-1.5 rounded-md text-blue-600">
                                        <CreditCard className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Check Due: {check.supplier_name}</p>
                                        <p className="text-xs text-slate-500">
                                            {check.check_number ? `#${check.check_number}` : 'No check #'} - {new Date(check.check_date).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
