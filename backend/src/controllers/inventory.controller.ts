import { Request, Response } from 'express';
import pool from '../db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { AuthRequest } from '../middleware/auth';
import { io } from '../server';

// ----------------- INVENTORY & GRN -----------------

export const receiveStock = async (req: Request, res: Response) => {
    // Requires VIEW_TAB_GRN
    const connection = await pool.getConnection();

    try {
        const { supplier_id, supplier_invoice_number, payment_method, check_number, check_date, batches } = req.body;

        // Basic validation
        if (!supplier_id || !supplier_invoice_number || !payment_method || !batches || !Array.isArray(batches) || batches.length === 0) {
            return res.status(400).json({ error: 'Missing required GRN fields or batches' });
        }

        const emp_id = (req as any).user?.emp_id;
        if (!emp_id) return res.status(401).json({ error: 'Unauthorized' });

        await connection.beginTransaction();

        // 1. Calculate invoice total_amount
        let total_amount = 0;
        for (const batch of batches) {
            total_amount += (batch.purchased_quantity * batch.unit_cost);
        }

        // 2. Insert Supplier_Invoice
        const formattedCheckDate = (payment_method === 'Check' && check_date) ? check_date : null;
        const formattedCheckNumber = (payment_method === 'Check' && check_number) ? check_number : null;

        const [invoiceResult] = await connection.query<ResultSetHeader>(
            `INSERT INTO Supplier_Invoices 
            (supplier_id, supplier_invoice_number, total_amount, payment_method, check_number, check_date, recorded_by_emp_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [supplier_id, supplier_invoice_number, total_amount, payment_method, formattedCheckNumber, formattedCheckDate, emp_id]
        );
        const invoiceId = invoiceResult.insertId;

        // Fetch measure_unit for the products to calculate multipliers
        const productIds = batches.map((b: any) => b.product_id);
        const [productsRows] = await connection.query<RowDataPacket[]>(
            `SELECT product_id, measure_unit FROM Products WHERE product_id IN (?)`,
            [productIds]
        );
        const productUnits: Record<number, string> = {};
        for (const row of productsRows) {
            productUnits[row.product_id] = row.measure_unit;
        }

        const parseMultiplier = (unitStr: string | undefined): number => {
            if (!unitStr) return 1;
            const match = unitStr.match(/^(\d+)S$/i);
            if (match) return parseInt(match[1], 10);
            return 1;
        };

        // 3. Insert Supplier_Invoice_Items AND Update Products.current_stock
        for (const batch of batches) {
            const rawQty = Number(batch.purchased_quantity) + Number(batch.bonus_quantity || 0);
            
            const measureUnit = productUnits[batch.product_id] || '';
            const multiplier = parseMultiplier(measureUnit);
            
            const tabletsToAdd = rawQty * multiplier;
            const tabletCost = Number(batch.unit_cost) / multiplier;

            await connection.query(
                `INSERT INTO Supplier_Invoice_Items 
                (supplier_invoice_id, product_id, purchased_quantity, bonus_quantity, unit_cost, expiry_date) 
                VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    invoiceId,
                    batch.product_id,
                    batch.purchased_quantity,
                    batch.bonus_quantity || 0,
                    batch.unit_cost,
                    batch.expiry_date
                ]
            );

            // Sync the master Product stock level, unit_cost, and expiry_dates
            // If expiry_dates is null, set it to an array with this date. Else, append if it doesn't exist (though duplicate appending is fine for basic OR logic).
            await connection.query(
                `UPDATE Products 
                 SET current_stock = current_stock + ?, 
                     unit_cost = ?, 
                     expiry_dates = IF(expiry_dates IS NULL, JSON_ARRAY(?), JSON_ARRAY_APPEND(expiry_dates, '$', ?)) 
                 WHERE product_id = ?`,
                [tabletsToAdd, tabletCost, batch.expiry_date, batch.expiry_date, batch.product_id]
            );
        }

        // 4. Create Audit_Log
        await connection.query(
            `INSERT INTO Audit_Logs (emp_id, action_type, details) VALUES (?, ?, ?)`,
            [emp_id, 'RECEIVE_STOCK', `Received GRN ${supplier_invoice_number} from supplier ${supplier_id}. Total: ${total_amount}`]
        );

        await connection.commit();
        
        io.emit('inventory_alert', { message: 'Stock received' });
        if (payment_method === 'Check') {
            io.emit('finance_alert', { message: 'New check added' });
        }

        res.status(201).json({
            message: 'Stock received successfully',
            invoice_id: invoiceId,
            total_amount
        });

    } catch (error) {
        await connection.rollback();
        console.error('GRN Transaction Error:', error);
        res.status(500).json({ error: 'Internal server error during GRN processing' });
    } finally {
        connection.release();
    }
};

export const getAlerts = async (req: Request, res: Response) => {
    try {
        // Now using the optimized 'current_stock' column from Products table
        const [lowStock] = await pool.query<RowDataPacket[]>(
            `SELECT product_id, name, reorder_threshold, current_stock AS current_stock_level
             FROM Products
             WHERE current_stock <= reorder_threshold AND reorder_threshold > 0`
        );

        const [allProducts] = await pool.query<RowDataPacket[]>(
            `SELECT product_id, name, expiry_dates, current_stock AS current_stock_level
             FROM Products
             WHERE current_stock > 0 AND expiry_dates IS NOT NULL`
        );

        const nearExpiry = [];
        const now = new Date();
        const in30Days = new Date();
        in30Days.setDate(in30Days.getDate() + 30);

        for (const p of allProducts) {
            let dates: string[] = [];
            try {
                dates = typeof p.expiry_dates === 'string' ? JSON.parse(p.expiry_dates) : p.expiry_dates;
            } catch (e) { continue; }
            
            const expiringDates = [];
            for (const d of dates) {
                const ed = new Date(d);
                if (ed >= now && ed <= in30Days) {
                    expiringDates.push(d);
                }
            }

            if (expiringDates.length > 0) {
                // Deduplicate dates for clean display
                const uniqueDates = Array.from(new Set(expiringDates)).sort();
                nearExpiry.push({
                    product_id: p.product_id,
                    name: p.name,
                    expiring_dates: uniqueDates,
                    current_stock_level: p.current_stock_level
                });
            }
        }

        res.status(200).json({ lowStock, nearExpiry });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getGrnHistory = async (req: AuthRequest, res: Response) => {
    try {
        const [history] = await pool.query<RowDataPacket[]>(
            `SELECT i.invoice_id, i.supplier_invoice_number, i.total_amount, i.payment_method, 
                    i.check_number, i.check_date, i.check_cleared, i.received_at, 
                    s.supplier_id, s.name as supplier_name, e.name as recorded_by
             FROM Supplier_Invoices i
             JOIN Suppliers s ON i.supplier_id = s.supplier_id
             JOIN Employee e ON i.recorded_by_emp_id = e.emp_id
             ORDER BY i.received_at DESC
             LIMIT 100`
        );
        res.status(200).json(history);
    } catch (error) {
        console.error("Error fetching GRN history:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


