
(function(){
  if (window.__vbMentor) return; window.__vbMentor = 1;
  var EN = (document.documentElement.lang||'').indexOf('en')===0 || /-en\.html/.test(location.pathname);
  var T = EN ? {
    nom:'Let\'s get started', tag:'Ready to change your life', sub:'', hola:'How do you want to CHANGE YOUR LIFE?',
    ph:'Type your question…', abrir:'Open Christian AI Mentor', cerrar:'Close', enviar:'Send',
    nose:'I hear you, friend. Something that has helped me: “Trust in the LORD with all thine heart; and lean not unto thine own understanding.” (Proverbs 3:5)\n\nTell me more: what weighs on you most today? Inside the app the Christian AI Mentor walks with you through the whole Bible.', cta:'Join Voz Bíblica', susc:'suscripcion-en.html',
    hi:'Hi. What do you want to know?'
  } : {
    nom:'Vamos a empezar', tag:'Listo para cambiar tu vida', sub:'', hola:'¿Cómo quieres CAMBIAR TU VIDA?',
    ph:'Escribe tu pregunta…', abrir:'Abrir Mentor cristiano de IA', cerrar:'Cerrar', enviar:'Enviar',
    nose:'Te escucho, amigo. Algo que me ha servido: «Fíate de Jehová de todo tu corazón, y no estribes en tu prudencia.» (Proverbios 3:5)\n\nCuéntame más: ¿qué es lo que más te pesa hoy? Dentro de la app el Mentor cristiano de IA te acompaña por toda la Biblia.', cta:'Únete a Voz Bíblica', susc:'suscripcion.html',
    hi:'Hola. ¿Qué quieres saber?'
  };
  var TEMAS = EN ? [
 {k:['anxiety','anxious','stress','stressed','worry','worried','panic','nervous','overwhelmed'], a:'I get it, that feeling that everything is piling up is exhausting. Breathe. You do not have to fix it all today.\n\n“Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.” (Philippians 4:6)\n\nLesson: write down what worries you, give it to God in prayer, and take only the next small step.'},
 {k:['fear','afraid','scared','insecure','courage','coward'], a:'Fear does not mean you are doing it wrong; it means it matters to you. Courage is not feeling no fear, it is moving forward with it.\n\n“Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.” (Joshua 1:9)\n\nLesson: name the fear out loud and take one step today, even a small one.'},
 {k:['money','debt','poor','work','job','business','finances','savings','salary','wealth','success','rich'], a:'Good question, and a practical one. The Bible talks a lot about money and almost always says the same thing: consistency and good work.\n\n“He becometh poor that dealeth with a slack hand: but the hand of the diligent maketh rich.” (Proverbs 10:4)\n\nLesson: spend less than you earn, work as if for God, and stay consistent for a full year. Proverbs has 31 chapters: one a day this month.'},
 {k:['forgive','forgiveness','guilt','guilty','sin','mistake','mistakes','regret','shame','ashamed'], a:'We have all fallen short, friend. What matters is what you do with it now.\n\n“If we confess our sins, he is faithful and just to forgive us our sins, and to cleanse us from all unrighteousness.” (1 John 1:9)\n\nLesson: confess it, apologize to whoever you hurt if you can, and let the guilt go. God does not ask you to carry what He already forgave.'},
 {k:['sad','sadness','depressed','depression','lonely','alone','empty','cry','crying'], a:'I am sorry you are going through this. You are not alone, even if it feels that way today.\n\n“The LORD is nigh unto them that are of a broken heart; and saveth such as be of a contrite spirit.” (Psalm 34:18)\n\nLesson: talk to someone you trust today, go for a walk, and read a Psalm out loud. If the sadness stays, get professional help; that takes courage too.'},
 {k:['family','wife','husband','partner','marriage','girlfriend','boyfriend','kids','son','daughter','parents','mom','dad','brother','fight','fighting'], a:'Relationships matter most to us and cost us the most. That is normal.\n\n“And be ye kind one to another, tenderhearted, forgiving one another, even as God for Christ\'s sake hath forgiven you.” (Ephesians 4:32)\n\nLesson: listen before you answer, apologize first even when it is hard, and say something good about that person today.'},
 {k:['purpose','meaning','direction','decision','decisions','decide','future','path','lost','confused','calling'], a:'That is one of the most important questions you can ask. Asking it already says a lot about you.\n\n“In all thy ways acknowledge him, and he shall direct thy paths.” (Proverbs 3:6)\n\nLesson: pray about the decision, ask someone wise for advice, and take the step that is clear today. The path gets clearer as you walk it.'},
 {k:['discipline','habit','habits','lazy','laziness','motivation','consistency','procrastinate','procrastination'], a:'Nobody feels like it every day. Habit makes the difference, not motivation.\n\n“Go to the ant, thou sluggard; consider her ways, and be wise.” (Proverbs 6:6)\n\nLesson: start so small you cannot fail: one chapter a day at the same time. In a year that is all 66 books.'},
 {k:['anger','angry','mad','rage','furious','upset'], a:'Getting angry is human. What counts is what you do in the next five minutes.\n\n“Let every man be swift to hear, slow to speak, slow to wrath.” (James 1:19)\n\nLesson: before you answer, breathe and wait. What you say angry is almost never what you mean.'},
 {k:['death','died','grief','grieving','lost my','passed away','funeral','miss'], a:'I am so sorry. Losing someone really hurts, and it is okay to cry.\n\n“Blessed are they that mourn: for they shall be comforted.” (Matthew 5:4)\n\nLesson: do not rush to be okay. Remember that person out loud, lean on your people, and let God walk with you through it.'},
 {k:['faith','doubt','doubts','believe','god','exist','pray','prayer'], a:'Doubting does not push you away from God; many of the great ones in the Bible doubted before they believed strongly.\n\n“Now faith is the substance of things hoped for, the evidence of things not seen.” (Hebrews 11:1)\n\nLesson: talk to God honestly, just as you are. And read the Gospel of John: it is the best place to start.'},
 {k:['tired','exhausted','worn out','give up','quit','cant anymore'], a:'You have clearly been carrying a lot. Resting is not giving up.\n\n“But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.” (Isaiah 40:31)\n\nLesson: sleep well tonight, let go of one thing that is not yours to carry, and take one more step tomorrow.'}
] : [
 {k:['ansiedad','ansioso','ansiosa','nervios','estres','estresado','preocupa','preocupado','angustia','panico'], a:'Te entiendo, esa sensación de que todo se viene encima cansa mucho. Respira. No tienes que resolver todo hoy.\n\n«Por nada estéis afanosos; sino sean notorias vuestras peticiones delante de Dios en toda oración y ruego, con hacimiento de gracias.» (Filipenses 4:6)\n\nLección: escribe lo que te preocupa, entrégaselo a Dios en oración y haz solo el siguiente paso pequeño.'},
 {k:['miedo','temor','asustado','inseguro','insegura','valor','cobarde'], a:'El miedo no significa que vas mal; significa que te importa. Lo valiente no es no sentirlo, es avanzar con él.\n\n«Mira que te mando que te esfuerces y seas valiente: no temas ni desmayes, porque Jehová tu Dios será contigo en donde quiera que fueres.» (Josué 1:9)\n\nLección: nombra el miedo en voz alta y da un paso hoy, aunque sea chico.'},
 {k:['dinero','deuda','deudas','pobre','trabajo','empleo','negocio','empresa','finanzas','ahorro','sueldo','riqueza','exito'], a:'Buena pregunta, y muy práctica. La Biblia habla mucho de dinero y casi siempre dice lo mismo: constancia y trabajo bien hecho.\n\n«La mano negligente hace pobre: mas la mano de los diligentes enriquece.» (Proverbios 10:4)\n\nLección: gasta menos de lo que ganas, trabaja como si fuera para Dios y sé constante un año entero. Proverbios tiene 31 capítulos: uno por día este mes.'},
 {k:['perdon','perdonar','culpa','culpable','pecado','error','errores','arrepentido','verguenza'], a:'Todos hemos fallado, amigo. Lo que importa es qué haces con eso ahora.\n\n«Si confesamos nuestros pecados, él es fiel y justo para que nos perdone nuestros pecados, y nos limpie de toda maldad.» (1 Juan 1:9)\n\nLección: confiésalo, pide perdón a quien lastimaste si puedes, y suelta la culpa. Dios no te pide que cargues lo que ya perdonó.'},
 {k:['triste','tristeza','deprimido','deprimida','depresion','solo','sola','soledad','vacio','llorar'], a:'Siento que estés pasando por esto. No estás solo, aunque hoy se sienta así.\n\n«Cercano está Jehová a los quebrantados de corazón; y salvará a los contritos de espíritu.» (Salmo 34:18)\n\nLección: habla con alguien de confianza hoy, sal a caminar y lee un Salmo en voz alta. Si la tristeza no se va, busca ayuda profesional; eso también es de valientes.'},
 {k:['familia','esposa','esposo','pareja','matrimonio','novia','novio','hijos','hijo','hija','padres','mama','papa','hermano','pelea','peleas'], a:'Las relaciones son lo que más nos importa y lo que más nos cuesta. Eso es normal.\n\n«Antes sed los unos con los otros benignos, misericordiosos, perdonándoos los unos a los otros, como también Dios os perdonó en Cristo.» (Efesios 4:32)\n\nLección: escucha antes de responder, pide perdón primero aunque te cueste, y di algo bueno de esa persona hoy.'},
 {k:['proposito','sentido','rumbo','decision','decisiones','decidir','futuro','camino','perdido','confundido','vocacion'], a:'Esa pregunta es de las más importantes que puedes hacerte. Que la hagas ya dice mucho de ti.\n\n«Reconócelo en todos tus caminos, y él enderezará tus veredas.» (Proverbios 3:6)\n\nLección: ora por la decisión, pide consejo a alguien sabio y da el paso que tengas claro hoy. El rumbo se aclara caminando.'},
 {k:['disciplina','habito','habitos','flojera','pereza','motivacion','constancia','procrastinar','ganas','levantarme'], a:'Nadie tiene ganas todos los días. La diferencia la hace el hábito, no la motivación.\n\n«Ve a la hormiga, oh perezoso, mira sus caminos, y sé sabio.» (Proverbios 6:6)\n\nLección: empieza tan pequeño que no puedas fallar: un capítulo al día a la misma hora. En un año son los 66 libros.'},
 {k:['enojo','enojado','enojada','coraje','ira','rabia','molesto','furioso'], a:'Enojarse es humano. Lo que cuenta es qué haces en los siguientes cinco minutos.\n\n«Todo hombre sea pronto para oír, tardío para hablar, tardío para airarse.» (Santiago 1:19)\n\nLección: antes de contestar, respira y espera. Lo que dices enojado casi nunca es lo que quieres decir.'},
 {k:['muerte','murio','duelo','perdi','fallecio','luto','extrano'], a:'Lo siento mucho. Perder a alguien duele de verdad, y está bien llorar.\n\n«Bienaventurados los que lloran: porque ellos recibirán consolación.» (Mateo 5:4)\n\nLección: no te apresures a estar bien. Recuerda a esa persona en voz alta, apóyate en los tuyos y deja que Dios te acompañe en el proceso.'},
 {k:['fe','duda','dudas','creer','dios','existe','orar','oracion','rezar'], a:'Dudar no te aleja de Dios; muchos grandes de la Biblia dudaron antes de creer con fuerza.\n\n«Es pues la fe la sustancia de las cosas que se esperan, la demostración de las cosas que no se ven.» (Hebreos 11:1)\n\nLección: habla con Dios con honestidad, tal como estás. Y lee el Evangelio de Juan: es el mejor lugar para empezar.'},
 {k:['cansado','cansada','agotado','agotada','sin fuerzas','rendirme','rendir','no puedo'], a:'Se nota que has cargado mucho. Descansar no es rendirse.\n\n«Mas los que esperan a Jehová tendrán nuevas fuerzas; levantarán las alas como águilas, correrán, y no se cansarán, caminarán, y no se fatigarán.» (Isaías 40:31)\n\nLección: duerme bien esta noche, suelta una cosa que no te toca cargar y mañana da un paso más.'}
];
  function norm(s){ return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9ñ\s]/g,' '); }
  var VACIAS = /^(el|la|los|las|de|del|que|y|a|en|un|una|es|se|mi|me|con|por|para|como|lo|al|su|the|a|an|of|to|is|do|i|my|it|in|and|how|what|can|you|for|on)$/;
  function palabras(s){ return norm(s).split(/\s+/).filter(function(w){ return w.length>2 && !VACIAS.test(w); }); }
  function arma(){
    if (document.getElementById('vb-mentor-btn')) return;
    var faq=[].slice.call(document.querySelectorAll('#preguntas button')).map(function(b){var n=b.nextElementSibling;return {q:(b.textContent||'').trim(),a:n?(n.textContent||'').trim():''};}).filter(function(x){return x.q&&x.a;});
    faq.forEach(function(f){ f.k=palabras(f.q); f.ka=palabras(f.a); });
    var yaCta=false;
    var SB='https://mkjahlxsjwnleapfbiez.supabase.co';
    var hist=[];
    var CTX = EN
      ? 'You are the Christian AI Mentor of Voz Bíblica, chatting with a visitor on the website. Talk like a close, warm friend: short paragraphs, simple words. When it helps, quote one Bible verse (King James Version) with its reference and give one practical life lesson. If they ask about the product, use these facts: '+faq.map(function(x){return x.q+' '+x.a;}).join(' ')+' Keep answers under 120 words.'
      : 'Eres el Mentor cristiano de IA de Voz Bíblica y platicas con un visitante del sitio web. Habla como un amigo cercano y cálido: párrafos cortos, palabras sencillas. Cuando ayude, cita un versículo (Reina Valera 1909) con su referencia y da una lección práctica para la vida. Si pregunta por el producto, usa estos datos: '+faq.map(function(x){return x.q+' '+x.a;}).join(' ')+' Responde en menos de 120 palabras.';

    function responder(txt){
      var n=norm(txt), w=palabras(txt);
      if (/^(hola|buenas|hey|hi|hello|que tal)\b/.test(n.trim()) && w.length<=2) return {a:T.hi};
      var mejor=null, pts=0;
      faq.forEach(function(f){ var p=0; w.forEach(function(x){ f.k.forEach(function(k){ if(k===x) p+=3; else if(k.indexOf(x)===0||x.indexOf(k)===0) p+=2; }); f.ka.forEach(function(k){ if(k===x) p+=1; }); }); if(p>pts){pts=p;mejor=f;} });
      var vida=null, vidaPts=0; TEMAS.forEach(function(tm){ var p=0; tm.k.forEach(function(k){ var kk=norm(k).trim(); if(!kk) return; if(n.indexOf(kk)>=0) p+= kk.length>4?3:2; }); if(p>vidaPts){vidaPts=p;vida=tm;} });
      if (vida && vidaPts>=2 && !(mejor && pts>=6)) return {a:vida.a, cta:!yaCta};
      if (mejor && pts>=3) return {a:mejor.a};
      return {a:T.nose, cta:!yaCta};
    }
    var b=document.createElement('button'); b.id='vb-mentor-btn'; b.setAttribute('aria-label',T.abrir);
    (function(){var NS='http://www.w3.org/2000/svg';var s=document.createElementNS(NS,'svg');s.setAttribute('width','26');s.setAttribute('height','26');s.setAttribute('view'+'Box','0 0 256 256');s.setAttribute('fill','#ffffff');s.setAttribute('aria-hidden','true');s.style.display='block';s.style.pointerEvents='none';var p=document.createElementNS(NS,'path');p.setAttribute('d','M216,48H40A16,16,0,0,0,24,64V224a15.85,15.85,0,0,0,9.24,14.5A16.13,16.13,0,0,0,40,240a15.89,15.89,0,0,0,10.25-3.78l.09-.07L83,208H216a16,16,0,0,0,16-16V64A16,16,0,0,0,216,48Z');s.appendChild(p);b.appendChild(s);})();
    var p=document.createElement('div'); p.id='vb-mentor'; p.setAttribute('role','dialog'); p.setAttribute('aria-label',T.nom);
    p.innerHTML='<div class="vm-top"><span class="vm-av"></span><div><div class="vm-nom"></div><div class="vm-sub"></div></div></div><div class="vm-body" aria-live="polite"></div><form class="vm-form"><button type="button" class="vm-emo-btn" aria-label="Emoji">&#128522;</button><div class="vm-emo" hidden></div><input class="vm-in" type="text" autocomplete="off" maxlength="300"><button type="submit" class="vm-send"></button></form>';
    (function(){
      if(!document.getElementById('vm-emo-css')){var st=document.createElement('style');st.id='vm-emo-css';
      st.textContent='#vb-mentor .vm-form{position:relative;}#vb-mentor .vm-emo-btn{width:40px;height:44px;flex:none;border:0;background:transparent;font-size:20px;line-height:1;cursor:pointer;border-radius:12px;filter:grayscale(.15);}#vb-mentor .vm-emo-btn:hover{background:rgba(16,23,40,0.06);}#vb-mentor .vm-emo{position:absolute;left:8px;right:8px;bottom:calc(100% + 6px);display:grid;grid-template-columns:repeat(8,1fr);gap:2px;padding:8px;background:#fff;border:1px solid rgba(16,23,40,0.12);border-radius:14px;box-shadow:0 10px 30px rgba(16,23,40,0.16);z-index:3;}#vb-mentor .vm-emo[hidden]{display:none;}#vb-mentor .vm-emo button{border:0;background:transparent;font-size:21px;line-height:1;padding:6px 0;border-radius:8px;cursor:pointer;}#vb-mentor .vm-emo button:hover{background:rgba(16,23,40,0.07);}';
      document.head.appendChild(st);}
      var E=['🙏','❤️','✝️','📖','🕊️','🙌','😊','😢','😔','😇','🤗','💪','✨','🔥','🌅','👍','🙂','😌','😭','🥰','😟','🤔','👏','💯'];
      var box=p.querySelector('.vm-emo'), eb=p.querySelector('.vm-emo-btn'), inp=p.querySelector('.vm-in');
      E.forEach(function(e){var b=document.createElement('button');b.type='button';b.textContent=e;b.addEventListener('click',function(){var s=inp.selectionStart!=null?inp.selectionStart:inp.value.length, en=inp.selectionEnd!=null?inp.selectionEnd:s;inp.value=inp.value.slice(0,s)+e+inp.value.slice(en);inp.dispatchEvent(new Event('input',{bubbles:true}));inp.focus();var c=s+e.length;try{inp.setSelectionRange(c,c);}catch(_){}box.hidden=true;});box.appendChild(b);});
      eb.addEventListener('click',function(ev){ev.stopPropagation();box.hidden=!box.hidden;});
      document.addEventListener('click',function(ev){if(!box.hidden && !box.contains(ev.target) && ev.target!==eb) box.hidden=true;});
    })();
    p.querySelector('.vm-nom').textContent=T.nom; p.querySelector('.vm-sub').textContent=T.sub;
    var body=p.querySelector('.vm-body'), form=p.querySelector('.vm-form'), inp=p.querySelector('.vm-in'), send=p.querySelector('.vm-send');
    inp.placeholder=T.ph; send.setAttribute('aria-label',T.enviar);
    (function(){var NS='http://www.w3.org/2000/svg';var s=document.createElementNS(NS,'svg');s.setAttribute('width','18');s.setAttribute('height','18');s.setAttribute('view'+'Box','0 0 256 256');s.setAttribute('fill','currentColor');var q=document.createElementNS(NS,'path');q.setAttribute('d','M231.87,114l-168-95.89A16,16,0,0,0,40.92,37.34L71.55,128,40.92,218.67A16,16,0,0,0,56,240a16.15,16.15,0,0,0,7.93-2.1l167.92-96.05a16,16,0,0,0,0-27.89Z');s.appendChild(q);send.appendChild(s);})();
    function burbuja(cls,txt){ var d=document.createElement('div'); d.className=cls; d.textContent=txt; body.appendChild(d); body.scrollTop=body.scrollHeight; return d; }
    burbuja('vm-a',T.hola);
    function estado(){ send.disabled=!inp.value.trim(); } inp.addEventListener('input',estado); estado();
    form.addEventListener('submit',function(e){ e.preventDefault(); var q=inp.value.trim(); if(!q) return;
      burbuja('vm-u',q); inp.value=''; estado();
      var dots=document.createElement('div'); dots.className='vm-dots'; dots.innerHTML='<i></i><i></i><i></i>'; body.appendChild(dots); body.scrollTop=body.scrollHeight;
      function mostrar(txt, cta){ dots.remove(); burbuja('vm-a',txt); hist.push({role:'assistant',content:txt});
        if(cta && !yaCta){ yaCta=true; var l=document.createElement('a'); l.className='vm-cta'; l.href=T.susc; l.textContent=T.cta; body.appendChild(l); body.scrollTop=body.scrollHeight; } }
      hist.push({role:'user',content:q});
      var usadas=0; try{ usadas=+sessionStorage.getItem('vb-mentor-n')||0; }catch(_){}
      // Respuesta real de la IA; si falla o se pasa del límite de la visita, contesta la versión local.
      if (usadas >= 20) { var r0=responder(q); setTimeout(function(){ mostrar(r0.a, true); }, 500); return; }
      try{ sessionStorage.setItem('vb-mentor-n', String(usadas+1)); }catch(_){}
      var ctrl=new AbortController(); var tope=setTimeout(function(){ ctrl.abort(); }, 25000);
      fetch(SB+'/functions/v1/narrar',{method:'POST',headers:{'Content-Type':'text/plain'},signal:ctrl.signal,
        body:JSON.stringify({tipo:'chat', idioma: EN?'en':'es', mensajes: hist.slice(-10), contexto: CTX})})
        .then(function(r){ return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function(d){ clearTimeout(tope); var txt=d && d.reply ? String(d.reply).trim() : ''; if(!txt) throw 0; mostrar(txt, hist.length>=4); })
        .catch(function(){ clearTimeout(tope); var r=responder(q); mostrar(r.a, r.cta); });
    });
    var tag=document.createElement('div'); tag.id='vb-mentor-tag'; tag.textContent=T.tag;
    // El botón rojo alterna: burbuja de chat cuando está cerrado, X blanca cuando está abierto.
    var icoChat=b.querySelector('svg');
    var icoX=(function(){var NS='http://www.w3.org/2000/svg';var s=document.createElementNS(NS,'svg');s.setAttribute('width','24');s.setAttribute('height','24');s.setAttribute('view'+'Box','0 0 256 256');s.setAttribute('fill','#ffffff');var q=document.createElementNS(NS,'path');q.setAttribute('d','M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z');s.appendChild(q);s.style.display='none';b.appendChild(s);return s;})();
    function abrir(v){ var ab=p.classList.toggle('abierto', v); tag.classList.toggle('oculto', ab); if(icoChat) icoChat.style.display=ab?'none':''; icoX.style.display=ab?'':'none'; b.setAttribute('aria-label', ab?T.cerrar:T.abrir); if(ab) setTimeout(function(){inp.focus();},60); }
    b.onclick=function(){ abrir(!p.classList.contains('abierto')); };
    tag.onclick=function(){ abrir(true); };
    document.addEventListener('keydown',function(e){ if(e.key==='Escape') abrir(false); });
    document.body.appendChild(p); document.body.appendChild(tag); document.body.appendChild(b);
  }
  var n=0; (function espera(){ if (document.querySelector('#preguntas button')||n++>40) arma(); else setTimeout(espera,250); })();
})();
