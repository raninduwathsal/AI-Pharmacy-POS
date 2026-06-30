"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogMiddleware = exports.logAuditAction = void 0;
const db_1 = __importDefault(require("../db"));
/**
 * Utility function to fire-and-forget an audit log entry.
 */
const logAuditAction = async (empId, actionType, details) => {
    try {
        await db_1.default.query(`INSERT INTO Audit_Logs (emp_id, action_type, details) VALUES (?, ?, ?)`, [empId, actionType, details]);
    }
    catch (error) {
        console.error(`Failed to log audit action [${actionType}] for emp_id [${empId}]:`, error);
    }
};
exports.logAuditAction = logAuditAction;
/**
 * Express middleware to automatically log actions for sensitive routes.
 * Requires `req.user.emp_id` to be populated by the authentication middleware.
 */
const auditLogMiddleware = (actionType) => {
    return async (req, res, next) => {
        // Original end/json functions
        const originalJson = res.json;
        // Override json to capture the response and log it after sending
        res.json = function (body) {
            // Call original json
            originalJson.call(this, body);
            // Extract employee ID (assuming auth middleware sets this)
            const empId = req.user?.emp_id;
            if (empId) {
                // Construct a detail string from request payload and response status
                let details = `Method: ${req.method}, Route: ${req.originalUrl}, Status: ${res.statusCode}`;
                // For POST/PUT/PATCH, capture a summary of the payload (excluding passwords)
                if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.body) {
                    const safeBody = { ...req.body };
                    if (safeBody.password)
                        safeBody.password = '[REDACTED]';
                    if (safeBody.password_hash)
                        safeBody.password_hash = '[REDACTED]';
                    const bodyStr = JSON.stringify(safeBody);
                    // Truncate if too long to avoid DB overflow
                    details += ` | Payload: ${bodyStr.substring(0, 500)}${bodyStr.length > 500 ? '...' : ''}`;
                }
                // Fire and forget
                (0, exports.logAuditAction)(empId, actionType, details);
            }
            return this;
        };
        next();
    };
};
exports.auditLogMiddleware = auditLogMiddleware;
