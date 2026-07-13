import { useState, useEffect } from "react";

// ============================================================
// FudnFuel Plan v34 — App principal
// v34: "Qué es esto?" en métricas, emoji 📈 glucosa,
// fuentes dentro de card, ciclo completo, chat de preguntas
// ============================================================

const C = {
  bg: "#d5e0cd", card: "#ffffff", primary: "#465721", accent: "#7a9a52",
  light: "#eaf2e5", muted: "#7a8c66", text: "#465721", pink: "#e8a0b0",
  pinkLight: "#fdf0f3", yellow: "#f0c040",
};

const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: 10,
  border: "1.5px solid #b8ccaa", fontSize: 15,
  background: "#f4f9f1", color: C.text, outline: "none", boxSizing: "border-box",
};
const labelStyle = { fontSize: 13, fontWeight: 700, color: C.primary, marginBottom: 5, display: "block" };
const cardStyle = { background: C.card, borderRadius: 18, padding: "22px 24px", marginBottom: 16, boxShadow: "0 2px 14px rgba(70,87,33,0.09)" };
const btnPrimary = { background: C.primary, color: "#fff", border: "none", borderRadius: 12, padding: "12px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer" };
const btnOutline = (active) => ({ background: active ? C.primary : "#fff", color: active ? "#fff" : C.primary, border: `2px solid ${C.primary}`, borderRadius: 10, padding: "8px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" });
const sourceStyle = { fontSize: 12, color: C.muted, fontStyle: "italic", marginTop: 10, padding: "8px 12px", background: "#f0f4ec", borderRadius: 8, lineHeight: 1.5 };

async function callAI(prompt, maxTokens = 2000) {
  // El modelo gratis a veces tarda o se satura: reintentamos hasta 3 veces
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) await new Promise(r => setTimeout(r, 1500));
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, maxTokens }),
      });
      if (!res.ok) { lastErr = new Error("HTTP " + res.status); continue; }
      const data = await res.json();
      if (data.text) return data.text;
      lastErr = new Error("Respuesta vacía");
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("Error al generar respuesta");
}

