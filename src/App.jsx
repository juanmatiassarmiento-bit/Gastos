import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { createClient } from '@supabase/supabase-js';

// Inicialización de Supabase
const rawUrl = import.meta.env.VITE_SUPABASE_URL || '';
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

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

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const IS_SUPABASE_VALID = rawUrl && !supabaseUrl.includes('placeholder');

export default function App() {
  // Estado de Sesión y Autenticación
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Recuperación de contraseña
  const [isRecoverySession, setIsRecoverySession] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Estado de Tarjetas y Gastos
  const [cards, setCards] = useState([]);
  const [selectedCardId, setSelectedCardId] = useState('all');
  const [expenses, setExpenses] = useState([]);

  // Formulario Tarjeta Completo
  const [newCardHolder, setNewCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expDate, setExpDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [detectedBrand, setDetectedBrand] = useState('Desconocida');

  // Formulario Gasto Manual
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('General');
  const [manualCardId, setManualCardId] = useState('');

  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      setIsRecoverySession(true);
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data?.session || null);
      setLoading(false);
    }).catch(() => setLoading(false));

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoverySession(true);
      }
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

  // Autenticación corregida
  const handleAuth = async (e) => {
    e.preventDefault();
    if (!IS_SUPABASE_VALID) {
      alert('Error: No se encontró VITE_SUPABASE_URL. Verifica las variables de entorno.');
      return;
    }

    if (authMode === 'reset') {
      const redirectUrl = window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        if (error.status === 429 || error.message.toLowerCase().includes('rate limit')) {
          alert('Has realizado demasiados intentos en poco tiempo. Por favor espera unos minutos antes de volver a intentar.');
        } else {
          alert('Error al enviar el correo de recuperación: ' + error.message);
        }
      } else {
        alert('¡Correo enviado! Revisa tu bandeja de entrada o la carpeta de SPAM.');
      }
      return;
    }

    if (authMode === 'signup') {
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          emailRedirectTo: window.location.origin
        }
      });
      if (error) alert(error.message);
      else alert('Revisa tu correo para confirmar la cuenta.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message);
    }
  };

  const handleBiometricAuth = async () => {
    if (!window.PublicKeyCredential) {
      alert('Tu navegador o dispositivo no soporta autenticación biométrica.');
      return;
    }
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      alert('Iniciando lectura biométrica / huella dactilar...');
    } catch (err) {
      alert('Error o cancelación en la lectura biométrica: ' + err.message);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setUpdatingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setUpdatingPassword(false);

    if (error) {
      alert('Error al actualizar contraseña: ' + error.message);
    } else {
      alert('¡Contraseña actualizada con éxito!');
      setIsRecoverySession(false);
      setNewPassword('');
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  const handleLogout = () => {
    setIsRecoverySession(false);
    supabase.auth.signOut();
  };

  // Detección automática de franquicia por BIN
  const detectBrand = (number) => {
    const cleanNum = number.replace(/\D/g, '');
    if (cleanNum.startsWith('4')) return 'Visa';
    
    const firstTwo = parseInt(cleanNum.substring(0, 2), 10);
    const firstFour = parseInt(cleanNum.substring(0, 4), 10);
    
    if ((firstTwo >= 51 && firstTwo <= 55) || (firstFour >= 2221 && firstFour <= 2720)) {
      return 'Mastercard';
    }
    if (firstTwo === 34 || firstTwo === 37) return 'American Express';
    if (firstTwo === 36 || firstTwo === 38 || firstFour.toString().startsWith('30')) return 'Diners Club';
    if (firstFour === 6011 || firstTwo === 65) return 'Discover';
    if (cleanNum.length >= 2) return 'Genérica';
    return 'Desconocida';
  };

  const handleCardNumberChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 16);
    setCardNumber(val);
    setDetectedBrand(detectBrand(val));
  };

  const handleExpDateChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length >= 2) {
      val = val.slice(0, 2) + '/' + val.slice(2, 4);
    }
    setExpDate(val.slice(0, 5));
  };

  const handleAddCard = async (e) => {
    e.preventDefault();
    if (!newCardHolder || cardNumber.length < 13 || expDate.length < 5 || cvv.length < 3) {
      return alert('Completa todos los datos requeridos de la tarjeta (titular, número completo, MM/AA y CVV).');
    }

    const lastDigits = cardNumber.slice(-4);

    const cardPayload = {
      holder: newCardHolder,
      last_digits: lastDigits,
      brand: detectedBrand,
      exp_date: expDate,
      cvv: cvv,
      user_id: session?.user?.id
    };

    let { data, error } = await supabase.from('cards').insert([cardPayload]).select();

    if (error && error.message.includes('column')) {
      const fallbackPayload = {
        last_digits: lastDigits,
        brand: detectedBrand,
        user_id: session?.user?.id
      };
      const retry = await supabase.from('cards').insert([fallbackPayload]).select();
      data = retry.data;
      error = retry.error;
    }

    if (!error && data) {
      setCards([...cards, data[0]]);
      if (!manualCardId) setManualCardId(data[0].id);
      setNewCardHolder('');
      setCardNumber('');
      setExpDate('');
      setCvv('');
      setDetectedBrand('Desconocida');
      alert('¡Tarjeta guardada con éxito!');
    } else {
      alert('Error al guardar la tarjeta: ' + (error?.message || 'Error desconocido'));
    }
  };

  // Gastos
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

  // CSV Mercado Pago
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
          alert(`¡Éxito! Se importaron ${data.length} consumos.`);
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

  // VISTA AUTH
  if (!session) {
    return (
      <div style={{ minHeight: '100vh', background: '#0b0f19', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: 'Segoe UI, sans-serif', boxSizing: 'border-box' }}>
        <div style={{ width: '100%', maxWidth: 850, background: '#ffffff', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
          <style>{`
            @media (min-width: 768px) {
              .auth-container { flex-direction: row !important; }
              .auth-banner { display: flex !important; }
            }
          `}</style>
          
          <div className="auth-container" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            <div className="auth-banner" style={{ flex: '1 1 40%', background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)', padding: '32px 24px', color: '#ffffff', display: 'none', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 8px 0' }}>Mis Gastos</h2>
                <p style={{ fontSize: 13, color: '#e0e7ff', margin: '0 0 28px 0', lineHeight: 1.5 }}>Administra tus tarjetas y consumos en un solo lugar.</p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 13, flexShrink: 0 }}>1</div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Crea tu cuenta</h4>
                      <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#c7d2fe', lineHeight: 1.4 }}>Acceso con clave o biometría.</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 13, flexShrink: 0 }}>2</div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Registra tu tarjeta</h4>
                      <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#c7d2fe', lineHeight: 1.4 }}>Detección de franquicia, vencimiento y CVV.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 24, fontSize: 12, color: '#c7d2fe' }}>
                🛡️ Datos encriptados en Supabase
              </div>
            </div>

            <div style={{ flex: '1 1 60%', padding: '32px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxSizing: 'border-box' }}>
              <h3 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 6px 0' }}>
                {authMode === 'login' && 'Iniciar Sesión'}
                {authMode === 'signup' && 'Crear Cuenta'}
                {authMode === 'reset' && 'Recuperar Contraseña'}
              </h3>
              <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px 0' }}>
                {authMode === 'login' && 'Ingresa a tu panel de control'}
                {authMode === 'signup' && 'Completa tus datos para registrarte'}
                {authMode === 'reset' && 'Ingresa tu correo para recibir las instrucciones'}
              </p>

              <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>

                {authMode !== 'reset' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        CONTRASEÑA
                      </label>
                      {authMode === 'login' && (
                        <span onClick={() => setAuthMode('reset')} style={{ fontSize: 12, color: '#4f46e5', fontWeight: 600, cursor: 'pointer' }}>
                          ¿Olvidaste tu contraseña?
                        </span>
                      )}
                    </div>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  style={{ width: '100%', padding: '14px', background: '#4f46e5', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 15, cursor: 'pointer', marginTop: 8 }}
                >
                  {authMode === 'login' && 'Ingresar'}
                  {authMode === 'signup' && 'Registrarse'}
                  {authMode === 'reset' && 'Enviar Correo de Recuperación'}
                </button>
              </form>

              {authMode === 'login' && (
                <button
                  type="button"
                  onClick={handleBiometricAuth}
                  style={{ width: '100%', padding: '12px', background: '#10b981', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer', marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  ☝️ Ingresar con Biometría / Huella
                </button>
              )}

              <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#4b5563', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {authMode === 'login' && (
                  <div>¿No tienes cuenta aún? <span onClick={() => setAuthMode('signup')} style={{ color: '#4f46e5', fontWeight: 600, cursor: 'pointer' }}>Regístrate aquí</span></div>
                )}
                {authMode === 'signup' && (
                  <div>¿Ya tienes cuenta? <span onClick={() => setAuthMode('login')} style={{ color: '#4f46e5', fontWeight: 600, cursor: 'pointer' }}>Inicia sesión aquí</span></div>
                )}
                {authMode === 'reset' && (
                  <div><span onClick={() => setAuthMode('login')} style={{ color: '#4f46e5', fontWeight: 600, cursor: 'pointer' }}>← Volver a Iniciar Sesión</span></div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // VISTA PANEL
  return (
    <div style={{ minHeight: '100vh', background: '#0b0f19', color: '#f3f4f6', fontFamily: 'Segoe UI, sans-serif', padding: '16px', boxSizing: 'border-box' }}>
      <style>{`
        * { box-sizing: border-box; }
        .form-grid { display: grid; grid-template-columns: 1fr; gap: 16px; margin-bottom: 20px; }
        .form-row { display: flex; flex-direction: column; gap: 10px; }
        .import-box { display: flex; flex-direction: column; gap: 12px; }
        @media (min-width: 640px) {
          .form-row { flex-direction: row; }
          .import-box { flex-direction: row; align-items: center; justify-content: space-between; }
        }
        @media (min-width: 850px) {
          .form-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        
        {isRecoverySession && (
          <div style={{ background: '#312e81', border: '1px solid #6366f1', borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: 16, color: '#fff' }}>🔑 Establecer Nueva Contraseña</h3>
            <p style={{ margin: '0 0 12px 0', fontSize: 13, color: '#c7d2fe' }}>
              Has ingresado mediante un enlace de recuperación. Ingresa tu nueva contraseña:
            </p>
            <form onSubmit={handleUpdatePassword} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                type="password"
                placeholder="Escribe tu nueva contraseña"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                style={{ flex: 1, minWidth: 200, padding: 10, borderRadius: 8, border: '1px solid #4f46e5', background: '#0b0f19', color: '#fff', fontSize: 14, outline: 'none' }}
              />
              <button
                type="submit"
                disabled={updatingPassword}
                style={{ padding: '10px 18px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
              >
                {updatingPassword ? 'Guardando...' : 'Guardar Contraseña'}
              </button>
            </form>
          </div>
        )}

        {/* HEADER */}
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottom: '1px solid #1f2937', marginBottom: 20, gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Mis Gastos</h1>
            <span style={{ fontSize: 12, color: '#9ca3af', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.user.email}</span>
          </div>
          <button onClick={handleLogout} style={{ background: '#1f2937', color: '#9ca3af', border: '1px solid #374151', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>
            Salir
          </button>
        </div>

        {/* PANEL SELECCIÓN DE TARJETA E IMPORTACIÓN */}
        <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: '100%', maxWidth: 350 }}>
              <span style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>
                TARJETA SELECCIONADA:
              </span>
              <select 
                value={selectedCardId} 
                onChange={e => setSelectedCardId(e.target.value)} 
                style={{ width: '100%', background: '#0b0f19', color: '#fff', border: '1px solid #374151', padding: '10px', borderRadius: 8, fontSize: 14, outline: 'none', cursor: 'pointer' }}
              >
                <option value="all">Todas las tarjetas</option>
                {cards.map(c => (
                  <option key={c.id} value={c.id}>{c.brand} **** {c.last_digits} ({c.holder})</option>
                ))}
              </select>
            </div>
            <div>
              <span style={{ fontSize: 11, color: '#9ca3af', display: 'block' }}>TOTAL FILTRADO</span>
              <h2 style={{ margin: 0, color: '#818cf8', fontSize: 24, fontWeight: 700 }}>${totalSpent.toFixed(2)}</h2>
            </div>
          </div>

          <div className="import-box" style={{ borderTop: '1px solid #1f2937', paddingTop: 14 }}>
            <div>
              <h4 style={{ margin: 0, color: '#818cf8', fontSize: 14 }}>📥 Importar Mercado Pago (.CSV)</h4>
              <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#9ca3af' }}>Asocia automáticamente los consumos a la tarjeta elegida.</p>
            </div>
            <label style={{ background: importing ? '#4b5563' : '#4f46e5', color: '#fff', padding: '10px 16px', borderRadius: 8, fontWeight: 600, cursor: importing ? 'not-allowed' : 'pointer', fontSize: 13, textAlign: 'center', whiteSpace: 'nowrap' }}>
              {importing ? 'Importando...' : '⬆️ Seleccionar CSV'}
              <input type="file" accept=".csv" onChange={handleImportCSV} disabled={importing} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        {/* FORMULARIOS: TARJETA Y GASTO MANUAL */}
        <div className="form-grid">
          
          {/* REGISTRAR TARJETA CON DETECCION Y VENCIMIENTO */}
          <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 12, padding: 16 }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 15, color: '#fff' }}>Registrar Tarjeta</h3>
            <form onSubmit={handleAddCard} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input 
                type="text" 
                placeholder="Nombre del Titular" 
                value={newCardHolder} 
                onChange={e => setNewCardHolder(e.target.value)} 
                style={{ padding: 10, background: '#0b0f19', border: '1px solid #374151', borderRadius: 6, color: '#fff', outline: 'none', fontSize: 14 }} 
              />

              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder="Número completo de Tarjeta" 
                  maxLength={16} 
                  value={cardNumber} 
                  onChange={handleCardNumberChange} 
                  style={{ padding: 10, width: '100%', background: '#0b0f19', border: '1px solid #374151', borderRadius: 6, color: '#fff', outline: 'none', fontSize: 14 }} 
                />
                <span style={{ position: 'absolute', right: 10, fontSize: 11, background: '#374151', color: '#60a5fa', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                  {detectedBrand}
                </span>
              </div>

              <div className="form-row">
                <input 
                  type="text" 
                  placeholder="MM/AA" 
                  maxLength={5} 
                  value={expDate} 
                  onChange={handleExpDateChange} 
                  style={{ padding: 10, background: '#0b0f19', border: '1px solid #374151', borderRadius: 6, color: '#fff', flex: 1, outline: 'none', fontSize: 14 }} 
                />
                <input 
                  type="password" 
                  placeholder="CVV" 
                  maxLength={4} 
                  value={cvv} 
                  onChange={e => setCvv(e.target.value.replace(/\D/g, ''))} 
                  style={{ padding: 10, background: '#0b0f19', border: '1px solid #374151', borderRadius: 6, color: '#fff', flex: 1, outline: 'none', fontSize: 14 }} 
                />
              </div>

              <button type="submit" style={{ padding: 10, background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
                Guardar Tarjeta
              </button>
            </form>
          </div>

          {/* CARGAR GASTO MANUAL */}
          <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 12, padding: 16 }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 15, color: '#fff' }}>Cargar Gasto Manual</h3>
            <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="form-row">
                <input 
                  type="text" 
                  placeholder="Concepto" 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  style={{ padding: 10, background: '#0b0f19', border: '1px solid #374151', borderRadius: 6, color: '#fff', flex: 2, outline: 'none', fontSize: 14 }} 
                />
                <input 
                  type="number" 
                  step="0.01" 
                  placeholder="Monto" 
                  value={amount} 
                  onChange={e => setAmount(e.target.value)} 
                  style={{ padding: 10, background: '#0b0f19', border: '1px solid #374151', borderRadius: 6, color: '#fff', flex: 1, outline: 'none', fontSize: 14 }} 
                />
              </div>
              <div className="form-row">
                <select 
                  value={category} 
                  onChange={e => setCategory(e.target.value)} 
                  style={{ padding: 10, background: '#0b0f19', border: '1px solid #374151', borderRadius: 6, color: '#fff', flex: 1, outline: 'none', fontSize: 14 }}
                >
                  <option value="General">General</option>
                  <option value="Comida">Comida</option>
                  <option value="Servicios">Servicios</option>
                  <option value="Entretenimiento">Entretenimiento</option>
                </select>
                <select 
                  value={manualCardId} 
                  onChange={e => setManualCardId(e.target.value)} 
                  style={{ padding: 10, background: '#0b0f19', border: '1px solid #374151', borderRadius: 6, color: '#fff', flex: 1, outline: 'none', fontSize: 14 }}
                >
                  {cards.map(c => (
                    <option key={c.id} value={c.id}>{c.brand} **** {c.last_digits}</option>
                  ))}
                </select>
              </div>
              <button type="submit" style={{ padding: 10, background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
                Guardar Gasto
              </button>
            </form>
          </div>

        </div>

        {/* HISTORIAL DE CONSUMOS */}
        <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 12, padding: 16 }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 15, color: '#fff' }}>Historial de Consumos</h3>
          {filteredExpenses.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>Sin registros.</p>
          ) : (
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13, minWidth: 500 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1f2937', color: '#9ca3af' }}>
                    <th style={{ padding: '10px 8px' }}>Descripción</th>
                    <th style={{ padding: '10px 8px' }}>Monto</th>
                    <th style={{ padding: '10px 8px' }}>Categoría</th>
                    <th style={{ padding: '10px 8px' }}>Tarjeta</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map(exp => {
                    const matchedCard = cards.find(c => c.id === exp.card_id);
                    const cardLabel = matchedCard 
                      ? `${matchedCard.brand} **** ${matchedCard.last_digits}`
                      : 'Desconocida';

                    return (
                      <tr key={exp.id} style={{ borderBottom: '1px solid #1f2937' }}>
                        <td style={{ padding: '10px 8px', color: '#fff' }}>{exp.description}</td>
                        <td style={{ padding: '10px 8px', color: '#34d399', fontWeight: 600 }}>${Number(exp.amount).toFixed(2)}</td>
                        <td style={{ padding: '10px 8px', color: '#9ca3af' }}>{exp.category}</td>
                        <td style={{ padding: '10px 8px', color: '#818cf8' }}>{cardLabel}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                          <button 
                            onClick={() => handleDeleteExpense(exp.id)}
                            style={{ background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', fontSize: 12, padding: '4px 8px' }}
                          >
                            Eliminar
                          </button>
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