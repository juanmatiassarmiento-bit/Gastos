import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { supabase } from './lib/supabase'
import { Plus, Trash2, TrendingUp } from 'lucide-react'
import './App.css'

const CATEGORIAS = [
  '🍕 Comida',
  '🚗 Transporte',
  '🛍️ Compras',
  '🎬 Entretenimiento',
  '💊 Salud',
  '📚 Educación',
  '🏠 Vivienda',
  '💰 Otro'
]

export default function App() {
  const [user, setUser] = useState(null)
  const [gastos, setGastos] = useState([])
<<<<<<< HEAD
  const [loading, setLoading] = useState(true)
=======
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [securityUnlocked, setSecurityUnlocked] = useState(false)
  const [selectedCardId, setSelectedCardId] = useState('')
>>>>>>> 9a955c4 (Initial commit)
  const [formData, setFormData] = useState({
    descripcion: '',
    monto: '',
    categoria: CATEGORIAS[0],
<<<<<<< HEAD
    fecha: new Date().toISOString().split('T')[0]
  })
  const [cards, setCards] = useState([])
=======
    fecha: new Date().toISOString().split('T')[0],
    tarjeta_id: ''
  })
>>>>>>> 9a955c4 (Initial commit)
  const [cardForm, setCardForm] = useState({
    holder: '',
    number: '',
    expiry: '',
    cvv: '',
    brand: 'Desconocida'
  })
  const [descriptionSuggestions, setDescriptionSuggestions] = useState([])
  const [holderSuggestions, setHolderSuggestions] = useState([])
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [installReady, setInstallReady] = useState(false)
  const [serverUrl, setServerUrl] = useState('')
  const [qrCodeUrl, setQrCodeUrl] = useState('')

  const saveSuggestions = (key, values) => {
    try {
      localStorage.setItem(key, JSON.stringify(values))
    } catch (error) {
      console.error('Error saving suggestions:', error)
    }
  }

  const loadSuggestions = () => {
    try {
      const storedDescriptions = localStorage.getItem('mis-gastos-description-suggestions')
      const storedHolders = localStorage.getItem('mis-gastos-holder-suggestions')
      if (storedDescriptions) setDescriptionSuggestions(JSON.parse(storedDescriptions))
      if (storedHolders) setHolderSuggestions(JSON.parse(storedHolders))
    } catch (error) {
      console.error('Error loading suggestions:', error)
    }
  }

  const addDescriptionSuggestion = (value) => {
    const trimmed = value.trim()
    if (!trimmed) return
    setDescriptionSuggestions((prev) => {
      const next = [trimmed, ...prev.filter((item) => item !== trimmed)].slice(0, 8)
      saveSuggestions('mis-gastos-description-suggestions', next)
      return next
    })
  }

  const addHolderSuggestion = (value) => {
    const trimmed = value.trim()
    if (!trimmed) return
    setHolderSuggestions((prev) => {
      const next = [trimmed, ...prev.filter((item) => item !== trimmed)].slice(0, 8)
      saveSuggestions('mis-gastos-holder-suggestions', next)
      return next
    })
  }

  const promptInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const choiceResult = await deferredPrompt.userChoice
      if (choiceResult.outcome === 'accepted') {
        setInstallReady(false)
      }
      setDeferredPrompt(null)
    } else {
      alert(
        'Si no aparece la instalación automática, abre el menú del navegador y selecciona "Añadir a pantalla de inicio" o "Instalar app".'
      )
    }
  }

  const CARD_BRAND_ICONS = {
    Visa: '💳',
    Mastercard: '💳',
    'American Express': '✴️',
    Discover: '🚀',
    JCB: '🈂️',
    'Diners Club': '💼',
    Maestro: '🎟️',
    Desconocida: '❓'
  }

  const detectCardBrand = (value) => {
    const digits = value.replace(/\D/g, '')
    if (/^4/.test(digits)) return 'Visa'
    if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard'
    if (/^3[47]/.test(digits)) return 'American Express'
    if (/^6(?:011|5)/.test(digits)) return 'Discover'
    if (/^(?:2131|1800|35)/.test(digits)) return 'JCB'
    if (/^3(?:0[0-5]|[68])/.test(digits)) return 'Diners Club'
    if (/^(5018|5020|5038|5612|5893|6304|6759|6761|6763)/.test(digits)) return 'Maestro'
    return 'Desconocida'
  }

  const formatCardNumber = (value) =>
    value
      .replace(/\D/g, '')
      .slice(0, 16)
      .replace(/(.{4})/g, '$1 ')
      .trim()

  const normalizeCardNumber = (value) => value.replace(/\D/g, '')

  const handleCardInputChange = (field, value) => {
    if (field === 'number') {
      const formatted = formatCardNumber(value)
      const brand = detectCardBrand(formatted)
      setCardForm({ ...cardForm, number: formatted, brand })
    } else {
      setCardForm({ ...cardForm, [field]: value })
    }
  }

