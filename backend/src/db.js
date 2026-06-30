"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promise_1 = __importDefault(require("mysql2/promise"));
const dotenv_1 = __importDefault(require("dotenv"));
const url_1 = require("url");
dotenv_1.default.config();
const uri = process.env.DATABASE_URL || 'mysql://root:root@127.0.0.1:3306/pharmacy_pos';
let pool;
try {
    const dbUrl = new url_1.URL(uri);
    const isLocal = dbUrl.hostname === 'localhost' || dbUrl.hostname === '127.0.0.1';
    const config = {
        host: dbUrl.hostname,
        port: dbUrl.port ? parseInt(dbUrl.port) : 3306,
        user: dbUrl.username,
        password: decodeURIComponent(dbUrl.password),
        database: dbUrl.pathname.replace(/^\//, ''),
        ssl: isLocal ? undefined : {
            rejectUnauthorized: false
        },
        waitForConnections: true,
        connectionLimit: 10,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000
    };
    pool = promise_1.default.createPool(config);
}
catch (err) {
    // Fallback if URL parsing fails
    pool = promise_1.default.createPool(uri);
}
exports.default = pool;
