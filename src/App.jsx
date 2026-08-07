import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Papa from 'papaparse';

// 1. Obtención segura de Variables de Entorno
const getEnvVar = (key) => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return '';
};

const rawUrl = getEnvVar('VITE_SUPABASE_URL');
const rawKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

// Asegurar URL válida para evitar el crash
const isValidHttpUrl = (string) => {
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;  
  }
};

const supabaseUrl = isValidHttpUrl(rawUrl) ? rawUrl : 'https://placeholder.supabase.co';
const supabaseAnonKey = rawKey || 'placeholder';

// Inicialización de Supabase protegida
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [cards, setCards] = useState([]);
  const [selectedCardId, setSelectedCardId] = useState('all');
  const [expenses, setExpenses] = useState([]);

  // Nueva Tarjeta
  const [newCardHolder, setNewCardHolder] = useState('');
  const [newCardDigits, setNewCardDigits] = useState('');
  const [newCardBrand, setNewCardBrand] = useState('Visa');

  // Gasto Manual
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

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!rawUrl || supabaseUrl.includes('placeholder')) {
      alert('Error: No se encontró VITE_SUPABASE_URL. Verifica las variables de entorno en Vercel.');
      return;
    }

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) alert(error.message);
      else alert('Revisa tu correo para confirmar la cuenta.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message);
    }
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
    if (!newCardHolder || !newCardDigits) return alert('Completa los campos de la tarjeta');
    const { data, error } = await supabase.from('cards').insert([
      { holder: newCardHolder, last_digits: newCardDigits, brand: newCardBrand, user_id: session?.user?.id }
    ]).select();

    if (!error && data) {
      setCards([...cards, ...data]);
      setNewCardHolder('');
      setNewCardDigits('');
      if (!manualCardId) setManualCardId(data[0].id);
    } else {
      alert(error?.message || 'Error al agregar tarjeta');
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!description || !amount || !manualCardId) return alert('Completa los datos del gasto');
    const { data, error } = await supabase.from('expenses').insert([
      { description, amount: parseFloat(amount), category, card_id: manualCardId, user_id: session?.user?.id }
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

  // Importador de CSV de Mercado Pago
  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (selectedCardId === 'all') {
      alert('Por favor selecciona una tarjeta específica antes de importar el archivo CSV.');
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
          const rawCategory = getVal('category', 'categoría', 'categoria', 'type', 'tipo') || 'Mercado Pago';

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
            description: rawDesc || 'Consumo Mercado Pago',
            amount: isNaN(valAmount) ? 0 : valAmount,
            category: rawCategory,
            card_id: selectedCardId,
            user_id: session?.user?.id
          };
        }).filter(item => item.amount > 0);

        if (newExpenses.length === 0) {
          alert('No se encontraron registros de consumos válidos en el archivo CSV.');
          setImporting(false);
          return;
        }

        const { data, error } = await supabase.from('expenses').insert(newExpenses).select();
        setImporting(false);

        if (!error && data) {
          setExpenses([...data, ...expenses]);
          alert(`¡Éxito! Se importaron ${data.length} consumos de Mercado Pago.`);
        } else {
          alert('Error al guardar en Supabase: ' + (error?.message || 'Error desconocido'));
        }
      },
      error: (err) => {
        setImporting(false);
        alert('Error al leer el CSV: ' + err.message);
      }
    });
  };

  const filteredExpenses = selectedCardId === 'all'
    ? expenses
    : expenses.filter(e => e.card_id === selectedCardId);

  const totalSpent = filteredExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0b0f19', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
        Cargando...
      </div>
    );
  }

  // --- VISTA DE LOGIN Y REGISTRO ---
  if (!session) {
    return (
      <div style={{ minHeight: '100vh', background: '#0b0f19', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'Segoe UI, sans-serif' }}>
        <div style={{ width: '100%', maxWidth: 850, background: '#ffffff', borderRadius: 20, overflow: 'hidden', display: 'flex', flexWrap: 'wrap', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
          
          {/* LADO IZQUIERDO (BANNER CON PASOS) */}
          <div style={{ flex: '1 1 340px', background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)', padding: 40, color: '#ffffff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 10px 0' }}>Mis Gastos</h2>
              <p style={{ fontSize: 14, color: '#e0e7ff', margin: '0 0 35px 0', lineHeight: 1.5 }}>Administra tus tarjetas y consumos en un solo lugar.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 14, flexShrink: 0 }}>1</div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Crea tu cuenta</h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#c7d2fe', lineHeight: 1.4 }}>Ingresa con tu correo personal para mantener la información aislada y segura.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 14, flexShrink: 0 }}>2</div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Registra tu tarjeta</h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#c7d2fe', lineHeight: 1.4 }}>Agrega tarjetas físicas o virtuales (Visa, Mastercard, Mercado Pago) identificando sus últimos dígitos.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 14, flexShrink: 0 }}>3</div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Filtra e Importa</h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#c7d2fe', lineHeight: 1.4 }}>Selecciona cada tarjeta para analizar sus consumos o carga un CSV con tu historial completo de Mercado Pago.</p>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 35, fontSize: 12, color: '#c7d2fe', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🛡️</span> Datos protegidos por Supabase Auth
            </div>
          </div>

          {/* LADO DERECHO (FORMULARIO) */}
          <div style={{ flex: '1 1 380px', padding: 40, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h3 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: '0 0 6px 0' }}>
              {isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}
            </h3>
            <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 28px 0' }}>
              {isSignUp ? 'Ingresa tus datos para registrarte' : 'Ingresa a tu panel de control'}
            </p>

            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
                  CORREO ELECTRÓNICO
                </label>
                <input
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
                  CONTRASEÑA
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              <button
                type="submit"
                style={{ width: '100%', padding: '14px', background: '#4f46e5', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 15, cursor: 'pointer', marginTop: 10 }}
              >
                {isSignUp ? 'Registrarse' : 'Ingresar'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: '#4b5563' }}>
              {isSignUp ? (
                <>¿Ya tienes cuenta? <span onClick={() => setIsSignUp(false)} style={{ color: '#4f46e5', fontWeight: 600, cursor: 'pointer' }}>Inicia sesión aquí</span></>
              ) : (
                <>¿No tienes cuenta aun? <span onClick={() => setIsSignUp(true)} style={{ color: '#4f46e5', fontWeight: 600, cursor: 'pointer' }}>Regístrate aquí</span></>
              )}
            </div>
          </div>

        </div>
      </div>
    );
  }

  // --- VISTA INTERNA DEL PANEL ---
  return (
    <div style={{ minHeight: '100vh', background: '#0b0f19', color: '#f3f4f6', fontFamily: 'Segoe UI, sans-serif', padding: '24px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 20, borderBottom: '1px solid #1f2937', marginBottom: 25 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#fff' }}>Mis Gastos</h1>
            <span style={{ fontSize: 13, color: '#9ca3af' }}>{session.user.email}</span>
          </div>
          <button onClick={handleLogout} style={{ background: '#1f2937', color: '#9ca3af', border: '1px solid #374151', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>Cerrar Sesión</button>
        </div>

        {/* SELECTOR E IMPORTADOR DE MERCADO PAGO */}
        <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 15, marginBottom: 15 }}>
            <div>
              <span style={{ fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>TARJETA SELECCIONADA:</span>
              <div style={{ marginTop: 6 }}>
                <select value={selectedCardId} onChange={e => setSelectedCardId(e.target.value)} style={{ background: '#0b0f19', color: '#fff', border: '1px solid #374151', padding: '10px 14px', borderRadius: 8, fontSize: 15, outline: 'none', cursor: 'pointer' }}>
                  <option value="all">Todas las tarjetas</option>
                  {cards.map(c => (
                    <option key={c.id} value={c.id}>{c.brand} **** {c.last_digits} ({c.holder})</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>TOTAL FILTRADO</span>
              <h2 style={{ margin: 0, color: '#818cf8', fontSize: 28, fontWeight: 700 }}>${totalSpent.toFixed(2)}</h2>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #1f2937', paddingTop: 15, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 15 }}>
            <div>
              <h4 style={{ margin: 0, color: '#818cf8', fontSize: 15 }}>📥 Importar Historial de Mercado Pago (.CSV)</h4>
              <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#9ca3af' }}>Carga el reporte exportado para asociar automáticamente todos los consumos a la tarjeta elegida.</p>
            </div>
            <label style={{ background: importing ? '#4b5563' : '#4f46e5', color: '#fff', padding: '10px 18px', borderRadius: 8, fontWeight: 600, cursor: importing ? 'not-allowed' : 'pointer', fontSize: 14 }}>
              {importing ? 'Importando...' : '⬆️ Seleccionar CSV'}
              <input type="file" accept=".csv" onChange={handleImportCSV} disabled={importing} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        {/* CONTENEDOR DE FORMULARIOS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 24 }}>
          {/* REGISTRAR TARJETA */}
          <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: 16, color: '#fff' }}>Registrar Tarjeta</h3>
            <form onSubmit={handleAddCard} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input type="text" placeholder="Titular" value={newCardHolder} onChange={e => setNewCardHolder(e.target.value)} style={{ padding: 10, background: '#0b0f19', border: '1px solid #374151', borderRadius: 6, color: '#fff', outline: 'none' }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <input type="text" placeholder="Últimos 4 dígitos" maxLength={4} value={newCardDigits} onChange={e => setNewCardDigits(e.target.value)} style={{ padding: 10, background: '#0b0f19', border: '1px solid #374151', borderRadius: 6, color: '#fff', flex: 1, outline: 'none' }} />
                <select value={newCardBrand} onChange={e => setNewCardBrand(e.target.value)} style={{ padding: 10, background: '#0b0f19', border: '1px solid #374151', borderRadius: 6, color: '#fff', flex: 1, outline: 'none' }}>
                  <option value="Visa">Visa</option>
                  <option value="Mastercard">Mastercard</option>
                  <option value="Mercado Pago">Mercado Pago</option>
                </select>
              </div>
              <button type="submit" style={{ padding: 10, background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Guardar Tarjeta</button>
            </form>
          </div>

          {/* GASTO MANUAL */}
          <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: 16, color: '#fff' }}>Cargar Gasto Manual</h3>
            <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <input type="text" placeholder="Concepto" value={description} onChange={e => setDescription(e.target.value)} style={{ padding: 10, background: '#0b0f19', border: '1px solid #374151', borderRadius: 6, color: '#fff', flex: 2, outline: 'none' }} />
                <input type="number" step="0.01" placeholder="Monto" value={amount} onChange={e => setAmount(e.target.value)} style={{ padding: 10, background: '#0b0f19', border: '1px solid #374151', borderRadius: 6, color: '#fff', flex: 1, outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <select value={category} onChange={e => setCategory(e.target.value)} style={{ padding: 10, background: '#0b0f19', border: '1px solid #374151', borderRadius: 6, color: '#fff', flex: 1, outline: 'none' }}>
                  <option value="General">General</option>
                  <option value="Comida">Comida</option>
                  <option value="Servicios">Servicios</option>
                  <option value="Entretenimiento">Entretenimiento</option>
                </select>
                <select value={manualCardId} onChange={e => setManualCardId(e.target.value)} style={{ padding: 10, background: '#0b0f19', border: '1px solid #374151', borderRadius: 6, color: '#fff', flex: 1, outline: 'none' }}>
                  {cards.map(c => (
                    <option key={c.id} value={c.id}>{c.brand} **** {c.last_digits}</option>
                  ))}
                </select>
              </div>
              <button type="submit" style={{ padding: 10, background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Guardar Gasto</button>
            </form>
          </div>
        </div>

        {/* TABLA DE CONSUMOS */}
        <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: 16, color: '#fff' }}>Historial de Consumos</h3>
          {filteredExpenses.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 14 }}>Sin registros.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1f2937', color: '#9ca3af' }}>
                    <th style={{ padding: 12 }}>Descripción</th>
                    <th style={{ padding: 12 }}>Monto</th>
                    <th style={{ padding: 12 }}>Categoría</th>
                    <th style={{ padding: 12 }}>Tarjeta</th>
                    <th style={{ padding: 12, textAlign: 'right' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map(exp => {
                    const card = cards.find(c => c.id === exp.card_id);
                    return (
                      <tr key={exp.id} style={{ borderBottom: '1px solid #1f2937' }}>
                        <td style={{ padding: 12, color: '#fff' }}>{exp.description}</td>
                        <td style={{ padding: 12, color: '#f87171', fontWeight: 600 }}>${(Number(exp.amount) || 0).toFixed(2)}</td>
                        <td style={{ padding: 12 }}><span style={{ background: '#1f2937', color: '#d1d5db', padding: '4px 8px', borderRadius: 4, fontSize: 12 }}>{exp.category}</span></td>
                        <td style={{ padding: 12, color: '#9ca3af' }}>{card ? `${card.brand} (**** ${card.last_digits})` : 'N/A'}</td>
                        <td style={{ padding: 12, textAlign: 'right' }}>
                          <button onClick={() => handleDeleteExpense(exp.id)} style={{ background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', fontSize: 13 }}>Eliminar</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}