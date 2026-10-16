import { useEffect, useState } from "react";
import { useReservationSync } from "../context/ReservationContext";
import {
    Plus, Pencil, Trash2, Search, RefreshCw, X, Loader2,
    AlertCircle, CalendarDays, Users, BookOpen, ChevronDown,
    CheckCircle2, Clock, LogIn, LogOut, Save,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Reservation {
    id: number;
    guest_name: string;
    confirmation_number: string;
    phone_number?: string;
    membership_tier?: "None" | "Silver" | "Gold" | "Platinum" | "Diamond";
    check_in_time?: string;
    check_out_time?: string;
    room_type: string;
    arrival_date: string;
    departure_date: string;
    adults: number;
    children: number;
    status: "Confirmed" | "Checked In" | "Checked Out" | "Pending";
    room_rate?: number;
    payment_mode?: string;
    reservation_source?: string;
    billing_option?: string;
}

type FormData = Omit<Reservation, "id">;

const STATUSES = ["Confirmed", "Checked In", "Checked Out", "Pending"] as const;
const ROOM_RATES: Record<string, number> = {
  "Standard Single": 5000,
  "Standard Double": 6500,
  "Deluxe King": 8500,
  "Executive Queen": 9500,
  "Junior Suite": 12000,
  "Ocean Suite": 18000,
  "Penthouse Suite": 35000,
};
const PAYMENT_MODES = ["Credit Card", "Debit Card", "Cash", "UPI", "Bank Transfer"];
const RESERVATION_SOURCES = ["Direct", "Booking.com", "Expedia", "Agoda", "Corporate", "Walk-in"];
const BILLING_OPTIONS = ["Guest Account", "Company Account", "Travel Agent", "Complimentary"];

const ROOM_TYPES = [
    "Standard Single", "Standard Double", "Deluxe King",
    "Executive Queen", "Junior Suite", "Ocean Suite", "Penthouse Suite",
];

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (iso: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
};

const nightsBetween = (a: string, b: string) =>
    Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));

/**
 * Combines a calendar date and an optional time/datetime into a unified Date object.
 * Extracts date (YYYY-MM-DD) from dateVal and time (HH:mm:ss) from timeVal.
 */
const combineDateAndTime = (dateVal: string | Date, timeVal?: string | Date | null, defaultTime = "00:00:00"): Date | null => {
    if (!dateVal) return null;

    // 1. If timeVal is a direct local datetime string from <input type="datetime-local">
    if (typeof timeVal === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(timeVal) && !timeVal.includes("Z")) {
        const [dPart, tPart] = timeVal.split("T");
        let dateStr = "";
        if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
            const pad = (n: number) => String(n).padStart(2, "0");
            dateStr = `${dateVal.getFullYear()}-${pad(dateVal.getMonth() + 1)}-${pad(dateVal.getDate())}`;
        } else if (typeof dateVal === "string") {
            dateStr = dateVal.slice(0, 10);
        }
        const finalDate = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : dPart;
        const [y, m, d] = finalDate.split("-").map(Number);
        const [hh, mm, ss] = tPart.split(":").map(Number);
        const dt = new Date(y, m - 1, d, hh, mm, ss || 0);
        return isNaN(dt.getTime()) ? null : dt;
    }

    // 2. Extract calendar date YYYY-MM-DD from dateVal
    let dateStr = "";
    if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
        const pad = (n: number) => String(n).padStart(2, "0");
        dateStr = `${dateVal.getFullYear()}-${pad(dateVal.getMonth() + 1)}-${pad(dateVal.getDate())}`;
    } else if (typeof dateVal === "string") {
        dateStr = dateVal.slice(0, 10);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;

    // 3. Extract time part
    let timeStr = defaultTime;
    if (timeVal) {
        if (typeof timeVal === "string") {
            const trimmed = timeVal.trim();
            if (trimmed.includes("T") && !trimmed.includes("Z")) {
                const match = trimmed.match(/T(\d{2}):(\d{2})(?::(\d{2}))?/);
                if (match) timeStr = `${match[1]}:${match[2]}:${match[3] || "00"}`;
            } else if (/^\d{1,2}:\d{2}/.test(trimmed)) {
                const parts = trimmed.split(":");
                timeStr = `${parts[0].padStart(2, "0")}:${(parts[1] || "00").padStart(2, "0")}:${((parts[2] || "00").slice(0, 2)).padStart(2, "0")}`;
            } else {
                const d = new Date(trimmed);
                if (!isNaN(d.getTime())) {
                    const pad = (n: number) => String(n).padStart(2, "0");
                    timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
                }
            }
        } else if (timeVal instanceof Date && !isNaN(timeVal.getTime())) {
            const pad = (n: number) => String(n).padStart(2, "0");
            timeStr = `${pad(timeVal.getHours())}:${pad(timeVal.getMinutes())}:${pad(timeVal.getSeconds())}`;
        }
    }

    const [y, m, d] = dateStr.split("-").map(Number);
    const [hh, mm, ss] = timeStr.split(":").map(Number);
    const dt = new Date(y, m - 1, d, hh, mm, ss || 0);
    return isNaN(dt.getTime()) ? null : dt;
};