// ============ MOTOR DE PDF (guía horizontal diseñada) ============
let pdfLibsPromise = null;
function ensurePdfLibs() {
  if (pdfLibsPromise) return pdfLibsPromise;
  const load = (src) => new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("load " + src));
    document.body.appendChild(s);
  });
  pdfLibsPromise = (async () => {
    if (!window.html2canvas) await load("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
    if (!window.jspdf) await load("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  })();
  return pdfLibsPromise;
}
async function renderGuideToPdf(containerId, filename) {
  await ensurePdfLibs();
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("l", "pt", "a4");
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const pages = document.querySelectorAll("#" + containerId + " .pdfpage");
  if (!pages.length) throw new Error("Sin páginas para exportar");
  for (let i = 0; i < pages.length; i++) {
    const canvas = await window.html2canvas(pages[i], { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    const img = canvas.toDataURL("image/jpeg", 0.92);
    let w = pageW, h = canvas.height * pageW / canvas.width;
    if (h > pageH) { h = pageH; w = canvas.width * pageH / canvas.height; }
    if (i > 0) pdf.addPage();
    pdf.addImage(img, "JPEG", (pageW - w) / 2, 0, w, h);
  }
  pdf.save(filename);
}

// Quita ** y espacios sobrantes para texto plano en el PDF
function plain(s) { return String(s || "").replace(/\*\*/g, "").trim(); }
function splitSections(raw) {
  const out = []; const re = /##\s+(.+?)\n([\s\S]*?)(?=\n##\s+|$)/g; let m;
  while ((m = re.exec(raw || "")) !== null) out.push({ title: m[1].trim(), body: m[2].trim() });
  return out;
}
function findSec(secs, kws) { return secs.find(s => { const t = s.title.toLowerCase(); return kws.some(k => t.includes(k)); }); }
function parseMenuTable(body) {
  const lines = (body || "").split("\n").filter(l => l.includes("|"));
  if (lines.length < 2) return null;
  const parse = l => l.split("|").map(c => c.trim()).filter((c, i, a) => i > 0 && i < a.length - 1);
  const headers = parse(lines[0]);
  const rows = lines.slice(2).map(parse).filter(r => r.length);
  return { headers, rows };
}
function parseSupplementsFull(body) {
  return (body || "").split("\n")
    .map(l => l.replace(/^[-•*·●▪▸►\d.]+\s*/, "").replace(/\*\*/g, "").trim())
    .filter(l => l.length > 2 && l.length < 140).slice(0, 8)
    .map(l => { const parts = l.split(/\s[—–-]\s|:\s/); return { name: (parts[0] || l).trim(), reason: parts.slice(1).join(" ").trim() }; });
}
function parsePhases(body) {
  const phases = ["Menstrual", "Folicular", "Ovulatoria", "Lútea"];
  const out = {};
  phases.forEach(p => {
    const re = new RegExp("###\\s+(?:Fase\\s+)?" + p + "[\\s\\S]*?(?=###\\s+|$)", "i");
    const mm = body && body.match(re);
    if (!mm) return;
    const block = mm[0];
    const field = (label) => {
      const r = new RegExp("\\*\\*\\s*" + label + "[^:*]*:?\\s*\\*\\*\\s*([^\\n]+)", "i");
      const f = block.match(r); return f ? f[1].trim() : "";
    };
    out[p] = {
      mood: field("Estado de ánimo"), energy: field("Energía"), foods: field("Mejores alimentos"),
      training: field("Entrenamiento"), sleep: field("Sueño"), supps: field("Suplementos"),
      tip: field("Tip"), menu: field("Menú"),
    };
  });
  return out;
}
const PHASE_META = {
  Menstrual: { days: "Días 1–5", color: "#c07d86", soft: "#f7ecee", label: "Fase menstrual" },
  Folicular: { days: "Días 6–13", color: "#7a9a52", soft: "#eef3e6", label: "Fase folicular" },
  Ovulatoria: { days: "Días 14–16", color: "#cfa24e", soft: "#f7f0df", label: "Fase ovulatoria" },
  "Lútea": { days: "Días 17–28", color: "#8480a6", soft: "#efeef4", label: "Fase lútea" },
};

function GuidePage({ children, footer }) {
  return (
    <div className="pdfpage" style={{ width: 1123, minHeight: 794, background: "#fff", boxSizing: "border-box", padding: "48px 56px", position: "relative", fontFamily: "'Segoe UI', system-ui, sans-serif", color: C.text, overflow: "hidden" }}>
      {children}
      <div style={{ position: "absolute", left: 56, right: 56, bottom: 22, display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted, borderTop: `1px solid ${C.light}`, paddingTop: 8 }}>
        <span>FudnFuel · Guía nutricional personal</span><span>{footer}</span>
      </div>
    </div>
  );
}

function PdfGuide({ planData, includeCycle }) {
  if (!planData) return null;
  const { raw, metrics, userProfile, isFemale, phaseInfo, routineText } = planData;
  const m = metrics || {};
  const secs = splitSections(raw);
  const analisis = findSec(secs, ["análisis", "analisis", "cuerpo"]);
  const dieta = findSec(secs, ["alimenta", "dieta", "comida", "plan nutri"]);
  const metas = findSec(secs, ["meta", "diaria", "objetivo"]);
  const supl = findSec(secs, ["suplemento", "vitamina"]);
  const gluc = findSec(secs, ["glucosa", "pico", "azúcar", "azucar"]);
  const datos = findSec(secs, ["dato", "curiosidad", "sabías", "sabias", "lección", "leccion"]);
  const ciclo = findSec(secs, ["ciclo", "femenin", "hormonal"]);
  const menu = dieta ? parseMenuTable(dieta.body) : null;
  const goals = metas ? parseGoals(metas.body) : [];
  const supps = supl ? parseSupplementsFull(supl.body) : [];
  const tips = gluc ? parseTips(gluc.body) : [];
  const facts = datos ? parseFacts(datos.body).slice(0, 6) : [];
  const phases = (isFemale && ciclo) ? parsePhases(ciclo.body) : {};
  const goal = userProfile?.goal || "";
  const today = new Date().toLocaleDateString("es-MX");
  const showCycle = isFemale && includeCycle && ciclo;
  const phaseOrder = ["Menstrual", "Folicular", "Ovulatoria", "Lútea"];
  const goalIsLoss = goal.toLowerCase().includes("peso") || goal.toLowerCase().includes("bajar");
  const goalIsGain = goal.toLowerCase().includes("músculo") || goal.toLowerCase().includes("ganar");
  const objetivo = goalIsLoss ? (m.tdee - 400) : goalIsGain ? (m.tdee + 300) : m.tdee;
  const tiles = [
    { emoji: "⚖️", value: m.bmi, label: "IMC", sub: m.bmiCategory },
    { emoji: "🔥", value: m.bmr, label: "Metabolismo basal", sub: "kcal/día" },
    { emoji: "⚡", value: m.tdee, label: "Gasto total (TDEE)", sub: "kcal/día" },
    { emoji: "💪", value: `${m.smm} kg`, label: "Masa muscular", sub: "Fórmula de Lee" },
    { emoji: "🦴", value: `${m.lbm} kg`, label: "Masa magra", sub: "Fórmula de Boer" },
    { emoji: "🧈", value: `${m.fatMass} kg`, label: "Masa grasa", sub: `${m.fatPct}%` },
    { emoji: "📐", value: m.smi, label: "Índice muscular", sub: "kg/m²" },
  ];

  return (
    <div id="pdf-guide" style={{ position: "absolute", left: -99999, top: 0 }}>
      {/* PÁGINA 1 · Portada + Análisis */}
      <GuidePage footer="Portada · Análisis">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: 3, textTransform: "uppercase", color: C.accent, fontWeight: 700 }}>Guía nutricional personal</div>
            <div style={{ fontSize: 42, fontWeight: 900, color: C.primary, marginTop: 4 }}>FudnFuel</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 13, color: C.muted }}>
            <div><strong style={{ color: C.primary }}>Meta:</strong> {plain(goal)}</div>
            <div>{today}</div>
          </div>
        </div>
        <div style={{ height: 2, background: C.accent, width: 110, marginBottom: 22 }} />
        <div style={{ fontSize: 21, fontWeight: 800, color: C.primary, marginBottom: 16 }}>📊 Análisis aproximado de tu cuerpo</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 18 }}>
          {tiles.map((t, i) => (
            <div key={i} style={{ background: C.light, borderRadius: 14, padding: "16px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 26 }}>{t.emoji}</div>
              <div style={{ fontSize: 23, fontWeight: 800, color: C.primary, marginTop: 4 }}>{t.value}</div>
              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>{t.label}</div>
              <div style={{ fontSize: 11, color: C.accent }}>{t.sub}</div>
            </div>
          ))}
          <div style={{ background: C.primary, borderRadius: 14, padding: "16px 12px", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: 11, color: "#dfe8d2", textTransform: "uppercase", letterSpacing: 1 }}>Objetivo</div>
            <div style={{ fontSize: 23, fontWeight: 800, color: "#fff", marginTop: 4 }}>~{Math.round(objetivo || 0)}</div>
            <div style={{ fontSize: 11, color: "#dfe8d2" }}>kcal/día</div>
          </div>
        </div>
        {analisis && <div style={{ fontSize: 14, lineHeight: 1.7, color: C.text, background: "#faf8f2", borderRadius: 12, padding: "16px 20px", marginBottom: 16, whiteSpace: "pre-line" }}>{plain(analisis.body)}</div>}
        <div style={{ fontSize: 11, color: C.muted, fontStyle: "italic", lineHeight: 1.5 }}>📚 Fuentes: IMC (OMS) · Metabolismo basal Mifflin-St Jeor (1990) · Masa muscular Lee et al. (2000) · Masa magra Boer (1984) · Índice muscular Janssen (2000). Todos los valores son aproximados; para cifras precisas consulta a un profesional.</div>
      </GuidePage>

      {/* PÁGINA 2 · Menú */}
      {menu && (
        <GuidePage footer="Plan de alimentación">
          <div style={{ fontSize: 21, fontWeight: 800, color: C.primary, marginBottom: 16 }}>🍽️ Tu plan de alimentación</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead><tr>{menu.headers.map((h, i) => <th key={i} style={{ background: C.primary, color: "#fff", textAlign: "left", padding: "11px 12px", fontWeight: 700, fontSize: 12.5 }}>{plain(h)}</th>)}</tr></thead>
            <tbody>{menu.rows.map((r, i) => (
              <tr key={i} style={{ background: i % 2 ? "#fff" : C.light }}>
                {r.map((c, j) => <td key={j} style={{ padding: "11px 12px", borderBottom: "1px solid #dde8d8", verticalAlign: "top", lineHeight: 1.45, fontWeight: j === 0 ? 700 : 400, color: j === 0 ? C.primary : C.text }}>{plain(c)}</td>)}
              </tr>
            ))}</tbody>
          </table>
          <div style={{ marginTop: 16, fontSize: 11, color: C.muted, fontStyle: "italic" }}>📚 Fuentes: Harvard T.H. Chan — The Nutrition Source · Modelo del Plato Saludable de Harvard · OMS. Todas las opciones se preparan en ~15 min.</div>
        </GuidePage>
      )}

      {/* PÁGINA 3 · Metas + Suplementos + Glucosa */}
      <GuidePage footer="Metas · Suplementos · Glucosa">
        <div style={{ fontSize: 21, fontWeight: 800, color: C.primary, marginBottom: 18 }}>🎯 Tus metas y apoyos</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.primary, marginBottom: 10 }}>Metas diarias</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
              {goals.map((g, i) => (
                <div key={i} style={{ background: C.light, borderRadius: 12, padding: "14px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 22 }}>{g.emoji}</div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: C.primary }}>{g.value}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{g.label}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.primary, marginBottom: 10 }}>💊 Suplementos sugeridos</div>
            {supps.map((s, i) => (
              <div key={i} style={{ background: C.light, borderRadius: 10, padding: "9px 12px", marginBottom: 7 }}>
                <span style={{ fontWeight: 700, color: C.primary, fontSize: 13 }}>{s.name}</span>
                {s.reason ? <span style={{ color: C.muted, fontSize: 12 }}> — {s.reason}</span> : null}
              </div>
            ))}
            <div style={{ fontSize: 10.5, color: C.muted, fontStyle: "italic", marginTop: 8 }}>📚 NIH Office of Dietary Supplements · American Thyroid Association. Consulta a tu médico antes de suplementar.</div>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.primary, marginBottom: 10 }}>📈 Evitar picos de glucosa</div>
            {tips.map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 9, marginBottom: 9, fontSize: 12.5, lineHeight: 1.5 }}>
                <span style={{ color: "#e07a5f", flexShrink: 0 }}>●</span><span>{plain(t)}</span>
              </div>
            ))}
            <div style={{ fontSize: 10.5, color: C.muted, fontStyle: "italic", marginTop: 8 }}>📚 Jessie Inchauspé — Glucose Revolution (Glucose Goddess).</div>
          </div>
        </div>
      </GuidePage>

      {/* PÁGINA 4 · Datos + Hábitos */}
      <GuidePage footer="Datos · Hábitos">
        <div style={{ fontSize: 21, fontWeight: 800, color: C.primary, marginBottom: 18 }}>💡 Datos que te ayudan & hábitos diarios</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.primary, marginBottom: 10 }}>¿Sabías que...?</div>
            {facts.map((f, i) => (
              <div key={i} style={{ display: "flex", gap: 9, marginBottom: 9, fontSize: 12.5, lineHeight: 1.5 }}>
                <span style={{ color: C.yellow, flexShrink: 0 }}>★</span><span>{plain(f)}</span>
              </div>
            ))}
            <div style={{ fontSize: 10.5, color: C.muted, fontStyle: "italic", marginTop: 8 }}>📚 Your Brain on Food (Uma Naidoo, MD) · Intuitive Eating (Tribole & Resch).</div>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.primary, marginBottom: 10 }}>✅ Hábitos diarios</div>
            {["Toma tu medicamento/suplementos como te corresponde", "Hidrátate a lo largo del día", "Proteína en cada comida", "Muévete y camina tus pasos", "Duerme 7–9 horas", "Sol por la mañana", "Entrenamiento de fuerza en tu semana", "Verdura presente en comida y cena"].map((h, i) => (
              <div key={i} style={{ display: "flex", gap: 9, marginBottom: 8, fontSize: 12.5, alignItems: "center" }}>
                <span style={{ width: 14, height: 14, border: `1.5px solid ${C.accent}`, borderRadius: 4, display: "inline-block", flexShrink: 0 }} /><span>{h}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 22, background: C.light, borderRadius: 12, padding: "14px 18px", fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
          <strong style={{ color: C.primary }}>Nota:</strong> esta guía es educativa y de organización personal. Acompaña tu tratamiento médico, sin sustituirlo. Cualquier ajuste de medicamento o suplemento se revisa con tu profesional de salud.
        </div>
      </GuidePage>

      {/* PÁGINA · Rutina (si ya se generó) */}
      {routineText && (
        <GuidePage footer="Tu rutina">
          <div style={{ fontSize: 21, fontWeight: 800, color: C.primary, marginBottom: 14 }}>🏋️ Tu rutina de entrenamiento</div>
          <div style={{ columnCount: 2, columnGap: 36, fontSize: 12.5, lineHeight: 1.6 }}>
            {routineText.split("\n").map((ln, i) => {
              const b = ln.replace(/\*\*(.+?)\*\*/g, "$1").trim();
              if (!b) return null;
              if (/^\*\*/.test(ln) || /^d[ií]a/i.test(b)) return <div key={i} style={{ fontWeight: 800, color: C.primary, marginTop: 10, breakInside: "avoid" }}>{b.replace(/^[-•]\s*/, "")}</div>;
              if (/📚/.test(b)) return <div key={i} style={{ fontSize: 10.5, color: C.muted, fontStyle: "italic", marginTop: 10 }}>{b}</div>;
              if (/^[-•]/.test(ln)) return <div key={i} style={{ paddingLeft: 12 }}>• {b.replace(/^[-•]\s*/, "")}</div>;
              return <div key={i}>{b}</div>;
            })}
          </div>
        </GuidePage>
      )}

      {/* PÁGINAS · Ciclo (una por fase) */}
      {showCycle && phaseOrder.map(p => {
        const ph = phases[p]; if (!ph) return null;
        const pm = PHASE_META[p];
        const fields = [["Estado de ánimo", ph.mood], ["Energía", ph.energy], ["Mejores alimentos", ph.foods], ["Entrenamiento", ph.training], ["Sueño", ph.sleep], ["Suplementos", ph.supps]].filter(x => x[1]);
        return (
          <GuidePage key={p} footer={pm.label}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: pm.color, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 22 }}>{p[0]}</div>
              <div>
                <div style={{ fontSize: 23, fontWeight: 800, color: C.primary }}>{pm.label} <span style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>· {pm.days}</span></div>
                {phaseInfo?.phase === p && <span style={{ display: "inline-block", marginTop: 4, fontSize: 11, background: pm.color, color: "#fff", padding: "2px 10px", borderRadius: 20 }}>Tu fase actual</span>}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
              {fields.map((x, i) => (
                <div key={i} style={{ background: pm.soft, borderRadius: 12, padding: "12px 15px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, color: pm.color, marginBottom: 4 }}>{x[0]}</div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.5, color: C.text }}>{plain(x[1])}</div>
                </div>
              ))}
            </div>
            {ph.menu && (
              <div style={{ background: "#faf8f2", borderRadius: 12, padding: "13px 16px", marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.primary, marginBottom: 8 }}>🍽️ Menú sugerido del día</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 28px" }}>
                  {ph.menu.split("|").map(s => s.trim()).filter(Boolean).map((it, i) => {
                    const idx = it.indexOf(":"); const lbl = idx > 0 ? it.slice(0, idx) : ""; const val = idx > 0 ? it.slice(idx + 1) : it;
                    return <div key={i} style={{ fontSize: 12.5, minWidth: "44%", lineHeight: 1.4 }}><strong style={{ color: pm.color }}>{plain(lbl)}:</strong> {plain(val)}</div>;
                  })}
                </div>
              </div>
            )}
            {ph.tip && <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5 }}><strong style={{ color: C.primary }}>💡 Tip:</strong> {plain(ph.tip)}</div>}
          </GuidePage>
        );
      })}
    </div>
  );
}



