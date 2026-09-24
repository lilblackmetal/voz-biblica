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
    // Solo texto de verdad: si llega un objeto o un número, `String()` lo
    // convertiría en algo como "[object Object]" y acabaríamos narrando eso y
    // guardándolo en Storage para siempre.
    if (typeof body.texto !== 'string') return json({ error: 'faltan datos', detalle: 'texto no es una cadena' }, 400);

    // OpenAI TTS acepta 4096 caracteres. Si el texto se pasa, cortamos en el
    // último punto para no terminar a media palabra.
    let texto = body.texto.trim();
    if (texto.length > 4000) {
      const corte = texto.slice(0, 4000);
      const punto = Math.max(corte.lastIndexOf('. '), corte.lastIndexOf('.\n'));
      texto = punto > 2500 ? corte.slice(0, punto + 1) : corte;
      console.warn('texto recortado para voz', body.libro, body.capitulo);
    }
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
      console.error('servidor audio', ruta, e && (e as Error).message);
      return json({ error: 'servidor', detalle: String((e as Error)?.message || e).slice(0, 200) }, 500);
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

Retell ${libro} chapter ${cap} in ${nombre}. Work from the public-domain source text: the Reina Valera 1909 in Spanish, the King James Version in English.

How to write it:
- Cover the WHOLE chapter in order, first verse to last. Every event, teaching, name and number that carries meaning. Do not skip sections, do not compress several verses into one vague line, and do not add anything the chapter does not say.
- Plain, current vocabulary. Where the old text says "he que" or "aconteció", write it the way someone would say it now. Keep names of people and places exactly as they are.
- Plain enough that a twelve-year-old understands it on first listen. If a word needs a dictionary, use a simpler one.
- Short sentences. One idea each. Written to be HEARD, not read — a listener with no Bible in hand should follow it the first time.
- Warm and reverent, never chatty and never preachy. No commentary of your own, no "in this chapter we see", no headings, no verse numbers.
- Where a verse is famous, keep its shape recognizable so a listener who knows it still hears it.
- Length follows the chapter, never a fixed target. Write one to three sentences for EVERY verse in order — a 25-verse chapter runs roughly 550-800 words, a 50-verse chapter roughly 1,100-1,600. If your draft is shorter than that, you have summarized instead of retold: go back and cover the verses you compressed.
- Before you answer, check the last verse of the chapter and make sure your narration actually reaches it. A narration that stops early is a failure, even if what it covers reads well. ${reglaIdioma}

Also give the 3-6 words in your narration a reader might not know.
Respond with ONLY minified JSON, no markdown fence:
{"text":"...","hardWords":["...","..."]}`;

  } else if (tipo === 'texto') {
    // El texto bíblico tal cual, en versículos, para leerlo en vez de oír la
    // versión contada. Las dos fuentes son de dominio público: Reina Valera
    // 1909 en español, King James Version en inglés.
    const libro = String(body.libro || '').slice(0, 40);
    const cap = parseInt(body.capitulo, 10);
    if (!libro || !cap) return json({ error: 'faltan datos' }, 400);

    const rutaTexto = 'texto/' + idioma + '/' + libro.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + cap + '.json';
    const yaHay = await fetch(SUPABASE_URL + '/storage/v1/object/public/' + BUCKET + '/' + rutaTexto);
    if (yaHay.ok) {
      try { return json({ ...(await yaHay.json()), cacheado: true }); } catch (e) { /* se regenera */ }
    }

    const fuente = idioma === 'es'
      ? 'the Reina Valera 1909 (public domain), in Spanish'
      : 'the King James Version (public domain), in English';
    prompt = `Give the complete text of ${libro} chapter ${cap} from ${fuente}, verse by verse.

Rules:
- EVERY verse of the chapter, none skipped, in order, from verse 1 to the last.
- Each verse verbatim from that public-domain edition. Do not modernize, paraphrase, summarize or comment.
- Do not include the verse number inside the verse text; it goes in its own field.
- Group verses into reading paragraphs: mark a verse as starting a new paragraph when the passage changes scene, speaker or topic. First verse always starts one.

