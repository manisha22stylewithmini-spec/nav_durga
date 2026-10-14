'use strict';
/* One fixed stage. Scroll drives: video time, crossfade between Devis, text, music mood. */
const DEVIS = [
  { id:'shailputri',    hi:'शैलपुत्री',   en:'Maa Shailputri',    epi:'Daughter of the Mountain',        line:'The first face of Shakti – the root and foundation of all.' },
  { id:'brahmacharini', hi:'ब्रह्मचारिणी', en:'Maa Brahmacharini', epi:'The Goddess of Tapasya',          line:'Barefoot penance, patience and a will that never breaks.' },
  { id:'chandraghanta', hi:'चंद्रघंटा',   en:'Maa Chandraghanta', epi:'She of the Crescent-Bell',        line:'The sound of Her bell scatters every fear.' },
  { id:'kushmanda',     hi:'कूष्माण्डा',   en:'Maa Kushmanda',     epi:'The Smile that Created the Cosmos', line:'With one gentle smile She brought light to the darkness.' },
  { id:'skandamata',    hi:'स्कंदमाता',    en:'Maa Skandamata',    epi:'Mother of Skanda',                line:'Love without condition – a mother holding her child.' },
  { id:'katyayani',     hi:'कात्यायनी',    en:'Maa Katyayani',     epi:'The Warrior Goddess',             line:'Righteous power that rises when dharma is threatened.' },
  { id:'kalaratri',     hi:'कालरात्रि',    en:'Maa Kalaratri',     epi:'Destroyer of Darkness',           line:'Fearsome to evil, a shield of fearlessness to her devotee.', dark:true },
  { id:'mahagauri',     hi:'महागौरी',     en:'Maa Mahagauri',     epi:'The Radiant, Pure One',           line:'Calm as moonlight; She washes away sorrow.' },
  { id:'siddhidatri',   hi:'सिद्धिदात्री',  en:'Maa Siddhidatri',   epi:'Giver of All Siddhis',            line:'The fulfilment of every prayer and every sadhana.' }
];
const NUM = '०१२३४५६७८९';
/* scenes: 0 = hero, 1..9 = devis, 10 = end */
const SCENES = [
  { src:'hero' },
  ...DEVIS.map((d,i) => ({ src:d.id, devi:i })),
  { img:'hero' }
];
const S = SCENES.length;
const PER_SCENE_VH = 280;
const FADE = .1;   // portion of a scene spent fading from / to black

const $ = (s, r=document) => r.querySelector(s);
const clamp = (x,a=0,b=1) => Math.min(b, Math.max(a, x));
const ease = t => t*t*(3-2*t);
function toast(t){ const el=$('#toast'); el.textContent=t; el.classList.add('show'); clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove('show'),2000); }

