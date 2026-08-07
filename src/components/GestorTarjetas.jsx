import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { encryptarTarjeta, ocultarTarjeta } from '../lib/encryption'
import { Plus, Trash2, CreditCard, Eye, EyeOff } from 'lucide-react'

export default function GestorTarjetas({ onTarjetaSeleccionada }) {
  const [tarjetas, setTarjetas] = useState([])
  const [mostrarForm, setMostrarForm] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [mostrarNumeros, setMostrarNumeros] = useState({})
  const [formData, setFormData] = useState({
    nombre_titular: '',
    numero_tarjeta: '',
    mes_vencimiento: '01',
    ano_vencimiento: new Date().getFullYear(),
    cvv: '',
    banco: '',
    tipo_tarjeta: 'credito'
  })

  useEffect(() => {
    cargarTarjetas()
  }, [])

  async function cargarTarjetas() {
    try {
      const { data, error } = await supabase
        .from('tarjetas')
        .select('*')
        .eq('es_activa', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setTarjetas(data || [])
    } catch (error) {
      console.error('Error cargando tarjetas:', error)
    }
  }

  function validarTarjeta(numero) {
    // Algoritmo de Luhn
    numero = numero.replace(/\D/g, '')
    if (numero.length < 13 || numero.length > 19) return false

    let suma = 0
    for (let i = 0; i < numero.length; i++) {
      let digito = parseInt(numero[numero.length - 1 - i])
      if (i % 2 === 1) {
        digito *= 2
        if (digito > 9) digito -= 9
      }
      suma += digito
    }
    return suma % 10 === 0
  }

  function obtenerTipoBanco(numero) {
    numero = numero.replace(/\D/g, '')
    const prefijos = {
      '4': 'VISA',
      '5': 'Mastercard',
      '3': 'American Express',
      '6': 'Discover'
    }
    return prefijos[numero[0]] || 'Tarjeta'
  }

  async function agregarTarjeta(e) {
    e.preventDefault()
    setCargando(true)

    try {
      if (!formData.nombre_titular.trim()) {
        alert('Por favor ingresa el nombre del titular')
        setCargando(false)
        return
      }

      if (!validarTarjeta(formData.numero_tarjeta)) {
        alert('❌ Número de tarjeta inválido')
        setCargando(false)
        return
      }

      if (formData.cvv.length < 3) {
        alert('❌ CVV inválido')
        setCargando(false)
        return
      }

      const numeroEncriptado = encryptarTarjeta(formData.numero_tarjeta)
      const ultimos = formData.numero_tarjeta.replace(/\D/g, '').slice(-4)
      const banco = formData.banco || obtenerTipoBanco(formData.numero_tarjeta)

      const { error } = await supabase
        .from('tarjetas')
        .insert([
          {
            nombre_titular: formData.nombre_titular.toUpperCase(),
            numero_tarjeta: numeroEncriptado,
            mes_vencimiento: parseInt(formData.mes_vencimiento),
            ano_vencimiento: parseInt(formData.ano_vencimiento),
            cvv: formData.cvv,
            banco: banco,
            tipo_tarjeta: formData.tipo_tarjeta,
            ultimos_digitos: ultimos,
            es_activa: true
          }
        ])

      if (error) throw error

      alert('✅ ¡Tarjeta agregada exitosamente!')
      setFormData({
        nombre_titular: '',
        numero_tarjeta: '',
        mes_vencimiento: '01',
        ano_vencimiento: new Date().getFullYear(),
        cvv: '',
        banco: '',
        tipo_tarjeta: 'credito'
      })
      setMostrarForm(false)
      cargarTarjetas()
    } catch (error) {
      alert('Error: ' + error.message)
    } finally {
      setCargando(false)
    }
  }

  async function eliminarTarjeta(id) {
    if (!confirm('⚠️ ¿Eliminar esta tarjeta?')) return

    try {
      const { error } = await supabase
        .from('tarjetas')
        .update({ es_activa: false })
        .eq('id', id)

      if (error) throw error
      alert('✅ Tarjeta eliminada')
      cargarTarjetas()
    } catch (error) {
      alert('Error: ' + error.message)
    }
  }

  const anioActual = new Date().getFullYear()
  const anosValidos = Array.from({ length: 10 }, (_, i) => anioActual + i)
  const meses = Array.from({ length: 12 }, (_, i) => i + 1)

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-indigo-600" /> Mis Tarjetas
        </h2>
        <button
          onClick={() => setMostrarForm(!mostrarForm)}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:shadow-lg transition flex items-center gap-2"
        >
          <Plus className="w-5 h-5" /> Agregar Tarjeta
        </button>
      </div>

      {mostrarForm && (
        <form onSubmit={agregarTarjeta} className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-lg mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Nombre del titular (ej: Juan Perez)"
              value={formData.nombre_titular}
              onChange={(e) => setFormData({ ...formData, nombre_titular: e.target.value })}
              className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-600"
              required
            />
            <input
              type="text"
              placeholder="Número de tarjeta (16 dígitos)"
              value={formData.numero_tarjeta}
              onChange={(e) => {
                const valor = e.target.value.replace(/\D/g, '').slice(0, 16)
                setFormData({ ...formData, numero_tarjeta: valor })
              }}
              className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-600"
              maxLength="16"
              required
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <select
              value={formData.mes_vencimiento}
              onChange={(e) => setFormData({ ...formData, mes_vencimiento: e.target.value })}
              className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-600"
            >
              <option value="">Mes</option>
              {meses.map((m) => (
                <option key={m} value={String(m).padStart(2, '0')}>
                  {String(m).padStart(2, '0')}
                </option>
              ))}
            </select>

            <select
              value={formData.ano_vencimiento}
              onChange={(e) => setFormData({ ...formData, ano_vencimiento: e.target.value })}
              className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-600"
            >
              <option value="">Año</option>
              {anosValidos.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="CVV"
              value={formData.cvv}
              onChange={(e) => setFormData({ ...formData, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })}
              className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-600"
              maxLength="4"
              required
            />

            <select
              value={formData.tipo_tarjeta}
              onChange={(e) => setFormData({ ...formData, tipo_tarjeta: e.target.value })}
              className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-600"
            >
              <option value="credito">Crédito</option>
              <option value="debito">Débito</option>
            </select>
          </div>

          <input
            type="text"
            placeholder="Banco (ej: BBVA, Santander, Galicia)"
            value={formData.banco}
            onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-600"
          />

          <button
            type="submit"
            disabled={cargando}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition"
          >
            {cargando ? '⏳ Guardando...' : '✅ Guardar Tarjeta'}
          </button>
        </form>
      )}

      {tarjetas.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No tienes tarjetas agregadas aún.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tarjetas.map((tarjeta) => (
            <div
              key={tarjeta.id}
              onClick={() => onTarjetaSeleccionada && onTarjetaSeleccionada(tarjeta.id)}
              className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl p-6 shadow-lg hover:shadow-xl transition cursor-pointer"
            >
              <div className="flex justify-between items-start mb-8">
                <div>
                  <p className="text-sm opacity-90 font-semibold">{tarjeta.banco}</p>
                  <p className="text-xs opacity-75 mt-1">{tarjeta.tipo_tarjeta.toUpperCase()}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    eliminarTarjeta(tarjeta.id)
                  }}
                  className="text-red-300 hover:text-red-100 transition"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-6">
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold font-mono">
                    {ocultarTarjeta(tarjeta.numero_tarjeta)}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setMostrarNumeros({ ...mostrarNumeros, [tarjeta.id]: !mostrarNumeros[tarjeta.id] })
                    }}
                    className="opacity-75 hover:opacity-100 transition"
                  >
                    {mostrarNumeros[tarjeta.id] ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs opacity-75">Vencimiento</p>
                  <p className="font-semibold">
                    {String(tarjeta.mes_vencimiento).padStart(2, '0')}/{tarjeta.ano_vencimiento}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs opacity-75">Titular</p>
                  <p className="text-sm font-semibold">{tarjeta.nombre_titular}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}