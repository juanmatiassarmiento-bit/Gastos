-- Supabase schema for Mis Gastos app

-- Tabla tarjetas
CREATE TABLE IF NOT EXISTS public.tarjetas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  nombre text NOT NULL,
  ultimos_digitos text,
  tipo text,
  color text,
  es_activa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tarjetas_user_id_idx ON public.tarjetas(user_id);

-- Tabla gastos
CREATE TABLE IF NOT EXISTS public.gastos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  tarjeta_id uuid REFERENCES public.tarjetas(id),
  descripcion text NOT NULL,
  monto numeric(10,2) NOT NULL CHECK (monto >= 0),
  categoria text NOT NULL,
  fecha date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gastos_user_id_idx ON public.gastos(user_id);
CREATE INDEX IF NOT EXISTS gastos_tarjeta_id_idx ON public.gastos(tarjeta_id);
CREATE INDEX IF NOT EXISTS gastos_fecha_idx ON public.gastos(fecha DESC);

-- Habilitar Row Level Security
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarjetas ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY "Users can manage own gastos" ON public.gastos
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own tarjetas" ON public.tarjetas
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Permisos para usuarios autenticados
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gastos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarjetas TO authenticated;