<<<<<<< HEAD
  const loadCards = () => {
    try {
      const stored = localStorage.getItem('mis-gastos-cards')
      if (stored) setCards(JSON.parse(stored))
    } catch (error) {
      console.error('Error loading cards:', error)
    }
  }

  const saveCards = (nextCards) => {
    try {
      localStorage.setItem('mis-gastos-cards', JSON.stringify(nextCards))
    } catch (error) {
      console.error('Error saving cards:', error)
    }
  }

  const agregarTarjeta = (e) => {
    e.preventDefault()
    const digits = normalizeCardNumber(cardForm.number)

=======
  const cargarTarjetas = async () => {
    if (!user) return

    const { data, error } = await supabase
      .from('tarjetas')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error cargando tarjetas:', error)
    } else {
      setCards(data || [])
    }
  }

  const requestBiometricUnlock = async () => {
    if (!window.PublicKeyCredential) {
      alert('Biometría no está disponible en este navegador.')
      return
    }

    try {
      await navigator.credentials.get({
        publicKey: {
          challenge: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
          timeout: 60000,
          userVerification: 'preferred'
        }
      })
      setSecurityUnlocked(true)
    } catch (error) {
      console.error('Error en desbloqueo biométrico:', error)
      alert('No se pudo autenticar con biometría.')
    }
  }

  const agregarTarjeta = async (e) => {
    e.preventDefault()
    const digits = normalizeCardNumber(cardForm.number)

    if (!user) {
      alert('Debes iniciar sesión para guardar tarjetas.')
      return
    }

>>>>>>> 9a955c4 (Initial commit)
    if (!cardForm.holder || digits.length < 12 || !cardForm.expiry) {
      alert('Completa los datos de la tarjeta correctamente')
      return
    }

<<<<<<< HEAD
    const newCard = {
      id: Date.now(),
      brand: cardForm.brand,
      holder: cardForm.holder,
      maskedNumber: `•••• •••• •••• ${digits.slice(-4)}`,
      expiry: cardForm.expiry,
      created_at: new Date().toISOString()
    }

    const updated = [...cards, newCard]
    setCards(updated)
    saveCards(updated)
=======
    const { data, error } = await supabase
      .from('tarjetas')
      .insert([
        {
          user_id: user.id,
          nombre: cardForm.holder,
          ultimos_digitos: digits.slice(-4),
          tipo: cardForm.brand,
          color: '',
          es_activa: true
        }
      ])
      .select()
      .single()

    if (error) {
      console.error('Error guardando tarjeta:', error)
      alert('No se pudo guardar la tarjeta.')
      return
    }

    setCards([data, ...cards])
>>>>>>> 9a955c4 (Initial commit)
    addHolderSuggestion(cardForm.holder)
    setCardForm({ holder: '', number: '', expiry: '', cvv: '', brand: 'Desconocida' })
  }

