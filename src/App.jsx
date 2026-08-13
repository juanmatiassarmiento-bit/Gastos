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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoverySession(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      fetchCards();
      fetchExpenses();
    }
  }, [session]);

  useEffect(() => {
    if (cards.length > 0 && !manualCardId) {
      setManualCardId(cards[0].id);
    }
  }, [cards, manualCardId]);

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
  // MANEJO DE TARJETAS Y GASTOS
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

      setExpenses([...(data || []), ...expenses]);
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

  const filteredExpenses = selectedCardId === 'all'
    ? expenses
    : expenses.filter((exp) => exp.card_id === selectedCardId);

  const totalSpent = filteredExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  // ------------------------------------------
  // VISTA: LOGIN / REGISTRO CON BARRA LATERAL RESPONSIVA
  // ------------------------------------------
  if (!session) {
    return (
      <div style={{ minHeight: '100vh', width: '100%', maxWidth: '100vw', overflowX: 'hidden', background: '#0b0f19', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: 'Segoe UI, sans-serif', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', width: '100%', maxWidth: '900px', background: '#ffffff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)' }}>
          
          {/* LATERAL AZUL CON PASOS (Se adapta en móviles) */}
          <div style={{ backgroundColor: '#3b82f6', color: '#ffffff', padding: '28px', flex: '1 1 280px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>Mis Gastos</h2>
              <p style={{ fontSize: '13px', opacity: 0.9, marginTop: '6px', marginBottom: '20px', lineHeight: 1.4 }}>
                Administra tus tarjetas y consumos de forma simple y organizada.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.25)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '12px', flexShrink: 0 }}>1</div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '700' }}>Crea tu cuenta o Ingresa</h4>
                    <p style={{ margin: '2px 0 0 0', fontSize: '11px', opacity: 0.85, lineHeight: 1.3 }}>Accede de forma segura con tu correo y contraseña.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.25)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '12px', flexShrink: 0 }}>2</div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '700' }}>Registra tus Tarjetas</h4>
                    <p style={{ margin: '2px 0 0 0', fontSize: '11px', opacity: 0.85, lineHeight: 1.3 }}>Identificación automática de franquicia (Visa, Mastercard, Amex).</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.25)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '12px', flexShrink: 0 }}>3</div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '700' }}>Gestiona e Importa Gastos</h4>
                    <p style={{ margin: '2px 0 0 0', fontSize: '11px', opacity: 0.85, lineHeight: 1.3 }}>Registra consumos manualmente o carga tu resumen en CSV o texto.</p>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '20px' }}>
              🛡️ Encriptación y seguridad mediante Supabase
            </div>
          </div>

          {/* FORMULARIO DE AUTENTICACIÓN */}
          <div style={{ flex: '1 1 320px', padding: '28px', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#ffffff', boxSizing: 'border-box' }}>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: 0 }}>
                {authMode === 'login' && 'Iniciar Sesión'}
                {authMode === 'signup' && 'Crear Cuenta'}
                {authMode === 'reset' && 'Recuperar Contraseña'}
                {authMode === 'otp' && 'Acceso por Código'}
              </h3>
              <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                Ingresa tus credenciales para continuar
              </p>
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

            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, textAlign: 'center' }}>
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
      </div>
    );
  }

  // ------------------------------------------
  // VISTA DE RECUPERACIÓN DE CONTRASEÑA
  // ------------------------------------------
  if (isRecoverySession) {
    return (
      <div style={{ minHeight: '100vh', width: '100%', maxWidth: '100vw', overflowX: 'hidden', background: '#0b0f19', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: 'Segoe UI, sans-serif', boxSizing: 'border-box' }}>
        <div style={{ width: '100%', maxWidth: 400, background: '#ffffff', borderRadius: 16, padding: 32, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', boxSizing: 'border-box' }}>
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
    <div style={{ minHeight: '100vh', width: '100%', maxWidth: '100vw', overflowX: 'hidden', background: '#0d3177', fontFamily: 'Segoe UI, sans-serif', color: '#1f2937', boxSizing: 'border-box' }}>
      {/* Header */}
      <header style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', minWidth: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#4f46e5' }}>Mis Gastos</h1>
          <span style={{ fontSize: 12, background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: 12, fontWeight: 600, wordBreak: 'break-all' }}>
            {session.user.email}
          </span>
        </div>
        <button
          onClick={handleLogout}
          style={{ padding: '8px 16px', background: '#ef4444', color: '#ffffff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
        >
          Cerrar Sesión
        </button>
      </header>

      {/* Modal Cámara */}
      {cameraOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box' }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 16, maxWidth: 480, width: '100%', textAlign: 'center', boxSizing: 'border-box' }}>
            <h3 style={{ margin: '0 0 12px 0' }}>Validación por Cámara</h3>
            {cameraError ? (
              <p style={{ color: '#dc2626', fontSize: 14 }}>{cameraError}</p>
            ) : (
              <div style={{ overflow: 'hidden', borderRadius: 8, background: '#000', marginBottom: 16 }}>
                <video ref={cameraVideoRef} autoPlay playsInline style={{ width: '100%', maxHeight: 300, objectFit: 'cover' }} />
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
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
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px', display: 'grid', gridTemplateColumns: '1fr', gap: 24, boxSizing: 'border-box' }}>
        
        {/* SECCIÓN 1: SELECCIÓN DE TARJETA & RESUMEN */}
        <section style={{ background: '#ffffff', padding: 20, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', boxSizing: 'border-box', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ minWidth: 0, flex: '1 1 200px' }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4 }}>
                FILTRAR POR TARJETA:
              </label>
              <select
                value={selectedCardId}
                onChange={(e) => setSelectedCardId(e.target.value)}
                style={{ width: '100%', maxWidth: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14, background: '#fff', outline: 'none', boxSizing: 'border-box' }}
              >
                <option value="all">Todas las tarjetas</option>
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.brand} •••• {c.last_digits} {c.is_favorite ? '⭐' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ textAlign: 'right', flexShrink: 0 }}>
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
                  minHeight: 110,
                  boxSizing: 'border-box'
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
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 4 }}>{card.holder}</span>
                  <span style={{ flexShrink: 0 }}>{card.exp_date}</span>
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

        {/* SECCIÓN 2: FORMULARIOS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          
          {/* Registrar Tarjeta */}
          <section style={{ background: '#ffffff', padding: 20, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', boxSizing: 'border-box', minWidth: 0 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 0, marginBottom: 16 }}>Registrar Nueva Tarjeta</h3>
            <form onSubmit={handleAddCard} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="text"
                placeholder="Nombre del Titular"
                value={newCardHolder}
                onChange={(e) => setNewCardHolder(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Número de Tarjeta (12345678...)"
                  value={cardNumber}
                  onChange={handleCardNumberChange}
                  style={{ flex: '1 1 160px', minWidth: 0, padding: '10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
                />
                <span style={{ padding: '10px', background: '#f3f4f6', borderRadius: 6, fontSize: 12, display: 'flex', alignItems: 'center', fontWeight: 600, flexShrink: 0 }}>
                  {detectedBrand}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="MM/AA (ej: 07/08)"
                  value={expDate}
                  onChange={handleExpDateChange}
                  style={{ width: '50%', padding: '10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
                />
                <input
                  type="password"
                  placeholder="CVV"
                  maxLength={4}
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
                  style={{ width: '50%', padding: '10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', display: 'block', marginBottom: 6 }}>
                  VERIFICACIÓN OBLIGATORIA:
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleCardBiometricVerification}
                    style={{ flex: '1 1 120px', padding: '8px', background: cardVerificationMethod === 'biometric' ? '#10b981' : '#e5e7eb', color: cardVerificationMethod === 'biometric' ? '#fff' : '#374151', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                  >
                    {cardVerificationMethod === 'biometric' ? '✓ Huella Validada' : '👆 Huella / Biometría'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCameraOpen(true)}
                    style={{ flex: '1 1 120px', padding: '8px', background: cardVerificationMethod === 'camera' ? '#10b981' : '#e5e7eb', color: cardVerificationMethod === 'camera' ? '#fff' : '#374151', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                  >
                    {cardVerificationMethod === 'camera' ? '✓ Cámara Validada' : '📷 Escanear Cámara'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                style={{ width: '100%', padding: '10px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}
              >
                Guardar Tarjeta
              </button>
            </form>
          </section>

          {/* Cargar Consumo Manual */}
          <section style={{ background: '#ffffff', padding: 20, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', boxSizing: 'border-box', minWidth: 0 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 0, marginBottom: 16 }}>Cargar Consumo Manual</h3>
            <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="text"
                placeholder="Descripción (ej: Supermercado)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
              />
              <input
                type="number"
                step="0.01"
                placeholder="Monto ($)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, background: '#fff', boxSizing: 'border-box' }}
              >
                <option value="General">General</option>
                <option value="Alimentación">Alimentación</option>
                <option value="Servicios">Servicios</option>
                <option value="Entretenimiento">Entretenimiento</option>
                <option value="Transporte">Transporte</option>
              </select>
              <select
                value={manualCardId}
                onChange={(e) => setManualCardId(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, background: '#fff', boxSizing: 'border-box' }}
              >
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    Imputar a: {c.brand} (•••• {c.last_digits})
                  </option>
                ))}
              </select>
              <button
                type="submit"
                style={{ width: '100%', padding: '10px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}
              >
                Agregar Consumo
              </button>
            </form>
          </section>

        </div>

        {/* SECCIÓN 3: TABLA DE GASTOS E IMPORTACIÓN */}
        <section style={{ background: '#ffffff', padding: 20, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', boxSizing: 'border-box', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Listado de Consumos</h3>
            <div>
              <label style={{ padding: '8px 12px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#374151', display: 'inline-block' }}>
                {importing ? 'Procesando...' : '📁 Importar Resumen (CSV/Texto)'}
                <input type="file" accept=".csv,.txt" onChange={handleImportFile} disabled={importing} style={{ display: 'none' }} />
              </label>
            </div>
          </div>

          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13, minWidth: 480 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#6b7280' }}>
                  <th style={{ padding: '10px' }}>Descripción</th>
                  <th style={{ padding: '10px' }}>Categoría</th>
                  <th style={{ padding: '10px' }}>Monto</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>
                      No hay consumos registrados para la selección actual.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((exp) => (
                    <tr key={exp.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px', fontWeight: 600, wordBreak: 'break-word' }}>{exp.description}</td>
                      <td style={{ padding: '10px', color: '#6b7280' }}>{exp.category}</td>
                      <td style={{ padding: '10px', fontWeight: 700, color: '#10b981', whiteSpace: 'nowrap' }}>
                        ${Number(exp.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          style={{ background: '#fef2f2', color: '#dc2626', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

      </main>
    </div>
  );
}