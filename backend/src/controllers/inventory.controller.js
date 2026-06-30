"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGrnHistory = exports.getAlerts = exports.receiveStock = void 0;
const db_1 = __importDefault(require("../db"));
const server_1 = require("../server");
// ----------------- INVENTORY & GRN -----------------
const receiveStock = async (req, res) => {
    // Requires VIEW_TAB_GRN
    const connection = await db_1.default.getConnection();
    try {
        const { supplier_id, supplier_invoice_number, payment_method, check_number, check_date, batches } = req.body;
        // Basic validation
        if (!supplier_id || !supplier_invoice_number || !payment_method || !batches || !Array.isArray(batches) || batches.length === 0) {
            return res.status(400).json({ error: 'Missing required GRN fields or batches' });
        }
        const emp_id = req.user?.emp_id;
        if (!emp_id)
            return res.status(401).json({ error: 'Unauthorized' });
        await connection.beginTransaction();
        // 1. Calculate invoice total_amount
        let total_amount = 0;
        for (const batch of batches) {
            total_amount += (batch.purchased_quantity * batch.unit_cost);
        }
        // 2. Insert Supplier_Invoice
        const formattedCheckDate = (payment_method === 'Check' && check_date) ? check_date : null;
        const formattedCheckNumber = (payment_method === 'Check' && check_number) ? check_number : null;
        const [invoiceResult] = await connection.query(`INSERT INTO Supplier_Invoices 
            (supplier_id, supplier_invoice_number, total_amount, payment_method, check_number, check_date, recorded_by_emp_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`, [supplier_id, supplier_invoice_number, total_amount, payment_method, formattedCheckNumber, formattedCheckDate, emp_id]);
        const invoiceId = invoiceResult.insertId;
        // Fetch measure_unit for the products to calculate multipliers
        const productIds = batches.map((b) => b.product_id);
        const [productsRows] = await connection.query(`SELECT product_id, measure_unit, expiry_dates FROM Products WHERE product_id IN (?)`, [productIds]);
        const productData = {};
        for (const row of productsRows) {
            let parsedDates = [];
            try {
                parsedDates = typeof row.expiry_dates === 'string' ? JSON.parse(row.expiry_dates) : (row.expiry_dates || []);
            }
            catch (e) { }
            productData[row.product_id] = {
                measure_unit: row.measure_unit,
                expiry_dates: parsedDates
            };
        }
        const parseMultiplier = (unitStr) => {
            if (!unitStr)
                return 1;
            const match = unitStr.match(/^(\d+)S$/i);
            if (match)
                return parseInt(match[1], 10);
            return 1;
        };
        // 3. Insert Supplier_Invoice_Items AND Update Products.current_stock
        for (const batch of batches) {
            const rawQty = Number(batch.purchased_quantity) + Number(batch.bonus_quantity || 0);
            const pData = productData[batch.product_id] || { measure_unit: '', expiry_dates: [] };
            const measureUnit = pData.measure_unit;
            const multiplier = parseMultiplier(measureUnit);
            const packSize = Number(batch.pack_size) > 0 ? Number(batch.pack_size) : multiplier;
            const tabletsToAdd = rawQty * packSize;
            const tabletCost = Number(batch.unit_cost) / packSize;
            let updatedDates = [...pData.expiry_dates];
            if (batch.expiry_date && !updatedDates.includes(batch.expiry_date)) {
                updatedDates.push(batch.expiry_date);
            }
            pData.expiry_dates = updatedDates; // Mutate for same product in multiple batches
            await connection.query(`INSERT INTO Supplier_Invoice_Items 
                (supplier_invoice_id, product_id, purchased_quantity, bonus_quantity, unit_cost, pack_size, expiry_date) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`, [
                invoiceId,
                batch.product_id,
                batch.purchased_quantity,
                batch.bonus_quantity || 0,
                batch.unit_cost,
                packSize,
                batch.expiry_date || null
            ]);
            // Sync the master Product stock level, unit_cost, and expiry_dates
            // If expiry_dates is null, set it to an array with this date. Else, append if it doesn't exist (though duplicate appending is fine for basic OR logic).
            await connection.query(`UPDATE Products 
                 SET current_stock = current_stock + ?, 
                     unit_cost = ?, 
                     expiry_dates = ? 
                 WHERE product_id = ?`, [tabletsToAdd, tabletCost, JSON.stringify(updatedDates), batch.product_id]);
        }
        // 4. Create Audit_Log
        await connection.query(`INSERT INTO Audit_Logs (emp_id, action_type, details) VALUES (?, ?, ?)`, [emp_id, 'RECEIVE_STOCK', `Received GRN ${supplier_invoice_number} from supplier ${supplier_id}. Total: ${total_amount}`]);
        await connection.commit();
        server_1.io.emit('inventory_alert', { message: 'Stock received' });
        if (payment_method === 'Check') {
            server_1.io.emit('finance_alert', { message: 'New check added' });
        }
        res.status(201).json({
            message: 'Stock received successfully',
            invoice_id: invoiceId,
            total_amount
        });
    }
    catch (error) {
        await connection.rollback();
        console.error('GRN Transaction Error:', error);
        res.status(500).json({ error: 'Internal server error during GRN processing' });
    }
    finally {
        connection.release();
    }
};
exports.receiveStock = receiveStock;
const getAlerts = async (req, res) => {
    try {
        // Now using the optimized 'current_stock' column from Products table
        const [lowStock] = await db_1.default.query(`SELECT product_id, name, reorder_threshold, current_stock AS current_stock_level
             FROM Products
             WHERE current_stock <= reorder_threshold AND reorder_threshold > 0`);
        const [allProducts] = await db_1.default.query(`SELECT product_id, name, expiry_dates, current_stock AS current_stock_level
             FROM Products
             WHERE current_stock > 0 AND expiry_dates IS NOT NULL`);
        const nearExpiry = [];
        const now = new Date();
        const in30Days = new Date();
        in30Days.setDate(in30Days.getDate() + 30);
        for (const p of allProducts) {
            let dates = [];
            try {
                dates = typeof p.expiry_dates === 'string' ? JSON.parse(p.expiry_dates) : p.expiry_dates;
            }
            catch (e) {
                continue;
            }
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
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getAlerts = getAlerts;
const getGrnHistory = async (req, res) => {
    try {
        const [history] = await db_1.default.query(`SELECT i.invoice_id, i.supplier_invoice_number, i.total_amount, i.payment_method, 
                    i.check_number, i.check_date, i.check_cleared, i.received_at, 
                    s.supplier_id, s.name as supplier_name, e.name as recorded_by
             FROM Supplier_Invoices i
             JOIN Suppliers s ON i.supplier_id = s.supplier_id
             JOIN Employee e ON i.recorded_by_emp_id = e.emp_id
             ORDER BY i.received_at DESC
             LIMIT 100`);
        res.status(200).json(history);
    }
    catch (error) {
        console.error("Error fetching GRN history:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getGrnHistory = getGrnHistory;
