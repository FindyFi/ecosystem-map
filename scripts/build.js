#!/usr/bin/env node
/* Kokoaa data/-, i18n/-, src/- ja assets/-kansioiden sisällön yhdeksi itsenäiseksi
 * HTML-tiedostoksi dist/index.html ja tarkistaa datan eheyden.
 *   npm run build      – tarkistus ja build
 *   npm run validate   – pelkkä tarkistus
 */
"use strict";
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const ROOT = path.resolve(__dirname, "..");
const P = (...p) => path.join(ROOT, ...p);
const readYaml = f => yaml.load(fs.readFileSync(f, "utf8"));
const validateOnly = process.argv.includes("--validate-only");

/* ---------- lataus ---------- */
const meta = readYaml(P("data/meta.yaml"));
const LANGS = meta.languages;
const usecases = meta.usecase_order.map(id => {
  const f = P("data/usecases", id + ".yaml");
  if (!fs.existsSync(f)) fail(`meta.yaml: usecase_order viittaa puuttuvaan tiedostoon data/usecases/${id}.yaml`);
  return readYaml(f);
});
const DATA = {
  meta,
  layers: readYaml(P("data/layers.yaml")),
  roles: readYaml(P("data/roles.yaml")),
  edges: readYaml(P("data/edges.yaml")),
  usecases,
  flows: Object.fromEntries(["yleinen", "ebw"].map(id => [id, readYaml(P("data/flows", id + ".yaml"))])),
  trust: readYaml(P("data/trust.yaml")),
  wizard: readYaml(P("data/wizard.yaml")),
  monetisation: readYaml(P("data/monetisation.yaml")),
  personas: readYaml(P("data/personas.yaml")),
  sources: readYaml(P("data/sources.yaml")),
};
const I18N = Object.fromEntries(LANGS.map(l => [l, readYaml(P("i18n", l + ".yaml"))]));

/* ---------- tarkistukset ---------- */
const errors = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
function fail(msg){ console.error("✗ " + msg); process.exit(1); }

if (!/^https:\/\/.+\/$/.test(meta.url || "")) err("data/meta.yaml", "url puuttuu tai ei ole muotoa https://…/");

const STATUSES = ["voimassa", "ehdotus", "arf", "kaytanto", "havainnollistava", "lahde"];
const FLOW_TYPES = ["data", "saasto", "raha", "reuna"];
const ZONES = ["hal", "myo", "lom", "hyo", "val"];
const layerIds = new Set(DATA.layers.map(l => l.id));
const roleIds = new Set();
DATA.roles.forEach((r, i) => {
  if (roleIds.has(r.id)) err(`roles[${i}]`, `rooli ${r.id} on määritelty kahdesti`);
  roleIds.add(r.id);
  if (!layerIds.has(r.layer)) err(`roles.${r.id}`, `tuntematon kerros ${r.layer}`);
  if (!ZONES.includes(r.zone)) err(`roles.${r.id}`, `tuntematon vyöhyke ${r.zone}`);
  if (r.status && !STATUSES.includes(r.status)) err(`roles.${r.id}`, `tuntematon tila ${r.status}`);
  if (!r.name || !r.short || !r.description) err(`roles.${r.id}`, "name, short ja description ovat pakollisia");
});
DATA.edges.forEach((e, i) => {
  if (!roleIds.has(e.from)) err(`edges[${i}]`, `tuntematon rooli ${e.from}`);
  if (!roleIds.has(e.to)) err(`edges[${i}]`, `tuntematon rooli ${e.to}`);
});
const moIds = new Set(DATA.monetisation.map(m => m.id));
function checkFlows(where, F){
  const nodeIds = new Set(F.nodes.map(n => n.id));
  F.nodes.forEach(n => { if (n.x < 0 || n.x > 900 || n.y < 0 || n.y > 540) err(`${where}.nodes.${n.id}`, "koordinaatit kaavion ulkopuolella (0–900, 0–540)"); });
  F.flows.forEach((f, i) => {
    const w = `${where}.flows[${i}]`;
    if (!nodeIds.has(f.from)) err(w, `tuntematon solmu ${f.from}`);
    if (!nodeIds.has(f.to)) err(w, `tuntematon solmu ${f.to}`);
    if (!FLOW_TYPES.includes(f.type)) err(w, `tuntematon tyyppi ${f.type}`);
    if (!STATUSES.includes(f.status)) err(w, `jokaisella virralla on oltava tila (status); nyt ${f.status}`);
    if (f.model && !moIds.has(f.model)) err(w, `tuntematon ansaintamalli ${f.model}`);
    if (!f.name || !f.description) err(w, "name ja description ovat pakollisia");
  });
}
Object.entries(DATA.flows).forEach(([id, F]) => checkFlows(`flows/${id}`, F));
usecases.forEach(u => {
  const w = `usecases/${u.id}`;
  Object.keys(u.detail.cast).forEach(r => { if (!roleIds.has(r)) err(`${w}.detail.cast`, `tuntematon rooli ${r}`); });
  u.detail.cast_order.forEach(r => { if (!u.detail.cast[r]) err(`${w}.detail.cast_order`, `roolilla ${r} ei ole cast-merkintää`); });
  if (!STATUSES.includes(u.detail.status)) err(w, `tuntematon tila ${u.detail.status}`);
  checkFlows(`${w}.flows`, u.flows);
});
DATA.personas.forEach(p => {
  if (p.role && !roleIds.has(p.role)) err(`personas.${p.id}`, `tuntematon rooli ${p.role}`);
  (p.layers || []).forEach(l => { if (!layerIds.has(l)) err(`personas.${p.id}`, `tuntematon kerros ${l}`); });
});
DATA.sources.forEach((s, i) => { if (s.url !== undefined && !/^https:\/\/\S+$/.test(s.url)) err(`sources[${i}]`, `url ei ole muotoa https://…: ${s.url}`); });
DATA.trust.mechanisms.forEach(m => { if (!layerIds.has(m.layer)) err(`trust.${m.id}`, `tuntematon kerros ${m.layer}`); });

