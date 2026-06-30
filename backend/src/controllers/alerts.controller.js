"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReadAlerts = exports.markAsRead = void 0;
const db_1 = __importDefault(require("../db"));
const markAsRead = async (req, res) => {
    try {
        const { alert_id, message } = req.body;
        const emp_id = req.user?.emp_id;
        if (!emp_id)
            return res.status(401).json({ error: 'Unauthorized' });
        if (!alert_id || !message)
            return res.status(400).json({ error: 'Missing alert_id or message' });
        await db_1.default.query(`INSERT IGNORE INTO Employee_Read_Alerts (emp_id, alert_id, message) VALUES (?, ?, ?)`, [emp_id, alert_id, message]);
        res.status(200).json({ success: true });
    }
    catch (error) {
        console.error('Error marking alert as read:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.markAsRead = markAsRead;
const getReadAlerts = async (req, res) => {
    try {
        const emp_id = req.user?.emp_id;
        if (!emp_id)
            return res.status(401).json({ error: 'Unauthorized' });
        const [rows] = await db_1.default.query(`SELECT alert_id, message, read_at FROM Employee_Read_Alerts 
             WHERE emp_id = ? 
             ORDER BY read_at DESC LIMIT 10`, [emp_id]);
        res.status(200).json(rows);
    }
    catch (error) {
        console.error('Error fetching read alerts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getReadAlerts = getReadAlerts;
