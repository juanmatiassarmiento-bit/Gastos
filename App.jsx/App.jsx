import { useState, useEffect } from 'react'
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
  const [loading, setLoading] = useState(true)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [formData, setFormData] = useState({
    descripcion: '',
    monto: '',
    categoria: CATEGORIAS[0],
    fecha: new Date().toISOString().split('T')[0]
  })

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

  // Cargar gastos
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

  // Calcular totales
  const totalGastos = gastos.reduce((sum, g) => sum + g.monto, 0)
  const gastoPorCategoria = gastos.reduce((acc, g) => {
    acc[g.categoria] = (acc[g.categoria] || 0) + g.monto
    return acc
  }, {})

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>
  }

  if (!user) {
    return <Login setUser={setUser} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-md p-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-3 justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-indigo-600">💰 Mis Gastos</h1>
            <p className="text-sm text-gray-500">Lleva el control desde tu móvil como app instalable.</p>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            {installPrompt ? (
              <button
                onClick={instalarApp}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Instalar App
              </button>
            ) : (
              <span className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm">
                Abre desde el navegador para ver la opción de instalación.
              </span>
            )}
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Salir
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto p-4 mt-6">
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
          <form onSubmit={agregarGasto} className="grid grid-cols-1 md:grid-cols-5 gap-3">
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
            <button
              type="submit"
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" /> Agregar
            </button>
          </form>
        </div>

        {/* Lista de gastos */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b">
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