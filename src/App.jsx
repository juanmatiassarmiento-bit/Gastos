import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { Plus, Trash2, LogOut, Upload, FileSpreadsheet, ShieldCheck, CreditCard } from 'lucide-react'
import Papa from 'papaparse'
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
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCardId, setSelectedCardId] = useState('')
  const [importing, setImporting] = useState(false)

  const [formData, setFormData] = useState({
    descripcion: '',
    monto: '',
    categoria: CATEGORIAS[0],
    fecha: new Date().toISOString().split('T')[0],
    tarjeta_id: ''
  })

  const [cardForm, setCardForm] = useState({
    holder: '',
    number: '',
    brand: 'Visa'
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription?.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) {
      cargarGastos()
      cargarTarjetas()
    }
  }, [user])

  const cargarTarjetas = async () => {
    const { data, error } = await supabase
      .from('tarjetas')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error) setCards(data || [])
  }

  const cargarGastos = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('gastos')
      .select('*, tarjetas(*)')
      .order('fecha', { ascending: false })

    if (!error) setGastos(data || [])
    setLoading(false)
  }

  const agregarGasto = async (e) => {
    e.preventDefault()
    const targetCardId = formData.tarjeta_id || selectedCardId

    if (!formData.descripcion || !formData.monto || !targetCardId) {
      alert('Por favor selecciona una tarjeta para asociar el gasto.')
      return
    }

    const { error } = await supabase.from('gastos').insert([
      {
        descripcion: formData.descripcion,
        monto: parseFloat(formData.monto),
        categoria: formData.categoria,
        fecha: formData.fecha,
        tarjeta_id: targetCardId,
        user_id: user.id
      }
    ])

    if (error) {
      alert('Error guardando el gasto: ' + error.message)
    } else {
      setFormData({
        descripcion: '',
        monto: '',
        categoria: CATEGORIAS[0],
        fecha: new Date().toISOString().split('T')[0],
        tarjeta_id: selectedCardId
      })
      cargarGastos()
    }
  }

  const agregarTarjeta = async (e) => {
    e.preventDefault()
    if (!cardForm.holder || cardForm.number.length < 4) {
      alert('Ingresa los datos correctamente.')
      return
    }

    const lastDigits = cardForm.number.replace(/\D/g, '').slice(-4)

    const { error } = await supabase.from('tarjetas').insert([
      {
        user_id: user.id,
        nombre: cardForm.holder,
        ultimos_digitos: lastDigits,
        tipo: cardForm.brand || 'Visa'
      }
    ])

    if (error) {
      alert('Error guardando tarjeta: ' + error.message)
    } else {
      setCardForm({ holder: '', number: '', brand: 'Visa' })
      cargarTarjetas()
    }
  }

  const eliminarGasto = async (id) => {
    if (!confirm('¿Eliminar este registro?')) return
    const { error } = await supabase.from('gastos').delete().eq('id', id)
    if (!error) cargarGastos()
  }

  // --- FUNCIÓN PARA IMPORTAR REPORTES (CSV) DE MERCADO PAGO O BANCOS ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!selectedCardId) {
      alert('Por favor selecciona primero la tarjeta a la que pertenecen estos movimientos.')
      return
    }

    setImporting(true)

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const nuevosGastos = []

        results.data.forEach((row) => {
          const descripcion = row['Descripción'] || row['descripcion'] || row['Concepto'] || row['Title'] || 'Pago/Gasto'
          const montoRaw = row['Monto'] || row['monto'] || row['Importe'] || row['Amount'] || '0'
          const fechaRaw = row['Fecha'] || row['fecha'] || row['Date'] || new Date().toISOString().split('T')[0]

          const monto = Math.abs(parseFloat(String(montoRaw).replace('$', '').replace('.', '').replace(',', '.')))

          if (monto > 0) {
            nuevosGastos.push({
              user_id: user.id,
              descripcion: descripcion.trim(),
              monto: monto,
              categoria: '🛍️ Compras',
              fecha: fechaRaw.split('T')[0],
              tarjeta_id: selectedCardId
            })
          }
        })

        if (nuevosGastos.length === 0) {
          alert('No se encontraron registros de gastos válidos en el archivo CSV.')
          setImporting(false)
          return
        }

        const { error } = await supabase.from('gastos').insert(nuevosGastos)

        if (error) {
          alert('Error guardando los datos importados: ' + error.message)
        } else {
          alert(`¡Se importaron ${nuevosGastos.length} movimientos correctamente!`)
          cargarGastos()
        }
        setImporting(false)
      },
      error: (err) => {
        alert('Error al leer el archivo: ' + err.message)
        setImporting(false)
      }
    })
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setGastos([])
    setCards([])
  }

  // FILTRADO ESTRICTO DE DATOS POR TARJETA
  const gastosFiltrados = selectedCardId
    ? gastos.filter((g) => g.tarjeta_id === selectedCardId)
    : gastos

  const totalGastosFiltrados = gastosFiltrados.reduce((sum, g) => sum + g.monto, 0)

  const gastoPorCategoriaFiltrado = gastosFiltrados.reduce((acc, g) => {
    acc[g.categoria] = (acc[g.categoria] || 0) + g.monto
    return acc
  }, {})

  const tarjetaActual = cards.find((c) => c.id === selectedCardId)

  if (loading) return <div className="p-8 text-center flex items-center justify-center min-h-screen">Cargando datos...</div>
  if (!user) return <Login setUser={setUser} />

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Navegación Principal */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold">
              $
            </div>
            <h1 className="text-xl font-bold text-slate-900">Control de Gastos</h1>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition"
          >
            <LogOut className="w-4 h-4" /> Cerrar Sesión
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Selector de Tarjeta Filtro General */}
        <section className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Visualizando datos de:</label>
            <h2 className="text-lg font-bold text-slate-900">
              {tarjetaActual ? `${tarjetaActual.tipo} •••• ${tarjetaActual.ultimos_digitos} (${tarjetaActual.nombre})` : 'Todas las tarjetas'}
            </h2>
          </div>
          <select
            value={selectedCardId}
            onChange={(e) => {
              setSelectedCardId(e.target.value)
              setFormData((prev) => ({ ...prev, tarjeta_id: e.target.value }))
            }}
            className="px-4 py-2 border rounded-lg border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todas las tarjetas</option>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.tipo} •••• {c.ultimos_digitos}
              </option>
            ))}
          </select>
        </section>

        {/* Sección de Carga Masiva por CSV */}
        <section className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-xl border border-indigo-100 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-indigo-950 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" /> Cargar Historial (.CSV)
            </h3>
            <p className="text-xs text-indigo-700 mt-1">
              Descarga la actividad de Mercado Pago o tu banco en formato CSV y súbela para importar los movimientos a la tarjeta seleccionada.
            </p>
          </div>
          <label className={`px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm cursor-pointer flex items-center gap-2 shadow-sm transition ${importing ? 'opacity-50' : ''}`}>
            <Upload className="w-4 h-4" />
            {importing ? 'Procesando...' : 'Cargar Reporte (.csv)'}
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={importing}
              className="hidden"
            />
          </label>
        </section>

        {/* Métricas de la tarjeta seleccionada */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Total gastado</p>
            <p className="text-3xl font-extrabold text-indigo-600 mt-2">${totalGastosFiltrados.toFixed(2)}</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-sm font-medium text-slate-500 mb-2">Desglose por Categoría</p>
            <div className="space-y-1">
              {Object.entries(gastoPorCategoriaFiltrado).length === 0 ? (
                <p className="text-xs text-slate-400">Sin registros para esta vista.</p>
              ) : (
                Object.entries(gastoPorCategoriaFiltrado).map(([cat, monto]) => (
                  <div key={cat} className="flex justify-between text-sm">
                    <span>{cat}</span>
                    <span className="font-semibold">${monto.toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Formulario Agregar Tarjeta */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-lg text-slate-900">Agregar Nueva Tarjeta</h3>
          <form onSubmit={agregarTarjeta} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Titular de la tarjeta"
              value={cardForm.holder}
              onChange={(e) => setCardForm({ ...cardForm, holder: e.target.value })}
              className="px-3 py-2 border rounded-lg border-slate-300"
            />
            <input
              type="text"
              placeholder="Número o últimos 4 dígitos"
              value={cardForm.number}
              onChange={(e) => setCardForm({ ...cardForm, number: e.target.value })}
              className="px-3 py-2 border rounded-lg border-slate-300"
            />
            <select
              value={cardForm.brand}
              onChange={(e) => setCardForm({ ...cardForm, brand: e.target.value })}
              className="px-3 py-2 border rounded-lg border-slate-300"
            >
              <option value="Visa">Visa</option>
              <option value="Mastercard">Mastercard</option>
              <option value="Mercado Pago">Mercado Pago</option>
              <option value="Ualá">Ualá</option>
              <option value="Otra">Otra</option>
            </select>
            <button type="submit" className="bg-slate-900 text-white rounded-lg px-4 py-2 font-medium hover:bg-slate-800">
              Guardar Tarjeta
            </button>
          </form>
        </section>

        {/* Formulario Registrar Gasto Manual */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-lg text-slate-900">Registrar Nuevo Movimiento Manual</h3>
          <form onSubmit={agregarGasto} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <input
              type="text"
              placeholder="Descripción"
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              className="px-3 py-2 border rounded-lg border-slate-300"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Monto"
              value={formData.monto}
              onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
              className="px-3 py-2 border rounded-lg border-slate-300"
            />
            <select
              value={formData.categoria}
              onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
              className="px-3 py-2 border rounded-lg border-slate-300"
            >
              {CATEGORIAS.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select
              value={formData.tarjeta_id || selectedCardId}
              onChange={(e) => setFormData({ ...formData, tarjeta_id: e.target.value })}
              className="px-3 py-2 border rounded-lg border-slate-300"
            >
              <option value="">Seleccionar Tarjeta</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>{c.tipo} •••• {c.ultimos_digitos}</option>
              ))}
            </select>
            <button type="submit" className="bg-indigo-600 text-white font-medium rounded-lg px-4 py-2 hover:bg-indigo-700 flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Agregar
            </button>
          </form>
        </section>

        {/* Historial de Gastos Filtrados */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 font-bold text-slate-900">
            Movimientos Registrados {selectedCardId ? '(Tarjeta Seleccionada)' : '(Todas las tarjetas)'}
          </div>
          {gastosFiltrados.length === 0 ? (
            <p className="p-6 text-center text-slate-500">No hay movimientos registrados para esta vista.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {gastosFiltrados.map((g) => (
                <div key={g.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                  <div>
                    <p className="font-semibold text-slate-800">{g.descripcion}</p>
                    <p className="text-xs text-slate-500">{g.categoria} • {g.fecha} {g.tarjetas?.tipo ? `• (${g.tarjetas.tipo})` : ''}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-slate-900">${g.monto.toFixed(2)}</span>
                    <button onClick={() => eliminarGasto(g.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function Login({ setUser }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        alert('Registro iniciado. Verifica tu e-mail para continuar.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
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
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-4xl w-full grid grid-cols-1 md:grid-cols-12">
        {/* Barra Lateral de Pasos (Guía) */}
        <div className="md:col-span-5 bg-gradient-to-br from-indigo-600 to-indigo-900 p-8 text-white flex flex-col justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Mis Gastos</h2>
            <p className="text-indigo-200 text-sm mb-8">Administra tus tarjetas y consumos en un solo lugar.</p>
            
            <div className="space-y-6">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-indigo-500/50 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-indigo-400">1</div>
                <div>
                  <h4 className="font-semibold text-sm">Crea tu cuenta</h4>
                  <p className="text-xs text-indigo-200">Ingresa con tu correo personal para mantener la información aislada y segura.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-indigo-500/50 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-indigo-400">2</div>
                <div>
                  <h4 className="font-semibold text-sm">Registra tu tarjeta</h4>
                  <p className="text-xs text-indigo-200">Agrega tarjetas físicas o virtuales (Visa, Mastercard, Mercado Pago) identificando sus últimos dígitos.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-indigo-500/50 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-indigo-400">3</div>
                <div>
                  <h4 className="font-semibold text-sm">Filtra e Importa</h4>
                  <p className="text-xs text-indigo-200">Selecciona cada tarjeta para analizar sus consumos o carga un CSV con tu historial completo.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-indigo-500/30 text-xs text-indigo-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Datos protegidos por Supabase Auth
          </div>
        </div>

        {/* Formulario Login / Registro */}
        <div className="md:col-span-7 p-8 flex flex-col justify-center">
          <h3 className="text-2xl font-bold text-slate-900 mb-1">
            {isSignUp ? 'Crear una cuenta' : 'Iniciar Sesión'}
          </h3>
          <p className="text-slate-500 text-sm mb-6">
            {isSignUp ? 'Ingresa tus datos para registrarte' : 'Ingresa a tu panel de control'}
          </p>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Correo Electrónico</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Contraseña</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white font-semibold py-2.5 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 mt-2"
            >
              {loading ? 'Cargando...' : isSignUp ? 'Registrarse' : 'Ingresar'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-600 mt-6">
            {isSignUp ? '¿Ya tienes una cuenta?' : '¿No tienes cuenta aun?'}{' '}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-indigo-600 font-semibold hover:underline"
            >
              {isSignUp ? 'Inicia sesión' : 'Regístrate aquí'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}