const formatForDateTimeLocal = (val?: string | null): string => {
    if (!val) return "";
    if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val) && !val.includes("Z")) {
        return val.slice(0, 16);
    }
    try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return "";
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
        return "";
    }
};


const STATUS_META: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
    "Confirmed": { bg: "#e8f4fd", text: "#1a6fa0", border: "#a8cfe8", icon: <CheckCircle2 style={{ width: 11, height: 11 }} /> },
    "Checked In": { bg: "#e6f9f0", text: "#1a7a4a", border: "#9ad8bc", icon: <LogIn style={{ width: 11, height: 11 }} /> },
    "Checked Out": { bg: "#f0f0f0", text: "#555555", border: "#c8c8c8", icon: <LogOut style={{ width: 11, height: 11 }} /> },
    "Pending": { bg: "#fff8e6", text: "#996b00", border: "#f0d080", icon: <Clock style={{ width: 11, height: 11 }} /> },
};

const EMPTY_FORM: FormData = {
    guest_name: "",
    confirmation_number: "",
    phone_number: "",
    membership_tier: "None",
    check_in_time: "",
    check_out_time: "",
    room_type: "Standard Double",
    arrival_date: "",
    departure_date: "",
    adults: 1,
    children: 0,
    status: "Confirmed",
    room_rate: 0,
    payment_mode: "Credit Card",
    reservation_source: "Direct",
    billing_option: "Guest Account",
};

const genConf = () => `CONF-${10000 + Math.floor(Math.random() * 89999)}`;

// ── StatusBadge ────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
    const m = STATUS_META[status] ?? { bg: "#eee", text: "#444", border: "#ccc", icon: null };
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            background: m.bg, color: m.text, border: `1px solid ${m.border}`,
            padding: "3px 9px", borderRadius: 12, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
        }}>
            {m.icon}{status}
        </span>
    );
}

