const fs = require('fs');
const resPage = fs.readFileSync('./src/pages/ReservationsPage.tsx', 'utf-8');
let bookPage = fs.readFileSync('./src/pages/BookingsPage.tsx', 'utf-8');

// 1. Copy BookingModal
const modalRegex = /function BookingModal\(\{[^]*?\n\}\n/m;
const resModal = resPage.match(modalRegex)[0];
bookPage = bookPage.replace(modalRegex, resModal);

// 2. Add CONSTANTS if missing
if (!bookPage.includes('const ROOM_RATES')) {
  bookPage = bookPage.replace('const ROOM_TYPES = [', `const ROOM_RATES: Record<string, number> = {
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

const ROOM_TYPES = [`);
}

// 3. initialForm
const initFormRegex = /const initialForm:FormData=editTarget\?\{[^]*?\}:EMPTY_FORM;/m;
const resInitForm = resPage.match(initFormRegex)[0];
bookPage = bookPage.replace(initFormRegex, resInitForm);

// 4. Update state and fetchReservations
bookPage = bookPage.replace(/const \[selectedIds,setSelectedIds\]=useState<Set<number>>\(new Set\(\)\);\n    const \[searchQuery,setSearchQuery\]=useState\(""\);/m, 
`const [selectedIds,setSelectedIds]=useState<Set<number>>(new Set());
    const [searchQuery,setSearchQuery]=useState("");
    const [selectedTab,setSelectedTab]=useState<"All"|"In-House"|"Arrivals"|"Departures">("All");
    const [selectedDate,setSelectedDate]=useState<string>("");`);

bookPage = bookPage.replace(/const fetchBookings \= async \(\) \=\> \{[^]*?useEffect\(\(\) \=\> \{ fetchBookings\(\); \}, \[\]\);/m, 
`const fetchBookings=async()=>{
        setLoading(true);setError(null);
        try{
            let url="/api/reservations";
            const params=new URLSearchParams();
            if(selectedDate){
                params.append("date",selectedDate);
                if(selectedTab==="Arrivals")params.append("date_type","arrival");
                else if(selectedTab==="Departures")params.append("date_type","departure");
                else if(selectedTab==="In-House")params.append("date_type","inhouse");
            }
            const qs=params.toString();
            if(qs)url+=\`?\${qs}\`;
            const res=await fetch(url);
            if(!res.ok)throw new Error(\`Server responded with \${res.status}\`);
            setBookings(await res.json());
        }catch(err){setError(err instanceof Error?err.message:"Unknown error");}
        finally{setLoading(false);}
    };
    useEffect(()=>{fetchBookings();},[selectedDate,selectedTab]);`);

bookPage = bookPage.replace(/const filtered = bookings\.filter\(\(r\) => \{[^]*?\}\);/m,
`const filtered=bookings.filter(r=>{
        const q=searchQuery.toLowerCase();
        return r.guest_name.toLowerCase().includes(q)||r.confirmation_number.toLowerCase().includes(q)||(r.phone_number&&r.phone_number.toLowerCase().includes(q))||r.room_type.toLowerCase().includes(q)||r.status.toLowerCase().includes(q);
    });`);

// 5. Update UI filters
bookPage = bookPage.replace(/<div style=\{\{ background: "\#fff", borderBottom: "1px solid #dce3eb", padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 \}\}>\n                <div style=\{\{ position: "relative", flex: 1, maxWidth: 380 \}\}>\n                    <Search style=\{\{ position: "absolute", left: 10, top: "50%", transform: "translateY\(-50%\)", width: 14, height: 14, color: "#90a0b0" \}\} \/>\n                    <input type="text" placeholder="Search bookings..." value=\{searchQuery\} onChange=\{\(e\) => setSearchQuery\(e.target.value\)\}\n                        style=\{\{ width: "100%", paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7, border: "1px solid #d0dae5", borderRadius: 4, fontSize: 12, color: "#2c3e50", outline: "none", boxSizing: "border-box" \}\} \/>\n                <\/div>/m, 
`<div style={{background:"#fff",borderBottom:"1px solid #dce3eb",padding:"10px 20px",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
        <div style={{display:"flex",gap:4,background:"#f0f4f8",padding:4,borderRadius:6}}>
          {(["All","In-House","Arrivals","Departures"] as const).map(t=>(
            <button key={t} onClick={()=>setSelectedTab(t)} style={{padding:"6px 12px",borderRadius:4,border:"none",fontSize:12,fontWeight:600,cursor:"pointer",background:selectedTab===t?"#fff":"transparent",color:selectedTab===t?"#1a3c5e":"#7a8fa0",boxShadow:selectedTab===t?"0 1px 3px rgba(0,0,0,0.1)":"none"}}>{t}</button>
          ))}
        </div>
        <div style={{position:"relative"}}>
          <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} style={{padding:"7px 10px",border:"1px solid #d0dae5",borderRadius:4,fontSize:12,color:"#1a3c5e",outline:"none"}}/>
        </div>
        <div style={{position:"relative",flex:1,maxWidth:380}}>
          <Search style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",width:14,height:14,color:"#90a0b0"}}/>
          <input id="reservations-search-input" type="text" placeholder="Search by name, confirmation #, phone, room type, status..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
            style={{width:"100%",paddingLeft:32,paddingRight:12,paddingTop:7,paddingBottom:7,border:"1px solid #d0dae5",borderRadius:4,fontSize:12,color:"#2c3e50",outline:"none",boxSizing:"border-box"}}/>
        </div>`);

fs.writeFileSync('./src/pages/BookingsPage.tsx', bookPage);
console.log("Done");
