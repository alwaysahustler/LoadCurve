import { useState, useEffect, useCallback } from "react";
import AskAgent from "./AskAgent";
import axios from "axios";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Brush, ReferenceLine
} from "recharts";

const API = import.meta.env.VITE_API_URL || "https://glorious-space-train-qwrx4q9pwrw3xg56-8000.app.github.dev";

const LINES = [
  { key: "demand_met_mw", name: "Demand",  color: "#6C63FF", width: 2.5 },
  { key: "thermal_mw",    name: "Thermal", color: "#E8623A", width: 1.5, dash: "5 3" },
  { key: "solar_mw",      name: "Solar",   color: "#F5A623", width: 2 },
  { key: "wind_mw",       name: "Wind",    color: "#2ECC71", width: 1.5 },
  { key: "hydro_mw",      name: "Hydro",   color: "#3498DB", width: 1.5 },
];

const fmt     = v => `${(v / 1000).toFixed(0)}k`;
const tickLbl = (v, i) => i % 8 === 0 ? v : "";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(15,15,20,0.95)", borderRadius: 10,
      padding: "10px 14px", border: "1px solid #333",
      boxShadow: "0 4px 20px rgba(0,0,0,0.5)", minWidth: 185
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#aaa", marginBottom: 8 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: p.color }}>{p.name}</span>
          <span style={{ color: "#fff", fontWeight: 500 }}>{p.value?.toLocaleString()} MW</span>
        </div>
      ))}
    </div>
  );
};

