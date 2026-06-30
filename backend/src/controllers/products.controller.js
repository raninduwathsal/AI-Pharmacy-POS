"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProduct = exports.updateProduct = exports.createProduct = exports.searchProducts = exports.getAllProducts = void 0;
const db_1 = __importDefault(require("../db"));
// ----------------- PRODUCTS -----------------
const getAllProducts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limitStr = req.query.limit;
        const search = req.query.search;
        let queryStr = 'FROM Products';
        let queryParams = [];
        if (search) {
            queryStr += ' WHERE name LIKE ?';
            queryParams.push(`%${search}%`);
        }
        const [countResult] = await db_1.default.query(`SELECT COUNT(*) as total ${queryStr}`, queryParams);
        const total = countResult[0].total;
        if (limitStr === 'all' || parseInt(limitStr) > 5000) {
            const [rows] = await db_1.default.query(`SELECT * ${queryStr}`, queryParams);
            return res.status(200).json({ data: rows, total, page: 1, totalPages: 1 });
        }
        const limit = parseInt(limitStr) || 50;
        const offset = (page - 1) * limit;
        queryParams.push(limit, offset);
        const [rows] = await db_1.default.query(`SELECT * ${queryStr} LIMIT ? OFFSET ?`, queryParams);
        res.status(200).json({
            data: rows,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getAllProducts = getAllProducts;
const searchProducts = async (req, res) => {
    try {
        const query = req.query.q;
        if (!query)
            return res.status(200).json([]);
        const [rows] = await db_1.default.query('SELECT product_id, name, measure_unit, current_stock, expiry_dates, unit_cost FROM Products WHERE name LIKE ? LIMIT 20', [`%${query}%`]);
        res.status(200).json(rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.searchProducts = searchProducts;
const createProduct = async (req, res) => {
    try {
        const { name, measure_unit, category, reorder_threshold, current_stock, selling_price, expiry_dates, unit_cost, location } = req.body;
        if (!name || !measure_unit)
            return res.status(400).json({ error: 'Name and Unit are required' });
        const expiryDatesStr = Array.isArray(expiry_dates) ? JSON.stringify(expiry_dates) : (expiry_dates ? JSON.stringify([expiry_dates]) : JSON.stringify([]));
        const [result] = await db_1.default.query('INSERT INTO Products (name, measure_unit, category, reorder_threshold, current_stock, selling_price, expiry_dates, unit_cost, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [name, measure_unit, category || null, reorder_threshold || 0, current_stock || 0, selling_price || 0.00, expiryDatesStr, unit_cost || 0.00, location || null]);
        res.status(201).json({ message: 'Product created successfully', product_id: result.insertId });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createProduct = createProduct;
const updateProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const { name, measure_unit, category, reorder_threshold, current_stock, selling_price, expiry_dates, unit_cost, location } = req.body;
        const expiryDatesStr = Array.isArray(expiry_dates) ? JSON.stringify(expiry_dates) : (expiry_dates ? JSON.stringify([expiry_dates]) : JSON.stringify([]));
        await db_1.default.query('UPDATE Products SET name = ?, measure_unit = ?, category = ?, reorder_threshold = ?, current_stock = ?, selling_price = ?, expiry_dates = ?, unit_cost = ?, location = ? WHERE product_id = ?', [name, measure_unit, category, reorder_threshold, current_stock || 0, selling_price || 0.00, expiryDatesStr, unit_cost || 0.00, location || null, id]);
        res.status(200).json({ message: 'Product updated successfully' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateProduct = updateProduct;
const deleteProduct = async (req, res) => {
    try {
        const id = req.params.id;
        await db_1.default.query('DELETE FROM Products WHERE product_id = ?', [id]);
        res.status(200).json({ message: 'Product deleted successfully' });
    }
    catch (error) {
        console.error(error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ error: 'Cannot delete product currently linked to sales or GRNs' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteProduct = deleteProduct;
