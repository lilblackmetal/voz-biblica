// supabase/functions/stripe-webhook/index.ts
// Stripe avisa aquí cada vez que alguien paga, renueva o cancela.
// Importante: esta función debe desplegarse con --no-verify-jwt
// (Stripe no manda token de Supabase).

import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  httpClient: Stripe.createFetchHttpClient(),
});
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const DIA = 86400000;

Deno.serve(async (req) => {
  // Abrirla en el navegador confirma que está desplegada y con sus llaves.
  if (req.method === 'GET') {
    return new Response(JSON.stringify({
      ok: true,
      funcion: 'stripe-webhook',
      clave: Deno.env.get('STRIPE_SECRET_KEY') ? 'puesta' : 'FALTA STRIPE_SECRET_KEY',
      secreto: WEBHOOK_SECRET ? 'puesto' : 'FALTA STRIPE_WEBHOOK_SECRET',
    }, null, 2), { headers: { 'Content-Type': 'application/json' } });
  }

  const firma = req.headers.get('stripe-signature');
  const cuerpo = await req.text();

  let evt: Stripe.Event;
  try {
    evt = await stripe.webhooks.constructEventAsync(cuerpo, firma!, WEBHOOK_SECRET);
  } catch (e) {
    console.error('firma inválida', (e as Error).message);
    return new Response('firma inválida', { status: 400 });
  }

  try {
    switch (evt.type) {
      // Pago con tarjeta terminado, o comprobante de OXXO emitido.
      case 'checkout.session.completed': {
        const s = evt.data.object as Stripe.Checkout.Session;
        if (s.mode === 'subscription' && s.subscription) {
          const sub = await stripe.subscriptions.retrieve(s.subscription as string);
          await guardar(correoDe(s), sub);
        } else if (s.mode === 'payment') {
          // Con OXXO llega aquí SIN pagar todavía: el estado es 'unpaid'.
          // Sólo damos acceso cuando Stripe confirma que ya se pagó.
          if (s.payment_status === 'paid') await guardarUnico(s);
          else console.log('pago pendiente (OXXO), esperando confirmación', s.id);
        }
        break;
      }

      // OXXO pagado en la tienda: aquí sí se abre el acceso.
      case 'checkout.session.async_payment_succeeded': {
        const s = evt.data.object as Stripe.Checkout.Session;
        await guardarUnico(s);
        break;
      }

      // El comprobante venció sin pagarse.
      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired': {
        const s = evt.data.object as Stripe.Checkout.Session;
        console.log('pago no completado', s.id, correoDe(s));
        break;
      }

      // Cada cobro mensual o anual que pasa: se alarga el acceso.
      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const inv = evt.data.object as any;
        const subId = inv.subscription || inv.parent?.subscription_details?.subscription;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId as string);
          const email = (inv.customer_email || '').trim().toLowerCase()
            || (((await stripe.customers.retrieve(sub.customer as string)) as Stripe.Customer).email || '').trim().toLowerCase();
          await guardar(email, sub);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = evt.data.object as Stripe.Subscription;
        const cliente = await stripe.customers.retrieve(sub.customer as string) as Stripe.Customer;
        await guardar((cliente.email || '').trim().toLowerCase(), sub);
        break;
      }
    }
    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response('error', { status: 500 });
  }
});

function correoDe(s: Stripe.Checkout.Session) {
  return (s.customer_details?.email || s.customer_email || '').trim().toLowerCase();
}

// Pago único: el monto nos dice qué compró. Los cortes dependen de la moneda —
// en pesos $450 y $200, en dólares $25 y $10.
async function guardarUnico(s: Stripe.Checkout.Session) {
  const email = correoDe(s);
  if (!email) { console.error('pago único sin correo', s.id); return; }

  const centavos = s.amount_total || 0;
  const moneda = (s.currency || 'mxn').toLowerCase();
  const esPeso = moneda === 'mxn';
  const cortePorVida = esPeso ? 45000 : 2500;
  const corteAnual = esPeso ? 20000 : 1000;

  // Para siempre: no acumula ni vence. Guardamos una fecha lejana para no
  // tocar la lógica de comparación del verificador.
  if (centavos >= cortePorVida) {
    await escribir({
      email,
      activa: true,
      estado: 'para_siempre',
      vence: '2999-12-31T00:00:00.000Z',
      referencia: s.id,
      actualizado: new Date().toISOString(),
    });
    return;
  }

  const dias = centavos >= corteAnual ? 365 : 30;

  // Si ya tenía acceso vigente, el tiempo nuevo se suma al que le quedaba.
  const desde = await vencimientoActual(email);
  const base = desde && desde > Date.now() ? desde : Date.now();
  const vence = new Date(base + dias * DIA).toISOString();

  await escribir({
    email,
    activa: true,
    estado: dias === 365 ? 'un_año' : 'un_mes',
    vence,
    referencia: s.id,
    actualizado: new Date().toISOString(),
  });
}

async function vencimientoActual(email: string): Promise<number | null> {
  try {
    const r = await fetch(
      SUPABASE_URL + '/rest/v1/suscripciones?email=eq.' + encodeURIComponent(email) + '&select=vence',
      { headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY } }
    );
    const filas = await r.json();
    const v = Array.isArray(filas) && filas[0] && filas[0].vence;
    return v ? new Date(v).getTime() : null;
  } catch { return null; }
}

async function guardar(email: string, sub: Stripe.Subscription) {
  if (!email) return;
  const vigente = sub.status === 'active' || sub.status === 'trialing';
  await escribir({
    email,
    activa: vigente,
    estado: sub.status,
    // Las versiones nuevas de Stripe guardan la fecha en el primer item.
    vence: (() => {
      const fin = (sub as any).current_period_end || (sub as any).items?.data?.[0]?.current_period_end;
      return fin ? new Date(fin * 1000).toISOString() : new Date(Date.now() + 31 * DIA).toISOString();
    })(),
    referencia: sub.id,
    actualizado: new Date().toISOString(),
  });
}

async function escribir(fila: Record<string, unknown>) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/suscripciones?on_conflict=email', {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: 'Bearer ' + SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(fila),
  });
  if (!r.ok) throw new Error('Supabase ' + r.status + ' ' + (await r.text()));
}
