import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { Plus, Trash2, TrendingUp, LogOut, Smartphone, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import GestorTarjetas from './components/GestorTarjetas'
import HistorialTransacciones from './components/HistorialTransacciones'
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
  const [loading, setLoading] = useState(true)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [tarjetaSeleccionada, setTarjetaSeleccionada] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [paginaActual, setPaginaActual] = useState(1)
  const [gastosPorPagina] = useState(5)
  const [formData, setFormData] = useState({
    descripcion: '',
    monto: '',
    categoria: CATEGORIAS[0],
    fecha: new Date().toISOString().split('T')[0]
  })

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

  useEffect(() => {
    const handler = (event) => {
      event.preventDefault()
      setInstallPrompt(event)
    }

    window.addEventListener('beforeinstallprompt', handler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  useEffect(() => {
    if (user) {
      cargarGastos()
    }
  }, [user])

  async function cargarGastos() {
    setLoading(true)
    const { data, error } = await supabase
      .from('gastos')
      .select('*')
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

    if (!formData.descripcion || !formData.monto) {
      alert('Completa todos los campos')
      return
    }

    const { error } = await supabase
      .from('gastos')
      .insert([
        {
          descripcion: formData.descripcion,
          monto: parseFloat(formData.monto),
          categoria: formData.categoria,
          fecha: formData.fecha
        }
      ])

    if (error) {
      alert('Error al agregar gasto')
      console.error(error)
    } else {
      setFormData({
        descripcion: '',
        monto: '',
        categoria: CATEGORIAS[0],
        fecha: new Date().toISOString().split('T')[0]
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

  async function instalarApp() {
    if (!installPrompt) return
    installPrompt.prompt()
    const choiceResult = await installPrompt.userChoice
    if (choiceResult.outcome === 'accepted') {
      console.log('App instalada')
    } else {
      console.log('Instalación cancelada')
    }
    setInstallPrompt(null)
  }

  function obtenerGastosFiltrados() {
    const gastosFiltrados = gastos.filter(gasto => {
      const coincideBusqueda = gasto.descripcion.toLowerCase().includes(busqueda.toLowerCase()) ||
                                gasto.categoria.toLowerCase().includes(busqueda.toLowerCase())
      return coincideBusqueda
    })

    const totalPaginas = Math.ceil(gastosFiltrados.length / gastosPorPagina)
    const indiceInicio = (paginaActual - 1) * gastosPorPagina
    const indiceFin = indiceInicio + gastosPorPagina
    const gastosPaginados = gastosFiltrados.slice(indiceInicio, indiceFin)

    return {
      gastos: gastosPaginados,
      total: gastosFiltrados.length,
      paginaActual,
      totalPaginas,
      gastosPorPagina
    }
  }

  const totalGastos = gastos.reduce((sum, g) => sum + g.monto, 0)
  const gastoPorCategoria = gastos.reduce((acc, g) => {
    acc[g.categoria] = (acc[g.categoria] || 0) + g.monto
    return acc
  }, {})

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="text-4xl font-bold text-indigo-600 mb-4">💰</div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Login setUser={setUser} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-md sticky top-0 z-50">
        <div className="w-full px-4 py-4">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-3 justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-indigo-600">💰 Mis Gastos</h1>
              <p className="text-sm text-gray-500">Control total de tu dinero</p>
            </div>

            <div className="flex flex-wrap gap-3 items-center justify-center">
              {installPrompt ? (
                <button
                  onClick={instalarApp}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 whitespace-nowrap"
                >
                  <Smartphone className="w-5 h-5" /> Instalar App
                </button>
              ) : null}
              <button
                onClick={logout}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2"
              >
                <LogOut className="w-5 h-5" /> Salir
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="w-full px-4 py-6 md:py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          
          <div>
            <GestorTarjetas onTarjetaSeleccionada={setTarjetaSeleccionada} />
          </div>

          {tarjetaSeleccionada && (
            <div>
              <HistorialTransacciones tarjetaId={tarjetaSeleccionada} />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Total este mes</p>
                  <p className="text-3xl font-bold text-indigo-600 mt-2">
                    ${totalGastos.toFixed(2)}
                  </p>
                </div>
                <TrendingUp className="w-12 h-12 text-indigo-300" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <p className="text-gray-600 text-sm mb-4">Top categorías</p>
              <div className="space-y-2">
                {Object.entries(gastoPorCategoria)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 3)
                  .map(([cat, monto]) => (
                    <div key={cat} className="flex justify-between text-sm">
                      <span>{cat}</span>
                      <span className="font-semibold text-indigo-600">${monto.toFixed(2)}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">Agregar Gasto</h2>
            <form onSubmit={agregarGasto} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Descripción"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="number"
                  placeholder="Monto"
                  step="0.01"
                  value={formData.monto}
                  onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
                  className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select
                  value={formData.categoria}
                  onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                  className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {CATEGORIAS.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={formData.fecha}
                  onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                  className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2 font-semibold"
              >
                <Plus className="w-5 h-5" /> Agregar
              </button>
            </form>
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <h2 className="text-xl font-bold">Últimos Gastos</h2>
                
                <div className="relative flex-1 md:max-w-xs">
                  <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar descripción o categoría..."
                    value={busqueda}
                    onChange={(e) => {
                      setBusqueda(e.target.value)
                      setPaginaActual(1)
                    }}
                    className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>
            </div>

            {(() => {
              const { gastos: gastosMostrados, total, paginaActual: pag, totalPaginas } = obtenerGastosFiltrados()

              if (total === 0) {
                return (
                  <p className="p-6 text-center text-gray-500">
                    {busqueda ? `No hay gastos que coincidan con "${busqueda}"` : 'No hay gastos registrados'}
                  </p>
                )
              }

              return (
                <div className="divide-y">
                  <div className="max-h-96 overflow-y-auto">
                    {gastosMostrados.map((gasto) => (
                      <div key={gasto.id} className="p-4 hover:bg-gray-50 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0 transition">
                        <div className="flex-1">
                          <p className="font-semibold">{gasto.descripcion}</p>
                          <p className="text-sm text-gray-600">{gasto.categoria} • {gasto.fecha}</p>
                        </div>
                        <div className="flex items-center gap-4 justify-between md:justify-end">
                          <span className="text-lg font-bold text-indigo-600">
                            ${gasto.monto.toFixed(2)}
                          </span>
                          <button
                            onClick={() => eliminarGasto(gasto.id)}
                            className="text-red-500 hover:text-red-700 transition"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {totalPaginas > 1 && (
                    <div className="px-6 py-4 bg-gray-50 border-t flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <p className="text-sm text-gray-600">
                        Mostrando {(pag - 1) * gastosPorPagina + 1} - {Math.min(pag * gastosPorPagina, total)} de {total} gastos
                      </p>

                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => setPaginaActual(prev => Math.max(prev - 1, 1))}
                          disabled={pag === 1}
                          className="flex items-center gap-1 px-3 py-1 border-2 border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          <ChevronLeft className="w-4 h-4" /> Anterior
                        </button>

                        <div className="flex items-center gap-2">
                          {Array.from({ length: totalPaginas }, (_, i) => i + 1).map(num => (
                            <button
                              key={num}
                              onClick={() => setPaginaActual(num)}
                              className={`w-8 h-8 rounded-lg font-semibold transition ${
                                pag === num
                                  ? 'bg-indigo-600 text-white'
                                  : 'border-2 border-gray-300 text-gray-600 hover:border-indigo-600'
                              }`}
                            >
                              {num}
                            </button>
                          ))}
                        </div>

                        <button
                          onClick={() => setPaginaActual(prev => Math.min(prev + 1, totalPaginas))}
                          disabled={pag === totalPaginas}
                          className="flex items-center gap-1 px-3 py-1 border-2 border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          Siguiente <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}

function Login({ setUser }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  function validarContraseña(pass) {
    if (pass.length < 8) {
      return 'Mínimo 8 caracteres'
    }
    return ''
  }

  async function handleAuth(e) {
    e.preventDefault()
    setLoading(true)
    setPasswordError('')

    try {
      if (isSignUp) {
        const error = validarContraseña(password)
        if (error) {
          setPasswordError(error)
          setLoading(false)
          return
        }

        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        alert('✅ Verifica tu email para confirmar la cuenta')
        setEmail('')
        setPassword('')
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
      }
    } catch (error) {
      alert('❌ Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">💰 Mis Gastos</h1>
          <p className="text-gray-600">Control total de tu dinero</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
            <input
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-600"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Contraseña</label>
            <input
              type="password"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setPasswordError('')
              }}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-600"
              required
            />
            {passwordError && (
              <p className="text-red-500 text-xs mt-1">⚠️ {passwordError}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-semibold"
          >
            {loading ? 'Cargando...' : isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}
          </button>
        </form>

        <p className="text-center mt-4 text-sm">
          {isSignUp ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}{' '}
          <button
            onClick={() => {
              setIsSignUp(!isSignUp)
              setPasswordError('')
            }}
            className="text-indigo-600 font-semibold hover:underline"
          >
            {isSignUp ? 'Inicia sesión' : 'Regístrate'}
          </button>
        </p>
      </div>
    </div>
  )
}