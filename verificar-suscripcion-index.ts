// supabase/functions/verificar-suscripcion/index.ts
// La app pregunta: "¿este usuario pagó?"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY') || '';

// Si el aviso de Stripe (webhook) nunca llegó, se le pregunta a Stripe
// directamente por ese correo. Así nadie que pagó se queda afuera.
let diag = '';
async function stripe(ruta: string) {
  const r = await fetch('https://api.stripe.com/v1/' + ruta, { headers: { Authorization: 'Bearer ' + STRIPE_KEY.trim() } });
  if (!r.ok) { diag = 'stripe error ' + r.status + ' en ' + ruta.split('?')[0]; return null; }
  return r.json();
}

async function preguntarAStripe(email: string) {
  if (!STRIPE_KEY) { diag = 'falta STRIPE_SECRET_KEY'; return null; }
  if (!email) return null;
  diag = 'llave ' + STRIPE_KEY.trim().slice(0, 8);
  const clientes = await stripe('customers?limit=10&email=' + encodeURIComponent(email));
  const ids: string[] = (clientes && clientes.data || []).map((c: any) => c.id);
  // Stripe distingue mayúsculas en el correo: se busca también por el buscador.
  const busq = await stripe('customers/search?query=' + encodeURIComponent("email~'" + email + "'"));
  (busq && busq.data || []).forEach((c: any) => { if (!ids.includes(c.id) && (c.email || '').toLowerCase() === email) ids.push(c.id); });
  diag += ' · clientes ' + ids.length;
  const estados: string[] = [];
  for (const id of ids) {
    const subs = await stripe('subscriptions?status=all&limit=10&customer=' + id);
    (subs && subs.data || []).forEach((s: any) => estados.push(s.status));
    const viva = (subs && subs.data || []).find((s: any) => s.status === 'active' || s.status === 'trialing');
    if (viva) {
      const fin = viva.current_period_end || viva.items?.data?.[0]?.current_period_end;
      diag += ' · activa';
      return { estado: viva.status, vence: fin ? new Date(fin * 1000).toISOString() : new Date(Date.now() + 31 * 86400000).toISOString(), referencia: viva.id };
    }
  }
  diag += ' · subs [' + estados.join(',') + ']';
  return null;
}

async function guardarFila(fila: Record<string, unknown>) {
  await fetch(SUPABASE_URL + '/rest/v1/suscripciones?on_conflict=email', {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(fila),
  });
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  // El token puede venir en el header o en el cuerpo. Lo segundo evita el
  // permiso previo del navegador (preflight), que es lo que rompía la llamada.
  let token = (req.headers.get('authorization') || '').replace(/^Bearer /i, '').trim();
  if (!token) {
    try {
      const cuerpo = await req.json();
      token = (cuerpo && cuerpo.token || '').trim();
    } catch { /* sin cuerpo */ }
  }
  if (!token) return json({ activa: false, error: 'sin sesión' }, 401);

  try {
    // Averiguamos de quién es la sesión. No confiamos en el correo que mande la app.
    const u = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + token },
    });
    if (!u.ok) return json({ activa: false, error: 'sesión inválida' }, 401);
    const email = ((await u.json()).email || '').trim().toLowerCase();

    const r = await fetch(
      SUPABASE_URL + '/rest/v1/suscripciones?email=eq.' + encodeURIComponent(email) + '&select=activa,estado,vence',
      { headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY } }
    );
    const filas = await r.json();
    const fila = Array.isArray(filas) ? filas[0] : null;

    // 3 días de gracia por si un cobro se atrasa. Si Stripe dice que sigue
    // activa, cuenta como vigente aunque la fecha guardada no se haya
    // actualizado con la renovación (el aviso de renovación a veces no llega).
    let vigente = !!fila && (
      fila.estado === 'active' || fila.estado === 'trialing' ||
      (fila.activa === true && (!fila.vence || new Date(fila.vence).getTime() > Date.now() - 3 * 86400000)));

    // Plan B: no hay fila válida, pero quizá sí pagó y el aviso se perdió.
    if (!vigente) {
      const s = await preguntarAStripe(email);
      if (s) {
        await guardarFila({ email, activa: true, estado: s.estado, vence: s.vence, referencia: s.referencia, actualizado: new Date().toISOString() });
        return json({ activa: true, estado: s.estado, vence: s.vence, email, origen: 'stripe' });
      }
    }

    return json({
      activa: vigente,
      estado: fila ? fila.estado : 'sin_suscripcion',
      vence: fila && fila.vence ? fila.vence : null,
      email,
      stripe: diag || 'no se consultó',
    });
  } catch (e) {
    console.error(e);
    return json({ activa: false, error: 'servidor' }, 500);
  }
});
