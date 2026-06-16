import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface Product {
    product_id: number;
    name: string;
    measure_unit: string;
    category: string;
    reorder_threshold: number;
    current_stock: number;
    selling_price: number;
    expiry_dates?: any;
    unit_cost?: number;
    location?: string;
}

interface AlertData {
    lowStock: any[];
    nearExpiry: any[];
}

export default function InventoryTab({ currency = '$' }: { currency?: string }) {
    const [products, setProducts] = useState<Product[]>([]);
    const [alerts, setAlerts] = useState<AlertData>({ lowStock: [], nearExpiry: [] });
    const [isLoading, setIsLoading] = useState(true);

    // Product Form State
    const [isProductOpen, setIsProductOpen] = useState(false);
    const [productForm, setProductForm] = useState({ id: 0, name: '', measure_unit: '', category: '', reorder_threshold: 0, current_stock: 0, selling_price: 0, expiry_dates: '', unit_cost: 0, location: '' });

    const { toast } = useToast();

    const loadData = async () => {
        try {
            setIsLoading(true);
            const [prodData, alertData] = await Promise.all([
                fetchWithAuth('/products'),
                fetchWithAuth('/inventory/alerts')
            ]);
            setProducts(prodData);
            setAlerts(alertData);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    // --- Product Handlers ---
    const handleProductSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...productForm,
                reorder_threshold: Number(productForm.reorder_threshold),
                current_stock: Number(productForm.current_stock),
                selling_price: Number(productForm.selling_price),
                unit_cost: Number(productForm.unit_cost),
                expiry_dates: productForm.expiry_dates.split(',').map(d => d.trim()).filter(d => d.length > 0)
            };
            if (productForm.id) {
                await fetchWithAuth(`/products/${productForm.id}`, { method: 'PUT', body: JSON.stringify(payload) });
                toast({ title: 'Success', description: 'Product updated.' });
            } else {
                await fetchWithAuth('/products', { method: 'POST', body: JSON.stringify(payload) });
                toast({ title: 'Success', description: 'Product created.' });
            }
            setIsProductOpen(false);
            loadData();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    const handleProductDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this product?')) return;
        try {
            await fetchWithAuth(`/products/${id}`, { method: 'DELETE' });
            toast({ title: 'Success', description: 'Product deleted.' });
            loadData();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    if (isLoading) return <div>Loading Inventory...</div>;

    return (
        <div className="space-y-8">
            {/* Alerts Section */}
            {(alerts.lowStock.length > 0 || alerts.nearExpiry.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {alerts.lowStock.length > 0 && (
                        <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
                            <h3 className="text-red-800 font-bold mb-2">Low Stock Alerts</h3>
                            <ul className="list-disc pl-5 text-red-700 text-sm">
                                {alerts.lowStock.map((a: any) => (
                                    <li key={a.product_id}>{a.name} (Stock: {a.current_stock_level} / Min: {a.reorder_threshold})</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {alerts.nearExpiry.length > 0 && (
                        <div className="p-4 border border-amber-200 bg-amber-50 rounded-lg">
                            <h3 className="text-amber-800 font-bold mb-2">Near Expiry Alerts</h3>
                            <ul className="list-disc pl-5 text-amber-700 text-sm">
                                {alerts.nearExpiry.map((a: any) => (
                                    <li key={a.product_id}>{a.name} (Expiring on: {a.expiring_dates ? a.expiring_dates.join(', ') : 'N/A'})</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Products Catalog</h2>
                    <Dialog open={isProductOpen} onOpenChange={setIsProductOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={() => { setProductForm({ id: 0, name: '', measure_unit: '', category: '', reorder_threshold: 0, current_stock: 0, selling_price: 0, expiry_dates: '', unit_cost: 0, location: '' }); setIsProductOpen(true); }}>
                                Add Product
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{productForm.id ? 'Edit Product' : 'New Product'}</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleProductSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-4">
                                <div className="space-y-2">
                                    <Label>Name</Label>
                                    <Input required value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Measure Unit (e.g., Tablets, Bottles)</Label>
                                    <Input required value={productForm.measure_unit} onChange={e => setProductForm({ ...productForm, measure_unit: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Category</Label>
                                    <Input value={productForm.category} onChange={e => setProductForm({ ...productForm, category: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Current Stock</Label>
                                    <Input type="number" required value={productForm.current_stock} onChange={e => setProductForm({ ...productForm, current_stock: e.target.value as any })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Unit Cost ({currency})</Label>
                                    <Input type="number" step="0.01" value={productForm.unit_cost} onChange={e => setProductForm({ ...productForm, unit_cost: e.target.value as any })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Unit Selling Price ({currency})</Label>
                                    <Input type="number" step="0.01" required value={productForm.selling_price} onChange={e => setProductForm({ ...productForm, selling_price: e.target.value as any })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Expiry Dates (comma separated YYYY-MM-DD)</Label>
                                    <Input placeholder="e.g. 2024-12-01, 2025-06-15" value={productForm.expiry_dates} onChange={e => setProductForm({ ...productForm, expiry_dates: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Location</Label>
                                    <Input value={productForm.location} onChange={e => setProductForm({ ...productForm, location: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Reorder Threshold</Label>
                                    <Input type="number" required value={productForm.reorder_threshold} onChange={e => setProductForm({ ...productForm, reorder_threshold: e.target.value as any })} />
                                </div>
                                <Button type="submit" className="w-full">Save Product</Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Current Stock</TableHead>
                            <TableHead>Expiry</TableHead>
                            <TableHead>Cost</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Min Stock</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {products.map(p => {
                            let dates: string[] = [];
                            try { dates = Array.isArray(p.expiry_dates) ? p.expiry_dates : (typeof p.expiry_dates === 'string' ? JSON.parse(p.expiry_dates) : []); } catch(e) {}
                            const isExpired = dates.some(d => new Date(d) < new Date());
                            const isLowStock = p.current_stock <= p.reorder_threshold;
                            return (
                            <TableRow key={p.product_id} className={isExpired ? "bg-red-100" : isLowStock ? "bg-amber-50" : ""}>
                                <TableCell>{p.product_id}</TableCell>
                                <TableCell className="font-medium">{p.name} ({p.measure_unit})</TableCell>
                                <TableCell>{p.category}</TableCell>
                                <TableCell className="font-bold text-lg text-blue-800">{p.current_stock}</TableCell>
                                <TableCell className={isExpired ? "text-red-600 font-bold" : ""}>{dates.length > 0 ? dates.map(d => new Date(d).toLocaleDateString()).join(', ') : 'N/A'}</TableCell>
                                <TableCell>{currency}{Number(p.unit_cost || 0).toFixed(2)}</TableCell>
                                <TableCell>{currency}{Number(p.selling_price || 0).toFixed(2)}</TableCell>
                                <TableCell>{p.reorder_threshold}</TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button variant="outline" size="sm" onClick={() => { setProductForm({ id: p.product_id, name: p.name, measure_unit: p.measure_unit, category: p.category || '', reorder_threshold: p.reorder_threshold, current_stock: p.current_stock, selling_price: p.selling_price || 0, expiry_dates: dates.join(', '), unit_cost: p.unit_cost || 0, location: p.location || '' }); setIsProductOpen(true); }}>Edit</Button>
                                    <Button variant="destructive" size="sm" onClick={() => handleProductDelete(p.product_id)}>Delete</Button>
                                </TableCell>
                            </TableRow>
                        )})}
                        {products.length === 0 && <TableRow><TableCell colSpan={9} className="text-center">No products found.</TableCell></TableRow>}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
