"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const db_1 = __importDefault(require("./db"));
const bcrypt_1 = __importDefault(require("bcrypt"));
async function runSeed() {
    const schemaPath = path_1.default.join(__dirname, 'schema.sql');
    const schemaSql = fs_1.default.readFileSync(schemaPath, 'utf-8');
    const statements = schemaSql.split(';').filter(stmt => stmt.trim() !== '');
    console.log("Creating database schema...");
    for (const stmt of statements) {
        await db_1.default.query(stmt);
    }
    console.log("Ensuring Employee table has salary columns...");
    // Check information_schema for existing columns before altering to avoid duplicate-column errors
    async function ensureColumn(table, column, ddl) {
        const [rows] = await db_1.default.query('SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?', [table, column]);
        const cnt = (rows && rows[0] && rows[0].cnt) ? Number(rows[0].cnt) : 0;
        if (cnt === 0) {
            await db_1.default.query(ddl);
        }
    }
    await ensureColumn('Employee', 'base_salary', 'ALTER TABLE Employee ADD COLUMN base_salary DECIMAL(10,2) DEFAULT 0.00');
    await ensureColumn('Employee', 'hourly_rate', 'ALTER TABLE Employee ADD COLUMN hourly_rate DECIMAL(10,2) DEFAULT NULL');
    await ensureColumn('Employee', 'standard_deductions', 'ALTER TABLE Employee ADD COLUMN standard_deductions DECIMAL(10,2) DEFAULT 0.00');
    await ensureColumn('Products', 'selling_price', 'ALTER TABLE Products ADD COLUMN selling_price DECIMAL(10,2) DEFAULT 0.00');
    console.log("Seeding Permissions...");
    const permissionsData = [
        ['VIEW_DASHBOARD', 'Can access main dashboard'],
        ['VIEW_TAB_INVENTORY', 'Can access Inventory & Products tab'],
        ['VIEW_TAB_SUPPLIERS', 'Can access Suppliers tab'],
        ['VIEW_TAB_GRN', 'Can access Receive Stock (GRN) tab'],
        ['VIEW_TAB_FINANCE', 'Can access checks and finance tab'],
        ['VIEW_TAB_POS', 'Can access Point of Sale (POS) tab'],
        ['CREATE_SALE', 'Can process a POS transaction'],
        ['CREATE_PRESCRIPTION', 'Can process a prescription from AI'],
        ['VOID_SALE', 'Can cancel a POS transaction'],
        ['MANAGE_ROLES', 'Can modify user roles and permissions'],
        ['ASSIGN_DRIVER', 'Can assign delivery orders to drivers'],
        ['ADJUST_INVENTORY', 'Can modify stock counts'],
        ['MANAGE_PATIENTS', 'Can manage patient records and profiles'],
        ['MANAGE_FINANCE', 'Can manage operating expenses'],
        ['MANAGE_PAYROLL', 'Can manage employee payroll and salaries'],
        ['MANAGE_AUDIT', 'Can manage and delete system audit logs'],
        ['EDIT_PAST_SALES', 'Can edit and delete past sales']
    ];
    for (const [action, desc] of permissionsData) {
        await db_1.default.query('INSERT IGNORE INTO Permission (action_name, description) VALUES (?, ?)', [action, desc]);
    }
    console.log("Seeding Roles...");
    const rolesData = [
        ['Admin', 'System Administrator'],
        ['Head Pharmacist', 'Lead pharmacist and manager'],
        ['Assistant Pharmacist', 'Assists with pharmacy duties'],
        ['Cashier', 'Frontend point of sale user'],
        ['Mobile Staff', 'Mobile companion app user']
    ];
    for (const [name, desc] of rolesData) {
        await db_1.default.query('INSERT IGNORE INTO Role (role_name, description) VALUES (?, ?)', [name, desc]);
    }
    const [adminRows] = await db_1.default.query('SELECT role_id FROM Role WHERE role_name = ?', ['Admin']);
    if (adminRows.length > 0) {
        const adminId = adminRows[0].role_id;
        const [allPerms] = await db_1.default.query('SELECT perm_id FROM Permission');
        console.log("Assigning all permissions to Admin...");
        for (const perm of allPerms) {
            await db_1.default.query('INSERT IGNORE INTO Role_Permission (role_id, perm_id) VALUES (?, ?)', [adminId, perm.perm_id]);
        }
        console.log("Creating default Admin user...");
        const password_hash = await bcrypt_1.default.hash('Admin@123', 10);
        await db_1.default.query('INSERT IGNORE INTO Employee (name, email, password_hash, role_id) VALUES (?, ?, ?, ?)', ['System Admin', 'admin@pharmacy.com', password_hash, adminId]);
    }
    const [mobileStaffRows] = await db_1.default.query('SELECT role_id FROM Role WHERE role_name = ?', ['Mobile Staff']);
    if (mobileStaffRows.length > 0) {
        const mobileStaffId = mobileStaffRows[0].role_id;
        const mobilePerms = ['VIEW_TAB_INVENTORY', 'VIEW_TAB_FINANCE', 'VIEW_TAB_GRN'];
        for (const permName of mobilePerms) {
            const [permRows] = await db_1.default.query('SELECT perm_id FROM Permission WHERE action_name = ?', [permName]);
            if (permRows.length > 0) {
                await db_1.default.query('INSERT IGNORE INTO Role_Permission (role_id, perm_id) VALUES (?, ?)', [mobileStaffId, permRows[0].perm_id]);
            }
        }
        console.log("Creating default Mobile Staff user...");
        const mobile_password_hash = await bcrypt_1.default.hash('mobile@pharmacy.com', 10);
        await db_1.default.query('INSERT IGNORE INTO Employee (name, email, password_hash, role_id) VALUES (?, ?, ?, ?)', ['Mobile User', 'mobile@pharmacy.com', mobile_password_hash, mobileStaffId]);
    }
    console.log("Seeding App Settings...");
    await db_1.default.query('INSERT IGNORE INTO App_Settings (setting_key, setting_value, description) VALUES (?, ?, ?)', ['currency', 'LKR', 'Base currency symbol for the application']);
}
runSeed()
    .then(() => {
    console.log("Seeding completed successfully.");
    process.exit(0);
})
    .catch((err) => {
    console.error("Seeding failed: ", err);
    process.exit(1);
});
