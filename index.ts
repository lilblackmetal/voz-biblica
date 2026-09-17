// supabase/functions/mercadopago-webhook/index.ts
// Mercado Pago avisa aquí cada vez que alguien paga, renueva o cancela.
// Importante: desplegar con --no-verify-jwt (Mercado Pago no manda token
// de Supabase). Variables que necesita:
//   MP_ACCESS_TOKEN  — el token privado de tu cuenta (Credenciales de producción)
//   MP_WEBHOOK_SECRET — la clave secreta que Mercado Pago muestra al crear el webhook
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — ya las tienes

const MP_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')!;
const MP_SECRET = Deno.env.get('MP_WEBHOOK_SECRET') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const DIA = 86400000;

Deno.serve(async (req) => {
  // Abrirla en el navegador es un GET: contestamos algo legible para poder
  // confirmar que está desplegada y con sus llaves puestas.
  if (req.method === 'GET') {
    return new Response(JSON.stringify({
      ok: true,
      funcion: 'mercadopago-webhook',
      token: MP_TOKEN ? 'puesto' : 'FALTA MP_ACCESS_TOKEN',
      secreto: MP_SECRET ? 'puesto' : 'FALTA MP_WEBHOOK_SECRET',
    }, null, 2), { headers: { 'Content-Type': 'application/json' } });
  }

  const cuerpo = await req.text();

  // Mercado Pago firma cada aviso. Sin esto, cualquiera podría regalarse
  // acceso mandando un aviso falso.
  if (MP_SECRET) {
    const ok = await firmaValida(req, cuerpo);
    if (!ok) {
      console.error('firma inválida');
      return new Response('firma inválida', { status: 400 });
    }
  }

  let aviso: Record<string, any> = {};
  try { aviso = JSON.parse(cuerpo || '{}'); } catch { /* aviso vacío */ }

  const tipo = aviso.type || aviso.topic || '';
  const id = String((aviso.data && aviso.data.id) || aviso.id || '');

  try {
    if (tipo === 'payment' && id) {
      await procesarPago(id);
    } else if ((tipo === 'preapproval' || tipo === 'subscription_preapproval') && id) {
      await procesarSuscripcion(id);
    } else if (tipo === 'subscription_authorized_payment' && id) {
      // Cobro de una renovación: refrescamos la suscripción que lo generó.
      const c = await mp('/authorized_payments/' + id);
      if (c && c.preapproval_id) await procesarSuscripcion(String(c.preapproval_id));
    } else {
      console.log('aviso ignorado', tipo, id);
    }
  } catch (e) {
    console.error('error procesando', tipo, id, (e as Error).message);
    // 500 hace que Mercado Pago reintente: mejor eso que perder un pago.
    return new Response('error', { status: 500 });
  }

  return new Response('ok', { status: 200 });
});

async function mp(ruta: string) {
  const r = await fetch('https://api.mercadopago.com' + ruta, {
    headers: { Authorization: 'Bearer ' + MP_TOKEN },
  });
  if (!r.ok) throw new Error('Mercado Pago ' + r.status + ' en ' + ruta + ': ' + (await r.text()));
  return await r.json();
}

// Pago único o cobro suelto. El monto dice qué compró: en pesos los cortes
// están en $450 y $200; en dólares, en $25 y $10.
async function procesarPago(id: string) {
  const p = await mp('/v1/payments/' + id);

  if (p.status !== 'approved') {
    console.log('pago no aprobado todavía', id, p.status);
    return;
  }

  // Una renovación de suscripción llega también como pago: la maneja
  // procesarSuscripcion, que sabe la fecha real del siguiente cobro.
  const preapproval = p.metadata?.preapproval_id || p.point_of_interaction?.transaction_data?.subscription_id;
  if (preapproval) { await procesarSuscripcion(String(preapproval)); return; }

  const email = correoDe(p);
  if (!email) { console.error('pago sin correo', id); return; }

  const monto = Number(p.transaction_amount || 0);
  const esPeso = String(p.currency_id || 'MXN').toUpperCase() === 'MXN';
  const cortePorVida = esPeso ? 450 : 25;
  const corteAnual = esPeso ? 200 : 10;

  if (monto >= cortePorVida) {
    await escribir({
      email,
      activa: true,
      estado: 'para_siempre',
      vence: '2999-12-31T00:00:00.000Z',
      referencia: 'mp-' + id,
      actualizado: new Date().toISOString(),
    });
    return;
  }

  const dias = monto >= corteAnual ? 365 : 30;

  // Si ya tenía acceso vigente, el tiempo nuevo se suma al que le quedaba.
  const desde = await vencimientoActual(email);
  const base = desde && desde > Date.now() ? desde : Date.now();

  await escribir({
    email,
    activa: true,
    estado: dias === 365 ? 'un_año' : 'un_mes',
    vence: new Date(base + dias * DIA).toISOString(),
    referencia: 'mp-' + id,
    actualizado: new Date().toISOString(),
  });
}

// Suscripción recurrente: alta, renovación, pausa o cancelación.
async function procesarSuscripcion(id: string) {
  const s = await mp('/preapproval/' + id);
  const email = (s.payer_email || '').trim().toLowerCase();
  if (!email) { console.error('suscripción sin correo', id); return; }

  const vigente = s.status === 'authorized';
  const frecuencia = s.auto_recurring?.frequency_type === 'years'
    || (s.auto_recurring?.frequency_type === 'months' && Number(s.auto_recurring?.frequency) >= 12);

  // Mercado Pago da la fecha del próximo cobro. Le sumamos tres días de
  // colchón para que un cobro atrasado no cierre la app de golpe.
  const proximo = s.next_payment_date ? new Date(s.next_payment_date).getTime() : null;
  const vence = proximo
    ? new Date(proximo + 3 * DIA).toISOString()
    : new Date(Date.now() + (frecuencia ? 365 : 30) * DIA).toISOString();

  await escribir({
    email,
    activa: vigente,
    estado: s.status || 'desconocido',
    vence: vigente ? vence : new Date().toISOString(),
    referencia: 'mp-sub-' + id,
    actualizado: new Date().toISOString(),
  });
}

function correoDe(p: Record<string, any>) {
  return String(p.payer?.email || p.additional_info?.payer?.email || '').trim().toLowerCase();
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
  console.log('guardado', fila.email, fila.estado, fila.vence);
}

// La firma viene en la cabecera x-signature como "ts=...,v1=...". Lo que se
// firma es "id:<data.id>;request-id:<x-request-id>;ts:<ts>;".
async function firmaValida(req: Request, cuerpo: string): Promise<boolean> {
  const firma = req.headers.get('x-signature') || '';
  const requestId = req.headers.get('x-request-id') || '';
  const partes: Record<string, string> = {};
  firma.split(',').forEach((p) => {
    const [k, v] = p.split('=');
    if (k && v) partes[k.trim()] = v.trim();
  });
  if (!partes.ts || !partes.v1) return false;

  let dataId = '';
  try {
    const j = JSON.parse(cuerpo || '{}');
    dataId = String((j.data && j.data.id) || j.id || '');
  } catch { /* sin cuerpo */ }

  const manifiesto = (dataId ? 'id:' + dataId.toLowerCase() + ';' : '')
    + (requestId ? 'request-id:' + requestId + ';' : '')
    + 'ts:' + partes.ts + ';';

  const llave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(MP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const bytes = await crypto.subtle.sign('HMAC', llave, new TextEncoder().encode(manifiesto));
  const esperado = Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return esperado === partes.v1;
}
