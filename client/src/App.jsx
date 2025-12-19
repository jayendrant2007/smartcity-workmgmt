import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './AppContent.jsx'; // or wherever your main component is

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function App() {
  return (
    <div style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <h1>SMART CITY TECHNOLOGIES PTE LTD</h1>
      <p>Work Management: Card Access, CCTV, Intercom, Biometrics, ANPR, Barrier systems, others</p>
      {/* Jay*/}
    </div>
  );
}


function Tabs() {
  const [tab, setTab] = useState('new');
  const tabs = [
    { key: 'new', label: 'Submit Work Order' },
    { key: 'admin', label: 'Admin Console' },
    { key: 'tech', label: 'Technician' }
  ];
  return (
    <>
      <div style={{ marginBottom: 12 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ marginRight: 8 }}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'new' && <ClientSubmit />}
      {tab === 'admin' && <AdminConsole />}
      {tab === 'tech' && <TechnicianConsole />}
    </>
  );
}

function ClientSubmit() {
  const [form, setForm] = useState({
    client_name: '', client_email: '', client_phone: '',
    title: '', description: '', job_scope: 'CCTV systems',
    site_address: '', preferred_date: ''
  });
  const submit = async () => {
    const res = await fetch(`${API}/work-orders`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(form) });
    const data = await res.json();
    alert(`Work order submitted: WO-${data.id}`);
  };
  return (
    <div>
      <h2>Submit Work Order</h2>
      <Form form={form} setForm={setForm} />
      <button onClick={submit}>Submit</button>
    </div>
  );
}

function AdminConsole() {
  const [orders, setOrders] = useState([]);
  const load = async () => setOrders(await (await fetch(`${API}/work-orders`)).json());
  useEffect(() => { load(); }, []);

  const assign = async (id) => {
    const technician_name = prompt('Technician name?');
    const scheduled_date = prompt('Scheduled date (YYYY-MM-DD)?');
    await fetch(`${API}/work-orders/${id}`, {
      method: 'PATCH',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ technician_name, scheduled_date, status: 'assigned' })
    });
    load();
  };

  const approveReport = async () => {
    const srId = prompt('Service Report ID to approve?');
    const res = await fetch(`${API}/service-reports/${srId}/approve`, { method: 'POST' });
    const data = await res.json();
    alert(`Invoice created: ${data.invoice_number}, total: ${data.total}`);
  };

  return (
    <div>
      <h2>Admin Console</h2>
      <button onClick={load}>Refresh</button>
      <table border="1" cellPadding="6" style={{ marginTop: 8 }}>
        <thead><tr><th>ID</th><th>Client</th><th>Title</th><th>Scope</th><th>Status</th><th>Technician</th><th>Scheduled</th><th>Actions</th></tr></thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.id}>
              <td>{o.id}</td><td>{o.client_name}</td><td>{o.title}</td><td>{o.job_scope}</td>
              <td>{o.status}</td><td>{o.technician_name || '-'}</td><td>{o.scheduled_date || '-'}</td>
              <td><button onClick={() => assign(o.id)}>Assign</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 12 }}>
        <button onClick={approveReport}>Approve Service Report → Invoice</button>
      </div>
    </div>
  );
}

function TechnicianConsole() {
  const [report, setReport] = useState({
    work_order_id: '', technician_name: '',
    start_time: '', end_time: '', labor_hours: 0,
    findings: '', actions_taken: '', recommendations: '',
    materials: [], client_signoff_name: '', client_signoff_time: ''
  });

  const addMaterial = () => {
    const name = prompt('Material name?');
    const qty = parseFloat(prompt('Qty?'));
    const unitPrice = parseFloat(prompt('Unit price?'));
    setReport(r => ({ ...r, materials: [...r.materials, { name, qty, unitPrice }] }));
  };

  const submit = async () => {
    const res = await fetch(`${API}/service-reports`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(report)
    });
    const data = await res.json();
    alert(`Service report submitted: SR-${data.id}`);
  };

  return (
    <div>
      <h2>Technician Report</h2>
      <SmallForm report={report} setReport={setReport} />
      <button onClick={addMaterial}>Add Material</button>
      <button onClick={submit} style={{ marginLeft: 8 }}>Submit Report</button>
    </div>
  );
}

function Form({ form, setForm }) {
  const set = (k, v) => setForm({ ...form, [k]: v });
  const fields = {
    client_name: 'Client Name', client_email: 'Client Email', client_phone: 'Client Phone',
    title: 'Title', description: 'Description', job_scope: 'Job Scope',
    site_address: 'Site Address', preferred_date: 'Preferred Date (YYYY-MM-DD)'
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {Object.entries(fields).map(([k,label]) => (
        <label key={k}>{label}<br/><input value={form[k]} onChange={e => set(k, e.target.value)} /></label>
      ))}
    </div>
  );
}

function SmallForm({ report, setReport }) {
  const set = (k, v) => setReport({ ...report, [k]: v });
  const fields = {
    work_order_id: 'Work Order ID', technician_name: 'Technician Name',
    start_time: 'Start Time (YYYY-MM-DD HH:mm)', end_time: 'End Time', labor_hours: 'Labor Hours',
    findings: 'Findings', actions_taken: 'Actions Taken', recommendations: 'Recommendations',
    client_signoff_name: 'Client Sign-off Name', client_signoff_time: 'Sign-off Time'
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {Object.entries(fields).map(([k,label]) => (
        <label key={k}>{label}<br/><input value={report[k]} onChange={e => set(k, e.target.value)} /></label>
      ))}
    </div>
  );
}
