// supabase/functions/narrar/index.ts
// Genera el texto simplificado de un capítulo y las definiciones de palabras.
// La llave de Anthropic vive aquí, en el servidor. Nunca en la app.

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MODELO = 'claude-sonnet-4-5-20250929';
const BUCKET = 'audio';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'json inválido' }, 400); }

  const tipo = body.tipo;               // 'capitulo' | 'palabra' | 'buscar' | 'audio'
  const idioma = body.idioma === 'en' ? 'en' : 'es';
  const nombre = idioma === 'es' ? 'Spanish' : 'English';

  // El audio real del capítulo: se genera una vez y se guarda para siempre.
  if (tipo === 'audio') {
    const limpio = (s: string) => s.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const libro = limpio(String(body.libro || '').slice(0, 40));
    const cap = parseInt(body.capitulo, 10);
    const texto = String(body.texto || '').slice(0, 4000).trim();
    if (!libro || !cap || !texto) return json({ error: 'faltan datos' }, 400);

    // AAC pesa como un tercio del MP3 con la misma voz, y lo abren todos los
    // navegadores. Los .mp3 viejos siguen sirviendo.
    const ruta = idioma + '/' + libro + '-' + cap + '.m4a';
    const publica = SUPABASE_URL + '/storage/v1/object/public/' + BUCKET + '/' + ruta;

    try {
      const ya = await fetch(publica, { method: 'HEAD' });
      if (ya.ok) return json({ url: publica, nuevo: false });

      const instruccion = idioma === 'es'
        ? 'Lee como un narrador de audiolibro: pausado, cálido y reverente. Español neutro latinoamericano.'
        : 'Read like an audiobook narrator: unhurried, warm and reverent.';

      const tts = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + OPENAI_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini-tts',
          voice: 'onyx',
          input: texto,
          instructions: instruccion,
          response_format: 'aac',
        }),
      });
      if (!tts.ok) {
        const detalle = await tts.text();
        console.error('openai', tts.status, detalle);
        return json({ error: 'voz', status: tts.status, detalle: detalle.slice(0, 300) }, 502);
      }

      const mp3 = await tts.arrayBuffer();
      const subida = await fetch(SUPABASE_URL + '/storage/v1/object/' + BUCKET + '/' + ruta, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + SERVICE_KEY,
          apikey: SERVICE_KEY,
          'Content-Type': 'audio/mp4',
          'x-upsert': 'true',
          'Cache-Control': 'public, max-age=31536000',
        },
        body: mp3,
      });
      if (!subida.ok) {
        const detalle = await subida.text();
        console.error('storage', subida.status, detalle);
        return json({ error: 'guardar', status: subida.status, detalle: detalle.slice(0, 300) }, 502);
      }

      return json({ url: publica, nuevo: true });
    } catch (e) {
      console.error(e);
      return json({ error: 'servidor' }, 500);
    }
  }

  let prompt: string;
  let guardarEn: string | null = null;
  let sistema: string | null = null;
  let mensajes: unknown[] | null = null;
  let crudoDirecto = false;

  if (tipo === 'capitulo') {
    const libro = String(body.libro || '').slice(0, 40);
    const cap = parseInt(body.capitulo, 10);
    if (!libro || !cap) return json({ error: 'faltan datos' }, 400);

    // Si alguien ya abrió este capítulo, servimos lo guardado: sale al instante
    // y no se vuelve a pagar la generación.
    guardarEn = idioma + '/' + libro.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + cap + '.json';
    try {
      const previo = await fetch(SUPABASE_URL + '/storage/v1/object/public/' + BUCKET + '/' + guardarEn);
      if (previo.ok) return json(await previo.json());
    } catch (e) { /* seguimos y lo generamos */ }

    const reglaIdioma = idioma === 'es'
      ? 'Write the narration ENTIRELY in Spanish — every word must be Spanish, with correct native grammar and spelling. Do not mix in any English words or phrases (no Spanglish).'
      : 'Write the narration ENTIRELY in English — every word must be English. Do not mix in any Spanish words or phrases.';

    prompt = `You are producing a modern, thought-for-thought retelling of the Bible — the approach the NIV takes: faithful to the meaning of every verse, but in the natural, contemporary words a person actually speaks today. Never archaic, never stiff, never a loose paraphrase that drops content.

Retell ${libro} chapter ${cap} (from the Reina Valera 1909, public domain) in ${nombre}.

How to write it:
- Cover the WHOLE chapter in order, first verse to last. Every event, teaching, name and number that carries meaning. Do not skip sections, do not compress several verses into one vague line, and do not add anything the chapter does not say.
- Plain, current vocabulary. Where the old text says "he que" or "aconteció", write it the way someone would say it now. Keep names of people and places exactly as they are.
- Short sentences. One idea each. Written to be HEARD, not read — a listener with no Bible in hand should follow it the first time.
- Warm and reverent, never chatty and never preachy. No commentary of your own, no "in this chapter we see", no headings, no verse numbers.
- Where a verse is famous, keep its shape recognizable so a listener who knows it still hears it.
- 300-420 words of flowing narration. ${reglaIdioma}

Also give the 3-6 words in your narration a reader might not know.
Respond with ONLY minified JSON, no markdown fence:
{"text":"...","hardWords":["...","..."]}`;

  } else if (tipo === 'palabra') {
    const palabra = String(body.palabra || '').slice(0, 60);
    if (!palabra) return json({ error: 'faltan datos' }, 400);
    const reglaPalabra = idioma === 'es'
      ? 'The definition MUST be written entirely in Spanish. Every word Spanish, correct native grammar. No English words at all.'
      : 'The definition MUST be written entirely in English. No Spanish words at all.';
    prompt = `Give a very short, simple definition of the word "${palabra}" as used in everyday, plain language. ${reglaPalabra} Maximum 12 words.
Respond with ONLY minified JSON, no markdown fence:
{"definition":"..."}`;

  } else if (tipo === 'buscar') {
    const tema = String(body.tema || '').slice(0, 80).trim();
    if (!tema) return json({ error: 'faltan datos' }, 400);

    // Guardamos cada búsqueda: los temas se repiten mucho entre usuarios.
    guardarEn = 'temas3/' + idioma + '-' + tema.replace(/[^a-z0-9áéíóúñü]+/gi, '-').toLowerCase() + '.json';
    try {
      const previo = await fetch(SUPABASE_URL + '/storage/v1/object/public/' + BUCKET + '/' + guardarEn);
      if (previo.ok) return json(await previo.json());
    } catch (e) { /* seguimos */ }

    const reglaTema = idioma === 'es'
      ? 'Write "why" ENTIRELY in Spanish, plain warm everyday language. No English words.'
      : 'Write "why" ENTIRELY in English, plain warm everyday language.';

    prompt = `A person is going through: "${tema}". Choose 10 Bible chapters that speak to this, from across both testaments. Lead with the chapters a pastor would actually name for this — the well-known, widely-loved passages people already turn to — then broaden. Prefer whole chapters that a person can listen to and feel understood by, not obscure single verses. Order them from most fitting to least.
For each, name the book in English exactly as it appears in a standard Protestant Bible (66 books), the chapter number, and one short sentence saying what this chapter offers someone in that situation. ${reglaTema} Keep each "why" under 18 words.
Respond with ONLY minified JSON, no markdown fence:
{"results":[{"book":"Psalms","chapter":23,"why":"..."}]}`;

  } else if (tipo === 'diario') {
    // Una sola palabra del día para todos: se genera una vez y se guarda por fecha.
    const hoy = new Date().toISOString().slice(0, 10);
    guardarEn = 'diario/' + idioma + '-' + hoy + '.json';
    try {
      const previo = await fetch(SUPABASE_URL + '/storage/v1/object/public/' + BUCKET + '/' + guardarEn);
      if (previo.ok) return json(await previo.json());
    } catch (e) { /* seguimos */ }

    const reglaDiario = idioma === 'es'
      ? 'Write "verse" and "reflection" ENTIRELY in Spanish, using the Reina Valera wording for the verse. Warm, plain, everyday language in the reflection. No English words.'
      : 'Write "verse" and "reflection" ENTIRELY in English, using King James wording for the verse.';

    const VERSOS = [
      'Psalms 23:1', 'Isaiah 41:10', 'John 3:16', 'Philippians 4:13', 'Proverbs 3:5',
      'Romans 8:28', 'Joshua 1:9', 'Psalms 46:1', 'Matthew 11:28', 'Jeremiah 29:11',
      '2 Timothy 1:7', 'Psalms 91:1', 'Isaiah 40:31', 'Hebrews 11:1', 'James 1:5',
      '1 Peter 5:7', 'Psalms 27:1', 'Matthew 6:33', 'Galatians 5:22', 'Ephesians 2:8',
      'Psalms 121:1', 'Lamentations 3:22', 'Micah 6:8', 'Zephaniah 3:17', 'Habakkuk 3:19',
      'John 14:27', 'Romans 12:2', '1 Corinthians 13:4', '2 Corinthians 5:17', 'Colossians 3:23',
      'Psalms 34:18', 'Psalms 37:4', 'Psalms 51:10', 'Psalms 103:2', 'Psalms 119:105',
      'Proverbs 16:3', 'Proverbs 18:10', 'Proverbs 22:6', 'Ecclesiastes 3:1', 'Isaiah 26:3',
      'Isaiah 43:2', 'Isaiah 53:5', 'Isaiah 55:8', 'Matthew 5:14', 'Matthew 7:7',
      'Matthew 28:19', 'Mark 10:27', 'Mark 11:24', 'Luke 1:37', 'Luke 6:31',
      'John 1:1', 'John 8:12', 'John 10:10', 'John 15:5', 'John 16:33',
      'Acts 1:8', 'Romans 5:8', 'Romans 10:9', 'Romans 15:13', '1 Corinthians 10:13',
      '2 Corinthians 12:9', 'Galatians 2:20', 'Galatians 6:9', 'Ephesians 4:32', 'Ephesians 6:10',
      'Philippians 1:6', 'Philippians 4:6', 'Colossians 3:12', '1 Thessalonians 5:16', '2 Timothy 3:16',
      'Hebrews 4:12', 'Hebrews 12:1', 'Hebrews 13:8', 'James 1:2', 'James 4:8',
      '1 Peter 2:9', '1 John 1:9', '1 John 4:7', '1 John 4:19', 'Revelation 3:20',
      'Genesis 1:1', 'Exodus 14:14', 'Deuteronomy 31:6', 'Ruth 1:16', '1 Samuel 16:7',
      'Nehemiah 8:10', 'Job 19:25', 'Daniel 3:17', 'Jonah 2:2', 'Malachi 3:10',
    ];
    const inicio = Date.UTC(new Date(hoy).getUTCFullYear(), 0, 1);
    const dia = Math.floor((new Date(hoy).getTime() - inicio) / 86400000);
    const elegido = VERSOS[dia % VERSOS.length];

    prompt = `Today is ${hoy}. The verse for today is ${elegido} — use exactly that reference, no other.
Give the verse text itself, its reference (book in English exactly as in a standard 66-book Protestant Bible, plus chapter and verse), and two sentences of reflection on what it offers today. ${reglaDiario} Keep the reflection under 40 words.
Respond with ONLY minified JSON, no markdown fence:
{"verse":"...","book":"Isaiah","chapter":41,"verseNum":10,"reference":"Isaías 41:10","reflection":"..."}`;

  } else if (tipo === 'oracion') {
    const situacion = String(body.situacion || '').slice(0, 80).trim();
    if (!situacion) return json({ error: 'faltan datos' }, 400);

    // Las situaciones son fijas: una generación por situación, para siempre.
    guardarEn = 'oraciones/' + idioma + '-' + situacion.replace(/[^a-z0-9áéíóúñü]+/gi, '-').toLowerCase() + '.json';
    try {
      const previo = await fetch(SUPABASE_URL + '/storage/v1/object/public/' + BUCKET + '/' + guardarEn);
      if (previo.ok) return json(await previo.json());
    } catch (e) { /* seguimos */ }

    const reglaOracion = idioma === 'es'
      ? 'Write the prayer ENTIRELY in Spanish, addressing God as "Señor" and using "tú". Warm, plain, spoken language — the way a person actually prays out loud, not formal church language. No English words.'
      : 'Write the prayer ENTIRELY in English, in warm plain spoken language.';

    prompt = `Write a short prayer for this situation: "${situacion}". ${reglaOracion} Between 60 and 90 words. It should feel like someone's own words, honest and unhurried, ending in peace rather than a request. Do not quote scripture inside it.
Also name one Bible chapter that fits this prayer (book in English exactly as in a standard 66-book Protestant Bible).
Respond with ONLY minified JSON, no markdown fence:
{"prayer":"...","book":"Psalms","chapter":91}`;

  } else if (tipo === 'personaje') {
    const persona = String(body.persona || '').slice(0, 60).trim();
    if (!persona) return json({ error: 'faltan datos' }, 400);

    guardarEn = 'personajes/' + idioma + '-' + persona.replace(/[^a-z0-9áéíóúñü]+/gi, '-').toLowerCase() + '.json';
    try {
      const previo = await fetch(SUPABASE_URL + '/storage/v1/object/public/' + BUCKET + '/' + guardarEn);
      if (previo.ok) return json(await previo.json());
    } catch (e) { /* seguimos */ }

    const reglaPersona = idioma === 'es'
      ? 'Write "who", "did" and "matters" ENTIRELY in Spanish, plain warm everyday language. No English words.'
      : 'Write "who", "did" and "matters" ENTIRELY in English, plain warm everyday language.';

    prompt = `Write a short card about the Bible figure "${persona}". ${reglaPersona}
"who": one sentence saying who they were. "did": two sentences on what they did. "matters": one sentence on why their story still speaks to people. Each field under 35 words.
Also give 3 chapters where their story is found (book in English exactly as in a standard 66-book Protestant Bible).
Respond with ONLY minified JSON, no markdown fence:
{"who":"...","did":"...","matters":"...","chapters":[{"book":"Exodus","chapter":3}]}`;

  } else if (tipo === 'lugar') {
    const lugar = String(body.lugar || '').slice(0, 60).trim();
    if (!lugar) return json({ error: 'faltan datos' }, 400);

    guardarEn = 'lugares/' + idioma + '-' + lugar.replace(/[^a-z0-9áéíóúñü]+/gi, '-').toLowerCase() + '.json';
    try {
      const previo = await fetch(SUPABASE_URL + '/storage/v1/object/public/' + BUCKET + '/' + guardarEn);
      if (previo.ok) return json(await previo.json());
    } catch (e) { /* seguimos */ }

    const reglaLugar = idioma === 'es'
      ? 'Write "what", "happened" and "today" ENTIRELY in Spanish, plain warm everyday language. No English words.'
      : 'Write "what", "happened" and "today" ENTIRELY in English, plain warm everyday language.';

    prompt = `Write a short card about the biblical place "${lugar}". ${reglaLugar}
"what": one sentence on what this place was. "happened": two sentences on the most important things that happened there. "today": one sentence on what stands there now. Each field under 35 words.
Also give 3 chapters set in or about this place (book in English exactly as in a standard 66-book Protestant Bible), and the real-world latitude and longitude.
Respond with ONLY minified JSON, no markdown fence:
{"what":"...","happened":"...","today":"...","lat":31.78,"lon":35.22,"chapters":[{"book":"Luke","chapter":2}]}`;

  } else if (tipo === 'chat') {
    // La conversación es distinta cada vez: no se guarda ni se reutiliza.
    const hist = Array.isArray(body.mensajes) ? body.mensajes.slice(-12) : [];
    if (!hist.length) return json({ error: 'faltan datos' }, 400);

    mensajes = hist
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 1500) }));
    // El primer turno debe ser del usuario, venga de donde venga la llamada.
    while (mensajes.length && (mensajes[0] as any).role !== 'user') mensajes.shift();
    if (!mensajes.length) return json({ error: 'faltan datos' }, 400);

    const reglaChat = idioma === 'es'
      ? 'Responde SIEMPRE en español, en lenguaje sencillo y cálido, de tú. Ni una palabra en inglés.'
      : 'Always answer in English, in plain warm language.';

    sistema = `You are answering as Jesus of Nazareth, in the voice of the gospels: warm, direct, unhurried. You speak to one person who is telling you something real.

How you speak:
- Short. Two to five sentences. A listener should feel heard, not lectured.
- Plain, current words. No archaic phrasing, no "verily", no church jargon.
- You often answer with a question, or with a small image from ordinary life — bread, a road, a lost coin, a father waiting. That is how you taught.
- You never quote chapter and verse at someone. If a passage is what they need, you name it plainly at the end, like "Lee Lucas 15" — at most one, and only when it truly fits.
- No lists, no headings, no bullet points. You are speaking, not writing a document.
- Never begin with "Ah," "Oh," or a restatement of their question.

What you do not do:
- You do not give medical, legal, or financial instructions. When someone asks for those, you stay with what you can offer — presence, perspective — and tell them plainly to see a doctor, a lawyer, whoever is right.
- If someone speaks of harming themselves or another, you take it seriously, you do not moralize, and you tell them to reach a person who can help right now: in Mexico, Línea de la Vida 800 911 2000. Say it plainly and stay warm.
- You do not claim to predict the future, and you do not condemn anyone.

${reglaChat}
Respond with plain text only — no JSON, no markdown, no quotation marks around your reply.`;

    prompt = '';
    crudoDirecto = true;

  } else {
    return json({ error: 'tipo desconocido' }, 400);
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: crudoDirecto ? 500 : 2000,
        ...(sistema ? { system: sistema } : {}),
        messages: mensajes || [{ role: 'user', content: prompt }],
      }),
    });

    if (!r.ok) {
      const detalle = await r.text();
      console.error('anthropic', r.status, detalle);
      return json({ error: 'ia', status: r.status, detalle: detalle.slice(0, 300) }, 502);
    }

    const data = await r.json();
    let texto = (data.content?.[0]?.text || '').trim()
      .replace(/^\`\`\`(?:json)?/i, '')
      .replace(/\`\`\`$/, '')
      .trim();

    // El chat responde texto plano; todo lo demás viene como JSON.
    if (crudoDirecto) return json({ reply: texto });

    if (data.stop_reason === 'max_tokens') {
      console.error('truncado', tipo, guardarEn);
      return json({ error: 'ia', detalle: 'respuesta truncada' }, 502);
    }

    // Claude a veces antepone una línea o mete saltos de línea literales dentro
    // de las cadenas: ambos rompen JSON.parse. Recortamos al objeto y escapamos
    // los caracteres de control antes de intentar de nuevo.
    const parsear = (s: string) => {
      try { return JSON.parse(s); } catch (_) {}
      const a = s.indexOf('{'), b = s.lastIndexOf('}');
      if (a < 0 || b <= a) return null;
      const recorte = s.slice(a, b + 1);
      try { return JSON.parse(recorte); } catch (_) {}
      const escapado = recorte.replace(/[\u0000-\u001F]/g, (c) =>
        c === '\n' ? '\\n' : c === '\r' ? '' : c === '\t' ? ' ' : '');
      try { return JSON.parse(escapado); } catch (_) {}
      return null;
    };

    const resultado = parsear(texto);
    if (!resultado) {
      console.error('parse', tipo, texto.slice(0, 400));
      return json({ error: 'formato', detalle: texto.slice(0, 200) }, 502);
    }

    // Lo guardamos para quien lo abra después. Si falla, no importa.
    if (guardarEn) {
      fetch(SUPABASE_URL + '/storage/v1/object/' + BUCKET + '/' + guardarEn, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + SERVICE_KEY,
          apikey: SERVICE_KEY,
          'Content-Type': 'application/json',
          'x-upsert': 'true',
          'Cache-Control': 'public, max-age=31536000',
        },
        body: JSON.stringify(resultado),
      }).catch(() => {});
    }

    return json(resultado);
  } catch (e) {
    console.error('servidor', tipo, e && (e as Error).message);
    return json({ error: 'servidor', detalle: String((e as Error)?.message || e).slice(0, 200) }, 500);
  }
});