/* ---------- music (generated: tanpura, bell, payal; Kali = heartbeat + dark payal) ---------- */
const MUSIC_FILE = 'assets/music/bgm.mp3';
const Sound = (() => {
  let file = null, fileOk = null;  // supplied devotional track, if one has been added
  let ctx, master, bus, on=false, mode='devi', drone=[], timer, nextT=0, beat=0;
  const ROOT = 98;
  function init(){
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    bus = ctx.createGain(); bus.connect(master);
    const d = ctx.createDelay(1); d.delayTime.value = .34;
    const fb = ctx.createGain(); fb.gain.value = .42;
    const lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value = 2600;
    bus.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(master);
    [[1,'sawtooth',.05],[1.5,'sawtooth',.035],[.5,'sine',.12],[2,'sine',.04]].forEach(([m,type,g]) => {
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), v = ctx.createGain();
      o.type=type; o.frequency.value=ROOT*m; f.type='lowpass'; f.frequency.value=380; v.gain.value=g;
      o.connect(f); f.connect(v); v.connect(bus); o.start(); drone.push({o, m});
    });
  }
  const T = () => ctx.currentTime;
  function pluck(f, t, vol=.16){
    const o=ctx.createOscillator(), o2=ctx.createOscillator(), g=ctx.createGain();
    o.type='triangle'; o2.type='sine'; o.frequency.value=f; o2.frequency.value=f*2.003;
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+.01); g.gain.exponentialRampToValueAtTime(.0008,t+3.2);
    o.connect(g); o2.connect(g); g.connect(bus); o.start(t); o2.start(t); o.stop(t+3.3); o2.stop(t+3.3);
  }
  function bell(t, f=523, vol=.2){
    [1,2.76,5.4,8.93].forEach((m,i) => {
      const o=ctx.createOscillator(), g=ctx.createGain();
      o.frequency.value=f*m; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol/(i+1),t+.005);
      g.gain.exponentialRampToValueAtTime(.0005,t+3.5/(i*.6+1)); o.connect(g); g.connect(bus); o.start(t); o.stop(t+3.6);
    });
  }
  function payal(t, dark){
    const n = dark ? 5 : 9;
    for(let i=0;i<n;i++){
      const tt = t + i*(dark?.22:.07) + Math.random()*.03;
      const base = dark ? 1500+Math.random()*900 : 3000+Math.random()*2200;
      [1,1.51,2.37].forEach((m,k) => {
        const o=ctx.createOscillator(), g=ctx.createGain(), p=ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        o.frequency.value = base*m*(dark ? 1+(Math.random()-.5)*.04 : 1);
        g.gain.setValueAtTime(0,tt); g.gain.linearRampToValueAtTime((dark?.05:.035)/(k+1),tt+.002); g.gain.exponentialRampToValueAtTime(.0004,tt+(dark?.9:.25));
        o.connect(g);
        if(p){ p.pan.value=(Math.random()*2-1)*.8; g.connect(p); p.connect(bus); } else g.connect(bus);
        o.start(tt); o.stop(tt+1);
      });
    }
  }
  function thump(t, vol=.5){
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.frequency.setValueAtTime(90,t); o.frequency.exponentialRampToValueAtTime(40,t+.18);
    g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+.35);
    o.connect(g); g.connect(master); o.start(t); o.stop(t+.4);
  }
  function tick(){
    while(on && nextT < T()+.3){
      const t = Math.max(nextT, T()), dark = mode==='kali';
      if(!dark){
        [[1,0],[1.5,.55],[2,1.1],[2,1.65]].forEach(([m,off]) => pluck(ROOT*m, t+off));
        if(beat%2===0) payal(t+.3,false);
        if(beat%4===0) bell(t,392,.12);
      } else {
        pluck(ROOT,t,.2); pluck(ROOT*1.414,t+1,.15); thump(t); thump(t+.32,.35);
        if(beat%2===1) payal(t+.8,true);
        if(beat%4===3) bell(t+.2,180,.2);
      }
      beat++; nextT = t+2.4;
    }
  }
  const level = () => mode==='kali' ? .8 : .6;
  return {
    get on(){ return on; },
    start(){
      if(fileOk !== false){
        if(!file){ file = new Audio(MUSIC_FILE); file.loop = true; file.volume = .7;
          file.addEventListener('error', () => { fileOk = false; if(on) this.start(); }); }
        file.play().then(() => { fileOk = true; on = true; syncSound(); }).catch(() => {});
        if(fileOk !== false){ on = true; return; }
      }
      if(!ctx) init(); ctx.resume(); on=true; nextT=T()+.1; clearInterval(timer); timer=setInterval(tick,150);
      master.gain.setTargetAtTime(level(),T(),.8); bell(T()+.1,440,.2); },
    stop(){ on=false; if(file) file.pause(); clearInterval(timer); if(ctx) master.gain.setTargetAtTime(0,T(),.3); },
    toggle(){ on ? this.stop() : this.start(); return on; },
    setMode(m){ if(m===mode) return; mode=m; if(!ctx) return;
      drone.forEach((d,i) => d.o.frequency.setTargetAtTime(ROOT*d.m*(m==='kali' && i===1 ? 1.414/1.5 : 1), T(), 1.2));
      if(on) master.gain.setTargetAtTime(level(),T(),.8); }
  };
})();

/* ---------- build ---------- */
const scenesEl = $('#scenes');
const els = SCENES.map((s,i) => {
  const wrap = document.createElement('div'); wrap.className = 'scene'; wrap.style.zIndex = i;
  if(s.src){
    const v = document.createElement('video');
    v.poster = `assets/posters/${s.src}.jpg`;
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.setAttribute('muted','');
    wrap.append(v); s.v = v; s.cur = 0;
  } else {
    const im = document.createElement('img'); im.src = `assets/posters/${s.img}.jpg`; im.alt = ''; wrap.append(im);
  }
  scenesEl.append(wrap); return wrap;
});

/* Load clips as blobs so scrubbing is instant on any server (no Range support needed). Loaded near the viewer's position. */
function load(i){
  const s = SCENES[i]; if(!s || !s.v || s.loading) return Promise.resolve();
  s.loading = true;
  return fetch(`assets/scrub/${s.src}.mp4`).then(r => r.blob()).then(b => { s.v.src = URL.createObjectURL(b); s.v.load(); })
    .catch(() => { s.v.src = `assets/scrub/${s.src}.mp4`; });
}
(async () => { for(let i = 0; i < S; i++) await load(i); })();   // warm every clip, in order
$('#track').style.height = (S * PER_SCENE_VH) + 'vh';
$('#rail').innerHTML = DEVIS.map((d,i) => `<a href="#${d.id}" data-i="${i}">${i+1}<span>${d.en.replace('Maa ','')}</span></a>`).join('');
const copyHost = $('#deviCopy');
copyHost.className = 'deviCopy';
const copies = DEVIS.map(d => {
  const s = document.createElement('section'); s.className = 'copy';
  s.innerHTML = `<p class="day">Day ${DEVIS.indexOf(d)+1}</p><h2 class="hindi">${d.hi}</h2><p class="en">${d.en}</p><p class="line">${d.epi}. ${d.line}</p>`;
  copyHost.append(s); return s;
});
const railLinks = [...document.querySelectorAll('#rail a')];
const heroCopy = $('#heroCopy'), endCopy = $('#endCopy');

