"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = exports.server = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const multer_1 = __importDefault(require("multer"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const auth_controller_1 = require("./controllers/auth.controller");
const rbac_controller_1 = require("./controllers/rbac.controller");
const auth_1 = require("./middleware/auth");
const db_1 = __importDefault(require("./db"));
const app = (0, express_1.default)();
exports.server = (0, http_1.createServer)(app);
exports.io = new socket_io_1.Server(exports.server, { cors: { origin: '*' } });
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Global Request Logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
const path_1 = __importDefault(require("path"));
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../../public/uploads')));
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
exports.io.on('connection', (socket) => {
    console.log('A client connected:', socket.id);
    socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});
const products_controller_1 = require("./controllers/products.controller");
const suppliers_controller_1 = require("./controllers/suppliers.controller");
const inventory_controller_1 = require("./controllers/inventory.controller");
const finance_controller_1 = require("./controllers/finance.controller");
// --- Auth Routes ---
app.post('/api/auth/register', auth_controller_1.register);
app.post('/api/auth/login', auth_controller_1.login);
// --- RBAC Routes ---
app.get('/api/roles', auth_1.authenticateToken, (0, auth_1.hasPermission)('MANAGE_ROLES'), rbac_controller_1.getAllRoles);
app.get('/api/permissions', auth_1.authenticateToken, (0, auth_1.hasPermission)('MANAGE_ROLES'), rbac_controller_1.getAllPermissions);
app.put('/api/roles/:id/permissions', auth_1.authenticateToken, (0, auth_1.hasPermission)('MANAGE_ROLES'), rbac_controller_1.updateRolePermissions);
// --- Products Routes ---
app.get('/api/products/search', auth_1.authenticateToken, (0, auth_1.hasPermission)('VIEW_TAB_GRN'), products_controller_1.searchProducts);
app.get('/api/products', auth_1.authenticateToken, (0, auth_1.hasPermission)('VIEW_TAB_INVENTORY'), products_controller_1.getAllProducts);
app.post('/api/products', auth_1.authenticateToken, (0, auth_1.hasPermission)('VIEW_TAB_INVENTORY'), products_controller_1.createProduct);
app.put('/api/products/:id', auth_1.authenticateToken, (0, auth_1.hasPermission)('VIEW_TAB_INVENTORY'), products_controller_1.updateProduct);
app.delete('/api/products/:id', auth_1.authenticateToken, (0, auth_1.hasPermission)('VIEW_TAB_INVENTORY'), products_controller_1.deleteProduct);
// --- Suppliers Routes ---
app.get('/api/suppliers', auth_1.authenticateToken, (0, auth_1.hasPermission)('VIEW_TAB_SUPPLIERS'), suppliers_controller_1.getAllSuppliers);
app.post('/api/suppliers', auth_1.authenticateToken, (0, auth_1.hasPermission)('VIEW_TAB_SUPPLIERS'), suppliers_controller_1.createSupplier);
app.put('/api/suppliers/:id', auth_1.authenticateToken, (0, auth_1.hasPermission)('VIEW_TAB_SUPPLIERS'), suppliers_controller_1.updateSupplier);
app.delete('/api/suppliers/:id', auth_1.authenticateToken, (0, auth_1.hasPermission)('VIEW_TAB_SUPPLIERS'), suppliers_controller_1.deleteSupplier);
// --- Inventory & GRN Routes ---
app.post('/api/inventory/receive', auth_1.authenticateToken, (0, auth_1.hasPermission)('VIEW_TAB_GRN'), inventory_controller_1.receiveStock);
app.get('/api/inventory/alerts', auth_1.authenticateToken, (0, auth_1.hasPermission)('VIEW_TAB_INVENTORY'), inventory_controller_1.getAlerts);
app.get('/api/inventory/grn-history', auth_1.authenticateToken, (0, auth_1.hasPermission)('VIEW_TAB_GRN'), inventory_controller_1.getGrnHistory);
// --- Finance Routes ---
app.get('/api/finance/pending-checks', auth_1.authenticateToken, (0, auth_1.hasPermission)('VIEW_TAB_FINANCE'), finance_controller_1.getPendingChecks);
app.patch('/api/finance/checks/:id/clear', auth_1.authenticateToken, (0, auth_1.hasPermission)('VIEW_TAB_FINANCE'), finance_controller_1.clearCheck);
// --- Alerts Routes ---
const alerts_controller_1 = require("./controllers/alerts.controller");
app.post('/api/alerts/read', auth_1.authenticateToken, alerts_controller_1.markAsRead);
app.get('/api/alerts/read', auth_1.authenticateToken, alerts_controller_1.getReadAlerts);
// --- Settings Routes ---
const settings_controller_1 = require("./controllers/settings.controller");
app.get('/api/settings', auth_1.authenticateToken, settings_controller_1.getSettings);
app.put('/api/settings/:key', auth_1.authenticateToken, (0, auth_1.hasPermission)('MANAGE_ROLES'), settings_controller_1.updateSetting);
// --- Patient Routes ---
const patients_controller_1 = require("./controllers/patients.controller");
const auditLogger_1 = require("./utils/auditLogger");
app.post('/api/patients', auth_1.authenticateToken, (0, auditLogger_1.auditLogMiddleware)('CREATE_PATIENT'), patients_controller_1.createPatient);
app.get('/api/patients/search', auth_1.authenticateToken, patients_controller_1.searchPatients);
app.get('/api/patients/:id/discount', auth_1.authenticateToken, patients_controller_1.getPatientDiscount);
app.get('/api/patients/:id', auth_1.authenticateToken, patients_controller_1.getPatient);
app.put('/api/patients/:id', auth_1.authenticateToken, (0, auth_1.hasPermission)('MANAGE_PATIENTS'), (0, auditLogger_1.auditLogMiddleware)('UPDATE_PATIENT'), patients_controller_1.updatePatient);
app.delete('/api/patients/:id/opt-out', auth_1.authenticateToken, (0, auth_1.hasPermission)('MANAGE_PATIENTS'), (0, auditLogger_1.auditLogMiddleware)('DELETE_PATIENT_DATA'), patients_controller_1.optOutPatient);
// --- POS Routes ---
const pos_controller_1 = require("./controllers/pos.controller");
app.post('/api/pos/process-prescription', pos_controller_1.processPrescription); // Microservice auth
app.post('/api/pos/upload-prescription', auth_1.authenticateToken, (0, auth_1.hasPermission)('VIEW_TAB_POS'), upload.single('image'), pos_controller_1.uploadPrescriptionImage);
app.post('/api/pos/upload-mobile-prescription', auth_1.authenticateToken, upload.single('image'), pos_controller_1.uploadMobilePrescription);
app.post('/api/pos/draft', auth_1.authenticateToken, (0, auth_1.hasPermission)('VIEW_TAB_POS'), pos_controller_1.saveDraftSale);
app.post('/api/pos/checkout', auth_1.authenticateToken, (0, auth_1.hasPermission)('VIEW_TAB_POS'), pos_controller_1.confirmCheckout);
app.get('/api/pos/search', auth_1.authenticateToken, (0, auth_1.hasPermission)('VIEW_TAB_POS'), pos_controller_1.searchPosProducts);
app.get('/api/pos/invoice/:id', auth_1.authenticateToken, (0, auth_1.hasPermission)('VIEW_TAB_POS'), pos_controller_1.getInvoiceReceipt);
app.get('/api/pos/history', auth_1.authenticateToken, (0, auth_1.hasPermission)('VIEW_TAB_POS'), pos_controller_1.getSalesHistory);
app.get('/api/pos/prescription-book', auth_1.authenticateToken, (0, auth_1.hasPermission)('VIEW_TAB_POS'), pos_controller_1.getPrescriptionBookHistory);
app.delete('/api/pos/invoice/:id', auth_1.authenticateToken, (0, auth_1.hasPermission)('EDIT_PAST_SALES'), pos_controller_1.deleteInvoice);
// --- Analytics & Audit Routes ---
const analyticsController_1 = require("./controllers/analyticsController");
app.get('/api/admin/audit-logs', auth_1.authenticateToken, (0, auth_1.hasPermission)('VIEW_DASHBOARD'), analyticsController_1.getAuditLogs);
app.delete('/api/admin/audit-logs/:id', auth_1.authenticateToken, (0, auth_1.hasPermission)('MANAGE_AUDIT'), analyticsController_1.deleteAuditLog);
app.get('/api/admin/audit-logs/export', auth_1.authenticateToken, (0, auth_1.hasPermission)('VIEW_DASHBOARD'), analyticsController_1.exportAuditLogs);
app.get('/api/admin/financial-analytics', auth_1.authenticateToken, (0, auth_1.hasPermission)('VIEW_TAB_FINANCE'), analyticsController_1.getFinancialAnalytics);
app.get('/api/admin/financial-analytics/expenses', auth_1.authenticateToken, (0, auth_1.hasPermission)('MANAGE_FINANCE'), analyticsController_1.getExpenses);
app.post('/api/admin/financial-analytics/expenses', auth_1.authenticateToken, (0, auth_1.hasPermission)('MANAGE_FINANCE'), (0, auditLogger_1.auditLogMiddleware)('CREATE_EXPENSE'), analyticsController_1.addExpense);
app.put('/api/admin/financial-analytics/expenses/:id', auth_1.authenticateToken, (0, auth_1.hasPermission)('MANAGE_FINANCE'), (0, auditLogger_1.auditLogMiddleware)('UPDATE_EXPENSE'), analyticsController_1.updateExpense);
app.delete('/api/admin/financial-analytics/expenses/:id', auth_1.authenticateToken, (0, auth_1.hasPermission)('MANAGE_FINANCE'), (0, auditLogger_1.auditLogMiddleware)('DELETE_EXPENSE'), analyticsController_1.deleteExpense);
app.get('/api/admin/financial-analytics/payroll', auth_1.authenticateToken, (0, auth_1.hasPermission)('MANAGE_PAYROLL'), analyticsController_1.getPayrollEntries);
app.post('/api/admin/financial-analytics/payroll', auth_1.authenticateToken, (0, auth_1.hasPermission)('MANAGE_PAYROLL'), (0, auditLogger_1.auditLogMiddleware)('CREATE_PAYROLL'), analyticsController_1.addPayrollEntry);
app.put('/api/admin/financial-analytics/payroll/:id', auth_1.authenticateToken, (0, auth_1.hasPermission)('MANAGE_PAYROLL'), (0, auditLogger_1.auditLogMiddleware)('UPDATE_PAYROLL'), analyticsController_1.updatePayrollEntry);
app.delete('/api/admin/financial-analytics/payroll/:id', auth_1.authenticateToken, (0, auth_1.hasPermission)('MANAGE_PAYROLL'), (0, auditLogger_1.auditLogMiddleware)('DELETE_PAYROLL'), analyticsController_1.deletePayrollEntry);
app.get('/api/admin/employees', auth_1.authenticateToken, (0, auth_1.hasPermission)('MANAGE_PAYROLL'), analyticsController_1.getEmployees);
app.put('/api/admin/employees/:id/salary', auth_1.authenticateToken, (0, auth_1.hasPermission)('MANAGE_PAYROLL'), (0, auditLogger_1.auditLogMiddleware)('UPDATE_EMPLOYEE_SALARY'), analyticsController_1.updateEmployeeSalary);
// Basic health check
app.get('/api/health', async (req, res) => {
    try {
        await db_1.default.query('SELECT 1');
        res.status(200).json({ status: 'ok', database: 'connected' });
    }
    catch (error) {
        console.error('Health check DB error:', error);
        res.status(500).json({ status: 'error', database: 'disconnected' });
    }
});
const PORT = process.env.PORT || 5000;
exports.server.listen(PORT, () => {
    console.log(`Server and Socket.io running on port ${PORT}`);
});
