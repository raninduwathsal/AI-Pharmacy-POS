import { useEffect, useState, useRef } from 'react';
import { fetchWithAuth } from '@/lib/api';
import { Bell, AlertTriangle, Clock, CreditCard, CheckCircle2 } from 'lucide-react';
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

interface ReadAlert {
    alert_id: string;
    message: string;
    read_at: string;
}

export default function NotificationBell() {
    const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
    const [nearExpiry, setNearExpiry] = useState<NearExpiryItem[]>([]);
    const [pendingChecks, setPendingChecks] = useState<PendingCheck[]>([]);
    const [readAlerts, setReadAlerts] = useState<ReadAlert[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const prevNotifCount = useRef<number>(0);
    
    const user = JSON.parse(localStorage.getItem('user') || '{}') as Record<string, unknown>;
    const userPerms: string[] = (user.permissions as string[]) || [];
    
    const canViewInventory = userPerms.includes('VIEW_TAB_INVENTORY');
    const canViewFinance = userPerms.includes('VIEW_TAB_FINANCE');

    useEffect(() => {
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }
    }, []);

    const fetchData = async () => {
        try {
            let readIds = new Set<string>();
            try {
                const readData = await fetchWithAuth('/alerts/read');
                if (readData && Array.isArray(readData)) {
                    setReadAlerts(readData);
                    readIds = new Set(readData.map(r => r.alert_id));
                }
            } catch (e) { console.error("Error fetching read alerts", e); }

            let newLs = 0;
            let newNe = 0;
            let newPc = 0;

            if (canViewInventory) {
                const alertsData = await fetchWithAuth('/inventory/alerts');
                if (alertsData) {
                    const filteredLs = (alertsData.lowStock || []).filter((item: any) => !readIds.has(`ls-${item.product_id}`));
                    const filteredNe = (alertsData.nearExpiry || []).filter((item: any) => !readIds.has(`ne-${item.product_id}`));
                    setLowStock(filteredLs);
                    setNearExpiry(filteredNe);
                    newLs = filteredLs.length;
                    newNe = filteredNe.length;
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
                        return checkDate <= in7Days && !readIds.has(`fin-${check.invoice_id}`);
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

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 60000); // Poll every minute
        return () => clearInterval(interval);
    }, [canViewInventory, canViewFinance]);

    const markAsRead = async (alert_id: string, message: string) => {
        // Optimistic UI updates
        if (alert_id.startsWith('ls-')) setLowStock(prev => prev.filter(a => `ls-${a.product_id}` !== alert_id));
        if (alert_id.startsWith('ne-')) setNearExpiry(prev => prev.filter(a => `ne-${a.product_id}` !== alert_id));
        if (alert_id.startsWith('fin-')) setPendingChecks(prev => prev.filter(a => `fin-${a.invoice_id}` !== alert_id));
        setReadAlerts(prev => [{ alert_id, message, read_at: new Date().toISOString() }, ...prev].slice(0, 10));
        
        try {
            await fetchWithAuth('/alerts/read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alert_id, message })
            });
        } catch (error) {
            console.error('Failed to mark as read', error);
        }
    };

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
                                <div key={`ls-${item.product_id}`} className="px-4 py-3 border-b hover:bg-slate-50 transition-colors flex gap-3 items-start group">
                                    <div className="mt-0.5 bg-orange-100 p-1.5 rounded-md text-orange-600">
                                        <AlertTriangle className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">Low Stock: {item.name}</p>
                                        <p className="text-xs text-slate-500">Current: {item.current_stock_level} (Threshold: {item.reorder_threshold})</p>
                                    </div>
                                    <button onClick={() => markAsRead(`ls-${item.product_id}`, `Low Stock: ${item.name} (${item.current_stock_level} left)`)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-green-600 transition-all" title="Mark as Read">
                                        <CheckCircle2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                            
                            {nearExpiry.map((item) => (
                                <div key={`ne-${item.product_id}`} className="px-4 py-3 border-b hover:bg-slate-50 transition-colors flex gap-3 items-start group">
                                    <div className="mt-0.5 bg-red-100 p-1.5 rounded-md text-red-600">
                                        <Clock className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">Expiring Soon: {item.name}</p>
                                        <p className="text-xs text-slate-500">Dates: {item.expiring_dates.map(d => new Date(d).toLocaleDateString()).join(', ')}</p>
                                    </div>
                                    <button onClick={() => markAsRead(`ne-${item.product_id}`, `Expiry Alert: ${item.name}`)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-green-600 transition-all" title="Mark as Read">
                                        <CheckCircle2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                            
                            {pendingChecks.map((check) => (
                                <div key={`fin-${check.invoice_id}`} className="px-4 py-3 border-b hover:bg-slate-50 transition-colors flex gap-3 items-start group">
                                    <div className="mt-0.5 bg-blue-100 p-1.5 rounded-md text-blue-600">
                                        <CreditCard className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">Check Due: {check.supplier_name}</p>
                                        <p className="text-xs text-slate-500">
                                            {check.check_number ? `#${check.check_number}` : 'No check #'} - {new Date(check.check_date).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <button onClick={() => markAsRead(`fin-${check.invoice_id}`, `Finance: Check due for ${check.supplier_name}`)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-green-600 transition-all" title="Mark as Read">
                                        <CheckCircle2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {readAlerts.length > 0 && (
                        <div className="flex flex-col mt-2">
                            <div className="px-4 py-2 bg-slate-100 text-xs font-semibold text-slate-500">Recent History</div>
                            {readAlerts.map(alert => (
                                <div key={`hist-${alert.alert_id}`} className="px-4 py-2 border-b bg-slate-50/50 flex gap-3 items-start">
                                    <div className="mt-0.5 text-slate-300">
                                        <CheckCircle2 className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 line-through text-slate-400">
                                        <p className="text-xs font-medium">{alert.message}</p>
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