function calcBodyMetrics(form) {
  let weightKg = parseFloat(form.weight);
  let heightCm = parseFloat(form.height);
  const age = parseFloat(form.age);
  const isMale = form.sex === "masculino";
  if (form.weightUnit === "lbs") weightKg = weightKg * 0.453592;
  if (form.heightUnit === "in") heightCm = heightCm * 2.54;
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  let bmiCategory = "";
  if (bmi < 18.5) bmiCategory = "Bajo peso";
  else if (bmi < 25) bmiCategory = "Peso normal";
  else if (bmi < 30) bmiCategory = "Sobrepeso";
  else bmiCategory = "Obesidad";
  const bmr = isMale
    ? (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5
    : (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;
  const activityMultipliers = { "0": 1.2, "1-2": 1.375, "3-4": 1.55, "5+": 1.725 };
  const tdee = bmr * (activityMultipliers[form.exercise] || 1.375);
  const sexFactor = isMale ? 1 : 0;
  const smm = (0.244 * weightKg) + (7.80 * heightM) - (0.098 * age) + (6.6 * sexFactor) - 3.3;
  const lbm = isMale
    ? (0.407 * weightKg) + (0.267 * heightCm) - 19.2
    : (0.252 * weightKg) + (0.473 * heightCm) - 48.3;
  const fatMass = weightKg - lbm;
  const fatPct = (fatMass / weightKg) * 100;
  const smi = smm / (heightM * heightM);
  return {
    bmi: bmi.toFixed(1), bmiCategory, bmr: Math.round(bmr), tdee: Math.round(tdee),
    smm: Math.max(0, smm).toFixed(1), lbm: Math.max(0, lbm).toFixed(1),
    fatMass: Math.max(0, fatMass).toFixed(1), fatPct: Math.max(0, Math.min(60, fatPct)).toFixed(1),
    smi: Math.max(0, smi).toFixed(1), weightKg: weightKg.toFixed(1), heightCm: heightCm.toFixed(1),
  };
}

function Field({ label, children }) {
  return <div style={{ marginBottom: 14 }}><label style={labelStyle}>{label}</label>{children}</div>;
}

function PrivacyBadge() {
  return (
    <div style={{ ...cardStyle, borderLeft: `4px solid ${C.accent}`, background: C.light, display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ fontSize: 32, flexShrink: 0 }}>🔒</div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, color: C.primary, marginBottom: 4 }}>Tu información es 100% anónima y confidencial</div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
          No almacenamos tu peso, edad, ni ningún dato personal. Toda la información se procesa en el momento y no se guarda en ningún servidor. Nadie más tendrá acceso a tus datos.
        </div>
      </div>
    </div>
  );
}

function MetricCard({ emoji, label, value, sub, explanation }) {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <div style={{ background: C.light, borderRadius: 14, padding: "14px", textAlign: "center" }}>
      <div style={{ fontSize: 24, marginBottom: 4 }}>{emoji}</div>
      <div style={{ fontWeight: 700, fontSize: 20, color: C.primary }}>{value}</div>
      <div style={{ fontSize: 12, color: C.muted }}>{label}</div>
      <div style={{ fontSize: 11, color: C.accent }}>{sub}</div>
      <button onClick={() => setShowInfo(o => !o)} style={{ background: "none", border: "none", color: C.accent, fontSize: 11, cursor: "pointer", padding: "4px 0 0", textDecoration: "underline" }}>
        {showInfo ? "Ocultar" : "¿Qué es esto?"}
      </button>
      {showInfo && <div style={{ fontSize: 11, color: C.muted, marginTop: 4, lineHeight: 1.4 }}>{explanation}</div>}
    </div>
  );
}

function BodyAnalysisCard({ metrics, goal }) {
  const goalIsLoss = goal?.toLowerCase().includes("peso") || goal?.toLowerCase().includes("bajar");
  const goalIsGain = goal?.toLowerCase().includes("músculo") || goal?.toLowerCase().includes("ganar");
  let tdeeAdjusted = metrics.tdee;
  let tdeeNote = "";
  if (goalIsLoss) { tdeeAdjusted = metrics.tdee - 400; tdeeNote = "Déficit moderado de ~400 kcal para pérdida de grasa sostenible"; }
  else if (goalIsGain) { tdeeAdjusted = metrics.tdee + 300; tdeeNote = "Superávit de ~300 kcal para ganancia muscular limpia"; }
  else { tdeeNote = "Mantenimiento calórico para tu nivel de actividad"; }

  const items = [
    { emoji: "⚖️", label: "IMC", value: metrics.bmi, sub: metrics.bmiCategory, explanation: "El Índice de Masa Corporal mide la relación entre tu peso y tu altura para estimar si estás en un rango saludable." },
    { emoji: "🔥", label: "Metabolismo basal", value: `${metrics.bmr}`, sub: "kcal/día", explanation: "Son las calorías que tu cuerpo quema en reposo total, solo para mantenerte vivo (respirar, latir, etc.)." },
    { emoji: "⚡", label: "Gasto total (TDEE)", value: `${metrics.tdee}`, sub: "kcal/día", explanation: "Son las calorías totales que quemas al día incluyendo tu actividad física y ejercicio." },
    { emoji: "💪", label: "Masa muscular", value: `${metrics.smm} kg`, sub: "Fórmula de Lee", explanation: "Es la cantidad estimada de músculo esquelético en tu cuerpo, el que usas para moverte y hacer ejercicio." },
    { emoji: "🦴", label: "Masa magra total", value: `${metrics.lbm} kg`, sub: "Fórmula de Boer", explanation: "Es todo lo que NO es grasa en tu cuerpo: músculos, huesos, órganos y agua." },
    { emoji: "🧈", label: "Masa grasa", value: `${metrics.fatMass} kg`, sub: `${metrics.fatPct}% grasa`, explanation: "Es la cantidad de grasa corporal estimada. Algo de grasa es necesaria para funciones vitales." },
    { emoji: "📐", label: "Índice muscular (SMI)", value: `${metrics.smi}`, sub: "kg/m²", explanation: "Compara tu masa muscular con tu altura. Sirve para saber si tienes suficiente músculo para tu tamaño." },
  ];

  return (
    <div style={{ ...cardStyle, borderLeft: `4px solid ${C.accent}` }}>
      <div style={{ fontWeight: 700, fontSize: 17, color: C.primary, marginBottom: 14 }}>📊 Análisis aproximado de tu cuerpo</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 16 }}>
        {items.map((m, i) => <MetricCard key={i} {...m} />)}
      </div>
      <div style={{ background: C.light, borderRadius: 12, padding: "12px 16px", marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: C.primary }}>🎯 Tu objetivo calórico: ~{Math.round(tdeeAdjusted)} kcal/día</div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{tdeeNote}</div>
      </div>
      <div style={sourceStyle}>
        📚 <strong>Fuentes:</strong> IMC: estándares OMS | Metabolismo basal: Mifflin-St Jeor (1990), <em>Am J Clin Nutr</em> | Masa muscular: Lee RC et al. (2000), <em>Am J Clin Nutr</em> | Masa magra: Boer P. (1984), <em>Am J Physiology</em> | Masa grasa: Heymsfield SB, <em>Human Body Composition</em> | Índice muscular: Janssen I. (2000), <em>J Appl Physiol</em>
      </div>
    </div>
  );
}

