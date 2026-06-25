import { useState, useEffect } from "react";
import { fetchWithAuth } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Supplier { supplier_id: number; name: string; }
interface ProductSearchResult { product_id: number; name: string; measure_unit: string; unit_cost?: number; }

interface GRNRow {
    id: string;
    product_id: number | null;
    product_name: string;
    expiry_date: string;
    purchased_quantity: number;
    bonus_quantity: number;
    unit_cost: number;
}

export default function GRNTab({ currency = '$' }: { currency?: string }) {
    const { toast } = useToast();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [supplierId, setSupplierId] = useState<string>("");
    const [invoiceNumber, setInvoiceNumber] = useState("");
    const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Check">("Cash");
    const [checkNumber, setCheckNumber] = useState("");
    const [checkDate, setCheckDate] = useState("");

    const [items, setItems] = useState<GRNRow[]>([]);

    const [openSupplierBox, setOpenSupplierBox] = useState(false);
    const [openProductBox, setOpenProductBox] = useState<string | null>(null);

    // Live Search specific state per row
    const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
    const [searchResults, setSearchResults] = useState<Record<string, ProductSearchResult[]>>({});

    const [activeTab, setActiveTab] = useState("new");
    const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
    const [jsonInput, setJsonInput] = useState("");
    const [history, setHistory] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    const loadHistory = async () => {
        try {
            setIsLoadingHistory(true);
            const data = await fetchWithAuth('/inventory/grn-history');
            setHistory(data);
        } catch (error: any) {
            toast({ title: 'Error loading history', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoadingHistory(false);
        }
    };

    useEffect(() => {
        if (activeTab === "history") {
            loadHistory();
        }
    }, [activeTab]);

    useEffect(() => {
        const loadSuppliers = async () => {
            try {
                const data = await fetchWithAuth('/suppliers');
                setSuppliers(data);
            } catch (err) { }
        };
        loadSuppliers();
    }, []);

    const addRow = () => {
        setItems([...items, {
            id: crypto.randomUUID(), product_id: null, product_name: "",
            expiry_date: "", purchased_quantity: 0, bonus_quantity: 0, unit_cost: 0
        }]);
    };

    const removeRow = (id: string) => {
        setItems(items.filter(b => b.id !== id));
    };

    const updateRow = (id: string, field: keyof GRNRow, value: any) => {
        setItems(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
    };

    const handleProductSearch = async (rowId: string, q: string) => {
        setSearchQueries(prev => ({ ...prev, [rowId]: q }));
        if (q.length < 2) {
            setSearchResults(prev => ({ ...prev, [rowId]: [] }));
            return;
        }
        try {
            const results = await fetchWithAuth(`/products/search?q=${encodeURIComponent(q)}`);
            setSearchResults(prev => ({ ...prev, [rowId]: results }));
        } catch (error) { }
    };

    const parseMultiplier = (unitStr: string): number => {
        if (!unitStr) return 1;
        const match = unitStr.match(/^(\d+)S$/i);
        if (match) return parseInt(match[1], 10);
        return 1;
    };

    const selectProduct = (rowId: string, product: ProductSearchResult) => {
        updateRow(rowId, "product_id", product.product_id);
        updateRow(rowId, "product_name", `${product.name} (${product.measure_unit})`);
        if (product.unit_cost) {
            const multiplier = parseMultiplier(product.measure_unit);
            updateRow(rowId, "unit_cost", Number((product.unit_cost * multiplier).toFixed(2)));
        }
        setSearchQueries(prev => ({ ...prev, [rowId]: "" })); // Clear search
    };

    const totalAmount = items.reduce((sum, b) => sum + (Number(b.purchased_quantity) * Number(b.unit_cost)), 0);

    const handleSubmit = async () => {
        if (!supplierId || !invoiceNumber || items.length === 0) {
            toast({ title: "Validation Error", description: "Supplier, Invoice #, and at least one row are required.", variant: "destructive" });
            return;
        }

        const invalidRow = items.find(b => !b.product_id || b.purchased_quantity <= 0 || b.unit_cost <= 0);
        if (invalidRow) {
            toast({ title: "Validation Error", description: "All rows must have a product, qty > 0, and cost > 0.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                supplier_id: Number(supplierId),
                supplier_invoice_number: invoiceNumber,
                payment_method: paymentMethod,
                check_number: paymentMethod === 'Check' ? checkNumber : null,
                check_date: paymentMethod === 'Check' ? checkDate : null,
                batches: items.map(b => ({
                    product_id: b.product_id,
                    expiry_date: b.expiry_date,
                    purchased_quantity: Number(b.purchased_quantity),
                    bonus_quantity: Number(b.bonus_quantity),
                    unit_cost: Number(b.unit_cost)
                }))
            };

            const res = await fetchWithAuth('/inventory/receive', { method: 'POST', body: JSON.stringify(payload) });
            toast({ title: "GRN Posted", description: `Invoice total ${currency}${res.total_amount.toFixed(2)} recorded.` });

            // Reset
            setSupplierId(""); setInvoiceNumber(""); setPaymentMethod("Cash"); setCheckNumber(""); setCheckDate(""); setItems([]);
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleJsonImport = async () => {
        try {
            let parsed;
            try {
                parsed = JSON.parse(jsonInput.trim());
            } catch (e) {
                // Try to strip out markdown blocks if the AI accidentally included them
                const stripped = jsonInput.replace(/```json/g, '').replace(/```/g, '').trim();
                parsed = JSON.parse(stripped);
            }

            let itemsArray = [];
            if (Array.isArray(parsed)) {
                itemsArray = parsed;
            } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items)) {
                if (parsed.invoice_number && parsed.invoice_number !== "INV-123") {
                    setInvoiceNumber(parsed.invoice_number);
                }
                itemsArray = parsed.items;
            } else {
                throw new Error("JSON must be an array or an object containing an 'items' array.");
            }
            
            const newRows: GRNRow[] = [];
            setIsJsonModalOpen(false); 
            toast({ title: "Importing...", description: "Matching products from database. Please wait." });
            
            for (const item of itemsArray) {
                const newId = Date.now().toString() + Math.random().toString(36).substring(2);
                const row: GRNRow = {
                    id: newId,
                    product_id: null,
                    product_name: item.product_name || "",
                    expiry_date: item.expiry_date || "",
                    purchased_quantity: Number(item.purchased_quantity) || 0,
                    bonus_quantity: Number(item.bonus_quantity) || 0,
                    unit_cost: Number(item.unit_cost) || 0,
                };

                if (row.product_name) {
                    setSearchQueries(prev => ({ ...prev, [newId]: row.product_name }));
                    try {
                        const results = await fetchWithAuth(`/products/search?q=${encodeURIComponent(row.product_name)}`);
                        setSearchResults(prev => ({ ...prev, [newId]: results }));
                        
                        if (results && results.length > 0) {
                            const queryLower = row.product_name.toLowerCase();
                            // Fuzzy match logic: exact -> substring -> first result
                            const bestMatch = results.find((r: any) => r.name.toLowerCase() === queryLower) 
                                           || results.find((r: any) => r.name.toLowerCase().includes(queryLower) || queryLower.includes(r.name.toLowerCase())) 
                                           || results[0];
                            
                            row.product_id = bestMatch.product_id;
                            row.product_name = `${bestMatch.name} (${bestMatch.measure_unit})`;
                            
                            // If JSON didn't provide a cost, auto-populate from DB
                            if (!row.unit_cost && bestMatch.unit_cost) {
                                const multiplier = parseMultiplier(bestMatch.measure_unit);
                                row.unit_cost = Number((bestMatch.unit_cost * multiplier).toFixed(2));
                            }
                        }
                    } catch (e) {}
                }
                newRows.push(row);
            }
            
            setItems(prev => [...prev, ...newRows]);
            setJsonInput("");
            toast({ title: "JSON Imported", description: `Successfully imported and auto-matched ${newRows.length} rows.` });
        } catch (err: any) {
            toast({ title: "Import Failed", description: err.message, variant: "destructive" });
        }
    };

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 pb-20">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Goods Received Notes (GRN)</h2>
                {activeTab === "new" && (
                    <div className="text-xl font-bold p-3 bg-blue-50 text-blue-900 rounded-lg border border-blue-200">
                        Grand Total: {currency}{totalAmount.toFixed(2)}
                    </div>
                )}
            </div>

            <TabsList>
                <TabsTrigger value="new">Receive New Stock</TabsTrigger>
                <TabsTrigger value="history">GRN History</TabsTrigger>
            </TabsList>

            <TabsContent value="history" className="space-y-4">
                <Card className="shadow-sm">
                    <CardHeader className="bg-slate-50 border-b">
                        <CardTitle className="text-lg">Past Invoices</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>GRN / Invoice #</TableHead>
                                    <TableHead>Supplier</TableHead>
                                    <TableHead>Received Date</TableHead>
                                    <TableHead>Total Amount</TableHead>
                                    <TableHead>Payment</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Recorded By</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoadingHistory ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8">Loading history...</TableCell>
                                    </TableRow>
                                ) : history.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-slate-500">No GRN history found.</TableCell>
                                    </TableRow>
                                ) : (
                                    history.map((inv) => (
                                        <TableRow key={inv.invoice_id}>
                                            <TableCell className="font-medium">{inv.supplier_invoice_number}</TableCell>
                                            <TableCell>{inv.supplier_name}</TableCell>
                                            <TableCell>{new Date(inv.received_at).toLocaleString()}</TableCell>
                                            <TableCell>{currency}{Number(inv.total_amount).toFixed(2)}</TableCell>
                                            <TableCell>
                                                {inv.payment_method}
                                                {inv.payment_method === 'Check' && <span className="text-xs text-slate-500 block">#{inv.check_number}</span>}
                                            </TableCell>
                                            <TableCell>
                                                {inv.payment_method === 'Cash'
                                                    ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">Paid In Full</Badge>
                                                    : inv.check_cleared
                                                        ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">Check Cleared</Badge>
                                                        : <Badge variant="outline" className="text-amber-600 border-amber-600 bg-amber-50">Pending Clearance</Badge>
                                                }
                                            </TableCell>
                                            <TableCell className="text-sm text-slate-500">{inv.recorded_by}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="new" className="space-y-6">

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 border rounded-xl bg-white shadow-sm">
                    <div className="space-y-2 flex flex-col justify-end">
                        <Label>Supplier</Label>
                        <Popover open={openSupplierBox} onOpenChange={setOpenSupplierBox}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" aria-expanded={openSupplierBox} className="w-full justify-between">
                                    {supplierId ? suppliers.find((supplier) => supplier.supplier_id.toString() === supplierId)?.name : "Select supplier..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0">
                                <Command>
                                    <CommandInput placeholder="Search supplier..." />
                                    <CommandEmpty>No supplier found.</CommandEmpty>
                                    <CommandGroup>
                                        <CommandList>
                                            {suppliers.map((supplier) => (
                                                <CommandItem
                                                    key={supplier.supplier_id}
                                                    value={supplier.name}
                                                    onSelect={() => { setSupplierId(supplier.supplier_id.toString()); setOpenSupplierBox(false); }}
                                                >
                                                    <Check className={cn("mr-2 h-4 w-4", supplierId === supplier.supplier_id.toString() ? "opacity-100" : "opacity-0")} />
                                                    {supplier.name}
                                                </CommandItem>
                                            ))}
                                        </CommandList>
                                    </CommandGroup>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-2">
                        <Label>Supplier Invoice #</Label>
                        <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="INV-001" />
                    </div>

                    <div className="space-y-2">
                        <Label>Payment Method</Label>
                        <select
                            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={paymentMethod}
                            onChange={e => setPaymentMethod(e.target.value as any)}
                        >
                            <option value="Cash">Cash / Transfer</option>
                            <option value="Check">Post-Dated Check</option>
                        </select>
                    </div>

                    {paymentMethod === 'Check' && (
                        <>
                            <div className="space-y-2">
                                <Label>Check Number</Label>
                                <Input value={checkNumber} onChange={e => setCheckNumber(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Check Date</Label>
                                <Input type="date" value={checkDate} onChange={e => setCheckDate(e.target.value)} />
                            </div>
                        </>
                    )}
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold">Invoice Lines</h3>
                        <div className="flex space-x-2">
                            <Dialog open={isJsonModalOpen} onOpenChange={setIsJsonModalOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="gap-2">
                                        Import JSON
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[600px]">
                                    <DialogHeader>
                                        <DialogTitle>Import AI JSON</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 pt-4">
                                        <div className="p-3 bg-slate-50 border rounded-md text-sm text-slate-700 relative">
                                            <p className="font-semibold mb-1">AI Prompt Template:</p>
                                            <p className="mb-2">Copy this prompt and paste it into ChatGPT/Claude along with a photo of the supplier invoice:</p>
                                            <div className="bg-slate-200 p-2 rounded text-xs font-mono mb-2 overflow-x-auto">
                                                I have a supplier invoice. Please extract the invoice number and items into a JSON object exactly matching this format: {`{"invoice_number": "INV-123", "items": [{"product_name": "Panadol", "purchased_quantity": 10, "bonus_quantity": 0, "unit_cost": 150.50, "expiry_date": "YYYY-MM-DD"}]}`}. Do not output any markdown or other text, only the raw JSON object.
                                            </div>
                                            <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(`I have a supplier invoice. Please extract the invoice number and items into a JSON object exactly matching this format: {"invoice_number": "INV-123", "items": [{"product_name": "Panadol", "purchased_quantity": 10, "bonus_quantity": 0, "unit_cost": 150.50, "expiry_date": "YYYY-MM-DD"}]}. Do not output any markdown or other text, only the raw JSON object.`)}>
                                                Copy Prompt
                                            </Button>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Paste JSON Output</Label>
                                            <textarea 
                                                className="flex min-h-[150px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                                placeholder={`{\n  "invoice_number": "INV-001",\n  "items": [\n    {\n      "product_name": "...",\n      "purchased_quantity": 10,\n      ...\n    }\n  ]\n}`}
                                                value={jsonInput}
                                                onChange={(e) => setJsonInput(e.target.value)}
                                            />
                                        </div>
                                        <Button className="w-full" onClick={handleJsonImport}>Import Rows</Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                            <Button onClick={addRow} variant="secondary" size="sm" className="gap-2">
                                <Plus className="h-4 w-4" /> Add Row
                            </Button>
                        </div>
                    </div>

                    <div className="border rounded-md overflow-x-auto bg-white shadow-sm">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="w-[300px]">Product</TableHead>
                                    <TableHead>Expiry</TableHead>
                                    <TableHead className="w-[100px]">Purch. Qty</TableHead>
                                    <TableHead className="w-[100px]">Bonus Qty</TableHead>
                                    <TableHead className="w-[120px]">Unit Cost ({currency})</TableHead>
                                    <TableHead className="w-[120px] text-right">Line Total</TableHead>
                                    <TableHead className="w-[60px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((row) => (
                                    <TableRow key={row.id}>
                                        <TableCell>
                                            {!row.product_id ? (
                                                <Popover open={openProductBox === row.id} onOpenChange={(isOpen) => setOpenProductBox(isOpen ? row.id : null)}>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="outline" className="w-full justify-start text-left text-muted-foreground font-normal" role="combobox" aria-expanded={openProductBox === row.id}>
                                                            Search product...
                                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="p-0 w-[400px]" side="bottom" align="start">
                                                        <Command shouldFilter={false}>
                                                            <CommandInput
                                                                placeholder="Type to search..."
                                                                value={searchQueries[row.id] || ""}
                                                                onValueChange={(q: string) => handleProductSearch(row.id, q)}
                                                            />
                                                            <CommandList>
                                                                <CommandEmpty>No results.</CommandEmpty>
                                                                <CommandGroup>
                                                                    {searchResults[row.id]?.map((prod) => (
                                                                        <CommandItem
                                                                            key={prod.product_id}
                                                                            value={`${prod.product_id}-${prod.name}`}
                                                                            onSelect={() => {
                                                                                selectProduct(row.id, prod);
                                                                                setOpenProductBox(null);
                                                                            }}
                                                                        >
                                                                            <Check className={cn("mr-2 h-4 w-4", row.product_id === prod.product_id ? "opacity-100" : "opacity-0")} />
                                                                            {prod.name} <span className="text-slate-400 ml-2 text-xs">({prod.measure_unit})</span>
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                            ) : (
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium text-sm">{row.product_name}</span>
                                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400 hover:text-red-600" onClick={() => { updateRow(row.id, "product_id", null); updateRow(row.id, "product_name", ""); }}>✕</Button>
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Input type="date" value={row.expiry_date} onChange={e => updateRow(row.id, "expiry_date", e.target.value)} />
                                        </TableCell>
                                        <TableCell>
                                            <Input type="number" min="0" value={row.purchased_quantity || ''} onChange={e => updateRow(row.id, "purchased_quantity", e.target.value)} />
                                        </TableCell>
                                        <TableCell>
                                            <Input type="number" min="0" value={row.bonus_quantity || ''} onChange={e => updateRow(row.id, "bonus_quantity", e.target.value)} />
                                        </TableCell>
                                        <TableCell>
                                            <Input type="number" min="0" step="0.01" value={row.unit_cost || ''} onChange={e => updateRow(row.id, "unit_cost", e.target.value)} />
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {currency}{(Number(row.purchased_quantity) * Number(row.unit_cost)).toFixed(2)}
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removeRow(row.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {items.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-10 text-slate-500">
                                            Start adding products to this invoice using the Add Row button above.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                    <Button size="lg" className="w-[250px] font-bold text-lg" onClick={handleSubmit} disabled={isSubmitting || items.length === 0}>
                        {isSubmitting ? "Posting..." : "Post GRN Draft"}
                    </Button>
                </div>
            </TabsContent>
        </Tabs>
    );
}
