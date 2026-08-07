import CryptoJS from 'crypto-js'

// Clave de encriptación desde .env
const SECRET_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'default-key-cambiar-en-env'

export function encryptarTarjeta(numeroTarjeta) {
  return CryptoJS.AES.encrypt(numeroTarjeta, SECRET_KEY).toString()
}

export function desencriptarTarjeta(numeroEncriptado) {
  const bytes = CryptoJS.AES.decrypt(numeroEncriptado, SECRET_KEY)
  return bytes.toString(CryptoJS.enc.Utf8)
}

export function ocultarTarjeta(numero) {
  // Retorna: **** **** **** 1234
  return `**** **** **** ${numero.slice(-4)}`
}

export function formatearTarjeta(numero) {
  // Retorna: 4532 1488 0343 6467
  return numero.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim()
}