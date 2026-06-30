"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateEmployeeSalary = exports.getEmployees = exports.deletePayrollEntry = exports.updatePayrollEntry = exports.addPayrollEntry = exports.getPayrollEntries = exports.deleteExpense = exports.updateExpense = exports.addExpense = exports.getExpenses = exports.getFinancialAnalytics = exports.exportAuditLogs = exports.deleteAuditLog = exports.getAuditLogs = void 0;
const db_1 = __importDefault(require("../db"));
const csv_writer_1 = require("csv-writer");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// --- Audit Logs ---
const getAuditLogs = async (req, res) => {
    try {
        const { emp_id, action_type, start_date, end_date, page = '1', limit = '50' } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        let query = `
            SELECT a.log_id, a.emp_id, e.name as employee_name, a.action_type, a.details, a.timestamp 
            FROM Audit_Logs a
            JOIN Employee e ON a.emp_id = e.emp_id
            WHERE 1=1
        `;
        const params = [];
        if (emp_id) {
            query += ` AND a.emp_id = ?`;
            params.push(emp_id);
        }
        if (action_type) {
            query += ` AND a.action_type = ?`;
            params.push(action_type);
        }
        if (start_date) {
            query += ` AND a.timestamp >= ?`;
            params.push(start_date);
        }
        if (end_date) {
            query += ` AND a.timestamp <= ?`;
            params.push(end_date);
        }
        // Count for pagination
        const countQuery = query.replace('SELECT a.log_id, a.emp_id, e.name as employee_name, a.action_type, a.details, a.timestamp', 'SELECT COUNT(*) as total');
        const [countResult] = await db_1.default.query(countQuery, params);
        const total = countResult[0].total;
        // Fetch paginated
        query += ` ORDER BY a.timestamp DESC LIMIT ? OFFSET ?`;
        params.push(Number(limit), Number(offset));
        const [rows] = await db_1.default.query(query, params);
        res.json({
            total,
            page: Number(page),
            limit: Number(limit),
            data: rows
        });
    }
    catch (error) {
        console.error("Error fetching audit logs", error);
        res.status(500).json({ error: "Server Error" });
    }
};
exports.getAuditLogs = getAuditLogs;
const deleteAuditLog = async (req, res) => {
    try {
        await db_1.default.query('DELETE FROM Audit_Logs WHERE log_id = ?', [req.params.id]);
        res.json({ status: "Success", message: "Audit log deleted successfully." });
    }
    catch (error) {
        console.error("Error deleting audit log", error);
        res.status(500).json({ error: "Server Error" });
    }
};
exports.deleteAuditLog = deleteAuditLog;
const exportAuditLogs = async (req, res) => {
    try {
        const [rows] = await db_1.default.query(`
            SELECT a.log_id, a.emp_id, e.name as employee_name, a.action_type, a.details, a.timestamp 
            FROM Audit_Logs a
            JOIN Employee e ON a.emp_id = e.emp_id
            ORDER BY a.timestamp DESC
        `);
        if (rows.length === 0) {
            return res.status(404).json({ error: "No logs found to export" });
        }
        const exportsDir = path_1.default.join(__dirname, '../../exports');
        if (!fs_1.default.existsSync(exportsDir)) {
            fs_1.default.mkdirSync(exportsDir, { recursive: true });
        }
        const filePath = path_1.default.join(exportsDir, `audit_logs_export_${Date.now()}.csv`);
        const csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
            path: filePath,
            header: [
                { id: 'log_id', title: 'Log ID' },
                { id: 'emp_id', title: 'Emp ID' },
                { id: 'employee_name', title: 'Employee Name' },
                { id: 'action_type', title: 'Action Type' },
                { id: 'details', title: 'Details' },
                { id: 'timestamp', title: 'Timestamp' }
            ]
        });
        await csvWriter.writeRecords(rows);
        res.download(filePath, 'audit_logs.csv', (err) => {
            if (err)
                console.error("Error downloading file", err);
            // Cleanup
            fs_1.default.unlinkSync(filePath);
        });
    }
    catch (error) {
        console.error("Error exporting audit logs", error);
        res.status(500).json({ error: "Server Error" });
    }
};
exports.exportAuditLogs = exportAuditLogs;
// --- Financial Analytics ---
const getFinancialAnalytics = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        // Default to last 30 days if not provided
        const endDate = end_date ? new Date(end_date) : new Date();
        const startDate = start_date ? new Date(start_date) : new Date(endDate.getTime() - (30 * 24 * 60 * 60 * 1000));
        const formattedStart = startDate.toISOString().split('T')[0];
        const formattedEnd = endDate.toISOString().split('T')[0];
        // 1. Gross Revenue
        const [revResult] = await db_1.default.query(`SELECT SUM(total_amount) as gross_revenue FROM Sales_Invoices WHERE status = 'Completed' AND DATE(created_at) >= ? AND DATE(created_at) <= ?`, [formattedStart, formattedEnd]);
        const gross_revenue = Number(revResult[0].gross_revenue || 0);
        // 2. COGS (Cost of Goods Sold)
        const [cogsResult] = await db_1.default.query(`SELECT SUM(si.quantity * p.unit_cost) as cogs 
             FROM Sale_Items si 
             JOIN Products p ON si.product_id = p.product_id
             JOIN Sales_Invoices inv ON si.invoice_id = inv.invoice_id
             WHERE inv.status = 'Completed' AND DATE(inv.created_at) >= ? AND DATE(inv.created_at) <= ?`, [formattedStart, formattedEnd]);
        const cogs = Number(cogsResult[0].cogs || 0);
        // 3. Operating Expenses
        const [opExResult] = await db_1.default.query(`SELECT SUM(amount) as operating_expenses FROM Operating_Expenses WHERE recorded_date >= ? AND recorded_date <= ?`, [formattedStart, formattedEnd]);
        const operating_expenses = Number(opExResult[0].operating_expenses || 0);
        // 4. Payroll
        const [payrollResult] = await db_1.default.query(`SELECT SUM(gross_pay) as payroll FROM Payroll WHERE payment_date >= ? AND payment_date <= ?`, [formattedStart, formattedEnd]);
        const payroll = Number(payrollResult[0].payroll || 0);
        const net_profit = gross_revenue - (cogs + operating_expenses + payroll);
        // 5. Time Series Data (Revenue vs Expenses grouped by Day)
        const [timeSeries] = await db_1.default.query(`
            SELECT 
                d.dte as date,
                COALESCE(SUM(inv.total_amount), 0) as revenue,
                COALESCE((
                    SELECT SUM(amount) FROM Operating_Expenses o WHERE o.recorded_date = d.dte
                ), 0) + COALESCE((
                    SELECT SUM(gross_pay) FROM Payroll p WHERE p.payment_date = d.dte
                ), 0) + COALESCE((
                     SELECT SUM(si.quantity * p.unit_cost) 
                     FROM Sale_Items si 
                     JOIN Products p ON si.product_id = p.product_id
                     JOIN Sales_Invoices sinv ON si.invoice_id = sinv.invoice_id
                     WHERE sinv.status = 'Completed' AND DATE(sinv.created_at) = d.dte
                ), 0) as expenses
            FROM (
                SELECT DATE_ADD(?, INTERVAL sys_days.day_num DAY) AS dte
                FROM (
                    -- Recursive CTE or simple join to generate numbers. MySQL 8+ supports recursive.
                    WITH RECURSIVE NumberSequence(day_num) AS (
                        SELECT 0
                        UNION ALL
                        SELECT day_num + 1 FROM NumberSequence WHERE day_num < DATEDIFF(?, ?)
                    )
                    SELECT day_num FROM NumberSequence
                ) AS sys_days
            ) d
            LEFT JOIN Sales_Invoices inv ON DATE(inv.created_at) = d.dte AND inv.status = 'Completed'
            GROUP BY d.dte
            ORDER BY d.dte
        `, [formattedStart, formattedEnd, formattedStart]);
        res.json({
            summary: {
                gross_revenue,
                cogs,
                operating_expenses,
                payroll,
                net_profit
            },
            time_series: timeSeries
        });
    }
    catch (error) {
        console.error("Error calculating financial analytics", error);
        res.status(500).json({ error: "Server Error" });
    }
};
exports.getFinancialAnalytics = getFinancialAnalytics;
// CRUD: Operating Expenses
const getExpenses = async (req, res) => {
    try {
        const [rows] = await db_1.default.query(`SELECT * FROM Operating_Expenses ORDER BY recorded_date DESC`);
        res.json(rows);
    }
    catch (e) {
        console.error("Error fetching expenses:", e);
        res.status(500).json({ error: "Server Error" });
    }
};
exports.getExpenses = getExpenses;
const addExpense = async (req, res) => {
    try {
        const { amount, category, description, recorded_date } = req.body;
        const [result] = await db_1.default.query(`INSERT INTO Operating_Expenses (amount, category, description, recorded_date) VALUES (?, ?, ?, ?)`, [amount, category, description, recorded_date]);
        res.json({ expense_id: result.insertId, status: "Created" });
    }
    catch (e) {
        console.error("Error adding expense:", e);
        res.status(500).json({ error: "Server Error" });
    }
};
exports.addExpense = addExpense;
const updateExpense = async (req, res) => {
    try {
        const { amount, category, description, recorded_date } = req.body;
        await db_1.default.query(`UPDATE Operating_Expenses SET amount = ?, category = ?, description = ?, recorded_date = ? WHERE expense_id = ?`, [amount, category, description, recorded_date, req.params.id]);
        res.json({ status: "Updated" });
    }
    catch (e) {
        console.error("Error updating expense:", e);
        res.status(500).json({ error: "Server Error" });
    }
};
exports.updateExpense = updateExpense;
const deleteExpense = async (req, res) => {
    try {
        await db_1.default.query(`DELETE FROM Operating_Expenses WHERE expense_id = ?`, [req.params.id]);
        res.json({ status: "Deleted" });
    }
    catch (e) {
        console.error("Error deleting expense:", e);
        res.status(500).json({ error: "Server Error" });
    }
};
exports.deleteExpense = deleteExpense;
// CRUD: Payroll
const getPayrollEntries = async (req, res) => {
    try {
        const [rows] = await db_1.default.query(`
            SELECT p.*, e.name as employee_name 
            FROM Payroll p
            JOIN Employee e ON p.emp_id = e.emp_id
            ORDER BY p.payment_date DESC
        `);
        res.json(rows);
    }
    catch (e) {
        console.error("Error fetching payroll entries:", e);
        res.status(500).json({ error: "Server Error" });
    }
};
exports.getPayrollEntries = getPayrollEntries;
const addPayrollEntry = async (req, res) => {
    try {
        const { emp_id, gross_pay, deductions, net_salary, pay_period_start, pay_period_end, payment_date } = req.body;
        const [result] = await db_1.default.query(`INSERT INTO Payroll (emp_id, gross_pay, deductions, net_salary, pay_period_start, pay_period_end, payment_date) VALUES (?, ?, ?, ?, ?, ?, ?)`, [emp_id, gross_pay, deductions, net_salary, pay_period_start, pay_period_end, payment_date]);
        res.json({ payroll_id: result.insertId, status: "Created" });
    }
    catch (e) {
        console.error("Error adding payroll entry:", e);
        res.status(500).json({ error: "Server Error" });
    }
};
exports.addPayrollEntry = addPayrollEntry;
const updatePayrollEntry = async (req, res) => {
    try {
        const { gross_pay, deductions, net_salary } = req.body;
        await db_1.default.query(`UPDATE Payroll SET gross_pay = ?, deductions = ?, net_salary = ? WHERE payroll_id = ?`, [gross_pay, deductions, net_salary, req.params.id]);
        res.json({ status: "Updated" });
    }
    catch (e) {
        console.error("Error updating payroll entry:", e);
        res.status(500).json({ error: "Server Error" });
    }
};
exports.updatePayrollEntry = updatePayrollEntry;
const deletePayrollEntry = async (req, res) => {
    try {
        await db_1.default.query(`DELETE FROM Payroll WHERE payroll_id = ?`, [req.params.id]);
        res.json({ status: "Deleted" });
    }
    catch (e) {
        console.error("Error deleting payroll entry:", e);
        res.status(500).json({ error: "Server Error" });
    }
};
exports.deletePayrollEntry = deletePayrollEntry;
// CRUD: Employee Salary
const getEmployees = async (req, res) => {
    try {
        const [rows] = await db_1.default.query(`
            SELECT emp_id, name, email, role_id, base_salary, hourly_rate, standard_deductions 
            FROM Employee
        `);
        res.json(rows);
    }
    catch (e) {
        console.error("Error fetching employees:", e);
        res.status(500).json({ error: "Server Error" });
    }
};
exports.getEmployees = getEmployees;
const updateEmployeeSalary = async (req, res) => {
    try {
        const { base_salary, hourly_rate, standard_deductions } = req.body;
        await db_1.default.query(`UPDATE Employee SET base_salary = ?, hourly_rate = ?, standard_deductions = ? WHERE emp_id = ?`, [base_salary, hourly_rate, standard_deductions, req.params.id]);
        res.json({ status: "Updated", message: "Employee salary details updated" });
    }
    catch (e) {
        console.error("Error updating employee salary:", e);
        res.status(500).json({ error: "Server Error" });
    }
};
exports.updateEmployeeSalary = updateEmployeeSalary;
