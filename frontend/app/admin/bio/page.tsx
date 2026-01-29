'use client';
import { useState } from 'react';
import { apiFetch } from '../../../lib/api';

export default function BioAdmin() {
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [kind, setKind] = useState('reservar');
  const [message, setMessage] = useState('');

  const saveButton = async () => {
    try {
      await apiFetch('/api/studios/linkbutton/', { method: 'POST', body: JSON.stringify({ label, url, kind, position: 1 }) });
      setMessage('Botón guardado');
      setLabel('');
      setUrl('');
    } catch (err: any) {
      setMessage('Error: ' + err.message);
    }
  };

  return (
    <main className="card space-y-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold">Bio-Link</h1>
      <input className="w-full rounded-xl border border-primary/40 px-3 py-2 text-base" placeholder="Etiqueta" value={label} onChange={(e) => setLabel(e.target.value)} />
      <input className="w-full rounded-xl border border-primary/40 px-3 py-2 text-base" placeholder="URL" value={url} onChange={(e) => setUrl(e.target.value)} />
      <select className="w-full rounded-xl border border-primary/40 px-3 py-2 text-base" value={kind} onChange={(e) => setKind(e.target.value)}>
        <option value="reservar">Reservar</option>
        <option value="comprar">Comprar</option>
        <option value="whatsapp">WhatsApp</option>
        <option value="instagram">Instagram</option>
        <option value="ubicacion">Ubicación</option>
        <option value="sitio">Sitio</option>
        <option value="custom">Custom</option>
      </select>
      <button className="btn w-full sm:w-auto" onClick={saveButton}>Guardar</button>
      {message && <p className="text-sm text-slate-700">{message}</p>}
    </main>
  );
}