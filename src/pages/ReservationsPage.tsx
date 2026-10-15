import { useEffect, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { useReservationSync } from "../context/ReservationContext";
import RoomAssignmentModal from "../components/RoomAssignmentModal";
import {
  Printer, Eye, Mail, ChevronDown, FileText,
  AlertCircle, Loader2, Search, RefreshCw,
  Plus, Pencil, Trash2, X, Save, CalendarDays,
  CheckCircle2, Clock, LogIn, LogOut, BookOpen, Key,
} from "lucide-react";

interface Reservation {
  id: string | number;
  guest_name: string;
  confirmation_number: string;
  room_type: string;
  arrival_date: string;
  departure_date: string;
  adults: number;
  children: number;
  status: "Confirmed" | "Checked In" | "Checked Out" | "Pending";
  checkInTime?: string;
  checkOutTime?: string;
  check_in_time?: string;
  check_out_time?: string;
  phone_number?: string;
  membership_tier: "None" | "Silver" | "Gold" | "Platinum" | "Diamond";
  room_rate: number;
  payment_mode: "Cash" | "Credit Card" | "Debit Card" | "UPI" | "Bank Transfer" | "Bill to Room" | "Complimentary";
  reservation_source: "Direct" | "OTA" | "Corporate" | "Walk-in" | "Travel Agent" | "Phone";
  billing_option: "Guest Account" | "Company/Corporate" | "Pre-paid" | "Split Billing";
  room_id?: string | number | null;
  room_number?: string | null;
  room_housekeeping_status?: string | null;
  room_maintenance_status?: string | null;
}
type FormData = Omit<Reservation, "id">;
type Destination = "Print" | "Preview" | "Email";

const STATUSES = ["Confirmed", "Checked In", "Checked Out", "Pending"] as const;
const ROOM_TYPES = ["Standard Single","Standard Double","Deluxe King","Executive Queen","Junior Suite","Ocean Suite","Penthouse Suite"];
const ROOM_RATES: Record<string, number> = {
  "Standard Single":  2500,
  "Standard Double":  3500,
  "Deluxe King":      5500,
  "Executive Queen":  6500,
  "Junior Suite":     9000,
  "Ocean Suite":     12000,
  "Penthouse Suite": 25000,
};
const PAYMENT_MODES = ["Cash","Credit Card","Debit Card","UPI","Bank Transfer","Bill to Room","Complimentary"] as const;
const RESERVATION_SOURCES = ["Direct","OTA","Corporate","Walk-in","Travel Agent","Phone"] as const;
const BILLING_OPTIONS = ["Guest Account","Company/Corporate","Pre-paid","Split Billing"] as const;

const formatDate = (iso: string) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US",{month:"2-digit",day:"2-digit",year:"numeric"});
};

const formatDateTime = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};
const nightsBetween = (a:string,b:string) =>
  Math.max(0,Math.round((new Date(b).getTime()-new Date(a).getTime())/86_400_000));

const STATUS_META:Record<string,{bg:string;text:string;border:string;label:string;icon:React.ReactNode}> = {
  "Confirmed":  {bg:"#e8f4fd",text:"#1a6fa0",border:"#a8cfe8",label:"Confirmed",  icon:<CheckCircle2 style={{width:11,height:11}}/>},
  "Checked In": {bg:"#e6f9f0",text:"#1a7a4a",border:"#9ad8bc",label:"Checked In", icon:<LogIn        style={{width:11,height:11}}/>},
  "Checked Out":{bg:"#f0f0f0",text:"#555555",border:"#c8c8c8",label:"Checked Out",icon:<LogOut       style={{width:11,height:11}}/>},
  "Pending":    {bg:"#fff8e6",text:"#996b00",border:"#f0d080",label:"Pending",    icon:<Clock        style={{width:11,height:11}}/>},
};
const EMPTY_FORM:FormData = {guest_name:"",confirmation_number:"",phone_number:"",membership_tier:"None",check_in_time:"",check_out_time:"",room_type:"",arrival_date:"",departure_date:"",adults:1,children:0,status:"Confirmed",room_rate:0,payment_mode:"Credit Card",reservation_source:"Direct",billing_option:"Guest Account"};
const genConf = () => `CONF-${10000+Math.floor(Math.random()*89999)}`;

