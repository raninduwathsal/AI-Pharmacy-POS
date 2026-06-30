import { Request, Response } from 'express';
import pool from '../db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { AuthRequest } from '../middleware/auth';
import { io } from '../server';
import { GoogleGenAI } from '@google/genai';

export const processPrescription = async (req: Request, res: Response) => {
    // Webhook from AI Microservice
    const { patient_id, extracted_lines } = req.body;

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [rxResult] = await connection.query<ResultSetHeader>(
            `INSERT INTO Prescriptions (patient_id, status) VALUES (?, 'Pending Verification')`,
            [patient_id || null]
        );
        const prescriptionId = rxResult.insertId;

        if (extracted_lines && Array.isArray(extracted_lines)) {
            for (const line of extracted_lines) {
                await connection.query(
                    `INSERT INTO Prescription_lines (prescription_id, medicine_name_raw, frequency, total_amount, matched_product_id) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [prescriptionId, line.medicine_name_raw, line.frequency || '', line.total_amount || 0, line.matched_product_id || null]
                );
            }
        }

        await connection.commit();

        // Broadcast to all connected frontend clients
        io.emit('new_ai_scan_received', {
            prescription_id: prescriptionId,
            patient_id,
            extracted_lines
        });

        res.status(200).json({ message: "Prescription processed and broadcasted successfully", prescription_id: prescriptionId });
    } catch (error) {
        await connection.rollback();
        console.error("AI Webhook Error:", error);
        res.status(500).json({ error: 'Internal server error while processing AI webhook' });
    } finally {
        connection.release();
    }
};

export const saveDraftSale = async (req: AuthRequest, res: Response) => {
    const { is_over_the_counter, patient_id, prescription_id, payment_method, total_amount, money_given, notes, items } = req.body;
    const empId = req.user?.emp_id;

    if (!empId) return res.status(401).json({ error: 'Unauthorized' });

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [invResult] = await connection.query<ResultSetHeader>(
            `INSERT INTO Sales_Invoices (is_over_the_counter, patient_id, cashier_id, prescription_id, payment_method, total_amount, money_given, status, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'Draft', ?)`,
            [is_over_the_counter ?? true, patient_id || null, empId, prescription_id || null, payment_method || 'Pending', total_amount || 0, money_given || 0, notes || null]
        );
        const invoiceId = invResult.insertId;

        // Note: For drafts, we might just save items dynamically linked to batches if known, but we don't DEDUCT stock. 
        // For simplicity in this demo, draft implies saving the invoice header alone as a "hold" or saving generic items if preferred.
        // Assuming `items` array has { batch_id, quantity, unit_price }
        if (items && items.length > 0) {
            for (const item of items) {
                if (item.product_id) {
                    await connection.query(
                        `INSERT INTO Sale_Items (invoice_id, product_id, quantity, unit_price, item_type, frequency) VALUES (?, ?, ?, ?, ?, ?)`,
                        [invoiceId, item.product_id, item.quantity, item.unit_price, item.type || 'otc', item.frequency || '']
                    );
                }
            }
        }

        await connection.commit();
        res.status(200).json({ message: "Draft saved successfully", invoice_id: invoiceId });
    } catch (error) {
        await connection.rollback();
        console.error("Save Draft Error:", error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        connection.release();
    }
};

export const confirmCheckout = async (req: AuthRequest, res: Response) => {
    const { is_over_the_counter, patient_id, prescription_id, payment_method, total_amount, money_given, notes, items } = req.body;
    const empId = req.user?.emp_id;

    if (!empId) return res.status(401).json({ error: 'Unauthorized' });
    if (!items || !items.length) return res.status(400).json({ error: 'Cart is empty' });

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        let currentRxId = prescription_id || null;
        const rxItems = items.filter((i: any) => i.type === 'rx');

        if (rxItems.length > 0 && patient_id && !currentRxId) {
            const [rxRes] = await connection.query<ResultSetHeader>(
                `INSERT INTO Prescriptions (patient_id, status) VALUES (?, 'Verified')`,
                [patient_id]
            );
            currentRxId = rxRes.insertId;

            for (const item of rxItems) {
                // Determine name if possible, or leave as generic
                await connection.query(
                    `INSERT INTO Prescription_lines (prescription_id, medicine_name_raw, frequency, total_amount, matched_product_id) 
                     VALUES (?, (SELECT name FROM Products WHERE product_id = ? LIMIT 1), ?, ?, ?)`,
                    [currentRxId, item.product_id, item.frequency || '', item.quantity, item.product_id]
                );
            }
        } else if (currentRxId && patient_id) {
            await connection.query(
                `UPDATE Prescriptions SET status = 'Verified', patient_id = COALESCE(patient_id, ?) WHERE prescription_id = ?`,
                [patient_id, currentRxId]
            );
        } else if (currentRxId) {
            await connection.query(
                `UPDATE Prescriptions SET status = 'Verified' WHERE prescription_id = ?`,
                [currentRxId]
            );
        }

        // --- Prescription Book Saving ---
        if (rxItems.length > 0) {
            const [bookRes] = await connection.query<ResultSetHeader>(
                `INSERT INTO Prescription_Book_Records (patient_name, patient_age) VALUES (?, ?)`,
                [req.body.prescription_patient_name || null, req.body.prescription_patient_age || null]
            );
            const bookId = bookRes.insertId;

            for (const item of rxItems) {
                await connection.query(
                    `INSERT INTO Prescription_Book_Lines (record_id, medicine_name_raw, frequency, total_amount) 
                     VALUES (?, COALESCE((SELECT name FROM Products WHERE product_id = ? LIMIT 1), 'Unknown'), ?, ?)`,
                    [bookId, item.product_id, item.frequency || '', item.quantity]
                );
            }
        }
        // --------------------------------

        // 1. Create Completed Invoice
        const [invResult] = await connection.query<ResultSetHeader>(
            `INSERT INTO Sales_Invoices (is_over_the_counter, patient_id, cashier_id, prescription_id, payment_method, total_amount, money_given, status, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'Completed', ?)`,
            [is_over_the_counter ?? true, patient_id || null, empId, currentRxId, payment_method || 'Cash', total_amount, money_given, notes || null]
        );
        const invoiceId = invResult.insertId;

        // 1.5 Fetch Allow Out of Stock Sales Setting
        const [settingsRows] = await connection.query<RowDataPacket[]>('SELECT setting_value FROM App_Settings WHERE setting_key = ?', ['allow_out_of_stock_sales']);
        const allowOutOfStockSales = settingsRows.length > 0 && settingsRows[0].setting_value === 'true';

        // 2. Deduct from global Product stock tracking and Record Sale Item
        for (const item of items) {
            const productId = item.product_id;
            const reqQty = item.quantity;
            const sellingPrice = item.unit_price;

            const [products] = await connection.query<RowDataPacket[]>(
                `SELECT current_stock FROM Products WHERE product_id = ? FOR UPDATE`,
                [productId]
            );

            if (!products.length || products[0].current_stock < reqQty) {
                if (!allowOutOfStockSales) {
                    throw new Error(`Insufficient stock for Product ID ${productId}`);
                }
            }

            // Deduct from global Product stock tracking
            await connection.query(
                `UPDATE Products SET current_stock = current_stock - ? WHERE product_id = ?`,
                [reqQty, productId]
            );

            // Record Sale Item
            await connection.query(
                `INSERT INTO Sale_Items (invoice_id, product_id, quantity, unit_price, item_type, frequency) VALUES (?, ?, ?, ?, ?, ?)`,
                [invoiceId, productId, reqQty, sellingPrice, item.type || 'otc', item.frequency || '']
            );
        }

        await connection.commit();
        
        io.emit('inventory_alert', { message: 'Stock levels updated' });

        res.status(200).json({
            message: "Checkout completed successfully",
            invoice_id: invoiceId,
            change_due: Math.max(0, money_given - total_amount)
        });
    } catch (error: any) {
        await connection.rollback();
        console.error("Checkout Error:", error);
        res.status(500).json({ error: error.message || 'Internal server error during checkout' });
    } finally {
        connection.release();
    }
};

export const searchPosProducts = async (req: AuthRequest, res: Response) => {
    const { q } = req.query;
    try {
        let queryStr = `
            SELECT p.product_id, p.name, p.measure_unit, p.current_stock as total_stock, p.selling_price
            FROM Products p
        `;
        let queryParams: any[] = [];

        if (q) {
            queryStr += ' WHERE p.name LIKE ? OR p.category LIKE ?';
            const likeStr = `%${q}%`;
            queryParams.push(likeStr, likeStr);
        }

        queryStr += ' LIMIT 20';

        const [products] = await pool.query<RowDataPacket[]>(queryStr, queryParams);

        // Batches have been removed

        res.status(200).json(products);
    } catch (error) {
        console.error("Search POS Products Error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getInvoiceReceipt = async (req: AuthRequest, res: Response) => {
    const invoiceId = parseInt(req.params.id as string);
    if (!invoiceId) return res.status(400).json({ error: 'Invalid invoice ID' });

    try {
        const [invoices] = await pool.query<RowDataPacket[]>(
            `SELECT i.invoice_id, i.total_amount, i.money_given, i.created_at as received_at, i.payment_method, i.status, e.name as cashier_name, i.patient_id
             FROM Sales_Invoices i
             JOIN Employee e ON i.cashier_id = e.emp_id
             WHERE i.invoice_id = ?`,
            [invoiceId]
        );

        if (invoices.length === 0) return res.status(404).json({ error: 'Invoice not found' });

        const invoice = invoices[0];

        // For completed sales, we can query Sale_Items -> Products
        const [items] = await pool.query<RowDataPacket[]>(
            `SELECT si.sale_item_id, si.quantity, si.unit_price, si.item_type, si.frequency, p.name as product_name, p.product_id
             FROM Sale_Items si
             JOIN Products p ON si.product_id = p.product_id
             WHERE si.invoice_id = ?`,
            [invoiceId]
        );

        res.status(200).json({ ...invoice, items });
    } catch (error) {
        console.error("Get Invoice Receipt Error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getSalesHistory = async (req: AuthRequest, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = (page - 1) * limit;

        const [countResult] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) as total FROM Sales_Invoices`);
        const total = countResult[0].total;

        const [sales] = await pool.query<RowDataPacket[]>(
            `SELECT i.invoice_id, i.total_amount, i.created_at, i.payment_method, i.status, e.name as cashier_name
             FROM Sales_Invoices i
             JOIN Employee e ON i.cashier_id = e.emp_id
             ORDER BY i.created_at DESC LIMIT ? OFFSET ?`,
             [limit, offset]
        );
        res.status(200).json({
            data: sales,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) {
        console.error("Error fetching sales history:", err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getPrescriptionBookHistory = async (req: AuthRequest, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = (page - 1) * limit;

        const [countResult] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) as total FROM Prescription_Book_Records`);
        const total = countResult[0].total;

        const [records] = await pool.query<RowDataPacket[]>(
            `SELECT id, patient_name, patient_age, created_at FROM Prescription_Book_Records ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [limit, offset]
        );
        
        if (records.length === 0) {
            return res.status(200).json({ data: [], total, page, totalPages: Math.ceil(total / limit) });
        }

        const recordIds = records.map(r => r.id);
        const [lines] = await pool.query<RowDataPacket[]>(
            `SELECT id, record_id, medicine_name_raw, frequency, total_amount FROM Prescription_Book_Lines WHERE record_id IN (?)`,
            [recordIds]
        );

        const linesByRecord = lines.reduce((acc: any, line: any) => {
            if (!acc[line.record_id]) acc[line.record_id] = [];
            acc[line.record_id].push(line);
            return acc;
        }, {});

        const result = records.map(r => ({
            ...r,
            lines: linesByRecord[r.id] || []
        }));

        res.status(200).json({
            data: result,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) {
        console.error("Error fetching prescription book:", err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const deleteInvoice = async (req: AuthRequest, res: Response) => {
    const invoiceId = parseInt(req.params.id as string);
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [invoices] = await connection.query<RowDataPacket[]>(
            `SELECT status FROM Sales_Invoices WHERE invoice_id = ?`, [invoiceId]
        );

        if (invoices.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Invoice not found' });
        }
        const invoice = invoices[0];

        // Only allow reverting Complete or deleting Draft
        if (invoice.status === 'Completed') {
            const [items] = await connection.query<RowDataPacket[]>(
                `SELECT product_id, quantity FROM Sale_Items WHERE invoice_id = ?`, [invoiceId]
            );

            for (const item of items) {
                await connection.query(
                    `UPDATE Products SET current_stock = current_stock + ? WHERE product_id = ?`,
                    [item.quantity, item.product_id]
                );
            }
        }

        await connection.query(`DELETE FROM Sales_Invoices WHERE invoice_id = ?`, [invoiceId]);

        const emp_id = req.user?.emp_id;
        if (emp_id) {
            await connection.query(
                `INSERT INTO Audit_Logs (emp_id, action_type, details) VALUES (?, ?, ?)`,
                [emp_id, 'DELETE_SALE', `Deleted/Voided invoice ID ${invoiceId} and restored stock`]
            );
        }

        await connection.commit();
        res.status(200).json({ message: 'Invoice deleted successfully' });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ error: 'Internal error' });
    } finally {
        connection.release();
    }
};

export const uploadPrescriptionImage = async (req: AuthRequest, res: Response) => {
    try {
        const file = (req as any).file;
        if (!file) {
            return res.status(400).json({ error: 'No image uploaded' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        const fallbackApiKey = process.env.GEMINI_FALLBACK_API_KEY;

        if (!apiKey && !fallbackApiKey) {
            return res.status(500).json({ error: 'GEMINI_API_KEY or GEMINI_FALLBACK_API_KEY not configured on server' });
        }

        const promptText = 'Extract the prescription information from this image. For frequency, strictly use one of these options if possible: OD, BID, TID, QID, Q4H, Q8H, STAT, PRN. For gels or creams, instead of "apply", use "PRN". If you cannot find a total quantity, default total_amount to 1. Return a JSON object ONLY with the following schema: { "patient_name": "string", "patient_age": number, "extracted_lines": [{ "medicine_name_raw": "string", "frequency": "string", "total_amount": number }] }';
        
        const callGemini = async (key: string) => {
            const ai = new GoogleGenAI({ apiKey: key });
            return await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { inlineData: { data: file.buffer.toString("base64"), mimeType: file.mimetype } },
                            { text: promptText }
                        ]
                    }
                ]
            });
        };

        let response;
        try {
            console.log("Starting Gemini API call with model gemini-2.5-flash");
            response = await callGemini(apiKey || fallbackApiKey || '');
            console.log("Gemini API call successful");
        } catch (error: any) {
            console.error("Primary Gemini API call failed:", error?.message || error);
            
            const is503 = (err: any) => err?.status === 503 || err?.message?.includes('503') || err?.message?.includes('Service Unavailable');
            
            if (is503(error) && fallbackApiKey && apiKey) {
                console.log("503 encountered. Attempting fallback API key...");
                try {
                    response = await callGemini(fallbackApiKey);
                    console.log("Fallback Gemini API call successful");
                } catch (fallbackError: any) {
                    console.error("Fallback Gemini API call failed:", fallbackError?.message || fallbackError);
                    
                    if (is503(fallbackError)) {
                        io.emit('ai_processing_status', { message: 'High traffic. Entering exponential backoff retries...' });
                        
                        let attempt = 0;
                        const maxRetries = 3;
                        let delay = 1000;
                        let success = false;
                        
                        while (attempt < maxRetries) {
                            attempt++;
                            console.log(`Exponential backoff attempt ${attempt} in ${delay}ms...`);
                            await new Promise(res => setTimeout(res, delay));
                            
                            try {
                                response = await callGemini(fallbackApiKey);
                                console.log(`Exponential backoff attempt ${attempt} successful`);
                                success = true;
                                break;
                            } catch (backoffError: any) {
                                console.error(`Exponential backoff attempt ${attempt} failed:`, backoffError?.message || backoffError);
                                if (attempt >= maxRetries) {
                                    throw new Error('AI service is currently unavailable after multiple retries.');
                                }
                                delay *= 2;
                            }
                        }
                        if (!success) {
                            throw new Error('AI service is currently unavailable after multiple retries.');
                        }
                    } else {
                        throw fallbackError;
                    }
                }
            } else if (fallbackApiKey && apiKey && !is503(error)) {
                console.log("Non-503 error, attempting fallback API key...");
                try {
                    response = await callGemini(fallbackApiKey);
                } catch (fallbackError: any) {
                    throw fallbackError;
                }
            } else {
                throw error;
            }
        }

        if (!response || !response.text) {
            throw new Error('Gemini API returned an empty response');
        }

        console.log("Parsing Gemini JSON response...");
        let jsonStr = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
        let extractedData;
        try {
            extractedData = JSON.parse(jsonStr);
        } catch (parseError) {
            console.error("Failed to parse Gemini response as JSON:", jsonStr);
            throw new Error("Invalid JSON response from AI");
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [rxResult] = await connection.query<ResultSetHeader>(
                `INSERT INTO Prescriptions (patient_id, status) VALUES (?, 'Pending Verification')`,
                [null]
            );
            const prescriptionId = rxResult.insertId;

            // Pre-fetch all products for fuzzy matching
            const [allProducts] = await connection.query<RowDataPacket[]>(`SELECT product_id, name, selling_price, current_stock FROM Products`);

            if (extractedData.extracted_lines && Array.isArray(extractedData.extracted_lines)) {
                for (const line of extractedData.extracted_lines) {
                    
                    // --- Basic Fuzzy Match Logic ---
                    let matchedId = null;
                    let matchedName = null;
                    let matchedPrice = null;
                    
                    if (line.medicine_name_raw) {
                        const rawStr = line.medicine_name_raw.toUpperCase().trim();
                        const rawWords = rawStr.split(' ').filter((w: string) => w.length > 2); // Ignore short words like "mg"
                        
                        let bestMatch = null;
                        for (const p of allProducts) {
                            const pName = p.name.toUpperCase();
                            // Exact substring match
                            if (pName.includes(rawStr) || rawStr.includes(pName)) {
                                bestMatch = p;
                                break;
                            }
                            // Word match (e.g. "Amoxicillin")
                            if (rawWords.length > 0 && rawWords.some((w: string) => pName.includes(w))) {
                                bestMatch = p;
                            }
                        }
                        
                        if (bestMatch) {
                            matchedId = bestMatch.product_id;
                            matchedName = bestMatch.name;
                            matchedPrice = bestMatch.selling_price;
                            
                            line.matched_product_id = matchedId;
                            line.matched_product_name = matchedName;
                            line.matched_unit_price = matchedPrice;
                        }
                    }
                    // --------------------------------

                    await connection.query(
                        `INSERT INTO Prescription_lines (prescription_id, medicine_name_raw, frequency, total_amount, matched_product_id) 
                         VALUES (?, ?, ?, ?, ?)`,
                        [prescriptionId, line.medicine_name_raw, line.frequency || '', line.total_amount || 0, matchedId]
                    );
                }
            }

            await connection.commit();

            io.emit('new_ai_scan_received', {
                prescription_id: prescriptionId,
                patient_id: null,
                patient_name: extractedData.patient_name || '',
                patient_age: extractedData.patient_age || '',
                extracted_lines: extractedData.extracted_lines
            });

            res.status(200).json({ message: "Image processed successfully", prescription_id: prescriptionId });
        } catch (dbError) {
            await connection.rollback();
            throw dbError;
        } finally {
            connection.release();
        }

    } catch (error: any) {
        console.error("========== Upload Prescription Error ==========");
        console.error(error);
        console.error("Stack:", error?.stack);
        console.error("===============================================");
        res.status(500).json({ error: error.message || 'Failed to process image' });
    }
};

export const uploadMobilePrescription = async (req: AuthRequest, res: Response) => {
    try {
        const file = (req as any).file;
        if (!file) {
            return res.status(400).json({ error: 'No image uploaded' });
        }

        const base64Image = file.buffer.toString('base64');
        const mimeType = file.mimetype;
        const dataUrl = `data:${mimeType};base64,${base64Image}`;

        io.emit('new_prescription_photo', {
            photo_url: dataUrl
        });

        res.status(200).json({ message: "Photo uploaded and sent to web app successfully" });
    } catch (error: any) {
        console.error("Upload Mobile Prescription Error:", error);
        res.status(500).json({ error: error.message || 'Failed to process mobile image upload' });
    }
};

