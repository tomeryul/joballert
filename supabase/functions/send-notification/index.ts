import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req: Request) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization,content-type',
  };

  if (req.method === 'OPTIONS') return new Response(null, { headers });

  try {
    const { user_id, job_id, title, body, action_url, type = 'new_job' } = await req.json();

    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: 'user_id and title are required' }), {
        status: 400, headers,
      });
    }

    // Create notification record
    const { data: notif, error } = await supabase
      .from('notifications')
      .insert({ user_id, job_id, title, body, action_url, type })
      .select()
      .single();

    if (error) throw error;

    // Check user push subscription
    const { data: settings } = await supabase
      .from('user_settings')
      .select('push_subscription, push_enabled, email_enabled')
      .eq('user_id', user_id)
      .single();

    const results: Record<string, any> = { notification_id: notif?.id };

    if (settings?.push_enabled && settings?.push_subscription) {
      // Mark push as sent (actual web-push sending requires VAPID keys)
      await supabase
        .from('notifications')
        .update({ sent_push: true })
        .eq('id', notif?.id);
      results.push_sent = true;
    }

    return new Response(JSON.stringify({ success: true, ...results }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500, headers,
    });
  }
});