// ── FormField ──────────────────────────────────────────────────────────────────
function FormField({ label, id, children, required }: { label: string; id: string; children: React.ReactNode; required?: boolean }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label htmlFor={id} style={{ fontSize: 11, fontWeight: 600, color: "#5a6a7a", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {label}{required && <span style={{ color: "#c0392b" }}> *</span>}
            </label>
            {children}
        </div>
    );
}

const INP:React.CSSProperties = {
    padding: "8px 11px", border: "1px solid #c8d8e8", borderRadius: 4,
    fontSize: 13, color: "#1a3c5e", outline: "none", width: "100%",
    boxSizing: "border-box", background: "#fff", fontFamily: "'Inter','Segoe UI',sans-serif",
};
const SEL:React.CSSProperties = { ...INP, appearance: "none", cursor: "pointer" };

// ── BookingModal ───────────────────────────────────────────────────────────────
interface ModalProps {
    mode: "add" | "edit";
    initial: FormData;
    saving: boolean;
    error: string | null;
    onClose: () => void;
    onSubmit: (data: FormData) => void;
}

function BookingModal({mode,initial,saving,error,onClose,onSubmit}:ModalProps){
  const [form,setForm]=useState<FormData>(initial);
  const [localError, setLocalError] = useState<string | null>(null);
  const set=(k:keyof FormData,v:string|number)=>setForm(f=>({...f,[k]:v}));

  let lateFee = 0;
  if (form.check_out_time && (form.room_rate || 0) > 0) {
    const coDate = new Date(form.check_out_time);
    const coHour = coDate.getHours() + coDate.getMinutes() / 60;
    const hasPrivilege = ["Gold", "Platinum", "Diamond"].includes(form.membership_tier || "None");
    const graceEnd = hasPrivilege ? 16 : 13;
    if (coHour > graceEnd) {
      if (coHour <= 18) lateFee = (form.room_rate || 0) * 0.5;
      else lateFee = form.room_rate || 0;
    }
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const arrivalDT = combineDateAndTime(form.arrival_date, form.check_in_time, "00:00:00");
    const departureDT = combineDateAndTime(form.departure_date, form.check_out_time, "00:00:00");

    if (!arrivalDT || !departureDT) {
      setLocalError("Please enter valid arrival and departure dates.");
      return;
    }

    if (departureDT.getTime() <= arrivalDT.getTime()) {
      if (form.arrival_date === form.departure_date) {
        setLocalError("For same-day stays, check-out time must be chronologically after check-in time.");
      } else {
        setLocalError("Departure date and time must be chronologically after arrival date and time.");
      }
      return;
    }

    onSubmit(form);
  };

  const displayedError = localError || error;

  return(
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:"fixed",inset:0,background:"rgba(10,25,45,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,backdropFilter:"blur(2px)"}}>
      <div style={{background:"#fff",borderRadius:6,width:"100%",maxWidth:580,boxShadow:"0 20px 60px rgba(0,0,0,0.3)",overflow:"hidden",animation:"slideUp 0.18s ease-out"}}>
        <div style={{background:"linear-gradient(135deg,#1a3c5e,#1a5276)",padding:"16px 22px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <BookOpen style={{color:"#7db8d8",width:18,height:18}}/>
            <span style={{color:"#fff",fontWeight:600,fontSize:14}}>{mode==="add"?"New Reservation":"Edit Reservation"}</span>
          </div>
          <button id="modal-close-btn" onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"#7db8d8",padding:4,display:"flex"}}><X style={{width:18,height:18}}/></button>
        </div>
        <form onSubmit={handleFormSubmit} style={{padding:"22px 24px",display:"flex",flexDirection:"column",gap:16}}>
          {displayedError&&<div style={{background:"#fdf0f0",border:"1px solid #f0a0a0",borderRadius:4,padding:"10px 14px",display:"flex",alignItems:"center",gap:8,fontSize:12,color:"#c0392b"}}><AlertCircle style={{width:14,height:14,flexShrink:0}}/>{displayedError}</div>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <FormField label="Guest Name" id="modal-guest-name" required>
              <input id="modal-guest-name" type="text" required value={form.guest_name} onChange={e=>set("guest_name",e.target.value)} placeholder="Full name" style={INP}/>
            </FormField>
            <FormField label="Confirmation #" id="modal-conf-number">
              <input id="modal-conf-number" type="text" value={form.confirmation_number} onChange={e=>set("confirmation_number",e.target.value)} placeholder="Auto-generated if blank" style={INP}/>
            </FormField>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <FormField label="Room Type" id="modal-room-type" required>
              <div style={{position:"relative"}}>
                <select id="modal-room-type" required value={form.room_type} onChange={e=>{const rt=e.target.value;setForm(f=>({...f,room_type:rt,room_rate:ROOM_RATES[rt]??f.room_rate}));}} style={{...SEL,color:form.room_type?"#1a3c5e":"#9aacbc"}}>
                  <option value="" disabled>Select room type…</option>
                  {ROOM_TYPES.map(rt=><option key={rt} style={{color:"#1a3c5e"}}>{rt}</option>)}
                </select>
                <ChevronDown style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",width:13,height:13,color:"#7a8fa0",pointerEvents:"none"}}/>
              </div>
            </FormField>
            <FormField label="Status" id="modal-status" required>
              <div style={{position:"relative"}}>
                <select id="modal-status" value={form.status} onChange={e=>set("status",e.target.value as FormData["status"])} style={SEL}>
                  {STATUSES.map(s=><option key={s}>{s}</option>)}
                </select>
                <ChevronDown style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",width:13,height:13,color:"#7a8fa0",pointerEvents:"none"}}/>
              </div>
            </FormField>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <FormField label="Arrival Date" id="modal-arrival" required>
              <input id="modal-arrival" type="date" required value={form.arrival_date} onChange={e=>set("arrival_date",e.target.value)} style={INP}/>
            </FormField>
            <FormField label="Departure Date" id="modal-departure" required>
              <input id="modal-departure" type="date" required value={form.departure_date} min={form.arrival_date||undefined} onChange={e=>set("departure_date",e.target.value)} style={INP}/>
            </FormField>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <FormField label="Adults" id="modal-adults" required>
              <div style={{display:"flex"}}>
                <button type="button" onClick={()=>set("adults",Math.max(1,form.adults-1))} style={{padding:"8px 12px",border:"1px solid #c8d8e8",borderRight:"none",borderRadius:"4px 0 0 4px",background:"#f4f7fb",cursor:"pointer",fontSize:16,color:"#1a3c5e"}}>-</button>
                <input id="modal-adults" type="number" min={1} max={10} value={form.adults} onChange={e=>set("adults",Math.max(1,Number(e.target.value)))} style={{...INP,borderRadius:0,textAlign:"center",width:60}}/>
                <button type="button" onClick={()=>set("adults",Math.min(10,form.adults+1))} style={{padding:"8px 12px",border:"1px solid #c8d8e8",borderLeft:"none",borderRadius:"0 4px 4px 0",background:"#f4f7fb",cursor:"pointer",fontSize:16,color:"#1a3c5e"}}>+</button>
              </div>
            </FormField>
            <FormField label="Children" id="modal-children">
              <div style={{display:"flex"}}>
                <button type="button" onClick={()=>set("children",Math.max(0,form.children-1))} style={{padding:"8px 12px",border:"1px solid #c8d8e8",borderRight:"none",borderRadius:"4px 0 0 4px",background:"#f4f7fb",cursor:"pointer",fontSize:16,color:"#1a3c5e"}}>-</button>
                <input id="modal-children" type="number" min={0} max={10} value={form.children} onChange={e=>set("children",Math.max(0,Number(e.target.value)))} style={{...INP,borderRadius:0,textAlign:"center",width:60}}/>
                <button type="button" onClick={()=>set("children",Math.min(10,form.children+1))} style={{padding:"8px 12px",border:"1px solid #c8d8e8",borderLeft:"none",borderRadius:"0 4px 4px 0",background:"#f4f7fb",cursor:"pointer",fontSize:16,color:"#1a3c5e"}}>+</button>
              </div>
            </FormField>
          </div>
          {/* ── Additional fields ── */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <FormField label="Phone Number" id="modal-phone">
              <input id="modal-phone" type="tel" value={form.phone_number||""} onChange={e=>set("phone_number",e.target.value)} style={INP} placeholder="+1 234 567 8900"/>
            </FormField>
            <FormField label="Membership Tier" id="modal-membership">
              <div style={{position:"relative"}}>
                <select id="modal-membership" value={form.membership_tier || "None"} onChange={e=>set("membership_tier",e.target.value)} style={SEL}>
                  {["None", "Silver", "Gold", "Platinum", "Diamond"].map(m=><option key={m} value={m}>{m}</option>)}
                </select>
                <ChevronDown style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",width:13,height:13,color:"#7a8fa0",pointerEvents:"none"}}/>
              </div>
            </FormField>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <FormField label="Check-In Time" id="modal-check-in-time">
              <input id="modal-check-in-time" type="datetime-local" value={formatForDateTimeLocal(form.check_in_time)} onChange={e=>set("check_in_time",e.target.value)} style={INP}/>
            </FormField>
            <FormField label="Check-Out Time" id="modal-check-out-time">
              <input id="modal-check-out-time" type="datetime-local" value={formatForDateTimeLocal(form.check_out_time)} onChange={e=>set("check_out_time",e.target.value)} style={INP}/>
            </FormField>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
            <FormField label="Room Rate (₹/night)" id="modal-room-rate">
              {form.room_type ? (
                <div style={{position:"relative",display:"flex",alignItems:"center"}}>
                  <span style={{position:"absolute",left:8,fontSize:13,color:"#7a8fa0",pointerEvents:"none",lineHeight:1}}>₹</span>
                  <input id="modal-room-rate" type="number" min={0} step={0.01} value={form.room_rate} onChange={e=>set("room_rate",Math.max(0,Number(e.target.value)))} style={{...INP,paddingLeft:22,width:"100%"}}/>
                </div>
              ) : (
                <div style={{height:36,border:"1px dashed #c8d8e8",borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#a0b4c4",background:"#f7fafd"}}>Select a room type first</div>
              )}
            </FormField>
            <FormField label="Payment Mode" id="modal-payment-mode">
              <div style={{position:"relative"}}>
                <select id="modal-payment-mode" value={form.payment_mode} onChange={e=>set("payment_mode",e.target.value as FormData["payment_mode"] || "Credit Card")} style={SEL}>
                  {PAYMENT_MODES.map(m=><option key={m}>{m}</option>)}
                </select>
                <ChevronDown style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",width:13,height:13,color:"#7a8fa0",pointerEvents:"none"}}/>
              </div>
            </FormField>
            <FormField label="Reservation Source" id="modal-res-source">
              <div style={{position:"relative"}}>
                <select id="modal-res-source" value={form.reservation_source} onChange={e=>set("reservation_source",e.target.value as FormData["reservation_source"] || "Direct")} style={SEL}>
                  {RESERVATION_SOURCES.map(s=><option key={s}>{s}</option>)}
                </select>
                <ChevronDown style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",width:13,height:13,color:"#7a8fa0",pointerEvents:"none"}}/>
              </div>
            </FormField>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:14}}>
            <FormField label="Billing Option" id="modal-billing-option">
              <div style={{position:"relative"}}>
                <select id="modal-billing-option" value={form.billing_option} onChange={e=>set("billing_option",e.target.value as FormData["billing_option"] || "Guest Account")} style={SEL}>
                  {BILLING_OPTIONS.map(b=><option key={b}>{b}</option>)}
                </select>
                <ChevronDown style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",width:13,height:13,color:"#7a8fa0",pointerEvents:"none"}}/>
              </div>
            </FormField>
            <div/>
          </div>
          {form.arrival_date&&form.departure_date&&(
            <div style={{background:"#f0f7ff",borderRadius:4,padding:"8px 14px",display:"flex",alignItems:"center",gap:8,fontSize:12,color:"#1a6fa0"}}>
              <CalendarDays style={{width:14,height:14}}/>
              {form.arrival_date === form.departure_date ? (
                <span><strong>Day-Use Stay (Same Day)</strong> · <strong>{form.adults}</strong> adult(s){form.children>0&&<>, <strong>{form.children}</strong> child(ren)</>}</span>
              ) : (
                <span><strong>{nightsBetween(form.arrival_date,form.departure_date)}</strong> night(s) · <strong>{form.adults}</strong> adult(s){form.children>0&&<>, <strong>{form.children}</strong> child(ren)</>}</span>
              )}
            </div>
          )}
          {lateFee > 0 && (
            <div style={{background:"#fff0f0",borderRadius:4,padding:"8px 14px",display:"flex",alignItems:"center",gap:8,fontSize:12,color:"#c0392b"}}>
              <AlertCircle style={{width:14,height:14}}/>
              Late Check-Out Fee: <strong>₹{lateFee.toFixed(2)}</strong> (Added to total)
            </div>
          )}
          <div style={{display:"flex",justifyContent:"flex-end",gap:10,paddingTop:4}}>
            <button id="modal-cancel-btn" type="button" onClick={onClose} style={{padding:"8px 20px",border:"1px solid #c8d8e8",borderRadius:4,background:"#fff",color:"#445566",fontSize:12,fontWeight:500,cursor:"pointer"}}>Cancel</button>
            <button id="modal-save-btn" type="submit" disabled={saving} style={{padding:"8px 24px",border:"none",borderRadius:4,background:saving?"#9db8c8":"#00828A",color:"#fff",fontSize:12,fontWeight:600,cursor:saving?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:7}}>
              {saving?<><Loader2 style={{width:13,height:13,animation:"spin 1s linear infinite"}}/>Saving...</>:<><Save style={{width:13,height:13}}/>{mode==="add"?"Create Reservation":"Save Changes"}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── DeleteDialog ───────────────────────────────────────────────────────────────
function DeleteDialog({ guestName, onConfirm, onCancel, deleting }: { guestName: string; onConfirm: () => void; onCancel: () => void; deleting: boolean }) {
    return (
        <div onClick={(e) => e.target === e.currentTarget && onCancel()} style={{ position: "fixed", inset: 0, background: "rgba(10,25,45,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001, backdropFilter: "blur(2px)" }}>
            <div style={{ background: "#fff", borderRadius: 6, width: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.3)", overflow: "hidden", animation: "slideUp 0.15s ease-out" }}>
                <div style={{ background: "#c0392b", padding: "14px 20px", display: "flex", alignItems: "center", gap: 10 }}>
                    <Trash2 style={{ color: "#fff", width: 16, height: 16 }} />
                    <span style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>Delete Booking</span>
                </div>
                <div style={{ padding: "20px 22px" }}>
                    <p style={{ fontSize: 13, color: "#2c3e50", margin: 0, lineHeight: 1.6 }}>
                        Are you sure you want to permanently delete the booking for <strong>{guestName}</strong>? This action cannot be undone.
                    </p>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
                        <button id="delete-cancel-btn" onClick={onCancel} style={{ padding: "7px 18px", border: "1px solid #c8d8e8", borderRadius: 4, background: "#fff", color: "#445566", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>Cancel</button>
                        <button id="delete-confirm-btn" onClick={onConfirm} disabled={deleting} style={{ padding: "7px 18px", border: "none", borderRadius: 4, background: deleting ? "#e07070" : "#c0392b", color: "#fff", fontSize: 12, fontWeight: 600, cursor: deleting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                            {deleting ? <><Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} />Deleting…</> : "Delete"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── StatCard ───────────────────────────────────────────────────────────────────
function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
    return (
        <div style={{ background: "#fff", border: "1px solid #dce3eb", borderRadius: 5, padding: "12px 18px", display: "flex", flexDirection: "column", gap: 2, borderLeft: `3px solid ${accent}`, minWidth: 120 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: accent }}>{value}</span>
            <span style={{ fontSize: 11, color: "#7a8fa0", fontWeight: 500 }}>{label}</span>
        </div>
    );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function BookingsPage() {
    const { triggerRefresh, refreshToken } = useReservationSync();
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("All");
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState<"add" | "edit">("add");
    const [editTarget, setEditTarget] = useState<Reservation | null>(null);
    const [modalError, setModalError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Reservation | null>(null);
    const [deleting, setDeleting] = useState(false);

    const fetchReservations = async () => {
        setLoading(true); setError(null);
        try {
            const res = await fetch("/api/reservations");
            if (!res.ok) throw new Error(`Server responded with ${res.status}`);
            setReservations(await res.json());
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally { setLoading(false); }
    };

    useEffect(() => { fetchReservations(); }, [refreshToken]);

    const filtered = reservations.filter((r) => {
        const q = searchQuery.toLowerCase();
        return (
            (r.guest_name.toLowerCase().includes(q) || r.confirmation_number.toLowerCase().includes(q) || r.room_type.toLowerCase().includes(q) || r.status.toLowerCase().includes(q)) &&
            (statusFilter === "All" || r.status === statusFilter)
        );
    });

    const countByStatus = (s: string) => reservations.filter((r) => r.status === s).length;

    const openAddModal = () => { setModalMode("add"); setEditTarget(null); setModalError(null); setShowModal(true); };
    const openEditModal = (r: Reservation) => { setModalMode("edit"); setEditTarget(r); setModalError(null); setShowModal(true); };
    const closeModal = () => { setShowModal(false); setModalError(null); };

    const handleModalSubmit = async (data: FormData) => {
        setSaving(true); setModalError(null);
        const payload = { ...data, confirmation_number: (data.confirmation_number as string).trim() || genConf() };
        try {
            const url = modalMode === "add" ? "/api/reservations" : `/api/reservations/${editTarget!.id}`;
            const res = await fetch(url, { method: modalMode === "add" ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message ?? `Server error ${res.status}`);
            await fetchReservations();
            triggerRefresh(); // notify ArrivalsPage to re-fetch
            closeModal();
        } catch (err) { setModalError(err instanceof Error ? err.message : "Unknown error"); }
        finally { setSaving(false); }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/reservations/${deleteTarget.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error(`Server error ${res.status}`);
            setDeleteTarget(null);
            await fetchReservations();
            triggerRefresh(); // notify ArrivalsPage to re-fetch
        } catch { /* keep dialog open */ }
        finally { setDeleting(false); }
    };

    const initialForm: FormData = editTarget
        ? {
            guest_name: editTarget.guest_name,
            confirmation_number: editTarget.confirmation_number,
            phone_number: editTarget.phone_number ?? "",
            membership_tier: editTarget.membership_tier ?? "None",
            check_in_time: editTarget.check_in_time ?? "",
            check_out_time: editTarget.check_out_time ?? "",
            room_type: editTarget.room_type,
            arrival_date: editTarget.arrival_date.slice(0, 10),
            departure_date: editTarget.departure_date.slice(0, 10),
            adults: editTarget.adults,
            children: editTarget.children,
            status: editTarget.status,
            room_rate: editTarget.room_rate ?? 0,
            payment_mode: editTarget.payment_mode ?? "Credit Card",
            reservation_source: editTarget.reservation_source ?? "Direct",
            billing_option: editTarget.billing_option ?? "Guest Account",
        }
        : EMPTY_FORM;


    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f4f6f9", fontFamily: "'Inter','Segoe UI',sans-serif" }}>

            {/* Header */}
            <div style={{ background: "linear-gradient(135deg,#1a3c5e,#1a5276)", padding: "13px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <BookOpen style={{ color: "#7db8d8", width: 18, height: 18 }} />
                    <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>Bookings Management</span>
                    <span style={{ color: "#7db8d8", fontSize: 12 }}>— Grand Oracle Hotel &amp; Resorts</span>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    <button id="refresh-bookings-btn" onClick={fetchReservations} style={{ background: "transparent", border: "1px solid #3a6080", borderRadius: 4, color: "#7db8d8", padding: "5px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                        <RefreshCw style={{ width: 13, height: 13 }} /> Refresh
                    </button>
                    <button id="add-booking-btn" onClick={openAddModal} style={{ background: "#00828A", border: "none", borderRadius: 4, color: "#fff", padding: "6px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600 }}>
                        <Plus style={{ width: 15, height: 15 }} /> New Booking
                    </button>
                </div>
            </div>

            {/* Summary Stats */}
            <div style={{ background: "#fff", borderBottom: "1px solid #dce3eb", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, flexWrap: "wrap" }}>
                <StatCard label="Total Bookings" value={reservations.length} accent="#1a3c5e" />
                <StatCard label="Confirmed" value={countByStatus("Confirmed")} accent="#1a6fa0" />
                <StatCard label="Checked In" value={countByStatus("Checked In")} accent="#1a7a4a" />
                <StatCard label="Checked Out" value={countByStatus("Checked Out")} accent="#555555" />
                <StatCard label="Pending" value={countByStatus("Pending")} accent="#996b00" />
                <div style={{ flex: 1 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Users style={{ width: 14, height: 14, color: "#7a8fa0" }} />
                    <span style={{ fontSize: 12, color: "#7a8fa0" }}>
                        <strong style={{ color: "#1a3c5e" }}>{reservations.reduce((s, r) => s + r.adults + r.children, 0)}</strong> total guests
                    </span>
                </div>
            </div>

            {/* Search & Filter */}
            <div style={{ background: "#fff", borderBottom: "1px solid #dce3eb", padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                <div style={{ position: "relative", flex: 1, maxWidth: 380 }}>
                    <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "#90a0b0" }} />
                    <input id="bookings-search-input" type="text" placeholder="Search by name, confirmation #, room type…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ width: "100%", paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7, border: "1px solid #d0dae5", borderRadius: 4, fontSize: 12, color: "#2c3e50", outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                    {(["All", ...STATUSES] as string[]).map((s) => (
                        <button key={s} id={`filter-${s.replace(/ /g, "-").toLowerCase()}`} onClick={() => setStatusFilter(s)}
                            style={{ padding: "4px 12px", borderRadius: 12, fontSize: 11, fontWeight: 600, cursor: "pointer", border: statusFilter === s ? "none" : "1px solid #d0dae5", background: statusFilter === s ? "#1a3c5e" : "#fff", color: statusFilter === s ? "#fff" : "#445566", transition: "all 0.15s" }}>
                            {s}
                        </button>
                    ))}
                </div>
                <span style={{ fontSize: 12, color: "#7a8fa0", whiteSpace: "nowrap" }}>{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
            </div>

            {/* Table */}
            <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
                {loading ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, gap: 10, color: "#7a8fa0" }}>
                        <Loader2 style={{ width: 20, height: 20, animation: "spin 1s linear infinite" }} />
                        <span style={{ fontSize: 13 }}>Loading bookings…</span>
                    </div>
                ) : error ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, gap: 10, color: "#c0392b" }}>
                        <AlertCircle style={{ width: 20, height: 20 }} />
                        <span style={{ fontSize: 13 }}>Failed to load: {error}</span>
                    </div>
                ) : (
                    <div style={{ background: "#fff", border: "1px solid #dce3eb", borderRadius: 5, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead>
                                <tr style={{ background: "#1a3c5e" }}>
                                    {["Conf. No.", "Guest Name", "Room Type", "Arrival", "Departure", "Nights", "Guests", "Status", "Actions"].map((h) => (
                                        <th key={h} style={{ padding: "11px 14px", textAlign: h === "Actions" ? "center" : "left", color: "#b0cce0", fontWeight: 600, fontSize: 11, letterSpacing: "0.6px", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={9} style={{ textAlign: "center", padding: 48, color: "#90a0b0", fontSize: 13 }}>
                                        No bookings found. <button onClick={openAddModal} style={{ color: "#1a6fa0", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Create one</button>
                                    </td></tr>
                                ) : filtered.map((r, idx) => {
                                    const nights = nightsBetween(r.arrival_date, r.departure_date);
                                    const rowBg = idx % 2 === 0 ? "#fff" : "#f9fbfd";
                                    return (
                                        <tr key={r.id}
                                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f7ff")}
                                            onMouseLeave={(e) => (e.currentTarget.style.background = rowBg)}
                                            style={{ background: rowBg, borderBottom: "1px solid #eaeff5", transition: "background 0.1s" }}>
                                            <td style={{ padding: "10px 14px", color: "#1a6fa0", fontWeight: 600, fontFamily: "monospace", fontSize: 12, whiteSpace: "nowrap" }}>{r.confirmation_number}</td>
                                            <td style={{ padding: "10px 14px", color: "#1a3c5e", fontWeight: 500 }}>{r.guest_name}</td>
                                            <td style={{ padding: "10px 14px", color: "#445566" }}>{r.room_type}</td>
                                            <td style={{ padding: "10px 14px", color: "#445566", whiteSpace: "nowrap" }}>{fmt(r.arrival_date)}</td>
                                            <td style={{ padding: "10px 14px", color: "#445566", whiteSpace: "nowrap" }}>{fmt(r.departure_date)}</td>
                                            <td style={{ padding: "10px 14px", color: nights === 0 ? "#1a6fa0" : "#445566", textAlign: "center", fontWeight: nights === 0 ? 600 : 400, fontSize: nights === 0 ? 11 : 12 }}>{nights === 0 ? "Day Use" : nights}</td>
                                            <td style={{ padding: "10px 14px", color: "#445566", textAlign: "center", whiteSpace: "nowrap" }}>
                                                <span title="Adults" style={{ fontSize: 12 }}>👤 {r.adults}</span>
                                                {r.children > 0 && <span title="Children" style={{ fontSize: 12, marginLeft: 6 }}>🧒 {r.children}</span>}
                                            </td>
                                            <td style={{ padding: "10px 14px" }}><StatusBadge status={r.status} /></td>
                                            <td style={{ padding: "10px 14px", textAlign: "center" }}>
                                                <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                                                    <button id={`edit-booking-${r.id}`} onClick={() => openEditModal(r)} title="Edit"
                                                        style={{ padding: "5px 8px", border: "1px solid #d0dae5", borderRadius: 4, background: "#fff", color: "#1a6fa0", cursor: "pointer", display: "flex", alignItems: "center" }}
                                                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#e8f4fd"; }}
                                                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}>
                                                        <Pencil style={{ width: 13, height: 13 }} />
                                                    </button>
                                                    <button id={`delete-booking-${r.id}`} onClick={() => setDeleteTarget(r)} title="Delete"
                                                        style={{ padding: "5px 8px", border: "1px solid #f0a0a0", borderRadius: 4, background: "#fff", color: "#c0392b", cursor: "pointer", display: "flex", alignItems: "center" }}
                                                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fdf0f0"; }}
                                                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}>
                                                        <Trash2 style={{ width: 13, height: 13 }} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showModal && <BookingModal mode={modalMode} initial={initialForm} saving={saving} error={modalError} onClose={closeModal} onSubmit={handleModalSubmit} />}
            {deleteTarget && <DeleteDialog guestName={deleteTarget.guest_name} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} deleting={deleting} />}

            <style>{`
        @keyframes spin    { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
        </div>
    );
}
