import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // Verify caller is authenticated
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token ?? '')
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: { users }, error } = await supabase.auth.admin.listUsers()
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Join with public.users profiles
  const { data: profiles } = await supabase.from('users').select('*')
  const profileByEmail = Object.fromEntries((profiles ?? []).map((p: Record<string, unknown>) => [p.email, p]))

  const merged = users.map(u => ({
    authId: u.id,
    email: u.email,
    confirmedAt: u.confirmed_at,
    lastSignIn: u.last_sign_in_at,
    ...profileByEmail[u.email ?? ''],
  }))

  return new Response(JSON.stringify({ users: merged }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
