# Checklist de publicación - Mis Gastos

## 1. App y configuración nativa
- [x] `capacitor.config.json` actualizado:
  - `appId`: `com.gastos.app`
  - `appName`: `Mis Gastos`
  - `version`: `1.0.0`
  - `webDir`: `dist`
  - `android.minVersion`: `21`
  - `android.targetVersion`: `34`
  - `ios.contentInset`: `automatic`
- [x] `package.json` versión `1.0.0`
- [x] `manifest.webmanifest` incluye iconos `192x192`, `512x512`, `1024x1024`
- [x] `public/icon-192.png`, `public/icon-512.png`, `public/icon-1024.png` presentes
- [x] `.gitignore` incluye `node_modules/`, `.env.local`, `.DS_Store`

## 2. Supabase y backend
- [x] `supabase-schema.sql` creado con tablas `tarjetas` y `gastos`
- [x] RLS habilitado en `public.gastos` y `public.tarjetas`
- [x] Políticas para que cada usuario solo acceda a sus propios registros
- [ ] Ejecutar `supabase-schema.sql` en el editor SQL de Supabase
- [ ] Configurar variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `.env.local`

## 3. Build y deploy web
- [ ] `npm install`
- [ ] `npm run build`
- [ ] probar `npm run preview` y asegurarse de que la app carga

## 4. Capacitor / Android
- [ ] `npx cap sync android`
- [ ] `npx cap open android`
- [ ] configurar `keystore` y firmar APK/AAB
- [ ] probar en dispositivo/emulador

## 5. Play Store
- [ ] cuenta de Google Play activa
- [ ] paquete APK o AAB firmado
- [ ] iconos y screenshots listos
- [ ] política de privacidad publicada
- [ ] descripción corta y larga preparada
- [ ] email de soporte y categoría definidos
- [ ] comprobada la compatibilidad con Android 21+

## 6. PWA y assets
- [x] `service-worker.js` presente
- [x] `public/manifest.webmanifest` completo
- [ ] probar instalación PWA en Android y desktop
- [ ] probar que la app se abre en modo standalone

## 7. Verificaciones finales
- [ ] probar flows de login/signup
- [ ] probar creación, visualización y eliminación de gastos
- [ ] probar guardado/selección de tarjetas
- [ ] probar historial por tarjeta
- [ ] revisar que no se suben keys sensibles al repositorio
- [ ] confirmar que `.env.local` no está en git