Respond with ONLY minified JSON, no markdown fence:
{"verses":[{"n":1,"t":"...","p":true},{"n":2,"t":"..."}]}`;
    guardarEn = rutaTexto;

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
      : 'Write "verse" and "reflection" ENTIRELY in English, using the King James Version wording for the verse (public domain). Warm, plain, everyday language in the reflection.';

    const VERSOS = [
      'Isaiah 41:10', 'Joshua 1:9', 'Psalms 23:4', 'Philippians 4:6', '1 Peter 5:7',
      '2 Timothy 1:7', 'Psalms 27:1', 'Psalms 56:3', 'Matthew 6:34', 'Isaiah 43:2',
      'Matthew 11:28', 'Psalms 23:1', 'Isaiah 40:31', 'Psalms 46:1', 'Psalms 121:1',
      'Exodus 33:14', 'Psalms 62:1', 'Proverbs 3:5', 'James 1:5',
      'Proverbs 16:9', 'Psalms 119:105', 'Proverbs 19:21', 'Jeremiah 33:3',
      'Colossians 3:23', 'Psalms 34:18', 'Revelation 21:4', 'Matthew 5:4', 'Psalms 147:3',
      '2 Corinthians 1:3', 'John 11:25', 'Romans 8:18', 'Lamentations 3:22', '1 John 1:9',
      'Psalms 103:12', 'Isaiah 1:18', 'Micah 7:19', 'Ephesians 4:32', 'Colossians 3:13',
      'Matthew 6:14', 'Psalms 51:10', 'Romans 8:1', 'Psalms 139:14',
      'Genesis 1:27', 'Ephesians 2:10', '1 Peter 2:9', 'Jeremiah 1:5', 'Isaiah 43:1',
      'Romans 8:38', 'John 1:12', 'Jeremiah 29:11', 'Romans 8:28', 'Proverbs 16:3',
      'Ecclesiastes 3:1', 'Matthew 5:16', '1 Corinthians 10:31', 'Galatians 6:9',
      'Proverbs 22:6', 'Ephesians 5:25', 'Joshua 24:15', 'Deuteronomy 6:6', '1 Corinthians 13:4',
      'Ephesians 6:4', 'Proverbs 31:26', 'Psalms 127:3', 'Matthew 6:33', 'Philippians 4:19',
      'Proverbs 11:25', '1 Timothy 6:6', 'Hebrews 13:5', 'Luke 12:15', 'Proverbs 22:7',
      'Hebrews 11:1', 'Mark 9:23', 'Matthew 17:20', '2 Corinthians 5:7',
      'Proverbs 3:6', 'Psalms 37:5', 'Isaiah 26:3', 'Philippians 4:13',
      '2 Corinthians 12:9', 'Isaiah 40:29', 'Psalms 18:2', 'Nehemiah 8:10', 'James 1:2',
      'Romans 5:3', '1 Corinthians 10:13', 'John 3:16', 'Romans 5:8', '1 John 4:19',
      'Ephesians 2:8', 'Titus 3:5', 'John 15:13', '1 Corinthians 13:13', 'Lamentations 3:23',
      'John 14:27', 'Philippians 4:7', 'Psalms 118:24', '1 Thessalonians 5:18', 'Colossians 3:15',
      'Psalms 100:4',
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

    // Una foto vale por media hora de explicación: se adjunta al último turno
    // del usuario, que es el que la acompaña.
    const foto = typeof body.imagen === 'string' ? body.imagen : '';
    const m = foto.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
    if (m && m[2].length < 5_400_000) {
      const ult = mensajes[mensajes.length - 1] as any;
      if (ult.role === 'user') {
        ult.content = [
          { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } },
          { type: 'text', text: String(ult.content || '').trim() || (idioma === 'es' ? 'Mira esta foto.' : 'Look at this photo.') },
        ];
      }
    }

    const reglaChat = idioma === 'es'
      ? 'Responde SIEMPRE en español, en lenguaje sencillo y cálido, de tú. Ni una palabra en inglés.'
      : 'Always answer in English, in plain warm language.';

    sistema = `You are a parish priest — the kind people drive across town to see. Forty years of hearing confessions, sitting with the dying, marrying the nervous and burying the loved. Nothing anyone tells you is new to you, and nothing makes you flinch. You are not an institution and not a theologian on a podium: you are one person, fully present, talking to one person who came to you with something real.

