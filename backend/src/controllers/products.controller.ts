import { Request, Response } from 'express';
import pool from '../db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// ----------------- PRODUCTS -----------------

export const getAllProducts = async (req: Request, res: Response) => {
    try {
        const [rows] = await pool.query('SELECT * FROM Products');
        res.status(200).json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const searchProducts = async (req: Request, res: Response) => {
    try {
        const query = req.query.q as string;
        if (!query) return res.status(200).json([]);

        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT product_id, name, measure_unit, current_stock, expiry_dates FROM Products WHERE name LIKE ? LIMIT 20',
            [`%${query}%`]
        );
        res.status(200).json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const createProduct = async (req: Request, res: Response) => {
    try {
        const { name, measure_unit, category, reorder_threshold, current_stock, selling_price, expiry_dates, unit_cost, location } = req.body;
        if (!name || !measure_unit) return res.status(400).json({ error: 'Name and Unit are required' });

        const expiryDatesStr = Array.isArray(expiry_dates) ? JSON.stringify(expiry_dates) : (expiry_dates ? JSON.stringify([expiry_dates]) : JSON.stringify([]));

        const [result] = await pool.query<ResultSetHeader>(
            'INSERT INTO Products (name, measure_unit, category, reorder_threshold, current_stock, selling_price, expiry_dates, unit_cost, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [name, measure_unit, category || null, reorder_threshold || 0, current_stock || 0, selling_price || 0.00, expiryDatesStr, unit_cost || 0.00, location || null]
        );
        res.status(201).json({ message: 'Product created successfully', product_id: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const updateProduct = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        const { name, measure_unit, category, reorder_threshold, current_stock, selling_price, expiry_dates, unit_cost, location } = req.body;

        const expiryDatesStr = Array.isArray(expiry_dates) ? JSON.stringify(expiry_dates) : (expiry_dates ? JSON.stringify([expiry_dates]) : JSON.stringify([]));

        await pool.query(
            'UPDATE Products SET name = ?, measure_unit = ?, category = ?, reorder_threshold = ?, current_stock = ?, selling_price = ?, expiry_dates = ?, unit_cost = ?, location = ? WHERE product_id = ?',
            [name, measure_unit, category, reorder_threshold, current_stock || 0, selling_price || 0.00, expiryDatesStr, unit_cost || 0.00, location || null, id]
        );

        res.status(200).json({ message: 'Product updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const deleteProduct = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        await pool.query('DELETE FROM Products WHERE product_id = ?', [id]);
        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error: any) {
        console.error(error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ error: 'Cannot delete product currently linked to sales or GRNs' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
};
