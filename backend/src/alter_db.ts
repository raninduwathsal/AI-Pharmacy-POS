import pool from './db';

async function run() {
    try {
        await pool.query('ALTER TABLE Products ADD COLUMN unit_cost DECIMAL(10,2) DEFAULT 0.00;');
        await pool.query('ALTER TABLE Products ADD COLUMN location VARCHAR(100);');
        console.log('Successfully added unit_cost and location to Products table.');
    } catch (e: any) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log('Columns already exist.');
        } else {
            console.error('Error:', e);
        }
    }
    
    try {
        await pool.query('ALTER TABLE Sale_Items ADD COLUMN product_id INT;');
        await pool.query('ALTER TABLE Sale_Items ADD CONSTRAINT fk_product FOREIGN KEY (product_id) REFERENCES Products(product_id) ON DELETE RESTRICT;');
        await pool.query("ALTER TABLE Sale_Items ADD COLUMN item_type VARCHAR(50) DEFAULT 'otc';");
        await pool.query('ALTER TABLE Sale_Items ADD COLUMN frequency VARCHAR(50);');
        console.log('Successfully added product_id, item_type, and frequency to Sale_Items table.');
    } catch (e: any) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log('Sale_Items columns already exist.');
        } else {
            console.error('Error altering Sale_Items:', e);
        }
    }

    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Prescription_Book_Records (
                id INT AUTO_INCREMENT PRIMARY KEY,
                patient_name VARCHAR(255),
                patient_age INT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Prescription_Book_Lines (
                id INT AUTO_INCREMENT PRIMARY KEY,
                record_id INT NOT NULL,
                medicine_name_raw VARCHAR(255) NOT NULL,
                frequency VARCHAR(100),
                total_amount INT NOT NULL,
                FOREIGN KEY (record_id) REFERENCES Prescription_Book_Records(id) ON DELETE CASCADE
            )
        `);
        console.log('Successfully created Prescription_Book tables.');
    } catch (e: any) {
        console.error('Error creating Prescription_Book tables:', e);
    }

    try {
        await pool.query('ALTER TABLE Supplier_Invoice_Items ADD COLUMN pack_size INT NOT NULL DEFAULT 1;');
        console.log('Successfully added pack_size to Supplier_Invoice_Items table.');
    } catch (e: any) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log('Supplier_Invoice_Items pack_size already exists.');
        } else {
            console.error('Error altering Supplier_Invoice_Items:', e);
        }
    } finally {
        process.exit(0);
    }
}
run();
