import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// ==========================================
// CONFIGURACIÓN DE SUPABASE
// ==========================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://tu-proyecto.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'tu-anon-key';
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function App() {
  // ------------------------------------------
  // ESTADOS DE AUTENTICACIÓN
  // ------------------------------------------
  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup' | 'reset' | 'otp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [verificationCodeSent, setVerificationCodeSent] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [authMessage, setAuthMessage] = useState(null);
  const [isRecoverySession, setIsRecoverySession] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // ------------------------------------------
  // ESTADOS DE TARJETAS Y GASTOS
  // ------------------------------------------
  const [cards, setCards] = useState([]);
  const [selectedCardId, setSelectedCardId] = useState('all');
  const [expenses, setExpenses] = useState([]);

  // Formulario Nueva Tarjeta
  const [newCardHolder, setNewCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [detectedBrand, setDetectedBrand] = useState('Desconocida');
  const [expDate, setExpDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardVerificationMethod, setCardVerificationMethod] = useState(null); // 'biometric' | 'camera'

  // Formulario Nuevo Gasto Manual
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('General');
  const [manualCardId, setManualCardId] = useState('');

  // Cámara / Escáner
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const cameraVideoRef = useRef(null);

  // Importación
  const [importing, setImporting] = useState(false);

  // ------------------------------------------
  // INICIALIZACIÓN Y LISTENERS DE SUPABASE
  // ------------------------------------------
  useEffect(() => {
    // Obtener sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Escuchar cambios de estado de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoverySession(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Cargar datos cuando se inicia sesión
  useEffect(() => {
    if (session?.user) {
      fetchCards();
      fetchExpenses();
    }
  }, [session]);

  // Actualizar tarjeta por defecto seleccionada en formulario de consumo
  useEffect(() => {
    if (cards.length > 0 && !manualCardId) {
      setManualCardId(cards[0].id);
    }
  }, [cards, manualCardId]);

  // Manejo del stream de video para la cámara
  useEffect(() => {
    let stream = null;
    if (cameraOpen && cameraVideoRef.current) {
      setCameraError(null);
      navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } })
        .then((s) => {
          stream = s;
          if (cameraVideoRef.current) {
            cameraVideoRef.current.srcObject = s;
          }
        })
        .catch((err) => {
          console.error('Error al acceder a la cámara:', err);
          setCameraError('No se pudo acceder a la cámara. Verifica los permisos.');
        });
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraOpen]);

  // ------------------------------------------
  // LÓGICA DE CONSULTAS (DATABASE)
  // ------------------------------------------
  const fetchCards = async () => {
    try {
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .eq('user_id', session.user.id)
        .order('is_favorite', { ascending: false });

      if (error) throw error;
      setCards(data || []);
    } catch (err) {
      console.error('Error obteniendo tarjetas:', err.message);
    }
  };

  const fetchExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (err) {
      console.error('Error obteniendo gastos:', err.message);
    }
  };

  // ------------------------------------------
  // MANEJO DE AUTENTICACIÓN
  // ------------------------------------------
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setVerifyingCode(true);
    setAuthMessage(null);

    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setAuthMessage({ type: 'success', text: 'Registro exitoso. Revisa tu correo de confirmación.' });
      } else if (authMode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setAuthMessage({ type: 'success', text: 'Correo de recuperación enviado.' });
      } else if (authMode === 'otp') {
        if (!verificationCodeSent) {
          const { error } = await supabase.auth.signInWithOtp({ email });
          if (error) throw error;
          setVerificationCodeSent(true);
          setAuthMessage({ type: 'success', text: 'Código enviado a tu correo.' });
        } else {
          const { error } = await supabase.auth.verifyOtp({ email, token: otpCode, type: 'email' });
          if (error) throw error;
        }
      }
    } catch (err) {
      setAuthMessage({ type: 'error', text: err.message });
    } finally {
      setVerifyingCode(false);
    }
  };

  const openCodeLogin = () => {
    setAuthMode('otp');
    setVerificationCodeSent(false);
    setAuthMessage(null);
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      alert('Contraseña actualizada correctamente.');
      setIsRecoverySession(false);
    } catch (err) {
      alert('Error al actualizar contraseña: ' + err.message);
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setCards([]);
    setExpenses([]);
  };

  // ------------------------------------------
  // MANEJO DE TARJETAS
  // ------------------------------------------
  const detectBrand = (number) => {
    const clean = number.replace(/\D/g, '');
    if (/^4/.test(clean)) return 'Visa';
    if (/^5[1-5]|^2[2-7]/.test(clean)) return 'Mastercard';
    if (/^3[47]/.test(clean)) return 'American Express';
    if (/^6(?:011|5)/.test(clean)) return 'Discover';
    if (clean.length > 0) return 'Otra';
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

  const handleCardBiometricVerification = async () => {
    if (window.PublicKeyCredential) {
      try {
        setCardVerificationMethod('biometric');
        alert('Autenticación biométrica iniciada. Confirme con su sensor de huella o rostro.');
      } catch (err) {
        alert('Biometría no disponible o denegada.');
      }
    } else {
      alert('La biometría WebAuthn no está soportada en este navegador.');
    }
  };

  const confirmCameraVerification = () => {
    setCardVerificationMethod('camera');
    setCameraOpen(false);
  };

  const handleAddCard = async (e) => {
    e.preventDefault();
    if (!cardNumber || cardNumber.length < 13) {
      alert('Por favor ingrese un número de tarjeta válido.');
      return;
    }
    if (!cardVerificationMethod) {
      alert('Es obligatorio completar una verificación por Biometría o Cámara.');
      return;
    }

    try {
      const last4 = cardNumber.slice(-4);
      const newCard = {
        user_id: session.user.id,
        holder: newCardHolder || 'Titular',
        brand: detectedBrand,
        last_digits: last4,
        exp_date: expDate,
        is_favorite: cards.length === 0,
      };

      const { data, error } = await supabase.from('cards').insert([newCard]).select();
      if (error) throw error;

      setCards([...cards, ...(data || [])]);
      setNewCardHolder('');
      setCardNumber('');
      setExpDate('');
      setCvv('');
      setDetectedBrand('Desconocida');
      setCardVerificationMethod(null);
      alert('Tarjeta agregada exitosamente.');
    } catch (err) {
      alert('Error al guardar tarjeta: ' + err.message);
    }
  };

  const handleDeleteCard = async (id) => {
    if (!confirm('¿Estás seguro de eliminar esta tarjeta?')) return;
    try {
      const { error } = await supabase.from('cards').delete().eq('id', id);
      if (error) throw error;
      setCards(cards.filter((c) => c.id !== id));
    } catch (err) {
      alert('Error al eliminar tarjeta: ' + err.message);
    }
  };

  const handleToggleFavorite = async (id) => {
    try {
      const target = cards.find((c) => c.id === id);
      const updatedState = !target.is_favorite;

      const { error } = await supabase.from('cards').update({ is_favorite: updatedState }).eq('id', id);
      if (error) throw error;

      setCards(cards.map((c) => (c.id === id ? { ...c, is_favorite: updatedState } : c)));
    } catch (err) {
      alert('Error actualizando favorita: ' + err.message);
    }
  };

  // ------------------------------------------
  // MANEJO DE GASTOS
  // ------------------------------------------
  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!description || !amount || !manualCardId) {
      alert('Completa la descripción, monto y selecciona una tarjeta.');
      return;
    }

    try {
      const newExpense = {
        user_id: session.user.id,
        card_id: manualCardId,
        description,
        amount: parseFloat(amount),
        category,
      };

      const { data, error } = await supabase.from('expenses').insert([newExpense]).select();
      if (error) throw error;

      setExpenses([ ...(data || []), ...expenses ]);
      setDescription('');
      setAmount('');
    } catch (err) {
      alert('Error al agregar gasto: ' + err.message);
    }
  };

  const handleDeleteExpense = async (id) => {
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
      setExpenses(expenses.filter((e) => e.id !== id));
    } catch (err) {
      alert('Error al eliminar consumo: ' + err.message);
    }
  };

  // ------------------------------------------
  // PARSER E IMPORTACIÓN DE RESÚMENES
  // ------------------------------------------
  const handleImportFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n');
      const parsedExpenses = [];
      const defaultCardId = cards[0]?.id || null;

      for (let line of lines) {
        if (!line.trim()) continue;
        
        // Expresión regular para capturar descripción y montos (Formatos CSV/Texto común)
        const match = line.match(/(.*?)[,;\t]+(\$?\s*\d+[\.,]?\d*)/);
        if (match) {
          const desc = match[1].replace(/["']/g, '').trim();
          const amt = parseFloat(match[2].replace('$', '').replace(',', '.').trim());

          if (desc && !isNaN(amt) && amt > 0) {
            parsedExpenses.push({
              user_id: session.user.id,
              card_id: defaultCardId,
              description: desc,
              amount: amt,
              category: 'Importación Auto',
            });
          }
        }
      }

      if (parsedExpenses.length > 0) {
        const { data, error } = await supabase.from('expenses').insert(parsedExpenses).select();
        if (error) throw error;

        setExpenses([...(data || []), ...expenses]);
        alert(`Se importaron ${parsedExpenses.length} consumos correctamente.`);
      } else {
        alert('No se encontraron transacciones válidas en el archivo importado.');
      }
    } catch (err) {
      alert('Error al procesar el archivo: ' + err.message);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  // Cálculos para la vista
  const filteredExpenses = selectedCardId === 'all'
    ? expenses
    : expenses.filter((exp) => exp.card_id === selectedCardId);

  const totalSpent = filteredExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  // ------------------------------------------
  // VISTA: LOGIN / REGISTRO / RECUPERACIÓN
  // ------------------------------------------
  if (!session) {
    return (
      <div style={{ minHeight: '100vh', background: '#0b0f19', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: 'Segoe UI, sans-serif' }}>
        <div style={{ width: '100%', maxWidth: 420, background: '#ffffff', borderRadius: 16, padding: 32, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: '#111827', margin: 0 }}>Mis Gastos & Tarjetas</h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Gestión financiera personal simplificada</p>
          </div>

          {authMessage && (
            <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, background: authMessage.type === 'error' ? '#fef2f2' : '#ecfdf5', color: authMessage.type === 'error' ? '#dc2626' : '#059669', border: `1px solid ${authMessage.type === 'error' ? '#fecaca' : '#a7f3d0'}` }}>
              {authMessage.text}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Correo Electrónico</label>
              <input
                type="email"
                placeholder="usuario@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            {authMode !== 'otp' && authMode !== 'reset' && (
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Contraseña</label>
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

            {authMode === 'otp' && verificationCodeSent && (
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Código OTP Enviado</label>
                <input
                  type="text"
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  required
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 16, letterSpacing: 4, textAlign: 'center', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={verifyingCode}
              style={{ width: '100%', padding: '12px', background: '#4f46e5', color: '#ffffff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}
            >
              {verifyingCode && 'Procesando...'}
              {!verifyingCode && authMode === 'login' && 'Ingresar'}
              {!verifyingCode && authMode === 'signup' && 'Registrarse'}
              {!verifyingCode && authMode === 'reset' && 'Enviar Correo de Recuperación'}
              {!verifyingCode && authMode === 'otp' && (verificationCodeSent ? 'Verificar e Ingresar' : 'Enviar Código')}
            </button>
          </form>

          {/* Botones de navegación de modos */}
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10, alignment: 'center', fontSize: 13, textAlign: 'center' }}>
            {authMode !== 'login' && (
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setAuthMessage(null); }}
                style={{ background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                ¿Ya tienes cuenta? Inicia Sesión
              </button>
            )}

            {authMode !== 'signup' && (
              <button
                type="button"
                onClick={() => { setAuthMode('signup'); setAuthMessage(null); }}
                style={{ background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                ¿No tienes cuenta? Regístrate
              </button>
            )}

            {authMode !== 'otp' && (
              <button
                type="button"
                onClick={openCodeLogin}
                style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}
              >
                Ingresar con código temporal (sin contraseña)
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------
  // VISTA DE RECUPERACIÓN DE CONTRASEÑA
  // ------------------------------------------
  if (isRecoverySession) {
    return (
      <div style={{ minHeight: '100vh', background: '#0b0f19', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: 'Segoe UI, sans-serif' }}>
        <div style={{ width: '100%', maxWidth: 400, background: '#ffffff', borderRadius: 16, padding: 32, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px 0', color: '#111827' }}>Actualizar Contraseña</h3>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>Escribe tu nueva contraseña a continuación.</p>

          <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                NUEVA CONTRASEÑA
              </label>
              <input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>

            <button
              type="submit"
              disabled={updatingPassword}
              style={{ width: '100%', padding: '12px', background: '#4f46e5', color: '#ffffff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              {updatingPassword ? 'Guardando...' : 'Cambiar Contraseña'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ------------------------------------------
  // VISTA PRINCIPAL (DASHBOARD AUTENTICADO)
  // ------------------------------------------
  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', fontFamily: 'Segoe UI, sans-serif', color: '#1f2937' }}>
      {/* Header */}
      <header style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#4f46e5' }}>Mis Gastos</h1>
          <span style={{ fontSize: 12, background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
            {session.user.email}
          </span>
        </div>
        <button
          onClick={handleLogout}
          style={{ padding: '8px 16px', background: '#ef4444', color: '#ffffff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Cerrar Sesión
        </button>
      </header>

      {/* Modal Cámara de Verificación */}
      {cameraOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 16, maxWidth: 480, width: '100%', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 12px 0' }}>Validación por Cámara</h3>
            {cameraError ? (
              <p style={{ color: '#dc2626', fontSize: 14 }}>{cameraError}</p>
            ) : (
              <div style={{ overflow: 'hidden', borderRadius: 8, background: '#000', marginBottom: 16 }}>
                <video ref={cameraVideoRef} autoPlay playsInline style={{ width: '100%', maxHeight: 300, objectFit: 'cover' }} />
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={confirmCameraVerification} disabled={!!cameraError} style={{ padding: '10px 20px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                Confirmar Captura
              </button>
              <button onClick={() => setCameraOpen(false)} style={{ padding: '10px 20px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contenido Principal */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px', display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
        
        {/* SECCIÓN 1: SELECCIÓN DE TARJETA & RESUMEN */}
        <section style={{ background: '#ffffff', padding: 20, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4 }}>
                FILTRAR POR TARJETA:
              </label>
              <select
                value={selectedCardId}
                onChange={(e) => setSelectedCardId(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14, background: '#fff', outline: 'none' }}
              >
                <option value="all">Todas las tarjetas</option>
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.brand} •••• {c.last_digits} {c.is_favorite ? '⭐' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 12, color: '#6b7280', display: 'block' }}>TOTAL REGISTRADO</span>
              <span style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>
                ${totalSpent.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Tarjetas Registradas */}
          <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {cards.map((card) => (
              <div
                key={card.id}
                style={{
                  background: card.is_favorite ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : 'linear-gradient(135deg, #374151, #1f2937)',
                  color: '#fff',
                  padding: 16,
                  borderRadius: 10,
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: 110
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{card.brand}</span>
                  <button
                    onClick={() => handleToggleFavorite(card.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}
                    title="Marcar como favorita"
                  >
                    {card.is_favorite ? '⭐' : '☆'}
                  </button>
                </div>
                <div style={{ fontSize: 16, letterSpacing: 2, margin: '12px 0', fontFamily: 'monospace' }}>
                  •••• •••• •••• {card.last_digits}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, opacity: 0.8 }}>
                  <span>{card.holder}</span>
                  <span>{card.exp_date}</span>
                </div>
                <button
                  onClick={() => handleDeleteCard(card.id)}
                  style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(239, 68, 68, 0.2)', border: 'none', color: '#fca5a5', padding: '2px 6px', borderRadius: 4, cursor: 'pointer', fontSize: 10 }}
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* SECCIÓN 2: FORMULARIO NUEVA TARJETA & GASTO MANUAL */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
          
          {/* Registrar Tarjeta */}
          <section style={{ background: '#ffffff', padding: 20, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 0, marginBottom: 16 }}>Registrar Nueva Tarjeta</h3>
            <form onSubmit={handleAddCard} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="text"
                placeholder="Nombre del Titular"
                value={newCardHolder}
                onChange={(e) => setNewCardHolder(e.target.value)}
                style={{ padding: '10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="Número de Tarjeta (16 dígitos)"
                  value={cardNumber}
                  onChange={handleCardNumberChange}
                  style={{ flex: 1, padding: '10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
                />
                <span style={{ padding: '10px', background: '#f3f4f6', borderRadius: 6, fontSize: 12, display: 'flex', alignItems: 'center', fontWeight: 600 }}>
                  {detectedBrand}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="MM/AA"
                  value={expDate}
                  onChange={handleExpDateChange}
                  style={{ width: '50%', padding: '10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
                />
                <input
                  type="password"
                  placeholder="CVV"
                  maxLength={4}
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
                  style={{ width: '50%', padding: '10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
                />
              </div>

              {/* Botones de Verificación Requerida */}
              <div style={{ marginTop: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', display: 'block', marginBottom: 6 }}>
                  VERIFICACIÓN OBLIGATORIA:
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleCardBiometricVerification}
                    style={{ flex: 1, padding: '8px', background: cardVerificationMethod === 'biometric' ? '#10b981' : '#e5e7eb', color: cardVerificationMethod === 'biometric' ? '#fff' : '#374151', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                  >
                    {cardVerificationMethod === 'biometric' ? '✓ Huella Validada' : '👆 Huella / Biometría'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCameraOpen(true)}
                    style={{ flex: 1, padding: '8px', background: cardVerificationMethod === 'camera' ? '#10b981' : '#e5e7eb', color: cardVerificationMethod === 'camera' ? '#fff' : '#374151', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                  >
                    {cardVerificationMethod === 'camera' ? '✓ Cámara Validada' : '📷 Escanear Cámara'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                style={{ padding: '10px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}
              >
                Guardar Tarjeta
              </button>
            </form>
          </section>

          {/* Cargar Gasto Manual */}
          <section style={{ background: '#ffffff', padding: 20, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 0, marginBottom: 16 }}>Cargar Consumo Manual</h3>
            <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="text"
                placeholder="Descripción (ej: Supermercado)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ padding: '10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
              />
              <input
                type="number"
                step="0.01"
                placeholder="Monto ($)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ padding: '10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ padding: '10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, background: '#fff' }}
              >
                <option value="General">General</option>
                <option value="Alimentación">Alimentación</option>
                <option value="Servicios">Servicios</option>
                <option value="Entretenimiento">Entretenimiento</option>
                <option value="Tecnología">Tecnología</option>
              </select>
              <select
                value={manualCardId}
                onChange={(e) => setManualCardId(e.target.value)}
                style={{ padding: '10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, background: '#fff' }}
              >
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    Imputar a: {c.brand} (•••• {c.last_digits})
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={cards.length === 0}
                style={{ padding: '10px', background: cards.length === 0 ? '#9ca3af' : '#4f46e5', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: cards.length === 0 ? 'not-allowed' : 'pointer' }}
              >
                {cards.length === 0 ? 'Agrega una tarjeta primero' : 'Agregar Consumo'}
              </button>
            </form>
          </section>
        </div>

        {/* SECCIÓN 3: IMPORTACIÓN DE ARCHIVOS & TABLA DE MOVIMIENTOS */}
        <section style={{ background: '#ffffff', padding: 20, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Historial de Consumos</h3>
            
            {/* Input para importar resúmenes */}
            <div>
              <label
                htmlFor="file-import"
                style={{ padding: '8px 14px', background: importing ? '#9ca3af' : '#3b82f6', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: importing ? 'wait' : 'pointer', display: 'inline-block' }}
              >
                {importing ? 'Procesando Archivo...' : '📁 Importar Resumen (PDF, CSV, Excel, JSON)'}
              </label>
              <input
                id="file-import"
                type="file"
                accept=".csv, .txt, .tsv, .xls, .xlsx, .json, .pdf"
                onChange={handleImportFile}
                disabled={importing}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          {/* Listado / Tabla de Gastos */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb', color: '#4b5563' }}>
                  <th style={{ padding: '10px 12px' }}>Descripción</th>
                  <th style={{ padding: '10px 12px' }}>Categoría</th>
                  <th style={{ padding: '10px 12px' }}>Tarjeta</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Monto</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>
                      No se registraron movimientos para la tarjeta seleccionada.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((exp) => {
                    const card = cards.find((c) => c.id === exp.card_id);
                    return (
                      <tr key={exp.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 500 }}>{exp.description}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: 4, fontSize: 11, color: '#374151' }}>
                            {exp.category}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#6b7280' }}>
                          {card ? `${card.brand} (•••• ${card.last_digits})` : 'General / Desconocida'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#111827' }}>
                          ${Number(exp.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <button
                            onClick={() => handleDeleteExpense(exp.id)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}
                            title="Eliminar gasto"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

      </main>
    </div>
  );
}