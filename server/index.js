import express from 'express';
import cors from 'cors';
import pg from 'pg';
import { COMPANY } from './company.js';

const app = express();
app.use(cors());
app.use(express.json());

const GST_RATE = Number(process.env.GST_RATE || 9);
const LABOR_RATE = Number(process.env.LABOR_RATE || 80);

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function init() {
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS work_orders (
      id SERIAL PRIMARY KEY,
      client_name TEXT, client_email TEXT, client_phone TEXT,
      title TEXT, description TEXT, job_scope TEXT,
      site_address TEXT, preferred_date DATE,
      status TEXT DEFAULT 'new',
      scheduled_date DATE, technician_name TEXT
    );
    CREATE TABLE IF NOT EXISTS service_reports (
      id SERIAL PRIMARY KEY,
      work_order_id INTEGER REFERENCES work_orders(id),
      technician_name TEXT,
      start_time TIMESTAMP, end_time TIMESTAMP, labor_hours REAL,
      findings TEXT, actions_taken TEXT, recommendations TEXT,
      materials_json TEXT,
      client_signoff_name TEXT, client_signoff_time TIMESTAMP,
      admin_status TEXT DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      service_report_id INTEGER REFERENCES service_reports(id),
      invoice_number TEXT, issue_date DATE, due_date DATE,
      line_items_json TEXT, subtotal REAL, tax_rate REAL, tax_amount REAL, total REAL,
      status TEXT DEFAULT 'draft'
    );
  `);
}
init();

// Helpers
const qAll = async (sql, params=[]) => (await client.query(sql, params)).rows;
const qOne = async (sql, params=[]) => (await client.query(sql, params)).rows[0];

// Health
app.get('/', (req, res) => res.json({ ok: true, company: COMPANY }));

// Create work order (client)
app.post('/work-orders', async (req, res) => {
  const {
    client_name, client_email, client_phone,
    title, description, job_scope, site_address, preferred_date
  } = req.body;
  const row = await qOne(
    `INSERT INTO work_orders (client_name, client_email, client_phone, title, description, job_scope, site_address, preferred_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [client_name, client_email, client_phone, title, description, job_scope, site_address, preferred_date]
  );
  res.json(row);
});

// List work orders
app.get('/work-orders', async (req, res) => {
  res.json(await qAll(`SELECT * FROM work_orders ORDER BY id DESC`));
});

// Assign technician & schedule (admin)
app.patch('/work-orders/:id', async (req, res) => {
  const { technician_name, scheduled_date, status } = req.body;
  await client.query(
    `UPDATE work_orders SET
      technician_name = COALESCE($1, technician_name),
      scheduled_date = COALESCE($2, scheduled_date),
      status = COALESCE($3, status)
     WHERE id = $4`,
    [technician_name, scheduled_date, status, req.params.id]
  );
  res.json(await qOne(`SELECT * FROM work_orders WHERE id = $1`, [req.params.id]));
});

// Create service report (technician)
app.post('/service-reports', async (req, res) => {
  const {
    work_order_id, technician_name, start_time, end_time, labor_hours,
    findings, actions_taken, recommendations, materials,
    client_signoff_name, client_signoff_time
  } = req.body;

  const row = await qOne(
    `INSERT INTO service_reports (
      work_order_id, technician_name, start_time, end_time, labor_hours,
      findings, actions_taken, recommendations, materials_json,
      client_signoff_name, client_signoff_time
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      work_order_id, technician_name, start_time, end_time, labor_hours,
      findings, actions_taken, recommendations, JSON.stringify(materials || []),
      client_signoff_name, client_signoff_time
    ]
  );
  res.json(row);
});

// Approve report → create invoice (admin)
app.post('/service-reports/:id/approve', async (req, res) => {
  const report = await qOne(`SELECT * FROM service_reports WHERE id = $1`, [req.params.id]);
  if (!report) return res.status(404).json({ error: 'Service report not found' });

  await client.query(`UPDATE service_reports SET admin_status = 'approved' WHERE id = $1`, [req.params.id]);

  const materials = JSON.parse(report.materials_json || '[]');
  const laborAmount = parseFloat(report.labor_hours || 0) * LABOR_RATE;
  const lineItems = [
    { description: 'Labor charges', qty: report.labor_hours, unitPrice: LABOR_RATE, amount: laborAmount },
    ...materials.map(m => ({ description: m.name, qty: m.qty, unitPrice: m.unitPrice, amount: m.qty * m.unitPrice }))
  ];
  const subtotal = lineItems.reduce((s, li) => s + Number(li.amount || 0), 0);
  const taxAmount = Number((subtotal * (GST_RATE / 100)).toFixed(2));
  const total = Number((subtotal + taxAmount).toFixed(2));
  const invoiceNumber = `INV-${Date.now()}`;

  const inv = await qOne(
    `INSERT INTO invoices (service_report_id, invoice_number, issue_date, due_date, line_items_json, subtotal, tax_rate, tax_amount, total, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [report.id, invoiceNumber, new Date().toISOString().slice(0,10), null, JSON.stringify(lineItems), subtotal, GST_RATE, taxAmount, total, 'draft']
  );

  res.json({ invoice_id: inv.id, invoice_number: inv.invoice_number, total });
});

// Get invoice
app.get('/invoices/:id', async (req, res) => {
  const inv = await qOne(`SELECT * FROM invoices WHERE id = $1`, [req.params.id]);
  if (!inv) return res.status(404).json({ error: 'Not found' });
  res.json({ ...inv, line_items: JSON.parse(inv.line_items_json || '[]'), company: COMPANY });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API running on :${port}`));
