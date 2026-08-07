import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Papa from 'papaparse';

// Lectura de variables compatibles con Vite y Create React App
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || process.env?.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || process.env?.REACT_APP_SUPABASE_ANON_KEY || '';

const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

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
    supabase.auth.getSession().then(({ data }) => {
      setSession(data?.session || null);
      setLoading(false);
    }).catch(() => setLoading(false));

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    if (session) {
      fetchCards();
      fetchExpenses();
    }
  }, [session]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
      alert('Error de configuración: Asegúrate de configurar las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en Vercel.');
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
      alert('Error de configuración: Faltan las variables de entorno de Supabase.');
      return;
    }
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert(error.message);
    else alert('Revisa tu correo para confirmar la cuenta.');
  };

  const handleLogout = () => supabase.auth.signOut();

  const fetchCards = async () => {
    const { data, error } = await supabase.from('cards').select('*');
    if (!error && data) {
      setCards(data);
      if (data.length > 0 && !manualCardId) setManualCardId(data[0].id);
    }
  };

  const fetchExpenses = async () => {
    const { data, error } = await supabase.from('expenses').select('*').order('created_at', { ascending: false });
    if (!error && data) setExpenses(data);
  };

  const handleAddCard = async (e) => {
    e.preventDefault();
    if (!newCardHolder || !newCardDigits) return alert('Completa los datos de la tarjeta.');
    const { data, error } = await supabase.from('cards').insert([
      { holder: newCardHolder, last_digits: newCardDigits, brand: newCardBrand, user_id: session?.user?.id }
    ]).select();

    if (!error && data) {
      setCards([...cards, ...data]);
      setNewCardHolder('');
      setNewCardDigits('');
      if (!manualCardId) setManualCardId(data[0].id);
    } else {
      alert(error?.message || 'Error al agregar tarjeta.');
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!description || !amount || !manualCardId) return alert('Completa los datos del gasto.');
    const { data, error } = await supabase.from('expenses').insert([
      { description, amount: parseFloat(amount), category, card_id: manualCardId, user_id: session?.user?.id }
    ]).select();

    if (!error && data) {
      setExpenses([data[0], ...expenses]);
      setDescription('');
      setAmount('');
    } else {
      alert(error?.message || 'Error al guardar gasto.');
    }
  };

  const handleDeleteExpense = async (id) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (!error) {
      setExpenses(expenses.filter(e => e.id !== id));
    }
  };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (selectedCardId === 'all') {
      alert('Selecciona una tarjeta específica en el menú superior antes de importar el reporte CSV.');
      return;
    }

    setImporting(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data || [];
        
        const newExpenses = rows.map(row => {
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

          const rawDesc = getVal('description', 'descripción', 'descripcion', 'concepto', 'titulo', 'title', 'detail', 'external_reference', 'reason');
          const rawAmount = getVal('transaction_amount', 'amount', 'monto', 'importe', 'total', 'valor', 'net_amount');
          const rawCategory = getVal('category', 'categoría', 'categoria', 'type', 'tipo') || 'General';

          let cleanAmountStr = rawAmount.replace(/\$/g, '').replace(/\s/g, '');
          if (cleanAmountStr.includes(',') && cleanAmountStr.includes('.')) {
            cleanAmountStr = cleanAmountStr.replace(/\./g, '').replace(',', '.');
          } else if (cleanAmountStr.includes(',')) {
            cleanAmountStr = cleanAmountStr.replace(',', '.');
          }

          let valAmount = parseFloat(cleanAmountStr);
          if (!isNaN(valAmount)) {
            valAmount = Math.abs(valAmount);
          }

          return {
            description: rawDesc || 'Gasto importado',
            amount: isNaN(valAmount) ? 0 : valAmount,
            category: rawCategory,
            card_id: selectedCardId,
            user_id: session?.user?.id
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
          alert(`¡Éxito! Se importaron ${data.length} movimientos.`);
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

  const totalSpent = filteredExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  const categoryTotals = filteredExpenses.reduce((acc, curr) => {
    const cat = curr.category || 'General';
    acc[cat] = (acc[cat] || 0) + (Number(curr.amount) || 0);
    return acc;
  }, {});

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#090d16', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', fontSize: 18 }}>
        Cargando sistema de gastos...
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ minHeight: '100vh', background: '#090d16', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 420, background: '#111827', border: '1px solid #1f2937', borderRadius: 16, padding: 32, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ width: 56, height: 56, background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', borderRadius: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 14, boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.4)' }}>💳</div>
            <h2 style={{ margin: 0, color: '#ffffff', fontSize: 24, fontWeight: 700 }}>Control de Gastos</h2>
            <p style={{ color: '#9ca3af', fontSize: 14, marginTop: 6 }}>Gestión integral de tarjetas y finanzas</p>
          </div>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: '#d1d5db', fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>Correo Electrónico</label>
              <input type="email" placeholder="ejemplo@correo.com" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%', padding: '12px 16px', background: '#090d16', border: '1px solid #374151', borderRadius: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ color: '#d1d5db', fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>Contraseña</label>
              <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '12px 16px', background: '#090d16', border: '1px solid #374151', borderRadius: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
            </div>
            <button type="submit" style={{ width: '100%', padding: 13, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer', marginBottom: 12, fontSize: 15, transition: 'all 0.2s' }}>Iniciar Sesión</button>
            <button type="button" onClick={handleSignUp} style={{ width: '100%', padding: 13, background: 'transparent', color: '#9ca3af', border: '1px solid #374151', borderRadius: 10, cursor: 'pointer', fontSize: 14 }}>Registrarse</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#090d16', color: '#f3f4f6', fontFamily: 'sans-serif', padding: '30px 20px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        
        {/* HEADER SUPERIOR */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 24, borderBottom: '1px solid #1f2937', marginBottom: 30 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 'bold' }}>$</div>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#fff' }}>Control de Gastos</h1>
              <span style={{ fontSize: 13, color: '#9ca3af' }}>Panel de administración financiera</span>
            </div>
          </div>
          <button onClick={handleLogout} style={{ background: '#111827', color: '#9ca3af', border: '1px solid #374151', padding: '10px 18px', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>Cerrar Sesión</button>
        </header>

        {/* TARJETAS REGISTRADAS (VISUAL DE CREDIT CARDS) */}
        <section style={{ marginBottom: 30 }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 18, color: '#fff' }}>Mis Tarjetas</h3>
          {cards.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 14 }}>No tienes tarjetas registradas. Agrega una abajo.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
              {cards.map(c => (
                <div key={c.id} style={{ background: c.brand === 'Mercado Pago' ? 'linear-gradient(135deg, #009ee3 0%, #0072bb 100%)' : c.brand === 'Mastercard' ? 'linear-gradient(135deg, #eb001b 0%, #f79e1b 100%)' : 'linear-gradient(135deg, #1a1f71 0%, #0055b8 100%)', borderRadius: 16, padding: 20, position: 'relative', boxShadow: '0 10px 20px -5px rgba(0,0,0,0.5)', border: selectedCardId === c.id ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer' }} onClick={() => setSelectedCardId(c.id)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#fff' }}>{c.brand}</span>
                    <span style={{ fontSize: 12, background: 'rgba(255,255,255,0.2)', padding: '3px 8px', borderRadius: 6, color: '#fff' }}>**** {c.last_digits}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Titular</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginTop: 2 }}>{c.holder}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* PANEL DE SELECCIÓN E IMPORTACIÓN CSV */}
        <section style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 16, padding: 24, marginBottom: 30 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
            <div>
              <span style={{ fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>Filtrar movimientos por tarjeta:</span>
              <div style={{ marginTop: 8 }}>
                <select value={selectedCardId} onChange={e => setSelectedCardId(e.target.value)} style={{ background: '#090d16', color: '#fff', border: '1px solid #374151', padding: '12px 16px', borderRadius: 10, fontSize: 15, outline: 'none', cursor: 'pointer', minWidth: 240 }}>
                  <option value="all">💳 Todas las tarjetas</option>
                  {cards.map(c => (
                    <option key={c.id} value={c.id}>{c.brand} **** {c.last_digits} ({c.holder})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #1f2937', paddingTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h4 style={{ margin: 0, color: '#818cf8', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>📄 Cargar Reporte de Gastos (.CSV)</h4>
              <p style={{ margin: '6px 0 0 0', fontSize: 13, color: '#9ca3af' }}>Importa automáticamente tus movimientos desde el archivo CSV de Mercado Pago o tu homebanking.</p>
            </div>
            <label style={{ background: importing ? '#4b5563' : '#6366f1', color: '#fff', padding: '12px 22px', borderRadius: 10, fontWeight: 600, cursor: importing ? 'not-allowed' : 'pointer', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'all 0.2s' }}>
              {importing ? 'Procesando archivo...' : '⬆️ Seleccionar archivo CSV'}
              <input type="file" accept=".csv" onChange={handleImportCSV} disabled={importing} style={{ display: 'none' }} />
            </label>
          </div>
        </section>

        {/* MÉTRICAS / RESUMEN FINANCIERO */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 30 }}>
          <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 16, padding: 24 }}>
            <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>Total acumulado en gastos</span>
            <h2 style={{ color: '#818cf8', margin: '12px 0 0 0', fontSize: 36, fontWeight: 700 }}>${totalSpent.toFixed(2)}</h2>
          </div>

          <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 16, padding: 24 }}>
            <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>Desglose por Categoría</span>
            <div style={{ marginTop: 12, maxHeight: 100, overflowY: 'auto' }}>
              {Object.keys(categoryTotals).length === 0 ? (
                <span style={{ fontSize: 13, color: '#6b7280' }}>Sin movimientos cargados</span>
              ) : (
                Object.entries(categoryTotals).map(([cat, val]) => (
                  <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
                    <span style={{ color: '#d1d5db' }}>{cat}</span>
                    <span style={{ color: '#fff', fontWeight: 600 }}>${val.toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* FORMULARIOS PARA AÑADIR TARJETA Y GASTO MANUAL */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 30 }}>
          <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 16, padding: 24 }}>
            <h3 style={{ margin: '0 0 18px 0', fontSize: 17, color: '#fff' }}>Agregar Nueva Tarjeta</h3>
            <form onSubmit={handleAddCard} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input type="text" placeholder="Nombre del titular" value={newCardHolder} onChange={e => setNewCardHolder(e.target.value)} style={{ padding: 12, background: '#090d16', border: '1px solid #374151', borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none' }} />
              <div style={{ display: 'flex', gap: 12 }}>
                <input type="text" placeholder="Últimos 4 dígitos" maxLength={4} value={newCardDigits} onChange={e => setNewCardDigits(e.target.value)} style={{ padding: 12, background: '#090d16', border: '1px solid #374151', borderRadius: 8, color: '#fff', fontSize: 14, flex: 1, outline: 'none' }} />
                <select value={newCardBrand} onChange={e => setNewCardBrand(e.target.value)} style={{ padding: 12, background: '#090d16', border: '1px solid #374151', borderRadius: 8, color: '#fff', fontSize: 14, flex: 1, outline: 'none' }}>
                  <option value="Visa">Visa</option>
                  <option value="Mastercard">Mastercard</option>
                  <option value="Mercado Pago">Mercado Pago</option>
                </select>
              </div>
              <button type="submit" style={{ padding: 12, background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>+ Registrar Tarjeta</button>
            </form>
          </div>

          <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 16, padding: 24 }}>
            <h3 style={{ margin: '0 0 18px 0', fontSize: 17, color: '#fff' }}>Cargar Gasto Manual</h3>
            <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <input type="text" placeholder="Descripción del gasto" value={description} onChange={e => setDescription(e.target.value)} style={{ padding: 12, background: '#090d16', border: '1px solid #374151', borderRadius: 8, color: '#fff', fontSize: 14, flex: 2, outline: 'none' }} />
                <input type="number" step="0.01" placeholder="Monto" value={amount} onChange={e => setAmount(e.target.value)} style={{ padding: 12, background: '#090d16', border: '1px solid #374151', borderRadius: 8, color: '#fff', fontSize: 14, flex: 1, outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <select value={category} onChange={e => setCategory(e.target.value)} style={{ padding: 12, background: '#090d16', border: '1px solid #374151', borderRadius: 8, color: '#fff', fontSize: 14, flex: 1, outline: 'none' }}>
                  <option value="General">General</option>
                  <option value="Comida">Comida</option>
                  <option value="Servicios">Servicios</option>
                  <option value="Entretenimiento">Entretenimiento</option>
                </select>
                <select value={manualCardId} onChange={e => setManualCardId(e.target.value)} style={{ padding: 12, background: '#090d16', border: '1px solid #374151', borderRadius: 8, color: '#fff', fontSize: 14, flex: 1, outline: 'none' }}>
                  {cards.map(c => (
                    <option key={c.id} value={c.id}>{c.brand} **** {c.last_digits}</option>
                  ))}
                </select>
              </div>
              <button type="submit" style={{ padding: 12, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>+ Guardar Gasto</button>
            </form>
          </div>
        </section>

        {/* TABLA HISTORIAL DE MOVIMIENTOS */}
        <section style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 16, padding: 24 }}>
          <h3 style={{ margin: '0 0 18px 0', fontSize: 18, color: '#fff' }}>Historial de Movimientos</h3>
          {filteredExpenses.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>No hay gastos registrados en la vista actual.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1f2937', color: '#9ca3af' }}>
                    <th style={{ padding: 14 }}>Descripción</th>
                    <th style={{ padding: 14 }}>Monto</th>
                    <th style={{ padding: 14 }}>Categoría</th>
                    <th style={{ padding: 14 }}>Tarjeta</th>
                    <th style={{ padding: 14, textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map(exp => {
                    const card = cards.find(c => c.id === exp.card_id);
                    return (
                      <tr key={exp.id} style={{ borderBottom: '1px solid #1a2234' }}>
                        <td style={{ padding: 14, color: '#fff', fontWeight: 500 }}>{exp.description}</td>
                        <td style={{ padding: 14, color: '#f87171', fontWeight: 700 }}>${(Number(exp.amount) || 0).toFixed(2)}</td>
                        <td style={{ padding: 14 }}><span style={{ background: '#1f2937', color: '#d1d5db', padding: '4px 10px', borderRadius: 6, fontSize: 12 }}>{exp.category}</span></td>
                        <td style={{ padding: 14, color: '#9ca3af' }}>{card ? `${card.brand} (**** ${card.last_digits})` : 'N/A'}</td>
                        <td style={{ padding: 14, textAlign: 'right' }}>
                          <button onClick={() => handleDeleteExpense(exp.id)} style={{ background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Eliminar</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}