<<<<<<< HEAD
  const eliminarTarjeta = (id) => {
    const updated = cards.filter((card) => card.id !== id)
    setCards(updated)
    saveCards(updated)
=======
  const eliminarTarjeta = async (id) => {
    const { error } = await supabase
      .from('tarjetas')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error eliminando tarjeta:', error)
      alert('No se pudo eliminar la tarjeta.')
      return
    }

    setCards(cards.filter((card) => card.id !== id))
    if (selectedCardId === id) {
      setSelectedCardId('')
      setSecurityUnlocked(false)
    }
>>>>>>> 9a955c4 (Initial commit)
  }

  // Chequear autenticación
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
      }
    )

    return () => subscription?.unsubscribe()
  }, [])

  // Cargar gastos
  useEffect(() => {
<<<<<<< HEAD
    loadCards()
=======
    cargarTarjetas()
>>>>>>> 9a955c4 (Initial commit)
    loadSuggestions()
  }, [])

  useEffect(() => {
    if (user) {
      cargarGastos()
<<<<<<< HEAD
=======
      cargarTarjetas()
>>>>>>> 9a955c4 (Initial commit)
    }
  }, [user])

  useEffect(() => {
    const beforeInstallHandler = (event) => {
      event.preventDefault()
      setDeferredPrompt(event)
      setInstallReady(true)
    }

    const installedHandler = () => {
      setInstallReady(false)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', beforeInstallHandler)
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstallHandler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  useEffect(() => {
    const origin = window.location.origin
    const hostname = window.location.hostname
    const localHost = hostname === 'localhost' || hostname === '127.0.0.1'
    setServerUrl(origin)

    if (!localHost) {
      QRCode.toDataURL(origin)
        .then((url) => setQrCodeUrl(url))
        .catch((error) => console.error('QR code error:', error))
    }
  }, [])

  async function cargarGastos() {
    setLoading(true)
    const { data, error } = await supabase
      .from('gastos')
<<<<<<< HEAD
      .select('*')
=======
      .select('*, tarjetas(*)')
>>>>>>> 9a955c4 (Initial commit)
      .order('fecha', { ascending: false })

    if (error) {
      console.error('Error:', error)
    } else {
      setGastos(data || [])
    }
    setLoading(false)
  }

  async function agregarGasto(e) {
    e.preventDefault()
    
<<<<<<< HEAD
    if (!formData.descripcion || !formData.monto) {
      alert('Completa todos los campos')
=======
    if (!formData.descripcion || !formData.monto || !formData.tarjeta_id) {
      alert('Completa todos los campos y selecciona una tarjeta')
>>>>>>> 9a955c4 (Initial commit)
      return
    }

    const { error } = await supabase
      .from('gastos')
      .insert([
        {
          descripcion: formData.descripcion,
          monto: parseFloat(formData.monto),
          categoria: formData.categoria,
<<<<<<< HEAD
          fecha: formData.fecha
=======
          fecha: formData.fecha,
          tarjeta_id: formData.tarjeta_id
>>>>>>> 9a955c4 (Initial commit)
        }
      ])

    if (error) {
      const message = error.message || JSON.stringify(error)
      alert(`Error al agregar gasto: ${message}`)
      console.error('Supabase insert error:', error)
    } else {
      addDescriptionSuggestion(formData.descripcion)
      setFormData({
        descripcion: '',
        monto: '',
        categoria: CATEGORIAS[0],
<<<<<<< HEAD
        fecha: new Date().toISOString().split('T')[0]
=======
        fecha: new Date().toISOString().split('T')[0],
        tarjeta_id: selectedCardId || ''
>>>>>>> 9a955c4 (Initial commit)
      })
      cargarGastos()
    }
  }

  async function eliminarGasto(id) {
    if (!confirm('¿Eliminar este gasto?')) return

    const { error } = await supabase
      .from('gastos')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Error al eliminar')
    } else {
      cargarGastos()
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    setGastos([])
  }

  // Calcular totales
  const totalGastos = gastos.reduce((sum, g) => sum + g.monto, 0)
  const gastoPorCategoria = gastos.reduce((acc, g) => {
    acc[g.categoria] = (acc[g.categoria] || 0) + g.monto
    return acc
  }, {})
<<<<<<< HEAD
=======
  const gastosPorTarjeta = selectedCardId
    ? gastos.filter((gasto) => gasto.tarjeta_id === selectedCardId)
    : []
  const gastosMostrar = selectedCardId ? gastosPorTarjeta : gastos
  const tarjetaSeleccionada = cards.find((card) => card.id === selectedCardId)
>>>>>>> 9a955c4 (Initial commit)

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>
  }

  if (!user) {
    return <Login setUser={setUser} />
  }

  return (
    <div className="app min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-md p-4">
        <div className="max-w-5xl mx-auto flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-lg">
              $
            </div>
            <div>
              <h1 className="text-2xl font-bold text-indigo-600">Mis Gastos</h1>
              <p className="text-sm text-gray-500">Administra gastos y tarjetas desde tu navegador.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 items-center justify-end">
            <button
              onClick={promptInstall}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              type="button"
            >
              Instalar app
            </button>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              type="button"
            >
              Salir
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto p-4 mt-6 space-y-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-3">Usar en tu teléfono</h2>
          <p className="text-sm text-gray-600 mb-4">
            Abre esta URL desde el navegador de tu móvil y luego usa "Añadir a pantalla de inicio" o "Instalar app".
          </p>
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex-1">
              <code className="block break-words bg-slate-100 p-3 rounded-lg text-sm text-slate-700">
                {serverUrl}
              </code>
              <p className="mt-2 text-xs text-gray-500">
                Si ves localhost, usa en tu teléfono la IP local de tu PC, por ejemplo <strong>http://192.168.x.x:5173</strong>.
              </p>
            </div>
            {qrCodeUrl ? (
              <img
                src={qrCodeUrl}
                alt="QR para abrir en el teléfono"
                className="w-40 h-40 rounded-xl border border-slate-200"
              />
            ) : (
              <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-700">
                Si tu navegador está en localhost, genera la URL de tu PC en la red local y escanéala desde el móvil.
              </div>
            )}
          </div>
        </div>
        {/* Resumen */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total este mes</p>
                <p className="text-3xl font-bold text-indigo-600">
                  ${totalGastos.toFixed(2)}
                </p>
              </div>
              <TrendingUp className="w-12 h-12 text-indigo-300" />
            </div>
          </div>

          {/* Categorías más gastadas */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-gray-600 text-sm mb-3">Top categorías</p>
            <div className="space-y-2">
              {Object.entries(gastoPorCategoria)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 3)
                .map(([cat, monto]) => (
                  <div key={cat} className="flex justify-between text-sm">
                    <span>{cat}</span>
                    <span className="font-semibold">${monto.toFixed(2)}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Agregar Gasto</h2>
          <form onSubmit={agregarGasto} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            <input
              type="text"
              placeholder="Descripción"
              list="description-suggestions"
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <datalist id="description-suggestions">
              {descriptionSuggestions.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
            <input
              type="number"
              placeholder="Monto"
              step="0.01"
              value={formData.monto}
              onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={formData.categoria}
              onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {CATEGORIAS.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
<<<<<<< HEAD
=======
            <select
              value={formData.tarjeta_id}
              onChange={(e) => setFormData({ ...formData, tarjeta_id: e.target.value })}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Selecciona tarjeta</option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.tipo} • •••• {card.ultimos_digitos}
                </option>
              ))}
            </select>
>>>>>>> 9a955c4 (Initial commit)
            <input
              type="date"
              value={formData.fecha}
              onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" /> Agregar
            </button>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">Tarjetas</h2>
              <p className="text-sm text-gray-500">Guarda tarjetas con detección automática de marca.</p>
            </div>
<<<<<<< HEAD
            <span className="text-sm text-gray-600">Marca detectada: <strong>{CARD_BRAND_ICONS[cardForm.brand]} {cardForm.brand}</strong></span>
=======
            <button
              onClick={requestBiometricUnlock}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              type="button"
            >
              {securityUnlocked ? 'Biometría desbloqueada' : 'Desbloquear con biometría'}
            </button>
>>>>>>> 9a955c4 (Initial commit)
          </div>
          <form onSubmit={agregarTarjeta} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <input
              type="text"
              placeholder="Nombre en la tarjeta"
              list="holder-suggestions"
              value={cardForm.holder}
              onChange={(e) => handleCardInputChange('holder', e.target.value)}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <datalist id="holder-suggestions">
              {holderSuggestions.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
            <input
              type="text"
              placeholder="Número de tarjeta"
              value={cardForm.number}
              onChange={(e) => handleCardInputChange('number', e.target.value)}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="text"
              placeholder="MM/AA"
              maxLength={5}
              value={cardForm.expiry}
              onChange={(e) => handleCardInputChange('expiry', e.target.value.replace(/[^0-9/]/g, '').slice(0, 5))}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="text"
              placeholder="CVV"
              maxLength={4}
              value={cardForm.cvv}
              onChange={(e) => handleCardInputChange('cvv', e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
<<<<<<< HEAD
          </form>
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Guardar tarjeta
          </button>
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">Tarjetas guardadas</h3>
=======
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Guardar tarjeta
            </button>
          </form>
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">Tarjetas guardadas</h3>
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-2">Historial por tarjeta:</label>
              <select
                value={selectedCardId}
                onChange={(e) => setSelectedCardId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Todas las tarjetas</option>
                {cards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.tipo || card.brand} • •••• {card.ultimos_digitos}
                  </option>
                ))}
              </select>
            </div>
>>>>>>> 9a955c4 (Initial commit)
            {cards.length === 0 ? (
              <p className="text-gray-500">No tienes tarjetas guardadas aún.</p>
            ) : (
              <div className="space-y-3">
                {cards.map((card) => (
                  <div key={card.id} className="p-4 border rounded-lg flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between card-list-item">
                    <div>
                      <p className="font-semibold flex items-center gap-2">
<<<<<<< HEAD
                        <span>{CARD_BRAND_ICONS[card.brand]}</span>
                        <span>{card.brand}</span>
                      </p>
                      <p className="text-sm text-gray-600">{card.maskedNumber} • {card.expiry}</p>
                      <p className="text-sm text-gray-500">{card.holder}</p>
=======
                        <span>{CARD_BRAND_ICONS[card.tipo] || CARD_BRAND_ICONS[card.brand]}</span>
                        <span>{card.tipo || card.brand}</span>
                      </p>
                      <p className="text-sm text-gray-600">•••• •••• •••• {card.ultimos_digitos}</p>
                      <p className="text-sm text-gray-500">{card.nombre}</p>
>>>>>>> 9a955c4 (Initial commit)
                    </div>
                    <button
                      onClick={() => eliminarTarjeta(card.id)}
                      className="text-red-600 hover:text-red-800 self-start sm:self-auto"
                    >Eliminar</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Lista de gastos */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b">
<<<<<<< HEAD
            <h2 className="text-xl font-bold">Últimos Gastos</h2>
          </div>
          {gastos.length === 0 ? (
            <p className="p-6 text-center text-gray-500">No hay gastos registrados</p>
          ) : (
            <div className="divide-y">
              {gastos.map((gasto) => (
                <div key={gasto.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-semibold">{gasto.descripcion}</p>
                    <p className="text-sm text-gray-600">{gasto.categoria} • {gasto.fecha}</p>
=======
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  {selectedCardId ? 'Historial de la tarjeta' : 'Últimos Gastos'}
                </h2>
                {selectedCardId && tarjetaSeleccionada && (
                  <p className="text-sm text-gray-500">
                    {tarjetaSeleccionada.tipo || tarjetaSeleccionada.brand} • •••• {tarjetaSeleccionada.ultimos_digitos}
                  </p>
                )}
              </div>
              {selectedCardId && (
                <button
                  onClick={() => setSelectedCardId('')}
                  className="text-indigo-600 hover:underline text-sm"
                  type="button"
                >
                  Mostrar todos
                </button>
              )}
            </div>
          </div>
          {gastosMostrar.length === 0 ? (
            <p className="p-6 text-center text-gray-500">
              {selectedCardId ? 'No hay gastos para esta tarjeta.' : 'No hay gastos registrados'}
            </p>
          ) : (
            <div className="divide-y">
              {gastosMostrar.map((gasto) => (
                <div key={gasto.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-semibold">{gasto.descripcion}</p>
                    <p className="text-sm text-gray-600">
                      {gasto.categoria} • {gasto.fecha}
                      {gasto.tarjetas?.tipo && (
                        <span> • {gasto.tarjetas.tipo}</span>
                      )}
                    </p>
>>>>>>> 9a955c4 (Initial commit)
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-bold text-indigo-600">
                      ${gasto.monto.toFixed(2)}
                    </span>
                    <button
                      onClick={() => eliminarGasto(gasto.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Componente de Login
function Login({ setUser }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)

  async function handleAuth(e) {
    e.preventDefault()
    setLoading(true)

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        alert('Verifica tu email para confirmar la cuenta')
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
      }
    } catch (error) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2">💰 Mis Gastos</h1>
        <p className="text-center text-gray-600 mb-6">Control total de tu dinero</p>

        <form onSubmit={handleAuth} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Cargando...' : isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}
          </button>
        </form>

        <p className="text-center mt-4 text-sm">
          {isSignUp ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}{' '}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-indigo-600 font-semibold hover:underline"
          >
            {isSignUp ? 'Inicia sesión' : 'Regístrate'}
          </button>
        </p>
      </div>
    </div>
  )
}