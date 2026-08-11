import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
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
  const [authMessage, setAuthMessage] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationCodeSent, setVerificationCodeSent] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);

  // Recuperación de contraseña
  const [isRecoverySession, setIsRecoverySession] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Estado de Tarjetas y Gastos
  const [cards, setCards] = useState([]);
  const [selectedCardId, setSelectedCardId] = useState('all');
  const [expenses, setExpenses] = useState([]);

  // Formulario Tarjeta
  const [newCardHolder, setNewCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expDate, setExpDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [detectedBrand, setDetectedBrand] = useState('Desconocida');
  const [cardVerificationMethod, setCardVerificationMethod] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const cameraVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);

  // Formulario Gasto Manual
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('General');
  const [manualCardId, setManualCardId] = useState('');

  const [importing, setImporting] = useState(false);

  const passwordRules = [
    { label: 'Al menos 8 caracteres', valid: password.length >= 8 },
    { label: 'Una letra minúscula (a-z)', valid: /[a-z]/.test(password) },
    { label: 'Una letra mayúscula (A-Z)', valid: /[A-Z]/.test(password) },
    { label: 'Un número (0-9)', valid: /\d/.test(password) },
    { label: 'Un símbolo (por ejemplo: ! @ # $ %)', valid: /[^A-Za-z0-9]/.test(password) },
  ];

  const getFriendlyAuthError = (error) => {
    const message = error?.message || '';
    if (/password should contain|password.*character/i.test(message)) {
      return 'Tu contraseña aún no cumple los requisitos de seguridad. Revisa los puntos marcados abajo y vuelve a intentarlo.';
    }
    if (/invalid login credentials/i.test(message)) {
      return 'El correo o la contraseña no son correctos. Revisa los datos e inténtalo nuevamente.';
    }
    return message || 'No pudimos completar la operación. Inténtalo de nuevo.';
  };

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

  useEffect(() => {
    if (!cameraOpen) return undefined;

    const startCamera = async () => {
      try {
        setCameraError('');
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        cameraStreamRef.current = stream;
        if (cameraVideoRef.current) cameraVideoRef.current.srcObject = stream;
      } catch (_) {
        setCameraError('No se pudo acceder a la cámara. Revisa los permisos del navegador o usa la huella del dispositivo.');
      }
    };

    startCamera();
    return () => {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    };
  }, [cameraOpen]);

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

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthMessage(null);
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
          setAuthMessage({
            type: 'error',
            text: 'Realizaste varios intentos seguidos. Espera unos minutos antes de solicitar otro correo.',
          });
        } else {
          setAuthMessage({
            type: 'error',
            text: 'No pudimos enviar el correo de recuperación. Verifica que el email sea correcto e inténtalo de nuevo en unos minutos.',
          });
        }
      } else {
        setAuthMessage({
          type: 'success',
          text: '¡Correo enviado! Revisa tu bandeja de entrada y la carpeta de correo no deseado para continuar.',
        });
      }
      return;
    }

    if (authMode === 'signup') {
      if (passwordRules.some((rule) => !rule.valid)) {
        setAuthMessage({
          type: 'error',
          text: 'Para proteger tu cuenta, crea una contraseña que cumpla todos los requisitos indicados.',
        });
        return;
      }
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          emailRedirectTo: window.location.origin
        }
      });
      if (error) setAuthMessage({ type: 'error', text: getFriendlyAuthError(error) });
      else setAuthMessage({ type: 'success', text: '¡Cuenta creada! Revisa tu correo para confirmar tu registro.' });
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setAuthMessage({ type: 'error', text: getFriendlyAuthError(error) });
    }
  };

  const handleSendVerificationCode = async (e) => {
    e.preventDefault();
    setAuthMessage(null);

    if (!IS_SUPABASE_VALID) {
      setAuthMessage({ type: 'error', text: 'No se pudo conectar con el servicio de acceso. Inténtalo más tarde.' });
      return;
    }

    setVerifyingCode(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    setVerifyingCode(false);

    if (error) {
      setAuthMessage({ type: 'error', text: 'No pudimos enviar el código. Verifica tu correo e inténtalo de nuevo en unos minutos.' });
      return;
    }

    setVerificationCode('');
    setVerificationCodeSent(true);
    setAuthMessage({ type: 'success', text: 'Te enviamos un código de 6 dígitos a tu correo. Escríbelo abajo para ingresar.' });
  };

  const handleVerifyVerificationCode = async (e) => {
    e.preventDefault();
    if (verificationCode.length !== 6) {
      setAuthMessage({ type: 'error', text: 'Ingresa los 6 dígitos del código de verificación.' });
      return;
    }

    setVerifyingCode(true);
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: verificationCode,
      type: 'email',
    });
    setVerifyingCode(false);

    if (error || !data?.session) {
      setAuthMessage({ type: 'error', text: 'El código es incorrecto o venció. Revisa los 6 dígitos o solicita uno nuevo.' });
      return;
    }

    setSession(data.session);
  };

  const openCodeLogin = () => {
    setAuthMode('otp');
    setAuthMessage(null);
    setVerificationCode('');
    setVerificationCodeSent(false);
  };

  const handleCardBiometricVerification = async () => {
    if (!window.PublicKeyCredential) {
      alert('Tu navegador o dispositivo no soporta autenticación biométrica. Puedes usar la cámara para continuar.');
      return;
    }
    try {
      const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!available) {
        alert('No detectamos huella o biometría configurada en este dispositivo. Puedes usar la cámara para continuar.');
        return;
      }
      setCardVerificationMethod('biometric');
    } catch (_) {
      alert('No se pudo verificar la biometría. Puedes usar la cámara para continuar.');
    }
  };

  const confirmCameraVerification = () => {
    if (!cameraStreamRef.current) return;
    setCardVerificationMethod('camera');
    setCameraOpen(false);
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
    if (!cardVerificationMethod) {
      return alert('Antes de guardar la tarjeta, valida el registro con huella/biometría o mediante la cámara.');
    }
    if (!newCardHolder || cardNumber.length < 13 || expDate.length < 5 || cvv.length < 3) {
      return alert('Completa todos los datos requeridos de la tarjeta (titular, número completo, MM/AA y CVV).');
    }

    const lastDigits = cardNumber.slice(-4);

    // Mapeo corregido enviando card_number para coincidir con la restricción de Supabase
    const cardPayload = {
      holder: newCardHolder,
      card_number: cardNumber,
      last_digits: lastDigits,
      brand: detectedBrand,
      exp_date: expDate,
      cvv: cvv,
      user_id: session?.user?.id
    };

    let { data, error } = await supabase.from('cards').insert([cardPayload]).select();

    if (error) {
      alert('Error al guardar la tarjeta: ' + error.message);
    } else if (data) {
      setCards([...cards, data[0]]);
      if (!manualCardId) setManualCardId(data[0].id);
      setNewCardHolder('');
      setCardNumber('');
      setExpDate('');
      setCvv('');
      setDetectedBrand('Desconocida');
      setCardVerificationMethod('');
      alert('¡Tarjeta guardada con éxito!');
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

  const importExpenseRows = async (rows, fileName) => {
    const newExpenses = rows.map((row) => {
      const keys = Object.keys(row || {});
      const getVal = (...possibleKeys) => {
        for (const key of possibleKeys) {
          const found = keys.find((column) => column.trim().toLowerCase() === key.toLowerCase());
          if (found && row[found] !== undefined && row[found] !== null) return String(row[found]).trim();
        }
        return '';
      };

      const rawDesc = getVal('description', 'descripción', 'descripcion', 'concepto', 'titulo', 'title', 'detail', 'external_reference', 'reason');
      const rawAmount = getVal('transaction_amount', 'amount', 'monto', 'importe', 'total', 'valor', 'net_amount');
      const rawCategory = getVal('category', 'categoría', 'categoria', 'type', 'tipo') || 'Importado';
      let cleanAmount = rawAmount.replace(/\$/g, '').replace(/\s/g, '');
      if (cleanAmount.includes(',') && cleanAmount.includes('.')) cleanAmount = cleanAmount.replace(/\./g, '').replace(',', '.');
      else if (cleanAmount.includes(',')) cleanAmount = cleanAmount.replace(',', '.');

      const amount = parseFloat(cleanAmount);
      return {
        description: rawDesc || 'Consumo importado',
        amount: Number.isNaN(amount) ? 0 : Math.abs(amount),
        category: rawCategory,
        card_id: selectedCardId,
        user_id: session?.user?.id,
      };
    }).filter((item) => item.amount > 0);

    if (newExpenses.length === 0) {
      alert(`No se encontraron consumos válidos en ${fileName}. Verifica que incluya columnas como descripción y monto.`);
      return;
    }

    const { data, error } = await supabase.from('expenses').insert(newExpenses).select();
    if (!error && data) {
      setExpenses([...data, ...expenses]);
      alert(`¡Éxito! Se importaron ${data.length} consumos.`);
    } else {
      alert('Error al guardar en Supabase: ' + (error?.message || 'Error desconocido'));
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (selectedCardId === 'all') {
      alert('Por favor selecciona una tarjeta específica antes de importar movimientos.');
      return;
    }

    setImporting(true);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      let rows;
      if (extension === 'xlsx' || extension === 'xls') {
        const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
      } else if (extension === 'json') {
        const json = JSON.parse(await file.text());
        rows = Array.isArray(json) ? json : (json.data || json.movements || json.movimientos || []);
      } else if (['csv', 'txt', 'tsv'].includes(extension)) {
        rows = Papa.parse(await file.text(), { header: true, skipEmptyLines: true, delimiter: extension === 'tsv' ? '\t' : '' }).data;
      } else {
        throw new Error('Formato no compatible. Usa CSV, TXT, TSV, XLS, XLSX o JSON.');
      }
      await importExpenseRows(rows, file.name);
    } catch (error) {
      alert('No se pudo leer el archivo: ' + error.message);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
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

  // VISTA AUTENTICACIÓN
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
            
            {/* BANNER IZQUIERDO CON 3 PASOS EXPLICATIVOS */}
            <div className="auth-banner" style={{ flex: '1 1 42%', background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)', padding: '32px 24px', color: '#ffffff', display: 'none', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 8px 0' }}>Mis Gastos</h2>
                <p style={{ fontSize: 13, color: '#e0e7ff', margin: '0 0 24px 0', lineHeight: 1.5 }}>Administra tus tarjetas y consumos de forma simple y organizada.</p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>1</div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Crea tu cuenta o Ingresa</h4>
                      <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#c7d2fe', lineHeight: 1.4 }}>Accede de forma segura con tu correo electrónico y contraseña.</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>2</div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Registra tus Tarjetas</h4>
                      <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#c7d2fe', lineHeight: 1.4 }}>Identificación automática de franquicia (Visa, Mastercard, Amex).</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>3</div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Gestiona e Importa Gastos</h4>
                      <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#c7d2fe', lineHeight: 1.4 }}>Registra consumos manualmente o carga tu resumen de Mercado Pago CSV.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 24, fontSize: 12, color: '#c7d2fe' }}>
                🛡️ Encriptación y seguridad mediante Supabase
              </div>
            </div>

            {/* FORMULARIO AUTENTICACIÓN */}
            <div style={{ flex: '1 1 58%', padding: '32px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxSizing: 'border-box' }}>
              <h3 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 6px 0' }}>
                {authMode === 'login' && 'Iniciar Sesión'}
                {authMode === 'signup' && 'Crear Cuenta'}
                {authMode === 'reset' && 'Recuperar Contraseña'}
                {authMode === 'otp' && 'Ingresar con código'}
              </h3>
              <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px 0' }}>
                {authMode === 'login' && 'Ingresa a tu panel de control'}
                {authMode === 'signup' && 'Completa tus datos para registrarte'}
                {authMode === 'reset' && 'Ingresa tu correo para recibir las instrucciones'}
                {authMode === 'otp' && (verificationCodeSent ? 'Escribe el código de 6 dígitos que enviamos a tu correo' : 'Te enviaremos un código de verificación para ingresar sin contraseña')}
              </p>

              {authMessage && (
                <div role={authMessage.type === 'error' ? 'alert' : 'status'} aria-live="polite" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 10, marginBottom: 18, background: authMessage.type === 'error' ? '#fef2f2' : '#ecfdf5', border: `1px solid ${authMessage.type === 'error' ? '#fecaca' : '#a7f3d0'}`, color: authMessage.type === 'error' ? '#991b1b' : '#065f46', fontSize: 13, lineHeight: 1.45 }}>
                  <span aria-hidden="true" style={{ fontWeight: 700, fontSize: 16 }}>{authMessage.type === 'error' ? '!' : '✓'}</span>
                  <span>{authMessage.text}</span>
                </div>
              )}

              <form onSubmit={authMode === 'otp' ? (verificationCodeSent ? handleVerifyVerificationCode : handleSendVerificationCode) : handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
                    CORREO ELECTRÓNICO
                  </label>
                  <input
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={authMode === 'otp' && verificationCodeSent}
                    required
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>

                {(authMode === 'login' || authMode === 'signup') && (
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
                      placeholder={authMode === 'signup' ? 'Crea una contraseña segura' : 'Ingresa tu contraseña'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (authMessage) setAuthMessage(null);
                      }}
                      required
                      aria-describedby={authMode === 'signup' ? 'password-requirements' : undefined}
                      style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: authMode === 'signup' && password && passwordRules.some((rule) => !rule.valid) ? '1px solid #f59e0b' : '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
                    />
                    {authMode === 'signup' && (
                      <div id="password-requirements" style={{ marginTop: 10, padding: '12px 14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <p style={{ margin: '0 0 8px 0', color: '#334155', fontSize: 12, fontWeight: 700 }}>Tu contraseña debe incluir:</p>
                        <div style={{ display: 'grid', gap: 6 }}>
                          {passwordRules.map((rule) => (
                            <div key={rule.label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: rule.valid ? '#047857' : '#64748b' }}>
                              <span aria-hidden="true" style={{ width: 17, height: 17, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: rule.valid ? '#d1fae5' : '#e2e8f0', color: rule.valid ? '#047857' : '#64748b', fontWeight: 700 }}>{rule.valid ? '✓' : '•'}</span>
                              {rule.label}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {authMode === 'otp' && verificationCodeSent && (
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
                      CÓDIGO DE VERIFICACIÓN
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                      maxLength={6}
                      value={verificationCode}
                      onChange={(e) => {
                        setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                        if (authMessage?.type === 'error') setAuthMessage(null);
                      }}
                      required
                      style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 18, letterSpacing: 6, textAlign: 'center', boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authMode === 'otp' && verifyingCode}
                  style={{ width: '100%', padding: '14px', background: '#4f46e5', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 15, cursor: 'pointer', marginTop: 8 }}
                >
                  {authMode === 'login' && 'Ingresar'}
                  {authMode === 'signup' && 'Registrarse'}
                  {authMode === 'reset' && 'Enviar Correo de Recuperación'}
                  {authMode === 'otp' && (verifyingCode ? (verificationCodeSent ? 'Verificando...' : 'Enviando código...') : (verificationCodeSent ? 'Verificar e ingresar' : 'Enviar código de verificación'))}
                </button>
              </form>

              <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#4b5563', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {authMode === 'login' && (
                  <>
                    <div>¿No tienes cuenta aún? <span onClick={() => setAuthMode('signup')} style={{ color: '#4f46e5', fontWeight: 600, cursor: 'pointer' }}>Regístrate aquí</span></div>
                    <div>¿No recuerdas tu contraseña? <span onClick={openCodeLogin} style={{ color: '#4f46e5', fontWeight: 600, cursor: 'pointer' }}>Ingresa con un código</span></div>
                  </>
                )}
                {authMode === 'signup' && (
                  <div>¿Ya tienes cuenta? <span onClick={() => setAuthMode('login')} style={{ color: '#4f46e5', fontWeight: 600, cursor: 'pointer' }}>Inicia sesión aquí</span></div>
                )}
                {authMode === 'reset' && (
                  <div><span onClick={() => setAuthMode('login')} style={{ color: '#4f46e5', fontWeight: 600, cursor: 'pointer' }}>← Volver a Iniciar Sesión</span></div>
                )}
                {authMode === 'otp' && (
                  <div>
                    {verificationCodeSent && <span onClick={() => { setVerificationCode(''); setVerificationCodeSent(false); setAuthMessage(null); }} style={{ color: '#4f46e5', fontWeight: 600, cursor: 'pointer', marginRight: 14 }}>Enviar otro código</span>}
                    <span onClick={() => setAuthMode('login')} style={{ color: '#4f46e5', fontWeight: 600, cursor: 'pointer' }}>← Volver a Iniciar Sesión</span>
                  </div>
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
              <h4 style={{ margin: 0, color: '#818cf8', fontSize: 14 }}>📥 Importar movimientos</h4>
              <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#9ca3af' }}>CSV, Excel, TXT/TSV o JSON. Asocia automáticamente los consumos a la tarjeta elegida.</p>
            </div>
            <label style={{ background: importing ? '#4b5563' : '#4f46e5', color: '#fff', padding: '10px 16px', borderRadius: 8, fontWeight: 600, cursor: importing ? 'not-allowed' : 'pointer', fontSize: 13, textAlign: 'center', whiteSpace: 'nowrap' }}>
              {importing ? 'Importando...' : '⬆️ Seleccionar archivo'}
              <input type="file" accept=".csv,.txt,.tsv,.xls,.xlsx,.json" onChange={handleImportFile} disabled={importing} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        {/* FORMULARIOS: TARJETA Y GASTO MANUAL */}
        <div className="form-grid">
          
          {/* REGISTRAR TARJETA */}
          <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 12, padding: 16 }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 15, color: '#fff' }}>Registrar Tarjeta</h3>
            <div style={{ marginBottom: 14, padding: 12, borderRadius: 8, background: '#172554', border: '1px solid #3730a3' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: 13, color: '#e0e7ff', fontWeight: 600 }}>Valida el registro antes de guardar la tarjeta</p>
              <p style={{ margin: '0 0 10px 0', fontSize: 12, color: '#c7d2fe' }}>Elige huella/biometría del dispositivo o cámara. No guardamos imágenes de la cámara.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button type="button" onClick={handleCardBiometricVerification} style={{ padding: '8px 10px', background: cardVerificationMethod === 'biometric' ? '#059669' : '#312e81', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                  {cardVerificationMethod === 'biometric' ? '✓ Huella verificada' : 'Usar huella / biometría'}
                </button>
                <button type="button" onClick={() => setCameraOpen(true)} style={{ padding: '8px 10px', background: cardVerificationMethod === 'camera' ? '#059669' : '#312e81', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                  {cardVerificationMethod === 'camera' ? '✓ Cámara verificada' : 'Usar cámara'}
                </button>
              </div>
              {cameraOpen && (
                <div style={{ marginTop: 12 }}>
                  {cameraError ? <p style={{ margin: 0, color: '#fca5a5', fontSize: 12 }}>{cameraError}</p> : <video ref={cameraVideoRef} autoPlay playsInline style={{ width: '100%', maxHeight: 190, borderRadius: 6, background: '#020617' }} />}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button type="button" onClick={confirmCameraVerification} disabled={!!cameraError} style={{ padding: '8px 10px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, cursor: cameraError ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, opacity: cameraError ? 0.5 : 1 }}>Confirmar con cámara</button>
                    <button type="button" onClick={() => setCameraOpen(false)} style={{ padding: '8px 10px', background: '#374151', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Cancelar</button>
                  </div>
                </div>
              )}
            </div>
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