function LearnMore({ prompt }) {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const load = async () => {
    if (info) { setOpen(o => !o); return; }
    setOpen(true); setLoading(true);
    try {
      const text = await callAI(`En 3-4 oraciones, explica de manera simple y amigable en español latinoamericano: ${prompt}. Enfócate en los beneficios prácticos para la salud y el bienestar. Usa un lenguaje que cualquier persona entienda.`, 300);
      setInfo(text);
    } catch { setInfo("No se pudo cargar la información. Intenta de nuevo."); }
    setLoading(false);
  };
  return (
    <div style={{ marginTop: 6 }}>
      <button onClick={load} style={{ background: "none", border: "none", color: C.accent, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
        {open ? "▲ Ocultar" : "▼ Saber más"}
      </button>
      {open && (
        <div style={{ marginTop: 6, padding: "10px 14px", background: C.light, borderRadius: 10, fontSize: 14, color: C.text, lineHeight: 1.6 }}>
          {loading ? "Cargando..." : info}
        </div>
      )}
    </div>
  );
}

function FunFact({ facts }) {
  const [idx, setIdx] = useState(0);
  if (!facts || facts.length === 0) return null;
  return (
    <div style={{ ...cardStyle, borderLeft: `4px solid ${C.yellow}`, display: "flex", alignItems: "flex-start", gap: 16 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: C.primary }}>💡 ¿Sabías que...?</div>
        <div style={{ fontSize: 15, lineHeight: 1.7 }}>{facts[idx]}</div>
        <div style={{ ...sourceStyle, marginTop: 12 }}>
          📚 <strong>Fuentes:</strong> Uma Naidoo, MD — <em>Your Brain on Food</em> | Hipócrates: "Toda enfermedad comienza en el intestino" | Evelyn Tribole & Elyse Resch — <em>Intuitive Eating</em>
        </div>
      </div>
      <button onClick={() => setIdx(i => (i + 1) % facts.length)}
        style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 10, padding: "8px 12px", cursor: "pointer", fontSize: 18, flexShrink: 0 }} title="Otro dato">🔀</button>
    </div>
  );
}

function CycleCalendar({ onPhaseCalc }) {
  const [lastPeriod, setLastPeriod] = useState("");
  const [cycleLen, setCycleLen] = useState(28);
  useEffect(() => {
    if (!lastPeriod) return;
    const start = new Date(lastPeriod);
    const today = new Date();
    const diff = Math.floor((today - start) / (1000 * 60 * 60 * 24));
    const dayInCycle = ((diff % cycleLen) + cycleLen) % cycleLen + 1;
    let phase, days;
    if (dayInCycle <= 5) { phase = "Menstrual"; days = `Día ${dayInCycle} de 5`; }
    else if (dayInCycle <= 13) { phase = "Folicular"; days = `Día ${dayInCycle - 5} de 8`; }
    else if (dayInCycle <= 16) { phase = "Ovulatoria"; days = `Día ${dayInCycle - 13} de 3`; }
    else { phase = "Lútea"; days = `Día ${dayInCycle - 16} de ${cycleLen - 16}`; }
    onPhaseCalc({ phase, dayInCycle, days, cycleLen });
  }, [lastPeriod, cycleLen]);
  return (
    <div style={{ background: C.pinkLight, borderRadius: 14, padding: "18px 20px", marginBottom: 14 }}>
      <div style={{ fontWeight: 700, color: C.primary, marginBottom: 10, fontSize: 15 }}>🗓️ Registra tu ciclo</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle}>Primer día de tu última menstruación</label>
          <input type="date" style={inputStyle} value={lastPeriod} onChange={e => setLastPeriod(e.target.value)} max={new Date().toISOString().split("T")[0]} />
        </div>
        <div>
          <label style={labelStyle}>Duración promedio de tu ciclo (días)</label>
          <input type="number" style={inputStyle} value={cycleLen} min={21} max={40} onChange={e => setCycleLen(Number(e.target.value))} />
        </div>
      </div>
    </div>
  );
}

function PhaseBadge({ phase }) {
  const map = { Menstrual: ["🩸", "#e8a0b0"], Folicular: ["🌱", "#a8d8a8"], Ovulatoria: ["🌸", "#f9c784"], Lútea: ["🌙", "#b0b8e8"] };
  const [emoji, color] = map[phase] || ["🔄", "#ccc"];
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: color, borderRadius: 20, padding: "6px 16px", fontWeight: 700, color: C.primary, fontSize: 15 }}>
      {emoji} Actualmente en: Fase {phase}
    </div>
  );
}

function WorkoutRoutineChooser({ userProfile, onRoutine }) {
  const [type, setType] = useState(null);
  const [routine, setRoutine] = useState("");
  const [loading, setLoading] = useState(false);
  const types = ["🏋️ Gimnasio", "🏃 Cardio", "🧘 Pilates", "🏠 En casa", "⚡ HIIT", "🚴 Ciclismo"];
  const fetchRoutine = async (t) => {
    setType(t); setLoading(true); setRoutine("");
    try {
      const text = await callAI(`Crea una rutina semanal de ${t.replace(/[^\w ]/g, "").trim()} en español latinoamericano para alguien que entrena ${userProfile.exercise} días por semana, pesa ${userProfile.weight}${userProfile.weightUnit}, y su meta es: ${userProfile.goal}.\n\nFORMATO OBLIGATORIO: Usa bullet points simples. Para cada día escribe:\n**Día X - [Enfoque]**\n- Ejercicio 1: series × repeticiones (o duración)\n- Ejercicio 2: series × repeticiones (o duración)\n- Descanso entre series: X segundos\n\nIncluye de 4-6 ejercicios por día. Nivel principiante-intermedio.\nAl final agrega una línea: "📚 Basado en lineamientos ACSM (American College of Sports Medicine)"\nSolo la rutina, sin texto introductorio.`, 800);
      setRoutine(text);
      if (onRoutine) onRoutine(text);
    } catch { setRoutine("No se pudo cargar la rutina. Intenta de nuevo."); }
    setLoading(false);
  };
  return (
    <div style={{ ...cardStyle, borderLeft: `4px solid ${C.accent}` }}>
      <div style={{ fontWeight: 700, fontSize: 17, color: C.primary, marginBottom: 12 }}>🏋️ Elige tu estilo de entrenamiento</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {types.map(t => <button key={t} style={btnOutline(type === t)} onClick={() => fetchRoutine(t)}>{t}</button>)}
      </div>
      {loading && <div style={{ color: C.muted, fontSize: 14 }}>⏳ Creando tu rutina...</div>}
      {routine && <div style={{ fontSize: 14, lineHeight: 1.8 }}>{renderText(routine)}</div>}
    </div>
  );
}

