# Notas de implementación para Mis Gastos

## Cambios realizados
- Agregado campo `tarjeta_id` en `public.gastos`
- Agregado índice `gastos_tarjeta_id_idx`
- Tabla `public.tarjetas` creada con relación a `auth.users(id)`
- RLS habilitado en `gastos` y `tarjetas`
- Políticas para que los usuarios solo gestionen sus propios registros

## Siguiente paso recomendado
1. Ejecutar `supabase-schema.sql` en el editor SQL de Supabase.
2. Configurar la tabla `gastos` en el panel de Supabase con columnas visibles.
3. Ajustar el front-end para:
   - listar tarjetas del usuario
   - asociar un gasto a `tarjeta_id`
   - mostrar historial de gastos por tarjeta
   - usar biometría local (WebAuthn o Capacitor Native Biometric)

## Nota sobre seguridad biométrica
- La biometría no se implementa directamente en el backend de Supabase.
- Se debe hacer en el cliente, idealmente con Capacitor o WebAuthn.
- En la app se puede usar solo para desbloquear el acceso local al historial.
