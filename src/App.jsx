import { useState, useEffect } from "react";

// ============================================================
// FudnFuel Plan v30 — App principal
// Cambios: Fórmulas Lee/Hume, desayunos sin frutas/high carbs,
// sources visibles, rutinas en bullets, aviso privacidad,
// Glucose Goddess, brain-gut, intuitive eating, más variedad comidas
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

// ---- Helper: llama a tu API serverless ----
async function callAI(prompt, maxTokens = 2000) {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, maxTokens }),
  });
  if (!res.ok) throw new Error("Error al generar respuesta");
  const data = await res.json();
  return data.text || "";
}

// ---- Fórmulas clínicas (calculadas localmente, no por IA) ----
function calcBodyMetrics(form) {
  let weightKg = parseFloat(form.weight);
  let heightCm = parseFloat(form.height);
  const age = parseFloat(form.age);
  const isMale = form.sex === "masculino";

  if (form.weightUnit === "lbs") weightKg = weightKg * 0.453592;
  if (form.heightUnit === "in") heightCm = heightCm * 2.54;

  const heightM = heightCm / 100;

  // IMC (OMS)
  const bmi = weightKg / (heightM * heightM);
  let bmiCategory = "";
  if (bmi < 18.5) bmiCategory = "Bajo peso";
  else if (bmi < 25) bmiCategory = "Peso normal";
  else if (bmi < 30) bmiCategory = "Sobrepeso";
  else bmiCategory = "Obesidad";

  // BMR - Mifflin-St Jeor
  const bmr = isMale
    ? (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5
    : (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;

  // TDEE
  const activityMultipliers = { "0": 1.2, "1-2": 1.375, "3-4": 1.55, "5+": 1.725 };
  const tdee = bmr * (activityMultipliers[form.exercise] || 1.375);

  // 1️⃣ Masa muscular esquelética (SMM) - Fórmula de Lee (2000)
  // Fuente: Lee RC et al., American Journal of Clinical Nutrition, 2000
  const sexFactor = isMale ? 1 : 0;
  const smm = (0.244 * weightKg) + (7.80 * heightM) - (0.098 * age) + (6.6 * sexFactor) - 3.3;

  // 2️⃣ Masa magra total (LBM) - Fórmula de Boer (1984)
  // Fuente: Boer P., American Journal of Physiology, 1984
  const lbm = isMale
    ? (0.407 * weightKg) + (0.267 * heightCm) - 19.2
    : (0.252 * weightKg) + (0.473 * heightCm) - 48.3;

  // 3️⃣ Masa grasa y porcentaje de grasa
  // Fuente: Heymsfield SB., Human Body Composition
  const fatMass = weightKg - lbm;
  const fatPct = (fatMass / weightKg) * 100;

  // 4️⃣ Músculo estimado desde masa magra (verificación cruzada)
  // Fuente: Janssen I., Journal of Applied Physiology
  // Músculo esquelético ≈ 0.50–0.55 × LBM
  const smmFromLbm = 0.52 * lbm;

  // 5️⃣ Índice de músculo esquelético (SMI)
  // Fuente: Janssen I., 2000
  const smi = smm / (heightM * heightM);

  return {
    bmi: bmi.toFixed(1),
    bmiCategory,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    smm: Math.max(0, smm).toFixed(1),
    lbm: Math.max(0, lbm).toFixed(1),
    fatMass: Math.max(0, fatMass).toFixed(1),
    fatPct: Math.max(0, Math.min(60, fatPct)).toFixed(1),
    smmFromLbm: Math.max(0, smmFromLbm).toFixed(1),
    smi: Math.max(0, smi).toFixed(1),
    weightKg: weightKg.toFixed(1),
    heightCm: heightCm.toFixed(1),
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

function BodyAnalysisCard({ metrics, goal }) {
  const goalIsLoss = goal?.toLowerCase().includes("peso") || goal?.toLowerCase().includes("bajar");
  const goalIsGain = goal?.toLowerCase().includes("músculo") || goal?.toLowerCase().includes("ganar");

  let tdeeAdjusted = metrics.tdee;
  let tdeeNote = "";
  if (goalIsLoss) { tdeeAdjusted = metrics.tdee - 400; tdeeNote = "Déficit moderado de ~400 kcal para pérdida de grasa sostenible"; }
  else if (goalIsGain) { tdeeAdjusted = metrics.tdee + 300; tdeeNote = "Superávit de ~300 kcal para ganancia muscular limpia"; }
  else { tdeeNote = "Mantenimiento calórico para tu nivel de actividad"; }

  return (
    <div style={{ ...cardStyle, borderLeft: `4px solid ${C.accent}` }}>
      <div style={{ fontWeight: 700, fontSize: 17, color: C.primary, marginBottom: 14 }}>📊 Análisis de tu cuerpo</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 16 }}>
        {[
          { emoji: "⚖️", label: "IMC", value: metrics.bmi, sub: metrics.bmiCategory },
          { emoji: "🔥", label: "Metabolismo basal", value: `${metrics.bmr}`, sub: "kcal/día" },
          { emoji: "⚡", label: "Gasto total (TDEE)", value: `${metrics.tdee}`, sub: "kcal/día" },
          { emoji: "💪", label: "Masa muscular", value: `${metrics.smm} kg`, sub: "Fórmula de Lee" },
          { emoji: "🦴", label: "Masa magra total", value: `${metrics.lbm} kg`, sub: "Fórmula de Boer" },
          { emoji: "🧈", label: "Masa grasa", value: `${metrics.fatMass} kg`, sub: `${metrics.fatPct}% grasa` },
          { emoji: "📐", label: "Índice muscular (SMI)", value: `${metrics.smi}`, sub: "kg/m²" },
        ].map((m, i) => (
          <div key={i} style={{ background: C.light, borderRadius: 14, padding: "14px", textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{m.emoji}</div>
            <div style={{ fontWeight: 700, fontSize: 20, color: C.primary }}>{m.value}</div>
            <div style={{ fontSize: 12, color: C.muted }}>{m.label}</div>
            <div style={{ fontSize: 11, color: C.accent }}>{m.sub}</div>
          </div>
        ))}
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
      const text = await callAI(
        `En 3-4 oraciones, explica de manera simple y amigable en español latinoamericano: ${prompt}. Enfócate en los beneficios prácticos para la salud y el bienestar. Usa un lenguaje que cualquier persona entienda.`,
        300
      );
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
          <input type="date" style={inputStyle} value={lastPeriod} onChange={e => setLastPeriod(e.target.value)}
            max={new Date().toISOString().split("T")[0]} />
        </div>
        <div>
          <label style={labelStyle}>Duración promedio de tu ciclo (días)</label>
          <input type="number" style={inputStyle} value={cycleLen} min={21} max={40}
            onChange={e => setCycleLen(Number(e.target.value))} />
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

function WorkoutRoutineChooser({ userProfile }) {
  const [type, setType] = useState(null);
  const [routine, setRoutine] = useState("");
  const [loading, setLoading] = useState(false);

  const types = ["🏋️ Gimnasio", "🏃 Cardio", "🧘 Pilates", "🏠 En casa", "⚡ HIIT", "🚴 Ciclismo"];

  const fetchRoutine = async (t) => {
    setType(t); setLoading(true); setRoutine("");
    try {
      const text = await callAI(
        `Crea una rutina semanal de ${t.replace(/[^\w ]/g, "").trim()} en español latinoamericano para alguien que entrena ${userProfile.exercise} días por semana, pesa ${userProfile.weight}${userProfile.weightUnit}, y su meta es: ${userProfile.goal}.

FORMATO OBLIGATORIO: Usa bullet points simples. Para cada día escribe:
**Día X - [Enfoque]**
- Ejercicio 1: series × repeticiones (o duración)
- Ejercicio 2: series × repeticiones (o duración)
- Descanso entre series: X segundos

Incluye de 4-6 ejercicios por día. Nivel principiante-intermedio.
Al final agrega una línea: "📚 Basado en lineamientos ACSM (American College of Sports Medicine)"
Solo la rutina, sin texto introductorio.`,
        800
      );
      setRoutine(text);
    } catch { setRoutine("No se pudo cargar la rutina. Intenta de nuevo."); }
    setLoading(false);
  };

  return (
    <div style={{ ...cardStyle, borderLeft: `4px solid ${C.accent}` }}>
      <div style={{ fontWeight: 700, fontSize: 17, color: C.primary, marginBottom: 12 }}>🏋️ Elige tu estilo de entrenamiento</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {types.map(t => (
          <button key={t} style={btnOutline(type === t)} onClick={() => fetchRoutine(t)}>{t}</button>
        ))}
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
        <thead>
          <tr>{headers.map((h, i) => <th key={i} style={{ background: C.primary, color: "#fff", padding: "8px 12px", textAlign: "left", fontWeight: 700 }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? C.light : "#fff" }}>
              {row.map((cell, j) => <td key={j} style={{ padding: "8px 12px", borderBottom: "1px solid #dde8d8", color: C.text }}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
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

    // Skip AI body analysis — we render our own BodyAnalysisCard
    if (t.includes("análisis") || t.includes("analisis") || t.includes("cuerpo")) return null;

    if (t.includes("dieta") || t.includes("alimenta") || t.includes("comida") || t.includes("plan nutri")) return (
      <div key={idx} style={{ ...cardStyle, borderLeft: "4px solid #7bc67e" }}>
        <div style={{ fontWeight: 700, fontSize: 17, color: C.primary, marginBottom: 12 }}>{sec.title}</div>
        <MarkdownTable text={extractTable(sec.body)} />
        {extractNonTable(sec.body) && <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.7 }}>{renderText(extractNonTable(sec.body))}</div>}
        <div style={sourceStyle}>
          📚 <strong>Fuentes:</strong> Harvard T.H. Chan School of Public Health — The Nutrition Source | Modelo del Plato Saludable de Harvard | OMS — Directrices sobre alimentación saludable
        </div>
      </div>
    );

    if (t.includes("entrenamiento") || t.includes("ejercicio") || t.includes("rutina")) return (
      <div key={idx}><WorkoutRoutineChooser userProfile={userProfile} /></div>
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
        <div style={{ fontWeight: 700, fontSize: 17, color: C.primary, marginBottom: 12 }}>{sec.title}</div>
        {parseTips(sec.body).map((tip, i) => (
          <div key={i} style={{ background: C.light, borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
            <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6 }}>🩸 {tip}</div>
            <LearnMore prompt={`este consejo para controlar la glucosa según el método de Glucose Goddess (Jessie Inchauspé): "${tip}". Explícalo de forma muy simple.`} />
          </div>
        ))}
        <div style={sourceStyle}>
          📚 <strong>Fuente:</strong> Jessie Inchauspé — <em>Glucose Revolution</em> (Glucose Goddess) | Principios basados en investigación sobre picos de glucosa y su impacto en energía, antojos y salud metabólica.
        </div>
      </div>
    );

    if (t.includes("dato") || t.includes("curiosidad") || t.includes("sabías") || t.includes("lección") || t.includes("leccion")) {
      return (
        <div key={idx}>
          <FunFact facts={parseFacts(sec.body)} />
          <div style={sourceStyle}>
            📚 <strong>Fuentes:</strong> Uma Naidoo, MD — <em>Your Brain on Food</em> (conexión intestino-cerebro) | Hipócrates: "Toda enfermedad comienza en el intestino" | Evelyn Tribole & Elyse Resch — <em>Intuitive Eating</em> (alimentación intuitiva)
          </div>
        </div>
      );
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
          <button key={p} onClick={() => setActivePhase(p)}
            style={{ ...btnOutline(activePhase === p), position: "relative" }}>
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
    if (line.startsWith("- ") || line.startsWith("• ")) return (
      <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
        <span style={{ color: C.accent, flexShrink: 0, marginTop: 2 }}>●</span>
        <span dangerouslySetInnerHTML={{ __html: line.slice(2) }} />
      </div>
    );
    if (line.trim() === "") return <div key={i} style={{ height: 5 }} />;
    if (line.startsWith("###")) return <div key={i} style={{ fontWeight: 700, marginTop: 10, marginBottom: 4 }} dangerouslySetInnerHTML={{ __html: line.replace(/###\s*/, "") }} />;
    return <div key={i} dangerouslySetInnerHTML={{ __html: line }} />;
  });
}

function extractTable(text) {
  return text.split("\n").filter(l => l.includes("|")).join("\n");
}
function extractNonTable(text) {
  return text.split("\n").filter(l => !l.includes("|")).join("\n").trim();
}
function parseGoals(text) {
  const goals = [];
  const patterns = [
    { re: /(\d[\d,]+)\s*cal/i, label: "Calorías diarias", emoji: "🔥" },
    { re: /(\d+)\s*tazas?/i, label: "Tazas de agua", emoji: "💧" },
    { re: /(\d[\d,]+)\s*pasos?/i, label: "Pasos diarios", emoji: "👣" },
  ];
  patterns.forEach(({ re, label, emoji }) => {
    const m = text.match(re);
    if (m) goals.push({ value: m[1].replace(/,/g, ""), label, emoji });
  });
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
    const clean = l.replace(/^[-•*\d.]\s*/, "").replace(/\*\*/g, "").trim();
    if (clean.length > 2 && clean.length < 80) {
      const name = clean.split(":")[0].split("–")[0].split("-")[0].trim();
      if (name) sups.push({ name });
    }
  });
  return sups.slice(0, 8);
}
function parseTips(text) {
  return text.split("\n").filter(l => l.trim() && (l.startsWith("-") || l.startsWith("•") || l.startsWith("*") || /^\d+\./.test(l)))
    .map(l => l.replace(/^[-•*\d.]\s*/, "").replace(/\*\*/g, "").trim()).filter(l => l.length > 10).slice(0, 8);
}
function parseFacts(text) {
  return text.split("\n").filter(l => l.trim() && (l.startsWith("-") || l.startsWith("•") || /^\d+\./.test(l)))
    .map(l => l.replace(/^[-•*\d.]\s*/, "").replace(/\*\*/g, "").trim()).filter(l => l.length > 20);
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

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isFemale = form.sex === "femenino";

  const handleSubmit = async () => {
    const required = ["age", "weight", "height", "sex", "goal", "diet", "exercise", "water"];
    for (let k of required) { if (!form[k]) { setError("Por favor completa todos los campos obligatorios."); return; } }
    setError(""); setLoading(true); setPlanData(null);

    const metrics = calcBodyMetrics(form);
    const goalIsLoss = form.goal?.toLowerCase().includes("peso") || form.goal?.toLowerCase().includes("bajar");

    const prompt = `Eres un nutricionista profesional, entrenador personal y coach de bienestar. Genera un plan de bienestar personalizado y completo. Responde TODO en español latinoamericano, con un tono cálido, motivador y cercano.

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
Incluye filas para: Desayuno, Almuerzo, Cena, Merienda AM, Merienda PM.

REGLAS IMPORTANTES PARA LA DIETA:
- DESAYUNO: Prioriza proteínas y grasas saludables. ${goalIsLoss ? "NUNCA incluyas frutas, jugos, pan, cereales, avena ni carbohidratos simples en el desayuno. Opciones: huevos, aguacate, yogurt griego sin azúcar, frutos secos, proteína." : "Limita los carbohidratos simples. Prioriza huevos, aguacate, yogurt griego, frutos secos."}
- Las opciones deben ser FÁCILES y rápidas de preparar (máximo 15 min)
- Da 3 opciones variadas por comida para que el usuario tenga variedad
- Respeta las alergias: ${form.allergies || "Ninguna"}
- CENA: No incluyas carbohidratos simples. Enfócate en proteína + vegetales.
- Nota sobre objetivo calórico: ~${Math.round(goalIsLoss ? metrics.tdee - 400 : metrics.tdee)} kcal/día

## 🏋️ Plan de Entrenamiento
Solo escribe: "¡Usa los botones abajo para elegir tu estilo de entrenamiento favorito y recibir tu rutina personalizada!"

## 📈 Metas Diarias
Lista estos tres puntos claramente:
- Ingesta calórica diaria: ${Math.round(goalIsLoss ? metrics.tdee - 400 : metrics.tdee)} calorías
- Meta de agua diaria: ${form.water === "8+" ? "10" : "8"} tazas
- Meta de pasos diarios: ${form.exercise === "0" ? "6000" : form.exercise === "1-2" ? "8000" : "10000"} pasos

## 💊 Suplementos y Vitaminas
Lista 5-6 nombres de suplementos/vitaminas personalizados para este perfil (uno por línea, como punto de lista). Solo el nombre, sin descripción.

## 🩸 Cómo Evitar Picos de Glucosa
Basándote en los principios de Jessie Inchauspé (Glucose Goddess / "Glucose Revolution"), lista 6 consejos prácticos:
- Escrito de forma MUY simple, como explicándole a un amigo
- 1-2 oraciones máximo cada uno
- Incluye: vinagre antes de comer, comer vegetales primero, vestir los carbohidratos, caminar después de comer, desayuno salado, no comer dulce con el estómago vacío

## 💡 Datos Curiosos y Micro-Lecciones
Lista exactamente 8 datos curiosos. DEBE incluir:
- 2 datos sobre la conexión intestino-cerebro (basados en "Your Brain on Food" de Uma Naidoo, MD). Menciona que Hipócrates dijo "Toda enfermedad comienza en el intestino" hace más de 2000 años.
- 1 dato sobre alimentación intuitiva (basado en "Intuitive Eating" de Evelyn Tribole y Elyse Resch): reconectar con las señales de hambre y saciedad, sin dietas restrictivas.
- 5 datos más sobre nutrición o movimiento relevantes para la meta del usuario.
Cada dato 1-2 oraciones, lenguaje simple.

${isFemale ? `## 🌸 Guía del Ciclo Femenino
Proporciona orientación específica para cada fase. Usa ### para cada nombre de fase exactamente como está escrito:

### Fase Menstrual (Días 1–5)
- **Energía:** qué esperar
- **Mejores alimentos:** lista 4-5 alimentos específicos y por qué
- **Entrenamiento:** tipo e intensidad recomendada
- **Suplementos:** 2-3 suplementos clave
- **Consejo:** un tip poderoso para esta fase

### Fase Folicular (Días 6–13)
- **Energía:** qué esperar
- **Mejores alimentos:** lista 4-5 alimentos específicos y por qué
- **Entrenamiento:** tipo e intensidad recomendada
- **Suplementos:** 2-3 suplementos clave
- **Consejo:** un tip poderoso para esta fase

### Fase Ovulatoria (Días 14–16)
- **Energía:** qué esperar
- **Mejores alimentos:** lista 4-5 alimentos específicos y por qué
- **Entrenamiento:** tipo e intensidad recomendada
- **Suplementos:** 2-3 suplementos clave
- **Consejo:** un tip poderoso para esta fase

### Fase Lútea (Días 17–28)
- **Energía:** qué esperar
- **Mejores alimentos:** lista 4-5 alimentos específicos y por qué
- **Entrenamiento:** tipo e intensidad recomendada
- **Suplementos:** 2-3 suplementos clave
- **Consejo:** un tip poderoso para esta fase` : ""}

Termina con un mensaje motivacional corto y cálido personalizado para su situación (sin encabezado ##).`;

    try {
      const text = await callAI(prompt, 3500);
      setPlanData({ raw: text, isFemale, phaseInfo, userProfile: form, metrics });
    } catch { setError("Algo salió mal. Por favor intenta de nuevo."); }
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
                  {goals.map(g => (
                    <button key={g} onClick={() => set("goal", g)}
                      style={{ ...btnOutline(form.goal === g), borderRadius: 20, padding: "7px 16px", fontSize: 14 }}>{g}</button>
                  ))}
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
            <div style={{ textAlign: "center", marginBottom: 22 }}>
              <div style={{ fontSize: 40 }}>🧘</div>
              <h2 style={{ margin: "8px 0 4px", color: C.primary, fontWeight: 800 }}>¡Tu FudnFuel Plan está listo!</h2>
              <p style={{ color: C.muted, fontSize: 14 }}>Personalizado para tu meta: {planData.userProfile?.goal}</p>
            </div>

            {planData.isFemale && <CycleCalendar onPhaseCalc={setPhaseInfo} />}

            {/* Análisis corporal con métricas calculadas localmente */}
            <BodyAnalysisCard metrics={planData.metrics} goal={planData.userProfile?.goal} />

            {parseAndRenderPlan({ ...planData, phaseInfo })}

            <div style={{ ...cardStyle, background: C.primary, textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>⭐️</div>
              <div style={{ color: "#fff", fontSize: 15, lineHeight: 1.7 }}>
                Recuerda: los pequeños pasos constantes llevan a grandes resultados. ¡Tu camino FudnFuel empieza hoy!
              </div>
            </div>

            <button style={{ ...btnPrimary, width: "100%", borderRadius: 14, padding: 14, fontSize: 15, marginBottom: 32 }}
              onClick={() => { setPlanData(null); setPhaseInfo(null); setForm({ age:"",weight:"",weightUnit:"kg",height:"",heightUnit:"cm",sex:"",goal:"",diet:"",exercise:"",water:"",allergies:"",conditions:"" }); }}>
              🔄 Empezar de nuevo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
