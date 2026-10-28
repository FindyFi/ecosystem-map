/* Digitaalisten todisteiden ekosysteemikartta – sovelluslogiikka.
 * Data (window.__DATA__) ja käyttöliittymän tekstit (window.__I18N__) upotetaan buildissa.
 * Lokalisoidut kentät ovat muotoa {fi: "...", en: "..."}; resolve() valitsee kielen. */
(function () {
"use strict";
const RAW = window.__DATA__, I18N = window.__I18N__;
const LANGS = Object.keys(I18N);
const NS = "http://www.w3.org/2000/svg";
const FT_ORDER = {data:0, saasto:1, raha:2, reuna:3};
const FT_COLOR = {raha:"var(--raha)", data:"var(--data)", saasto:"var(--saasto)", reuna:"var(--reuna)"};
const ALL_LAYERS = RAW.layers.map(l => l.id);

/* ---------- state ---------- */
const S = {lang:null, view:"kartta", layers:new Set(ALL_LAYERS), role:null, hl:"", uc:RAW.usecases[0].id,
  scen:"yleinen", ft:new Set(["data","saasto","raha","reuna"]), mopt:null, flow:null, chain:RAW.usecases[0].id,
  depth:"perus", checks:new Set(), wtype:"", whave:new Set(), wwant:new Set()};
let D = null;

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const isLoc = o => o && typeof o === "object" && !Array.isArray(o) && LANGS.some(l => l in o) && Object.keys(o).every(k => LANGS.includes(k));
function resolve(o, lang){
  if (Array.isArray(o)) return o.map(x => resolve(x, lang));
  if (isLoc(o)) return o[lang] || o[RAW.meta.default_lang] || "";
  if (o && typeof o === "object") { const r = {}; for (const k in o) r[k] = resolve(o[k], lang); return r; }
  return o;
}
function T(key, vars){
  let s = (I18N[S.lang] && I18N[S.lang][key]) ?? I18N[RAW.meta.default_lang][key] ?? key;
  if (vars) for (const k in vars) s = s.replace(`{${k}}`, vars[k]);
  return s;
}
const roleById = id => D.roles.find(r => r.id === id);
const ucById = id => D.usecases.find(u => u.id === id);
const stTag = st => st ? `<span class="tag st-${st}">${esc(T("status."+st))}</span>` : "";
const layerName = l => D.layers.find(x => x.id === l).name;
const layerTag = l => `<span class="layer-tag" style="--c:var(--${l})">${esc(layerName(l))}</span>`;
function scenario(id){ if (D.flows[id]) return D.flows[id]; const u = ucById(id); return u && u.flows; }
const scenarioIds = () => ["yleinen","ebw", ...D.usecases.map(u => u.id)];
const scenarioLabel = id => id==="yleinen"||id==="ebw" ? T("scen."+id) : (ucById(id).org || ucById(id).name);
const _cv = document.createElement("canvas").getContext("2d");
function textW(t){ _cv.font = '700 12px "Archivo", Arial, sans-serif'; return _cv.measureText(t).width; }

/* ---------- hash ---------- */
function writeHash(){
  const p = new URLSearchParams();
  p.set("lang", S.lang); p.set("v", S.view);
  if (S.role) p.set("rooli", S.role);
  if (S.hl) p.set("korosta", S.hl);
  if (S.view === "kayttotapaukset") p.set("kt", S.uc);
  if (S.view === "rahavirrat") p.set("malli", S.scen);
  if (S.layers.size < ALL_LAYERS.length) p.set("kerrokset", [...S.layers].join(","));
  if (S.depth !== "perus") p.set("taso", S.depth);
  history.replaceState(null, "", "#" + p.toString());
}
function readHash(){
  const p = new URLSearchParams(location.hash.slice(1));
  const lang = p.get("lang");
  if (lang && LANGS.includes(lang)) S.lang = lang;
  if (p.get("v")) S.view = p.get("v");
  if (p.get("rooli")) S.role = p.get("rooli");
  if (p.get("korosta")) S.hl = p.get("korosta");
  if (p.get("kt")) S.uc = p.get("kt");
  if (p.get("malli")) S.scen = p.get("malli");
  if (p.get("kerrokset")) S.layers = new Set(p.get("kerrokset").split(",").filter(x => ALL_LAYERS.includes(x)));
  if (p.get("taso")) S.depth = p.get("taso");
}
function detectLang(){
  const nav = (navigator.languages || [navigator.language || ""]).map(x => x.slice(0,2).toLowerCase());
  return nav.find(l => LANGS.includes(l)) || RAW.meta.default_lang;
}

/* ---------- static texts ---------- */
function applyStatic(){
  document.documentElement.lang = S.lang;
  document.title = T("meta.title");
  $$("[data-i18n]").forEach(el => el.textContent = T(el.dataset.i18n));
  $$("[data-i18n-html]").forEach(el => el.innerHTML = T(el.dataset.i18nHtml));
  $$("[data-i18n-aria]").forEach(el => el.setAttribute("aria-label", T(el.dataset.i18nAria)));
  $("#updated").textContent = T("footer.updated", {date: formatDate(RAW.meta.updated)});
  $("#contact").href = RAW.meta.contact[S.lang] || RAW.meta.contact[RAW.meta.default_lang];
  $("#home").href = RAW.meta.home[S.lang] || RAW.meta.home[RAW.meta.default_lang];
  $("#sources").innerHTML = D.sources.map(s => `<li>${esc(s)}</li>`).join("");
  $("#persona").innerHTML = D.personas.map(p => `<option value="${p.id}">${esc(p.label)}</option>`).join("");
  $$("#lang-sel button").forEach(b => b.setAttribute("aria-pressed", b.dataset.lang === S.lang));
}
function formatDate(iso){
  const d = new Date(iso + "T12:00:00");
  return S.lang === "fi" ? `${d.getDate()}.${d.getMonth()+1}.${d.getFullYear()}`
    : d.toLocaleDateString("en-GB", {day:"numeric", month:"long", year:"numeric"});
}

/* ---------- views ---------- */
function setView(v){
  S.view = v;
  $$("nav.tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.view === v));
  $$("[data-viewpanel]").forEach(s => s.hidden = s.dataset.viewpanel !== v);
  if (v === "kartta") requestAnimationFrame(drawLinks);
  if (v === "rahavirrat") renderFlows();
  writeHash();
}

/* ---------- map ---------- */
function castFor(){ const u = S.hl && ucById(S.hl); return u ? u.detail.cast : null; }
function renderMap(){
  $$(".roles").forEach(z => z.innerHTML = "");
  const cast = castFor();
  D.roles.forEach(r => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "role"; b.dataset.id = r.id; b.style.setProperty("--c", `var(--${r.layer})`);
    b.innerHTML = esc(r.name) + (cast && cast[r.id] ? `<span class="cast">${esc(cast[r.id])}</span>` : "");
    b.hidden = !S.layers.has(r.layer);
    b.setAttribute("aria-pressed", S.role === r.id);
    if (cast && !cast[r.id]) b.classList.add("dim");
    b.addEventListener("click", () => { S.role = S.role === r.id ? null : r.id; renderMap(); renderRolePanel(); writeHash(); });
    document.querySelector(`.roles[data-zone="${r.zone}"]`).appendChild(b);
  });
  if (S.role) neighbors(S.role).forEach(([id]) => { const el = document.querySelector(`.role[data-id="${id}"]`); if (el) el.classList.add("rel"); });
  $$(".chip").forEach(c => c.setAttribute("aria-pressed", S.layers.has(c.dataset.layer)));
  $$(".chip .lbl").forEach(c => c.textContent = layerName(c.closest(".chip").dataset.layer));
  const sel = $("#hl-uc");
  sel.innerHTML = `<option value="">${esc(T("map.noHighlight"))}</option>` + D.usecases.map(u => `<option value="${u.id}">${esc(u.detail.highlight_label)}</option>`).join("");
  sel.value = S.hl;
  requestAnimationFrame(drawLinks);
}
function neighbors(id){
  const out = [];
  D.edges.forEach(e => { if (e.from === id) out.push([e.to, e.label]); else if (e.to === id) out.push([e.from, e.label]); });
  return out.filter(([n]) => S.layers.has(roleById(n).layer));
}
function drawLinks(){
  const svg = $("#links"), map = $("#map"); if (!svg || !map) return;
  svg.innerHTML = "";
  if (!S.role || $("#v-kartta").hidden) return;
  const src = document.querySelector(`.role[data-id="${S.role}"]`); if (!src || src.hidden) return;
  const mr = map.getBoundingClientRect(), sr = src.getBoundingClientRect();
  const sx = sr.left + sr.width/2 - mr.left, sy = sr.top + sr.height/2 - mr.top;
  neighbors(S.role).forEach(([id]) => {
    const el = document.querySelector(`.role[data-id="${id}"]`); if (!el || el.hidden) return;
    const r = el.getBoundingClientRect();
    const tx = r.left + r.width/2 - mr.left, ty = r.top + r.height/2 - mr.top;
    const mx = (sx+tx)/2, my = (sy+ty)/2 - Math.min(60, Math.abs(tx-sx)*.15);
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", `M${sx},${sy} Q${mx},${my} ${tx},${ty}`);
    p.setAttribute("stroke", getComputedStyle(el).getPropertyValue("--c"));
    svg.appendChild(p);
  });
}
function renderRolePanel(){
  const el = $("#role-panel");
  if (!S.role || !roleById(S.role)) {
    el.innerHTML = `<h2>${esc(T("panel.emptyTitle"))}</h2><p class="muted">${esc(T("panel.emptyText"))}</p>
      <h3>${esc(T("panel.layersTitle"))}</h3><ul class="small">${["perus","eudi","ebw","findy"].map(l => `<li>${T("panel.layer."+l)}</li>`).join("")}</ul>
      <p class="small muted">${esc(T("panel.tip"))}</p>`;
    return;
  }
  const r = roleById(S.role), nb = neighbors(S.role);
  const cast = castFor(), u = S.hl && ucById(S.hl);
  el.innerHTML = `${layerTag(r.layer)}<h2>${esc(r.name)}</h2>${stTag(r.status)}
    <p>${esc(r.description)}</p>
    ${cast && cast[r.id] ? `<p><b>${esc(u.detail.highlight_label)}:</b> ${esc(cast[r.id])}</p>` : ""}
    ${r.obligations ? `<h3>${esc(T("panel.obligations"))}</h3><ul>${r.obligations.map(o => `<li>${esc(o)}</li>`).join("")}</ul>` : ""}
    ${r.examples ? `<h3>${esc(T("panel.examples"))}</h3><p>${esc(r.examples)}</p>` : ""}
    ${r.is_this_you ? `<h3>${esc(T("panel.isThisYou"))}</h3><p>${esc(r.is_this_you)}</p>` : ""}
    ${nb.length ? `<h3>${esc(T("panel.connections"))}</h3><ul class="rel-list">${nb.map(([id,l]) => `<li><button type="button" data-goto="${id}"><b>${esc(roleById(id).name)}</b> <span class="muted small">– ${esc(l)}</span></button></li>`).join("")}</ul>` : ""}
    ${r.basis ? `<div class="basis expert"><b>${esc(T("panel.basis"))}</b> ${esc(r.basis)}</div>` : ""}
    <div class="btnrow"><button class="btn" type="button" id="role-close">${esc(T("panel.clear"))}</button></div>`;
  el.querySelectorAll("[data-goto]").forEach(b => b.addEventListener("click", () => { S.role = b.dataset.goto; renderMap(); renderRolePanel(); writeHash(); }));
  $("#role-close").addEventListener("click", () => { S.role = null; renderMap(); renderRolePanel(); writeHash(); });
}

/* ---------- use cases ---------- */
function renderUC(){
  $("#uc-grid").innerHTML = D.usecases.map(u => `
    <button type="button" class="uc" data-uc="${u.id}" aria-pressed="${S.uc === u.id}">
      <h3>${esc(u.name)}${u.org ? ` <span class="muted" style="font-weight:500">– ${esc(u.org)}</span>` : ""}</h3>
      <p>${esc(u.short)}</p>
      <div class="meta">${u.wallets.map(w => `<span class="pill">${esc(T("wallet."+w))}</span>`).join("")}<span class="pill">${esc(T("driver."+u.driver))}</span></div>
    </button>`).join("");
  $$("#uc-grid .uc").forEach(b => b.addEventListener("click", () => { S.uc = b.dataset.uc; renderUC(); writeHash(); }));
  renderUCDetail();
}
function renderUCDetail(){
  const u = ucById(S.uc), d = $("#uc-detail");
  if (!u) { d.innerHTML = ""; return; }
  const X = u.detail;
  const castRows = X.cast_order.map(id => { const r = roleById(id); return `<tr><td><span class="layer-tag" style="--c:var(--${r.layer})">${esc(r.name)}</span></td><td>${esc(X.cast[id])}</td></tr>`; }).join("");
  d.innerHTML = `<div class="uc-detail">
    <h2>${esc(X.title)}</h2>
    <p class="muted" style="margin-top:0">${esc(X.lead)} ${stTag(X.status)}</p>
    ${X.intro.map(p => `<p>${esc(p)}</p>`).join("")}
    <div class="cols">
      <div><h3>${esc(T("uc.steps"))}</h3><ol class="steps">${X.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>
        <p class="small muted">${esc(X.note)}</p></div>
      <div><h3>${esc(T("uc.roles"))}</h3><div class="tablewrap"><table><thead><tr><th>${esc(T("uc.role"))}</th><th>${esc(T("uc.who"))}</th></tr></thead><tbody>${castRows}</tbody></table></div>
        <h3>${esc(T("uc.value"))}</h3><div class="tablewrap"><table><tbody>${X.value.map(v => `<tr><td><b>${esc(v.who)}</b></td><td>${esc(v.text)}</td></tr>`).join("")}</tbody></table></div></div>
    </div>
    ${X.sections.map(s => `<h3>${esc(s.title)}</h3><p>${esc(s.text)}</p>`).join("")}
    <p class="expert small muted">${esc(X.expert)}</p>
    <div class="btnrow">
      <button class="btn primary" type="button" id="go-map">${esc(T("uc.goMap"))}</button>
      <button class="btn" type="button" id="go-flow">${esc(T("uc.goFlow"))}</button>
      <button class="btn" type="button" id="go-trust">${esc(T("uc.goTrust"))}</button>
    </div></div>`;
  $("#go-map").addEventListener("click", () => { S.hl = u.id; S.role = null; S.layers = new Set(ALL_LAYERS); renderMap(); renderRolePanel(); setView("kartta"); });
  $("#go-flow").addEventListener("click", () => { S.scen = u.id; S.mopt = null; S.flow = null; setView("rahavirrat"); });
  $("#go-trust").addEventListener("click", () => { S.chain = u.id; renderChain(); setView("luottamus"); $("#chain").scrollIntoView({behavior:"smooth", block:"center"}); });
}

/* ---------- flows ---------- */
function renderFlows(){
  if (!scenario(S.scen)) S.scen = "yleinen";
  const sc0 = scenario(S.scen);
  const flows = sc0.flows.map((f,i) => [f,i]).sort((a,b) => FT_ORDER[a[0].type]-FT_ORDER[b[0].type] || a[1]-b[1]).map(x => x[0]);
  const nodes = Object.fromEntries(sc0.nodes.map(n => [n.id, n]));
  $("#flow-scen").innerHTML = scenarioIds().map(id => `<button type="button" data-scen="${id}" aria-pressed="${S.scen === id}">${esc(scenarioLabel(id))}</button>`).join("");
  $$("#flow-scen button").forEach(b => b.addEventListener("click", () => { S.scen = b.dataset.scen; S.mopt = null; S.flow = null; renderFlows(); writeHash(); }));
  $$("#flow-types button").forEach(b => b.setAttribute("aria-pressed", S.ft.has(b.dataset.ft)));
  const used = new Set(flows.filter(f => f.model).map(f => f.model));
  $("#mopts").innerHTML = D.monetisation.map(m => `<button type="button" class="mopt" data-m="${m.id}" aria-pressed="${S.mopt === m.id}" ${used.has(m.id) ? "" : "disabled"}>${esc(m.label)}</button>`).join("");
  $$("#mopts .mopt").forEach(b => b.addEventListener("click", () => { if (b.disabled) return; S.mopt = S.mopt === b.dataset.m ? null : b.dataset.m; S.flow = null; renderFlows(); }));

  const svg = $("#flow-svg");
  svg.querySelectorAll("g,defs").forEach(n => n.remove());
  $("#flow-title").textContent = sc0.title;
  const defs = document.createElementNS(NS, "defs");
  defs.innerHTML = Object.entries(FT_COLOR).map(([k,c]) => `<marker id="ar-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:${c}"/></marker>`).join("");
  svg.appendChild(defs);
  const W = 150, H = 56;
  const gF = document.createElementNS(NS, "g"); svg.appendChild(gF);
  const gN = document.createElementNS(NS, "g"); svg.appendChild(gN);
  const selfCount = {};
  flows.forEach((f, i) => {
    const num = i + 1;
    if (!S.ft.has(f.type)) return;
    const dim = (S.mopt && f.model !== S.mopt) || (S.flow && S.flow !== num);
    const g = document.createElementNS(NS, "g"); g.setAttribute("class", "f" + (dim ? " dim" : "") + (S.flow === num ? " on" : ""));
    const c = FT_COLOR[f.type];
    const a = nodes[f.from], b = nodes[f.to];
    let d = null, lx, ly;
    if (f.from === f.to) {
      const k = selfCount[f.from] = (selfCount[f.from] || 0) + 1;
      const label = f.pill || f.name, pw = Math.ceil(textW(label)) + 44;
      const above = f.pill_position === "below" ? false : a.y > 110;
      const py = above ? a.y - H/2 - 16 - (k-1)*26 : a.y + H/2 + 16 + (k-1)*26;
      const px = Math.min(Math.max(a.x, pw/2 + 6), 900 - pw/2 - 6);
      const pill = document.createElementNS(NS, "g");
      pill.innerHTML = `<rect x="${px-pw/2}" y="${py-11}" width="${pw}" height="22" rx="11" style="fill:var(--surface);stroke:${c};stroke-width:2${f.type==="reuna" ? ";stroke-dasharray:5 4" : ""}"/><text x="${px-pw/2+30}" y="${py+4}" style="fill:${c};font-size:12px;font-weight:700">${esc(label)}</text>`;
      g.appendChild(pill);
      lx = px - pw/2 + 12; ly = py;
    } else {
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy), ux = dx/len, uy = dy/len;
      const tx = Math.abs(ux) > 1e-6 ? (W/2+6)/Math.abs(ux) : 1e9, ty = Math.abs(uy) > 1e-6 ? (H/2+6)/Math.abs(uy) : 1e9, t = Math.min(tx, ty);
      const sx = a.x + ux*t, sy = a.y + uy*t, ex = b.x - ux*t, ey = b.y - uy*t, bend = f.bend || 0;
      const mx = (sx+ex)/2 - uy*bend, my = (sy+ey)/2 + ux*bend;
      d = `M${sx},${sy} Q${mx},${my} ${ex},${ey}`; lx = (sx+2*mx+ex)/4; ly = (sy+2*my+ey)/4;
      const p = document.createElementNS(NS, "path"); p.setAttribute("d", d); p.style.stroke = c;
      if (f.type === "reuna") p.setAttribute("stroke-dasharray", "6 5");
      p.setAttribute("marker-end", `url(#ar-${f.type})`);
      g.appendChild(p);
    }
    const nb = document.createElementNS(NS, "g"); nb.setAttribute("class", "num"); nb.style.cursor = "pointer";
    nb.innerHTML = `<circle cx="${lx}" cy="${ly}" r="${f.from === f.to ? 10 : 11}" style="fill:${c}"/><text x="${lx}" y="${ly+4}" text-anchor="middle">${num}</text>`;
    nb.addEventListener("click", () => { S.flow = S.flow === num ? null : num; renderFlows(); });
    g.appendChild(nb); gF.appendChild(g);
  });
  sc0.nodes.forEach(n => {
    const g = document.createElementNS(NS, "g"); g.setAttribute("class", "node");
    g.innerHTML = `<rect x="${n.x-W/2}" y="${n.y-H/2}" width="${W}" height="${H}" rx="10"/><text x="${n.x}" y="${n.sub ? n.y-2 : n.y+5}" text-anchor="middle">${esc(n.label)}</text>${n.sub ? `<text class="sub" x="${n.x}" y="${n.y+16}" text-anchor="middle">${esc(n.sub)}</text>` : ""}`;
    gN.appendChild(g);
  });
  const L = $("#flow-list"); L.className = "flowlist" + ((S.mopt || S.flow) ? " dimmed" : "");
  L.innerHTML = flows.map((f, i) => {
    const num = i + 1; if (!S.ft.has(f.type)) return "";
    const dim = (S.mopt && f.model !== S.mopt) || (S.flow && S.flow !== num);
    const route = f.from === f.to ? esc(nodes[f.from].label) : esc(nodes[f.from].label) + " → " + esc(nodes[f.to].label);
    const m = f.model && D.monetisation.find(x => x.id === f.model);
    return `<li class="${dim ? "dim" : ""}"><button type="button" data-fl="${num}" aria-pressed="${S.flow === num}" style="--c:${FT_COLOR[f.type]}"><span class="n">${num}</span><span><b>${esc(f.name)}</b> <span class="small muted">${route}</span><br><span class="d">${esc(f.description)}</span><br>${stTag(f.status)}${m ? `<span class="tag" style="color:var(--raha)">${esc(m.label)}</span>` : ""}</span></button></li>`;
  }).join("");
  L.querySelectorAll("[data-fl]").forEach(b => b.addEventListener("click", () => { const n = +b.dataset.fl; S.flow = S.flow === n ? null : n; renderFlows(); }));
  const X = sc0.extra; let extra = "";
  if (X) extra = `<h3>${esc(X.title)}</h3>` + (X.list ? `<ol class="small" style="padding-left:20px">${X.list.map(x => `<li>${esc(x)}</li>`).join("")}</ol>` : "") + (X.text ? `<p class="small">${esc(X.text)}</p>` : "") + (X.source ? `<p class="small muted">${esc(X.source)}</p>` : "");
  const sel = S.flow ? flows[S.flow-1] : null;
  $("#flow-panel").innerHTML = `<h2>${esc(sc0.title)}</h2><p>${esc(sc0.intro)}</p>${sel ? `<div class="note" style="border-left-color:${FT_COLOR[sel.type]}"><b>${S.flow}. ${esc(sel.name)}</b><br>${esc(sel.description)}</div>` : ""}${extra}`;
}

/* ---------- trust ---------- */
function renderTrust(){
  $("#trust-grid").innerHTML = D.trust.mechanisms.map(t => `<article class="tcard" style="--c:var(--${t.layer})"><h3>${esc(t.name)}</h3>${stTag(t.status)}<p class="q">${esc(t.question)}</p><dl><dt>${esc(T("trust.maintainedBy"))}</dt><dd>${esc(t.maintained_by)}</dd><dt>${esc(T("trust.scope"))}</dt><dd>${esc(t.scope)}</dd><dt class="expert">${esc(T("trust.basis"))}</dt><dd class="expert">${esc(t.basis)}</dd></dl></article>`).join("");
  $("#check-items").innerHTML = D.trust.checks.map(c => `<label><input type="checkbox" data-c="${c.id}" ${S.checks.has(c.id) ? "checked" : ""}><span>${esc(c.text)}</span></label>`).join("");
  $$("#check-items input").forEach(i => i.addEventListener("change", () => { i.checked ? S.checks.add(i.dataset.c) : S.checks.delete(i.dataset.c); renderVerdict(); }));
  renderVerdict(); renderChain();
}
function renderVerdict(){
  const tr = D.trust, score = tr.checks.filter(c => S.checks.has(c.id)).reduce((a,c) => a + c.weight, 0);
  const v = S.checks.size === 0 ? tr.verdicts.none : score <= tr.thresholds.low ? tr.verdicts.low : score <= tr.thresholds.mid ? tr.verdicts.mid : tr.verdicts.high;
  $("#verdict").textContent = v;
}
function renderChain(){
  if (!ucById(S.chain)) S.chain = D.usecases[0].id;
  $("#chain-sel").innerHTML = D.usecases.map(u => `<button type="button" data-ch="${u.id}" aria-pressed="${S.chain === u.id}">${esc(u.trust_chain.name)}</button>`).join("");
  $$("#chain-sel button").forEach(b => b.addEventListener("click", () => { S.chain = b.dataset.ch; renderChain(); }));
  const C = ucById(S.chain).trust_chain;
  $("#chain-note").textContent = C.note;
  $("#chain").innerHTML = C.links.map(l => `<div class="lnk"><b>${esc(l.question)}</b>${esc(l.answer)}</div>`).join("");
}

/* ---------- wizard ---------- */
function renderWizard(){
  const Z = D.wizard;
  $("#w-type").innerHTML = Z.types.map(o => `<label><input type="radio" name="wt" value="${o.id}" ${S.wtype === o.id ? "checked" : ""}><span>${esc(o.label)}</span></label>`).join("");
  $("#w-have").innerHTML = Z.have.map(o => `<label><input type="checkbox" value="${o.id}" ${S.whave.has(o.id) ? "checked" : ""}><span>${esc(o.label)}</span></label>`).join("");
  $("#w-want").innerHTML = Z.want.map(o => `<label><input type="checkbox" value="${o.id}" ${S.wwant.has(o.id) ? "checked" : ""}><span>${esc(o.label)}</span></label>`).join("");
  $$("#w-type input").forEach(i => i.addEventListener("change", () => { S.wtype = i.value; renderResult(); }));
  $$("#w-have input").forEach(i => i.addEventListener("change", () => { i.checked ? S.whave.add(i.value) : S.whave.delete(i.value); renderResult(); }));
  $$("#w-want input").forEach(i => i.addEventListener("change", () => { i.checked ? S.wwant.add(i.value) : S.wwant.delete(i.value); renderResult(); }));
  renderResult();
}
/* Ohjatun polun säännöt: vastaukset → roolit, velvoitteet ja mahdollisuudet.
 * Tekstit ovat data/wizard.yaml-tiedostossa tunnisteiden mukaan. */
function wizardRules(t, h, w){
  const roles = new Set(), obl = [], opp = [];
  const pub = t === "viranomainen" || t === "julkinen";
  if (h.has("tieto") || w.has("myonna")) roles.add("myontaja");
  if (h.has("asiakkaat") || w.has("hyodynna")) roles.add("todentaja");
  if (t === "viranomainen" && (h.has("tieto") || w.has("myonna"))) { roles.add("pubeaa"); roles.add("lahde"); }
  if (t === "tsp") { roles.add("qeaa"); roles.add("ebwtunniste"); }
  if (t === "toimittaja") { roles.add("ohjelmisto"); roles.add("valittaja"); }
  if (t === "saannelty") roles.add("velvlo");
  if (pub || h.has("saapuvat")) { roles.add("julkis"); }
  if (pub) roles.add("ebwomistaja");
  const providesEbw = h.has("yritysasiakkaat") || t === "tsp" || t === "toimittaja";
  if (w.has("lompakko")) { roles.add("lompakko"); if (providesEbw) roles.add("ebwtarjoaja"); }
  if (w.has("ekosys") || t === "jarjesto") { roles.add("ekosysteemi"); roles.add("skeema"); roles.add("luottekos"); }
  if (t !== "jarjesto" && !pub) roles.add("ebwomistaja");
  if (pub) { obl.push("pub_ebw"); obl.push("pub_5f"); }
  if (t === "saannelty") obl.push("regulated_5f");
  if (roles.has("todentaja") || roles.has("velvlo")) obl.push("rp_register");
  if (t === "tsp") obl.push("tsp_qeaa");
  if (w.has("lompakko")) obl.push("wallet_type");
  if (!obl.length) obl.push("none");
  if (h.has("tieto")) opp.push("tieto");
  if (h.has("asiakkaat")) opp.push("asiakkaat");
  if (h.has("saapuvat")) opp.push("saapuvat");
  if (h.has("yritysasiakkaat")) opp.push("yritysasiakkaat");
  if (t === "toimittaja") opp.push("toimittaja");
  if (w.has("ekosys") || t === "jarjesto") opp.push("ekosys");
  if (w.has("hyodynna") && !h.has("asiakkaat")) opp.push("hyodynna");
  const fy = roles.has("ekosysteemi") ? "ecosystem" : (roles.has("lompakko") || roles.has("ebwtarjoaja") || roles.has("ohjelmisto")) ? "technology" : "default";
  return {roles, obl, opp, fy};
}
function renderResult(){
  const R = $("#w-result"), Z = D.wizard;
  if (!S.wtype) { R.innerHTML = `<h2>${esc(T("wiz.resultTitle"))}</h2><p class="muted">${esc(T("wiz.prompt"))}</p>`; return; }
  const {roles, obl, opp, fy} = wizardRules(S.wtype, S.whave, S.wwant);
  const O = id => Z.obligations.find(o => o.id === id), P = id => Z.opportunities.find(o => o.id === id);
  const C = Z.wallet_comparison;
  R.innerHTML = `<h2>${esc(T("wiz.resultTitle"))}</h2>
    <h3>${esc(T("wiz.roles"))}</h3>
    <div class="rolechips">${[...roles].map(id => { const r = roleById(id); return `<button type="button" data-r="${id}" style="--c:var(--${r.layer})">${esc(r.name)}</button>`; }).join("")}</div>
    <p class="small muted">${esc(T("wiz.rolesHint"))}</p>
    <h3>${esc(T("wiz.obligations"))}</h3><ul>${obl.map(id => `<li>${stTag(O(id).status)} ${esc(O(id).text)}</li>`).join("")}</ul>
    ${opp.length ? `<h3>${esc(T("wiz.opportunities"))}</h3><ul>${opp.map(id => `<li>${esc(P(id).text)}</li>`).join("")}</ul>` : ""}
    <h3>${esc(T("wiz.walletTitle"))}</h3>
    <div class="tablewrap"><table class="wt"><thead><tr><th></th>${C.columns.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead>
      <tbody>${C.rows.map(r => `<tr><td>${esc(r.label)}</td>${r.cells.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
    <p class="small muted">${stTag("ehdotus")} ${esc(C.note)}</p>
    <h3>${esc(T("wiz.findynet"))}</h3><p>${esc(Z.findynet[fy])}</p>`;
  R.querySelectorAll("[data-r]").forEach(b => b.addEventListener("click", () => { S.role = b.dataset.r; S.hl = ""; S.layers = new Set(ALL_LAYERS); renderMap(); renderRolePanel(); setView("kartta"); }));
}

/* ---------- persona, depth, language ---------- */
function applyPersona(id){
  const p = D.personas.find(x => x.id === id); if (!p) return;
  S.layers = new Set(p.layers || ALL_LAYERS); S.role = p.role || null;
  S.wtype = p.wtype || ""; S.whave = new Set(p.whave || []); S.wwant = new Set(p.wwant || []);
  renderMap(); renderRolePanel(); renderWizard(); writeHash();
}
function setDepth(d){ S.depth = d; document.body.dataset.depth = d; $$("#depth-sel button").forEach(b => b.setAttribute("aria-pressed", b.dataset.depth === d)); writeHash(); }
function setLang(lang){
  S.lang = lang; D = resolve(RAW, lang);
  const persona = $("#persona").value;
  applyStatic();
  if (persona) $("#persona").value = persona;
  renderAll(); writeHash();
}
function renderAll(){ renderMap(); renderRolePanel(); renderUC(); renderTrust(); renderWizard(); renderFlows(); setView(S.view); }

/* ---------- init ---------- */
function init(){
  S.lang = detectLang();
  readHash();
  D = resolve(RAW, S.lang);
  if (S.role && !roleById(S.role)) S.role = null;
  if (!ucById(S.uc)) S.uc = D.usecases[0].id;
  if (S.hl && !ucById(S.hl)) S.hl = "";
  applyStatic();
  $$("nav.tabs button").forEach(b => b.addEventListener("click", () => setView(b.dataset.view)));
  $$(".chip").forEach(c => c.addEventListener("click", () => {
    const l = c.dataset.layer; S.layers.has(l) ? S.layers.delete(l) : S.layers.add(l);
    if (S.role && !S.layers.has(roleById(S.role).layer)) S.role = null;
    renderMap(); renderRolePanel(); writeHash();
  }));
  $("#hl-uc").addEventListener("change", e => { S.hl = e.target.value; renderMap(); renderRolePanel(); writeHash(); });
  $$("#depth-sel button").forEach(b => b.addEventListener("click", () => setDepth(b.dataset.depth)));
  $$("#lang-sel button").forEach(b => b.addEventListener("click", () => setLang(b.dataset.lang)));
  $("#persona").addEventListener("change", e => applyPersona(e.target.value));
  $$("#flow-types button").forEach(b => b.addEventListener("click", () => { const k = b.dataset.ft; S.ft.has(k) ? S.ft.delete(k) : S.ft.add(k); if (!S.ft.size) S.ft.add(k); S.flow = null; renderFlows(); }));
  window.addEventListener("resize", () => requestAnimationFrame(drawLinks));
  setDepth(S.depth);
  renderAll();
}
init();
})();
