import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const { username, password } = await req.json()
  if (typeof username !== 'string' || typeof password !== 'string') return new Response('Bad request', { status: 400 })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: profile } = await admin.from('profiles').select('id').eq('username', username.toLowerCase()).maybeSingle()
  if (!profile) return Response.json({ error: 'Invalid credentials' }, { status: 401 })
  const { data: target } = await admin.auth.admin.getUserById(profile.id)
  if (!target.user?.email) return Response.json({ error: 'Invalid credentials' }, { status: 401 })
  const auth = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
  const { data, error } = await auth.auth.signInWithPassword({ email: target.user.email, password })
  return error ? Response.json({ error: 'Invalid credentials' }, { status: 401 }) : Response.json({ session: data.session })
})