/* ---------- scroll maths (smoothed) ---------- */
const maxScroll = () => document.documentElement.scrollHeight - innerHeight;
let target = 0, g = 0;
const readScroll = () => { target = clamp(scrollY / maxScroll()) * (S - 1); };
addEventListener('scroll', readScroll, {passive:true}); readScroll(); g = target;
const sceneStart = i => (i / (S - 1)) * maxScroll();
const goTo = i => scrollTo({top: sceneStart(i) + 2, behavior:'smooth'});

let activeDevi = -1, lastHash = '';
function render(){
  g += (target - g) * .09;
  if(Math.abs(target - g) < .0004) g = target;

  const sceneO = [];
  const near = Math.round(g);
  for(let k = near - 1; k <= near + 2; k++) load(k);
  SCENES.forEach((s,i) => {
    const p = g - i;
    const el = els[i];
    let o = 0;
    if(p >= 0 && p <= 1){
      const fin = i === 0 ? 1 : ease(clamp(p / FADE));
      const fout = i === S - 1 ? 1 : ease(clamp((1 - p) / FADE));
      o = fin * fout;
    }
    sceneO[i] = o;
    el.style.opacity = o;
    el.style.visibility = o > 0 ? 'visible' : 'hidden';
    if(o > 0){
      const q = clamp(p);
      el.style.transform = `scale(${1 + q*.06})`;
      if(s.v && s.v.readyState >= 2 && s.v.duration){
        const want = q * (s.v.duration - .05);
        s.cur += (want - s.cur) * .35;
        if(Math.abs(s.v.currentTime - s.cur) > .016) s.v.currentTime = s.cur;
      }
    }
  });

  /* text follows its clip exactly: visible on the first frame, stays to the last frame */
  const place = (el, o) => { el.style.opacity = o; el.style.transform = `translateY(${(1-o)*18}px)`; };
  place(heroCopy, sceneO[0]);
  heroCopy.style.pointerEvents = sceneO[0] > .5 ? 'auto' : 'none';
  place(endCopy, sceneO[S-1]);
  let cur = -1;
  copies.forEach((c,i) => {
    const o = sceneO[i + 1];
    place(c, o);
    if(o > .5) cur = i;
  });
  if(sceneO[S-1] > .5) cur = -1;

  if(cur !== activeDevi){
    activeDevi = cur;
    railLinks.forEach((a,i) => a.classList.toggle('on', i === cur));
    Sound.setMode(cur >= 0 && DEVIS[cur].dark ? 'kali' : 'devi');
    const h = cur >= 0 ? '#' + DEVIS[cur].id : location.pathname;
    if(h !== lastHash){ lastHash = h; try { history.replaceState(null, '', h); } catch {} }
  }
  requestAnimationFrame(render);
}

/* ---------- controls (utilities only; one CTA) ---------- */
$('#enter').onclick = () => { Sound.start(); syncSound(); goTo(1); };
function syncSound(){ const b = $('#sound'); b.setAttribute('aria-pressed', Sound.on); $('span', b).textContent = Sound.on ? 'on' : 'off'; }
$('#sound').onclick = () => { Sound.toggle(); syncSound(); };
$('#share').onclick = async () => {
  const d = DEVIS[activeDevi];
  const url = location.href.split('#')[0] + (d ? '#' + d.id : '');
  const text = d ? `${d.en} – ${d.epi}. Jai Mata Di 🙏` : 'Nav Durga – Jai Mata Di 🙏';
  if(navigator.share){ try { await navigator.share({title:'Nav Durga', text, url}); return; } catch(e){ if(e.name==='AbortError') return; } }
  try { await navigator.clipboard.writeText(url); toast('Link copied · Jai Mata Di 🙏'); } catch { window.open('https://wa.me/?text=' + encodeURIComponent(text + ' ' + url)); }
};
railLinks.forEach(a => a.addEventListener('click', e => { e.preventDefault(); goTo(+a.dataset.i + 1); }));
addEventListener('keydown', e => {
  if(e.key==='ArrowDown'||e.key==='PageDown'||e.key===' '){ e.preventDefault(); goTo(Math.min(S-1, Math.floor(g + 1.001))); }
  if(e.key==='ArrowUp'||e.key==='PageUp'){ e.preventDefault(); goTo(Math.max(0, Math.ceil(g - 1.001))); }
});
const start = () => {
  const i = DEVIS.findIndex(d => '#' + d.id === location.hash);
  if(i >= 0){ scrollTo(0, sceneStart(i + 1) + 2); readScroll(); g = target; }
  render();
};
addEventListener('load', start);