function CalendarPicker({ availableDates, selectedDate, onChange, label }) {
  const dateSet = new Set(availableDates);
  const sorted   = [...availableDates].sort();
  const earliest = sorted[0]                  ? new Date(sorted[0])                  : new Date();
  const latest   = sorted[sorted.length - 1] ? new Date(sorted[sorted.length - 1]) : new Date();
  const initDate = selectedDate ? new Date(selectedDate) : earliest;

  const [viewYear, setViewYear]   = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const DAYS   = ["Su","Mo","Tu","We","Th","Fr","Sa"];

  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  function isoDate(d) {
    return `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  }
  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y-1); setViewMonth(11); } else setViewMonth(m => m-1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y+1); setViewMonth(0); } else setViewMonth(m => m+1);
  }
  function goEarliest() { setViewYear(earliest.getFullYear()); setViewMonth(earliest.getMonth()); }
  function goLatest()   { setViewYear(latest.getFullYear());   setViewMonth(latest.getMonth()); }

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 14, minWidth: 220 }}>
      <div style={{ fontSize: 11, color: "#888", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <button onClick={prevMonth} style={navBtn}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#ddd" }}>{MONTHS[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} style={navBtn}>›</button>
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        <button onClick={goEarliest} style={{ flex:1, fontSize:10, padding:"3px 0", borderRadius:5, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#666", cursor:"pointer" }}>⟪ Earliest</button>
        <button onClick={goLatest}   style={{ flex:1, fontSize:10, padding:"3px 0", borderRadius:5, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#666", cursor:"pointer" }}>Latest ⟫</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:2, marginBottom:4 }}>
        {DAYS.map(d => <div key={d} style={{ fontSize:10, color:"#555", textAlign:"center", padding:"2px 0" }}>{d}</div>)}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:2 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const iso = isoDate(d);
          const hasData    = dateSet.has(iso);
          const isSelected = iso === selectedDate;
          return (
            <button key={iso} onClick={() => hasData && onChange(iso)} style={{
              padding:"5px 0", borderRadius:6, fontSize:12,
              border: isSelected ? "1px solid #6C63FF" : "1px solid transparent",
              background: isSelected ? "#6C63FF" : hasData ? "rgba(108,99,255,0.15)" : "transparent",
              color: isSelected ? "#fff" : hasData ? "#a99fff" : "#333",
              cursor: hasData ? "pointer" : "default",
              fontWeight: isSelected ? 600 : 400, transition:"all 0.1s",
            }}>{d}</button>
          );
        })}
      </div>
      <div style={{ display:"flex", gap:12, marginTop:10, fontSize:11, color:"#666" }}>
        <span style={{ display:"flex", alignItems:"center", gap:4 }}>
          <span style={{ width:10, height:10, borderRadius:3, background:"rgba(108,99,255,0.3)", display:"inline-block" }} /> Has data
        </span>
        <span style={{ display:"flex", alignItems:"center", gap:4 }}>
          <span style={{ width:10, height:10, borderRadius:3, background:"#333", display:"inline-block" }} /> No data
        </span>
      </div>
    </div>
  );
}

const navBtn = {
  background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)",
  color:"#aaa", borderRadius:6, width:28, height:28,
  cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1,
};

export default function App() {
  const [dates, setDates]       = useState([]);
  const [selected, setSelected] = useState("");
  const [mode, setMode]         = useState("single");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate]     = useState("");
  const [data, setData]         = useState([]);
  const [summary, setSummary]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [hidden, setHidden]     = useState({});

  const availableDates = dates.map(d => d.reading_date);

  useEffect(() => {
    axios.get(`${API}/dates`)
      .then(r => { setDates(r.data); if (r.data.length > 0) setSelected(r.data[0].reading_date); })
      .catch(() => setError("Cannot reach API — check VITE_API_URL"));
  }, []);

  const fetchData = useCallback(async (overrideDate) => {
    const dateToFetch = overrideDate || selected;
    setLoading(true); setError("");
    try {
      const url = mode === "single"
        ? `${API}/load-curve?date=${dateToFetch}`
        : `${API}/load-curve?from=${fromDate}&to=${toDate}`;
      const [curveRes, summaryRes] = await Promise.all([
        axios.get(url),
        mode === "single" ? axios.get(`${API}/summary?date=${dateToFetch}`) : Promise.resolve(null),
      ]);
      setData(curveRes.data);
      setSummary(summaryRes?.data ?? null);
    } catch (e) {
      setError(e.response?.data?.detail ?? "Failed to fetch data");
      setData([]); setSummary(null);
    } finally { setLoading(false); }
  }, [selected, mode, fromDate, toDate]);

  function quickSelect(days) {
    if (!dates.length) return;
    if (days === 0) {
      const d = dates[0].reading_date;
      setMode("single"); setSelected(d);
      setTimeout(() => fetchData(d), 50);
    } else {
      setMode("range");
      const to   = dates[0].reading_date;
      const from = dates[Math.min(days-1, dates.length-1)].reading_date;
      setFromDate(from); setToDate(to);
    }
  }

  function toggleLine(key) { setHidden(h => ({ ...h, [key]: !h[key] })); }

  const StatCard = ({ label, value, unit, highlight }) => (
    <div style={{
      background: highlight ? "rgba(108,99,255,0.15)" : "rgba(255,255,255,0.04)",
      border: `1px solid ${highlight ? "rgba(108,99,255,0.4)" : "rgba(255,255,255,0.08)"}`,
      borderRadius:12, padding:"12px 16px", flex:1, minWidth:110,
    }}>
      <div style={{ fontSize:10, color:"#777", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.05em" }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:600, color: highlight ? "#a99fff" : "#fff" }}>{value?.toLocaleString() ?? "—"}</div>
      <div style={{ fontSize:10, color:"#555", marginTop:2 }}>{unit}</div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#0d0d12", color:"#fff", fontFamily:"system-ui, -apple-system, sans-serif", paddingBottom:"3rem" }}>

      {/* Header */}
      <div style={{ padding:"1.25rem 1.5rem", borderBottom:"1px solid rgba(255,255,255,0.07)", marginBottom:"1.5rem" }}>
        <div style={{ maxWidth:1200, margin:"0 auto" }}>

          {/* Title row */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:8, marginBottom:"1rem" }}>
            <div>
              <h1 style={{ fontSize:19, fontWeight:700, margin:0, letterSpacing:"-0.02em" }}>
                NLDC Grid Dashboard
              </h1>
              <span style={{ fontSize:13, color:"#555" }}>All India SCADA · 15-min intervals</span>
            </div>

            {/* Built by Chandan */}
            <div style={{
              display:"flex", alignItems:"center", gap:8,
              padding:"6px 12px",
              background:"rgba(108,99,255,0.1)",
              border:"1px solid rgba(108,99,255,0.25)",
              borderRadius:20,
            }}>
              <div style={{
                width:28, height:28, borderRadius:"50%",
                background:"linear-gradient(135deg, #6C63FF, #3498DB)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:12, fontWeight:700, color:"#fff", flexShrink:0,
              }}>C</div>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:"#a99fff" }}>Chandan</div>
                <div style={{ fontSize:10, color:"#555" }}>Built this</div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
            {[{ l:"Latest", d:0 }, { l:"7 days", d:7 }, { l:"14 days", d:14 }].map(b => (
              <button key={b.l} onClick={() => quickSelect(b.d)} style={{
                padding:"5px 11px", borderRadius:7,
                background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.11)",
                color:"#bbb", cursor:"pointer", fontSize:12, fontWeight:500,
              }}>{b.l}</button>
            ))}
            <div style={{ width:1, height:20, background:"rgba(255,255,255,0.1)" }} />
            <div style={{ display:"flex", borderRadius:8, overflow:"hidden", border:"1px solid rgba(255,255,255,0.12)" }}>
              {["single","range"].map(m => (
                <button key={m} onClick={() => setMode(m)} style={{
                  padding:"5px 13px", background: mode===m ? "#6C63FF" : "transparent",
                  color: mode===m ? "#fff" : "#777", border:"none",
                  cursor:"pointer", fontSize:12, fontWeight:500,
                }}>{m === "single" ? "Single day" : "Date range"}</button>
              ))}
            </div>
            <button onClick={() => fetchData()} disabled={loading} style={{
              padding:"6px 18px", borderRadius:8,
              background: loading ? "#333" : "#6C63FF", color:"white",
              border:"none", cursor: loading ? "not-allowed" : "pointer",
              fontSize:13, fontWeight:600, marginLeft:4,
            }}>{loading ? "Loading…" : "Load →"}</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1200, margin:"0 auto", padding:"0 1.5rem" }}>

        {/* Calendar + summary */}
        <div style={{ display:"flex", gap:16, marginBottom:24, flexWrap:"wrap" }}>
          {mode === "single" ? (
            <CalendarPicker availableDates={availableDates} selectedDate={selected} onChange={setSelected} label="Select date" />
          ) : (
            <>
              <CalendarPicker availableDates={availableDates} selectedDate={fromDate} onChange={setFromDate} label="From date" />
              <CalendarPicker availableDates={availableDates} selectedDate={toDate}   onChange={setToDate}   label="To date" />
            </>
          )}
          {summary && (
            <div style={{ flex:1, minWidth:280, display:"flex", flexDirection:"column", gap:8 }}>
              <div style={{ display:"flex", gap:8 }}>
                <StatCard label="Peak demand"   value={summary.peak_demand_mw}   unit="MW" highlight />
                <StatCard label="Min demand"    value={summary.min_demand_mw}    unit="MW" />
                <StatCard label="Avg demand"    value={summary.avg_demand_mw}    unit="MW" />
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <StatCard label="Peak solar"    value={summary.peak_solar_mw}    unit="MW" />
                <StatCard label="Peak wind"     value={summary.peak_wind_mw}     unit="MW" />
                <StatCard label="Avg frequency" value={summary.avg_frequency_hz} unit="Hz" />
              </div>
            </div>
          )}
        </div>

        {error && (
          <div style={{ padding:"10px 14px", background:"rgba(220,50,50,0.12)", border:"1px solid rgba(220,50,50,0.3)", borderRadius:8, color:"#ff8888", marginBottom:20, fontSize:13 }}>{error}</div>
        )}

        {data.length > 0 && (
          <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:16, padding:"16px 8px 8px" }}>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", paddingLeft:12, marginBottom:14 }}>
              {LINES.map(l => (
                <button key={l.key} onClick={() => toggleLine(l.key)} style={{
                  display:"flex", alignItems:"center", gap:6, padding:"4px 10px", borderRadius:20,
                  background: hidden[l.key] ? "rgba(255,255,255,0.03)" : `${l.color}22`,
                  border: `1px solid ${hidden[l.key] ? "rgba(255,255,255,0.08)" : l.color}`,
                  color: hidden[l.key] ? "#444" : l.color,
                  cursor:"pointer", fontSize:12, fontWeight:500,
                }}>
                  <span style={{ width:18, height:2, background: hidden[l.key] ? "#444" : l.color, borderRadius:2, display:"inline-block" }} />
                  {l.name}
                </button>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={data} margin={{ top:4, right:20, left:4, bottom:4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="time_slot" tickFormatter={tickLbl} tick={{ fontSize:11, fill:"#444" }} axisLine={{ stroke:"rgba(255,255,255,0.08)" }} tickLine={false} />
                <YAxis tickFormatter={fmt} tick={{ fontSize:11, fill:"#444" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.08)" />
                {LINES.map(l => !hidden[l.key] && (
                  <Line key={l.key} type="monotone" dataKey={l.key} name={l.name}
                    stroke={l.color} strokeWidth={l.width} strokeDasharray={l.dash}
                    dot={false} activeDot={{ r:4, strokeWidth:0 }} />
                ))}
                <Brush dataKey="time_slot" height={26} stroke="rgba(108,99,255,0.35)" fill="rgba(108,99,255,0.06)" travellerWidth={6} tickFormatter={tickLbl} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {data.length === 0 && !loading && !error && (
          <div style={{ textAlign:"center", color:"#333", padding:"5rem 0", fontSize:14 }}>
            <div style={{ fontSize:28, marginBottom:10 }}>⚡</div>
            Select a date from the calendar and click Load
          </div>
        )}

        {/* AI Agent */}
        <AskAgent />
      </div>

      <style>{`
        * { box-sizing: border-box; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.5); }
        @media (max-width: 600px) { h1 { font-size: 15px !important; } }
      `}</style>
    </div>
  );
}