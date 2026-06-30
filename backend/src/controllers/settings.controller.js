"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSetting = exports.getSettings = void 0;
const db_1 = __importDefault(require("../db"));
const getSettings = async (req, res) => {
    try {
        const [rows] = await db_1.default.query('SELECT setting_key, setting_value FROM App_Settings');
        const settings = rows.reduce((acc, row) => {
            acc[row.setting_key] = row.setting_value;
            return acc;
        }, {});
        res.status(200).json(settings);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getSettings = getSettings;
const updateSetting = async (req, res) => {
    try {
        const key = req.params.key;
        const { value } = req.body;
        if (value === undefined) {
            return res.status(400).json({ error: 'Value is required' });
        }
        await db_1.default.query('INSERT INTO App_Settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?', [key, value, value]);
        res.status(200).json({ message: 'Setting updated successfully' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateSetting = updateSetting;
