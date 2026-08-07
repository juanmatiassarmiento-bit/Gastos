import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Papa from 'papaparse';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [cards, setCards] = useState([]);
  const [selectedCardId, setSelectedCardId] = useState('all');
  const [expenses, setExpenses] = useState([]);

  // Formulario nueva tarjeta
  const [newCardHolder, setNewCardHolder] = useState('');
  const [newCardDigits, setNewCardDigits] = useState('');
  const [newCardBrand, setNewCardBrand] = useState('Visa');

  // Formulario nuevo gasto manual
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('General');
  const [manualCardId, setManualCardId] = useState('');

  const [importing, setImporting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchCards();
      fetchExpenses();
    }
  }, [session]);

  const handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert(error.message);
    else alert('Revisa tu correo para confirmar la cuenta.');
  };

  const handleLogout = () => supabase.auth.signOut();

  const fetchCards = async () => {
    const { data, error } = await supabase.from('cards').select('*');
    if (!error && data) {
      setCards(data);
      if (data.length > 0 && !manualCardId) {
        setManualCardId(data[0].id);
      }
    }
  };

  const fetchExpenses = async () => {
    const { data, error } = await supabase.from('expenses').select('*').order('created_at', { ascending: false });
    if (!error && data) setExpenses(data);
  };

  const handleAddCard = async (e) => {
    e.preventDefault();
    if (!newCardHolder || !newCardDigits) return alert('Completa los campos de la tarjeta');
    const { data, error } = await supabase.from('cards').insert([
      { holder: newCardHolder, last_digits: newCardDigits, brand: newCardBrand, user_id: session.user.id }
    ]).select();

    if (!error && data) {
      setCards([...cards, ...data]);
      setNewCardHolder('');
      setNewCardDigits('');
    } else {
      alert(error?.message || 'Error al agregar tarjeta');
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!description || !amount || !manualCardId) return alert('Completa los datos del gasto');
    const { data, error } = await supabase.from('expenses').insert([
      { description, amount: parseFloat(amount), category, card_id: manualCardId, user_id: session.user.id }
    ]).select();

    if (!error && data) {
      setExpenses([data[0], ...expenses]);
      setDescription('');
      setAmount('');
    } else {
      alert(error?.message || 'Error al guardar gasto');
    }
  };

  const handleDeleteExpense = async (id) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (!error) {
      setExpenses(expenses.filter(e => e.id !== id));
    }
  };

  // --- PARSER MEJORADO PARA CSV DE MERCADO PAGO Y BANCOS ---
  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (selectedCardId === 'all') {
      alert('Por favor selecciona una tarjeta específica antes de importar el CSV.');
      return;
    }

    setImporting(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: async (results) => {
        const rows = results.data;
        
        const newExpenses = rows.map(row => {
          // Normalizar llaves para ignorar mayúsculas/minúsculas
          const keys = Object.keys(row);
          const getVal = (...possibleKeys) => {
            for (const k of possibleKeys) {
              const found = keys.find(key => key.trim().toLowerCase() === k.toLowerCase());
              if (found && row[found] !== undefined && row[found] !== null) {
                return String(row[found]).trim();
              }
            }
            return '';
          };

          const rawDesc = getVal('description', 'descripción', 'descripcion', 'concepto', 'titulo', 'title', 'detail', 'external_reference', 'reason', 'motivo');
          const rawAmount = getVal('transaction_amount', 'amount', 'monto', 'importe', 'total', 'valor', 'net_amount');
          const rawCategory = getVal('category', 'categoría', 'categoria', 'type', 'tipo') || 'General';

          // Limpiar número (reemplazar separadores de miles y comas decimales)
          let cleanAmountStr = rawAmount.replace(/\$/g, '').replace(/\s/g, '');
          if (cleanAmountStr.includes(',') && cleanAmountStr.includes('.')) {
            cleanAmountStr = cleanAmountStr.replace(/\./g, '').replace(',', '.');
          } else if (cleanAmountStr.includes(',')) {
            cleanAmountStr = cleanAmountStr.replace(',', '.');
          }

          let valAmount = parseFloat(cleanAmountStr);

          // Si el monto es negativo (ej -500), convertir a positivo para registrar el gasto
          if (!isNaN(valAmount)) {
            valAmount = Math.abs(valAmount);
          }

          return {
            description: rawDesc || 'Gasto importado',
            amount: isNaN(valAmount) ? 0 : valAmount,
            category: rawCategory,
            card_id: selectedCardId,
            user_id: session.user.id
          };
        }).filter(item => item.amount > 0);

        if (newExpenses.length === 0) {
          alert('No se encontraron registros de gastos válidos en el archivo CSV.');
          setImporting(false);
          return;
        }

        const { data, error } = await supabase.from('expenses').insert(newExpenses).select();
        setImporting(false);

        if (!error && data) {
          setExpenses([...data, ...expenses]);
          alert(`¡Éxito! Se importaron ${data.length} movimientos correctamente.`);
        } else {
          alert('Error al guardar en la base de datos: ' + (error?.message || 'Error desconocido'));
        }
      },
      error: (err) => {
        setImporting(false);
        alert('Error al leer el archivo CSV: ' + err.message);
      }
    });
  };

  const filteredExpenses = selectedCardId === 'all'
    ? expenses
    : expenses.filter(e => e.card_id === selectedCardId);

  const totalSpent = filteredExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  if (loading) return <div style={{ padding: 20 }}>Cargando...</div>;

  if (!session) {
    return (
      <div style={{ maxWidth: 400, margin: '50px auto', padding: 20, border: '1px solid #ccc', borderRadius: 8 }}>
        <h2>Control de Gastos - Iniciar Sesión</h2>
        <form onSubmit={handleLogin}>
          <input type="email" placeholder="Correo" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%', marginBottom: 10, padding: 8 }} />
          <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', marginBottom: 10, padding: 8 }} />
          <button type="submit" style={{ width: '100%', padding: 10, marginBottom: 10, cursor: 'pointer' }}>Ingresar</button>
          <button type="button" onClick={handleSignUp} style={{ width: '100%', padding: 10, cursor: 'pointer' }}>Registrarse</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '20px auto', padding: 20, fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1>Control de Gastos</h1>
        <button onClick={handleLogout} style={{ padding: '8px 16px', cursor: 'pointer' }}>Cerrar Sesión</button>
      </div>

      {/* SELECCIONAR TARJETA E IMPORTAR */}
      <section style={{ background: '#eef2f5', padding: 15, borderRadius: 8, marginBottom: 20 }}>
        <h3>Visualizando datos de:</h3>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 15 }}>
          <select value={selectedCardId} onChange={e => setSelectedCardId(e.target.value)} style={{ padding: 8, fontSize: 16 }}>
            <option value="all">Todas las tarjetas</option>
            {cards.map(c => (
              <option key={c.id} value={c.id}>{c.brand} **** {c.last_digits} ({c.holder})</option>
            ))}
          </select>
        </div>

        <div style={{ borderTop: '1px solid #ccc', paddingTop: 15 }}>
          <h4>📄 Cargar Historial (.CSV)</h4>
          <p style={{ fontSize: 13, color: '#555', marginTop: 0 }}>
            Descarga la actividad de Mercado Pago o tu banco en formato CSV y súbela para importar los movimientos a la tarjeta seleccionada.
          </p>
          <label style={{ background: importing ? '#888' : '#0070f3', color: '#fff', padding: '10px 18px', borderRadius: 6, cursor: importing ? 'not-allowed' : 'pointer', display: 'inline-block' }}>
            {importing ? 'Procesando...' : '⬆️ Seleccionar archivo .CSV'}
            <input type="file" accept=".csv" onChange={handleImportCSV} disabled={importing} style={{ display: 'none' }} />
          </label>
        </div>
      </section>

      {/* METRICAS */}
      <section style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, background: '#f0f4ff', padding: 15, borderRadius: 8 }}>
          <span style={{ fontSize: 13, color: '#555' }}>Total gastado</span>
          <h2 style={{ color: '#2b4360', margin: '5px 0 0 0', fontSize: 28 }}>${totalSpent.toFixed(2)}</h2>
        </div>
      </section>

      {/* AGREGAR NUEVA TARJETA */}
      <section style={{ background: '#f9f9f9', padding: 15, borderRadius: 8, marginBottom: 20 }}>
        <h3>Agregar Nueva Tarjeta</h3>
        <form onSubmit={handleAddCard} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input type="text" placeholder="Titular de la tarjeta" value={newCardHolder} onChange={e => setNewCardHolder(e.target.value)} style={{ padding: 8, flex: 1 }} />
          <input type="text" placeholder="Número o últimos 4 dígitos" maxLength={4} value={newCardDigits} onChange={e => setNewCardDigits(e.target.value)} style={{ padding: 8, width: 120 }} />
          <select value={newCardBrand} onChange={e => setNewCardBrand(e.target.value)} style={{ padding: 8 }}>
            <option value="Visa">Visa</option>
            <option value="Mastercard">Mastercard</option>
            <option value="Mercado Pago">Mercado Pago</option>
            <option value="Otra">Otra</option>
          </select>
          <button type="submit" style={{ padding: '8px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Guardar Tarjeta</button>
        </form>
      </section>

      {/* GASTO MANUAL */}
      <section style={{ background: '#f9f9f9', padding: 15, borderRadius: 8, marginBottom: 20 }}>
        <h3>Cargar Gasto Manual</h3>
        <form onSubmit={handleAddExpense} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input type="text" placeholder="Descripción" value={description} onChange={e => setDescription(e.target.value)} style={{ padding: 8, flex: 1 }} />
          <input type="number" step="0.01" placeholder="Monto ($)" value={amount} onChange={e => setAmount(e.target.value)} style={{ padding: 8, width: 100 }} />
          <select value={category} onChange={e => setCategory(e.target.value)} style={{ padding: 8 }}>
            <option value="General">General</option>
            <option value="Comida">Comida</option>
            <option value="Servicios">Servicios</option>
            <option value="Entretenimiento">Entretenimiento</option>
          </select>
          <select value={manualCardId} onChange={e => setManualCardId(e.target.value)} style={{ padding: 8 }}>
            {cards.map(c => (
              <option key={c.id} value={c.id}>{c.brand} **** {c.last_digits}</option>
            ))}
          </select>
          <button type="submit" style={{ padding: '8px 16px', background: '#28a745', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>+ Cargar Gasto</button>
        </form>
      </section>

      {/* TABLA DE HISTORIAL */}
      <section>
        <h3>Historial de Movimientos</h3>
        {filteredExpenses.length === 0 ? (
          <p style={{ color: '#666' }}>No hay gastos registrados en esta tarjeta.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
            <thead>
              <tr style={{ background: '#ddd', textAlign: 'left' }}>
                <th style={{ padding: 10 }}>Descripción</th>
                <th style={{ padding: 10 }}>Monto</th>
                <th style={{ padding: 10 }}>Categoría</th>
                <th style={{ padding: 10 }}>Tarjeta</th>
                <th style={{ padding: 10 }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map(exp => {
                const card = cards.find(c => c.id === exp.card_id);
                return (
                  <tr key={exp.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: 10 }}>{exp.description}</td>
                    <td style={{ padding: 10, fontWeight: 'bold' }}>${exp.amount.toFixed(2)}</td>
                    <td style={{ padding: 10 }}>{exp.category}</td>
                    <td style={{ padding: 10 }}>{card ? `${card.brand} (**** ${card.last_digits})` : 'N/A'}</td>
                    <td style={{ padding: 10 }}>
                      <button onClick={() => handleDeleteExpense(exp.id)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>Eliminar</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}