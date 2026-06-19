import { Request, Response } from 'express';
import pool from '../db';
import { RowDataPacket } from 'mysql2';
import { AuthRequest } from '../middleware/auth';

export const markAsRead = async (req: AuthRequest, res: Response) => {
    try {
        const { alert_id, message } = req.body;
        const emp_id = req.user?.emp_id;

        if (!emp_id) return res.status(401).json({ error: 'Unauthorized' });
        if (!alert_id || !message) return res.status(400).json({ error: 'Missing alert_id or message' });

        await pool.query(
            `INSERT IGNORE INTO Employee_Read_Alerts (emp_id, alert_id, message) VALUES (?, ?, ?)`,
            [emp_id, alert_id, message]
        );

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error marking alert as read:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getReadAlerts = async (req: AuthRequest, res: Response) => {
    try {
        const emp_id = req.user?.emp_id;
        if (!emp_id) return res.status(401).json({ error: 'Unauthorized' });

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT alert_id, message, read_at FROM Employee_Read_Alerts 
             WHERE emp_id = ? 
             ORDER BY read_at DESC LIMIT 10`,
            [emp_id]
        );

        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching read alerts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