function StatusBadge({status}:{status:string}){
  const m = STATUS_META[status]??{bg:"#eee",text:"#444",border:"#ccc",icon:null};
  return <span style={{display:"inline-flex",alignItems:"center",gap:5,background:m.bg,color:m.text,border:`1px solid ${m.border}`,padding:"3px 9px",borderRadius:12,fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>{m.icon}{status}</span>;
}

const INP:React.CSSProperties = {padding:"8px 11px",border:"1px solid #c8d8e8",borderRadius:4,fontSize:13,color:"#1a3c5e",outline:"none",width:"100%",boxSizing:"border-box",background:"#fff",fontFamily:"'Inter','Segoe UI',sans-serif"};
const SEL:React.CSSProperties = {...INP,appearance:"none",cursor:"pointer"};

function FormField({label,id,children,required}:{label:string;id:string;children:React.ReactNode;required?:boolean}){
  return (
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      <label htmlFor={id} style={{fontSize:11,fontWeight:600,color:"#5a6a7a",textTransform:"uppercase",letterSpacing:"0.5px"}}>
        {label}{required&&<span style={{color:"#c0392b"}}> *</span>}
      </label>
      {children}
    </div>
  );
}

interface ModalProps{mode:"add"|"edit";initial:FormData;saving:boolean;error:string|null;onClose:()=>void;onSubmit:(d:FormData)=>void;}
function BookingModal({mode,initial,saving,error,onClose,onSubmit}:ModalProps){
  const [form,setForm]=useState<FormData>(initial);
  const set=(k:keyof FormData,v:string|number)=>setForm(f=>({...f,[k]:v}));

  let lateFee = 0;
  if (form.check_out_time && form.room_rate > 0) {
    const coDate = new Date(form.check_out_time);
    const coHour = coDate.getHours() + coDate.getMinutes() / 60;
    const hasPrivilege = ["Gold", "Platinum", "Diamond"].includes(form.membership_tier);
    const graceEnd = hasPrivilege ? 16 : 13;
    if (coHour > graceEnd) {
      if (coHour <= 18) lateFee = form.room_rate * 0.5;
      else lateFee = form.room_rate;
    }
  }

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
        <form onSubmit={e=>{e.preventDefault();onSubmit(form);}} style={{padding:"22px 24px",display:"flex",flexDirection:"column",gap:16}}>
          {error&&<div style={{background:"#fdf0f0",border:"1px solid #f0a0a0",borderRadius:4,padding:"10px 14px",display:"flex",alignItems:"center",gap:8,fontSize:12,color:"#c0392b"}}><AlertCircle style={{width:14,height:14,flexShrink:0}}/>{error}</div>}
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
          {/* ── New fields ── */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <FormField label="Phone Number" id="modal-phone">
              <input id="modal-phone" type="tel" value={form.phone_number||""} onChange={e=>set("phone_number",e.target.value)} style={INP} placeholder="+1 234 567 8900"/>
            </FormField>
            <FormField label="Membership Tier" id="modal-membership">
              <div style={{position:"relative"}}>
                <select id="modal-membership" value={form.membership_tier} onChange={e=>set("membership_tier",e.target.value as FormData["membership_tier"])} style={SEL}>
                  {["None", "Silver", "Gold", "Platinum", "Diamond"].map(m=><option key={m} value={m}>{m}</option>)}
                </select>
                <ChevronDown style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",width:13,height:13,color:"#7a8fa0",pointerEvents:"none"}}/>
              </div>
            </FormField>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <FormField label="Check-In Time" id="modal-check-in-time">
              <input id="modal-check-in-time" type="datetime-local" value={form.check_in_time?new Date(form.check_in_time).toISOString().slice(0,16):""} onChange={e=>set("check_in_time",e.target.value?new Date(e.target.value).toISOString():"")} style={INP}/>
            </FormField>
            <FormField label="Check-Out Time" id="modal-check-out-time">
              <input id="modal-check-out-time" type="datetime-local" value={form.check_out_time?new Date(form.check_out_time).toISOString().slice(0,16):""} onChange={e=>set("check_out_time",e.target.value?new Date(e.target.value).toISOString():"")} style={INP}/>
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
                <select id="modal-payment-mode" value={form.payment_mode} onChange={e=>set("payment_mode",e.target.value as FormData["payment_mode"])} style={SEL}>
                  {PAYMENT_MODES.map(m=><option key={m}>{m}</option>)}
                </select>
                <ChevronDown style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",width:13,height:13,color:"#7a8fa0",pointerEvents:"none"}}/>
              </div>
            </FormField>
            <FormField label="Reservation Source" id="modal-res-source">
              <div style={{position:"relative"}}>
                <select id="modal-res-source" value={form.reservation_source} onChange={e=>set("reservation_source",e.target.value as FormData["reservation_source"])} style={SEL}>
                  {RESERVATION_SOURCES.map(s=><option key={s}>{s}</option>)}
                </select>
                <ChevronDown style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",width:13,height:13,color:"#7a8fa0",pointerEvents:"none"}}/>
              </div>
            </FormField>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:14}}>
            <FormField label="Billing Option" id="modal-billing-option">
              <div style={{position:"relative"}}>
                <select id="modal-billing-option" value={form.billing_option} onChange={e=>set("billing_option",e.target.value as FormData["billing_option"])} style={SEL}>
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
              <strong>{nightsBetween(form.arrival_date,form.departure_date)}</strong> night(s) · <strong>{form.adults}</strong> adult(s){form.children>0&&<>, <strong>{form.children}</strong> child(ren)</>}
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

function DeleteDialog({guestName,onConfirm,onCancel,deleting}:{guestName:string;onConfirm:()=>void;onCancel:()=>void;deleting:boolean}){
  return(
    <div onClick={e=>e.target===e.currentTarget&&onCancel()} style={{position:"fixed",inset:0,background:"rgba(10,25,45,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1001,backdropFilter:"blur(2px)"}}>
      <div style={{background:"#fff",borderRadius:6,width:380,boxShadow:"0 20px 60px rgba(0,0,0,0.3)",overflow:"hidden",animation:"slideUp 0.15s ease-out"}}>
        <div style={{background:"#c0392b",padding:"14px 20px",display:"flex",alignItems:"center",gap:10}}>
          <Trash2 style={{color:"#fff",width:16,height:16}}/><span style={{color:"#fff",fontWeight:600,fontSize:13}}>Delete Reservation</span>
        </div>
        <div style={{padding:"20px 22px"}}>
          <p style={{fontSize:13,color:"#2c3e50",margin:0,lineHeight:1.6}}>Are you sure you want to permanently delete the reservation for <strong>{guestName}</strong>? This action cannot be undone.</p>
          <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:20}}>
            <button id="delete-cancel-btn" onClick={onCancel} style={{padding:"7px 18px",border:"1px solid #c8d8e8",borderRadius:4,background:"#fff",color:"#445566",fontSize:12,fontWeight:500,cursor:"pointer"}}>Cancel</button>
            <button id="delete-confirm-btn" onClick={onConfirm} disabled={deleting} style={{padding:"7px 18px",border:"none",borderRadius:4,background:deleting?"#e07070":"#c0392b",color:"#fff",fontSize:12,fontWeight:600,cursor:deleting?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:6}}>
              {deleting?<><Loader2 style={{width:12,height:12,animation:"spin 1s linear infinite"}}/>Deleting...</>:"Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const RegistrationCardTemplate = ({guests}:{guests:Reservation[]}) => (
  <div style={{fontFamily:"'Georgia',serif"}}>
    {guests.map((g,idx)=>(
      <div key={g.id} style={{pageBreakAfter:idx<guests.length-1?"always":"auto",padding:"48px 56px",minHeight:"100vh",boxSizing:"border-box",display:"flex",flexDirection:"column"}}>
        <div style={{textAlign:"center",borderBottom:"2px solid #1a3c5e",paddingBottom:20,marginBottom:28}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginBottom:6}}>
            <div style={{width:42,height:42,borderRadius:"50%",background:"linear-gradient(135deg,#1a3c5e,#00828A)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{color:"#fff",fontWeight:700,fontSize:18}}>H</span>
            </div>
            <div>
              <div style={{fontSize:22,fontWeight:700,color:"#1a3c5e",letterSpacing:2,textTransform:"uppercase"}}>Grand Oracle Hotel &amp; Resorts</div>
              <div style={{fontSize:11,color:"#666",letterSpacing:3,textTransform:"uppercase"}}>A Member of Oracle Hospitality Collection</div>
            </div>
          </div>
          <div style={{fontSize:11,color:"#777",marginTop:4}}>1 Oracle Boulevard, Austin, TX 78701 | Tel: +1 (512) 555-0100 | reservations@grandoracle.com</div>
        </div>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{display:"inline-block",background:"#1a3c5e",color:"#fff",padding:"6px 32px",fontSize:13,letterSpacing:2,textTransform:"uppercase",fontFamily:"Arial,sans-serif"}}>Guest Registration Card</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0,border:"1px solid #c8d4e0",marginBottom:20}}>
          {[
            {label:"Guest Name",value:g.guest_name},{label:"Confirmation No.",value:g.confirmation_number},
            {label:"Phone Number",value:g.phone_number??"—"},{label:"Membership",value:g.membership_tier??"—"},
            {label:"Arrival Date",value:formatDate(g.arrival_date)},{label:"Departure Date",value:formatDate(g.departure_date)},
            {label:"Check-In Time",value:g.check_in_time?new Date(g.check_in_time).toLocaleString():"—"},{label:"Check-Out Time",value:g.check_out_time?new Date(g.check_out_time).toLocaleString():"—"},
            {label:"Room Type",value:g.room_type},{label:"Reservation Status",value:STATUS_META[g.status]?.label??g.status},
            {label:"Adults",value:String(g.adults)},{label:"Children",value:String(g.children)},
            {label:"Room Rate",value:`₹${g.room_rate?.toLocaleString("en-IN")??"—"} / night`},{label:"Payment Mode",value:g.payment_mode??"—"},
            {label:"Reservation Source",value:g.reservation_source??"—"},{label:"Billing Option",value:g.billing_option??"—"},
          ].map((field,i)=>(
            <div key={i} style={{padding:"10px 16px",borderBottom:"1px solid #dde6ef",borderRight:i%2===0?"1px solid #c8d4e0":"none"}}>
              <div style={{fontSize:9,color:"#7a8fa0",textTransform:"uppercase",letterSpacing:1,marginBottom:2,fontFamily:"Arial,sans-serif"}}>{field.label}</div>
              <div style={{fontSize:14,color:"#1a3c5e",fontWeight:600}}>{field.value}</div>
            </div>
          ))}
        </div>
        <div style={{border:"1px solid #c8d4e0",padding:"14px 16px",marginBottom:24,background:"#f7fafd",fontSize:11,color:"#555",lineHeight:1.7,fontFamily:"Arial,sans-serif"}}>
          <strong style={{color:"#1a3c5e",fontSize:11,textTransform:"uppercase",letterSpacing:1}}>Policies &amp; Terms</strong>
          <p style={{margin:"6px 0 0"}}>Check-in time is 3:00 PM. Check-out time is 12:00 PM. Late check-out may be arranged subject to availability. The hotel is not responsible for valuables left in the room. All rates are in USD and subject to applicable taxes.</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:32,marginTop:"auto",paddingTop:16}}>
          <div><div style={{borderBottom:"1px solid #1a3c5e",marginBottom:6,height:40}}/><div style={{fontSize:10,color:"#777",fontFamily:"Arial,sans-serif",textTransform:"uppercase",letterSpacing:1}}>Guest Signature</div></div>
          <div><div style={{borderBottom:"1px solid #1a3c5e",marginBottom:6,height:40}}/><div style={{fontSize:10,color:"#777",fontFamily:"Arial,sans-serif",textTransform:"uppercase",letterSpacing:1}}>Date</div></div>
        </div>
        <div style={{marginTop:28,textAlign:"center",borderTop:"1px solid #dde6ef",paddingTop:12}}>
          <div style={{fontSize:10,color:"#aaa",fontFamily:"Arial,sans-serif",letterSpacing:1}}>THANK YOU FOR CHOOSING GRAND ORACLE HOTEL &amp; RESORTS</div>
        </div>
      </div>
    ))}
  </div>
);