/* Lokalisoidut kentät: jokaisella {fi, en} -oliolla on oltava kaikki kielet ja ei-tyhjä arvo. */
const isLoc = o => o && typeof o === "object" && !Array.isArray(o) && Object.keys(o).length > 0 && Object.keys(o).every(k => LANGS.includes(k));
function walk(o, where){
  if (Array.isArray(o)) return o.forEach((x, i) => walk(x, `${where}[${i}]`));
  if (isLoc(o)) { LANGS.forEach(l => { if (typeof o[l] !== "string" || !o[l].trim()) err(where, `käännös puuttuu: ${l}`); }); return; }
  if (o && typeof o === "object") for (const k in o) walk(o[k], `${where}.${k}`);
}
for (const k of ["layers", "roles", "edges", "usecases", "flows", "trust", "wizard", "monetisation", "personas", "sources"]) walk(DATA[k], k);
const base = I18N[meta.default_lang];
LANGS.forEach(l => {
  Object.keys(base).forEach(k => { if (!(k in I18N[l])) err(`i18n/${l}.yaml`, `avain puuttuu: ${k}`); });
  Object.keys(I18N[l]).forEach(k => { if (!(k in base)) err(`i18n/${l}.yaml`, `ylimääräinen avain: ${k}`); });
});
/* Käyttöliittymän staattiset avaimet sivupohjassa */
const tpl = fs.readFileSync(P("src/index.html"), "utf8");
for (const m of tpl.matchAll(/data-i18n(?:-html|-aria)?="([^"]+)"/g)) if (!(m[1] in base)) err("src/index.html", `tuntematon i18n-avain ${m[1]}`);
const app = fs.readFileSync(P("src/app.js"), "utf8");
for (const m of app.matchAll(/\bT\("([^"]+)"/g)) if (!m[1].endsWith(".") && !(m[1] in base)) err("src/app.js", `tuntematon i18n-avain ${m[1]}`);

if (errors.length) {
  console.error(`✗ Tarkistuksessa löytyi ${errors.length} virhettä:`);
  errors.forEach(e => console.error("  - " + e));
  process.exit(1);
}
console.log(`✓ Data kunnossa: ${DATA.roles.length} roolia, ${DATA.edges.length} yhteyttä, ${usecases.length} käyttötapausta, kielet ${LANGS.join(", ")}.`);
if (validateOnly) process.exit(0);

/* ---------- build ---------- */
const b64 = f => fs.readFileSync(f).toString("base64");
const css = fs.readFileSync(P("src/styles.css"), "utf8")
  .replace("{{FONT}}", "data:font/woff2;base64," + b64(P("assets/fonts/archivo-latin.woff2")));
const json = o => JSON.stringify(o).replace(/</g, "\\u003c");
const html = tpl
  .replace("/*{{CSS}}*/", () => css)
  .replace("{{URL}}", () => meta.url)
  .replace("{{LOGO}}", "data:image/png;base64," + b64(P("assets/findynet-logo.png")))
  .replace("/*{{DATA}}*/", () => json(DATA))
  .replace("/*{{I18N}}*/", () => json(I18N))
  .replace("/*{{APP}}*/", () => app);
fs.mkdirSync(P("dist"), {recursive: true});
fs.writeFileSync(P("dist/index.html"), html);
fs.writeFileSync(P("dist/.nojekyll"), "");
console.log(`✓ dist/index.html (${Math.round(html.length / 1024)} kt)`);
