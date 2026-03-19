/* Magic Cursor v3.0 — final clean build */
(function () {
  if (window.__MC_INJECTED) { window.__MC_TOGGLE && window.__MC_TOGGLE(); return; }
  try { if (document.querySelector('[data-lovable-editor],[data-bolt-editor]')) return; } catch(e) {}
  window.__MC_INJECTED = true;

  // ── State ─────────────────────────────────────────────────
  let active = false, selectedEl = null, multiSelect = [], changes = [], fw = null;
  let originalStyles = new WeakMap();
  let activePopover = null, promptExpanded = false, promptTextVisible = false;
  let currentBreakpoint = 'full';
  let _lastBt = 0, _hovered = null, _moveThrottle = 0, _resizing = false, _dragging = false;

  // ── Framework detection ───────────────────────────────────
  function detectFramework() {
    const r = { js:'plain', css:'plain', builder:null, summary:'' };
    const scripts = Array.from(document.scripts).map(s=>s.src+(s.textContent||'')).join(' ');
    let host = location.hostname;
    try { host = window.top?.location?.hostname || location.hostname; } catch(e) {}
    if (host.includes('lovable'))    r.builder='Lovable';
    else if (host.includes('bolt'))  r.builder='Bolt';
    else if (host.includes('v0.dev'))r.builder='v0';
    else if (host.includes('replit'))r.builder='Replit';
    if (window.React||window.__REACT_DEVTOOLS_GLOBAL_HOOK__||scripts.includes('react')) r.js='react';
    else if (window.Vue||window.__VUE__) r.js='vue';
    else if (window.next||scripts.includes('_next')) r.js='nextjs';
    if (['Lovable','Bolt','v0'].includes(r.builder) && r.js==='plain') r.js='react';
    const twPat = /\b(flex|grid|gap-\d|p-\d|m-\d|w-\d|h-\d|text-\w+|bg-\w+|rounded|shadow|items-|justify-)/;
    const twCount = Array.from(document.querySelectorAll('[class]')).filter(el=>twPat.test(el.className)).length;
    if (twCount>3||scripts.includes('tailwind')) r.css='tailwind';
    const parts = [];
    if (r.builder) parts.push(r.builder);
    const jsN = {react:'React',nextjs:'Next.js',vue:'Vue',svelte:'Svelte'};
    if (jsN[r.js]) parts.push(jsN[r.js]);
    parts.push(r.css==='tailwind'?'Tailwind CSS':'Plain CSS');
    r.summary = parts.join(' + ') || 'Plain HTML/CSS';
    return r;
  }

  // ── Tailwind helpers ──────────────────────────────────────
  const TW_SCALE={0:0,0.5:2,1:4,1.5:6,2:8,2.5:10,3:12,4:16,5:20,6:24,7:28,8:32,9:36,10:40,11:44,12:48,14:56,16:64,20:80,24:96,28:112,32:128};
  const TW_COLORS={'#3b82f6':'blue-500','#2563eb':'blue-600','#6366f1':'indigo-500','#4f46e5':'indigo-600','#8b5cf6':'violet-500','#ec4899':'pink-500','#ef4444':'red-500','#f97316':'orange-500','#f59e0b':'amber-500','#22c55e':'green-500','#14b8a6':'teal-500','#06b6d4':'cyan-500','#67e8f9':'cyan-300','#ffffff':'white','#000000':'black','#f8fafc':'slate-50','#1e293b':'slate-800','#0f172a':'slate-900'};
  function pxTw(prop,px) {
    if (!fw||fw.css!=='tailwind') return null;
    const abs=Math.abs(px),neg=px<0;
    let ck='0',cd=Infinity;
    for (const [k,v] of Object.entries(TW_SCALE)) { const d=Math.abs(v-abs); if(d<cd){cd=d;ck=k;} }
    const val=cd>2?`[${abs}px]`:ck, s=neg?'-':'';
    const m={ml:`${s}ml-${val}`,mr:`${s}mr-${val}`,mt:`${s}mt-${val}`,mb:`${s}mb-${val}`,w:`w-${val}`,h:`h-${val}`,pt:`pt-${val}`,pb:`pb-${val}`,pl:`pl-${val}`,pr:`pr-${val}`};
    return m[prop]||null;
  }
  function fsTw(px){const m={'10':'xs','12':'sm','14':'base','16':'base','18':'lg','20':'xl','24':'2xl','30':'3xl','36':'4xl','48':'5xl'};return m[String(Math.round(px))]?`text-${m[String(Math.round(px))]}`:`text-[${px}px]`;}
  function rrTw(px){const m={0:'none',2:'sm',4:'',6:'md',8:'lg',12:'xl',16:'2xl',9999:'full'};let ck='',cd=Infinity;for(const[v,k]of Object.entries(m)){const d=Math.abs(Number(v)-px);if(d<cd){cd=d;ck=k;}}return cd>3?`rounded-[${px}px]`:(ck?`rounded-${ck}`:'rounded');}
  function hexTw(h){return TW_COLORS[h.toLowerCase()]||null;}

  // ── Prompt generation ─────────────────────────────────────
  function generatePrompt() {
    if (!changes.length) return '';
    const f=fw||{summary:'unknown',js:'plain',css:'plain',builder:null};
    const isTw=f.css==='tailwind', isReact=['react','nextjs'].includes(f.js);
    const lines=[];
    lines.push(`You are helping me edit my ${f.summary} app.`);
    if (f.builder) lines.push(`Built with ${f.builder}. Edit source files, not rendered HTML.`);
    lines.push(`Make ONLY these changes:\n`);
    changes.forEach((c,i)=>{
      const ctx=getCtx(c.el);
      lines.push(`${i+1}. ${c.desc}`);
      lines.push(`   Element: ${ctx.selector}${ctx.classes?` | classes: "${ctx.classes}"`:''}${ctx.text?` | text: "${ctx.text}"`:''}` );
      if(c.type==='move'){lines.push(isTw?`   → ${pxTw('ml',c.deltaX)||''} ${c.deltaY?pxTw('mt',c.deltaY)||'':''} (remove conflicting margin classes)`:`   → margin-left:${c.deltaX}px; margin-top:${c.deltaY}px;`);}
      if(c.type==='resize'){lines.push(isTw?`   → ${pxTw('w',c.after.w)} ${c.before.h!==c.after.h?pxTw('h',c.after.h)||'':''}`:`   → width:${c.after.w}px;${c.before.h!==c.after.h?` height:${c.after.h}px;`:''}`);}
      if(c.type==='color'){const tw=isTw?(hexTw(c.after)||`[${c.after}]`):null;lines.push(isTw?(c.subtype==='bg'?`   → bg-${tw}`:`   → text-${tw}`):(c.subtype==='bg'?`   → background-color:${c.after};`:`   → color:${c.after};`));}
      if(c.type==='font-size'){lines.push(isTw?`   → ${fsTw(c.after)}`:`   → font-size:${c.after}px;`);}
      if(c.type==='border-radius'){lines.push(isTw?`   → ${rrTw(c.after)}`:`   → border-radius:${c.after}px;`);}
      if(c.type==='padding'){const{top:t,right:r,bottom:b,left:l}=c.after;lines.push(isTw?`   → ${pxTw('pt',t)} ${pxTw('pr',r)} ${pxTw('pb',b)} ${pxTw('pl',l)}`:`   → padding:${t}px ${r}px ${b}px ${l}px;`);}
      if(c.type==='opacity'){lines.push(isTw?`   → opacity-${Math.round(c.after)}`:`   → opacity:${(c.after/100).toFixed(2)};`);}
      if(c.type==='text'){lines.push(`   → Replace "${c.before.slice(0,40)}" with "${c.after}"`);}
      if(c.type==='duplicate'){
        const posMap={'after':'Place immediately after the original as a sibling','before':'Place immediately before the original as a sibling'};
        lines.push(`   → Find: ${c.selector}${c.classes?` classes:"${c.classes}"`:''}${c.text?` text:"${c.text}"`:''}` );
        lines.push(`   → Create an exact duplicate — same classes, styles, content`);
        lines.push(`   → ${posMap[c.position]||'Place immediately after the original'}`);
      }
    });
    lines.push(`\nOnly return changed code. ${isReact?'JSX component.':'HTML/CSS.'} No explanations.`);
    return lines.join('\n');
  }

  // ── Styles ────────────────────────────────────────────────
  const STYLES=`
    .__mc_h{outline:2px dashed #67E8F9 !important;outline-offset:2px !important;cursor:crosshair !important;box-shadow:inset 0 0 0 1px rgba(0,0,0,.2) !important;}
    .__mc_s{outline:2px solid #67E8F9 !important;outline-offset:2px !important;}
    .__mc_m{outline:2px solid #67E8F9 !important;outline-offset:2px !important;background:rgba(103,232,249,.05) !important;}
    #__mc_label{position:fixed !important;background:#67E8F9;color:#000;font:700 10px/1 system-ui,sans-serif;padding:2px 7px;border-radius:3px;z-index:2147483647 !important;pointer-events:none;white-space:nowrap;}
    #__mc_bar{position:fixed !important;z-index:2147483647 !important;display:none;align-items:center;gap:1px;background:#111;border:1px solid #2a2a2a;border-radius:8px;padding:3px;box-shadow:0 4px 20px rgba(0,0,0,.6);}
    .mc-b{background:none;border:none;color:#888;font:500 13px/1 system-ui,sans-serif;padding:5px 8px;border-radius:5px;cursor:pointer !important;display:flex;align-items:center;gap:4px;transition:background .1s,color .1s;position:relative;}
    .mc-b:hover{background:#222;color:#fff;}
    .mc-b.active{background:#fff;color:#000;}
    .mc-b.danger:hover{background:#222;color:#fff;}
    .mc-b[data-tip]:hover::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);background:#fff;color:#000;font:600 10px/1 system-ui,sans-serif;padding:4px 8px;border-radius:4px;white-space:nowrap;z-index:2147483648 !important;box-shadow:0 2px 8px rgba(0,0,0,.3);pointer-events:none;}
    .mc-b[data-tip]:hover::before{content:'';position:absolute;bottom:calc(100% + 2px);left:50%;transform:translateX(-50%);border:4px solid transparent;border-top-color:#fff;pointer-events:none;z-index:2147483648 !important;}
    .mc-sep{width:1px;height:18px;background:#2a2a2a;margin:0 2px;flex-shrink:0;}
    .mc-sw{width:14px;height:14px;border-radius:3px;border:1px solid rgba(255,255,255,.2);flex-shrink:0;}
    .mc-pop{position:fixed !important;z-index:2147483648 !important;background:#111;border:1px solid #2a2a2a;border-radius:8px;padding:10px 12px;box-shadow:0 8px 28px rgba(0,0,0,.7);min-width:185px;display:none;}
    .mc-pr{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
    .mc-pr:last-child{margin-bottom:0;}
    .mc-pl{font:600 9px/1 system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#555;width:52px;flex-shrink:0;}
    .mc-sl{flex:1;height:3px;accent-color:#67E8F9;cursor:pointer;}
    .mc-vl{font:600 10px/1 system-ui,sans-serif;color:#666;min-width:34px;text-align:right;flex-shrink:0;}
    .mc-pg{display:grid;grid-template-columns:1fr 1fr;gap:4px;flex:1;}
    .mc-ni{background:#0a0a0a;border:1px solid #222;border-radius:4px;color:#aaa;font:10px/1 system-ui,sans-serif;padding:5px 6px;width:100%;box-sizing:border-box;outline:none;text-align:center;}
    .mc-ni:focus{border-color:#67E8F9;color:#fff;}
    .mc-ci{width:28px;height:28px;border-radius:5px;border:1px solid #333;padding:2px;background:none;cursor:pointer;}
    .__mc_handle{position:fixed !important;width:14px !important;height:14px !important;background:#67E8F9 !important;border:2px solid #000 !important;border-radius:50% !important;z-index:2147483647 !important;pointer-events:all !important;display:none;box-shadow:0 2px 8px rgba(0,0,0,.6) !important;transform:translate(-50%,-50%) !important;cursor:nwse-resize !important;}
    .__mc_handle[data-pos="nw"]{cursor:nw-resize !important;}
    .__mc_handle[data-pos="ne"]{cursor:ne-resize !important;}
    .__mc_handle[data-pos="sw"]{cursor:sw-resize !important;}
    .__mc_handle[data-pos="se"]{cursor:se-resize !important;}
    #__mc_pb{position:fixed !important;z-index:2147483647 !important;bottom:16px;left:50%;transform:translateX(-50%);background:#111;border:1px solid #2a2a2a;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.6);pointer-events:all !important;display:none;overflow:hidden;}
    #__mc_collapsed{display:flex;align-items:center;gap:6px;padding:8px 12px;white-space:nowrap;}
    .mc-pulse{width:7px;height:7px;background:#67E8F9;border-radius:50%;animation:__mcp 1.5s infinite;flex-shrink:0;box-shadow:0 0 5px rgba(103,232,249,.5);}
    @keyframes __mcp{0%,100%{opacity:1}50%{opacity:.2}}
    .mc-title{font:600 12px/1 system-ui,sans-serif;color:#fff;}
    .mc-badge{background:#67E8F9;color:#000;font:700 10px/1 system-ui,sans-serif;padding:2px 6px;border-radius:999px;flex-shrink:0;}
    .mc-xbtn{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);color:#888;font:600 12px/1 system-ui,sans-serif;padding:3px 8px;border-radius:5px;cursor:pointer !important;margin-left:auto;flex-shrink:0;transition:all .12s;}
    .mc-xbtn:hover{background:rgba(255,255,255,.15);color:#fff;}
    #__mc_expanded{display:none;border-top:1px solid #1a1a1a;}
    .mc-exp-top{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid #1a1a1a;}
    .mc-exp-left{display:flex;align-items:center;gap:8px;}
    .mc-exp-right{display:flex;align-items:center;gap:5px;}
    .mc-act{background:none;border:1px solid #2a2a2a;color:#666;font:600 10px/1 system-ui,sans-serif;padding:4px 9px;border-radius:5px;cursor:pointer !important;letter-spacing:.04em;text-transform:uppercase;transition:all .12s;white-space:nowrap;}
    .mc-act:hover{border-color:#555;color:#ddd;}
    .mc-act.primary{background:#fff;border-color:#fff;color:#000;font-weight:700;}
    .mc-act.primary:hover{background:#e0e0e0;}
    .mc-act.primary.ok{background:#67E8F9;border-color:#67E8F9;color:#000;}
    .mc-act.sm{padding:3px 7px;}
    .mc-fw{background:#1a1a1a;color:#555;font:600 9px/1 system-ui,sans-serif;padding:2px 7px;border-radius:4px;border:1px solid #222;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .mc-resp-g{display:flex;align-items:center;gap:1px;}
    .mc-rb{background:none;border:none;font-size:12px;padding:3px 5px;border-radius:4px;cursor:pointer !important;opacity:.3;transition:opacity .12s;line-height:1;}
    .mc-rb:hover{opacity:.7;}.mc-rb.active{opacity:1;}
    #__mc_clist{max-height:140px;overflow-y:auto;}
    #__mc_clist::-webkit-scrollbar{width:3px}#__mc_clist::-webkit-scrollbar-thumb{background:#222;border-radius:3px}
    .mc-ci-row{display:flex;align-items:center;gap:8px;padding:5px 12px;border-bottom:1px solid #161616;}
    .mc-ci-row:last-child{border-bottom:none;}
    .mc-ci-ico{font-size:10px;width:14px;text-align:center;flex-shrink:0;color:#444;}
    .mc-ci-el{color:#fff;font:600 10px/1 system-ui,sans-serif;flex-shrink:0;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .mc-ci-desc{color:#444;font:400 10px/1 system-ui,sans-serif;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .mc-undo{background:none;border:none;color:#333;cursor:pointer !important;font-size:12px;padding:2px 5px;border-radius:3px;flex-shrink:0;transition:color .12s;}
    .mc-undo:hover{color:#fff;}
    #__mc_pwrap{padding:8px 12px 10px;display:none;border-top:1px solid #1a1a1a;}
    #__mc_ptxt{width:100%;background:#0a0a0a;border:1px solid #1e1e1e;border-radius:6px;color:#555;font:10px/1.7 system-ui,sans-serif;padding:8px 10px;resize:none;height:90px;outline:none;box-sizing:border-box;}
    .mc-exp-footer{display:flex;align-items:center;justify-content:space-between;padding:6px 12px;border-top:1px solid #1a1a1a;}
    #__mc_toast{position:fixed !important;bottom:70px;left:50%;transform:translateX(-50%) translateY(8px);background:#111;border:1px solid #333;color:#fff;font:600 11px/1 system-ui,sans-serif;padding:8px 18px;border-radius:999px;z-index:2147483647 !important;opacity:0;pointer-events:none;transition:all .22s cubic-bezier(.34,1.56,.64,1);white-space:nowrap;}
    #__mc_toast.show{opacity:1;transform:translateX(-50%) translateY(0);}
  `;
  const styleEl=document.createElement('style');
  styleEl.textContent=STYLES;
  document.head.appendChild(styleEl);

  // ── DOM ───────────────────────────────────────────────────
  const label=mk('div',{id:'__mc_label'});label.style.display='none';
  const toast=mk('div',{id:'__mc_toast'});

  const bar=mk('div',{id:'__mc_bar'});
  bar.innerHTML=`
    <button class="mc-b" id="mc-font" data-tip="Font size" style="font-size:14px;font-weight:700">Aa</button>
    <button class="mc-b" id="mc-spacing" data-tip="Padding" style="padding:4px 7px">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><rect x="4" y="4" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/></svg>
    </button>
    <button class="mc-b" id="mc-radius" data-tip="Border radius" style="font-size:20px;line-height:1;padding:3px 7px">◌</button>
    <button class="mc-b" id="mc-opacity" data-tip="Opacity" style="font-size:16px">◐</button>
    <div class="mc-sep"></div>
    <button class="mc-b" id="mc-color" data-tip="Colors">
      <span class="mc-sw" id="mc-bgsw" style="background:#fff"></span>
      <span class="mc-sw" id="mc-fgsw" style="background:#000"></span>
    </button>
    <button class="mc-b" id="mc-dup" data-tip="Duplicate element" style="font-size:17px;font-weight:700">⊕</button>
    <div class="mc-sep"></div>
    <button class="mc-b danger" id="mc-desel" data-tip="Deselect (Esc)" style="font-size:13px">✕</button>
  `;

  // Popovers
  const pops={};
  function makePop(id,html){const p=mk('div',{class:'mc-pop',id});p.innerHTML=html;document.body.appendChild(p);return p;}
  pops.font    = makePop('mc-p-font',`<div class="mc-pr"><span class="mc-pl">Size</span><input type="range" class="mc-sl" id="mc-fs" min="8" max="96" step="1" value="16"/><span class="mc-vl" id="mc-fsv">16px</span></div>`);
  pops.spacing = makePop('mc-p-spacing',`<div class="mc-pr"><span class="mc-pl">Padding</span><div class="mc-pg"><input class="mc-ni" id="mc-pt" type="number" min="0" max="200" placeholder="↑"/><input class="mc-ni" id="mc-pr_" type="number" min="0" max="200" placeholder="→"/><input class="mc-ni" id="mc-pb" type="number" min="0" max="200" placeholder="↓"/><input class="mc-ni" id="mc-pl_" type="number" min="0" max="200" placeholder="←"/></div></div>`);
  pops.radius  = makePop('mc-p-radius',`<div class="mc-pr"><span class="mc-pl">Radius</span><input type="range" class="mc-sl" id="mc-br" min="0" max="50" step="1" value="0"/><span class="mc-vl" id="mc-brv">0px</span></div>`);
  pops.opacity = makePop('mc-p-opacity',`<div class="mc-pr"><span class="mc-pl">Opacity</span><input type="range" class="mc-sl" id="mc-op" min="0" max="100" step="5" value="100"/><span class="mc-vl" id="mc-opv">100%</span></div>`);
  pops.color   = makePop('mc-p-color',`<div class="mc-pr"><span class="mc-pl">BG</span><input type="color" class="mc-ci" id="mc-cbg"/></div><div class="mc-pr"><span class="mc-pl">Text</span><input type="color" class="mc-ci" id="mc-cfg"/></div>`);

  const pb=mk('div',{id:'__mc_pb'});
  pb.innerHTML=`
    <div id="__mc_collapsed">
      <span class="mc-pulse"></span>
      <span class="mc-title">Magic Cursor</span>
      <span class="mc-badge" id="mc-cnt">0</span>
      <button class="mc-xbtn" id="mc-expand">↗</button>
    </div>
    <div id="__mc_expanded">
      <div class="mc-exp-top">
        <div class="mc-exp-left">
          <span class="mc-pulse"></span>
          <span class="mc-title">Magic Cursor</span>
          <span class="mc-badge" id="mc-cnt2">0</span>
          <span class="mc-fw" id="mc-fw">—</span>
          <div class="mc-resp-g">
            <button class="mc-rb" id="mc-m" title="Mobile 375px">📱</button>
            <button class="mc-rb" id="mc-t" title="Tablet 768px">💻</button>
            <button class="mc-rb active" id="mc-d" title="Full width">🖥</button>
          </div>
        </div>
        <div class="mc-exp-right">
          <button class="mc-act" id="mc-reset">Reset</button>
          <button class="mc-act primary" id="mc-copy">⚡ Copy</button>
          <button class="mc-act sm" id="mc-x">✕</button>
        </div>
      </div>
      <div id="__mc_clist"></div>
      <div id="__mc_pwrap">
        <textarea id="__mc_ptxt" readonly></textarea>
      </div>
      <div class="mc-exp-footer">
        <button class="mc-act sm" id="mc-ptoggle">Prompt ↑</button>
        <button class="mc-act sm" id="mc-collapse">↙ Collapse</button>
      </div>
    </div>
  `;

  const handles=['nw','ne','sw','se'].map(pos=>{
    const h=mk('div',{class:'__mc_handle','data-pos':pos});return h;
  });

  function safeAppend(){
    if(!document.body){setTimeout(safeAppend,50);return;}
    handles.forEach(h=>document.body.appendChild(h));
    document.body.appendChild(label);
    document.body.appendChild(bar);
    document.body.appendChild(pb);
    document.body.appendChild(toast);
    // Wire after appended
    const t=setInterval(()=>{if(g('mc-desel')){clearInterval(t);wireUp();}},50);
  }
  safeAppend();

  // ── Wire ──────────────────────────────────────────────────
  function wireUp(){
    g('mc-desel').onclick=()=>deselectEl();
    g('mc-dup').onclick=duplicateEl;
    ['font','spacing','radius','opacity','color'].forEach(name=>{
      const ids={font:'mc-font',spacing:'mc-spacing',radius:'mc-radius',opacity:'mc-opacity',color:'mc-color'};
      g(ids[name]).onclick=e=>{e.stopPropagation();togglePop(name,g(ids[name]));};
    });
    g('mc-fs').oninput=e=>{const v=+e.target.value;g('mc-fsv').textContent=v+'px';applyAll('font-size',null,v,()=>`Font size → ${v}px`,el=>el.style.fontSize=v+'px');};
    g('mc-br').oninput=e=>{const v=+e.target.value;g('mc-brv').textContent=v+'px';applyAll('border-radius',null,v,()=>`Radius → ${v}px`,el=>el.style.borderRadius=v+'px');};
    g('mc-op').oninput=e=>{const v=+e.target.value;g('mc-opv').textContent=v+'%';applyAll('opacity',null,v,()=>`Opacity → ${v}%`,el=>el.style.opacity=(v/100).toFixed(2));};
    [{id:'mc-pt',s:'top'},{id:'mc-pr_',s:'right'},{id:'mc-pb',s:'bottom'},{id:'mc-pl_',s:'left'}].forEach(({id,s})=>{
      g(id).onchange=e=>{
        const v=Math.max(0,+e.target.value||0);
        if(!selectedEl)return;
        const cs=window.getComputedStyle(selectedEl);
        const before={top:Math.round(+cs.paddingTop),right:Math.round(+cs.paddingRight),bottom:Math.round(+cs.paddingBottom),left:Math.round(+cs.paddingLeft)};
        const after={...before};after[s]=v;
        const pm={top:'paddingTop',right:'paddingRight',bottom:'paddingBottom',left:'paddingLeft'};
        selectedEl.style[pm[s]]=v+'px';
        debRec(selectedEl,{type:'padding',el:selectedEl,desc:`Padding ${s} → ${v}px`,before,after,subProp:s});
      };
    });
    g('mc-cbg').oninput=e=>{const v=e.target.value;g('mc-bgsw').style.background=v;applyAll('color','bg',v,()=>`BG → ${v}`,el=>el.style.backgroundColor=v);};
    g('mc-cfg').oninput=e=>{const v=e.target.value;g('mc-fgsw').style.background=v;applyAll('color','text',v,()=>`Text color → ${v}`,el=>el.style.color=v);};
    g('mc-expand').onclick=expandBar;
    g('mc-collapse').onclick=collapseBar;
    g('mc-reset').onclick=clearAll;
    g('mc-copy').onclick=copyPrompt;
    g('mc-x').onclick=()=>{pb.style.display='none';collapseBar();};
    g('mc-ptoggle').onclick=()=>{
      promptTextVisible=!promptTextVisible;
      g('__mc_pwrap').style.display=promptTextVisible?'block':'none';
      g('mc-ptoggle').textContent=promptTextVisible?'Prompt ↓':'Prompt ↑';
      if(promptTextVisible)g('__mc_ptxt').value=generatePrompt();
    };
    g('mc-m').onclick=()=>setBreakpoint('mobile');
    g('mc-t').onclick=()=>setBreakpoint('tablet');
    g('mc-d').onclick=()=>setBreakpoint('full');
  }

  // ── Popover ───────────────────────────────────────────────
  function togglePop(name,btn){
    if(activePopover===name){closePops();return;}
    closePops();activePopover=name;
    const pop=pops[name];
    pop.style.visibility='hidden';pop.style.display='block';
    btn.classList.add('active');
    const br=btn.getBoundingClientRect(),barR=bar.getBoundingClientRect();
    const popH=pop.offsetHeight||80,popW=pop.offsetWidth||185;
    const top=barR.top>popH+10?barR.top-popH-8:barR.bottom+8;
    const left=Math.max(8,Math.min(br.left,window.innerWidth-popW-8));
    pop.style.top=top+'px';pop.style.left=left+'px';pop.style.visibility='visible';
  }
  function closePops(){
    Object.values(pops).forEach(p=>p.style.display='none');
    document.querySelectorAll('#__mc_bar .mc-b').forEach(b=>b.classList.remove('active'));
    activePopover=null;
  }
  document.addEventListener('click',e=>{
    if(!activePopover)return;
    if(!Object.values(pops).some(p=>p.contains(e.target))&&!bar.contains(e.target))closePops();
  },true);

  // ── Bar ───────────────────────────────────────────────────
  function expandBar(){
    promptExpanded=true;pb.style.width='560px';
    g('__mc_collapsed').style.display='none';
    g('__mc_expanded').style.display='block';
    renderBar();
  }
  function collapseBar(){
    promptExpanded=false;promptTextVisible=false;pb.style.width='auto';
    g('__mc_collapsed').style.display='flex';
    g('__mc_expanded').style.display='none';
    const pw=g('__mc_pwrap');if(pw)pw.style.display='none';
    const pt=g('mc-ptoggle');if(pt)pt.textContent='Prompt ↑';
  }

  // ── Responsive ────────────────────────────────────────────
  const respStyle=document.createElement('style');respStyle.id='__mc_resp';document.head.appendChild(respStyle);
  function setBreakpoint(bp){
    currentBreakpoint=bp;
    ['mc-m','mc-t','mc-d'].forEach(id=>{const el=g(id);if(el)el.classList.remove('active');});
    const map={mobile:'mc-m',tablet:'mc-t',full:'mc-d'};
    const el=g(map[bp]);if(el)el.classList.add('active');
    respStyle.textContent=bp==='full'?'':`html{max-width:${bp==='mobile'?375:768}px !important;margin:0 auto !important;box-shadow:0 0 0 9999px rgba(0,0,0,.5) !important;}`;
  }

  // ── Events ────────────────────────────────────────────────
  function onMove(e){
    if(_resizing||_dragging)return;
    const now=Date.now();if(now-_moveThrottle<32)return;_moveThrottle=now;
    if(!active)return;
    const el=document.elementFromPoint(e.clientX,e.clientY);
    if(!el||el===_hovered)return;
    if(_hovered&&_hovered!==selectedEl)_hovered.classList.remove('__mc_h');
    _hovered=el;
    if(!isMc(el)&&el!==selectedEl&&!boring(el))el.classList.add('__mc_h');
  }
  function clearHovers(){document.querySelectorAll('.__mc_h').forEach(el=>el.classList.remove('__mc_h'));_hovered=null;}
  function onClick(e){
    if(_resizing||_dragging){e.preventDefault();e.stopPropagation();return;}
    if(!active||isMc(e.target)||boring(e.target))return;
    e.preventDefault();e.stopPropagation();
    clearHovers();
    if(e.shiftKey)toggleMulti(e.target);
    else{clearMulti();selectEl(e.target);}
  }
  function onKey(e){
    if(e.key==='Escape'){
      if(activePopover){closePops();return;}
      if(selectedEl||multiSelect.length){deselectEl();return;}
      if(active){deactivate();return;}
      return;
    }
    if(!active||!selectedEl)return;
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
    e.preventDefault();
    const amt=e.shiftKey?10:1,cur=getTr(selectedEl);
    let dx=cur.x,dy=cur.y;
    if(e.key==='ArrowLeft')dx-=amt;if(e.key==='ArrowRight')dx+=amt;
    if(e.key==='ArrowUp')dy-=amt;if(e.key==='ArrowDown')dy+=amt;
    applyTr(selectedEl,dx,dy);posHandles();posLabel();
    debRec(selectedEl,{type:'move',el:selectedEl,desc:`Nudged ${e.key.replace('Arrow','')} ${amt}px`,before:cur,after:{x:dx,y:dy},deltaX:dx-cur.x,deltaY:dy-cur.y});
  }
  function onScroll(){posHandles();posLabel();posBar();}
  function boring(el){
    if(!el||!el.tagName)return true;
    const tag=el.tagName.toLowerCase();
    if(['html','body','script','style','head','meta','link'].includes(tag))return true;
    try{if(el.closest('#__mc_bar,#__mc_pb,#__mc_label,#__mc_toast,.__mc_handle,.mc-pop,#__mc_dup_picker'))return true;}catch(e){}
    const r=el.getBoundingClientRect();return r.width<2||r.height<2;
  }
  function isMc(el){try{return !!(el&&el.closest&&el.closest('#__mc_bar,#__mc_pb,#__mc_label,#__mc_toast,.__mc_handle,.mc-pop,#__mc_dup_picker'));}catch(e){return false;}}

  // ── Multi-select ──────────────────────────────────────────
  function toggleMulti(el){
    const idx=multiSelect.indexOf(el);
    if(idx>=0){el.classList.remove('__mc_m');multiSelect.splice(idx,1);}
    else{
      if(selectedEl&&!multiSelect.includes(selectedEl)){selectedEl.classList.add('__mc_m');selectedEl.classList.remove('__mc_s');multiSelect.push(selectedEl);selectedEl=null;bar.style.display='none';label.style.display='none';}
      el.classList.add('__mc_m');multiSelect.push(el);
    }
    if(multiSelect.length>0){pb.style.display='block';renderBar();}
  }
  function clearMulti(){multiSelect.forEach(el=>el.classList.remove('__mc_m'));multiSelect=[];}
  function applyAll(type,subtype,value,descFn,applyFn){
    const targets=multiSelect.length>0?multiSelect:(selectedEl?[selectedEl]:[]);
    if(!targets.length)return;
    targets.forEach(el=>{saveOrig(el);applyFn(el);debRec(el,{type,subtype,el,desc:descFn(el),before:null,after:value});});
  }

  // ── Select ────────────────────────────────────────────────
  function selectEl(el){
    if(selectedEl)deselectEl(true);
    selectedEl=el;el.classList.remove('__mc_h');el.classList.add('__mc_s');
    saveOrig(el);
    const cs=window.getComputedStyle(el);
    const fs=Math.round(+cs.fontSize)||16,br=Math.round(+cs.borderRadius)||0,op=Math.round(+cs.opacity*100);
    const set=(id,v)=>{const e=g(id);if(e)e.value=v;};
    const setT=(id,v)=>{const e=g(id);if(e)e.textContent=v;};
    set('mc-fs',fs);setT('mc-fsv',fs+'px');
    set('mc-br',Math.min(br,50));setT('mc-brv',br+'px');
    set('mc-op',op);setT('mc-opv',op+'%');
    set('mc-pt',Math.round(+cs.paddingTop)||0);set('mc-pr_',Math.round(+cs.paddingRight)||0);
    set('mc-pb',Math.round(+cs.paddingBottom)||0);set('mc-pl_',Math.round(+cs.paddingLeft)||0);
    try{const bg=rgbHex(cs.backgroundColor),fg=rgbHex(cs.color);set('mc-cbg',bg);set('mc-cfg',fg);const bgsw=g('mc-bgsw'),fgsw=g('mc-fgsw');if(bgsw)bgsw.style.background=bg;if(fgsw)fgsw.style.background=fg;}catch(e){}
    posBar();posHandles();posLabel();setupDrag(el);setupHandles(el);
    pb.style.display='block';renderBar();
  }
  function saveOrig(el){
    if(originalStyles.has(el))return;
    const cs=window.getComputedStyle(el);
    originalStyles.set(el,{transform:el.style.transform||'',width:el.style.width||'',height:el.style.height||'',backgroundColor:el.style.backgroundColor||'',color:el.style.color||'',fontSize:el.style.fontSize||'',borderRadius:el.style.borderRadius||'',opacity:el.style.opacity||'',paddingTop:el.style.paddingTop||'',paddingRight:el.style.paddingRight||'',paddingBottom:el.style.paddingBottom||'',paddingLeft:el.style.paddingLeft||''});
  }
  function deselectEl(silent=false){
    clearMulti();clearHovers();
    if(!selectedEl)return;
    selectedEl.classList.remove('__mc_s');
    if(selectedEl.__mc_dd)selectedEl.removeEventListener('mousedown',selectedEl.__mc_dd);
    handles.forEach(h=>{h.style.display='none';if(h.__mc_hd)h.removeEventListener('mousedown',h.__mc_hd,true);});
    selectedEl=null;bar.style.display='none';label.style.display='none';closePops();
  }

  // ── Duplicate ─────────────────────────────────────────────
  function duplicateEl(){
    if(!selectedEl){showToast('Select an element first');return;}
    const existing=document.getElementById('__mc_dup_picker');
    if(existing){existing.remove();return;}
    const picker=mk('div',{id:'__mc_dup_picker'});
    picker.style.cssText='position:fixed !important;z-index:2147483648 !important;background:#111;border:1px solid #2a2a2a;border-radius:8px;padding:6px;box-shadow:0 8px 28px rgba(0,0,0,.7);display:flex;flex-direction:column;gap:3px;min-width:150px;font-family:system-ui,sans-serif;';
    const btn=g('mc-dup');
    if(btn){const r=btn.getBoundingClientRect();const barR=bar.getBoundingClientRect();picker.style.top=(barR.top>90?barR.top-80:barR.bottom+6)+'px';picker.style.left=Math.max(8,r.left)+'px';}
    [{label:'↓ After element',pos:'after'},{label:'↑ Before element',pos:'before'}].forEach(({label:lbl,pos})=>{
      const opt=mk('button');
      opt.style.cssText='background:none;border:none;color:#ccc;font:500 11px/1 system-ui,sans-serif;padding:7px 10px;border-radius:5px;cursor:pointer;text-align:left;width:100%;';
      opt.textContent=lbl;
      opt.onmouseenter=()=>opt.style.background='#222';
      opt.onmouseleave=()=>opt.style.background='none';
      opt.onclick=()=>{
        picker.remove();
        const ctx=getCtx(selectedEl);
        const posMap={'after':'Place immediately after the original as a sibling','before':'Place immediately before the original as a sibling'};
        rec({id:Date.now()+Math.random(),type:'duplicate',el:selectedEl,desc:`Duplicate ${elLabel(selectedEl)} — ${lbl}`,selector:ctx.selector,classes:ctx.classes,text:ctx.text,position:pos});
        renderBar();pb.style.display='block';showToast('Duplicate added to prompt ✓');
      };
      picker.appendChild(opt);
    });
    document.body.appendChild(picker);
    setTimeout(()=>{
      document.addEventListener('click',function cp(e){if(!picker.contains(e.target)){picker.remove();document.removeEventListener('click',cp);}});
    },0);
  }

  // ── Drag ──────────────────────────────────────────────────
  function setupDrag(el){
    if(el.__mc_dd)el.removeEventListener('mousedown',el.__mc_dd);
    el.__mc_dd=e=>{
      if(isMc(e.target)||e.target.classList.contains('__mc_handle'))return;
      e.preventDefault();e.stopPropagation();
      const start={x:e.clientX,y:e.clientY},origin=getTr(el);let moved=false;
      _dragging=true;
      const mv=me=>{const dx=me.clientX-start.x,dy=me.clientY-start.y;if(Math.abs(dx)>2||Math.abs(dy)>2)moved=true;applyTr(el,origin.x+dx,origin.y+dy);posHandles();posLabel();posBar();};
      const up=me=>{
        window.removeEventListener('mousemove',mv,true);window.removeEventListener('mouseup',up,true);
        setTimeout(()=>_dragging=false,100);
        if(!moved)return;
        const dx=Math.round(me.clientX-start.x),dy=Math.round(me.clientY-start.y);
        rec({type:'move',el,desc:`Moved ${dx>0?'right':'left'} ${Math.abs(dx)}px${dy?`, ${dy>0?'down':'up'} ${Math.abs(dy)}px`:''}`,before:origin,after:{x:origin.x+dx,y:origin.y+dy},deltaX:dx,deltaY:dy});
        renderBar();
      };
      window.addEventListener('mousemove',mv,true);window.addEventListener('mouseup',up,true);
    };
    el.addEventListener('mousedown',el.__mc_dd,false);
  }

  // ── Resize ────────────────────────────────────────────────
  function setupHandles(el){
    handles.forEach(h=>{
      if(h.__mc_hd)h.removeEventListener('mousedown',h.__mc_hd,true);
      h.__mc_hd=e=>{
        e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
        const pos=h.dataset.pos,cs=window.getComputedStyle(el);
        const sw=parseFloat(cs.width)||0,sh=parseFloat(cs.height)||0,sx=e.clientX,sy=e.clientY;
        _resizing=true;
        const mv=me=>{
          me.preventDefault();me.stopPropagation();
          const dx=me.clientX-sx,dy=me.clientY-sy;
          let nw=sw,nh=sh;
          if(pos.includes('e'))nw=Math.max(20,sw+dx);
          if(pos.includes('s'))nh=Math.max(20,sh+dy);
          if(pos.includes('w'))nw=Math.max(20,sw-dx);
          if(pos.includes('n'))nh=Math.max(20,sh-dy);
          el.style.width=nw+'px';el.style.height=nh+'px';
          posHandles();posBar();
        };
        const up=()=>{
          window.removeEventListener('mousemove',mv,true);window.removeEventListener('mouseup',up,true);
          setTimeout(()=>_resizing=false,150);
          const cs2=window.getComputedStyle(el);
          const nw=Math.round(parseFloat(cs2.width)),nh=Math.round(parseFloat(cs2.height));
          if(Math.abs(nw-sw)>1||Math.abs(nh-sh)>1){
            rec({type:'resize',el,desc:`Resized ${Math.round(sw)}×${Math.round(sh)} → ${nw}×${nh}px`,before:{w:Math.round(sw),h:Math.round(sh)},after:{w:nw,h:nh}});
            renderBar();
          }
        };
        window.addEventListener('mousemove',mv,true);window.addEventListener('mouseup',up,true);
      };
      h.addEventListener('mousedown',h.__mc_hd,true);
    });
  }

  // ── Translate ─────────────────────────────────────────────
  function applyTr(el,x,y){const base=(el.style.transform||'').replace(/translate\([^)]*\)/g,'').trim();el.style.transform=`translate(${x}px,${y}px)${base?' '+base:''}`;}
  function getTr(el){const m=(el.style.transform||'').match(/translate\(([^,]+),([^)]+)\)/);return m?{x:+m[1]||0,y:+m[2]||0}:{x:0,y:0};}

  // ── Position UI ───────────────────────────────────────────
  function posBar(){
    if(!selectedEl){bar.style.display='none';return;}
    const r=selectedEl.getBoundingClientRect();
    bar.style.display='flex';
    let top=r.top-44;if(top<6)top=r.bottom+6;
    bar.style.top=Math.max(6,top)+'px';
    bar.style.left=Math.max(6,Math.min(r.left,window.innerWidth-300))+'px';
  }
  function posHandles(){
    if(!selectedEl){handles.forEach(h=>h.style.display='none');return;}
    const r=selectedEl.getBoundingClientRect();
    const m={nw:[r.left,r.top],ne:[r.right,r.top],sw:[r.left,r.bottom],se:[r.right,r.bottom]};
    handles.forEach(h=>{const[x,y]=m[h.dataset.pos];Object.assign(h.style,{left:x+'px',top:y+'px',display:'block'});});
  }
  function posLabel(){
    if(!selectedEl){label.style.display='none';return;}
    const r=selectedEl.getBoundingClientRect();
    label.textContent=elLabel(selectedEl);label.style.display='block';
    let top=r.top-20;if(top<2)top=r.bottom+2;
    label.style.top=top+'px';label.style.left=Math.max(4,Math.min(r.left,window.innerWidth-160))+'px';
  }

  // ── Record ────────────────────────────────────────────────
  const _dt=new WeakMap();
  function debRec(el,c){clearTimeout(_dt.get(el));_dt.set(el,setTimeout(()=>{rec(c);renderBar();},400));}
  function rec(c){
    c.id=c.id||Date.now()+Math.random();
    const idx=changes.findIndex(x=>x.el===c.el&&x.type===c.type&&(x.subtype||'')===(c.subtype||'')&&(x.subProp||'')===(c.subProp||''));
    if(idx>=0)changes[idx]={...changes[idx],...c};else changes.push(c);
  }
  function undoChange(id){
    const idx=changes.findIndex(c=>c.id===id);if(idx<0)return;
    const c=changes[idx],orig=originalStyles.get(c.el);
    if(orig){
      if(c.type==='move')c.el.style.transform=orig.transform;
      if(c.type==='resize'){c.el.style.width=orig.width;c.el.style.height=orig.height;}
      if(c.type==='color'&&c.subtype==='bg')c.el.style.backgroundColor=orig.backgroundColor;
      if(c.type==='color'&&c.subtype==='text')c.el.style.color=orig.color;
      if(c.type==='font-size')c.el.style.fontSize=orig.fontSize;
      if(c.type==='border-radius')c.el.style.borderRadius=orig.borderRadius;
      if(c.type==='opacity')c.el.style.opacity=orig.opacity;
      if(c.type==='padding'){c.el.style.paddingTop=orig.paddingTop;c.el.style.paddingRight=orig.paddingRight;c.el.style.paddingBottom=orig.paddingBottom;c.el.style.paddingLeft=orig.paddingLeft;}
    }
    changes.splice(idx,1);renderBar();
  }
  function clearAll(){
    changes.forEach(c=>{
      const orig=originalStyles.get(c.el);if(!orig)return;
      if(c.type==='move')c.el.style.transform=orig.transform;
      if(c.type==='resize'){c.el.style.width=orig.width;c.el.style.height=orig.height;}
      if(c.type==='color'&&c.subtype==='bg')c.el.style.backgroundColor=orig.backgroundColor;
      if(c.type==='color'&&c.subtype==='text')c.el.style.color=orig.color;
      if(c.type==='font-size')c.el.style.fontSize=orig.fontSize;
      if(c.type==='border-radius')c.el.style.borderRadius=orig.borderRadius;
      if(c.type==='opacity')c.el.style.opacity=orig.opacity;
      if(c.type==='padding'){c.el.style.paddingTop=orig.paddingTop;c.el.style.paddingRight=orig.paddingRight;c.el.style.paddingBottom=orig.paddingBottom;c.el.style.paddingLeft=orig.paddingLeft;}
    });
    changes=[];renderBar();showToast('All changes reset');
  }
  function copyPrompt(){
    const p=generatePrompt();if(!p)return;
    const btn=g('mc-copy');
    navigator.clipboard.writeText(p).then(()=>{
      if(btn){btn.textContent='✓ Copied!';btn.classList.add('ok');setTimeout(()=>{btn.textContent='⚡ Copy';btn.classList.remove('ok');},2000);}
      showToast('Prompt copied ⚡');
    }).catch(()=>{const ta=document.createElement('textarea');ta.value=p;ta.style.cssText='position:fixed;opacity:0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();showToast('Copied!');});
  }

  // ── Render ────────────────────────────────────────────────
  function renderBar(){
    const cnt=g('mc-cnt'),cnt2=g('mc-cnt2');
    if(cnt)cnt.textContent=changes.length;
    if(cnt2)cnt2.textContent=changes.length;
    const fwEl=g('mc-fw');if(fwEl&&fw)fwEl.textContent=fw.summary;
    if(changes.length>0)pb.style.display='block';
    const list=g('__mc_clist');if(!list)return;
    const icons={move:'↕',resize:'⤡',color:'◉','font-size':'Aa','border-radius':'◌',padding:'⬜',opacity:'◐',duplicate:'⊕'};
    list.innerHTML='';
    changes.forEach(c=>{
      const row=mk('div',{class:'mc-ci-row'});
      row.innerHTML=`<span class="mc-ci-ico">${icons[c.type]||'○'}</span><span class="mc-ci-el">${esc(elLabel(c.el))}</span><span class="mc-ci-desc">${esc(c.desc)}</span><button class="mc-undo" data-id="${c.id}">↩</button>`;
      row.querySelector('.mc-undo').onclick=()=>undoChange(c.id);
      list.appendChild(row);
    });
    if(promptTextVisible){const pt=g('__mc_ptxt');if(pt)pt.value=generatePrompt();}
  }

  // ── Helpers ───────────────────────────────────────────────
  function g(id){return document.getElementById(id);}
  function elLabel(el){const tag=el.tagName.toLowerCase();const id=el.id?`#${el.id}`:'';const cls=Array.from(el.classList||[]).filter(c=>!c.startsWith('__mc')&&!c.startsWith('mc-')).slice(0,2).map(c=>`.${c}`).join('');return`<${tag}${id}${cls}>`;}
  function getCtx(el){const tag=el.tagName.toLowerCase();const classes=Array.from(el.classList||[]).filter(c=>!c.startsWith('__mc')&&!c.startsWith('mc-')).join(' ');const text=el.textContent.trim().slice(0,60);let selector=tag;if(el.id)selector=`#${CSS.escape(el.id)}`;else if(classes)selector=`${tag}.${classes.split(' ').slice(0,2).map(c=>CSS.escape(c)).join('.')}`;return{selector,classes:classes||null,text:text||null};}
  function mk(tag,attrs={}){const el=document.createElement(tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);return el;}
  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function showToast(msg){toast.textContent=msg;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2200);}
  function rgbHex(rgb){const m=rgb.match(/\d+/g);if(!m||m.length<3)return'#000000';return'#'+m.slice(0,3).map(n=>parseInt(n).toString(16).padStart(2,'0')).join('');}
  function notifyPopup(s){try{chrome.runtime.sendMessage({action:'MC_STATE',active:s}).catch(()=>{});}catch(e){}}

  // ── Double backtick ───────────────────────────────────────
  window.addEventListener('keydown',e=>{
    if(e.key!=='`')return;
    const now=Date.now();
    if(now-_lastBt<400){e.preventDefault();e.stopPropagation();_lastBt=0;toggle();}
    else _lastBt=now;
  },true);

  // ── Activate / Deactivate ─────────────────────────────────
  function activate(){
    active=true;fw=detectFramework();
    const fwEl=g('mc-fw');if(fwEl)fwEl.textContent=fw.summary;
    document.addEventListener('mousemove',onMove,true);
    document.addEventListener('click',onClick,true);
    document.addEventListener('keydown',onKey,true);
    document.addEventListener('scroll',onScroll,true);
    collapseBar();pb.style.display='block';renderBar();
    showToast('✦ Magic Cursor active — click anything');
    notifyPopup(true);
  }
  function deactivate(){
    active=false;deselectEl();closePops();clearHovers();
    document.removeEventListener('mousemove',onMove,true);
    document.removeEventListener('click',onClick,true);
    document.removeEventListener('keydown',onKey,true);
    document.removeEventListener('scroll',onScroll,true);
    bar.style.display='none';pb.style.display='none';
    collapseBar();setBreakpoint('full');notifyPopup(false);
  }
  function toggle(){active?deactivate():activate();}

  window.__MC_TOGGLE=toggle;window.__MC_ACTIVATE=activate;window.__MC_DEACTIVATE=deactivate;window.__MC_STATE=()=>active;
  if(typeof chrome!=='undefined'&&chrome.runtime&&chrome.runtime.onMessage){
    chrome.runtime.onMessage.addListener(msg=>{if(msg.action==='MC_TOGGLE')toggle();if(msg.action==='MC_ACTIVATE')activate();if(msg.action==='MC_DEACTIVATE')deactivate();});
  }
})();
