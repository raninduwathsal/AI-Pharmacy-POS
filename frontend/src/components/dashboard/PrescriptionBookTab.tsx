import React, { useState, useEffect } from "react";
import { fetchWithAuth } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RefreshCcw, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PrescriptionBookLine {
    id: number;
    medicine_name_raw: string;
    frequency: string;
    total_amount: number;
}

interface PrescriptionBookRecord {
    id: number;
    patient_name: string;
    patient_age: number | null;
    created_at: string;
    lines: PrescriptionBookLine[];
}

export default function PrescriptionBookTab() {
    const [records, setRecords] = useState<PrescriptionBookRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
    
    // Pagination state
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const loadRecords = async (pageNum: number = 1) => {
        setLoading(true);
        try {
            const res = await fetchWithAuth(`/pos/prescription-book?page=${pageNum}&limit=20`);
            setRecords(res.data || []);
            setTotalPages(res.totalPages || 1);
            setPage(res.page || pageNum);
        } catch (error) {
            console.error("Failed to fetch prescription book", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRecords(page);
    }, [page]);

    const toggleRow = (id: number) => {
        setExpandedRows(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-slate-800">Prescription Book</h2>
                <Button variant="outline" onClick={() => loadRecords(page)} disabled={loading}>
                    <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-4">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Patient Name</TableHead>
                            <TableHead>Patient Age</TableHead>
                            <TableHead>Items Count</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {records.map((record) => (
                            <React.Fragment key={record.id}>
                                <TableRow 
                                    className="cursor-pointer hover:bg-slate-50 transition-colors"
                                    onClick={() => toggleRow(record.id)}
                                >
                                    <TableCell>
                                        {expandedRows[record.id] ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
                                    </TableCell>
                                    <TableCell className="font-medium text-slate-700">
                                        {new Date(record.created_at).toLocaleString()}
                                    </TableCell>
                                    <TableCell>
                                        {record.patient_name || <span className="text-slate-400 italic">Not provided</span>}
                                    </TableCell>
                                    <TableCell>
                                        {record.patient_age ? `${record.patient_age} yrs` : <span className="text-slate-400 italic">Not provided</span>}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="font-normal">{record.lines.length} items</Badge>
                                    </TableCell>
                                </TableRow>
                                {expandedRows[record.id] && (
                                    <TableRow className="bg-slate-50 border-b-2 border-b-slate-200">
                                        <TableCell colSpan={5} className="p-0">
                                            <div className="p-4 pl-14">
                                                <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm uppercase tracking-wider mb-2">
                                                    <FileText className="w-4 h-4" /> Prescribed Medications
                                                </div>
                                                <Table className="border rounded-lg overflow-hidden bg-white shadow-sm">
                                                    <TableHeader className="bg-indigo-50/50">
                                                        <TableRow>
                                                            <TableHead>Medication Name</TableHead>
                                                            <TableHead>Frequency</TableHead>
                                                            <TableHead className="text-center">Total Quantity</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {record.lines.length > 0 ? record.lines.map((line) => (
                                                            <TableRow key={line.id}>
                                                                <TableCell className="font-medium">{line.medicine_name_raw}</TableCell>
                                                                <TableCell><Badge variant="outline">{line.frequency || 'N/A'}</Badge></TableCell>
                                                                <TableCell className="text-center">{line.total_amount}</TableCell>
                                                            </TableRow>
                                                        )) : (
                                                            <TableRow>
                                                                <TableCell colSpan={3} className="text-center py-4 text-slate-500 text-sm italic">
                                                                    No items recorded.
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </React.Fragment>
                        ))}
                        {records.length === 0 && !loading && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-10 text-slate-500">
                                    No records found in the Prescription Book.
                                </TableCell>
                            </TableRow>
                        )}
                        {loading && records.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-10 text-slate-500">
                                    Loading records...
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
                
                {/* Pagination Controls */}
                <div className="flex items-center justify-between border-t px-4 py-3 sm:px-6 mt-4">
                    <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm text-gray-700">
                                Showing page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span>
                            </p>
                        </div>
                        <div>
                            <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1 || loading}
                                    className="rounded-l-md"
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages || loading}
                                    className="rounded-r-md ml-2"
                                >
                                    Next
                                </Button>
                            </nav>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
