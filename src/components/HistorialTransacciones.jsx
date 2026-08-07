import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { TrendingUp, Calendar } from 'lucide-react'

export default function HistorialTransacciones({ tarjetaId }) {
  const [transacciones, setTransacciones] = useState([])
  const [filtro, setFiltro] = useState('mes')
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    cargarTransacciones()

    const subscription = supabase
      .channel('transacciones-cambios')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'transacciones'
      }, () => {
        cargarTransacciones()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [tarjetaId, filtro])

  async function cargarTransacciones() {
    setCargando(true)
    try {
      let query = supabase
        .from('transacciones')
        .select('*')
        .order('fecha', { ascending: false })

      if (tarjetaId) {
        query = query.eq('tarjeta_id', tarjetaId)
      }

      const { data, error } = await query

      if (error) throw error

      setTransacciones(data || [])
    } catch (error) {
      console.error('Error cargando transacciones:', error)
    } finally {
      setCargando(false)
    }
  }

  function filtrarTransacciones() {
    const ahora = new Date()
    const mesActual = ahora.getMonth()
    const anoActual = ahora.getFullYear()

    return transacciones.filter((t) => {
      const fecha = new Date(t.fecha)
      const mesFecha = fecha.getMonth()
      const anoFecha = fecha.getFullYear()

      switch (filtro) {
        case 'mes':
          return mesFecha === mesActual && anoFecha === anoActual
        case 'trimestre':
          const trimestral = Math.floor(mesFecha / 3) === Math.floor(mesActual / 3)
          return trimestral && anoFecha === anoActual
        case 'año':
          return anoFecha === anoActual
        case 'todos':
          return true
        default:
          return true
      }
    })
  }

  const transaccionesFiltradas = filtrarTransacciones()

  const totalGastado = transaccionesFiltradas
    .filter((t) => t.estado === 'completado')
    .reduce((sum, t) => sum + parseFloat(t.monto), 0)

  const gastoPorCategoria = transaccionesFiltradas
    .filter((t) => t.estado === 'completado')
    .reduce((acc, t) => {
      acc[t.categoria] = (acc[t.categoria] || 0) + parseFloat(t.monto)
      return acc
    }, {})

  const totalPendiente = transaccionesFiltradas
    .filter((t) => t.estado === 'pendiente')
    .reduce((sum, t) => sum + parseFloat(t.monto), 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-6 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-700 text-sm font-semibold">Gastado</p>
              <p className="text-3xl font-bold text-green-600 mt-1">
                ${totalGastado.toFixed(2)}
              </p>
            </div>
            <TrendingUp className="w-10 h-10 text-green-300" />
          </div>
        </div>

        {totalPendiente > 0 && (
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg p-6 border border-yellow-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-700 text-sm font-semibold">Pendiente</p>
                <p className="text-3xl font-bold text-yellow-600 mt-1">
                  ${totalPendiente.toFixed(2)}
                </p>
              </div>
              <Calendar className="w-10 h-10 text-yellow-300" />
            </div>
          </div>
        )}

        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-6 border border-indigo-200">
          <div>
            <p className="text-indigo-700 text-sm font-semibold">Transacciones</p>
            <p className="text-3xl font-bold text-indigo-600 mt-1">
              {transaccionesFiltradas.length}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex gap-2 flex-wrap">
          {[
            { valor: 'mes', label: 'Este mes' },
            { valor: 'trimestre', label: 'Este trimestre' },
            { valor: 'año', label: 'Este año' },
            { valor: 'todos', label: 'Todo el tiempo' }
          ].map((f) => (
            <button
              key={f.valor}
              onClick={() => setFiltro(f.valor)}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                filtro === f.valor
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {Object.keys(gastoPorCategoria).length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold mb-4">Gasto por categoría</h3>
          <div className="space-y-3">
            {Object.entries(gastoPorCategoria)
              .sort(([, a], [, b]) => b - a)
              .map(([categoria, monto]) => (
                <div key={categoria} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-semibold">{categoria}</p>
                    <div className="bg-gray-200 rounded-full h-2 mt-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full"
                        style={{
                          width: `${(monto / totalGastado) * 100}%`
                        }}
                      ></div>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-bold text-indigo-600">${monto.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">
                      {((monto / totalGastado) * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b">
          <h2 className="text-lg font-bold">Historial de pagos</h2>
        </div>

        {cargando ? (
          <div className="p-8 text-center">⏳ Cargando...</div>
        ) : transaccionesFiltradas.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No hay transacciones en este período
          </div>
        ) : (
          <div className="divide-y max-h-96 overflow-y-auto">
            {transaccionesFiltradas.map((t) => (
              <div
                key={t.id}
                className="p-4 hover:bg-gray-50 flex items-center justify-between transition"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{t.descripcion}</p>
                    {t.estado === 'pendiente' && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                        ⏳ Pendiente
                      </span>
                    )}
                    {t.estado === 'rechazado' && (
                      <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                        ❌ Rechazado
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {t.categoria} • {new Date(t.fecha).toLocaleDateString('es-AR')}
                  </p>
                </div>
                <div className="text-right ml-4">
                  <p className="text-lg font-bold text-indigo-600">
                    -${parseFloat(t.monto).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}