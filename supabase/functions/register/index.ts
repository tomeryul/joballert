import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: HEADERS });

  try {
    const { email, password, full_name } = await req.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'email and password are required' }), { status: 400, headers: HEADERS });
    }

    // Create user via admin API — auto-confirms email, no confirmation email sent
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { full_name: full_name || '' },
      email_confirm: true,
    });

    if (error) {
      // If user already exists, that's OK — just let them sign in
      if (error.message?.includes('already been registered') || error.message?.includes('already exists')) {
        return new Response(JSON.stringify({ success: true, existing: true }), { headers: HEADERS });
      }
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: HEADERS });
    }

    return new Response(JSON.stringify({ success: true, user_id: data.user?.id }), { headers: HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: HEADERS });
  }
});
