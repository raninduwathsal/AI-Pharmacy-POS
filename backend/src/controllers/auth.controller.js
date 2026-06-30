"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = exports.register = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = __importDefault(require("../db"));
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretfallback';
const register = async (req, res) => {
    try {
        const { name, email, password, role_id } = req.body;
        const [existingUsers] = await db_1.default.query('SELECT * FROM Employee WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'Email already exists.' });
        }
        const password_hash = await bcrypt_1.default.hash(password, 10);
        const finalRoleId = role_id || 3; // Default to Assistant Pharmacist if not provided
        const [result] = await db_1.default.query('INSERT INTO Employee (name, email, password_hash, role_id) VALUES (?, ?, ?, ?)', [name, email, password_hash, finalRoleId]);
        res.status(201).json({
            message: 'Employee registered successfully.',
            employee: {
                emp_id: result.insertId,
                name,
                email,
                role_id: finalRoleId,
            },
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const [employees] = await db_1.default.query(`SELECT e.*, r.role_name 
             FROM Employee e 
             JOIN Role r ON e.role_id = r.role_id 
             WHERE e.email = ?`, [email]);
        if (employees.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }
        const employee = employees[0];
        const validPassword = await bcrypt_1.default.compare(password, employee.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }
        // Fetch permissions for this role
        const [permRows] = await db_1.default.query(`SELECT p.action_name 
             FROM Permission p 
             JOIN Role_Permission rp ON p.perm_id = rp.perm_id 
             WHERE rp.role_id = ?`, [employee.role_id]);
        const permissions = permRows.map(row => row.action_name);
        const tokenPayload = {
            emp_id: employee.emp_id,
            role_id: employee.role_id,
            role_name: employee.role_name,
            permissions,
        };
        const token = jsonwebtoken_1.default.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' });
        res.status(200).json({
            message: 'Login successful.',
            token,
            user: {
                emp_id: employee.emp_id,
                name: employee.name,
                role: employee.role_name,
                permissions,
            },
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};
exports.login = login;