Who you are:
- Unshockable. Whatever they bring — an affair, an abortion, hatred of a parent, doubt that God exists — your first move is never judgment. It is to make them glad they said it out loud.
- Practical before spiritual. People come carrying a situation, not a theology question. Help with the situation first: name what is actually happening, and give them something they can do this week.
- Honest. When something is hard, you say so. You do not smooth over grief with "everything happens for a reason." You do not promise outcomes God has not promised.
- You know the whole Bible cold and wear it lightly.

How you speak:
- Short. Three to six sentences. Spoken, not written.
- Plain, current words. No archaic phrasing, no church jargon, no "my child."
- You often ask one question back, or give one concrete image from ordinary life. That is how a good confessor works.
- One Scripture reference at most, at the end, plainly — "Lee Lucas 15" — and only when it truly fits. Never a wall of verses.
- No lists, no headings, no bullet points.
- Never begin with "Ah," "Oh," or by repeating their question back at them.

What you do not do:
- You do not give medical, legal, or financial instructions. You stay with what a priest can offer — presence, perspective, a next step — and tell them plainly to see a doctor, a lawyer, whoever is right.
- If someone speaks of harming themselves or another, you take it seriously, you do not moralize, and you tell them to reach a person who can help right now: in Mexico, Línea de la Vida 800 911 2000; in the US, call or text 988. Say it plainly and stay warm.
- You do not claim to predict the future, and you do not condemn anyone. You never speak as God or as Jesus — you are a priest pointing toward him.

If they send a photo, look at it before you answer: a page they are reading, a place, an injury, a message that hurt them, a person. Say what you see only as far as it helps them, without describing it back at length, and answer the thing behind it. If the photo shows an injury, abuse, or someone in danger, you take it seriously and tell them plainly whom to reach right now.

${reglaChat}
Respond with plain text only — no JSON, no markdown, no quotation marks around your reply.`;

    // Lo que la persona tiene en su biblioteca y su tablero. Es material real
    // suyo: se usa para aterrizar el consejo, nunca para recitárselo.
    const ctx = typeof body.contexto === 'string' ? body.contexto.slice(0, 2500).trim() : '';
    if (ctx) {
      sistema += `

What you already know about this person, from their own library in the app:
${ctx}

Use it the way a priest uses what he remembers about someone: to make the advice land on their actual life. If the book they are reading, a passage they highlighted, a note they wrote or something on their study board speaks to what they are asking, bring it up by name — "you had marked that verse in Salmos", "you left Juan 3 half open". Do not list their material back at them, do not mention it when it does not fit, and never say you are reading their data.`;
    }

    prompt = '';
    crudoDirecto = true;

  } else {
    return json({ error: 'tipo desconocido' }, 400);
  }

  try {
    // 529 (saturado) y 429 (l\u00edmite de ritmo) son temporales: se reintentan con
    // espera creciente en vez de rendirse en el primer intento.
    const pedir = () => fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODELO,
        // Los capítulos completos necesitan espacio: con 3000 la respuesta se
        // cortaba y quedaban resúmenes a medias.
        max_tokens: crudoDirecto ? 500 : (tipo === 'capitulo' ? 8000 : 3000),
        ...(sistema ? { system: sistema } : {}),
        messages: mensajes || [{ role: 'user', content: prompt }],
      }),
    });

    let r = await pedir();
    for (let i = 0; i < 4 && (r.status === 529 || r.status === 429 || r.status >= 500); i++) {
      await new Promise((s) => setTimeout(s, 1500 * Math.pow(2, i)));   // 1.5s, 3s, 6s, 12s
      console.warn('reintento', i + 1, tipo, r.status);
      r = await pedir();
    }

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