function MarkdownTable({ text }) {
  const lines = text.split("\n").filter(l => l.trim());
  const tableLines = lines.filter(l => l.includes("|"));
  if (tableLines.length < 2) return <div style={{ fontSize: 14, lineHeight: 1.7 }}>{text}</div>;
  const parse = l => l.split("|").map(c => c.trim()).filter((c, i, a) => i > 0 && i < a.length - 1);
  const headers = parse(tableLines[0]);
  const rows = tableLines.slice(2).map(parse);
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead><tr>{headers.map((h, i) => <th key={i} style={{ background: C.primary, color: "#fff", padding: "8px 12px", textAlign: "left", fontWeight: 700 }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? C.light : "#fff" }}>
            {row.map((cell, j) => <td key={j} style={{ padding: "8px 12px", borderBottom: "1px solid #dde8d8", color: C.text }}>{cell}</td>)}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function FudnFuelChat({ userProfile }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const examples = [
    "¿Qué es el kéfir y por qué lo debería tomar?",
    "¿Cuántas horas debería dormir?",
    "¿Cuánto café debería tomar y a qué hora?",
    "¿Qué puedo cenar si tengo antojo de dulce?",
    "¿Es malo comer después de las 8pm?",
    "¿Qué snacks saludables puedo comer en la oficina?",
  ];
  const ask = async (q) => {
    const query = q || question;
    if (!query.trim()) return;
    setQuestion(query); setLoading(true); setAnswer("");
    try {
      const text = await callAI(`Eres un coach de bienestar experto. Un usuario con este perfil te hace una pregunta:
- Meta: ${userProfile?.goal || "estar saludable"}
- Edad: ${userProfile?.age || "adulto"}
- Sexo: ${userProfile?.sex || "no especificado"}

Pregunta: "${query}"

Responde en español latinoamericano, de forma simple y amigable en 3-5 oraciones. Al final incluye la fuente o referencia científica de tu respuesta (nombre del estudio, libro, o institución). Formato: "📚 Fuente: [referencia]"`, 400);
      setAnswer(text);
    } catch { setAnswer("No se pudo obtener respuesta. Intenta de nuevo."); }
    setLoading(false);
  };
  return (
    <div style={{ ...cardStyle, borderLeft: `4px solid ${C.accent}` }}>
      <div style={{ fontWeight: 700, fontSize: 17, color: C.primary, marginBottom: 8 }}>💬 Pregúntale a FudnFuel</div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>Hazme cualquier pregunta sobre nutrición, ejercicio o bienestar</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {examples.map((ex, i) => (
          <button key={i} onClick={() => ask(ex)}
            style={{ background: C.light, border: `1px solid #b8ccaa`, borderRadius: 20, padding: "6px 14px", fontSize: 12, color: C.primary, cursor: "pointer", fontWeight: 500 }}>
            {ex}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input style={{ ...inputStyle, flex: 1 }} placeholder="Escribe tu pregunta..."
          value={question} onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === "Enter" && ask()} />
        <button onClick={() => ask()} style={{ ...btnPrimary, padding: "10px 20px", borderRadius: 10 }}>
          {loading ? "..." : "Preguntar"}
        </button>
      </div>
      {loading && <div style={{ color: C.muted, fontSize: 14, marginTop: 12 }}>🔍 Buscando respuesta...</div>}
      {answer && (
        <div style={{ marginTop: 14, padding: "14px 16px", background: C.light, borderRadius: 12, fontSize: 14, lineHeight: 1.7, color: C.text }}>
          {answer}
        </div>
      )}
    </div>
  );
}

function parseAndRenderPlan(planData) {
  const { raw, isFemale, phaseInfo, userProfile, metrics } = planData;
  const sections = [];
  const sectionRegex = /##\s+(.+?)\n([\s\S]*?)(?=\n##\s+|$)/g;
  let match;
  while ((match = sectionRegex.exec(raw)) !== null) {
    sections.push({ title: match[1].trim(), body: match[2].trim() });
  }
  return sections.map((sec, idx) => {
    const t = sec.title.toLowerCase();
    if (t.includes("análisis") || t.includes("analisis") || t.includes("cuerpo")) return null;

    if (t.includes("dieta") || t.includes("alimenta") || t.includes("comida") || t.includes("plan nutri")) return (
      <div key={idx} style={{ ...cardStyle, borderLeft: "4px solid #7bc67e" }}>
        <div style={{ fontWeight: 700, fontSize: 17, color: C.primary, marginBottom: 12 }}>{sec.title}</div>
        <MarkdownTable text={extractTable(sec.body)} />
        {extractNonTable(sec.body) && <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.7 }}>{renderText(extractNonTable(sec.body))}</div>}
        <div style={sourceStyle}>📚 <strong>Fuentes:</strong> Harvard T.H. Chan School of Public Health — The Nutrition Source | Modelo del Plato Saludable de Harvard | OMS — Directrices sobre alimentación saludable</div>
      </div>
    );
    if (t.includes("entrenamiento") || t.includes("ejercicio") || t.includes("rutina")) return (
      <div key={idx}><WorkoutRoutineChooser userProfile={userProfile} onRoutine={planData.onRoutine} /></div>
    );
    if (t.includes("meta") || t.includes("objetivo") || t.includes("diaria") || t.includes("diario")) return (
      <div key={idx} style={{ ...cardStyle, borderLeft: `4px solid ${C.yellow}` }}>
        <div style={{ fontWeight: 700, fontSize: 17, color: C.primary, marginBottom: 12 }}>{sec.title}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
          {parseGoals(sec.body).map((g, i) => (
            <div key={i} style={{ background: C.light, borderRadius: 14, padding: "14px", textAlign: "center" }}>
              <div style={{ fontSize: 26, marginBottom: 4 }}>{g.emoji}</div>
              <div style={{ fontWeight: 700, fontSize: 18, color: C.primary }}>{g.value}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{g.label}</div>
            </div>
          ))}
        </div>
      </div>
    );
    if (t.includes("suplemento") || t.includes("vitamina")) return (
      <div key={idx} style={{ ...cardStyle, borderLeft: `4px solid ${C.yellow}` }}>
        <div style={{ fontWeight: 700, fontSize: 17, color: C.primary, marginBottom: 12 }}>{sec.title}</div>
        <div style={{ fontSize: 14, color: C.muted, marginBottom: 10 }}>💊 Lo que recomendamos según tu información personal:</div>
        {parseSupplements(sec.body).map((s, i) => (
          <div key={i} style={{ background: C.light, borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.primary }}>{s.name}</div>
            <LearnMore prompt={`los beneficios y usos del suplemento/vitamina: ${s.name}`} />
          </div>
        ))}
      </div>
    );
    if (t.includes("glucosa") || t.includes("pico") || t.includes("azúcar") || t.includes("azucar")) return (
      <div key={idx} style={{ ...cardStyle, borderLeft: "4px solid #e07a5f" }}>
        <div style={{ fontWeight: 700, fontSize: 17, color: C.primary, marginBottom: 12 }}>📈 Cómo Evitar Picos de Glucosa</div>
        {parseTips(sec.body).map((tip, i) => (
          <div key={i} style={{ background: C.light, borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
            <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6 }}>📈 {tip}</div>
            <LearnMore prompt={`este consejo para controlar la glucosa según el método de Glucose Goddess (Jessie Inchauspé): "${tip}". Explícalo de forma muy simple.`} />
          </div>
        ))}
        <div style={sourceStyle}>📚 <strong>Fuente:</strong> Jessie Inchauspé — <em>Glucose Revolution</em> (Glucose Goddess) | Principios basados en investigación sobre picos de glucosa y su impacto en energía, antojos y salud metabólica.</div>
      </div>
    );
    if (t.includes("dato") || t.includes("curiosidad") || t.includes("sabías") || t.includes("lección") || t.includes("leccion")) {
      return <FunFact key={idx} facts={parseFacts(sec.body)} />;
    }
    if (t.includes("ciclo") || t.includes("femenin") || t.includes("hormonal")) {
      return (
        <div key={idx} style={{ ...cardStyle, borderLeft: `4px solid ${C.pink}` }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: C.primary, marginBottom: 12 }}>{sec.title}</div>
          {phaseInfo && (
            <div style={{ marginBottom: 16 }}>
              <PhaseBadge phase={phaseInfo.phase} />
              <div style={{ marginTop: 8, fontSize: 13, color: C.muted }}>{phaseInfo.days} de tu ciclo (Día {phaseInfo.dayInCycle} en total)</div>
            </div>
          )}
          <CyclePhaseContent body={sec.body} currentPhase={phaseInfo?.phase} />
        </div>
      );
    }
    return (
      <div key={idx} style={{ ...cardStyle, borderLeft: `4px solid ${C.accent}` }}>
        <div style={{ fontWeight: 700, fontSize: 17, color: C.primary, marginBottom: 10 }}>{sec.title}</div>
        <div style={{ fontSize: 15, lineHeight: 1.8 }}>{renderText(sec.body)}</div>
      </div>
    );
  });
}

function CyclePhaseContent({ body, currentPhase }) {
  const phases = ["Menstrual", "Folicular", "Ovulatoria", "Lútea"];
  const [activePhase, setActivePhase] = useState(currentPhase || "Menstrual");
  const phaseBlocks = {};
  phases.forEach(p => {
    const re = new RegExp(`###\\s+(?:Fase\\s+)?${p}[\\s\\S]*?(?=###\\s+|$)`, "i");
    const m = body.match(re);
    if (m) phaseBlocks[p] = m[0].replace(/###.+\n/, "").trim();
  });
  const phaseEmojis = { Menstrual: "🩸", Folicular: "🌱", Ovulatoria: "🌸", Lútea: "🌙" };
  const phaseDays = { Menstrual: "Días 1–5", Folicular: "Días 6–13", Ovulatoria: "Días 14–16", Lútea: "Días 17–28" };
  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {phases.map(p => (
          <button key={p} onClick={() => setActivePhase(p)} style={{ ...btnOutline(activePhase === p), position: "relative" }}>
            {phaseEmojis[p]} {p}
            {currentPhase === p && <span style={{ position: "absolute", top: -4, right: -4, width: 10, height: 10, background: C.pink, borderRadius: "50%", border: "2px solid white" }} />}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>{phaseDays[activePhase]}</div>
      {phaseBlocks[activePhase]
        ? <div style={{ fontSize: 14, lineHeight: 1.8 }}>{renderText(phaseBlocks[activePhase])}</div>
        : <div style={{ color: C.muted, fontSize: 14 }}>Información de fase no disponible.</div>}
    </div>
  );
}

function renderText(text) {
  if (!text) return null;
  return text.split("\n").map((line, i) => {
    line = line.replace(/\*\*(.+?)\*\*/g, (_, m) => `<strong>${m}</strong>`);
    if (line.startsWith("- ") || line.startsWith("• ") || line.startsWith("· ") || line.startsWith("● ")) return (
      <div key={i} style={{ marginBottom: 6 }}>
        <span dangerouslySetInnerHTML={{ __html: line.replace(/^[-•·●▪▸►]\s*/, "") }} />
      </div>
    );
    if (line.trim() === "") return <div key={i} style={{ height: 5 }} />;
    if (line.startsWith("###")) return <div key={i} style={{ fontWeight: 700, marginTop: 10, marginBottom: 4 }} dangerouslySetInnerHTML={{ __html: line.replace(/###\s*/, "") }} />;
    return <div key={i} dangerouslySetInnerHTML={{ __html: line }} />;
  });
}

function extractTable(text) { return text.split("\n").filter(l => l.includes("|")).join("\n"); }
function extractNonTable(text) { return text.split("\n").filter(l => !l.includes("|")).join("\n").trim(); }
function parseGoals(text) {
  const goals = [];
  const patterns = [
    { re: /(\d[\d,]+)\s*cal/i, label: "Calorías diarias", emoji: "🔥" },
    { re: /(\d+)\s*tazas?/i, label: "Tazas de agua", emoji: "💧" },
    { re: /(\d[\d,]+)\s*pasos?/i, label: "Pasos diarios", emoji: "👣" },
  ];
  patterns.forEach(({ re, label, emoji }) => { const m = text.match(re); if (m) goals.push({ value: m[1].replace(/,/g, ""), label, emoji }); });
  if (goals.length === 0) {
    text.split("\n").filter(l => l.trim() && (l.includes("-") || l.includes(":"))).slice(0, 4).forEach((l, i) => {
      const emojis = ["🔥", "💧", "👣", "⏰"];
      goals.push({ value: l.replace(/^[-•*]\s*/, "").split(":")[1]?.trim() || l.slice(0, 20), label: l.split(":")[0]?.replace(/^[-•*]\s*/, "").trim() || `Meta ${i + 1}`, emoji: emojis[i] });
    });
  }
  return goals;
}
function parseSupplements(text) {
  const lines = text.split("\n").filter(l => l.trim());
  const sups = [];
  lines.forEach(l => {
    const clean = l.replace(/^[-•*·●▪▸►\d.]+\s*/, "").replace(/\*\*/g, "").trim();
    if (clean.length > 2 && clean.length < 80) {
      const name = clean.split(":")[0].split("–")[0].split("-")[0].trim();
      if (name) sups.push({ name });
    }
  });
  return sups.slice(0, 8);
}
function parseTips(text) {
  return text.split("\n").filter(l => l.trim() && (l.startsWith("-") || l.startsWith("•") || l.startsWith("*") || l.startsWith("·") || /^\d+\./.test(l)))
    .map(l => l.replace(/^[-•*·●▪▸►\d.]+\s*/, "").replace(/\*\*/g, "").trim()).filter(l => l.length > 10).slice(0, 8);
}
function parseFacts(text) {
  return text.split("\n").filter(l => l.trim() && (l.startsWith("-") || l.startsWith("•") || l.startsWith("·") || /^\d+\./.test(l)))
    .map(l => l.replace(/^[-•*·●▪▸►\d.]+\s*/, "").replace(/\*\*/g, "").trim()).filter(l => l.length > 20);
}

export default function App() {
  const [form, setForm] = useState({
    age: "", weight: "", weightUnit: "kg", height: "", heightUnit: "cm",
    sex: "", goal: "", diet: "", exercise: "", water: "", allergies: "", conditions: "",
  });
  const [loading, setLoading] = useState(false);
  const [planData, setPlanData] = useState(null);
  const [phaseInfo, setPhaseInfo] = useState(null);
  const [error, setError] = useState("");
  const [includeCycle, setIncludeCycle] = useState(true);
  const [routineText, setRoutineText] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isFemale = form.sex === "femenino";

  const femaleNow = !!planData?.isFemale;
  const needsPeriodForPdf = femaleNow && includeCycle && !phaseInfo;
  const exportGuidePDF = async () => {
    setPdfError(""); setPdfLoading(true);
    try { await renderGuideToPdf("pdf-guide", `FudnFuel-guia-${new Date().toISOString().slice(0, 10)}.pdf`); }
    catch { setPdfError("No se pudo generar el PDF. Intenta de nuevo."); }
    setPdfLoading(false);
  };

  const handleSubmit = async () => {
    const required = ["age", "weight", "height", "sex", "goal", "diet", "exercise", "water"];
    for (let k of required) { if (!form[k]) { setError("Por favor completa todos los campos obligatorios."); return; } }
    setError(""); setLoading(true); setPlanData(null);
    const metrics = calcBodyMetrics(form);
    const goalIsLoss = form.goal?.toLowerCase().includes("peso") || form.goal?.toLowerCase().includes("bajar");
    const wantsSnacks = form.goal?.toLowerCase().includes("músculo") || form.goal?.toLowerCase().includes("ganar") || /energ[ií]a/i.test(form.goal || "");

    const prompt = `Eres un nutricionista profesional, entrenador personal y coach de bienestar. Genera un plan de bienestar personalizado y completo. Responde TODO en español latinoamericano, con un tono cálido, motivador y cercano.

FORMATO CRÍTICO E INDISPENSABLE: cada sección DEBE empezar con "## " (dos numerales seguidos de un espacio) y su título en la MISMA línea, tal como se indica abajo. Dentro de las tablas usa el formato markdown con "|". No uses ningún otro estilo de encabezado. Si no respetas este formato, la respuesta no sirve.

PERFIL DEL USUARIO:
- Edad: ${form.age} | Sexo: ${form.sex}
- Peso: ${form.weight} ${form.weightUnit} (${metrics.weightKg} kg) | Altura: ${form.height} ${form.heightUnit} (${metrics.heightCm} cm)
- Meta: ${form.goal}
- Dieta actual: ${form.diet}
- Ejercicio por semana: ${form.exercise}
- Agua diaria: ${form.water} tazas
- Alergias: ${form.allergies || "Ninguna"}
- Condiciones de salud: ${form.conditions || "Ninguna"}

MÉTRICAS YA CALCULADAS (NO las recalcules, solo interprétalas):
- IMC: ${metrics.bmi} (${metrics.bmiCategory})
- Metabolismo basal (Mifflin-St Jeor): ${metrics.bmr} kcal/día
- TDEE: ${metrics.tdee} kcal/día
- Masa muscular esquelética (Lee, 2000): ${metrics.smm} kg
- Masa magra total (Boer, 1984): ${metrics.lbm} kg
- Masa grasa: ${metrics.fatMass} kg (${metrics.fatPct}%)
- Índice muscular SMI (Janssen, 2000): ${metrics.smi} kg/m²

Genera las siguientes secciones usando ## para los encabezados principales:

## 📊 Análisis de tu cuerpo
Escribe 2-3 oraciones motivacionales interpretando sus métricas. NO recalcules, solo interpreta para su meta de forma alentadora y sin juicios.

## 🍽️ Plan de Alimentación Personalizado
Proporciona una tabla markdown con columnas: Comida | Opción A | Opción B | Opción C | Calorías aprox.
Incluye filas para: Desayuno, Comida y Cena${wantsSnacks ? ", más 1 o 2 Meriendas (porque su meta requiere más energía/volumen)" : " (tres comidas completas, sin meriendas)"}. Cada comida debe ser un platillo completo.
REGLAS:
- Cada opción debe ser un PLATILLO COMPLETO, concreto y apetecible que combine 2-4 alimentos que van bien juntos, con porción aproximada (ejemplo de formato: "Omelette de 2 huevos con espinaca, ½ aguacate y queso panela"). NUNCA pongas ingredientes sueltos al azar ni combinaciones raras (evita cosas como "leche entera + cucharada de crema de cacahuate").
- ADAPTA cada platillo al perfil de ESTA persona: su meta (${form.goal}), lo que describió que come ("${form.diet}"), sus alergias (${form.allergies || "Ninguna"}) y condiciones (${form.conditions || "Ninguna"}). Usa alimentos realistas y apetecibles para ese perfil.
- DESAYUNO: platillos con proteína, grasa buena y fibra. ${goalIsLoss ? "Evita jugos, pan, cereales, avena y carbohidratos simples." : "Modera los carbohidratos simples."}
- Opciones FÁCILES y rápidas de preparar (máximo 15 min)
- 3 opciones variadas por comida
- Respeta alergias: ${form.allergies || "Ninguna"}
- CENA: No carbohidratos simples. Proteína + vegetales.
- Nota sobre objetivo calórico: ~${Math.round(goalIsLoss ? metrics.tdee - 400 : metrics.tdee)} kcal/día

## 🏋️ Plan de Entrenamiento
Solo escribe: "¡Usa los botones abajo para elegir tu estilo de entrenamiento favorito y recibir tu rutina personalizada!"

## 📈 Metas Diarias
Lista estos tres puntos:
- Ingesta calórica diaria: ${Math.round(goalIsLoss ? metrics.tdee - 400 : metrics.tdee)} calorías
- Meta de agua diaria: ${form.water === "8+" ? "10" : "8"} tazas
- Meta de pasos diarios: ${form.exercise === "0" ? "6000" : form.exercise === "1-2" ? "8000" : "10000"} pasos

## 💊 Suplementos y Vitaminas
Lista 5-6 suplementos/vitaminas personalizados, uno por línea con este formato exacto: "Nombre — razón breve de por qué lo necesita". Ejemplo: "Vitamina D3 — apoya tus defensas y el ánimo si te falta sol".

## 📈 Cómo Evitar Picos de Glucosa
Basándote en Jessie Inchauspé (Glucose Goddess / "Glucose Revolution"), lista 6 consejos prácticos:
- MUY simple, como explicándole a un amigo
- 1-2 oraciones cada uno
- Incluye: vinagre antes de comer, comer vegetales primero, vestir los carbohidratos, caminar después de comer, desayuno salado, no comer dulce con el estómago vacío

## 💡 Datos Curiosos y Micro-Lecciones
Lista exactamente 10 datos curiosos MEZCLADOS en orden aleatorio (no agrupes por tema). DEBE incluir:
- 2 datos sobre la conexión intestino-cerebro (basados en "Your Brain on Food" de Uma Naidoo, MD). En uno menciona que Hipócrates dijo "Toda enfermedad comienza en el intestino" hace más de 2000 años.
- 1 dato sobre alimentación intuitiva (basado en "Intuitive Eating" de Evelyn Tribole y Elyse Resch): reconectar con las señales de hambre y saciedad, sin dietas restrictivas.
- 7 datos generales variados y sorprendentes sobre nutrición, ejercicio, sueño, hidratación, metabolismo, salud mental o curiosidades del cuerpo humano.
IMPORTANTE: Mezcla todos en orden aleatorio. Cada dato 1-2 oraciones, lenguaje simple.

${isFemale ? `## 🌸 Guía del Ciclo Femenino
Proporciona orientación DETALLADA para cada fase. Usa ### para cada nombre de fase exactamente como está escrito. Para CADA fase incluye TODOS estos aspectos:
IMPORTANTE para el "Menú del día": escribe PLATILLOS COMPLETOS, específicos y apetecibles (ejemplo de formato: "Omelette de 2 huevos con espinaca, ½ aguacate y queso panela"), NUNCA ingredientes sueltos al azar ni combinaciones raras. Adáptalos al perfil de la persona: su meta (${form.goal}), lo que describió que come ("${form.diet}") y sus alergias (${form.allergies || "Ninguna"}), y usa alimentos apropiados para cada fase. Prioriza proteína, grasa buena y fibra.

### Fase Menstrual (Días 1–5)
- **Estado de ánimo:** cómo te podrías sentir emocionalmente
- **Energía:** nivel de energía esperado
- **Mejores alimentos:** lista 4-5 alimentos específicos y por qué ayudan
- **Entrenamiento:** tipo e intensidad recomendada
- **Sueño:** consejos específicos para dormir mejor en esta fase
- **Suplementos:** 2-3 suplementos clave
- **Tip general:** un consejo poderoso para esta fase
- **Menú del día:** Desayuno: [platillo específico y apetecible con 2-4 alimentos que combinen y porción] | Comida: [platillo específico con proteína, verdura y porción] | Cena: [platillo ligero específico]${wantsSnacks ? " | Snack: [snack concreto]" : ""}

### Fase Folicular (Días 6–13)
- **Estado de ánimo:** cómo te podrías sentir emocionalmente
- **Energía:** nivel de energía esperado
- **Mejores alimentos:** lista 4-5 alimentos específicos y por qué ayudan
- **Entrenamiento:** tipo e intensidad recomendada
- **Sueño:** consejos específicos para dormir mejor en esta fase
- **Suplementos:** 2-3 suplementos clave
- **Tip general:** un consejo poderoso para esta fase
- **Menú del día:** Desayuno: [platillo específico y apetecible con 2-4 alimentos que combinen y porción] | Comida: [platillo específico con proteína, verdura y porción] | Cena: [platillo ligero específico]${wantsSnacks ? " | Snack: [snack concreto]" : ""}

### Fase Ovulatoria (Días 14–16)
- **Estado de ánimo:** cómo te podrías sentir emocionalmente
- **Energía:** nivel de energía esperado
- **Mejores alimentos:** lista 4-5 alimentos específicos y por qué ayudan
- **Entrenamiento:** tipo e intensidad recomendada
- **Sueño:** consejos específicos para dormir mejor en esta fase
- **Suplementos:** 2-3 suplementos clave
- **Tip general:** un consejo poderoso para esta fase
- **Menú del día:** Desayuno: [platillo específico y apetecible con 2-4 alimentos que combinen y porción] | Comida: [platillo específico con proteína, verdura y porción] | Cena: [platillo ligero específico]${wantsSnacks ? " | Snack: [snack concreto]" : ""}

### Fase Lútea (Días 17–28)
- **Estado de ánimo:** cómo te podrías sentir emocionalmente
- **Energía:** nivel de energía esperado
- **Mejores alimentos:** lista 4-5 alimentos específicos y por qué ayudan
- **Entrenamiento:** tipo e intensidad recomendada
- **Sueño:** consejos específicos para dormir mejor en esta fase
- **Suplementos:** 2-3 suplementos clave
- **Tip general:** un consejo poderoso para esta fase
- **Menú del día:** Desayuno: [platillo específico y apetecible con 2-4 alimentos que combinen y porción] | Comida: [platillo específico con proteína, verdura y porción] | Cena: [platillo ligero específico]${wantsSnacks ? " | Snack: [snack concreto]" : ""}` : ""}

Termina con un mensaje motivacional corto y cálido personalizado para su situación (sin encabezado ##).`;

    // Reintenta si la IA responde sin el formato de secciones (## ...)
    let text = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const t = await callAI(prompt, 3500);
        if (t && t.includes("## ")) { text = t; break; }
      } catch { /* reintentar */ }
    }
    if (text && text.includes("## ")) {
      setPlanData({ raw: text, isFemale, phaseInfo, userProfile: form, metrics });
    } else {
      setError("La IA respondió incompleto. Espera unos segundos y vuelve a intentar. 🙏");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (planData && phaseInfo) setPlanData(p => ({ ...p, phaseInfo }));
  }, [phaseInfo]);

  const goals = ["🏃 Bajar de peso", "💚 Estar saludable", "💪 Ganar músculo", "⚡ Más energía", "😴 Dormir mejor", "🎯 Otro"];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Segoe UI', system-ui, sans-serif", padding: "24px 16px" }}>
      <div style={{ maxWidth: 660, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 48, marginBottom: 6 }}>🥝</div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, color: C.primary, letterSpacing: -1 }}>FudnFuel Plan</h1>
          <p style={{ margin: "8px 0 0", color: C.muted, fontSize: 15 }}>Tu punto de partida personalizado para comer mejor y moverte más</p>
        </div>

        {!planData && !loading && (
          <>
            <PrivacyBadge />
            <div style={cardStyle}>
              <div style={{ fontWeight: 800, fontSize: 18, color: C.primary, marginBottom: 18 }}>📋 Cuéntanos sobre ti</div>
              <Field label="¿Cuál es tu meta principal? *">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {goals.map(g => <button key={g} onClick={() => set("goal", g)} style={{ ...btnOutline(form.goal === g), borderRadius: 20, padding: "7px 16px", fontSize: 14 }}>{g}</button>)}
                </div>
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <Field label="Edad *"><input style={inputStyle} type="number" placeholder="ej. 28" value={form.age} onChange={e => set("age", e.target.value)} /></Field>
                <Field label="Sexo *">
                  <select style={inputStyle} value={form.sex} onChange={e => set("sex", e.target.value)}>
                    <option value="">Selecciona...</option>
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                    <option value="otro">Otro / Prefiero no decir</option>
                  </select>
                </Field>
              </div>
              <Field label="Peso *">
                <div style={{ display: "flex", gap: 8 }}>
                  <input style={{ ...inputStyle, flex: 1 }} type="number" placeholder="ej. 70" value={form.weight} onChange={e => set("weight", e.target.value)} />
                  <select style={{ ...inputStyle, width: 80 }} value={form.weightUnit} onChange={e => set("weightUnit", e.target.value)}>
                    <option value="kg">kg</option><option value="lbs">lbs</option>
                  </select>
                </div>
              </Field>
              <Field label="Altura *">
                <div style={{ display: "flex", gap: 8 }}>
                  <input style={{ ...inputStyle, flex: 1 }} type="number" placeholder="ej. 165" value={form.height} onChange={e => set("height", e.target.value)} />
                  <select style={{ ...inputStyle, width: 80 }} value={form.heightUnit} onChange={e => set("heightUnit", e.target.value)}>
                    <option value="cm">cm</option><option value="in">in</option>
                  </select>
                </div>
              </Field>
              <Field label="Describe tu dieta actual *">
                <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
                  placeholder="ej. Como mucha comida rápida, me salto el desayuno, tomo refresco todos los días..."
                  value={form.diet} onChange={e => set("diet", e.target.value)} />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <Field label="Sesiones de ejercicio por semana *">
                  <select style={inputStyle} value={form.exercise} onChange={e => set("exercise", e.target.value)}>
                    <option value="">Selecciona...</option>
                    <option value="0">0 – No hago ejercicio</option>
                    <option value="1-2">1–2 (principiante)</option>
                    <option value="3-4">3–4 (intermedio)</option>
                    <option value="5+">5+ (activo)</option>
                  </select>
                </Field>
                <Field label="Tazas de agua al día *">
                  <select style={inputStyle} value={form.water} onChange={e => set("water", e.target.value)}>
                    <option value="">Selecciona...</option>
                    <option value="1-2">1–2 (muy poco)</option>
                    <option value="3-4">3–4</option>
                    <option value="5-6">5–6</option>
                    <option value="7-8">7–8</option>
                    <option value="8+">8+</option>
                  </select>
                </Field>
              </div>
              <Field label="Alergias o intolerancias alimentarias">
                <input style={inputStyle} placeholder="ej. lactosa, nueces, gluten..." value={form.allergies} onChange={e => set("allergies", e.target.value)} />
              </Field>
              <Field label="Condiciones de salud relevantes">
                <input style={inputStyle} placeholder="ej. SOP, diabetes, hipertensión, tiroides..." value={form.conditions} onChange={e => set("conditions", e.target.value)} />
              </Field>
              {error && <div style={{ color: "#c0392b", fontSize: 13, marginBottom: 10, fontWeight: 600 }}>⚠️ {error}</div>}
              <button style={{ ...btnPrimary, width: "100%", padding: "14px", fontSize: 16, borderRadius: 14, marginTop: 4 }} onClick={handleSubmit}>
                ✨ Generar mi FudnFuel Plan
              </button>
              <p style={{ fontSize: 12, color: C.muted, textAlign: "center", marginTop: 10 }}>Solo con fines informativos. Consulta a un profesional de salud antes de hacer cambios importantes.</p>
            </div>
          </>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: "70px 20px" }}>
            <div style={{ fontSize: 52, animation: "spin 1.5s linear infinite", display: "inline-block" }}>🥝</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: C.primary, marginTop: 16 }}>Creando tu FudnFuel Plan...</div>
            <div style={{ fontSize: 14, color: C.muted, marginTop: 6 }}>Analizando tu perfil y personalizando tu plan</div>
            <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {planData && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <div style={{ fontSize: 40 }}>🧘</div>
              <h2 style={{ margin: "8px 0 4px", color: C.primary, fontWeight: 800 }}>¡Tu FudnFuel Plan está listo!</h2>
              <p style={{ color: C.muted, fontSize: 14 }}>Personalizado para tu meta: {planData.userProfile?.goal}</p>
            </div>

            {/* Descargar guía PDF diseñada */}
            <div style={{ ...cardStyle, borderLeft: `4px solid ${C.accent}`, textAlign: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: C.primary, marginBottom: 4 }}>📄 Descarga tu guía nutricional</div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>Un PDF horizontal, bonito y listo para imprimir o traer en tu celular.</div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
                <button onClick={exportGuidePDF} disabled={pdfLoading || needsPeriodForPdf}
                  title={needsPeriodForPdf ? "Registra tu periodo abajo para incluir el cycle syncing" : ""}
                  style={{ ...btnPrimary, opacity: (pdfLoading || needsPeriodForPdf) ? 0.55 : 1, cursor: (pdfLoading || needsPeriodForPdf) ? "default" : "pointer" }}>
                  {pdfLoading ? "⏳ Generando PDF..." : "⬇️ Descargar guía PDF"}
                </button>
                {femaleNow && (
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600, color: C.primary, background: "#fff", border: "1.5px solid #b8ccaa", borderRadius: 12, padding: "9px 14px", cursor: "pointer" }}>
                    <input type="checkbox" checked={includeCycle} onChange={e => setIncludeCycle(e.target.checked)} style={{ accentColor: C.primary, width: 16, height: 16 }} />
                    Incluir menú por fase del ciclo
                  </label>
                )}
              </div>
              {femaleNow && (
                <div style={{ fontSize: 12, color: needsPeriodForPdf ? "#b5732b" : C.muted, marginTop: 10 }}>
                  {needsPeriodForPdf
                    ? "🗓️ Para incluir el cycle syncing, primero registra la fecha de tu periodo y la duración de tu ciclo aquí abajo."
                    : "Tu guía agrega una página por fase del ciclo (menstrual, folicular, ovulatoria y lútea) con su menú."}
                </div>
              )}
              {pdfError && <div style={{ color: "#c0392b", fontSize: 13, marginTop: 10, fontWeight: 600 }}>⚠️ {pdfError}</div>}
            </div>

            {planData.isFemale && <CycleCalendar onPhaseCalc={setPhaseInfo} />}
            <BodyAnalysisCard metrics={planData.metrics} goal={planData.userProfile?.goal} />
            {parseAndRenderPlan({ ...planData, phaseInfo, onRoutine: setRoutineText })}

            <PdfGuide planData={{ ...planData, phaseInfo, routineText }} includeCycle={includeCycle} />

            <FudnFuelChat userProfile={planData.userProfile} />

            <div style={{ ...cardStyle, background: C.primary, textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>⭐️</div>
              <div style={{ color: "#fff", fontSize: 15, lineHeight: 1.7 }}>
                Recuerda: los pequeños pasos constantes llevan a grandes resultados. ¡Tu camino FudnFuel empieza hoy!
              </div>
            </div>

            <button style={{ ...btnPrimary, width: "100%", borderRadius: 14, padding: 14, fontSize: 15, marginBottom: 32 }}
              onClick={() => { setPlanData(null); setPhaseInfo(null); setRoutineText(""); setPdfError(""); setForm({ age:"",weight:"",weightUnit:"kg",height:"",heightUnit:"cm",sex:"",goal:"",diet:"",exercise:"",water:"",allergies:"",conditions:"" }); }}>
              🔄 Empezar de nuevo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
