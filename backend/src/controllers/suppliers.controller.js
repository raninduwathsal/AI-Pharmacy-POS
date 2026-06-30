"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSupplier = exports.updateSupplier = exports.createSupplier = exports.getAllSuppliers = void 0;
const db_1 = __importDefault(require("../db"));
// ----------------- SUPPLIERS -----------------
const getAllSuppliers = async (req, res) => {
    try {
        const [rows] = await db_1.default.query('SELECT * FROM Suppliers');
        res.status(200).json(rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getAllSuppliers = getAllSuppliers;
const createSupplier = async (req, res) => {
    try {
        const { name, contact_email, phone } = req.body;
        if (!name)
            return res.status(400).json({ error: 'Name is required' });
        const [result] = await db_1.default.query('INSERT INTO Suppliers (name, contact_email, phone) VALUES (?, ?, ?)', [name, contact_email || null, phone || null]);
        res.status(201).json({ message: 'Supplier created successfully', supplier_id: result.insertId });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createSupplier = createSupplier;
const updateSupplier = async (req, res) => {
    try {
        const id = req.params.id;
        const { name, contact_email, phone } = req.body;
        await db_1.default.query('UPDATE Suppliers SET name = ?, contact_email = ?, phone = ? WHERE supplier_id = ?', [name, contact_email, phone, id]);
        res.status(200).json({ message: 'Supplier updated successfully' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateSupplier = updateSupplier;
const deleteSupplier = async (req, res) => {
    try {
        const id = req.params.id;
        await db_1.default.query('DELETE FROM Suppliers WHERE supplier_id = ?', [id]);
        res.status(200).json({ message: 'Supplier deleted successfully' });
    }
    catch (error) {
        console.error(error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ error: 'Cannot delete supplier with active invoices' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteSupplier = deleteSupplier;
