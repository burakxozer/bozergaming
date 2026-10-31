import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization') ?? ''
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const { data: me } = await userClient.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') return new Response('Forbidden', { status: 403 })
  const { userId } = await req.json()
  if (!userId || userId === user.id) return new Response('Invalid target', { status: 400 })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { error } = await admin.auth.admin.deleteUser(userId)
  return error ? Response.json({ error: error.message }, { status: 400 }) : Response.json({ ok: true })
})