interface ReservationsPageProps {
  arrivalsOnly?: boolean;
  departuresOnly?: boolean;
}

export default function ReservationsPage({ arrivalsOnly = false, departuresOnly = false }: ReservationsPageProps){
  const { triggerRefresh } = useReservationSync();
  const [reservations,setReservations]=useState<Reservation[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [selectedIds,setSelectedIds]=useState<Set<string | number>>(new Set());
  const [searchQuery,setSearchQuery]=useState("");
  const [selectedTab,setSelectedTab]=useState<"All"|"In-House"|"Arrivals"|"Departures">("All");
  const [arrivalStatusTab,setArrivalStatusTab]=useState<"All"|"Confirmed"|"Pending">("All");
  const [selectedDate,setSelectedDate]=useState<string>("");
  const [template,setTemplate]=useState("Standard Registration Card");
  const [destination,setDestination]=useState<Destination>("Print");
  const [processing,setProcessing]=useState(false);
  const [updatingId,setUpdatingId]=useState<string | number | null>(null);
  const [showModal,setShowModal]=useState(false);
  const [modalMode,setModalMode]=useState<"add"|"edit">("add");
  const [editTarget,setEditTarget]=useState<Reservation|null>(null);
  const [modalError,setModalError]=useState<string|null>(null);
  const [saving,setSaving]=useState(false);
  const [deleteTarget,setDeleteTarget]=useState<Reservation|null>(null);
  const [deleting,setDeleting]=useState(false);

  // Room Assignment Modal state
  const [assignmentTarget, setAssignmentTarget] = useState<Reservation | null>(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);

  const openAssignmentModal = (r: Reservation) => {
    setAssignmentTarget(r);
    setShowAssignmentModal(true);
  };
  const closeAssignmentModal = () => {
    setAssignmentTarget(null);
    setShowAssignmentModal(false);
  };

  const printRef=useRef<HTMLDivElement>(null);
  const handlePrint=useReactToPrint({contentRef:printRef,documentTitle:"Guest Registration Cards",onAfterPrint:()=>setProcessing(false)});

  const fetchReservations=async()=>{
    setLoading(true);setError(null);
    try{
      let url="/api/reservations";
      const params=new URLSearchParams();
      if(selectedDate){
        params.append("date",selectedDate);
        if(arrivalsOnly||selectedTab==="Arrivals")params.append("date_type","arrival");
        else if(departuresOnly||selectedTab==="Departures")params.append("date_type","departure");
        else if(selectedTab==="In-House")params.append("date_type","inhouse");
      }
      if(departuresOnly){
        params.append("status","Checked Out");
      }
      const qs=params.toString();
      if(qs)url+=`?${qs}`;
      const res=await fetch(url);
      if(!res.ok)throw new Error(`Server responded with ${res.status}`);
      setReservations(await res.json());
    }catch(err){setError(err instanceof Error?err.message:"Unknown error");}
    finally{setLoading(false);}
  };
  useEffect(()=>{fetchReservations();},[selectedDate,selectedTab,arrivalsOnly,departuresOnly]);

  // ── Action: Quick Status & Timestamp Updates ───────────────────────────────
  const handleUpdateStatus = async (id: string | number, newStatus: "Checked In" | "Checked Out") => {
    setUpdatingId(id);
    try {
      const nowIso = new Date().toISOString();
      const payload: { status: string; checkInTime?: string; checkOutTime?: string; check_in_time?: string; check_out_time?: string } = { status: newStatus };
      if (newStatus === "Checked In") {
        payload.checkInTime = nowIso;
        payload.check_in_time = nowIso;
      } else if (newStatus === "Checked Out") {
        payload.checkOutTime = nowIso;
        payload.check_out_time = nowIso;
      }

      const res = await fetch(`/api/reservations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Server responded with ${res.status}`);
      }

      await fetchReservations();
      triggerRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update reservation status");
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Strict Filtering ────────────────────────────────────────────────────────
  // Strict Arrivals Filter: Hide "Checked In" and "Checked Out", display only Pending & Confirmed
  const isExpectedArrival = (status: string) => {
    const s = (status || "").toLowerCase().trim().replace(/[\s-_]+/g, "");
    if (s === "checkedin" || s === "checkedout") return false;
    return s === "confirmed" || s === "pending";
  };

  // Strict Departures Filter: Display ONLY guests whose status is "Checked Out"
  const isCheckedOutGuest = (status: string) => {
    const s = (status || "").toLowerCase().trim().replace(/[\s-_]+/g, "");
    return s === "checkedout";
  };

  const baseReservations = arrivalsOnly
    ? reservations.filter(r => isExpectedArrival(r.status))
    : departuresOnly
    ? reservations.filter(r => isCheckedOutGuest(r.status))
    : reservations;

  const statusFiltered = arrivalsOnly && arrivalStatusTab !== "All"
    ? baseReservations.filter(r => r.status.toLowerCase() === arrivalStatusTab.toLowerCase())
    : baseReservations;

  const filtered = statusFiltered.filter(r => {
    const q = searchQuery.toLowerCase();
    return (
      r.guest_name.toLowerCase().includes(q) ||
      r.confirmation_number.toLowerCase().includes(q) ||
      (r.phone_number && r.phone_number.toLowerCase().includes(q)) ||
      r.room_type.toLowerCase().includes(q) ||
      r.status.toLowerCase().includes(q)
    );
  });

  const allSelected=filtered.length>0&&filtered.every(r=>selectedIds.has(r.id));
  const someSelected=filtered.some(r=>selectedIds.has(r.id));
  const selectedGuests=reservations.filter(r=>selectedIds.has(r.id));
  const toggleAll=()=>{if(allSelected){setSelectedIds(p=>{const n=new Set(p);filtered.forEach(r=>n.delete(r.id));return n;});}else{setSelectedIds(p=>{const n=new Set(p);filtered.forEach(r=>n.add(r.id));return n;});}};
  const toggleRow=(id:string | number)=>setSelectedIds(p=>{const n=new Set(p);if(n.has(id)){n.delete(id);}else{n.add(id);}return n;});
  const handleProcess=()=>{if(selectedGuests.length===0)return;setProcessing(true);setTimeout(()=>handlePrint(),80);};
  const destinationIcon={Print:<Printer style={{width:14,height:14}}/>,Preview:<Eye style={{width:14,height:14}}/>,Email:<Mail style={{width:14,height:14}}/>}[destination];

  const openAddModal=()=>{setModalMode("add");setEditTarget(null);setModalError(null);setShowModal(true);};
  const openEditModal=(r:Reservation)=>{setModalMode("edit");setEditTarget(r);setModalError(null);setShowModal(true);};
  const closeModal=()=>{setShowModal(false);setModalError(null);};
  const handleModalSubmit=async(data:FormData)=>{
    setSaving(true);setModalError(null);
    const payload={...data,confirmation_number:(data.confirmation_number as string).trim()||genConf()};
    try{
      const url=modalMode==="add"?"/api/reservations":`/api/reservations/${editTarget!.id}`;
      const res=await fetch(url,{method:modalMode==="add"?"POST":"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const json=await res.json();if(!res.ok)throw new Error(json.message??`Server error ${res.status}`);
      await fetchReservations();triggerRefresh();closeModal();
    }catch(err){setModalError(err instanceof Error?err.message:"Unknown error");}
    finally{setSaving(false);}
  };
  const confirmDelete=async()=>{
    if(!deleteTarget)return;setDeleting(true);
    try{const res=await fetch(`/api/reservations/${deleteTarget.id}`,{method:"DELETE"});if(!res.ok)throw new Error(`Server error ${res.status}`);setSelectedIds(p=>{const n=new Set(p);n.delete(deleteTarget.id);return n;});setDeleteTarget(null);await fetchReservations();triggerRefresh();}
    catch{/* keep dialog */}finally{setDeleting(false);}
  };
  const initialForm:FormData=editTarget?{guest_name:editTarget.guest_name,confirmation_number:editTarget.confirmation_number,phone_number:editTarget.phone_number??"",membership_tier:editTarget.membership_tier??"None",check_in_time:editTarget.check_in_time??"",check_out_time:editTarget.check_out_time??"",room_type:editTarget.room_type,arrival_date:editTarget.arrival_date.slice(0,10),departure_date:editTarget.departure_date.slice(0,10),adults:editTarget.adults,children:editTarget.children,status:editTarget.status,room_rate:editTarget.room_rate??0,payment_mode:editTarget.payment_mode??"Credit Card",reservation_source:editTarget.reservation_source??"Direct",billing_option:editTarget.billing_option??"Guest Account"}:EMPTY_FORM;

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:"#f4f6f9",fontFamily:"'Inter','Segoe UI',sans-serif"}}>
      <div style={{background:"#1a3c5e",padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <FileText style={{color:"#7db8d8",width:18,height:18}}/>
          <span style={{color:"#fff",fontWeight:600,fontSize:14,letterSpacing:"0.3px"}}>
            {arrivalsOnly ? "Expected Arrivals" : departuresOnly ? "Departures" : "Print Registration Cards"}
          </span>
          <span style={{color:"#7db8d8",fontSize:12}}>
            {arrivalsOnly ? "— Arrivals Data Table" : departuresOnly ? "— Departures Data Table (Checked Out)" : "— Reservations"}
          </span>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button id="refresh-reservations-btn" onClick={fetchReservations} style={{background:"transparent",border:"1px solid #3a6080",borderRadius:4,color:"#7db8d8",padding:"4px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontSize:12}}>
            <RefreshCw style={{width:13,height:13}}/> Refresh
          </button>
          {!departuresOnly && (
            <button id="add-reservation-btn" onClick={openAddModal} style={{background:"#00828A",border:"none",borderRadius:4,color:"#fff",padding:"5px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:7,fontSize:12,fontWeight:600}}>
              <Plus style={{width:14,height:14}}/> New Reservation
            </button>
          )}
        </div>
      </div>

      <div style={{background:"#fff",borderBottom:"1px solid #dce3eb",padding:"10px 20px",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
        {departuresOnly ? (
          <div style={{display:"flex",alignItems:"center",gap:6,background:"#fdf2e9",border:"1px solid #f5cba7",borderRadius:4,padding:"5px 12px",fontSize:12,color:"#a04000",fontWeight:600}}>
            <LogOut style={{width:13,height:13}}/>
            <span>Filter: Checked Out Guests</span>
          </div>
        ) : arrivalsOnly ? (
          <div style={{display:"flex",gap:4,background:"#f0f4f8",padding:4,borderRadius:6}}>
            {(["All", "Confirmed", "Pending"] as const).map(t => (
              <button
                key={t}
                onClick={() => setArrivalStatusTab(t)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 4,
                  border: "none",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: arrivalStatusTab === t ? "#fff" : "transparent",
                  color: arrivalStatusTab === t ? "#1a3c5e" : "#7a8fa0",
                  boxShadow: arrivalStatusTab === t ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}
              >
                {t === "All" ? "All Expected" : t}
              </button>
            ))}
          </div>
        ) : (
          <div style={{display:"flex",gap:4,background:"#f0f4f8",padding:4,borderRadius:6}}>
            {(["All","In-House","Arrivals","Departures"] as const).map(t=>(
              <button key={t} onClick={()=>setSelectedTab(t)} style={{padding:"6px 12px",borderRadius:4,border:"none",fontSize:12,fontWeight:600,cursor:"pointer",background:selectedTab===t?"#fff":"transparent",color:selectedTab===t?"#1a3c5e":"#7a8fa0",boxShadow:selectedTab===t?"0 1px 3px rgba(0,0,0,0.1)":"none"}}>{t}</button>
            ))}
          </div>
        )}
        <div style={{position:"relative"}}>
          <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} style={{padding:"7px 10px",border:"1px solid #d0dae5",borderRadius:4,fontSize:12,color:"#1a3c5e",outline:"none"}}/>
        </div>
        <div style={{position:"relative",flex:1,maxWidth:380}}>
          <Search style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",width:14,height:14,color:"#90a0b0"}}/>
          <input id="reservations-search-input" type="text" placeholder="Search by name, confirmation #, phone, room type, status..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
            style={{width:"100%",paddingLeft:32,paddingRight:12,paddingTop:7,paddingBottom:7,border:"1px solid #d0dae5",borderRadius:4,fontSize:12,color:"#2c3e50",outline:"none",boxSizing:"border-box"}}/>
        </div>
        <div style={{fontSize:12,color:"#7a8fa0"}}>
          {filtered.length} record{filtered.length!==1?"s":""}
          {selectedIds.size>0&&<span style={{marginLeft:8,color:"#1a6fa0",fontWeight:600}}>· {selectedIds.size} selected</span>}
        </div>
      </div>

      <div style={{flex:1,overflow:"auto",padding:"16px 20px"}}>
        {loading?(
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:200,gap:10,color:"#7a8fa0"}}>
            <Loader2 style={{width:20,height:20,animation:"spin 1s linear infinite"}}/><span style={{fontSize:13}}>Loading reservations...</span>
          </div>
        ):error?(
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:200,gap:10,color:"#c0392b"}}>
            <AlertCircle style={{width:20,height:20}}/><span style={{fontSize:13}}>Failed to load: {error}</span>
          </div>
        ):(
          <div style={{background:"#fff",border:"1px solid #dce3eb",borderRadius:4,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",overflow:"hidden"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{background:"#1a3c5e"}}>
                  {arrivalsOnly ? (
                    <th style={{padding:"11px 16px",textAlign:"left",color:"#b0cce0",fontWeight:600,fontSize:11,letterSpacing:"0.6px",textTransform:"uppercase",whiteSpace:"nowrap"}}>
                      Room Number
                    </th>
                  ) : (
                    <th style={{width:44,padding:"11px 0 11px 16px",textAlign:"center"}}>
                      <input id="select-all-checkbox" type="checkbox" checked={allSelected} ref={el=>{if(el)el.indeterminate=someSelected&&!allSelected;}} onChange={toggleAll} style={{width:15,height:15,accentColor:"#00828A",cursor:"pointer"}}/>
                    </th>
                  )}
                  {["Conf. No.","Guest Name","Room Type","Arrival","Departure","Nights","Check-In Time","Check-Out Time","Status","Actions"].map(h=>(
                    <th key={h} style={{padding:"11px 14px",textAlign:h==="Actions"?"center":"left",color:"#b0cce0",fontWeight:600,fontSize:11,letterSpacing:"0.6px",textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length===0?(
                  <tr><td colSpan={11} style={{textAlign:"center",padding:48,color:"#90a0b0",fontSize:13}}>
                    {arrivalsOnly ? "No expected arrivals found." : departuresOnly ? "No checked-out departures found." : "No reservations found."}{" "}
                    {!departuresOnly && (
                      <button onClick={openAddModal} style={{color:"#1a6fa0",background:"none",border:"none",cursor:"pointer",fontWeight:600,fontSize:13}}>Create one</button>
                    )}
                  </td></tr>
                ):filtered.map((r,idx)=>{
                  const isSelected=selectedIds.has(r.id);
                  const nights=nightsBetween(r.arrival_date,r.departure_date);
                  const rowBg=isSelected?"#e8f4fd":idx%2===0?"#fff":"#f9fbfd";
                  const checkInVal = r.checkInTime || r.check_in_time;
                  const checkOutVal = r.checkOutTime || r.check_out_time;

                  return(
                    <tr key={r.id} onClick={()=>!arrivalsOnly && toggleRow(r.id)}
                      onMouseEnter={e=>{if(!isSelected && !arrivalsOnly)(e.currentTarget as HTMLTableRowElement).style.background="#f0f7ff";}}
                      onMouseLeave={e=>{if(!isSelected && !arrivalsOnly)(e.currentTarget as HTMLTableRowElement).style.background=rowBg;}}
                      style={{background:rowBg,cursor:arrivalsOnly?"default":"pointer",borderBottom:"1px solid #eaeff5",transition:"background 0.1s"}}>
                      {arrivalsOnly ? (
                        <td
                          id={`room-number-cell-${r.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            openAssignmentModal(r);
                          }}
                          style={{padding:"8px 16px",whiteSpace:"nowrap"}}
                          title="Click to assign room or check in guest"
                        >
                          {r.room_number ? (
                            <button
                              id={`room-assigned-btn-${r.id}`}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openAssignmentModal(r);
                              }}
                              title="Click to view or reassign room"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                background: "#e8f4fd",
                                color: "#1a6fa0",
                                border: "1px solid #a8cfe8",
                                borderRadius: 4,
                                padding: "4px 9px",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#d2e8f9";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "#e8f4fd";
                              }}
                            >
                              <Key style={{width: 12, height: 12, color: "#00828A"}} />
                              <span>Room {r.room_number}</span>
                              <Pencil style={{width: 10, height: 10, marginLeft: 2, opacity: 0.7}} />
                            </button>
                          ) : (
                            <button
                              id={`assign-room-btn-${r.id}`}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openAssignmentModal(r);
                              }}
                              title="Assign physical room number"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                background: "#fff",
                                color: "#00828A",
                                border: "1px dashed #00828A",
                                borderRadius: 4,
                                padding: "4px 10px",
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#e6f9fa";
                                e.currentTarget.style.borderStyle = "solid";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "#fff";
                                e.currentTarget.style.borderStyle = "dashed";
                              }}
                            >
                              <Plus style={{width: 11, height: 11}} />
                              <span>Assign Room</span>
                            </button>
                          )}
                        </td>
                      ) : (
                        <td style={{textAlign:"center",padding:"10px 0 10px 16px"}}>
                          <input id={`row-checkbox-${r.id}`} type="checkbox" checked={isSelected} onChange={()=>toggleRow(r.id)} onClick={e=>e.stopPropagation()} style={{width:15,height:15,accentColor:"#00828A",cursor:"pointer"}}/>
                        </td>
                      )}
                      <td style={{padding:"10px 14px",color:"#1a6fa0",fontWeight:600,fontFamily:"monospace",fontSize:12}}>{r.confirmation_number}</td>
                      <td style={{padding:"10px 14px",color:"#1a3c5e",fontWeight:500}}>{r.guest_name}</td>
                      <td style={{padding:"10px 14px",color:"#445566"}}>{r.room_type}</td>
                      <td style={{padding:"10px 14px",color:"#445566",whiteSpace:"nowrap"}}>{formatDate(r.arrival_date)}</td>
                      <td style={{padding:"10px 14px",color:"#445566",whiteSpace:"nowrap"}}>{formatDate(r.departure_date)}</td>
                      <td style={{padding:"10px 14px",color:"#445566",textAlign:"center"}}>{nights}</td>
                      <td style={{padding:"10px 14px",color:"#445566",whiteSpace:"nowrap",fontSize:12}}>
                        {checkInVal ? (
                          <div style={{display:"flex",alignItems:"center",gap:5,color:"#1a7a4a",fontWeight:500}}>
                            <LogIn style={{width:12,height:12,flexShrink:0}}/>
                            <span>{formatDateTime(checkInVal)}</span>
                          </div>
                        ) : (
                          <span style={{color:"#9aacbc",fontStyle:"italic"}}>—</span>
                        )}
                      </td>
                      <td style={{padding:"10px 14px",color:"#445566",whiteSpace:"nowrap",fontSize:12}}>
                        {checkOutVal ? (
                          <div style={{display:"flex",alignItems:"center",gap:5,color:"#8A2E88",fontWeight:500}}>
                            <LogOut style={{width:12,height:12,flexShrink:0}}/>
                            <span>{formatDateTime(checkOutVal)}</span>
                          </div>
                        ) : (
                          <span style={{color:"#9aacbc",fontStyle:"italic"}}>—</span>
                        )}
                      </td>
                      <td style={{padding:"10px 14px"}}><StatusBadge status={r.status}/></td>
                      <td style={{padding:"10px 14px",textAlign:"center"}} onClick={e=>e.stopPropagation()}>
                        <div style={{display:"flex",gap:6,justifyContent:"center",alignItems:"center"}}>
                          {/* Quick Action: Check In button for Expected Arrivals (Pending / Confirmed) */}
                          {r.status !== "Checked In" && r.status !== "Checked Out" && (
                            <button
                              id={`checkin-btn-${r.id}`}
                              onClick={() => {
                                if (!r.room_number) {
                                  openAssignmentModal(r);
                                } else {
                                  handleUpdateStatus(r.id, "Checked In");
                                }
                              }}
                              disabled={updatingId === r.id}
                              title={r.room_number ? "Check In guest (records current exact timestamp)" : "Assign room and Check In"}
                              style={{
                                padding:"5px 10px",
                                border:"none",
                                borderRadius:4,
                                background:"#00828A",
                                color:"#fff",
                                fontSize:11,
                                fontWeight:600,
                                cursor:updatingId === r.id ? "not-allowed" : "pointer",
                                display:"flex",
                                alignItems:"center",
                                gap:5,
                                whiteSpace:"nowrap",
                                boxShadow:"0 1px 2px rgba(0,0,0,0.1)"
                              }}
                              onMouseEnter={e => { if (updatingId !== r.id) (e.currentTarget as HTMLButtonElement).style.background="#006066"; }}
                              onMouseLeave={e => { if (updatingId !== r.id) (e.currentTarget as HTMLButtonElement).style.background="#00828A"; }}
                            >
                              {updatingId === r.id ? (
                                <Loader2 style={{width:12,height:12,animation:"spin 1s linear infinite"}}/>
                              ) : (
                                <LogIn style={{width:12,height:12}}/>
                              )}
                              <span>Check In</span>
                            </button>
                          )}

                          {/* Quick Action: Assign / Change Room button for Arrivals */}
                          {arrivalsOnly && (
                            <button
                              id={`open-assign-modal-${r.id}`}
                              onClick={() => openAssignmentModal(r)}
                              title={r.room_number ? "Change Room Assignment" : "Assign Room"}
                              style={{
                                padding:"5px 8px",
                                border:"1px solid #c8d8e8",
                                borderRadius:4,
                                background:"#f0f7ff",
                                color:"#1a6fa0",
                                fontSize:11,
                                fontWeight:600,
                                cursor:"pointer",
                                display:"flex",
                                alignItems:"center",
                                gap:4,
                                whiteSpace:"nowrap"
                              }}
                              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background="#e0f0fc"; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background="#f0f7ff"; }}
                            >
                              <Key style={{width:11,height:11}}/>
                              <span>{r.room_number ? "Change" : "Assign"}</span>
                            </button>
                          )}

                          {/* Quick Action: Check Out button for guests currently Checked In */}
                          {r.status === "Checked In" && (
                            <button
                              id={`checkout-btn-${r.id}`}
                              onClick={() => handleUpdateStatus(r.id, "Checked Out")}
                              disabled={updatingId === r.id}
                              title="Check Out guest (records current exact timestamp)"
                              style={{
                                padding:"5px 10px",
                                border:"none",
                                borderRadius:4,
                                background:"#E8811A",
                                color:"#fff",
                                fontSize:11,
                                fontWeight:600,
                                cursor:updatingId === r.id ? "not-allowed" : "pointer",
                                display:"flex",
                                alignItems:"center",
                                gap:5,
                                whiteSpace:"nowrap",
                                boxShadow:"0 1px 2px rgba(0,0,0,0.1)"
                              }}
                              onMouseEnter={e => { if (updatingId !== r.id) (e.currentTarget as HTMLButtonElement).style.background="#cc7014"; }}
                              onMouseLeave={e => { if (updatingId !== r.id) (e.currentTarget as HTMLButtonElement).style.background="#E8811A"; }}
                            >
                              {updatingId === r.id ? (
                                <Loader2 style={{width:12,height:12,animation:"spin 1s linear infinite"}}/>
                              ) : (
                                <LogOut style={{width:12,height:12}}/>
                              )}
                              Check Out
                            </button>
                          )}

                          {/* Action for Departures table: Re-Check In option */}
                          {r.status === "Checked Out" && departuresOnly && (
                            <button
                              id={`recheckin-btn-${r.id}`}
                              onClick={() => handleUpdateStatus(r.id, "Checked In")}
                              disabled={updatingId === r.id}
                              title="Re-open / Re-Check In"
                              style={{
                                padding:"4px 8px",
                                border:"1px solid #c8d8e8",
                                borderRadius:4,
                                background:"#fff",
                                color:"#1a6fa0",
                                fontSize:11,
                                fontWeight:500,
                                cursor:updatingId === r.id ? "not-allowed" : "pointer",
                                display:"flex",
                                alignItems:"center",
                                gap:4,
                                whiteSpace:"nowrap"
                              }}
                              onMouseEnter={e => { if (updatingId !== r.id) (e.currentTarget as HTMLButtonElement).style.background="#e8f4fd"; }}
                              onMouseLeave={e => { if (updatingId !== r.id) (e.currentTarget as HTMLButtonElement).style.background="#fff"; }}
                            >
                              {updatingId === r.id ? (
                                <Loader2 style={{width:11,height:11,animation:"spin 1s linear infinite"}}/>
                              ) : (
                                <LogIn style={{width:11,height:11}}/>
                              )}
                              Re-Check In
                            </button>
                          )}

                          <button id={`edit-reservation-${r.id}`} onClick={()=>openEditModal(r)} title="Edit"
                            style={{padding:"5px 8px",border:"1px solid #d0dae5",borderRadius:4,background:"#fff",color:"#1a6fa0",cursor:"pointer",display:"flex",alignItems:"center"}}
                            onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.background="#e8f4fd";}}
                            onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background="#fff";}}>
                            <Pencil style={{width:13,height:13}}/>
                          </button>
                          <button id={`delete-reservation-${r.id}`} onClick={()=>setDeleteTarget(r)} title="Delete"
                            style={{padding:"5px 8px",border:"1px solid #f0a0a0",borderRadius:4,background:"#fff",color:"#c0392b",cursor:"pointer",display:"flex",alignItems:"center"}}
                            onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.background="#fdf0f0";}}
                            onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background="#fff";}}>
                            <Trash2 style={{width:13,height:13}}/>
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

      {arrivalsOnly ? (
        <div style={{background:"#fff",borderTop:"2px solid #dce3eb",padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:"0 -2px 8px rgba(0,0,0,0.06)",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:16,fontSize:12,color:"#475569"}}>
            <span style={{fontWeight:600,color:"#1a3c5e"}}>
              Expected Arrivals: <strong style={{color:"#00828A"}}>{filtered.length}</strong>
            </span>
            <span style={{color:"#cbd5e1"}}>|</span>
            <span>
              Rooms Assigned: <strong style={{color:"#1a7a4a"}}>{filtered.filter(r => r.room_number).length}</strong>
            </span>
            <span style={{color:"#cbd5e1"}}>|</span>
            <span>
              Unassigned: <strong style={{color:"#d97706"}}>{filtered.filter(r => !r.room_number).length}</strong>
            </span>
          </div>

          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button
              id="refresh-arrivals-bottom-btn"
              onClick={fetchReservations}
              style={{
                display:"flex",
                alignItems:"center",
                gap:6,
                padding:"6px 14px",
                borderRadius:4,
                border:"1px solid #cbd5e1",
                background:"#f8fafc",
                fontSize:12,
                fontWeight:500,
                color:"#334155",
                cursor:"pointer"
              }}
            >
              <RefreshCw style={{width:12,height:12}}/>
              <span>Refresh Inventory</span>
            </button>
          </div>
        </div>
      ) : (
        <div style={{background:"#fff",borderTop:"2px solid #dce3eb",padding:"12px 20px",display:"flex",alignItems:"center",gap:14,boxShadow:"0 -2px 8px rgba(0,0,0,0.06)",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <label htmlFor="template-select" style={{fontSize:12,color:"#7a8fa0",fontWeight:500,whiteSpace:"nowrap"}}>Template:</label>
            <div style={{position:"relative"}}>
              <select id="template-select" value={template} onChange={e=>setTemplate(e.target.value)}
                style={{appearance:"none",paddingLeft:10,paddingRight:30,paddingTop:7,paddingBottom:7,border:"1px solid #c5d4e0",borderRadius:4,fontSize:12,color:"#2c3e50",background:"#fff",cursor:"pointer",outline:"none",minWidth:220}}>
                <option>Standard Registration Card</option><option>VIP Registration Card</option><option>Group Registration Card</option><option>Compact Registration Card</option>
              </select>
              <ChevronDown style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",width:13,height:13,color:"#7a8fa0",pointerEvents:"none"}}/>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <label htmlFor="destination-select" style={{fontSize:12,color:"#7a8fa0",fontWeight:500,whiteSpace:"nowrap"}}>Destination:</label>
            <div style={{position:"relative"}}>
              <select id="destination-select" value={destination} onChange={e=>setDestination(e.target.value as Destination)}
                style={{appearance:"none",paddingLeft:10,paddingRight:30,paddingTop:7,paddingBottom:7,border:"1px solid #c5d4e0",borderRadius:4,fontSize:12,color:"#2c3e50",background:"#fff",cursor:"pointer",outline:"none",minWidth:130}}>
                <option value="Print">Print</option><option value="Preview">Preview</option><option value="Email">Email</option>
              </select>
              <ChevronDown style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",width:13,height:13,color:"#7a8fa0",pointerEvents:"none"}}/>
            </div>
          </div>
          <div style={{flex:1}}/>
          {selectedIds.size===0?<span style={{fontSize:12,color:"#b0bec5",fontStyle:"italic"}}>Select one or more guests to process</span>:<span style={{fontSize:12,color:"#1a6fa0",fontWeight:500}}>{selectedIds.size} guest{selectedIds.size!==1?"s":""} selected</span>}
          <button id="action-bar-cancel-btn" onClick={()=>setSelectedIds(new Set())} style={{padding:"7px 18px",borderRadius:4,border:"1px solid #c5d4e0",background:"#fff",color:"#445566",fontSize:12,fontWeight:500,cursor:"pointer"}}>Cancel</button>
          <button id="process-registration-cards-btn" onClick={handleProcess} disabled={selectedIds.size===0||processing}
            style={{padding:"7px 22px",borderRadius:4,border:"none",background:selectedIds.size===0?"#b0bec5":"#00828A",color:"#fff",fontSize:12,fontWeight:600,cursor:selectedIds.size===0?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:7,letterSpacing:"0.3px"}}>
            {processing?<Loader2 style={{width:14,height:14,animation:"spin 1s linear infinite"}}/>:destinationIcon}
            {processing?"Processing...":"Process Registration Card"}
          </button>
        </div>
      )}

      <div style={{display:"none"}}><div ref={printRef}><RegistrationCardTemplate guests={selectedGuests}/></div></div>

      {showModal&&<BookingModal mode={modalMode} initial={initialForm} saving={saving} error={modalError} onClose={closeModal} onSubmit={handleModalSubmit}/>}
      {deleteTarget&&<DeleteDialog guestName={deleteTarget.guest_name} onConfirm={confirmDelete} onCancel={()=>setDeleteTarget(null)} deleting={deleting}/>}

      {/* Smart Room Assignment & Check-In Modal */}
      <RoomAssignmentModal
        reservation={assignmentTarget}
        isOpen={showAssignmentModal}
        onClose={closeAssignmentModal}
        onSuccess={() => {
          fetchReservations();
          triggerRefresh();
        }}
      />

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes slideUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
