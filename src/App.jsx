import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createClient } from '@supabase/supabase-js';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

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
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .order('is_favorite', { ascending: false });

    if (!error && data) {
      setCards(data);
      if (data.length > 0 && !manualCardId) {
        const favCard = data.find(c => c.is_favorite);
        setManualCardId(favCard ? favCard.id : data[0].id);
      }
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

  // Marcar/Desmarcar una sola tarjeta como favorita (Estrella Amarilla)
  const handleToggleFavorite = async (cardId) => {
    const targetCard = cards.find(c => c.id === cardId);
    if (!targetCard) return;

    const newFavoriteStatus = !targetCard.is_favorite;

    // Si se activa como favorita, se quita el estado a las demás tarjetas en la BD
    if (newFavoriteStatus) {
      await supabase
        .from('cards')
        .update({ is_favorite: false })
        .eq('user_id', session?.user?.id);
    }

    const { error } = await supabase
      .from('cards')
      .update({ is_favorite: newFavoriteStatus })
      .eq('id', cardId);

    if (!error) {
      const updatedCards = cards.map(c => {
        if (c.id === cardId) return { ...c, is_favorite: newFavoriteStatus };
        if (newFavoriteStatus) return { ...c, is_favorite: false };
        return c;
      });

      // Reordenamos localmente para que la favorita quede de primera al instante
      updatedCards.sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0));
      setCards(updatedCards);
    } else {
      alert('Error al actualizar tarjeta favorita: ' + error.message);
    }
  };

  const handleAddCard = async (e) => {
    e.preventDefault();
    if (!cardVerificationMethod) {
      return alert('Antes de guardar la tarjeta, valida el registro con huella/biometría o mediante la cámara.');
    }
    if (!newCardHolder || cardNumber.length < 13 || expDate.length < 5 || cvv.length < 3) {
      return alert('Completa todos los datos requeridos de la tarjeta (titular, número completo, MM/AA y CVV).');
    }

    // Impide agregar más de una vez la misma tarjeta
    const isDuplicate = cards.some(c => c.card_number === cardNumber);
    if (isDuplicate) {
      return alert('⚠️ Esta tarjeta ya se encuentra registrada en tu cuenta.');
    }

    const lastDigits = cardNumber.slice(-4);

    const cardPayload = {
      holder: newCardHolder,
      card_number: cardNumber,
      last_digits: lastDigits,
      brand: detectedBrand,
      exp_date: expDate,
      cvv: cvv,
      user_id: session?.user?.id,
      is_favorite: cards.length === 0
    };

    let { data, error } = await supabase.from('cards').insert([cardPayload]).select();

    if (error) {
      alert('Error al guardar la tarjeta: ' + error.message);
    } else if (data) {
      const updatedCards = [...cards, data[0]];
      updatedCards.sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0));
      setCards(updatedCards);

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

  const handleDeleteCard = async (cardId) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta tarjeta? Se mantendrán los consumos asociados.')) return;
    const { error } = await supabase.from('cards').delete().eq('id', cardId);
    if (!error) {
      const updated = cards.filter(c => c.id !== cardId);
      setCards(updated);
      if (selectedCardId === cardId) setSelectedCardId('all');
      if (manualCardId === cardId) setManualCardId(updated.length > 0 ? updated[0].id : '');
    } else {
      alert('Error al eliminar tarjeta: ' + error.message);
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

  const extractPdfRows = async (file) => {
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const rows = [];
    const amountAtEnd = /((?:[$€£]\s*)?-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|-?\d+(?:[.,]\d{2}))\s*$/;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const content = await (await pdf.getPage(pageNumber)).getTextContent();
      const linesByPosition = new Map();
      content.items.forEach((item) => {
        if (!('str' in item) || !item.str.trim()) return;
        const y = Math.round(item.transform[5]);
        const line = linesByPosition.get(y) || [];
        line.push({ x: item.transform[4], text: item.str });
        linesByPosition.set(y, line);
      });

      [...linesByPosition.entries()]
        .sort(([firstY], [secondY]) => secondY - firstY)
        .map(([, items]) => items.sort((a, b) => a.x - b.x).map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim())
        .forEach((line) => {
          const match = line.match(amountAtEnd);
          if (!match) return;
          const description = line.slice(0, match.index).trim();
          if (description.length < 3) return;
          rows.push({ description, amount: match[1], category: 'Importado desde PDF' });
        });
    }

    if (!rows.length) throw new Error('No encontramos movimientos legibles. El PDF debe contener texto seleccionable y montos por línea.');
    return rows;
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
      } else if (extension === 'pdf') {
        rows = await extractPdfRows(file);
      } else if (extension === 'json') {
        const json = JSON.parse(await file.text());
        rows = Array.isArray(json) ? json : (json.data || json.movements || json.movimientos || []);
      } else if (['csv', 'txt', 'tsv'].includes(extension)) {
        rows = Papa.parse(await file.text(), { header: true, skipEmptyLines: true, delimiter: extension === 'tsv' ? '\t' : '' }).data;
      } else {
        throw new Error('Formato no compatible. Usa CSV, TXT, TSV, XLS, XLSX, JSON o PDF.');
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
            
            {/* BANNER IZQUIERDO */}
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
                      <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#c7d2fe', lineHeight: 1.4 }}>Registra consumos manualmente o carga tu resumen en CSV, PDF o Excel.</p>
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
                      style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 20, letterSpacing: 8, textAlign: 'center', boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={verifyingCode}
                  style={{ width: '100%', padding: '12px', background: '#4f46e5', color: '#ffffff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}
                >
                  {authMode === 'login' && 'Iniciar Sesión'}
                  {authMode === 'signup' && 'Crear Cuenta'}
                  {authMode === 'reset' && 'Enviar Correo de Recuperación'}
                  {authMode === 'otp' && (verificationCodeSent ? (verifyingCode ? 'Verificando...' : 'Ingresar con Código') : (verifyingCode ? 'Enviando...' : 'Enviar Código'))}
                </button>
              </form>

              <div style={{ marginTop: 20, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {authMode === 'login' && (
                  <>
                    <button type="button" onClick={openCodeLogin} style={{ background: 'none', border: 'none', color: '#4f46e5', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      🔑 Ingresar con un código temporal al correo
                    </button>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>
                      ¿No tienes una cuenta?{' '}
                      <span onClick={() => { setAuthMode('signup'); setAuthMessage(null); }} style={{ color: '#4f46e5', fontWeight: 600, cursor: 'pointer' }}>
                        Regístrate aquí
                      </span>
                    </span>
                  </>
                )}

                {authMode === 'signup' && (
                  <span style={{ fontSize: 13, color: '#6b7280' }}>
                    ¿Ya tienes cuenta?{' '}
                    <span onClick={() => { setAuthMode('login'); setAuthMessage(null); }} style={{ color: '#4f46e5', fontWeight: 600, cursor: 'pointer' }}>
                      Inicia sesión
                    </span>
                  </span>
                )}

                {(authMode === 'reset' || authMode === 'otp') && (
                  <button type="button" onClick={() => { setAuthMode('login'); setAuthMessage(null); setVerificationCodeSent(false); }} style={{ background: 'none', border: 'none', color: '#4f46e5', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    ← Volver al inicio de sesión
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // VISTA RECUPERACIÓN DE CONTRASEÑA
  if (isRecoverySession) {
    return (
      <div style={{ minHeight: '100vh', background: '#0b0f19', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: 'Segoe UI, sans-serif' }}>
        <div style={{ width: '100%', maxWidth: 400, background: '#ffffff', borderRadius: 16, padding: '32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 8px 0' }}>Establecer Nueva Contraseña</h3>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px 0' }}>Ingresa la nueva clave con la que accederás a tu cuenta.</p>
          <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>NUEVA CONTRASEÑA</label>
              <input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
            <button
              type="submit"
              disabled={updatingPassword}
              style={{ width: '100%', padding: '12px', background: '#4f46e5', color: '#ffffff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              {updatingPassword ? 'Guardando...' : 'Actualizar Contraseña'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // VISTA PRINCIPAL (PANEL DE CONTROL)
  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', color: '#1f2937', fontFamily: 'Segoe UI, sans-serif' }}>
      {/* NAVBAR */}
      <header style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#111827' }}>Mis Gastos</h1>
          <span style={{ fontSize: 12, color: '#6b7280' }}>{session.user.email}</span>
        </div>
        <button
          onClick={handleLogout}
          style={{ padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Cerrar Sesión
        </button>
      </header>

      <main style={{ maxWidth: 1100, margin: '24px auto', padding: '0 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
        {/* SECCIÓN IZQUIERDA: FORMULARIOS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* REGISTRAR TARJETA */}
          <div style={{ background: '#ffffff', padding: 20, borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px 0', color: '#111827' }}>Registrar Nueva Tarjeta</h2>
            
            {/* Botones de Verificación / Validación */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <button
                type="button"
                onClick={handleCardBiometricVerification}
                style={{ flex: 1, padding: '10px', background: cardVerificationMethod === 'biometric' ? '#dcfce7' : '#f3f4f6', border: `1px solid ${cardVerificationMethod === 'biometric' ? '#22c55e' : '#d1d5db'}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                {cardVerificationMethod === 'biometric' ? '✓ Huella Validada' : '👆 Probar Biometría'}
              </button>
              <button
                type="button"
                onClick={() => setCameraOpen(!cameraOpen)}
                style={{ flex: 1, padding: '10px', background: cardVerificationMethod === 'camera' ? '#dcfce7' : '#f3f4f6', border: `1px solid ${cardVerificationMethod === 'camera' ? '#22c55e' : '#d1d5db'}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                {cardVerificationMethod === 'camera' ? '✓ Cámara Validada' : '📷 Usar Cámara'}
              </button>
            </div>

            {/* Modal de Cámara */}
            {cameraOpen && (
              <div style={{ marginBottom: 16, background: '#000', borderRadius: 8, overflow: 'hidden', padding: 8, textAlign: 'center' }}>
                {cameraError ? (
                  <p style={{ color: '#ef4444', fontSize: 12, margin: 8 }}>{cameraError}</p>
                ) : (
                  <>
                    <video ref={cameraVideoRef} autoPlay playsInline style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 6 }} />
                    <button type="button" onClick={confirmCameraVerification} style={{ marginTop: 8, padding: '6px 16px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Confirmar Validación por Cámara
                    </button>
                  </>
                )}
              </div>
            )}

            <form onSubmit={handleAddCard} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', display: 'block', marginBottom: 4 }}>TITULAR</label>
                <input
                  type="text"
                  placeholder="Nombre como figura en la tarjeta"
                  value={newCardHolder}
                  onChange={(e) => setNewCardHolder(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#4b5563' }}>NÚMERO DE TARJETA</label>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#4f46e5' }}>{detectedBrand}</span>
                </div>
                <input
                  type="text"
                  placeholder="16 dígitos de la tarjeta"
                  value={cardNumber}
                  onChange={handleCardNumberChange}
                  style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', display: 'block', marginBottom: 4 }}>VENCIMIENTO</label>
                  <input
                    type="text"
                    placeholder="MM/AA"
                    value={expDate}
                    onChange={handleExpDateChange}
                    style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', display: 'block', marginBottom: 4 }}>CVV</label>
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="123"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
                    style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                style={{ width: '100%', padding: '10px', background: '#10b981', color: '#ffffff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 4 }}
              >
                Guardar Tarjeta
              </button>
            </form>
          </div>

          {/* AGREGAR GASTO MANUAL */}
          <div style={{ background: '#ffffff', padding: 20, borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px 0', color: '#111827' }}>Registrar Gasto Manual</h2>
            <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', display: 'block', marginBottom: 4 }}>TARJETA</label>
                <select
                  value={manualCardId}
                  onChange={(e) => setManualCardId(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
                >
                  <option value="" disabled>Selecciona una tarjeta</option>
                  {cards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.brand} - **** {card.last_digits} ({card.holder})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', display: 'block', marginBottom: 4 }}>DESCRIPCIÓN</label>
                <input
                  type="text"
                  placeholder="Ej: Supermercado, Nafta, Netflix"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', display: 'block', marginBottom: 4 }}>MONTO ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', display: 'block', marginBottom: 4 }}>CATEGORÍA</label>
                  <input
                    type="text"
                    placeholder="General"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                style={{ width: '100%', padding: '10px', background: '#4f46e5', color: '#ffffff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 4 }}
              >
                Agregar Gasto
              </button>
            </form>
          </div>
        </div>

        {/* SECCIÓN DERECHA: TARJETAS, IMPORTADOR Y LISTADO DE GASTOS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* TARJETAS REGISTRADAS */}
          <div style={{ background: '#ffffff', padding: 20, borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px 0', color: '#111827' }}>Tus Tarjetas</h2>
            {cards.length === 0 ? (
              <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>No tienes tarjetas registradas aún.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                {cards.map((card) => (
                  <div
                    key={card.id}
                    style={{
                      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                      color: '#ffffff',
                      padding: 16,
                      borderRadius: 10,
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      height: 120,
                      border: card.is_favorite ? '2px solid #eab308' : '1px solid transparent'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>{card.brand}</span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => handleToggleFavorite(card.id)}
                          title="Marcar como favorita"
                          style={{ background: 'none', border: 'none', color: card.is_favorite ? '#facc15' : '#64748b', cursor: 'pointer', fontSize: 16, padding: 0 }}
                        >
                          ★
                        </button>
                        <button
                          onClick={() => handleDeleteCard(card.id)}
                          title="Eliminar tarjeta"
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: 0 }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <div style={{ fontSize: 16, letterSpacing: 2, fontFamily: 'monospace' }}>
                      **** **** **** {card.last_digits}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#cbd5e1' }}>
                      <span>{card.holder}</span>
                      <span>{card.exp_date}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* LISTADO DE GASTOS E IMPORTACIÓN */}
          <div style={{ background: '#ffffff', padding: 20, borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#111827' }}>Historial de Gastos</h2>
                <span style={{ fontSize: 13, color: '#6b7280' }}>Total: <strong style={{ color: '#111827' }}>${totalSpent.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong></span>
              </div>

              {/* Filtro por Tarjeta */}
              <select
                value={selectedCardId}
                onChange={(e) => setSelectedCardId(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
              >
                <option value="all">Todas las tarjetas</option>
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>{c.brand} - **** {c.last_digits}</option>
                ))}
              </select>
            </div>

            {/* Botón Importar Archivo */}
            <div style={{ marginBottom: 16, padding: 12, background: '#f9fafb', borderRadius: 8, border: '1px dashed #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block' }}>Importar Movimientos</span>
                <span style={{ fontSize: 11, color: '#6b7280' }}>Soporta CSV, Excel, PDF, JSON</span>
              </div>
              <label style={{ padding: '6px 12px', background: importing ? '#9ca3af' : '#3b82f6', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: importing ? 'not-allowed' : 'pointer' }}>
                {importing ? 'Cargando...' : 'Subir Archivo'}
                <input type="file" accept=".csv,.xlsx,.xls,.pdf,.json,.txt,.tsv" onChange={handleImportFile} disabled={importing} style={{ display: 'none' }} />
              </label>
            </div>

            {/* Tabla / Lista de Gastos */}
            {filteredExpenses.length === 0 ? (
              <p style={{ fontSize: 13, color: '#6b7280', margin: '16px 0', textAlign: 'center' }}>No hay consumos registrados para el filtro seleccionado.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                      <th style={{ padding: '8px 4px', fontWeight: 600 }}>Concepto</th>
                      <th style={{ padding: '8px 4px', fontWeight: 600 }}>Categoría</th>
                      <th style={{ padding: '8px 4px', fontWeight: 600, textAlign: 'right' }}>Monto</th>
                      <th style={{ padding: '8px 4px', width: 30 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map((expense) => (
                      <tr key={expense.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '10px 4px', fontWeight: 500, color: '#111827' }}>{expense.description}</td>
                        <td style={{ padding: '10px 4px', color: '#6b7280' }}>
                          <span style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: 12, fontSize: 11 }}>{expense.category || 'General'}</span>
                        </td>
                        <td style={{ padding: '10px 4px', fontWeight: 600, textAlign: 'right', color: '#059669' }}>
                          ${Number(expense.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                          <button
                            onClick={() => handleDeleteExpense(expense.id)}
                            title="Eliminar gasto"
                            style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 14 }}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}