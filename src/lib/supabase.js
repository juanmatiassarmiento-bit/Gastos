import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://knurxhspqqsbbcxrqxix.supabase.co'
const supabaseAnonKey = 'sb_publishable_y6Q00OVVwXqsH9l6E0znAw_TpgIpNiY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)