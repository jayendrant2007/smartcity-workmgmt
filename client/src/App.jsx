import { useState, useEffect } from 'react';

export default function App() {
  return (
    <div style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <h1>SMART CITY TECHNOLOGIES PTE LTD</h1>
      <p>Work Management: Card Access, CCTV, Intercom, Biometrics, ANPR, Barrier systems, others</p>
      <Tabs />
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

// keep your ClientSubmit, AdminConsole, TechnicianConsole, Form, SmallForm here
