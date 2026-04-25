import { useState, useEffect } from "react";

/* ═══════════════════════════════════════════════════════════
   SUPABASE STORAGE ADAPTER
   Replaces storage with real persistent database.
   Anon key is intentionally public — read-only by design.
═══════════════════════════════════════════════════════════ */
const SB_URL  = "https://ouvgvqfwokymlfghgvzz.supabase.co";
const SB_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91dmd2cWZ3b2t5bWxmZ2hndnp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMTcyNTcsImV4cCI6MjA5MjU5MzI1N30.HRZlqIcjMivDSf1AnZN5svlg-vSqB3Zj4-ta8blpCz4";
const SB_HDR  = { "Content-Type":"application/json", "apikey":SB_KEY, "Authorization":`Bearer ${SB_KEY}` };
const SB_UPSERT = { ...SB_HDR, "Prefer":"resolution=merge-duplicates,return=minimal" };

const sbFetch = (path, opts={}) => fetch(`${SB_URL}/rest/v1${path}`, { headers:SB_HDR, ...opts });

const storage = {
  async get(key) {
    let res, rows;
    if (key === "doctors") {
      res  = await sbFetch(`/doctors?id=eq.ALL&select=data`);
      rows = await res.json();
    } else if (key.startsWith("appt:")) {
      const code = key.slice(5);
      res  = await sbFetch(`/appointments?code=eq.${code}&select=data`);
      rows = await res.json();
    } else {
      // consultations — key is rx:docId:ts
      res  = await sbFetch(`/consultations?id=eq.${encodeURIComponent(key)}&select=data`);
      rows = await res.json();
    }
    if (!rows || rows.length === 0) throw new Error("Not found: " + key);
    const val = rows[0].data;
    return { value: typeof val === "string" ? val : JSON.stringify(val) };
  },

  async set(key, value) {
    const data = typeof value === "string" ? JSON.parse(value) : value;
    if (key === "doctors") {
      await fetch(`${SB_URL}/rest/v1/doctors`, {
        method:"POST", headers:SB_UPSERT,
        body: JSON.stringify({ id:"ALL", data })
      });
    } else if (key.startsWith("appt:")) {
      const code = key.slice(5);
      await fetch(`${SB_URL}/rest/v1/appointments`, {
        method:"POST", headers:SB_UPSERT,
        body: JSON.stringify({ id:key, code, data })
      });
    } else {
      // consultations
      const parts   = key.split(":");
      const doctorId    = parts[1] || "";
      const patientUhid = data?.patient?.uhid || "";
      await fetch(`${SB_URL}/rest/v1/consultations`, {
        method:"POST", headers:SB_UPSERT,
        body: JSON.stringify({ id:key, doctor_id:doctorId, patient_uhid:patientUhid, data })
      });
    }
    return { key, value };
  },

  async list(prefix) {
    let res, rows;
    if (prefix === "appt:") {
      res  = await sbFetch(`/appointments?select=id`);
      rows = await res.json();
    } else {
      res  = await sbFetch(`/consultations?select=id`);
      rows = await res.json();
    }
    return { keys: (rows||[]).map(r => r.id) };
  },

  async delete(key) {
    if (key.startsWith("appt:")) {
      const code = key.slice(5);
      await sbFetch(`/appointments?code=eq.${code}`, { method:"DELETE" });
    } else {
      await sbFetch(`/consultations?id=eq.${encodeURIComponent(key)}`, { method:"DELETE" });
    }
    return { key, deleted:true };
  }
};

/* ═══════════════════════════════════════════════════════════
   BRAND COLOURS  (from logo palette)
═══════════════════════════════════════════════════════════ */
const C = {
  teal900:"#093D4A", teal800:"#0C5D72", teal700:"#0E7A95",
  teal600:"#1295B3", teal400:"#3DBDD6", teal100:"#C2EEF5", teal50:"#EBF9FC",
  lime:"#8DB820",   limeLt:"#EDF5C3",
  rust:"#C1440E",   rustLt:"#FEE2D3",
  bg:"#F0FAFB",     card:"#FFFFFF",
  text:"#0A2D36",   muted:"#4A6B75",   border:"#C5DDE3", divider:"#DFF0F4",
  success:"#156B3A",successLt:"#D4F0E0",
  warn:"#A05A00",   warnLt:"#FEF3C7",
  danger:"#B91C1C", dangerLt:"#FEE2E2",
  badge:"#E6F7FA",
};

/* ═══════════════════════════════════════════════════════════
   SEED DATA
═══════════════════════════════════════════════════════════ */
const SEED_DOCTORS = [
  // Lifestyle doctors — can log in to app
  {id:"DR001",name:"Dr. Anand Shankar Kannapur",specialty:"Anaesthesiology & Lifestyle",dept:"Lifestyle Medicine",type:"lifestyle",password:"jmrh001"},
  {id:"DR002",name:"Dr. Priya Menon",specialty:"General Medicine & Lifestyle",dept:"Lifestyle Medicine",type:"lifestyle",password:"jmrh002"},
  {id:"DR003",name:"Dr. Karthik Rao",specialty:"Internal Medicine & Lifestyle",dept:"Lifestyle Medicine",type:"lifestyle",password:"jmrh003"},
  {id:"DR004",name:"Dr. Suma Nair",specialty:"Ayurveda & Lifestyle",dept:"Lifestyle Medicine",type:"lifestyle",password:"jmrh004"},
  // Primary consultants — can log in to view lifestyle prescriptions for their referred patients
  {id:"PC001",name:"Dr. Ramesh Babu",specialty:"Cardiology",dept:"Cardiology",type:"primary",password:"jmrh@pc01"},
  {id:"PC002",name:"Dr. Kavitha Sharma",specialty:"Endocrinology",dept:"Endocrinology",type:"primary",password:"jmrh@pc02"},
  {id:"PC003",name:"Dr. Suresh Nair",specialty:"General Medicine",dept:"Medicine",type:"primary",password:"jmrh@pc03"},
  {id:"PC004",name:"Dr. Anitha Reddy",specialty:"Orthopaedics",dept:"Orthopaedics",type:"primary",password:"jmrh@pc04"},
  {id:"PC005",name:"Dr. Vinod Kumar",specialty:"Neurology",dept:"Neurology",type:"primary",password:"jmrh@pc05"},
];

const SPECIALTIES = [
  "Cardiology","Endocrinology","General Medicine","Orthopaedics","Neurology",
  "Gastroenterology","Nephrology","Pulmonology","Oncology","Dermatology",
  "Gynaecology","Urology","Ophthalmology","ENT","Psychiatry",
  "Rheumatology","Haematology","Paediatrics","Surgery","Other"
];
const CHIEF_COMPLAINTS = [
  "Chest pain / discomfort","Shortness of breath","Blood pressure management",
  "Diabetes / blood sugar control","Weight gain / obesity","Joint pain / knee pain",
  "Back pain / spine","Headache / dizziness / vertigo","Fatigue / weakness",
  "Digestive issues / acidity / bloating","Thyroid concerns","Skin problems",
  "Vision problems","Sleep issues / insomnia","Anxiety / mood changes",
  "Kidney / urinary concerns","Routine health check","Other"
];
const DIAGNOSES = [
  "None","Type 2 Diabetes","Type 1 Diabetes","Hypertension","Hypothyroidism",
  "Hyperthyroidism","Coronary artery disease / IHD","Heart failure","Asthma","COPD",
  "Osteoarthritis / Arthritis","Obesity / Overweight","PCOS / PCOD","Chronic kidney disease",
  "Fatty liver / NAFLD","Anaemia","Anxiety / Depression","Migraine","Gout","Other"
];
const PAST_HISTORY_OPTS = [
  "Diabetes","Hypertension","Heart attack / Bypass surgery","Stroke / Paralysis",
  "Cancer","Kidney disease","Liver disease / Hepatitis","Asthma / COPD",
  "Thyroid disorder","Major surgery","Tuberculosis","None"
];
const FAMILY_HISTORY_OPTS = [
  "Diabetes","Heart disease / Heart attack","Cancer","Hypertension",
  "Kidney disease","Thyroid disorder","Mental illness / Depression","Stroke","None"
];
const ALCOHOL_OPTS = ["Non-drinker","Occasional (< once/week)","Social / Weekly (1–3x/week)","Daily"];
const SMOKING_OPTS = ["Non-smoker","Occasional / Social","< 5 cigarettes/day","5–10 cigarettes/day","> 10 cigarettes/day","Bidi / Hookah","Ex-smoker (quit)"];
const SEED_ADMIN = {id:"ADMIN",name:"Medical Director",password:"jmrh@admin"};

/* Demo appointment — patients can log in with code DEMO01 */
const DEMO_APPOINTMENT = {
  code:"DEMO01",
  visitType:"specialist",
  patientName:"Ravi Kumar",
  patientUhid:"RH-10001",
  mobile:"+91 98765 43210",
  email:"ravi.kumar@email.com",
  date: new Date().toISOString().split("T")[0],
  time:"10:30 AM",
  primarySpecialty:"Cardiology",
  primaryDoctorId:"PC001",
  primaryDoctorName:"Dr. Ramesh Babu",
  doctorId:"DR001",
  lifestyleDoctorName:"Dr. Anand Shankar Kannapur",
  chiefComplaint:"Chest pain / discomfort",
  notes:"Hypertension + Type 2 DM, on medications",
  lifestyleIncluded:true,
  status:"form_filled",
  formFilledAt: new Date(Date.now()-3600000).toISOString(),
  createdAt: new Date(Date.now()-86400000).toISOString(),
  patientDemographics:{
    name:"Ravi Kumar", age:"58", gender:"Male", dob:"1966-04-10",
    bloodGroup:"B+", mobile:"+91 98765 43210", email:"ravi.kumar@email.com",
    address:"14, 3rd Cross, Jayanagar", city:"Bengaluru", pincode:"560041",
    occupation:"Bank Manager"
  },
  patientMedical:{
    chiefComplaint:"Chest pain / discomfort",
    diagnosis:"Hypertension",
    pastHistory:"Hypertension, Heart attack / Bypass surgery",
    medications:"Amlodipine 5mg, Metformin 500mg, Atorvastatin 10mg",
    allergies:"None",
    height:"172", weight:"86",
    familyHistory:"Heart disease / Heart attack, Diabetes"
  },
  preFormData:{
    diet:{
      wakeUp:"6–7 am", breakfast:"Delayed (>2 hrs)",
      midMorning:["Only Tea/Coffee","Biscuits"],
      lunch:"Irregular",
      eatBeh:["Frequent outside food >3x/week","Excess fried/oily/spicy food","More than 1 spoon sugar/day"],
      postLunch:["Tea/Coffee","Snacks"],
      dinner:"Late (>8:30 pm)",
      teaCoffee:["On empty stomach","More than 3/day"],
      restricted:"Low salt diet advised"
    },
    activity:{current:"Sedentary >6 hrs daily"},
    sleep:{quality:"Disturbed", sleepTime:"10 pm–12 am", duration:"6–7 hrs", screens:true, daySleep:false},
    bowel:{freq:"1/day", consistency:"Normal"},
    mic:{dayFreq:"6–8 times", nocturia:"1"},
    appetite:{pattern:["Variable","Cravings"], timing:"Delayed"},
    stress:{level:"High", sources:["Work","Financial"]},
    habits:{alcohol:"Occasional (< once/week)", smoking:"Ex-smoker (quit)", others:""},
    menstrual:{applicable:"Not applicable (Male)", cycle:"", flow:"", symptoms:[]},
    goals:["Diet","Exercise","Stress"]
  }
};
/* ═══════════════════════════════════════════════════════════
   OFFICIAL JMRH LOGOS  (extracted from JMRH_Logo_Final.pdf)
═══════════════════════════════════════════════════════════ */
const LOGO_STACKED    = "data:image/jpeg;base64,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";
const LOGO_HORIZONTAL = "data:image/jpeg;base64,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";
const LOGO_FLOWER     = "data:image/jpeg;base64,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";

/* Real logo components — no SVG recreation */
const Flower    = ({size=48}) => <img src={LOGO_FLOWER}     alt="JMRH" style={{width:size,height:"auto",display:"block"}}/>;
const HospLogo  = ({size=44,white=false,full=false,variant="horizontal"}) => {
  // In the dark nav we show horizontal logo; it has teal text so add a white bg pill
  if (variant==="nav") return (
    <div style={{background:"rgba(255,255,255,0.92)",borderRadius:8,padding:"4px 10px",display:"inline-flex",alignItems:"center"}}>
      <img src={LOGO_HORIZONTAL} alt="Jayadev Memorial Rashtrotthana Hospital" style={{height:36,width:"auto"}}/>
    </div>
  );
  if (variant==="stacked") return <img src={LOGO_STACKED} alt="JMRH" style={{width:size,height:"auto",display:"block",margin:"0 auto"}}/>;
  // default horizontal
  return <img src={LOGO_HORIZONTAL} alt="Jayadev Memorial Rashtrotthana Hospital" style={{width:size*3,height:"auto",maxWidth:"100%"}}/>;
};



/* ═══════════════════════════════════════════════════════════
   FONTS + GLOBAL CSS
═══════════════════════════════════════════════════════════ */
const FONTS=`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');`;
const G=`
${FONTS}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:${C.bg};font-family:'DM Sans',sans-serif;color:${C.text};-webkit-font-smoothing:antialiased;}
::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:${C.teal400};border-radius:4px;}

/* AUTH */
.auth-shell{min-height:100vh;display:flex;flex-direction:column;}
.auth-top{background:linear-gradient(160deg,${C.teal900} 0%,${C.teal700} 100%);padding:36px 24px 32px;text-align:center;position:relative;overflow:hidden;}
.auth-top::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 70% 30%,rgba(141,184,32,0.12),transparent 60%);}
.auth-motto{font-size:14px;color:rgba(255,255,255,0.55);margin-top:10px;letter-spacing:0.5px;}
.auth-body{flex:1;display:flex;justify-content:center;padding:28px 16px 48px;}
.auth-card{background:${C.card};border:1px solid ${C.border};border-radius:20px;width:100%;max-width:460px;padding:30px;box-shadow:0 8px 40px rgba(9,61,74,0.1);}
.auth-h{font-family:'Playfair Display',serif;font-size:22px;color:${C.teal900};margin-bottom:4px;}
.auth-sub{font-size:13px;color:${C.muted};margin-bottom:22px;}
.role-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:4px;}
.role-btn{border:2px solid ${C.border};background:${C.bg};border-radius:13px;padding:16px 10px;cursor:pointer;transition:all 0.2s;text-align:center;}
.role-btn:hover{border-color:${C.teal400};background:${C.teal50};}
.role-btn.sel{border-color:${C.teal700};background:${C.teal50};}
.ri{font-size:28px;margin-bottom:6px;}
.rl{font-size:13px;font-weight:600;color:${C.teal900};}
.rd{font-size:10px;color:${C.muted};margin-top:2px;line-height:1.4;}
.doc-opt{display:flex;align-items:center;gap:10px;padding:10px 13px;border:1.5px solid ${C.border};border-radius:10px;cursor:pointer;transition:all 0.18s;margin-bottom:8px;}
.doc-opt:hover{border-color:${C.teal400};background:${C.teal50};}
.doc-opt.sel{border-color:${C.teal700};background:${C.teal50};}
.dav{width:34px;height:34px;border-radius:50%;background:${C.teal700};color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;}

/* NAV */
.nav{background:${C.teal900};color:white;padding:0 18px;display:flex;align-items:center;justify-content:space-between;height:60px;position:sticky;top:0;z-index:100;box-shadow:0 2px 16px rgba(9,61,74,0.3);}
.nav-r{display:flex;align-items:center;gap:8px;}
.ntab{padding:7px 13px;border-radius:7px;font-size:12px;font-weight:500;cursor:pointer;transition:all 0.18s;color:rgba(255,255,255,0.6);border:none;background:transparent;font-family:'DM Sans',sans-serif;}
.ntab:hover{background:rgba(255,255,255,0.1);color:white;}
.ntab.on{background:rgba(255,255,255,0.15);color:white;}
.nav-badge{font-size:10px;font-weight:700;background:${C.rust};color:white;padding:2px 7px;border-radius:10px;margin-left:4px;}
.nbtn{background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.8);padding:6px 12px;border-radius:6px;font-size:11px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all 0.18s;}
.nbtn:hover{background:rgba(255,255,255,0.2);}
.nav-av{width:32px;height:32px;border-radius:50%;background:${C.lime};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${C.teal900};flex-shrink:0;}
.nav-uname{font-size:12px;color:rgba(255,255,255,0.82);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}

/* PROGRESS */
.prog-bar{background:${C.card};border-bottom:1px solid ${C.divider};padding:10px 18px;position:sticky;top:60px;z-index:90;}
.prog-inner{max-width:780px;margin:0 auto;}
.prog-lbl{display:flex;justify-content:space-between;margin-bottom:7px;}
.prog-name{font-size:13px;font-weight:600;color:${C.teal700};}
.prog-ct{font-size:11px;color:${C.muted};}
.prog-track{height:4px;background:${C.divider};border-radius:4px;overflow:hidden;}
.prog-fill{height:100%;background:linear-gradient(to right,${C.teal600},${C.lime});border-radius:4px;transition:width 0.4s;}
.prog-dots{display:flex;gap:4px;margin-top:7px;flex-wrap:wrap;}
.pd{width:22px;height:22px;border-radius:50%;font-size:9px;display:flex;align-items:center;justify-content:center;font-weight:600;}
.pd.done{background:${C.teal700};color:white;}
.pd.act{background:${C.rust};color:white;box-shadow:0 0 0 3px ${C.rustLt};}
.pd.pend{background:${C.divider};color:${C.muted};}

/* LAYOUT */
.page{padding:18px;max-width:820px;margin:0 auto;}
.card{background:${C.card};border:1px solid ${C.border};border-radius:14px;padding:22px;margin-bottom:14px;box-shadow:0 1px 6px rgba(9,61,74,0.05);}
.sec-head{display:flex;align-items:center;gap:10px;margin-bottom:3px;}
.sec-icon{width:36px;height:36px;border-radius:10px;background:${C.teal50};display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}
.sec-title{font-family:'Playfair Display',serif;font-size:20px;color:${C.teal900};}
.sec-desc{font-size:11px;color:${C.muted};letter-spacing:1.2px;text-transform:uppercase;margin-bottom:18px;padding-left:46px;}
.divider{height:1px;background:${C.divider};margin:14px 0;}
.fl{font-size:11px;font-weight:600;color:${C.muted};text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;}
.fg{margin-bottom:14px;}
.ti{width:100%;border:1.5px solid ${C.border};border-radius:9px;padding:11px 14px;font-family:'DM Sans',sans-serif;font-size:14px;color:${C.text};background:${C.bg};outline:none;transition:border-color 0.2s;}
.ti:focus{border-color:${C.teal600};}
.si{width:100%;border:1.5px solid ${C.border};border-radius:9px;padding:11px 14px;font-family:'DM Sans',sans-serif;font-size:14px;color:${C.text};background:${C.bg};outline:none;}
.r2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.r3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;}

/* CONTROLS */
.rg{display:flex;flex-wrap:wrap;gap:7px;}
.rp{padding:7px 14px;border-radius:20px;border:1.5px solid ${C.border};cursor:pointer;font-size:13px;transition:all 0.18s;color:${C.muted};background:${C.bg};}
.rp:hover{border-color:${C.teal400};color:${C.text};}
.rp.sel{background:${C.teal700};border-color:${C.teal700};color:white;}
.ci{display:flex;align-items:flex-start;gap:10px;padding:9px 12px;border-radius:9px;border:1.5px solid transparent;cursor:pointer;transition:all 0.18s;}
.ci:hover{background:${C.teal50};border-color:${C.teal100};}
.ci.on{background:${C.teal50};border-color:${C.teal400};}
.cb{width:18px;height:18px;border-radius:5px;border:2px solid ${C.border};flex-shrink:0;margin-top:2px;display:flex;align-items:center;justify-content:center;transition:all 0.18s;}
.cb.on{background:${C.teal700};border-color:${C.teal700};}
.cb.on::after{content:'✓';color:white;font-size:11px;font-weight:700;}
.cl{font-size:14px;line-height:1.4;}
.cs{font-size:11px;color:${C.muted};margin-top:2px;}
.gg{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.gc{padding:13px;border-radius:10px;border:1.5px solid ${C.border};cursor:pointer;transition:all 0.18s;background:${C.bg};}
.gc:hover{border-color:${C.teal400};}
.gc.on{background:${C.teal50};border-color:${C.teal600};}
.gt{font-size:13px;font-weight:600;color:${C.teal900};margin-bottom:3px;}
.gi{font-size:11px;color:${C.muted};line-height:1.6;}

/* BUTTONS */
.btn{padding:10px 22px;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:500;cursor:pointer;border:none;transition:all 0.2s;display:inline-flex;align-items:center;gap:7px;}
.btn-teal{background:${C.teal700};color:white;}
.btn-teal:hover{background:${C.teal900};}
.btn-lime{background:${C.lime};color:white;}
.btn-lime:hover{background:#739614;}
.btn-rust{background:${C.rust};color:white;}
.btn-rust:hover{background:#8B2500;}
.btn-ghost{background:transparent;color:${C.muted};border:1.5px solid ${C.border};}
.btn-ghost:hover{border-color:${C.teal600};color:${C.teal700};}
.btn-gen{background:linear-gradient(135deg,${C.teal700},${C.teal900});color:white;width:100%;justify-content:center;padding:14px;font-size:15px;border-radius:10px;box-shadow:0 4px 16px rgba(14,122,149,0.28);}
.btn-gen:hover{box-shadow:0 6px 24px rgba(14,122,149,0.38);transform:translateY(-1px);}
.btn-gen:disabled{opacity:0.55;cursor:not-allowed;transform:none;}
.btn-full{width:100%;justify-content:center;}
.nav-row{display:flex;justify-content:space-between;margin-top:18px;padding-bottom:24px;}

/* STATS + HOME */
.stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px;}
.stat-box{background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:16px 12px;text-align:center;}
.stat-num{font-family:'Playfair Display',serif;font-size:24px;color:${C.teal700};}
.stat-label{font-size:10px;color:${C.muted};margin-top:2px;text-transform:uppercase;letter-spacing:0.5px;}
.action-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.action-card{background:${C.card};border:1px solid ${C.border};border-radius:14px;padding:20px 16px;cursor:pointer;transition:all 0.2s;}
.action-card:hover{border-color:${C.teal600};box-shadow:0 4px 18px rgba(14,122,149,0.1);transform:translateY(-1px);}
.action-card.primary{background:linear-gradient(135deg,${C.teal700},${C.teal900});border:none;}
.action-card.lime{background:linear-gradient(135deg,${C.lime},#739614);border:none;}
.ai{font-size:26px;margin-bottom:10px;}
.at{font-size:15px;font-weight:600;color:${C.teal900};margin-bottom:3px;}
.ad{font-size:12px;color:${C.muted};line-height:1.5;}
.action-card.primary .at,.action-card.primary .ad,.action-card.lime .at,.action-card.lime .ad{color:white;}
.action-card.primary .ad,.action-card.lime .ad{opacity:.75;}

/* ADMIN TABLE */
.tbl{width:100%;border-collapse:collapse;}
.tbl th{text-align:left;font-size:11px;font-weight:600;color:${C.muted};text-transform:uppercase;letter-spacing:0.8px;padding:10px 12px;border-bottom:2px solid ${C.divider};}
.tbl td{font-size:13px;padding:11px 12px;border-bottom:1px solid ${C.divider};vertical-align:middle;}
.tbl tr:hover td{background:${C.teal50};}
.tag{display:inline-flex;padding:3px 10px;border-radius:10px;font-size:11px;font-weight:600;}
.tag-teal{background:${C.badge};color:${C.teal700};}
.tag-lime{background:${C.limeLt};color:#507010;}
.tag-rust{background:${C.rustLt};color:${C.rust};}
.tag-green{background:${C.successLt};color:${C.success};}
.tag-warn{background:${C.warnLt};color:${C.warn};}

/* SMS MODAL */
.overlay{position:fixed;inset:0;background:rgba(9,61,74,0.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;}
.modal{background:white;border-radius:18px;padding:28px;max-width:460px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.2);}
.modal-title{font-family:'Playfair Display',serif;font-size:20px;color:${C.teal900};margin-bottom:4px;}
.modal-sub{font-size:12px;color:${C.muted};margin-bottom:20px;}
.sms-box{background:${C.teal50};border:1px solid ${C.teal100};border-radius:12px;padding:16px;font-size:13px;line-height:1.7;color:${C.text};margin-bottom:16px;}
.code-display{background:${C.teal900};color:white;border-radius:10px;padding:14px;text-align:center;margin-bottom:16px;}
.code-num{font-family:'Playfair Display',serif;font-size:32px;letter-spacing:8px;}
.code-label{font-size:10px;opacity:.6;margin-top:4px;letter-spacing:1.5px;text-transform:uppercase;}

/* HIS EXPORT */
.his-box{background:${C.teal900};color:#7DD3E4;border-radius:10px;padding:16px;font-family:monospace;font-size:12px;line-height:1.6;overflow-x:auto;white-space:pre;margin-bottom:14px;max-height:320px;overflow-y:auto;}

/* ARCHIVE */
.arch-bar{display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap;}
.arch-search{flex:1;min-width:160px;border:1.5px solid ${C.border};border-radius:9px;padding:10px 14px;font-family:'DM Sans',sans-serif;font-size:14px;background:${C.card};outline:none;transition:border-color 0.2s;}
.arch-search:focus{border-color:${C.teal600};}
.arch-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.arch-card{background:${C.card};border:1.5px solid ${C.border};border-radius:12px;padding:15px;cursor:pointer;transition:all 0.2s;}
.arch-card:hover{border-color:${C.teal600};box-shadow:0 4px 14px rgba(14,122,149,0.1);}
.arch-name{font-size:15px;font-weight:600;color:${C.teal900};margin-bottom:2px;}
.arch-diag{font-size:12px;color:${C.muted};margin-bottom:7px;}
.arch-meta{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px;}
.arch-date{font-size:11px;color:${C.muted};}
.risk-badge{display:inline-flex;padding:3px 10px;border-radius:10px;font-size:11px;font-weight:600;}
.risk-Low{background:${C.successLt};color:${C.success};}
.risk-Moderate{background:${C.warnLt};color:${C.warn};}
.risk-High{background:${C.dangerLt};color:${C.danger};}

/* PENDING CARD */
.pending-card{background:${C.teal50};border:1.5px solid ${C.teal400};border-radius:12px;padding:15px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;}
.pending-info{}
.pending-name{font-size:15px;font-weight:600;color:${C.teal900};}
.pending-sub{font-size:12px;color:${C.muted};margin-top:2px;}

/* RX */
.rx-wrap{background:${C.card};border:2px solid ${C.teal700};border-radius:16px;overflow:hidden;margin-bottom:16px;}
.rx-hdr{background:white;border-bottom:3px solid ${C.teal700};padding:20px 26px;}
.rx-hdr-stripe{height:6px;background:linear-gradient(to right,${C.teal900},${C.teal600},${C.lime});margin:-20px -26px 16px;}
.rx-hdr-top{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;}
.rx-title{font-family:'Playfair Display',serif;font-size:22px;color:${C.teal900};margin-top:10px;}
.rx-pt{font-size:13px;color:${C.muted};line-height:1.7;}
.rx-body{padding:22px 26px;}
.rx-sec{margin-bottom:20px;}
.rx-sec-title{font-family:'Playfair Display',serif;font-size:15px;color:${C.teal900};margin-bottom:9px;padding-bottom:6px;border-bottom:1px solid ${C.teal100};display:flex;align-items:center;gap:7px;}
.rx-text{font-size:13.5px;line-height:1.8;color:${C.text};white-space:pre-wrap;}
.shloka-box{background:${C.teal50};border-left:3px solid ${C.teal600};border-radius:0 10px 10px 0;padding:14px 18px;margin:12px 0;}
.shloka-sk{font-family:'Playfair Display',serif;font-size:14px;font-style:italic;color:${C.teal900};line-height:1.7;}
.shloka-tr{font-size:11px;color:${C.muted};margin-top:3px;}
.shloka-en{font-size:13px;color:${C.text};margin-top:5px;font-style:italic;}
.shloka-src{font-size:10px;color:${C.teal700};margin-top:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;}
.rx-num{width:26px;height:26px;border-radius:50%;background:${C.rust};color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;}
.rx-note{background:${C.warnLt};border:1px solid #FDE68A;border-radius:10px;padding:14px 16px;margin-bottom:16px;}
.rx-footer{display:flex;justify-content:space-between;align-items:center;border-top:1px solid ${C.divider};padding-top:14px;flex-wrap:wrap;gap:8px;}
.rx-actions{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;}
.subsection-label{font-size:11px;font-weight:600;color:${C.teal700};text-transform:uppercase;letter-spacing:1px;
  margin:14px 0 8px;padding-bottom:5px;border-bottom:1px solid ${C.divider};}

/* MISC */
.err-box{background:${C.dangerLt};border:1px solid #FCA5A5;border-radius:8px;padding:11px 14px;font-size:13px;color:${C.danger};margin-bottom:12px;}
.info-box{background:${C.teal50};border:1px solid ${C.teal100};border-radius:8px;padding:11px 14px;font-size:13px;color:${C.teal800};margin-bottom:12px;}
.success-box{background:${C.successLt};border:1px solid #86EFAC;border-radius:8px;padding:11px 14px;font-size:13px;color:${C.success};margin-bottom:12px;}
.spin{width:44px;height:44px;border:3px solid ${C.teal100};border-top-color:${C.teal600};border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px;}
@keyframes spin{to{transform:rotate(360deg);}}
.fade{animation:fadeIn 0.3s ease;}
@keyframes fadeIn{from{opacity:0;transform:translateY(5px);}to{opacity:1;transform:none;}}
.section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px;}
.section-h{font-family:'Playfair Display',serif;font-size:22px;color:${C.teal900};}
.section-hs{font-size:12px;color:${C.muted};}

/* PRINT */
@media print{
  body *{visibility:hidden;}
  body[data-print="rx"] #print-rx,body[data-print="rx"] #print-rx *{visibility:visible;}
  body[data-print="rx"] #print-rx{position:fixed;top:0;left:0;width:100%;background:white;padding:20px 28px;}
  body[data-print="opd"] #print-opd,body[data-print="opd"] #print-opd *{visibility:visible;}
  body[data-print="opd"] #print-opd{position:fixed;top:0;left:0;width:100%;background:white;padding:20px 28px;}
  .no-print{display:none!important;}
  .rx-wrap{border:1px solid #ccc!important;}
  @page{margin:10mm 12mm;}
}
/* MOBILE */
@media(max-width:600px){
  .r2,.r3,.action-grid,.gg,.arch-grid,.stats-row{grid-template-columns:1fr;}
  .stats-row{grid-template-columns:1fr 1fr;}
  .rx-hdr,.rx-body{padding-left:16px;padding-right:16px;}
  .page{padding:12px;}
  .prog-dots,.nav-r .ntab{display:none;}
  .role-grid{grid-template-columns:1fr;}
  .tbl thead{display:none;}
  .tbl tr{display:block;border:1px solid ${C.border};border-radius:10px;margin-bottom:10px;padding:10px 12px;background:${C.card};}
  .tbl td{display:flex;justify-content:space-between;align-items:flex-start;padding:4px 0;border:none;font-size:13px;}
  .tbl td:before{content:attr(data-label);font-size:11px;color:${C.muted};font-weight:600;margin-right:8px;white-space:nowrap;}
}
`;

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
const RadioGroup=({opts,val,onChange})=>(
  <div className="rg">
    {opts.map(o=><div key={o} className={`rp${val===o?" sel":""}`} onClick={()=>onChange(val===o?"":o)}>{o}</div>)}
  </div>
);
const Check=({label,sub,on,toggle})=>(
  <div className={`ci${on?" on":""}`} onClick={toggle}>
    <div className={`cb${on?" on":""}`}/>
    <div><div className="cl">{label}</div>{sub&&<div className="cs">{sub}</div>}</div>
  </div>
);
const toggleArr=(arr,setFn,v)=>{const a=Array.isArray(arr)?arr:[];setFn(a.includes(v)?a.filter(x=>x!==v):[...a,v]);};
// Helpers for comma-string multi-select (past history, family history)
const strArr=(s)=>(s||"").split(",").map(x=>x.trim()).filter(Boolean);
const strIncludes=(s,v)=>strArr(s).includes(v);
const strToggle=(s,v,exclusive)=>{
  if(exclusive){return strIncludes(s,v)?"":v;}  // for "None" — clears everything else
  const arr=strArr(s).filter(x=>x!==exclusive&&x!=="None"); // deselect None if picking something
  return arr.includes(v)?arr.filter(x=>x!==v).join(", "):[...arr,v].join(", ");
};
const initials=n=>n.split(" ").filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase();
const riskClass=r=>`risk-${r||"Low"}`;
const genCode=()=>Math.random().toString(36).substr(2,6).toUpperCase();
const fmtDate=d=>new Date(d).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});
const STEPS=["Patient Info","Diet","Activity","Sleep","Bowel & Urine","Appetite & Stress","Habits","Goals"];
const INVESTIGATION_OPTS=["CBC","Blood Sugar F/PP","HbA1c","Lipid Profile","LFT","RFT / Creatinine","Thyroid (TSH)","ECG","2D Echo","Chest X-Ray","USG Abdomen","Vitamin D","Vitamin B12","Urine R/M","BMD","Other"];
const FOLLOWUP_OPTS=["1 week","2 weeks","4 weeks","6 weeks","3 months","6 months"];
const TIME_SUGGESTIONS=["7:30 AM","7:45 AM","8:00 AM","8:15 AM","8:30 AM","8:45 AM","9:00 AM","9:15 AM","9:30 AM","9:45 AM","10:00 AM","10:15 AM","10:30 AM","10:45 AM","11:00 AM","11:15 AM","11:30 AM","11:45 AM","12:00 PM","12:15 PM","12:30 PM","12:45 PM","1:00 PM","1:15 PM","1:30 PM","2:00 PM","2:15 PM","2:30 PM","2:45 PM","3:00 PM","3:15 PM","3:30 PM","3:45 PM","4:00 PM","4:15 PM","4:30 PM","4:45 PM","5:00 PM","5:15 PM","5:30 PM","5:45 PM","6:00 PM","6:30 PM","7:00 PM"];

/* ═══════════════════════════════════════════════════════════
   RX VIEW COMPONENT
═══════════════════════════════════════════════════════════ */
const RxView=({data,pt,doctorName})=>(
  <div id="print-rx">
    <div className="rx-wrap">
      <div className="rx-hdr">
        <div className="rx-hdr-stripe"/>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
          <img src={LOGO_HORIZONTAL} alt="Jayadev Memorial Rashtrotthana Hospital & Research Centre"
            style={{height:52,width:"auto",maxWidth:280}}/>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:12,fontWeight:600,color:C.teal700}}>Ayurvedic Lifestyle Prescription</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>Free Lifestyle Consultation</div>
          </div>
        </div>
        <div style={{borderTop:"1px solid",borderColor:C.divider,marginTop:14,paddingTop:12}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:C.teal900}}>{pt?.name}</div>
          <div className="rx-pt">{pt?.age} yrs · {pt?.gender} · {pt?.date}</div>
          <div className="rx-pt" style={{fontSize:11}}>Diagnosis: {pt?.diagnosis} | UHID: {pt?.uhid}{doctorName?` | ${doctorName}`:""}</div>
        </div>
      </div>
      <div className="rx-body">
        <div className="rx-sec">
          <div className="rx-sec-title">⚖️ Risk Category & Dosha</div>
          <span className={`risk-badge ${riskClass(data.riskCategory)}`}>{data.riskCategory} Lifestyle Risk</span>
          <div className="rx-text" style={{marginTop:10}}>{data.riskRationale}</div>
          <div style={{fontSize:13,color:C.muted,marginTop:8}}><strong>Dosha:</strong> {data.dosha}</div>
        </div>
        {data.shloka&&<div className="shloka-box">
          <div className="shloka-sk">{data.shloka.text}</div>
          <div className="shloka-tr">{data.shloka.transliteration}</div>
          <div className="shloka-en">"{data.shloka.translation}"</div>
          <div className="shloka-src">— {data.shloka.source}</div>
        </div>}
        <div className="rx-sec">
          <div className="rx-sec-title">📋 3 Prescriptions for This Visit</div>
          {data.threeRx?.map((r,i)=>(
            <div key={i} style={{display:"flex",gap:12,marginBottom:12,alignItems:"flex-start"}}>
              <div className="rx-num">{i+1}</div><div className="rx-text">{r}</div>
            </div>
          ))}
        </div>
        <div className="rx-sec"><div className="rx-sec-title">🍽️ Diet Prescription</div><div className="rx-text">{data.dietPrescription}</div></div>
        <div className="rx-sec"><div className="rx-sec-title">🏃 Physical Activity & Yoga</div><div className="rx-text">{data.activityPrescription}</div></div>
        <div className="rx-sec"><div className="rx-sec-title">🌙 Sleep & Dinacharya</div><div className="rx-text">{data.sleepPrescription}</div></div>
        <div className="rx-sec"><div className="rx-sec-title">💧 Agni & Digestive Health</div><div className="rx-text">{data.digestivePrescription}</div></div>
        <div className="rx-sec"><div className="rx-sec-title">🧘 Mind & Stress</div><div className="rx-text">{data.mindPrescription}</div></div>
        {data.specialNote&&<div className="rx-note"><div style={{fontSize:11,fontWeight:700,color:C.warn,marginBottom:4}}>⚠ CLINICAL NOTE</div><div className="rx-text">{data.specialNote}</div></div>}
        <div className="rx-footer">
          <div style={{fontSize:13,color:C.muted}}>Follow-up: <strong style={{color:C.text}}>{data.followUp}</strong></div>
          <div style={{fontSize:11,color:C.muted}}>Jayadev Memorial Rashtrotthana Hospital & Research Centre</div>
        </div>
      </div>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════
   OPD CONSULTANT NOTES SHEET
═══════════════════════════════════════════════════════════ */
const OpdSheet=({rec,notes,physicianName,specialty})=>{
  const pt=rec?.patient||{};
  const appt=rec?.apptData||{};
  return(
    <div id="print-opd" style={{background:"white",padding:"20px 28px",fontFamily:"sans-serif"}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
        <img src={LOGO_HORIZONTAL} alt="JMRH" style={{height:48,width:"auto"}}/>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:13,fontWeight:700,color:C.teal700}}>OPD Consultation Notes</div>
          <div style={{fontSize:11,color:C.muted}}>Primary Physician — Confidential</div>
        </div>
      </div>
      <div style={{borderTop:`2px solid ${C.teal700}`,marginBottom:14}}/>

      {/* Patient summary */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,background:C.teal50,borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12}}>
        <div><strong>Patient:</strong> {pt.name}</div>
        <div><strong>UHID:</strong> {pt.uhid}</div>
        <div><strong>Age / Gender:</strong> {pt.age}yr · {pt.gender}</div>
        <div><strong>Date:</strong> {new Date().toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</div>
        <div><strong>Referring Specialty:</strong> {appt.primarySpecialty||"—"}</div>
        <div><strong>Consultant:</strong> {physicianName}</div>
        <div style={{gridColumn:"span 2"}}><strong>Chief Complaint:</strong> {pt.chiefComplaint||appt.chiefComplaint||"—"}</div>
      </div>

      {/* Diagnosis */}
      <div style={{marginBottom:12}}>
        <div style={{fontSize:11,fontWeight:700,color:C.teal700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Diagnosis</div>
        <div style={{minHeight:32,borderBottom:`1px solid ${C.border}`,fontSize:13,paddingBottom:4}}>{notes.diagnosis||""}</div>
      </div>

      {/* Investigations */}
      {notes.investigations?.length>0&&<div style={{marginBottom:12}}>
        <div style={{fontSize:11,fontWeight:700,color:C.teal700,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Investigations Advised</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {notes.investigations.map(inv=>(
            <span key={inv} style={{background:C.teal50,border:`1px solid ${C.teal400}`,borderRadius:6,padding:"3px 10px",fontSize:12}}>{inv}</span>
          ))}
        </div>
      </div>}

      {/* Medications */}
      <div style={{marginBottom:12}}>
        <div style={{fontSize:11,fontWeight:700,color:C.teal700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Medications / Rx</div>
        <div style={{minHeight:48,borderBottom:`1px solid ${C.border}`,fontSize:13,whiteSpace:"pre-wrap",paddingBottom:4}}>{notes.medications||""}</div>
      </div>

      {/* Physician Notes */}
      <div style={{marginBottom:12}}>
        <div style={{fontSize:11,fontWeight:700,color:C.teal700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Physician Notes</div>
        <div style={{minHeight:56,borderBottom:`1px solid ${C.border}`,fontSize:13,whiteSpace:"pre-wrap",paddingBottom:4}}>{notes.notes||""}</div>
      </div>

      {/* Follow-up + Lifestyle risk */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
        <div>
          <div style={{fontSize:11,fontWeight:700,color:C.teal700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Follow-up</div>
          <div style={{fontSize:14,fontWeight:600}}>{notes.followUp||"—"}</div>
        </div>
        <div>
          <div style={{fontSize:11,fontWeight:700,color:C.teal700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Lifestyle Risk (from Lifestyle Rx)</div>
          <div style={{fontSize:14,fontWeight:600}}>{rec?.rx?.riskCategory||"—"}</div>
        </div>
      </div>

      {/* Signature */}
      <div style={{borderTop:`1px solid ${C.border}`,paddingTop:14,display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted}}>
        <div>Jayadev Memorial Rashtrotthana Hospital & Research Centre, Bengaluru</div>
        <div style={{textAlign:"right"}}>
          <div style={{borderTop:"1px solid #999",width:160,marginBottom:4}}/>
          <div>{physicianName}</div>
          <div>{specialty}</div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════ */
export default function App() {
  const [user,setUser]=useState(null);
  const [authRole,setAuthRole]=useState("");
  const [selDoc,setSelDoc]=useState("");
  const [pwd,setPwd]=useState("");
  const [adminPwd,setAdminPwd]=useState("");
  const [ptCode,setPtCode]=useState("");
  const [ptName,setPtName]=useState("");
  const [authErr,setAuthErr]=useState("");

  const [tab,setTab]=useState("home");
  const [step,setStep]=useState(0);
  const [loading,setLoading]=useState(false);
  const [rxResult,setRxResult]=useState(null);
  const [err,setErr]=useState("");
  const [archive,setArchive]=useState([]);
  const [allArchive,setAllArchive]=useState([]);
  const [appointments,setAppointments]=useState([]);
  const [viewRec,setViewRec]=useState(null);
  const [search,setSearch]=useState("");
  const [doctors,setDoctors]=useState(SEED_DOCTORS);
  const [modal,setModal]=useState(null); // {type, data}
  const [copied,setCopied]=useState(false);
  const [editedRx,setEditedRx]=useState(null);   // prescription being reviewed/edited
  const [editingRecId,setEditingRecId]=useState(null); // null=new, id=updating existing

  const printRx=()=>{document.body.setAttribute("data-print","rx");window.print();setTimeout(()=>document.body.removeAttribute("data-print"),500);};
  const printOpd=()=>{document.body.setAttribute("data-print","opd");window.print();setTimeout(()=>document.body.removeAttribute("data-print"),500);};

  // Form
  const ea=(v)=>Array.isArray(v)?v:[];  // ensureArray — guards against storage returning non-arrays
  const blankPt=()=>({name:"",age:"",gender:"",dob:"",bloodGroup:"",uhid:"",mobile:"",email:"",address:"",city:"",pincode:"",occupation:"",date:new Date().toISOString().split("T")[0],diagnosis:"",pastHistory:"",chiefComplaint:"",medications:"",allergies:"",height:"",weight:"",familyHistory:""});
  const [patient,setPatient]=useState(blankPt());
  const [diet,setDiet]=useState({wakeUp:"",breakfast:"",midMorning:[],lunch:"",eatBeh:[],postLunch:[],dinner:"",teaCoffee:[],restricted:""});
  // Guard: ensure diet arrays are always arrays after any set
  const safeDiet = {...diet,midMorning:ea(diet.midMorning),eatBeh:ea(diet.eatBeh),postLunch:ea(diet.postLunch),teaCoffee:ea(diet.teaCoffee)};
  const [activity,setActivity]=useState({current:""});
  const [sleep,setSleep]=useState({quality:"",sleepTime:"",screens:false,duration:"",daySleep:false});
  const [bowel,setBowel]=useState({freq:"",consistency:""});
  const [mic,setMic]=useState({dayFreq:"",nocturia:""});
  const [appetite,setAppetite]=useState({pattern:[],timing:""});
  const safeAppetite={...appetite,pattern:ea(appetite.pattern)};
  const [stress,setStress]=useState({level:"",sources:[]});
  const safeStress={...stress,sources:ea(stress.sources)};
  const [habits,setHabits]=useState({alcohol:"",smoking:"",others:""});
  const [menstrual,setMenstrual]=useState({applicable:"",cycle:"",flow:"",symptoms:[]});
  const safeMenstrual={...menstrual,symptoms:ea(menstrual.symptoms)};
  const [goals,setGoals]=useState([]);
  const safeGoals=ea(goals);

  // Patient portal state (separate from doctor form state)
  const [ptTab,setPtTab]=useState("home");      // home | form | prescriptions | view
  const [ptStep,setPtStep]=useState(0);
  const [patientAppt,setPatientAppt]=useState(null); // appointment patient is filling
  const [ptFormSaved,setPtFormSaved]=useState(false);

  // New doctor form
  const [newDoc,setNewDoc]=useState({id:"",name:"",specialty:"",dept:"",type:"primary",password:""});
  const [addDocErr,setAddDocErr]=useState("");

  // Physician OPD notes form
  const BLANK_PHY_NOTES=()=>({diagnosis:"",investigations:[],medications:"",followUp:"",notes:""});
  const [physNotes,setPhysNotes]=useState(BLANK_PHY_NOTES());
  const [physNotesSaved,setPhysNotesSaved]=useState(false);

  useEffect(()=>{
    initStorage();
  },[]);
  useEffect(()=>{
    if(user) loadData();
  },[user]);

  const initStorage=async()=>{
    // Always refresh DEMO01 with the latest seed data
    try { await storage.set("appt:DEMO01", JSON.stringify(DEMO_APPOINTMENT)); } catch(_) {}

    let storedDocs = null;
    try { storedDocs = await storage.get("doctors"); } catch(_) {}
    if(!storedDocs) {
      // First run — seed all doctors
      try { await storage.set("doctors",JSON.stringify(SEED_DOCTORS)); } catch(_) {}
      setDoctors(SEED_DOCTORS);
    } else {
      const parsed = JSON.parse(storedDocs.value);
      // Migrate old records that are missing the 'type' field
      const needsMigration = parsed.some(d=>!d.type);
      if(needsMigration) {
        const migrated = parsed.map(d=>({...d, type: d.type || (d.password?"lifestyle":"primary")}));
        try { await storage.set("doctors",JSON.stringify(migrated)); } catch(_) {}
        setDoctors(migrated);
      } else {
        setDoctors(parsed);
      }
    }
  };

  const loadData=async()=>{
    // Doctors
    try {
      const dres=await storage.get("doctors");
      if(dres) setDoctors(JSON.parse(dres.value));
    } catch(_) {}

    // Appointments
    try {
      const ares=await storage.list("appt:");
      const appts=[];
      if(ares) for(const k of ares.keys){
        try{const r=await storage.get(k);if(r)appts.push(JSON.parse(r.value));}catch(_){}
      }
      appts.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
      setAppointments(appts);
    } catch(_) {}

    // RX Records
    try {
      const rres=await storage.list("rx:");
      const allRecs=[];
      if(rres) for(const k of rres.keys){
        try{const r=await storage.get(k);if(r)allRecs.push(JSON.parse(r.value));}catch(_){}
      }
      allRecs.sort((a,b)=>new Date(b.savedAt)-new Date(a.savedAt));
      setAllArchive(allRecs);
      if(user?.role==="doctor") setArchive(allRecs.filter(r=>r.doctorId===user.id));
      else if(user?.role==="patient") setArchive(allRecs.filter(r=>r.patient?.uhid===user.id));
      else if(user?.role==="physician") setArchive(allRecs.filter(r=>r.apptData?.primaryDoctorId===user.id));
      else setArchive(allRecs);
    } catch(_) {}
  };

  /* ── AUTH ── */
  const loginAdmin=async()=>{
    if(adminPwd!==SEED_ADMIN.password){setAuthErr("Incorrect admin password.");return;}
    setUser({id:"ADMIN",name:"Medical Director",role:"admin"});
  };
  const loginDoctor=async()=>{
    setAuthErr("");
    // Load doctors — fall back to seed if storage unavailable
    let docs = [...SEED_DOCTORS];
    try {
      const stored = await storage.get("doctors");
      if(stored) docs = JSON.parse(stored.value);
    } catch(_) {}
    // Match: must be lifestyle type, correct ID, correct password
    const doc = docs.find(d =>
      d.id === selDoc &&
      (d.type === "lifestyle" || !d.type) &&
      d.password === pwd
    );
    if(!doc) { setAuthErr("Incorrect credentials. Check your Doctor ID and password."); return; }
    setUser({id:doc.id, name:doc.name, role:"doctor", specialty:doc.specialty});
  };
  const loginPhysician=async()=>{
    setAuthErr("");
    let docs = [...SEED_DOCTORS];
    try {
      const stored = await storage.get("doctors");
      if(stored) docs = JSON.parse(stored.value);
    } catch(_) {}
    const doc = docs.find(d => d.id === selDoc && d.type === "primary" && d.password === pwd);
    if(!doc) { setAuthErr("Incorrect credentials. Check your Doctor ID and password."); return; }
    setUser({id:doc.id, name:doc.name, role:"physician", specialty:doc.specialty});
  };
    setAuthErr("");
    const code = ptCode.toUpperCase().trim();
    // Try appointment code
    try {
      const res=await storage.list("appt:");
      if(res) for(const k of res.keys){
        try {
          const r=await storage.get(k);
          if(r){
            const appt=JSON.parse(r.value);
            if(appt.code===code){
              setUser({id:appt.patientUhid,name:appt.patientName,role:"patient",apptCode:appt.code});
              return;
            }
          }
        } catch(_) {}
      }
    } catch(_) {}
    // Try UHID lookup
    try {
      const rres=await storage.list("rx:");
      if(rres) for(const k of rres.keys){
        try {
          const r=await storage.get(k);
          if(r){
            const rec=JSON.parse(r.value);
            if(rec.patient?.uhid===code){
              setUser({id:rec.patient.uhid,name:ptName||rec.patient.name,role:"patient"});
              return;
            }
          }
        } catch(_) {}
      }
    } catch(_) {}
    setAuthErr("Code not found. Please check your SMS or contact reception.");
  };

  /* ── APPOINTMENT CREATION ── */
  const [newAppt,setNewAppt]=useState({patientName:"",mobile:"",email:"",visitType:"specialist",primarySpecialty:"",primaryDoctorId:"",lifestyleDoctorId:"",date:"",time:"",notes:""});
  const createAppt=async()=>{
    if(!newAppt.patientName||!newAppt.mobile){
      setErr("Patient name and mobile are required.");return;
    }
    if(newAppt.visitType==="specialist"&&!newAppt.primarySpecialty){
      setErr("Please select a specialty for specialist appointment.");return;
    }
    if(newAppt.visitType==="specialist"&&!newAppt.primaryDoctorId){
      setErr("Please assign a primary consultant before registering.");return;
    }
    if(!newAppt.lifestyleDoctorId){
      setErr("Please assign a lifestyle doctor before registering.");return;
    }
    const code=genCode();
    const uhid=newAppt.patientUhid||`RH-${Date.now().toString().slice(-5)}`;
    const primaryDoc = doctors.find(d=>d.id===newAppt.primaryDoctorId);
    const lifestyleDoc = doctors.find(d=>d.id===newAppt.lifestyleDoctorId);
    const appt={code,
      visitType:newAppt.visitType||"specialist",
      patientName:newAppt.patientName, age:newAppt.age, gender:newAppt.gender,
      patientUhid:uhid, mobile:newAppt.mobile, email:newAppt.email, address:newAppt.address,
      date:newAppt.date||new Date().toISOString().split("T")[0],
      time:newAppt.time,
      primarySpecialty:newAppt.primarySpecialty,
      primaryDoctorId:newAppt.primaryDoctorId, primaryDoctorName:primaryDoc?.name||"",
      doctorId:newAppt.lifestyleDoctorId, lifestyleDoctorName:lifestyleDoc?.name||"",
      chiefComplaint:newAppt.chiefComplaint, notes:newAppt.notes,
      lifestyleIncluded:true,
      status:"pending",createdAt:new Date().toISOString()};
    try{
      await storage.set(`appt:${code}`,JSON.stringify(appt));
      await loadData();
      setNewAppt({patientName:"",patientUhid:"",mobile:"",date:"",time:"",doctorId:"",notes:""});
      setErr("");
      setModal({type:"sms",data:appt});
    }catch(_){setErr("Failed to create appointment.");}
  };

  /* ── DOCTOR MANAGEMENT ── */
  const addDoctor=async()=>{
    if(!newDoc.id||!newDoc.name){setAddDocErr("Doctor ID and name are required.");return;}
    if(newDoc.type==="lifestyle"&&!newDoc.password){setAddDocErr("Lifestyle doctors require a password.");return;}
    try{
      const stored=await storage.get("doctors");
      const docs=stored?JSON.parse(stored.value):SEED_DOCTORS;
      if(docs.find(d=>d.id===newDoc.id)){setAddDocErr("Doctor ID already exists.");return;}
      const updated=[...docs,{...newDoc}];
      await storage.set("doctors",JSON.stringify(updated));
      setDoctors(updated);
      setNewDoc({id:"",name:"",specialty:"",dept:"Lifestyle Medicine",password:""});
      setAddDocErr("");
    }catch(_){setAddDocErr("Failed to add doctor.");}
  };
  const removeDoctor=async(id)=>{
    if(!window.confirm("Remove this doctor?"))return;
    try{
      const stored=await storage.get("doctors");
      const docs=stored?JSON.parse(stored.value):SEED_DOCTORS;
      const updated=docs.filter(d=>d.id!==id);
      await storage.set("doctors",JSON.stringify(updated));
      setDoctors(updated);
    }catch(_){}
  };

  /* ── PHYSICIAN NOTES ── */
  const savePhysicianNotes=async()=>{
    if(!viewRec)return;
    const updated={...viewRec,physicianNotes:physNotes};
    try{
      await storage.set(viewRec.id,JSON.stringify(updated));
      setViewRec(updated);
      setAllArchive(prev=>prev.map(r=>r.id===viewRec.id?updated:r));
      setArchive(prev=>prev.map(r=>r.id===viewRec.id?updated:r));
      setPhysNotesSaved(true);
      setTimeout(()=>setPhysNotesSaved(false),2500);
    }catch(_){}
  };

  /* ── FORM SAVE + AI ── */
  const resetForm=()=>{
    setPatient(blankPt());setStep(0);
    setDiet({wakeUp:"",breakfast:"",midMorning:[],lunch:"",eatBeh:[],postLunch:[],dinner:"",teaCoffee:[],restricted:""});
    setActivity({current:""});setSleep({quality:"",sleepTime:"",screens:false,duration:"",daySleep:false});
    setBowel({freq:"",consistency:""});setMic({dayFreq:"",nocturia:""});
    setAppetite({pattern:[],timing:""});setStress({level:"",sources:[]});
    setHabits({alcohol:"",smoking:"",others:""});
    setMenstrual({applicable:"",cycle:"",flow:"",symptoms:[]});
    setGoals([]);setRxResult(null);setErr("");
  };

  const preLoadFromAppt=(appt)=>{
    const d = appt.patientDemographics||{};
    const m = appt.patientMedical||{};
    setPatient({
      name:      d.name||appt.patientName,
      uhid:      appt.patientUhid,
      mobile:    d.mobile||appt.mobile,
      email:     d.email||appt.email||"",
      age:       d.age||"", gender:d.gender||"", dob:d.dob||"",
      bloodGroup:d.bloodGroup||"", address:d.address||"",
      city:      d.city||"", pincode:d.pincode||"", occupation:d.occupation||"",
      date:      appt.date||new Date().toISOString().split("T")[0],
      diagnosis: m.diagnosis||"",
      pastHistory:m.pastHistory||"",
      chiefComplaint:m.chiefComplaint||appt.notes||"",
      medications:m.medications||"", allergies:m.allergies||"",
      height:    m.height||"", weight:m.weight||"",
      familyHistory:m.familyHistory||""
    });
    if(appt.preFormData){
      const fd=appt.preFormData;
      if(fd.diet)     setDiet({...fd.diet,midMorning:ea(fd.diet.midMorning),eatBeh:ea(fd.diet.eatBeh),postLunch:ea(fd.diet.postLunch),teaCoffee:ea(fd.diet.teaCoffee)});
      if(fd.activity) setActivity(fd.activity);
      if(fd.sleep)    setSleep(fd.sleep);
      if(fd.bowel)    setBowel(fd.bowel);
      if(fd.mic)      setMic(fd.mic);
      if(fd.appetite) setAppetite({...fd.appetite,pattern:ea(fd.appetite.pattern)});
      if(fd.stress)   setStress({...fd.stress,sources:ea(fd.stress.sources)});
      if(fd.habits)   setHabits(fd.habits);
      if(fd.menstrual)setMenstrual({...fd.menstrual,symptoms:ea(fd.menstrual.symptoms)});
      if(fd.goals)    setGoals(ea(fd.goals));
    }
    setStep(0); setTab("form");
  };

  const savePatientForm=async()=>{
    if(!patientAppt) return;
    const formData={diet,activity,sleep,bowel,mic,appetite,stress,habits,menstrual,goals};
    const updated={...patientAppt,
      patientName: patient.name||patientAppt.patientName,
      mobile:      patient.mobile||patientAppt.mobile,
      email:       patient.email||patientAppt.email,
      preFormData: formData,
      patientDemographics: {
        name:patient.name, age:patient.age, gender:patient.gender, dob:patient.dob||"",
        bloodGroup:patient.bloodGroup||"", email:patient.email||"", mobile:patient.mobile,
        address:patient.address||"", city:patient.city||"", pincode:patient.pincode||"",
        occupation:patient.occupation||""
      },
      patientMedical: {
        chiefComplaint:patient.chiefComplaint||"",
        diagnosis:patient.diagnosis, pastHistory:patient.pastHistory,
        medications:patient.medications||"", allergies:patient.allergies||"",
        height:patient.height||"", weight:patient.weight||"",
        familyHistory:patient.familyHistory||""
      },
      status:"form_filled", formFilledAt:new Date().toISOString()};
    try { await storage.set(`appt:${patientAppt.code}`,JSON.stringify(updated)); } catch(_) {}
    setPatientAppt(updated);
    setPtFormSaved(true);
    setPtTab("confirmed");   // show dedicated confirmation screen
    await loadData();
  };

  const buildPrompt=()=>
    `You are a senior Ayurvedic physician at Jayadev Memorial Rashtrotthana Hospital, Bangalore. Generate a concise personalised lifestyle prescription grounded in classical Ayurvedic texts. Be brief — each field has a strict length limit.
PATIENT: ${patient.name} | Age: ${patient.age} | Gender: ${patient.gender} | UHID: ${patient.uhid}
Diagnosis: ${patient.diagnosis} | History: ${patient.pastHistory}
Complaint: ${patient.chiefComplaint||"NS"} | Meds: ${patient.medications||"None"} | Allergies: ${patient.allergies||"None"}
Height: ${patient.height||"NS"}cm | Weight: ${patient.weight||"NS"}kg | Family Hx: ${patient.familyHistory||"None"}
DIET: Wake ${diet.wakeUp||"NS"} | Breakfast ${diet.breakfast||"NS"} | Mid-morning ${(safeDiet.midMorning||[]).join(",")||"NS"} | Lunch ${diet.lunch||"NS"} | Behaviour ${(safeDiet.eatBeh||[]).join(",")||"NS"} | Evening ${(safeDiet.postLunch||[]).join(",")||"NS"} | Dinner ${diet.dinner||"NS"} | Tea ${(safeDiet.teaCoffee||[]).join(",")||"NS"} | Restricted: ${diet.restricted||"none"}
ACTIVITY: ${activity.current||"NS"} | SLEEP: ${sleep.quality||"NS"} ${sleep.sleepTime||"NS"} ${sleep.duration||"NS"} screens:${sleep.screens} daysleep:${sleep.daySleep}
BOWEL: ${bowel.freq||"NS"} ${bowel.consistency||"NS"} | MIC: day ${mic.dayFreq||"NS"} nocturia ${mic.nocturia||"NS"}
APPETITE: ${(safeAppetite.pattern||[]).join(",")||"NS"} ${appetite.timing||"NS"} | STRESS: ${stress.level||"NS"} sources:${(safeStress.sources||[]).join(",")||"NS"}
HABITS: alcohol:${habits.alcohol||"Non-drinker"} smoking:${habits.smoking||"Non-smoker"} other:${habits.others||"none"}
MENSTRUAL: ${menstrual.applicable==="Applicable"?`${menstrual.cycle} flow:${menstrual.flow} sx:${(safeMenstrual.symptoms||[]).join(",")}`:"NA"}
GOALS: ${(safeGoals||[]).join(",")||"none"}

Respond ONLY with a single raw JSON object. No markdown. No explanation. Strict field limits:
- riskCategory: exactly one word: Low, Moderate, or High
- riskRationale: max 2 short sentences
- dosha: max 10 words
- shloka.text: one Sanskrit verse (max 2 lines)
- shloka.transliteration: IAST transliteration of above
- shloka.translation: max 15 words
- shloka.source: text name and verse reference only
- threeRx: array of exactly 3 strings, each max 20 words
- dietPrescription: exactly 6 bullet points starting with •, each max 15 words
- activityPrescription: exactly 4 points, each max 15 words
- sleepPrescription: exactly 4 points, each max 15 words
- digestivePrescription: exactly 3 points, each max 15 words
- mindPrescription: exactly 4 points, each max 15 words
- followUp: exactly "2 weeks" or "4 weeks"
- specialNote: max 20 words, or empty string if none

{"riskCategory":"","riskRationale":"","dosha":"","shloka":{"text":"","transliteration":"","translation":"","source":""},"threeRx":["","",""],"dietPrescription":"","activityPrescription":"","sleepPrescription":"","digestivePrescription":"","mindPrescription":"","followUp":"","specialNote":""}`;

  const generate=async()=>{
    setLoading(true);setErr("");
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "anthropic-version":"2023-06-01",
          "anthropic-dangerous-direct-browser-access":"true",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_KEY
        },
        body:JSON.stringify({
          model:"claude-sonnet-4-6",
          max_tokens:8000,
          messages:[{role:"user",content:buildPrompt()}]
        })
      });
      const data=await res.json();
      if(data.error){setErr(`API error: ${data.error.message||JSON.stringify(data.error)}`);setLoading(false);return;}
      const raw=(data.content||[]).map(b=>b.text||"").join("");
      if(!raw){setErr("Empty response from API. Please try again.");setLoading(false);return;}
      const jsonStr=raw.replace(/```json|```/g,"").trim();
      let parsed;
      try{parsed=JSON.parse(jsonStr);}
      catch(pe){setErr("Could not parse prescription. Response: "+jsonStr.slice(0,200));setLoading(false);return;}
      setRxResult(parsed);
      setEditedRx(parsed);
      setEditingRecId(null); // new record — will be created on save
      setTab("review");
    }catch(e){setErr("Network error: "+e.message);}
    setLoading(false);
  };

  const saveReviewedRx=async()=>{
    if(!editedRx)return;
    setErr("");
    try{
      const linkedAppt=appointments.find(a=>a.patientUhid===patient.uhid&&a.doctorId===user.id);
      const recId=editingRecId||`rx:${user.id}:${Date.now()}`;
      const rec={id:recId,doctorId:user.id,doctorName:user.name,
        savedAt:new Date().toISOString(),patient:{...patient},rx:editedRx,
        formData:{diet,activity,sleep,bowel,mic,appetite,stress,habits,menstrual,goals},
        apptData:linkedAppt||null};
      await storage.set(recId,JSON.stringify(rec));
      await loadData();
      setViewRec(rec);setEditedRx(null);setEditingRecId(null);setTab("view");
    }catch(e){setErr("Failed to save: "+e.message);}
  };
  const buildHIS=(rec)=>JSON.stringify({
    version:"1.0",hospital:"JMRH",exportDate:new Date().toISOString().split("T")[0],
    registrationSource:"JMRH Patient Services Portal",
    patient:{
      name:rec.patient.name, uhid:rec.patient.uhid,
      age:rec.patient.age||"", gender:rec.patient.gender||"",
      dob:rec.patient.dob||"", bloodGroup:rec.patient.bloodGroup||"",
      mobile:rec.patient.mobile||"", email:rec.patient.email||"",
      address:[rec.patient.address,rec.patient.city,rec.patient.pincode].filter(Boolean).join(", "),
      occupation:rec.patient.occupation||"",
      diagnosis:rec.patient.diagnosis, pastHistory:rec.patient.pastHistory,
      chiefComplaint:rec.patient.chiefComplaint||"",
      medications:rec.patient.medications||"", allergies:rec.patient.allergies||"",
      height:rec.patient.height||"", weight:rec.patient.weight||"",
      familyHistory:rec.patient.familyHistory||""
    },
    visitType:rec.apptData?.visitType||"specialist",
    primaryConsultation:{
      specialty:rec.apptData?.primarySpecialty||rec.patient.diagnosis||"",
      consultant:rec.apptData?.primaryDoctorName||"",
      chiefComplaint:rec.apptData?.chiefComplaint||"",
      appointmentCode:rec.apptData?.code||""
    },
    lifestyleConsultation:{
      date:rec.patient.date, doctor:rec.doctorName,
      department:"Lifestyle Medicine", type:"Outpatient – Free Lifestyle Consultation",
      riskCategory:rec.rx.riskCategory, doshaImbalance:rec.rx.dosha,
      followUp:rec.rx.followUp, threeRx:rec.rx.threeRx
    },
    lifestyleAssessment:{
      diet:{wakeUp:rec.formData?.diet?.wakeUp,breakfast:rec.formData?.diet?.breakfast,dinner:rec.formData?.diet?.dinner,teaCoffee:rec.formData?.diet?.teaCoffee,eatingBehaviour:rec.formData?.diet?.eatBeh},
      activity:rec.formData?.activity?.current,
      sleep:{quality:rec.formData?.sleep?.quality,duration:rec.formData?.sleep?.duration,screens:rec.formData?.sleep?.screens},
      stress:{level:rec.formData?.stress?.level,sources:rec.formData?.stress?.sources},
      bowel:{frequency:rec.formData?.bowel?.freq,consistency:rec.formData?.bowel?.consistency},
      appetite:{pattern:rec.formData?.appetite?.pattern,timing:rec.formData?.appetite?.timing},
      habits:{alcohol:rec.formData?.habits?.alcohol,smoking:rec.formData?.habits?.smoking}
    }
  },null,2);

  const copiedMsg=()=>{setCopied(true);setTimeout(()=>setCopied(false),2200);};

  /* ══════════════════════════════════════════════════════════
     SCREENS
  ══════════════════════════════════════════════════════════ */

  /* ── AUTH ── */
  if(!user) return (
    <>
      <style>{G}</style>
      <div className="auth-shell">
        <div className="auth-top" style={{textAlign:"center"}}>
          <img src={LOGO_STACKED} alt="JMRH" style={{width:220,height:"auto",margin:"0 auto",display:"block"}}/>
          <div className="auth-motto">सर्वे सन्तु निरामयाः · May all be free from disease</div>
        </div>
        <div className="auth-body">
          <div className="auth-card fade">
            {!authRole&&<>
              <div className="auth-h">JMRH Patient Services</div>
              <div className="auth-sub">Free consultations for all patients · Select your role</div>
              <div className="role-grid">
                {[{r:"admin",i:"🛡️",l:"Admin",d:"Manage doctors & appointments"},{r:"doctor",i:"🌿",l:"Lifestyle Doctor",d:"Consultations & patient records"},{r:"physician",i:"👨‍⚕️",l:"Primary Physician",d:"View lifestyle Rx for your patients"},{r:"patient",i:"🧑‍💼",l:"Patient",d:"Fill health form & view records"}].map(x=>(
                  <div key={x.r} className={`role-btn${authRole===x.r?" sel":""}`} onClick={()=>{setAuthRole(x.r);setAuthErr("");}}>
                    <div className="ri">{x.i}</div><div className="rl">{x.l}</div><div className="rd">{x.d}</div>
                  </div>
                ))}
              </div>
            </>}

            {authRole==="admin"&&<>
              <div className="auth-h">Admin Login</div>
              <div className="auth-sub">Medical Director / Administration</div>
              <div className="fg"><div className="fl">Admin Password</div>
                <input className="ti" type="password" placeholder="Enter admin password" value={adminPwd} onChange={e=>setAdminPwd(e.target.value)} onKeyDown={e=>e.key==="Enter"&&loginAdmin()}/>
              </div>
              {authErr&&<div className="err-box">{authErr}</div>}
              <button className="btn btn-teal btn-full" onClick={loginAdmin}>Sign In as Admin →</button>
              <div className="auth-note" style={{marginTop:12}}>Demo: jmrh@admin</div>
            </>}

            {authRole==="doctor"&&<>
              <div className="auth-h">Doctor Login</div>
              <div className="auth-sub">Select your name and enter your password</div>
              {doctors.filter(d=>d.type==="lifestyle"||!d.type).map(d=>(
                <div key={d.id} className={`doc-opt${selDoc===d.id?" sel":""}`} onClick={()=>setSelDoc(d.id)}>
                  <div className="dav">{initials(d.name)}</div>
                  <div><div style={{fontSize:14,fontWeight:600,color:C.text}}>{d.name}</div><div style={{fontSize:11,color:C.muted}}>{d.specialty}</div></div>
                </div>
              ))}
              <div className="fg" style={{marginTop:8}}><div className="fl">Password</div>
                <input className="ti" type="password" placeholder="Enter your password" value={pwd} onChange={e=>setPwd(e.target.value)} onKeyDown={e=>e.key==="Enter"&&loginDoctor()}/>
              </div>
              {authErr&&<div className="err-box">{authErr}</div>}
              <button className="btn btn-teal btn-full" onClick={loginDoctor} disabled={!selDoc||!pwd}>Sign In →</button>
              <div className="auth-note" style={{marginTop:12}}>Demo: DR001 → jmrh001 · DR002 → jmrh002</div>
            </>}

            {authRole==="physician"&&<>
              <div className="auth-h">Primary Physician Login</div>
              <div className="auth-sub">Select your name and enter your password</div>
              {doctors.filter(d=>d.type==="primary"&&d.password).map(d=>(
                <div key={d.id} className={`doc-opt${selDoc===d.id?" sel":""}`} onClick={()=>setSelDoc(d.id)}>
                  <div className="dav">{initials(d.name)}</div>
                  <div><div style={{fontSize:14,fontWeight:600,color:C.text}}>{d.name}</div><div style={{fontSize:11,color:C.muted}}>{d.specialty}</div></div>
                </div>
              ))}
              <div className="fg" style={{marginTop:8}}><div className="fl">Password</div>
                <input className="ti" type="password" placeholder="Enter your password" value={pwd} onChange={e=>setPwd(e.target.value)} onKeyDown={e=>e.key==="Enter"&&loginPhysician()}/>
              </div>
              {authErr&&<div className="err-box">{authErr}</div>}
              <button className="btn btn-teal btn-full" onClick={loginPhysician} disabled={!selDoc||!pwd}>Sign In →</button>
              <div className="auth-note" style={{marginTop:12}}>Demo: PC001 → jmrh@pc01</div>
            </>}

            {authRole==="patient"&&<>
              <div className="auth-h">Patient Login</div>
              <div className="auth-sub">Enter the appointment code sent to your mobile, or your UHID</div>
              <div className="fg"><div className="fl">Appointment Code or UHID</div>
                <input className="ti" placeholder="e.g. A3BX9K or RH-00123" value={ptCode} onChange={e=>setPtCode(e.target.value)} style={{letterSpacing:2,textTransform:"uppercase"}}/>
              </div>
              {authErr&&<div className="err-box">{authErr}</div>}
              <div className="info-box">Your code was sent by SMS when your appointment was confirmed.<br/><strong>Demo:</strong> use code <span style={{fontFamily:"monospace",fontWeight:700,letterSpacing:2}}>DEMO01</span> to try the patient portal.</div>
              <button className="btn btn-rust btn-full" onClick={loginPatient} disabled={!ptCode}>Open My Health Portal →</button>
            </>}

            {authRole&&<div style={{marginTop:14,textAlign:"center"}}>
              <span style={{fontSize:12,color:C.teal700,cursor:"pointer"}} onClick={()=>{setAuthRole("");setAuthErr("");setPwd("");setAdminPwd("");setSelDoc("");}}>← Back</span>
            </div>}
          </div>
        </div>
      </div>
    </>
  );

  /* ── LOADING ── */
  if(loading) return (
    <>
      <style>{G}</style>
      <div style={{background:C.bg,minHeight:"100vh"}}>
        <div className="nav"><HospLogo variant="nav"/></div>
        <div className="page" style={{textAlign:"center",paddingTop:60}}>
          <div className="spin"/><div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:C.teal900,marginBottom:6}}>Consulting the ancient texts…</div>
          <div style={{fontSize:12,color:C.muted}}>Generating prescription for {patient.name}</div>
        </div>
      </div>
    </>
  );

  /* ── MODALS ── */
  const Modal=()=>{
    if(!modal)return null;
    if(modal.type==="sms"){
      const a=modal.data;
      const doc=doctors.find(d=>d.id===a.doctorId);
      const primaryDoc2 = doctors.find(d=>d.id===a.primaryDoctorId);
      const visitLabel = a.visitType==="mhc"?"Master Health Check-up":a.visitType==="walkin_mhc"?"Master Health Check-up (Walk-in)":"Specialist Consultation";
      const smsText=a.visitType==="walkin_mhc"
        ?`Dear ${a.patientName},

Welcome to Jayadev Memorial Rashtrotthana Hospital!

While you wait for your Master Health Check-up, please take 5 minutes to fill your health form. This will be used for your complimentary Lifestyle Consultation.

➡ lifestyle.jmrh.in

Your code: ${a.code}

सर्वे सन्तु निरामयाः — Jayadev Memorial Rashtrotthana Hospital`
        :`Dear ${a.patientName},

Your appointment at Jayadev Memorial Rashtrotthana Hospital is confirmed.

📅 ${fmtDate(a.date)}${a.time?`  ⏰ ${a.time}`:""}
🏥 ${visitLabel}${a.primarySpecialty?`\n   ${a.primarySpecialty}`:""}${primaryDoc2?`\n   ${primaryDoc2.name}`:""}${a.chiefComplaint?`\n   "${a.chiefComplaint}"`:""}

🌿 Free Lifestyle Consultation included.
   Please fill your health form before visiting — it takes 5 minutes:
   ➡ lifestyle.jmrh.in

Your code: ${a.code}

सर्वे सन्तु निरामयाः
Jayadev Memorial Rashtrotthana Hospital & Research Centre`
      return (
        <div className="overlay" onClick={()=>setModal(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">✅ Appointment Created</div>
            <div className="modal-sub">Send this SMS to the patient's mobile: {a.mobile}</div>
            <div className="code-display">
              <div className="code-num">{a.code}</div>
              <div className="code-label">Appointment Code</div>
            </div>
            <div className="sms-box">{smsText}</div>
            <div style={{display:"flex",gap:10}}>
              <button className="btn btn-teal" style={{flex:1}} onClick={()=>{navigator.clipboard?.writeText(smsText);copiedMsg();}}>
                {copied?"✓ Copied!":"📋 Copy SMS"}
              </button>
              <button className="btn btn-ghost" style={{flex:1}} onClick={()=>setModal(null)}>Close</button>
            </div>
          </div>
        </div>
      );
    }
    if(modal.type==="his"){
      const json=buildHIS(modal.data);
      return(
        <div className="overlay" onClick={()=>setModal(null)}>
          <div className="modal" style={{maxWidth:560}} onClick={e=>e.stopPropagation()}>
            <div className="modal-title">📤 HIS Export Data</div>
            <div className="modal-sub">Copy this JSON to import into your reception / HIS software</div>
            <div className="his-box">{json}</div>
            <div style={{display:"flex",gap:10}}>
              <button className="btn btn-teal" style={{flex:1}} onClick={()=>{navigator.clipboard?.writeText(json);copiedMsg();}}>
                {copied?"✓ Copied!":"📋 Copy JSON"}
              </button>
              <button className="btn btn-lime" style={{flex:1}} onClick={()=>{
                const blob=new Blob([json],{type:"application/json"});
                const a=document.createElement("a");a.href=URL.createObjectURL(blob);
                a.download=`JMRH_${modal.data.patient.uhid}_${modal.data.patient.date}.json`;a.click();
              }}>⬇ Download</button>
              <button className="btn btn-ghost" onClick={()=>setModal(null)}>✕</button>
            </div>
            <div className="info-box" style={{marginTop:12,marginBottom:0}}>In a live deployment this would POST directly to your HIS API endpoint. Ask your IT team to configure the endpoint URL.</div>
          </div>
        </div>
      );
    }
    return null;
  };

  /* ── PATIENT PORTAL ── */
  if(user.role==="patient") {
    // Find this patient's pending appointments
    const myAppts = appointments.filter(a=>a.patientUhid===user.id);
    const pendingAppt = myAppts.find(a=>a.status==="pending"||a.status==="form_filled");

    // Patient form — reuses the same step components, 7 steps only (no patient info step)
    // Step 0 here = Diet (doctor's step 1), mapped as ptStep 0–6
    const PT_STEPS = ["About You","Your Visit","Dietary Habits","Activity","Sleep","Bowel & Urine","Appetite & Stress","Habits","Goals"];

    const PatientFormStep = () => {
      const s = ptStep;

      // Step 0: Demographics
      if(s===0) return(
        <div className="card">
          <div className="sec-head"><div className="sec-icon">👤</div><div className="sec-title">About You</div></div>
          <div className="sec-desc">Tell us a little about yourself</div>
          <div className="r2 fg">
            <div><div className="fl">Full Name</div>
              <input className="ti" placeholder="Your full name" value={patient.name}
                onChange={e=>setPatient({...patient,name:e.target.value})}/>
            </div>
            <div><div className="fl">Date of Birth</div>
              <input type="date" className="ti" value={patient.dob||""}
                onChange={e=>setPatient({...patient,dob:e.target.value})}/>
            </div>
          </div>
          <div className="r3 fg">
            <div><div className="fl">Age</div>
              <input className="ti" placeholder="Years" value={patient.age}
                onChange={e=>setPatient({...patient,age:e.target.value})}/>
            </div>
            <div><div className="fl">Gender</div>
              <select className="si" value={patient.gender} onChange={e=>setPatient({...patient,gender:e.target.value})}>
                <option value="">Select</option><option>Male</option><option>Female</option><option>Other</option>
              </select>
            </div>
            <div><div className="fl">Blood Group</div>
              <select className="si" value={patient.bloodGroup||""} onChange={e=>setPatient({...patient,bloodGroup:e.target.value})}>
                <option value="">Select</option>
                {["A+","A-","B+","B-","AB+","AB-","O+","O-","Unknown"].map(b=><option key={b}>{b}</option>)}
              </select>
            </div>
          </div>
          <div className="r2 fg">
            <div><div className="fl">Mobile</div>
              <input className="ti" placeholder="+91 XXXXX XXXXX" value={patient.mobile}
                onChange={e=>setPatient({...patient,mobile:e.target.value})}/>
            </div>
            <div><div className="fl">Email</div>
              <input className="ti" placeholder="your@email.com" value={patient.email||""}
                onChange={e=>setPatient({...patient,email:e.target.value})}/>
            </div>
          </div>
          <div className="fg"><div className="fl">Address</div>
            <input className="ti" placeholder="House / Flat, Street, Area" value={patient.address||""}
              onChange={e=>setPatient({...patient,address:e.target.value})}/>
          </div>
          <div className="r3 fg">
            <div><div className="fl">City</div>
              <input className="ti" placeholder="City" value={patient.city||""} onChange={e=>setPatient({...patient,city:e.target.value})}/>
            </div>
            <div><div className="fl">Pincode</div>
              <input className="ti" placeholder="560001" value={patient.pincode||""} onChange={e=>setPatient({...patient,pincode:e.target.value})}/>
            </div>
            <div><div className="fl">Occupation</div>
              <input className="ti" placeholder="e.g. Engineer, Homemaker" value={patient.occupation||""} onChange={e=>setPatient({...patient,occupation:e.target.value})}/>
            </div>
          </div>
          <div className="info-box" style={{marginBottom:0}}>Your UHID will be assigned by the hospital — you don't need to fill this.</div>
        </div>
      );

      // Step 1: Reason for visit + medical history
      if(s===1) {
        // Chief complaint helpers
        const ccInList = CHIEF_COMPLAINTS.includes(patient.chiefComplaint);
        const ccSelectVal = ccInList ? patient.chiefComplaint : patient.chiefComplaint ? "Other" : "";
        const ccShowText = patient.chiefComplaint==="Other"||(patient.chiefComplaint&&!ccInList);
        // Diagnosis helpers
        const dxInList = DIAGNOSES.includes(patient.diagnosis);
        const dxSelectVal = dxInList ? patient.diagnosis : patient.diagnosis ? "Other" : "";
        const dxShowText = patient.diagnosis==="Other"||(patient.diagnosis&&!dxInList);
        // Past history helpers
        const phArr2 = strArr(patient.pastHistory);
        const phCustom = phArr2.filter(v=>!PAST_HISTORY_OPTS.includes(v)).join(", ");
        // Family history helpers
        const fhArr2 = strArr(patient.familyHistory);
        const fhCustom = fhArr2.filter(v=>!FAMILY_HISTORY_OPTS.includes(v)).join(", ");

        return(
          <div className="card">
            <div className="sec-head"><div className="sec-icon">🏥</div><div className="sec-title">Your Visit</div></div>
            <div className="sec-desc">Tell us why you're visiting and your health background</div>

            {/* Chief Complaint */}
            {patientAppt?.visitType==="specialist"&&(
              <div className="fg">
                <div className="fl">Reason for Visit / Chief Complaint</div>
                <select className="si" value={ccSelectVal}
                  onChange={e=>{setPatient({...patient,chiefComplaint:e.target.value});}}>
                  <option value="">Select your main concern…</option>
                  {CHIEF_COMPLAINTS.map(c=><option key={c}>{c}</option>)}
                </select>
                {ccShowText&&<input className="ti" style={{marginTop:8}} placeholder="Describe your main concern…"
                  value={patient.chiefComplaint==="Other"?"":patient.chiefComplaint}
                  onChange={e=>setPatient({...patient,chiefComplaint:e.target.value})}/>}
              </div>
            )}

            {/* Current Diagnosis */}
            <div className="fg">
              <div className="fl">Current Diagnosis (if any)</div>
              <select className="si" value={dxSelectVal}
                onChange={e=>setPatient({...patient,diagnosis:e.target.value})}>
                <option value="">Select diagnosis…</option>
                {DIAGNOSES.map(d=><option key={d}>{d}</option>)}
              </select>
              {dxShowText&&<input className="ti" style={{marginTop:8}} placeholder="Enter diagnosis…"
                value={patient.diagnosis==="Other"?"":patient.diagnosis}
                onChange={e=>setPatient({...patient,diagnosis:e.target.value})}/>}
            </div>

            {/* Past Medical History */}
            <div className="fg">
              <div className="fl">Past Medical History</div>
              <div style={{display:"flex",flexDirection:"column",gap:2}}>
                {PAST_HISTORY_OPTS.map(o=>(
                  <Check key={o} label={o}
                    on={strIncludes(patient.pastHistory,o)}
                    toggle={()=>{
                      if(o==="None"){setPatient({...patient,pastHistory:strIncludes(patient.pastHistory,"None")?"":"None"});}
                      else{
                        const arr=phArr2.filter(x=>x!=="None");
                        const updated=arr.includes(o)?arr.filter(x=>x!==o):[...arr,o];
                        setPatient({...patient,pastHistory:updated.join(", ")});
                      }
                    }}/>
                ))}
              </div>
              {!strIncludes(patient.pastHistory,"None")&&(
                <input className="ti" style={{marginTop:8}} placeholder="Anything else to add? (optional)"
                  value={phCustom}
                  onChange={e=>{
                    const preset=phArr2.filter(v=>PAST_HISTORY_OPTS.includes(v));
                    setPatient({...patient,pastHistory:[...preset,e.target.value].filter(Boolean).join(", ")});
                  }}/>
              )}
            </div>

            {/* Current Medications */}
            <div className="fg"><div className="fl">Current Medications</div>
              <input className="ti" placeholder="List any medicines you take regularly"
                value={patient.medications||""} onChange={e=>setPatient({...patient,medications:e.target.value})}/>
            </div>

            {/* Known Allergies */}
            <div className="fg"><div className="fl">Known Allergies</div>
              <input className="ti" placeholder="Food, drug or other allergies (or 'None')"
                value={patient.allergies||""} onChange={e=>setPatient({...patient,allergies:e.target.value})}/>
            </div>

            {/* Height / Weight */}
            <div className="r2 fg">
              <div><div className="fl">Height (cm)</div>
                <input className="ti" placeholder="e.g. 168" value={patient.height||""} onChange={e=>setPatient({...patient,height:e.target.value})}/>
              </div>
              <div><div className="fl">Weight (kg)</div>
                <input className="ti" placeholder="e.g. 72" value={patient.weight||""} onChange={e=>setPatient({...patient,weight:e.target.value})}/>
              </div>
            </div>

            {/* Family History */}
            <div className="fg">
              <div className="fl">Family History</div>
              <div style={{display:"flex",flexDirection:"column",gap:2}}>
                {FAMILY_HISTORY_OPTS.map(o=>(
                  <Check key={o} label={o}
                    on={strIncludes(patient.familyHistory,o)}
                    toggle={()=>{
                      if(o==="None"){setPatient({...patient,familyHistory:strIncludes(patient.familyHistory,"None")?"":"None"});}
                      else{
                        const arr=fhArr2.filter(x=>x!=="None");
                        const updated=arr.includes(o)?arr.filter(x=>x!==o):[...arr,o];
                        setPatient({...patient,familyHistory:updated.join(", ")});
                      }
                    }}/>
                ))}
              </div>
              {!strIncludes(patient.familyHistory,"None")&&(
                <input className="ti" style={{marginTop:8}} placeholder="Anything else to add? (optional)"
                  value={fhCustom}
                  onChange={e=>{
                    const preset=fhArr2.filter(v=>FAMILY_HISTORY_OPTS.includes(v));
                    setPatient({...patient,familyHistory:[...preset,e.target.value].filter(Boolean).join(", ")});
                  }}/>
              )}
            </div>
          </div>
        );
      }

      // Steps 2–8: lifestyle (same questions, offset by 2)
      const ls = s - 2; // lifestyle step index 0–6
      if(ls===0) return(
        <div className="card">
          <div className="sec-head"><div className="sec-icon">🍽️</div><div className="sec-title">Dietary Habits</div></div>
          <div className="sec-desc">Tell us about your daily eating habits</div>
          <div className="fg"><div className="fl">Wake-up Time</div><RadioGroup opts={["Before 6 am","6–7 am","After 7 am"]} val={diet.wakeUp} onChange={v=>setDiet({...diet,wakeUp:v})}/></div>
          <div className="divider"/>
          <div className="fg"><div className="fl">Breakfast</div><RadioGroup opts={["Skipped regularly","Delayed (>2 hrs)","On time"]} val={diet.breakfast} onChange={v=>setDiet({...diet,breakfast:v})}/></div>
          <div className="divider"/>
          <div className="fg"><div className="fl">Mid-morning Intake</div>{["No intake","Only Tea/Coffee","Fruits","Packaged snacks","Biscuits"].map(o=><Check key={o} label={o} on={safeDiet.midMorning.includes(o)} toggle={()=>toggleArr(diet.midMorning,v=>setDiet({...diet,midMorning:v}),o)}/>)}</div>
          <div className="divider"/>
          <div className="fg"><div className="fl">Lunch Pattern</div><RadioGroup opts={["Skipped","Delayed","Irregular","Regular"]} val={diet.lunch} onChange={v=>setDiet({...diet,lunch:v})}/></div>
          <div className="divider"/>
          <div className="fg"><div className="fl">Eating Behaviour</div>{["Frequent junk food","Frequent outside food >3x/week","Overeating","Excess fried/oily/spicy food","Frequent snacking","More than 1 spoon sugar/day"].map(o=><Check key={o} label={o} on={safeDiet.eatBeh.includes(o)} toggle={()=>toggleArr(diet.eatBeh,v=>setDiet({...diet,eatBeh:v}),o)}/>)}</div>
          <div className="divider"/>
          <div className="fg"><div className="fl">Post-lunch / Evening Snacks</div>{["Tea/Coffee","Sweets","Snacks","Juice","Biscuits","None"].map(o=><Check key={o} label={o} on={safeDiet.postLunch.includes(o)} toggle={()=>toggleArr(diet.postLunch,v=>setDiet({...diet,postLunch:v}),o)}/>)}</div>
          <div className="divider"/>
          <div className="fg"><div className="fl">Dinner</div><RadioGroup opts={["Skipped","Late (>8:30 pm)","Heavy meal","Light & on time"]} val={diet.dinner} onChange={v=>setDiet({...diet,dinner:v})}/></div>
          <div className="divider"/>
          <div className="fg"><div className="fl">Tea / Coffee</div>{["On empty stomach","More than 3/day","With meals"].map(o=><Check key={o} label={o} on={safeDiet.teaCoffee.includes(o)} toggle={()=>toggleArr(diet.teaCoffee,v=>setDiet({...diet,teaCoffee:v}),o)}/>)}</div>
        </div>
      );
      if(ls===1) return(<div className="card"><div className="sec-head"><div className="sec-icon">🏃</div><div className="sec-title">Physical Activity</div></div><div className="sec-desc">Your current exercise habit</div>{[{l:"Regular walking / exercise / yoga",s:"Consistent routine"},{l:"No exercise",s:"Sedentary lifestyle"},{l:"Sedentary >6 hrs daily",s:"Long sitting periods"},{l:"Irregular activity",s:"No fixed routine"},{l:"No stretching",s:"Skips flexibility"}].map(o=><Check key={o.l} label={o.l} sub={o.s} on={activity.current===o.l} toggle={()=>setActivity({current:activity.current===o.l?"":o.l})}/>)}</div>);
      if(ls===2) return(<div className="card"><div className="sec-head"><div className="sec-icon">🌙</div><div className="sec-title">Sleep</div></div><div className="sec-desc">Your sleep quality and habits</div><div className="fg"><div className="fl">Sleep Quality</div><RadioGroup opts={["Good","Bad","Disturbed"]} val={sleep.quality} onChange={v=>setSleep({...sleep,quality:v})}/></div><div className="divider"/><div className="fg"><div className="fl">Sleep Time</div><RadioGroup opts={["Before 10 pm","10 pm–12 am","After 12 am"]} val={sleep.sleepTime} onChange={v=>setSleep({...sleep,sleepTime:v})}/></div><div className="divider"/><div className="fg"><div className="fl">Duration</div><RadioGroup opts={["< 6 hrs","6–7 hrs","7–8 hrs","> 8 hrs"]} val={sleep.duration} onChange={v=>setSleep({...sleep,duration:v})}/></div><div className="divider"/><div className="fg"><div className="fl">Other Habits</div><Check label="Screen use before bed" sub="Phone/TV within 1 hr" on={sleep.screens} toggle={()=>setSleep({...sleep,screens:!sleep.screens})}/><Check label="Day sleep habit" sub="Regular afternoon nap" on={sleep.daySleep} toggle={()=>setSleep({...sleep,daySleep:!sleep.daySleep})}/></div></div>);
      if(ls===3) return(<div className="card"><div className="sec-head"><div className="sec-icon">💧</div><div className="sec-title">Bowel & Urination</div></div><div className="sec-desc">Digestive and urinary habits</div><div className="fg"><div className="fl">Bowel Frequency</div><RadioGroup opts={["1/day","2/day",">2/day","Alternate days","Irregular"]} val={bowel.freq} onChange={v=>setBowel({...bowel,freq:v})}/></div><div className="divider"/><div className="fg"><div className="fl">Consistency</div><RadioGroup opts={["Hard","Normal","Loose"]} val={bowel.consistency} onChange={v=>setBowel({...bowel,consistency:v})}/></div><div className="divider"/><div className="fg"><div className="fl">Daytime Urination</div><RadioGroup opts={["4–6 times","6–8 times",">8 times"]} val={mic.dayFreq} onChange={v=>setMic({...mic,dayFreq:v})}/></div><div className="divider"/><div className="fg"><div className="fl">Night-time Urination</div><RadioGroup opts={["0","1","2",">2"]} val={mic.nocturia} onChange={v=>setMic({...mic,nocturia:v})}/></div></div>);
      if(ls===4) return(<div className="card"><div className="sec-head"><div className="sec-icon">🧘</div><div className="sec-title">Appetite & Stress</div></div><div className="sec-desc">How you eat and feel</div><div className="fg"><div className="fl">Appetite</div>{["Good","Low","Excess","Variable","Cravings"].map(o=><Check key={o} label={o} on={safeAppetite.pattern.includes(o)} toggle={()=>toggleArr(appetite.pattern,v=>setAppetite({...appetite,pattern:v}),o)}/>)}</div><div className="divider"/><div className="fg"><div className="fl">Meal Timing</div><RadioGroup opts={["Timely","Delayed","Late-night hunger"]} val={appetite.timing} onChange={v=>setAppetite({...appetite,timing:v})}/></div><div className="divider"/><div className="fg"><div className="fl">Stress Level</div><RadioGroup opts={["Low","Moderate","High"]} val={stress.level} onChange={v=>setStress({...stress,level:v})}/></div><div className="divider"/><div className="fg"><div className="fl">Main Stress Sources</div>{["Work","Family","Financial","Health","Other"].map(o=><Check key={o} label={o} on={safeStress.sources.includes(o)} toggle={()=>toggleArr(stress.sources,v=>setStress({...stress,sources:v}),o)}/>)}</div></div>);
      if(ls===5) return(
        <div className="card">
          <div className="sec-head"><div className="sec-icon">🚭</div><div className="sec-title">Habits</div></div>
          <div className="sec-desc">Please answer honestly — this helps your doctor</div>
          <div className="fg">
            <div className="fl">Alcohol</div>
            <select className="si" value={habits.alcohol} onChange={e=>setHabits({...habits,alcohol:e.target.value})}>
              <option value="">Select…</option>
              {ALCOHOL_OPTS.map(o=><option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="fg">
            <div className="fl">Smoking</div>
            <select className="si" value={habits.smoking} onChange={e=>setHabits({...habits,smoking:e.target.value})}>
              <option value="">Select…</option>
              {SMOKING_OPTS.map(o=><option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="fg"><div className="fl">Other (tobacco, pan masala, etc.)</div>
            <input className="ti" placeholder="Optional" value={habits.others} onChange={e=>setHabits({...habits,others:e.target.value})}/>
          </div>
          <div className="divider"/>
          <div className="fg"><div className="fl">Menstrual Health</div>
            <RadioGroup opts={["Applicable","Not applicable (Male)"]} val={menstrual.applicable} onChange={v=>setMenstrual({...menstrual,applicable:v})}/>
          </div>
          {menstrual.applicable==="Applicable"&&<>
            <div className="fg"><div className="fl">Cycle</div><RadioGroup opts={["Regular","Irregular","Menopause"]} val={menstrual.cycle} onChange={v=>setMenstrual({...menstrual,cycle:v})}/></div>
            <div className="fg"><div className="fl">Flow</div><RadioGroup opts={["Normal","Scanty","Heavy"]} val={menstrual.flow} onChange={v=>setMenstrual({...menstrual,flow:v})}/></div>
            <div className="fg"><div className="fl">Symptoms</div>
              {["Nil","Pain","PMS","Clots","Mood swings"].map(o=><Check key={o} label={o}
                on={safeMenstrual.symptoms.includes(o)}
                toggle={()=>{
                  if(o==="Nil"){setMenstrual({...menstrual,symptoms:safeMenstrual.symptoms.includes("Nil")?[]:["Nil"]});}
                  else{const arr=safeMenstrual.symptoms.filter(x=>x!=="Nil");toggleArr(arr,v=>setMenstrual({...menstrual,symptoms:v}),o);}
                }}/>)}
            </div>
          </>}
        </div>
      );
      if(ls===6) return(
        <div className="card">
          <div className="sec-head"><div className="sec-icon">🎯</div><div className="sec-title">Your Goals</div></div>
          <div className="sec-desc">What would you like to work on?</div>
          <div className="gg">{[{k:"Diet",i:"🍽️",d:"Fixed timings, less outside food"},{k:"Exercise",i:"🏃",d:"Regular walking and stretching"},{k:"Sleep",i:"🌙",d:"Better sleep routine"},{k:"Stress",i:"🧘",d:"Breathing, meditation"},{k:"Substance Reduction",i:"🚭",d:"Gradual reduction"},].map(g=><div key={g.k} className={`gc${safeGoals.includes(g.k)?" on":""}`} onClick={()=>setGoals(p=>p.includes(g.k)?p.filter(x=>x!==g.k):[...p,g.k])}><div className="gt">{g.i} {g.k}</div><div className="gi">{g.d}</div></div>)}</div>
          <div style={{background:C.teal50,border:`1px solid ${C.teal100}`,borderRadius:10,padding:"14px 16px",marginTop:16}}>
            <div style={{fontSize:13,fontWeight:600,color:C.teal900,marginBottom:4}}>✅ Almost done!</div>
            <div style={{fontSize:12,color:C.muted}}>Click "Submit" to send your completed health form to your doctor.</div>
          </div>
        </div>
      );
      return null;
    };
    return (
      <>
        <style>{G}</style>
        <div style={{background:C.bg,minHeight:"100vh"}}>
          <div className="nav no-print">
            <HospLogo variant="nav"/>
            <div className="nav-r">
              {ptTab==="form"&&<button className="nbtn" onClick={()=>{setPtTab("home");setPtStep(0);}}>← Back</button>}
              {ptTab!=="form"&&ptTab!=="view"&&archive.length>0&&<button className={`ntab${ptTab==="prescriptions"?" on":""}`} onClick={()=>setPtTab("prescriptions")}>📋 My Health Records</button>}
              <span style={{background:C.rust,color:"white",fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:20}}>Patient Portal</span>
              <button className="nbtn" onClick={()=>{setUser(null);setArchive([]);setPtCode("");setPtStep(0);setPtTab("home");}}>Sign Out</button>
            </div>
          </div>

          {/* Progress bar during patient form */}
          {ptTab==="form"&&(
            <div className="prog-bar">
              <div className="prog-inner">
                <div className="prog-lbl">
                  <span className="prog-name">{PT_STEPS[ptStep]}</span>
                  <span className="prog-ct">Step {ptStep+1} of {PT_STEPS.length}</span>
                </div>
                <div className="prog-track"><div className="prog-fill" style={{width:`${((ptStep+1)/PT_STEPS.length)*100}%`}}/></div>
              </div>
            </div>
          )}

          <div className="page fade">
            {/* PATIENT HOME */}
            {ptTab==="home"&&(
              <>
                <div style={{background:`linear-gradient(135deg,${C.teal900},${C.teal700})`,borderRadius:14,padding:22,marginBottom:16,color:"white"}}>
                  <div style={{fontSize:11,opacity:.65,letterSpacing:1.5,textTransform:"uppercase",marginBottom:4}}>Welcome</div>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:22}}>{user.name}</div>
                  <div style={{fontSize:12,opacity:.7,marginTop:3}}>UHID: {user.id}</div>
                </div>

                {/* Pending appointment with form CTA */}
                {pendingAppt&&(
                  <div className="card" style={{borderColor:pendingAppt.status==="form_filled"?C.lime:C.teal400,borderWidth:2}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
                      <div>
                        <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,color:C.teal900,marginBottom:6}}>📅 Upcoming Appointment</div>
                        <div style={{fontSize:14,fontWeight:600}}>{fmtDate(pendingAppt.date)}{pendingAppt.time?` at ${pendingAppt.time}`:""}</div>
                        {pendingAppt.visitType&&<div style={{marginTop:4}}>
                        <span className={`tag ${pendingAppt.visitType==="walkin_mhc"?"tag-rust":pendingAppt.visitType==="mhc"?"tag-lime":"tag-teal"}`} style={{fontSize:10}}>
                          {pendingAppt.visitType==="walkin_mhc"?"Walk-in MHC":pendingAppt.visitType==="mhc"?"Master Health Check-up":"Specialist Consultation"}
                        </span>
                      </div>}
                      {pendingAppt.primarySpecialty&&pendingAppt.visitType==="specialist"&&<div style={{fontSize:13,color:C.muted,marginTop:3}}>{pendingAppt.primarySpecialty}{pendingAppt.primaryDoctorName?` · ${pendingAppt.primaryDoctorName}`:""}</div>}
                        {pendingAppt.chiefComplaint&&<div style={{fontSize:12,color:C.muted,fontStyle:"italic",marginTop:2}}>"{pendingAppt.chiefComplaint}"</div>}
                      </div>
                      <span className={`tag ${pendingAppt.status==="form_filled"?"tag-lime":"tag-warn"}`} style={{fontSize:11}}>
                        {pendingAppt.status==="form_filled"?"✓ Form submitted":"Form pending"}
                      </span>
                    </div>

                    {/* Lifestyle consultation CTA */}
                    <div style={{borderTop:`1px solid ${C.divider}`,marginTop:14,paddingTop:14}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                        <div style={{background:C.teal50,borderRadius:8,padding:"6px 10px",fontSize:12,color:C.teal700,fontWeight:600}}>
                          🌿 Free Lifestyle Consultation included
                        </div>
                      </div>
                      {pendingAppt.status==="form_filled"?(
                        <div>
                          <div className="success-box" style={{marginBottom:10}}>✓ Health form submitted on {fmtDate(pendingAppt.formFilledAt)}. Your doctor has your information.</div>
                          <button className="btn btn-ghost" style={{fontSize:13}} onClick={()=>{
                            // Load existing form data to allow editing
                            const d2=pendingAppt.patientDemographics||{};
                          const m2=pendingAppt.patientMedical||{};
                          setPatient(p=>({...p,
                            name:d2.name||pendingAppt.patientName||p.name,
                            mobile:d2.mobile||pendingAppt.mobile||p.mobile,
                            email:d2.email||pendingAppt.email||p.email||"",
                            age:d2.age||"",gender:d2.gender||"",dob:d2.dob||"",bloodGroup:d2.bloodGroup||"",
                            address:d2.address||"",city:d2.city||"",pincode:d2.pincode||"",occupation:d2.occupation||"",
                            diagnosis:m2.diagnosis||"",pastHistory:m2.pastHistory||"",
                            chiefComplaint:m2.chiefComplaint||"",medications:m2.medications||"",
                            allergies:m2.allergies||"",height:m2.height||"",weight:m2.weight||"",familyHistory:m2.familyHistory||""
                          }));
                          if(pendingAppt.preFormData){const fd=pendingAppt.preFormData;if(fd.diet)setDiet({...fd.diet,midMorning:ea(fd.diet.midMorning),eatBeh:ea(fd.diet.eatBeh),postLunch:ea(fd.diet.postLunch),teaCoffee:ea(fd.diet.teaCoffee)});if(fd.activity)setActivity(fd.activity);if(fd.sleep)setSleep(fd.sleep);if(fd.bowel)setBowel(fd.bowel);if(fd.mic)setMic(fd.mic);if(fd.appetite)setAppetite({...fd.appetite,pattern:ea(fd.appetite.pattern)});if(fd.stress)setStress({...fd.stress,sources:ea(fd.stress.sources)});if(fd.habits)setHabits(fd.habits);if(fd.menstrual)setMenstrual({...fd.menstrual,symptoms:ea(fd.menstrual.symptoms)});if(fd.goals)setGoals(ea(fd.goals));}
                          setPatientAppt(pendingAppt);setPtStep(0);setPtTab("form");
                          }}>✎ Edit my health form</button>
                        </div>
                      ):(
                        <div>
                          <div style={{fontSize:13,color:C.muted,marginBottom:10}}>Save time at your consultation — fill your health form now. It takes about 5 minutes.</div>
                          <button className="btn btn-teal" style={{width:"100%",justifyContent:"center",padding:13}} onClick={()=>{
                            // Pre-populate name, mobile, email from appointment
                          setPatient(p=>({...p,
                            name:pendingAppt.patientName||p.name,
                            mobile:pendingAppt.mobile||p.mobile,
                            email:pendingAppt.email||p.email||"",
                          }));
                          setPatientAppt(pendingAppt);setPtStep(0);setPtFormSaved(false);setPtTab("form");
                          }}>Fill My Health Form →</button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Past prescriptions preview */}
                {archive.length>0&&(
                  <div className="card">
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                      <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,color:C.teal900}}>My Health Records</div>
                      {archive.length>2&&<button className="btn btn-ghost" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>setPtTab("prescriptions")}>View all ({archive.length})</button>}
                    </div>
                    {archive.slice(0,2).map((r,i)=>(
                      <div key={i} className="arch-card" style={{marginBottom:8}} onClick={()=>{setViewRec(r);setPtTab("view");}}>
                        <div className="arch-name">{r.patient?.diagnosis||"Lifestyle Consultation"}</div>
                        <div className="arch-diag">{r.doctorName}</div>
                        <div className="arch-meta">
                          <div className="arch-date">{fmtDate(r.savedAt)}</div>
                          {r.rx?.riskCategory&&<span className={`risk-badge ${riskClass(r.rx.riskCategory)}`}>{r.rx.riskCategory}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!pendingAppt&&archive.length===0&&(
                  <div style={{textAlign:"center",padding:"48px 20px",color:C.muted}}>
                    <div style={{fontSize:36,marginBottom:12}}>🌿</div>
                    <div style={{fontSize:16,fontWeight:600,marginBottom:4}}>No appointments yet</div>
                    <div style={{fontSize:13}}>Ask the reception desk to register you for a free lifestyle consultation.</div>
                  </div>
                )}
              </>
            )}

            {/* PATIENT FORM */}
            {ptTab==="form"&&(
              <>
                <div style={{background:C.teal50,border:`1px solid ${C.teal100}`,borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:C.teal700}}>
                  {patientAppt?.visitType==="walkin_mhc"
                    ?"Please fill this while you wait — your doctor will review it shortly."
                    :"Your answers are shared with your doctor before your appointment. All details are confidential."}
                </div>
                {PatientFormStep()}
                <div className="nav-row">
                  <button className="btn btn-ghost" onClick={()=>ptStep>0?setPtStep(s=>s-1):setPtTab("home")}>{ptStep===0?"← Back":"← Previous"}</button>
                  {ptStep<PT_STEPS.length-1
                    ?<button className="btn btn-teal" onClick={()=>setPtStep(s=>s+1)}>Continue →</button>
                    :<button className="btn btn-lime" style={{padding:"11px 28px"}} onClick={savePatientForm}>✓ Submit Health Form</button>
                  }
                </div>
              </>
            )}

            {/* PRESCRIPTIONS LIST */}
            {ptTab==="prescriptions"&&(
              <>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:C.teal900,marginBottom:14}}>My Health Records</div>
                <div className="arch-grid">
                  {archive.map((r,i)=>(
                    <div key={i} className="arch-card" onClick={()=>{setViewRec(r);setPtTab("view");}}>
                      <div className="arch-name">{r.patient?.diagnosis||"Lifestyle Consultation"}</div>
                      <div className="arch-diag">{r.doctorName}</div>
                      <div className="arch-meta">
                        <div className="arch-date">{fmtDate(r.savedAt)}</div>
                        {r.rx?.riskCategory&&<span className={`risk-badge ${riskClass(r.rx.riskCategory)}`}>{r.rx.riskCategory}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* CONFIRMATION SCREEN */}
            {ptTab==="confirmed"&&patientAppt&&(
              <div className="fade">
                {/* Hero confirmation */}
                <div style={{background:`linear-gradient(135deg,${C.teal900},${C.teal700})`,borderRadius:16,padding:"32px 24px",marginBottom:16,color:"white",textAlign:"center"}}>
                  <div style={{fontSize:52,marginBottom:12}}>✅</div>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,marginBottom:8}}>Health Form Submitted!</div>
                  <div style={{fontSize:14,opacity:.8,lineHeight:1.6}}>
                    Thank you, {patientAppt.patientName}. Your information has been sent to your doctor.
                  </div>
                </div>

                {/* What happens next */}
                <div className="card">
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,color:C.teal900,marginBottom:16}}>What happens next</div>
                  {[
                    {icon:"👨‍⚕️", title:"Doctor reviews your form", desc:"Your lifestyle doctor will go through your responses before you arrive — your consultation will be focused and efficient."},
                    {icon:"🌿", title:"Free Lifestyle Consultation", desc:"Alongside your primary appointment, you'll receive a personalised Ayurvedic lifestyle prescription at no extra cost."},
                    {icon:"📋", title:"Your records are saved", desc:"All your health information is stored securely. You can view and download your prescription here after the consultation."},
                    {icon:"✏️",  title:"Need to make changes?", desc:"You can edit your form any time before your appointment using the button below."},
                  ].map((s,i)=>(
                    <div key={i} style={{display:"flex",gap:14,marginBottom:16,alignItems:"flex-start"}}>
                      <div style={{width:38,height:38,borderRadius:10,background:C.teal50,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{s.icon}</div>
                      <div>
                        <div style={{fontSize:14,fontWeight:600,color:C.teal900,marginBottom:2}}>{s.title}</div>
                        <div style={{fontSize:13,color:C.muted,lineHeight:1.55}}>{s.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Appointment details recap */}
                <div className="card" style={{borderColor:C.teal400,borderWidth:1.5}}>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:C.teal900,marginBottom:12}}>📅 Your Appointment</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    {[
                      {l:"Date",    v:patientAppt.date?new Date(patientAppt.date).toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"}):"To be confirmed"},
                      {l:"Time",    v:patientAppt.time||"To be confirmed"},
                      {l:"Specialty", v:patientAppt.primarySpecialty||(patientAppt.visitType==="mhc"||patientAppt.visitType==="walkin_mhc"?"Master Health Check-up":"—")},
                      {l:"Doctor",  v:patientAppt.primaryDoctorName||"As assigned"},
                    ].map(r=>(
                      <div key={r.l} style={{background:C.bg,borderRadius:8,padding:"10px 12px"}}>
                        <div style={{fontSize:10,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:0.8,marginBottom:3}}>{r.l}</div>
                        <div style={{fontSize:13,fontWeight:600,color:C.text}}>{r.v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{marginTop:12,padding:"10px 12px",background:C.teal50,borderRadius:8,display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontSize:16}}>🌿</span>
                    <span style={{fontSize:12,color:C.teal700}}>Free Lifestyle Consultation included with your visit</span>
                  </div>
                </div>

                {/* What to bring */}
                <div className="card">
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:C.teal900,marginBottom:12}}>🎒 What to bring</div>
                  {["Government photo ID (Aadhaar / PAN / Passport)","Previous medical reports, test results, or prescriptions","List of any current medications","Insurance card (if applicable)"].map((item,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<3?`1px solid ${C.divider}`:"none"}}>
                      <div style={{width:6,height:6,borderRadius:"50%",background:C.teal600,flexShrink:0}}/>
                      <div style={{fontSize:13,color:C.text}}>{item}</div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:24}}>
                  <button className="btn btn-ghost" style={{flex:1}} onClick={()=>{
                    const d2=patientAppt.patientDemographics||{};
                    const m2=patientAppt.patientMedical||{};
                    setPatient(p=>({...p,name:d2.name||patientAppt.patientName,mobile:d2.mobile||patientAppt.mobile,email:d2.email||patientAppt.email||"",age:d2.age||"",gender:d2.gender||"",dob:d2.dob||"",bloodGroup:d2.bloodGroup||"",address:d2.address||"",city:d2.city||"",pincode:d2.pincode||"",occupation:d2.occupation||"",diagnosis:m2.diagnosis||"",pastHistory:m2.pastHistory||"",chiefComplaint:m2.chiefComplaint||"",medications:m2.medications||"",allergies:m2.allergies||"",height:m2.height||"",weight:m2.weight||"",familyHistory:m2.familyHistory||""}));
                    if(patientAppt.preFormData){const fd=patientAppt.preFormData;if(fd.diet)setDiet({...fd.diet,midMorning:ea(fd.diet.midMorning),eatBeh:ea(fd.diet.eatBeh),postLunch:ea(fd.diet.postLunch),teaCoffee:ea(fd.diet.teaCoffee)});if(fd.activity)setActivity(fd.activity);if(fd.sleep)setSleep(fd.sleep);if(fd.bowel)setBowel(fd.bowel);if(fd.mic)setMic(fd.mic);if(fd.appetite)setAppetite({...fd.appetite,pattern:ea(fd.appetite.pattern)});if(fd.stress)setStress({...fd.stress,sources:ea(fd.stress.sources)});if(fd.habits)setHabits(fd.habits);if(fd.menstrual)setMenstrual({...fd.menstrual,symptoms:ea(fd.menstrual.symptoms)});if(fd.goals)setGoals(ea(fd.goals));}
                    setPtStep(0);setPtTab("form");
                  }}>✎ Edit my form</button>
                  <button className="btn btn-teal" style={{flex:1}} onClick={()=>setPtTab("home")}>
                    Go to My Portal →
                  </button>
                </div>
              </div>
            )}

            {/* PRESCRIPTION VIEW */}
            {ptTab==="view"&&viewRec&&(
              <div>
                <div className="rx-actions no-print">
                  <button className="btn btn-ghost" onClick={()=>setPtTab(archive.length>2?"prescriptions":"home")}>← Back</button>
                  <button className="btn btn-rust" onClick={printRx}>🖨️ Print / Save PDF</button>
                </div>
                <RxView data={viewRec.rx} pt={viewRec.patient} doctorName={viewRec.doctorName}/>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  /* ── FORM STEPS ── */
  const StepContent=()=>{
    if(step===0)return(
      <div className="card">
        <div className="sec-head"><div className="sec-icon">📋</div><div className="sec-title">Patient Summary</div></div>
        <div className="sec-desc">Review patient-filled information — edit as needed</div>

        {/* UHID — read only, assigned by hospital */}
        <div className="r2 fg">
          <div>
            <div className="fl">UHID</div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input className="ti" style={{fontFamily:"monospace",fontWeight:700,color:C.teal700}} placeholder="Auto-assigned" value={patient.uhid} onChange={e=>setPatient({...patient,uhid:e.target.value})}/>
            </div>
            <div style={{fontSize:10,color:C.muted,marginTop:3}}>Assign UHID when patient arrives (or leave — auto-generated)</div>
          </div>
          <div><div className="fl">Consultation Date</div><input type="date" className="ti" value={patient.date} onChange={e=>setPatient({...patient,date:e.target.value})}/></div>
        </div>

        <div className="r3 fg">
          <div><div className="fl">Full Name</div><input className="ti" value={patient.name} onChange={e=>setPatient({...patient,name:e.target.value})}/></div>
          <div><div className="fl">Age</div><input className="ti" value={patient.age} onChange={e=>setPatient({...patient,age:e.target.value})}/></div>
          <div><div className="fl">Gender</div><select className="si" value={patient.gender} onChange={e=>setPatient({...patient,gender:e.target.value})}><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></div>
        </div>
        <div className="r2 fg">
          <div><div className="fl">Mobile</div><input className="ti" value={patient.mobile} onChange={e=>setPatient({...patient,mobile:e.target.value})}/></div>
          <div><div className="fl">Email</div><input className="ti" value={patient.email||""} onChange={e=>setPatient({...patient,email:e.target.value})}/></div>
        </div>
        {(patient.address||patient.city)&&<div className="fg"><div className="fl">Address</div><input className="ti" value={`${patient.address||""} ${patient.city||""} ${patient.pincode||""}`.trim()} readOnly style={{color:C.muted}}/></div>}
        {patient.occupation&&<div className="fg"><div className="fl">Occupation</div><input className="ti" value={patient.occupation} readOnly style={{color:C.muted}}/></div>}

        <div className="divider"/>
        {patient.chiefComplaint!==undefined&&(()=>{
          const ccInList=CHIEF_COMPLAINTS.includes(patient.chiefComplaint);
          const ccSelectVal=ccInList?patient.chiefComplaint:patient.chiefComplaint?"Other":"";
          const ccShowText=patient.chiefComplaint==="Other"||(patient.chiefComplaint&&!ccInList);
          return(<div className="fg"><div className="fl">Chief Complaint</div>
            <select className="si" value={ccSelectVal} onChange={e=>setPatient({...patient,chiefComplaint:e.target.value})}>
              <option value="">Select…</option>{CHIEF_COMPLAINTS.map(c=><option key={c}>{c}</option>)}
            </select>
            {ccShowText&&<input className="ti" style={{marginTop:8}} placeholder="Describe…"
              value={patient.chiefComplaint==="Other"?"":patient.chiefComplaint}
              onChange={e=>setPatient({...patient,chiefComplaint:e.target.value})}/>}
          </div>);
        })()}
        {(()=>{
          const dxInList=DIAGNOSES.includes(patient.diagnosis);
          const dxSelectVal=dxInList?patient.diagnosis:patient.diagnosis?"Other":"";
          const dxShowText=patient.diagnosis==="Other"||(patient.diagnosis&&!dxInList);
          return(<div className="fg"><div className="fl">Diagnosis</div>
            <select className="si" value={dxSelectVal} onChange={e=>setPatient({...patient,diagnosis:e.target.value})}>
              <option value="">Select…</option>{DIAGNOSES.map(d=><option key={d}>{d}</option>)}
            </select>
            {dxShowText&&<input className="ti" style={{marginTop:8}} placeholder="Enter diagnosis…"
              value={patient.diagnosis==="Other"?"":patient.diagnosis}
              onChange={e=>setPatient({...patient,diagnosis:e.target.value})}/>}
          </div>);
        })()}
        <div className="fg"><div className="fl">Past Medical / Surgical History</div>
          <div style={{display:"flex",flexDirection:"column",gap:2}}>
            {PAST_HISTORY_OPTS.map(o=><Check key={o} label={o}
              on={strIncludes(patient.pastHistory,o)}
              toggle={()=>{
                if(o==="None"){setPatient({...patient,pastHistory:strIncludes(patient.pastHistory,"None")?"":"None"});}
                else{const arr=strArr(patient.pastHistory).filter(x=>x!=="None");const updated=arr.includes(o)?arr.filter(x=>x!==o):[...arr,o];setPatient({...patient,pastHistory:updated.join(", ")});}
              }}/>)}
          </div>
          {!strIncludes(patient.pastHistory,"None")&&<input className="ti" style={{marginTop:8}} placeholder="Other…"
            value={strArr(patient.pastHistory).filter(v=>!PAST_HISTORY_OPTS.includes(v)).join(", ")}
            onChange={e=>{const preset=strArr(patient.pastHistory).filter(v=>PAST_HISTORY_OPTS.includes(v));setPatient({...patient,pastHistory:[...preset,e.target.value].filter(Boolean).join(", ")});}}/>}
        </div>
        {patient.medications&&<div className="fg"><div className="fl">Current Medications</div><input className="ti" value={patient.medications} onChange={e=>setPatient({...patient,medications:e.target.value})}/></div>}
        {patient.allergies&&<div className="fg"><div className="fl">Allergies</div><input className="ti" value={patient.allergies} onChange={e=>setPatient({...patient,allergies:e.target.value})}/></div>}
        <div className="r2 fg">
          {patient.height&&<div><div className="fl">Height (cm)</div><input className="ti" value={patient.height} onChange={e=>setPatient({...patient,height:e.target.value})}/></div>}
          {patient.weight&&<div><div className="fl">Weight (kg)</div><input className="ti" value={patient.weight} onChange={e=>setPatient({...patient,weight:e.target.value})}/></div>}
        </div>
        <div className="fg"><div className="fl">Family History</div>
          <div style={{display:"flex",flexDirection:"column",gap:2}}>
            {FAMILY_HISTORY_OPTS.map(o=><Check key={o} label={o}
              on={strIncludes(patient.familyHistory,o)}
              toggle={()=>{
                if(o==="None"){setPatient({...patient,familyHistory:strIncludes(patient.familyHistory,"None")?"":"None"});}
                else{const arr=strArr(patient.familyHistory).filter(x=>x!=="None");const updated=arr.includes(o)?arr.filter(x=>x!==o):[...arr,o];setPatient({...patient,familyHistory:updated.join(", ")});}
              }}/>)}
          </div>
          {!strIncludes(patient.familyHistory,"None")&&<input className="ti" style={{marginTop:8}} placeholder="Other…"
            value={strArr(patient.familyHistory).filter(v=>!FAMILY_HISTORY_OPTS.includes(v)).join(", ")}
            onChange={e=>{const preset=strArr(patient.familyHistory).filter(v=>FAMILY_HISTORY_OPTS.includes(v));setPatient({...patient,familyHistory:[...preset,e.target.value].filter(Boolean).join(", ")});}}/>}
        </div>
      </div>
    );
    if(step===1)return(
      <div className="card">
        <div className="sec-head"><div className="sec-icon">🍽️</div><div className="sec-title">Dietary Habits</div></div>
        <div className="sec-desc">Review current dietary habits</div>
        <div className="fg"><div className="fl">Wake-up Time</div><RadioGroup opts={["Before 6 am","6–7 am","After 7 am"]} val={diet.wakeUp} onChange={v=>setDiet({...diet,wakeUp:v})}/></div>
        <div className="divider"/>
        <div className="fg"><div className="fl">Breakfast</div><RadioGroup opts={["Skipped regularly","Delayed (>2 hrs)","On time"]} val={diet.breakfast} onChange={v=>setDiet({...diet,breakfast:v})}/></div>
        <div className="divider"/>
        <div className="fg"><div className="fl">Mid-morning Intake</div>{["No intake","Only Tea/Coffee","Fruits","Packaged snacks","Biscuits"].map(o=><Check key={o} label={o} on={safeDiet.midMorning.includes(o)} toggle={()=>toggleArr(diet.midMorning,v=>setDiet({...diet,midMorning:v}),o)}/>)}</div>
        <div className="divider"/>
        <div className="fg"><div className="fl">Lunch Pattern</div><RadioGroup opts={["Skipped","Delayed","Irregular","Regular"]} val={diet.lunch} onChange={v=>setDiet({...diet,lunch:v})}/></div>
        <div className="divider"/>
        <div className="fg"><div className="fl">Eating Behaviour</div>{["Frequent junk food","Frequent outside food >3x/week","Overeating","Excess fried/oily/spicy food","Frequent snacking","More than 1 spoon sugar/day"].map(o=><Check key={o} label={o} on={safeDiet.eatBeh.includes(o)} toggle={()=>toggleArr(diet.eatBeh,v=>setDiet({...diet,eatBeh:v}),o)}/>)}</div>
        <div className="divider"/>
        <div className="fg"><div className="fl">Post-lunch / Evening</div>{["Tea/Coffee","Sweets","Snacks","Juice","Biscuits","None"].map(o=><Check key={o} label={o} on={safeDiet.postLunch.includes(o)} toggle={()=>toggleArr(diet.postLunch,v=>setDiet({...diet,postLunch:v}),o)}/>)}</div>
        <div className="divider"/>
        <div className="fg"><div className="fl">Dinner Pattern</div><RadioGroup opts={["Skipped","Late (>8:30 pm)","Heavy meal","Light & on time"]} val={diet.dinner} onChange={v=>setDiet({...diet,dinner:v})}/></div>
        <div className="divider"/>
        <div className="fg"><div className="fl">Tea / Coffee</div>{["On empty stomach","More than 3/day","With meals"].map(o=><Check key={o} label={o} on={safeDiet.teaCoffee.includes(o)} toggle={()=>toggleArr(diet.teaCoffee,v=>setDiet({...diet,teaCoffee:v}),o)}/>)}</div>
        <div className="divider"/>
        <div className="fg"><div className="fl">Restricted Items</div><input className="ti" placeholder="Disease-specific restrictions" value={diet.restricted} onChange={e=>setDiet({...diet,restricted:e.target.value})}/></div>
      </div>
    );
    if(step===2)return(<div className="card"><div className="sec-head"><div className="sec-icon">🏃</div><div className="sec-title">Physical Activity</div></div><div className="sec-desc">Current exercise habit</div>{[{l:"Regular walking / exercise / yoga",s:"Consistent routine"},{l:"No exercise",s:"Sedentary lifestyle"},{l:"Sedentary >6 hrs daily",s:"Long sitting periods"},{l:"Irregular activity",s:"No fixed routine"},{l:"No stretching",s:"Skips flexibility"}].map(o=><Check key={o.l} label={o.l} sub={o.s} on={activity.current===o.l} toggle={()=>setActivity({current:activity.current===o.l?"":o.l})}/>)}</div>);
    if(step===3)return(<div className="card"><div className="sec-head"><div className="sec-icon">🌙</div><div className="sec-title">Sleep Correction</div></div><div className="sec-desc">Sleep quality & Dinacharya</div><div className="fg"><div className="fl">Sleep Quality</div><RadioGroup opts={["Good","Bad","Disturbed"]} val={sleep.quality} onChange={v=>setSleep({...sleep,quality:v})}/></div><div className="divider"/><div className="fg"><div className="fl">Sleep Time</div><RadioGroup opts={["Before 10 pm","10 pm–12 am","After 12 am"]} val={sleep.sleepTime} onChange={v=>setSleep({...sleep,sleepTime:v})}/></div><div className="divider"/><div className="fg"><div className="fl">Duration</div><RadioGroup opts={["< 6 hrs","6–7 hrs","7–8 hrs","> 8 hrs"]} val={sleep.duration} onChange={v=>setSleep({...sleep,duration:v})}/></div><div className="divider"/><div className="fg"><div className="fl">Other</div><Check label="Screen use before bed" sub="Phone/TV within 1 hr" on={sleep.screens} toggle={()=>setSleep({...sleep,screens:!sleep.screens})}/><Check label="Day sleep habit" sub="Regular afternoon nap" on={sleep.daySleep} toggle={()=>setSleep({...sleep,daySleep:!sleep.daySleep})}/></div></div>);
    if(step===4)return(<div className="card"><div className="sec-head"><div className="sec-icon">💧</div><div className="sec-title">Bowel & Micturition</div></div><div className="sec-desc">Digestive & urinary</div><div className="fg"><div className="fl">Bowel Frequency</div><RadioGroup opts={["1/day","2/day",">2/day","Alternate days","Irregular"]} val={bowel.freq} onChange={v=>setBowel({...bowel,freq:v})}/></div><div className="divider"/><div className="fg"><div className="fl">Consistency</div><RadioGroup opts={["Hard","Normal","Loose"]} val={bowel.consistency} onChange={v=>setBowel({...bowel,consistency:v})}/></div><div className="divider"/><div className="fg"><div className="fl">Daytime Urination</div><RadioGroup opts={["4–6 times","6–8 times",">8 times"]} val={mic.dayFreq} onChange={v=>setMic({...mic,dayFreq:v})}/></div><div className="divider"/><div className="fg"><div className="fl">Nocturia</div><RadioGroup opts={["0","1","2",">2"]} val={mic.nocturia} onChange={v=>setMic({...mic,nocturia:v})}/></div></div>);
    if(step===5)return(<div className="card"><div className="sec-head"><div className="sec-icon">🧘</div><div className="sec-title">Appetite & Stress</div></div><div className="sec-desc">Appetite & stress assessment</div><div className="fg"><div className="fl">Appetite Pattern</div>{["Good","Low","Excess","Variable","Cravings"].map(o=><Check key={o} label={o} on={safeAppetite.pattern.includes(o)} toggle={()=>toggleArr(appetite.pattern,v=>setAppetite({...appetite,pattern:v}),o)}/>)}</div><div className="divider"/><div className="fg"><div className="fl">Meal Timing</div><RadioGroup opts={["Timely","Delayed","Late-night hunger"]} val={appetite.timing} onChange={v=>setAppetite({...appetite,timing:v})}/></div><div className="divider"/><div className="fg"><div className="fl">Stress Level</div><RadioGroup opts={["Low","Moderate","High"]} val={stress.level} onChange={v=>setStress({...stress,level:v})}/></div><div className="divider"/><div className="fg"><div className="fl">Stress Sources</div>{["Work","Family","Financial","Health","Other"].map(o=><Check key={o} label={o} on={safeStress.sources.includes(o)} toggle={()=>toggleArr(stress.sources,v=>setStress({...stress,sources:v}),o)}/>)}</div></div>);
    if(step===6)return(
      <div className="card">
        <div className="sec-head"><div className="sec-icon">🚭</div><div className="sec-title">Habits & Menstrual</div></div>
        <div className="sec-desc">Habit correction</div>
        <div className="fg">
          <div className="fl">Alcohol</div>
          <select className="si" value={habits.alcohol} onChange={e=>setHabits({...habits,alcohol:e.target.value})}>
            <option value="">Select…</option>
            {ALCOHOL_OPTS.map(o=><option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="fg">
          <div className="fl">Smoking</div>
          <select className="si" value={habits.smoking} onChange={e=>setHabits({...habits,smoking:e.target.value})}>
            <option value="">Select…</option>
            {SMOKING_OPTS.map(o=><option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="fg"><div className="fl">Other</div>
          <input className="ti" placeholder="Tobacco, pan masala…" value={habits.others} onChange={e=>setHabits({...habits,others:e.target.value})}/>
        </div>
        <div className="divider"/>
        <div className="fg"><div className="fl">Menstrual Health</div>
          <RadioGroup opts={["Applicable","Not applicable (Male)"]} val={menstrual.applicable} onChange={v=>setMenstrual({...menstrual,applicable:v})}/>
        </div>
        {menstrual.applicable==="Applicable"&&<>
          <div className="fg"><div className="fl">Cycle</div><RadioGroup opts={["Regular","Irregular","Menopause"]} val={menstrual.cycle} onChange={v=>setMenstrual({...menstrual,cycle:v})}/></div>
          <div className="fg"><div className="fl">Flow</div><RadioGroup opts={["Normal","Scanty","Heavy"]} val={menstrual.flow} onChange={v=>setMenstrual({...menstrual,flow:v})}/></div>
          <div className="fg"><div className="fl">Symptoms</div>
            {["Nil","Pain","PMS","Clots","Mood swings"].map(o=><Check key={o} label={o}
              on={safeMenstrual.symptoms.includes(o)}
              toggle={()=>{
                if(o==="Nil"){setMenstrual({...menstrual,symptoms:safeMenstrual.symptoms.includes("Nil")?[]:["Nil"]});}
                else{const arr=safeMenstrual.symptoms.filter(x=>x!=="Nil");toggleArr(arr,v=>setMenstrual({...menstrual,symptoms:v}),o);}
              }}/>)}
          </div>
        </>}
      </div>
    );
    if(step===7)return(<div className="card"><div className="sec-head"><div className="sec-icon">🎯</div><div className="sec-title">Goal Setting</div></div><div className="sec-desc">This month's focus</div><div className="gg">{[{k:"Diet",i:"🍽️",d:"Fixed timings · Dinner before 8:30 pm · Less outside food"},{k:"Exercise",i:"🏃",d:"30 min walk 5 days · Stretching · Break sitting hourly"},{k:"Sleep",i:"🌙",d:"Sleep before 11 pm · No screens 1 hr before · Min 7 hrs"},{k:"Stress",i:"🧘",d:"10 min breathing · Meditation · Weekly hobby"},{k:"Substance Reduction",i:"🚭",d:"Gradual reduction plan"},].map(g=><div key={g.k} className={`gc${safeGoals.includes(g.k)?" on":""}`} onClick={()=>setGoals(p=>p.includes(g.k)?p.filter(x=>x!==g.k):[...p,g.k])}><div className="gt">{g.i} {g.k}</div><div className="gi">{g.d}</div></div>)}</div>{err&&<div className="err-box" style={{marginTop:16}}>{err}</div>}<div style={{marginTop:18}}><button className="btn btn-gen" disabled={loading} onClick={generate}>✦ Generate Ayurvedic Prescription</button></div></div>);
    return null;
  };

  /* ── PRIMARY PHYSICIAN PORTAL ── */
  if(user.role==="physician"){
    const physRecs=archive; // already filtered by primaryDoctorId in loadData
    return(
      <>
        <style>{G}</style>
        <Modal/>
        <div style={{background:C.bg,minHeight:"100vh"}}>
          <div className="nav no-print">
            <HospLogo variant="nav"/>
            <div className="nav-r">
              <div className="nav-av">{initials(user.name)}</div>
              <div className="nav-uname">{user.name.split(" ").slice(0,2).join(" ")}</div>
              <button className="nbtn" onClick={()=>{setUser(null);setArchive([]);setViewRec(null);}}>Sign Out</button>
            </div>
          </div>

          {/* LIST VIEW */}
          {!viewRec&&<div className="page fade">
            <div style={{marginBottom:20}}>
              <div style={{fontSize:13,color:C.muted}}>Lifestyle prescriptions for your referred patients</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:26,color:C.teal900}}>{user.name}</div>
              <div style={{fontSize:12,color:C.muted,marginTop:2}}>{user.specialty}</div>
            </div>
            <div className="stats-row">
              <div className="stat-box"><div className="stat-num">{physRecs.length}</div><div className="stat-label">Consultations</div></div>
              <div className="stat-box"><div className="stat-num" style={{color:C.danger}}>{physRecs.filter(r=>r.rx?.riskCategory==="High").length}</div><div className="stat-label">High Risk</div></div>
              <div className="stat-box"><div className="stat-num" style={{color:C.warn}}>{physRecs.filter(r=>r.rx?.riskCategory==="Moderate").length}</div><div className="stat-label">Moderate</div></div>
              <div className="stat-box"><div className="stat-num" style={{color:C.success}}>{physRecs.filter(r=>r.rx?.riskCategory==="Low").length}</div><div className="stat-label">Low Risk</div></div>
            </div>
            {physRecs.length===0
              ?<div className="card" style={{textAlign:"center",padding:"48px 20px",color:C.muted}}>
                <div style={{fontSize:36,marginBottom:10}}>📋</div>
                <div style={{fontSize:16,fontWeight:600,marginBottom:4}}>No lifestyle consultations yet</div>
                <div style={{fontSize:13}}>Consultations for your referred patients will appear here once completed by the Lifestyle Medicine team.</div>
              </div>
              :<>
                <div className="arch-bar">
                  <input className="arch-search" placeholder="Search by name or UHID…" value={search} onChange={e=>setSearch(e.target.value)}/>
                </div>
                <div className="arch-grid">
                  {physRecs.filter(r=>{const q=search.toLowerCase();return !q||r.patient?.name?.toLowerCase().includes(q)||r.patient?.uhid?.toLowerCase().includes(q);}).map((r,i)=>(
                    <div key={i} className="arch-card" onClick={()=>{setViewRec(r);setPhysNotes(r.physicianNotes||BLANK_PHY_NOTES());}} style={{cursor:"pointer"}}>
                      <div className="arch-name">{r.patient?.name}</div>
                      <div className="arch-diag">{r.patient?.diagnosis||"—"}</div>
                      <div className="arch-meta">
                        <div className="arch-date">{fmtDate(r.savedAt)}</div>
                        {r.rx?.riskCategory&&<span className={`risk-badge ${riskClass(r.rx.riskCategory)}`}>{r.rx.riskCategory}</span>}
                      </div>
                      <div style={{fontSize:11,color:C.muted,marginTop:5}}>UHID: {r.patient?.uhid} · {r.patient?.age}yr · {r.patient?.gender}</div>
                      <div style={{fontSize:11,color:C.teal700,marginTop:4}}>🌿 {r.doctorName?.split(" ").slice(0,3).join(" ")}</div>
                      {r.physicianNotes?.diagnosis&&<div style={{fontSize:10,color:C.success,marginTop:3}}>✓ Notes saved</div>}
                    </div>
                  ))}
                </div>
              </>
            }
          </div>}

          {/* DETAIL VIEW — OPD Notes only (no lifestyle Rx visible here) */}
          {viewRec&&<div className="page fade">
            <div className="nav-row no-print" style={{marginBottom:16}}>
              <button className="btn btn-ghost" onClick={()=>{setViewRec(null);setPhysNotesSaved(false);}}>← Back</button>
              <button className="btn btn-rust" onClick={printOpd}>🖨 Print OPD Sheet</button>
            </div>

            {/* OPD Notes Sheet — rendered for both screen and print */}
            <OpdSheet rec={viewRec} notes={physNotes} physicianName={user.name} specialty={user.specialty}/>

            {/* CONSULTANT NOTES FORM — screen only */}
            <div className="card no-print" style={{marginTop:24,borderColor:C.teal400}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:C.teal900,marginBottom:4}}>📝 Consultant Notes</div>
              <div style={{fontSize:12,color:C.muted,marginBottom:16}}>Fill in your notes below — click Save, then Print OPD Sheet</div>

              {/* Diagnosis */}
              <div className="fg"><div className="fl">Diagnosis</div>
                <input className="ti" placeholder="Enter your clinical diagnosis…" value={physNotes.diagnosis}
                  onChange={e=>setPhysNotes({...physNotes,diagnosis:e.target.value})}/>
              </div>

              {/* Investigations */}
              <div className="fg">
                <div className="fl">Investigations Advised</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4}}>
                  {INVESTIGATION_OPTS.map(inv=>{
                    const on=(physNotes.investigations||[]).includes(inv);
                    return(
                      <div key={inv} onClick={()=>{
                        const arr=physNotes.investigations||[];
                        setPhysNotes({...physNotes,investigations:on?arr.filter(x=>x!==inv):[...arr,inv]});
                      }} style={{padding:"5px 12px",borderRadius:20,border:`1.5px solid ${on?C.teal700:C.border}`,
                        background:on?C.teal50:C.bg,cursor:"pointer",fontSize:12,color:on?C.teal900:C.text,
                        fontWeight:on?600:400,transition:"all 0.15s"}}>
                        {on?"✓ ":""}{inv}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Medications */}
              <div className="fg"><div className="fl">Medications / Rx</div>
                <textarea className="ti" rows={4} placeholder="List medications, doses, frequency…"
                  value={physNotes.medications} onChange={e=>setPhysNotes({...physNotes,medications:e.target.value})}
                  style={{resize:"vertical"}}/>
              </div>

              {/* Physician Notes — free text */}
              <div className="fg"><div className="fl">Physician Notes</div>
                <textarea className="ti" rows={4}
                  placeholder="Clinical observations, lifestyle integration notes, referrals, special instructions…"
                  value={physNotes.notes} onChange={e=>setPhysNotes({...physNotes,notes:e.target.value})}
                  style={{resize:"vertical"}}/>
              </div>

              {/* Follow-up */}
              <div className="fg"><div className="fl">Follow-up</div>
                <select className="si" value={physNotes.followUp} onChange={e=>setPhysNotes({...physNotes,followUp:e.target.value})}>
                  <option value="">Select follow-up interval…</option>
                  {FOLLOWUP_OPTS.map(f=><option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              {physNotesSaved&&<div className="success-box">✓ Notes saved</div>}
              <div style={{display:"flex",gap:10}}>
                <button className="btn btn-lime" style={{flex:1,justifyContent:"center",padding:"12px"}} onClick={savePhysicianNotes}>
                  💾 Save Notes
                </button>
                <button className="btn btn-rust" style={{flex:1,justifyContent:"center",padding:"12px"}} onClick={printOpd}>
                  🖨 Print OPD Sheet
                </button>
              </div>
            </div>
          </div>}
        </div>
      </>
    );
  }

  /* ── DOCTOR PORTAL ── */
  if(user.role==="doctor"){
    const pendingAppts=appointments.filter(a=>a.doctorId===user.id&&(a.status==="pending"||a.status==="form_filled"));
    return(
      <>
        <style>{G}</style>
        <Modal/>
        <div style={{background:C.bg,minHeight:"100vh"}}>
          <div className="nav no-print">
            <HospLogo variant="nav"/>
            <div className="nav-r">
              <button className={`ntab${tab==="home"?" on":""}`} onClick={()=>setTab("home")}>🏠 Home</button>
              <button className={`ntab${tab==="form"?" on":""}`} onClick={()=>{resetForm();setTab("form");}}>➕ New</button>
              <button className={`ntab${tab==="archive"||(tab==="view")?" on":""}`} onClick={()=>setTab("archive")}>📂 Archive</button>
              <div className="nav-av">{initials(user.name)}</div>
              <div className="nav-uname">{user.name.split(" ")[0]}</div>
              <button className="nbtn" onClick={()=>{setUser(null);setArchive([]);resetForm();}}>Sign Out</button>
            </div>
          </div>
          {tab==="form"&&<div className="prog-bar no-print"><div className="prog-inner">
            <div className="prog-lbl"><span className="prog-name">{STEPS[step]}</span><span className="prog-ct">Step {step+1} of {STEPS.length}</span></div>
            <div className="prog-track"><div className="prog-fill" style={{width:`${((step+1)/STEPS.length)*100}%`}}/></div>
            <div className="prog-dots">{STEPS.map((s,i)=><div key={s} title={s} className={`pd ${i<step?"done":i===step?"act":"pend"}`}>{i<step?"✓":i+1}</div>)}</div>
          </div></div>}

          {tab==="home"&&<div className="page fade">
            <div style={{marginBottom:20}}>
              <div style={{fontSize:13,color:C.muted}}>Good {new Date().getHours()<12?"morning":"afternoon"},</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:26,color:C.teal900}}>{user.name}</div>
              <div style={{fontSize:12,color:C.muted,marginTop:2}}>{user.specialty} · Free Lifestyle Consultations</div>
            </div>
            <div className="stats-row">
              <div className="stat-box"><div className="stat-num">{archive.length}</div><div className="stat-label">My Patients</div></div>
              <div className="stat-box"><div className="stat-num" style={{color:C.rust}}>{archive.filter(r=>r.rx?.riskCategory==="High").length}</div><div className="stat-label">High Risk</div></div>
              <div className="stat-box"><div className="stat-num" style={{color:C.lime}}>{pendingAppts.length}</div><div className="stat-label">Pending</div></div>
              <div className="stat-box"><div className="stat-num" style={{color:C.teal600}}>{archive.filter(r=>new Date(r.savedAt).toDateString()===new Date().toDateString()).length}</div><div className="stat-label">Today</div></div>
            </div>
            {pendingAppts.length>0&&<div className="card" style={{borderColor:C.teal400}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,color:C.teal900,marginBottom:12}}>📅 Pending Appointments</div>
              {pendingAppts.map(a=>(
                <div key={a.code} className="pending-card">
                  <div>
                    <div style={{fontSize:15,fontWeight:600,color:C.teal900}}>{a.patientName}</div>
                    <div style={{fontSize:12,color:C.muted,marginTop:2}}>{fmtDate(a.date)}{a.time?` · ${a.time}`:""}</div>
                    {a.primarySpecialty&&<div style={{marginTop:4,display:"flex",alignItems:"center",gap:6}}>
                      <span className="tag tag-teal" style={{fontSize:10}}>{a.primarySpecialty}</span>
                      {a.primaryDoctorName&&<span style={{fontSize:11,color:C.muted}}>with {a.primaryDoctorName}</span>}
                    </div>}
                    {a.chiefComplaint&&<div style={{fontSize:11,color:C.muted,marginTop:3,fontStyle:"italic"}}>"{a.chiefComplaint}"</div>}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                    {a.status==="form_filled"&&(
                      <span style={{background:C.successLt,color:C.success,fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:10}}>
                        ✓ Patient filled form
                      </span>
                    )}
                    <button className={`btn ${a.status==="form_filled"?"btn-lime":"btn-teal"}`}
                      style={{padding:"8px 16px",fontSize:13}}
                      onClick={()=>preLoadFromAppt(a)}>
                      {a.status==="form_filled"?"Review & Generate Rx →":"Start Consultation"}
                    </button>
                  </div>
                </div>
              ))}
            </div>}
            <div className="action-grid">
              <div className="action-card primary" onClick={()=>{resetForm();setTab("form");}}>
                <div className="ai">➕</div><div className="at">New Consultation</div><div className="ad">Start lifestyle assessment & generate Rx</div>
              </div>
              <div className="action-card" onClick={()=>setTab("archive")}>
                <div className="ai">📂</div><div className="at">Patient Archive</div><div className="ad">Browse & revisit past consultations</div>
              </div>
            </div>
          </div>}

          {tab==="form"&&<div className="page">
            {/* Banner when patient pre-filled */}
            {appointments.some(a=>a.patientUhid===patient.uhid&&a.preFormData)&&step>0&&(
              <div style={{background:C.successLt,border:`1px solid ${C.success}`,borderRadius:9,
                padding:"9px 14px",marginBottom:12,fontSize:12,color:C.success,display:"flex",
                alignItems:"center",gap:8}}>
                <span>✓</span>
                <span><strong>Pre-filled by patient.</strong> Review and edit as needed — only your changes need attention.</span>
              </div>
            )}
            {StepContent()}
            {step<7&&<div className="nav-row no-print">
              <button className="btn btn-ghost" onClick={()=>step>0?setStep(s=>s-1):setTab("home")}>{step===0?"← Home":"← Previous"}</button>
              <button className="btn btn-teal" onClick={()=>setStep(s=>s+1)}>Continue →</button>
            </div>}
            {step===7&&<div className="nav-row no-print"><button className="btn btn-ghost" onClick={()=>setStep(6)}>← Previous</button><div/></div>}
          </div>}

          {tab==="archive"&&<div className="page fade">
            <div className="arch-bar">
              <input className="arch-search" placeholder="Search by name, UHID or diagnosis…" value={search} onChange={e=>setSearch(e.target.value)}/>
              <button className="btn btn-teal" onClick={()=>{resetForm();setTab("form");}}>+ New</button>
            </div>
            <div style={{fontSize:12,color:C.muted,marginBottom:12}}>{archive.length} consultations · {user.name}</div>
            {archive.filter(r=>{const q=search.toLowerCase();return !q||r.patient?.name?.toLowerCase().includes(q)||r.patient?.diagnosis?.toLowerCase().includes(q)||r.patient?.uhid?.toLowerCase().includes(q);}).length===0
              ?<div style={{textAlign:"center",padding:"48px 20px",color:C.muted}}><div style={{fontSize:36,marginBottom:10}}>📂</div><div style={{fontSize:16,fontWeight:600,marginBottom:4}}>{archive.length===0?"No consultations yet":"No results"}</div></div>
              :<div className="arch-grid">{archive.filter(r=>{const q=search.toLowerCase();return !q||r.patient?.name?.toLowerCase().includes(q)||r.patient?.diagnosis?.toLowerCase().includes(q)||r.patient?.uhid?.toLowerCase().includes(q);}).map((r,i)=>(
                <div key={i} className="arch-card" onClick={()=>{setViewRec(r);setTab("view");}}>
                  <div className="arch-name">{r.patient?.name}</div>
                  <div className="arch-diag">{r.patient?.diagnosis||"—"}</div>
                  <div className="arch-meta">
                    <div className="arch-date">{fmtDate(r.savedAt)}</div>
                    {r.rx?.riskCategory&&<span className={`risk-badge ${riskClass(r.rx.riskCategory)}`}>{r.rx.riskCategory}</span>}
                  </div>
                  <div style={{fontSize:11,color:C.muted,marginTop:5}}>{r.patient?.uhid?`UHID: ${r.patient.uhid}`:""}{r.patient?.age?` · ${r.patient.age}yr`:""}{r.patient?.gender?` · ${r.patient.gender}`:""}</div>
                </div>
              ))}</div>
            }
          </div>}

          {tab==="view"&&viewRec&&<div className="page fade">
            <div className="rx-actions no-print">
              <button className="btn btn-ghost" onClick={()=>setTab("archive")}>← Archive</button>
              <button className="btn btn-teal" onClick={()=>{setEditedRx({...viewRec.rx,shloka:{...viewRec.rx.shloka},threeRx:[...(viewRec.rx.threeRx||[])]});setEditingRecId(viewRec.id);preLoadFromAppt(viewRec.apptData||{patientUhid:viewRec.patient?.uhid,patientName:viewRec.patient?.name,patientDemographics:viewRec.patient,patientMedical:viewRec.patient,preFormData:viewRec.formData,code:viewRec.apptData?.code});setTab("review");}}>✎ Edit Prescription</button>
              <button className="btn btn-rust" onClick={printRx}>🖨️ Print / PDF</button>
              <button className="btn btn-lime" onClick={()=>setModal({type:"his",data:viewRec})}>📤 HIS Export</button>
              <button className="btn btn-ghost" style={{color:C.danger,borderColor:C.danger}} onClick={async()=>{if(window.confirm("Delete?"))try{await storage.delete(viewRec.id);await loadData();setViewRec(null);setTab("archive");}catch(_){}}}>🗑</button>
            </div>
            <RxView data={viewRec.rx} pt={viewRec.patient} doctorName={viewRec.doctorName}/>

          {tab==="review"&&editedRx&&<div className="page fade">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
              <div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:C.teal900}}>Review Prescription</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>AI-generated for <strong>{patient.name}</strong> · Edit any field, then save</div>
              </div>
              <button className="btn btn-lime" style={{padding:"11px 24px"}} onClick={saveReviewedRx}>✓ Save & Finalise</button>
            </div>
            {err&&<div className="err-box">{err}</div>}

            {/* Risk & Dosha */}
            <div className="card">
              <div className="sec-head"><div className="sec-icon">⚖️</div><div className="sec-title">Risk & Dosha</div></div>
              <div className="r2 fg">
                <div><div className="fl">Risk Category</div>
                  <select className="si" value={editedRx.riskCategory||""}
                    onChange={e=>setEditedRx({...editedRx,riskCategory:e.target.value})}>
                    <option>Low</option><option>Moderate</option><option>High</option>
                  </select>
                </div>
                <div><div className="fl">Dosha Imbalance</div>
                  <input className="ti" value={editedRx.dosha||""} onChange={e=>setEditedRx({...editedRx,dosha:e.target.value})}/>
                </div>
              </div>
              <div className="fg"><div className="fl">Risk Rationale</div>
                <textarea className="ti" rows={3} value={editedRx.riskRationale||""}
                  onChange={e=>setEditedRx({...editedRx,riskRationale:e.target.value})} style={{resize:"vertical"}}/>
              </div>
            </div>

            {/* Shloka */}
            {editedRx.shloka&&<div className="card">
              <div className="sec-head"><div className="sec-icon">📖</div><div className="sec-title">Shloka</div></div>
              <div className="fg"><div className="fl">Sanskrit Text</div>
                <textarea className="ti" rows={2} value={editedRx.shloka.text||""}
                  onChange={e=>setEditedRx({...editedRx,shloka:{...editedRx.shloka,text:e.target.value}})}
                  style={{resize:"vertical",fontStyle:"italic"}}/>
              </div>
              <div className="fg"><div className="fl">Transliteration</div>
                <textarea className="ti" rows={2} value={editedRx.shloka.transliteration||""}
                  onChange={e=>setEditedRx({...editedRx,shloka:{...editedRx.shloka,transliteration:e.target.value}})} style={{resize:"vertical"}}/>
              </div>
              <div className="r2 fg">
                <div><div className="fl">Translation</div>
                  <input className="ti" value={editedRx.shloka.translation||""}
                    onChange={e=>setEditedRx({...editedRx,shloka:{...editedRx.shloka,translation:e.target.value}})}/>
                </div>
                <div><div className="fl">Source</div>
                  <input className="ti" value={editedRx.shloka.source||""}
                    onChange={e=>setEditedRx({...editedRx,shloka:{...editedRx.shloka,source:e.target.value}})}/>
                </div>
              </div>
            </div>}

            {/* 3 Prescriptions */}
            <div className="card">
              <div className="sec-head"><div className="sec-icon">📋</div><div className="sec-title">3 Prescriptions for This Visit</div></div>
              {[0,1,2].map(i=>(
                <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:12}}>
                  <div className="rx-num">{i+1}</div>
                  <textarea className="ti" rows={2}
                    value={(editedRx.threeRx||["","",""])[i]||""}
                    onChange={e=>{const t=[...(editedRx.threeRx||["","",""])];t[i]=e.target.value;setEditedRx({...editedRx,threeRx:t});}}
                    style={{resize:"vertical"}}/>
                </div>
              ))}
            </div>

            {/* Clinical sections */}
            {[
              {k:"dietPrescription",icon:"🍽️",title:"Diet Prescription"},
              {k:"activityPrescription",icon:"🏃",title:"Physical Activity & Yoga"},
              {k:"sleepPrescription",icon:"🌙",title:"Sleep & Dinacharya"},
              {k:"digestivePrescription",icon:"💧",title:"Agni & Digestive Health"},
              {k:"mindPrescription",icon:"🧘",title:"Mind & Stress"},
            ].map(({k,icon,title})=>(
              <div key={k} className="card">
                <div className="sec-head"><div className="sec-icon">{icon}</div><div className="sec-title">{title}</div></div>
                <textarea className="ti" rows={5} value={editedRx[k]||""}
                  onChange={e=>setEditedRx({...editedRx,[k]:e.target.value})}
                  style={{resize:"vertical",lineHeight:1.8}}/>
              </div>
            ))}

            {/* Follow-up & Special Note */}
            <div className="card">
              <div className="r2">
                <div><div className="fl">Follow-up</div>
                  <select className="si" value={editedRx.followUp||"2 weeks"}
                    onChange={e=>setEditedRx({...editedRx,followUp:e.target.value})}>
                    <option>2 weeks</option><option>4 weeks</option><option>6 weeks</option><option>3 months</option>
                  </select>
                </div>
                <div><div className="fl">Special Clinical Note</div>
                  <input className="ti" placeholder="Optional caution or note"
                    value={editedRx.specialNote||""}
                    onChange={e=>setEditedRx({...editedRx,specialNote:e.target.value})}/>
                </div>
              </div>
            </div>

            <div style={{display:"flex",gap:10,paddingBottom:24}}>
              <button className="btn btn-ghost" onClick={()=>{setEditedRx(null);setTab(editingRecId?"view":"home");}}>← Discard Changes</button>
              <button className="btn btn-lime" style={{flex:1,justifyContent:"center",padding:14,fontSize:15}}
                onClick={saveReviewedRx}>✓ Save & Finalise Prescription</button>
            </div>
          </div>}
        </div>
      </>
    );
  }

  /* ── ADMIN PORTAL ── */
  return(
    <>
      <style>{G}</style>
      <Modal/>
      <div style={{background:C.bg,minHeight:"100vh"}}>
        <div className="nav no-print">
          <HospLogo variant="nav"/>
          <div className="nav-r">
            {["home","appointments","doctors","analytics"].map(t=>(
              <button key={t} className={`ntab${tab===t?" on":""}`} onClick={()=>setTab(t)}>
                {t==="home"?"🏠 Home":t==="appointments"?"📅 Appointments":t==="doctors"?"👨‍⚕️ Doctors":"📊 Analytics"}
              </button>
            ))}
            <div className="nav-av" style={{background:C.lime,color:C.teal900}}>AD</div>
            <button className="nbtn" onClick={()=>{setUser(null);setArchive([]);resetForm();}}>Sign Out</button>
          </div>
        </div>

        {tab==="home"&&<div className="page fade">
          <div style={{marginBottom:20}}>
            <div style={{fontSize:13,color:C.muted}}>Admin Dashboard</div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:26,color:C.teal900}}>Jayadev Memorial Rashtrotthana Hospital</div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>Patient Registration & Health Services · Free Lifestyle Consultations</div>
          </div>
          <div className="stats-row">
            <div className="stat-box"><div className="stat-num">{allArchive.length}</div><div className="stat-label">Total Consultations</div></div>
            <div className="stat-box"><div className="stat-num" style={{color:C.rust}}>{allArchive.filter(r=>r.rx?.riskCategory==="High").length}</div><div className="stat-label">High Risk</div></div>
            <div className="stat-box"><div className="stat-num" style={{color:C.lime}}>{appointments.filter(a=>a.status==="pending").length}</div><div className="stat-label">Pending Appts</div></div>
            <div className="stat-box"><div className="stat-num" style={{color:C.teal600}}>{doctors.length}</div><div className="stat-label">Active Doctors</div></div>
          </div>
          <div className="action-grid">
            <div className="action-card primary" onClick={()=>setTab("appointments")}><div className="ai">📅</div><div className="at">Register Patient</div><div className="ad">Register walk-in, MHC or specialist visit — lifestyle form sent by SMS or shared on-site</div></div>
            <div className="action-card lime" onClick={()=>setTab("doctors")}><div className="ai">👨‍⚕️</div><div className="at">Manage Doctors</div><div className="ad">Add primary consultants (any specialty) and lifestyle doctors</div></div>
          </div>
        </div>}

        {tab==="appointments"&&<div className="page fade">
          <div className="section-header">
            <div><div className="section-h">Appointment Management</div><div className="section-hs">Register patients for primary consultation + free lifestyle add-on</div></div>
          </div>
          <div className="card">
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,color:C.teal900,marginBottom:4}}>📋 Register Patient</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:16}}>Front office collects name, contact, and doctor — patient fills all other details via the link.</div>

            {/* VISIT TYPE */}
            <div className="subsection-label">Visit Type *</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
              {[{v:"specialist",i:"👨‍⚕️",l:"Specialist",d:"Cardiology, Nephrology…"},
                {v:"mhc",i:"🩺",l:"Health Check-up",d:"MHC package booking"},
                {v:"walkin_mhc",i:"🚶",l:"Walk-in MHC",d:"Patient is here now"}
              ].map(t=>(
                <div key={t.v} onClick={()=>setNewAppt({...newAppt,visitType:t.v,primarySpecialty:t.v==="mhc"||t.v==="walkin_mhc"?"Master Health Check-up":newAppt.primarySpecialty})}
                  style={{padding:"10px",borderRadius:10,border:`1.5px solid ${newAppt.visitType===t.v?C.teal700:C.border}`,
                    background:newAppt.visitType===t.v?C.teal50:C.bg,cursor:"pointer",textAlign:"center",transition:"all 0.18s"}}>
                  <div style={{fontSize:20,marginBottom:4}}>{t.i}</div>
                  <div style={{fontSize:12,fontWeight:600,color:C.teal900}}>{t.l}</div>
                  <div style={{fontSize:10,color:C.muted,marginTop:2,lineHeight:1.4}}>{t.d}</div>
                </div>
              ))}
            </div>

            {/* MINIMAL PATIENT CONTACT */}
            <div className="subsection-label">Patient Contact Details</div>
            <div className="r2 fg">
              <div><div className="fl">Full Name *</div><input className="ti" placeholder="Patient full name" value={newAppt.patientName} onChange={e=>setNewAppt({...newAppt,patientName:e.target.value})}/></div>
              <div><div className="fl">Mobile *</div><input className="ti" placeholder="+91 XXXXX XXXXX" value={newAppt.mobile} onChange={e=>setNewAppt({...newAppt,mobile:e.target.value})}/></div>
            </div>
            <div className="r2 fg">
              <div><div className="fl">Email (for confirmation)</div>
                <input className="ti" placeholder="patient@email.com" value={newAppt.email} onChange={e=>setNewAppt({...newAppt,email:e.target.value})}/>
              </div>
              <div><div className="fl">Hospital UHID <span style={{fontWeight:400,color:C.muted}}>(if already assigned)</span></div>
                <input className="ti" placeholder="e.g. RH-00123 or leave blank to auto-generate"
                  value={newAppt.patientUhid||""}
                  onChange={e=>setNewAppt({...newAppt,patientUhid:e.target.value.toUpperCase()})}/>
              </div>
            </div>

            {/* DOCTOR SELECTION */}
            <div className="subsection-label">
              {newAppt.visitType==="specialist"?"Primary Consultant":"Health Check-up"}
            </div>
            {newAppt.visitType==="specialist"&&(
              <div className="r2 fg">
                <div><div className="fl">Specialty *</div>
                  <select className="si" value={newAppt.primarySpecialty} onChange={e=>setNewAppt({...newAppt,primarySpecialty:e.target.value,primaryDoctorId:""})}>
                    <option value="">Select specialty</option>
                    {SPECIALTIES.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><div className="fl">Consultant *</div>
                  <select className="si" value={newAppt.primaryDoctorId} onChange={e=>setNewAppt({...newAppt,primaryDoctorId:e.target.value})}>
                    <option value="">— Select consultant —</option>
                    {doctors.filter(d=>(d.type==="primary"||d.type==="both")&&(!newAppt.primarySpecialty||d.specialty===newAppt.primarySpecialty||d.dept===newAppt.primarySpecialty)).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  {!newAppt.primaryDoctorId&&newAppt.primarySpecialty&&<div style={{fontSize:11,color:C.rust,marginTop:4}}>⚠ Must assign a consultant before registering</div>}
                </div>
              </div>
            )}
            {(newAppt.visitType==="mhc"||newAppt.visitType==="walkin_mhc")&&(
              <div className="fg"><div className="fl">Package (optional)</div>
                <input className="ti" placeholder="e.g. Basic MHC, Executive, Cardiac screen…" value={newAppt.notes} onChange={e=>setNewAppt({...newAppt,notes:e.target.value})}/>
              </div>
            )}

            {/* APPOINTMENT DATE — optional for walkin */}
            {newAppt.visitType!=="walkin_mhc"&&(
              <div className="r2 fg">
                <div><div className="fl">Appointment Date</div><input type="date" className="ti" value={newAppt.date} onChange={e=>setNewAppt({...newAppt,date:e.target.value})}/></div>
                <div><div className="fl">Time</div>
                  <input className="ti" list="time-suggestions" placeholder="e.g. 10:45 AM" value={newAppt.time} onChange={e=>setNewAppt({...newAppt,time:e.target.value})}/>
                  <datalist id="time-suggestions">{TIME_SUGGESTIONS.map(t=><option key={t} value={t}/>)}</datalist>
                </div>
              </div>
            )}
            {newAppt.visitType==="walkin_mhc"&&(
              <div className="info-box" style={{marginBottom:12}}>Walk-in: appointment set to today. Patient fills form on-site while waiting.</div>
            )}

            {/* LIFESTYLE DOCTOR */}
            <div style={{background:C.teal50,border:`1.5px solid ${C.teal400}`,borderRadius:10,padding:"12px 16px",marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <div style={{background:C.teal700,color:"white",width:18,height:18,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,flexShrink:0}}>✓</div>
                <div style={{fontSize:13,fontWeight:600,color:C.teal900}}>🌿 Free Lifestyle Consultation — auto-included</div>
              </div>
              <select className="si" value={newAppt.lifestyleDoctorId} onChange={e=>setNewAppt({...newAppt,lifestyleDoctorId:e.target.value})}>
                <option value="">— Select lifestyle doctor —</option>
                {doctors.filter(d=>d.type==="lifestyle"||!d.type).map(d=><option key={d.id} value={d.id}>{d.name} — {d.specialty}</option>)}
              </select>
              {!newAppt.lifestyleDoctorId&&<div style={{fontSize:11,color:C.rust,marginTop:4}}>⚠️ Please select a lifestyle doctor — appointment won't appear in doctor portal without one.</div>}
            </div>

            {err&&<div className="err-box">{err}</div>}
            <button className="btn btn-lime" style={{width:"100%",justifyContent:"center",padding:"13px"}} onClick={createAppt}>
              {newAppt.visitType==="walkin_mhc"?"✦ Register Walk-in & Send Form Link":"✦ Register & Send Confirmation + Form Link"}
            </button>          </div>

          <div className="card">
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,color:C.teal900,marginBottom:14}}>Recent Appointments</div>
            {appointments.length===0?<div style={{color:C.muted,fontSize:13}}>No appointments created yet.</div>:(
              <table className="tbl">
                <thead><tr><th>Patient</th><th>Visit Type</th><th>Date / Specialty</th><th>Lifestyle</th><th>Code</th><th>Status</th></tr></thead>
                <tbody>{appointments.slice(0,15).map((a,i)=>{
                  const lifestyleDoc=doctors.find(d=>d.id===a.doctorId);
                  const primDoc=doctors.find(d=>d.id===a.primaryDoctorId);
                  return(<tr key={i}>
                    <td>
                      <div style={{fontWeight:600}}>{a.patientName}</div>
                      <div style={{fontSize:11,color:C.muted}}>{a.mobile}</div>
                      {a.patientUhid&&<div style={{fontSize:10,color:C.teal700,marginTop:1}}>UHID: {a.patientUhid}</div>}
                    </td>
                    <td>
                      <div>{fmtDate(a.date)}</div>
                      {a.time&&<div style={{fontSize:11,color:C.muted}}>{a.time}</div>}
                    </td>
                    <td>
                      <span className={`tag ${a.visitType==="walkin_mhc"?"tag-rust":a.visitType==="mhc"?"tag-lime":"tag-teal"}`} style={{fontSize:10}}>
                        {a.visitType==="walkin_mhc"?"Walk-in MHC":a.visitType==="mhc"?"MHC":"Specialist"}
                      </span>
                    </td>
                    <td>
                      {lifestyleDoc
                        ? <div style={{fontSize:12}}>{lifestyleDoc.name}</div>
                        : <select className="si" style={{fontSize:11,padding:"4px 6px"}}
                            onChange={async e=>{
                              if(!e.target.value)return;
                              const doc=doctors.find(d=>d.id===e.target.value);
                              const updated={...a,doctorId:e.target.value,lifestyleDoctorName:doc?.name||""};
                              await storage.set(`appt:${a.code}`,JSON.stringify(updated));
                              await loadData();
                            }}>
                            <option value="">⚠️ Assign doctor</option>
                            {doctors.filter(d=>d.type==="lifestyle"||!d.type).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                      }
                    </td>
                    <td>
                      {a.visitType==="specialist"
                        ?<><span className="tag tag-teal" style={{fontSize:10}}>{a.primarySpecialty||"—"}</span>
                          {primDoc&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>{primDoc.name}</div>}
                          {a.date&&<div style={{fontSize:11,color:C.muted}}>{fmtDate(a.date)}{a.time?` · ${a.time}`:""}</div>}</>
                        :<><div style={{fontSize:12,fontWeight:500}}>{a.chiefComplaint||"Standard package"}</div>
                          {a.date&&<div style={{fontSize:11,color:C.muted}}>{fmtDate(a.date)}{a.time?` · ${a.time}`:""}</div>}</>
                      }
                    </td>
                    <td style={{fontSize:12}}>{lifestyleDoc?.name?<span style={{color:C.teal700}}>{lifestyleDoc.name.split(" ").slice(-1)[0]}</span>:<span style={{color:C.muted,fontSize:11}}>Auto</span>}</td>
                    <td><span style={{fontFamily:"monospace",fontWeight:700,color:C.teal700,letterSpacing:2}}>{a.code}</span></td>
                    <td><span className={`tag ${a.status==="pending"?"tag-warn":"tag-green"}`}>{a.status}</span></td>
                  </tr>);
                })}</tbody>
              </table>
            )}
          </div>
        </div>}

        {tab==="doctors"&&<div className="page fade">
          <div className="section-header">
            <div><div className="section-h">Doctor Management</div><div className="section-hs">{doctors.filter(d=>d.type==="primary").length} primary consultants · {doctors.filter(d=>d.type==="lifestyle"||!d.type).length} lifestyle doctors</div></div>
          </div>

          {/* Add doctor form */}
          <div className="card">
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,color:C.teal900,marginBottom:14}}>➕ Add Doctor / Consultant</div>

            {/* Type toggle */}
            <div className="fg">
              <div className="fl">Type</div>
              <div style={{display:"flex",gap:8}}>
                {[{v:"primary",l:"🏥 Primary Consultant",d:"Listed for appointment assignment (no app login)"},{v:"lifestyle",l:"🌿 Lifestyle Doctor",d:"Can log in to conduct lifestyle consultations"}].map(t=>(
                  <div key={t.v} onClick={()=>setNewDoc({...newDoc,type:t.v,password:"",dept:t.v==="lifestyle"?"Lifestyle Medicine":""})}
                    style={{flex:1,padding:"12px 14px",borderRadius:10,border:`1.5px solid ${newDoc.type===t.v?C.teal700:C.border}`,
                      background:newDoc.type===t.v?C.teal50:C.bg,cursor:"pointer",transition:"all 0.18s"}}>
                    <div style={{fontSize:13,fontWeight:600,color:newDoc.type===t.v?C.teal900:C.text}}>{t.l}</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:3}}>{t.d}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="r2 fg">
              <div><div className="fl">Doctor ID *</div><input className="ti" placeholder={newDoc.type==="lifestyle"?"e.g. DR005":"e.g. PC006"} value={newDoc.id} onChange={e=>setNewDoc({...newDoc,id:e.target.value.toUpperCase()})}/></div>
              <div><div className="fl">Full Name *</div><input className="ti" placeholder="Dr. First Last" value={newDoc.name} onChange={e=>setNewDoc({...newDoc,name:e.target.value})}/></div>
            </div>
            <div className="r2 fg">
              <div><div className="fl">Specialty</div>
                {newDoc.type==="primary"
                  ?<select className="si" value={newDoc.specialty} onChange={e=>setNewDoc({...newDoc,specialty:e.target.value,dept:e.target.value})}>
                      <option value="">Select specialty</option>
                      {SPECIALTIES.map(s=><option key={s} value={s}>{s}</option>)}
                    </select>
                  :<input className="ti" placeholder="e.g. Ayurveda & Lifestyle" value={newDoc.specialty} onChange={e=>setNewDoc({...newDoc,specialty:e.target.value})}/>
                }
              </div>
              {newDoc.type==="lifestyle"
                ?<div><div className="fl">App Password *</div><input className="ti" type="password" placeholder="Set login password" value={newDoc.password} onChange={e=>setNewDoc({...newDoc,password:e.target.value})}/></div>
                :<div style={{display:"flex",alignItems:"center",paddingTop:20}}><span style={{fontSize:12,color:C.muted,background:C.successLt,padding:"6px 12px",borderRadius:8}}>✓ No login required for primary consultants</span></div>
              }
            </div>
            {addDocErr&&<div className="err-box">{addDocErr}</div>}
            <button className="btn btn-teal" onClick={addDoctor}>Add {newDoc.type==="primary"?"Consultant":"Lifestyle Doctor"}</button>
          </div>

          {/* Primary Consultants table */}
          <div className="card">
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,color:C.teal900,marginBottom:12}}>🏥 Primary Consultants ({doctors.filter(d=>d.type==="primary").length})</div>
            <table className="tbl">
              <thead><tr><th>Name</th><th>Specialty</th><th>ID</th><th>Appts</th><th></th></tr></thead>
              <tbody>{doctors.filter(d=>d.type==="primary").map(d=>(
                <tr key={d.id}>
                  <td><div style={{fontWeight:600}}>{d.name}</div></td>
                  <td><span className="tag tag-teal">{d.specialty}</span></td>
                  <td style={{fontFamily:"monospace",color:C.teal700,fontSize:12}}>{d.id}</td>
                  <td style={{fontSize:12}}>{appointments.filter(a=>a.primaryDoctorId===d.id).length}</td>
                  <td><button className="btn btn-ghost" style={{padding:"5px 10px",fontSize:11,color:C.danger,borderColor:C.danger}} onClick={()=>removeDoctor(d.id)}>Remove</button></td>
                </tr>
              ))}
              {doctors.filter(d=>d.type==="primary").length===0&&<tr><td colSpan={5} style={{color:C.muted,fontSize:13,textAlign:"center",padding:16}}>No primary consultants added yet</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Lifestyle Doctors table */}
          <div className="card">
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,color:C.teal900,marginBottom:12}}>🌿 Lifestyle Doctors ({doctors.filter(d=>d.type==="lifestyle"||!d.type).length})</div>
            <table className="tbl">
              <thead><tr><th>Name</th><th>Specialty</th><th>ID</th><th>Consultations</th><th></th></tr></thead>
              <tbody>{doctors.filter(d=>d.type==="lifestyle"||!d.type).map(d=>(
                <tr key={d.id}>
                  <td><div style={{display:"flex",alignItems:"center",gap:8}}><div className="dav" style={{width:28,height:28,fontSize:11}}>{initials(d.name)}</div><span style={{fontWeight:600}}>{d.name}</span></div></td>
                  <td><span className="tag tag-lime">{d.specialty}</span></td>
                  <td style={{fontFamily:"monospace",color:C.teal700,fontSize:12}}>{d.id}</td>
                  <td>{allArchive.filter(r=>r.doctorId===d.id).length}</td>
                  <td><button className="btn btn-ghost" style={{padding:"5px 10px",fontSize:11,color:C.danger,borderColor:C.danger}} onClick={()=>removeDoctor(d.id)}>Remove</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>}

        {tab==="analytics"&&<div className="page fade">
          <div className="section-header"><div><div className="section-h">Analytics</div><div className="section-hs">All consultations across the programme</div></div>
            <button className="btn btn-teal" onClick={()=>setModal({type:"his",data:allArchive[0]})} disabled={allArchive.length===0}>📤 Export Latest</button>
          </div>
          <div className="stats-row">
            <div className="stat-box"><div className="stat-num" style={{color:C.success}}>{allArchive.filter(r=>r.rx?.riskCategory==="Low").length}</div><div className="stat-label">Low Risk</div></div>
            <div className="stat-box"><div className="stat-num" style={{color:C.warn}}>{allArchive.filter(r=>r.rx?.riskCategory==="Moderate").length}</div><div className="stat-label">Moderate Risk</div></div>
            <div className="stat-box"><div className="stat-num" style={{color:C.danger}}>{allArchive.filter(r=>r.rx?.riskCategory==="High").length}</div><div className="stat-label">High Risk</div></div>
            <div className="stat-box"><div className="stat-num" style={{color:C.teal600}}>{appointments.length}</div><div className="stat-label">Registrations</div></div>
          </div>
          {/* Specialty breakdown */}
          {appointments.length>0&&<div className="card">
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:C.teal900,marginBottom:12}}>Patient Referrals by Specialty</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {/* Visit type summary */}
              {[{v:"specialist",l:"Specialist",col:C.teal700},{v:"mhc",l:"MHC",col:C.lime},{v:"walkin_mhc",l:"Walk-in MHC",col:C.rust}].map(t=>{
                const cnt=appointments.filter(a=>a.visitType===t.v).length;
                return cnt>0?(
                  <div key={t.v} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 16px",minWidth:110}}>
                    <div style={{fontSize:20,fontWeight:700,color:t.col}}>{cnt}</div>
                    <div style={{fontSize:11,color:C.muted}}>{t.l}</div>
                  </div>
                ):null;
              })}
              <div style={{width:"100%",height:1,background:C.divider,margin:"4px 0"}}/>
              {/* Specialty breakdown (specialist only) */}
              {SPECIALTIES.filter(s=>appointments.some(a=>a.primarySpecialty===s&&a.visitType==="specialist")).map(s=>(
                <div key={s} style={{background:C.teal50,border:`1px solid ${C.teal100}`,borderRadius:8,padding:"8px 14px",minWidth:100}}>
                  <div style={{fontSize:18,fontWeight:700,color:C.teal700}}>{appointments.filter(a=>a.primarySpecialty===s).length}</div>
                  <div style={{fontSize:11,color:C.muted}}>{s}</div>
                </div>
              ))}
            </div>
          </div>}
          <div className="card">
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,color:C.teal900,marginBottom:14}}>All Consultations</div>
            <div className="arch-bar"><input className="arch-search" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
            <table className="tbl">
              <thead><tr><th>Patient</th><th>Primary Specialty</th><th>Lifestyle Dr.</th><th>Date</th><th>Risk</th><th>HIS</th></tr></thead>
              <tbody>{allArchive.filter(r=>{const q=search.toLowerCase();return !q||r.patient?.name?.toLowerCase().includes(q)||r.patient?.uhid?.toLowerCase().includes(q)||r.apptData?.primarySpecialty?.toLowerCase().includes(q);}).slice(0,20).map((r,i)=>(
                <tr key={i}>
                  <td>
                    <div style={{fontWeight:600}}>{r.patient?.name}</div>
                    <div style={{fontSize:11,color:C.muted}}>UHID: {r.patient?.uhid} · {r.patient?.age||r.apptData?.age||""}yr · {r.patient?.gender||r.apptData?.gender||""}</div>
                    {r.apptData?.chiefComplaint&&<div style={{fontSize:10,color:C.muted,fontStyle:"italic"}}>"{r.apptData.chiefComplaint}"</div>}
                  </td>
                  <td>
                    {r.apptData?.visitType&&<span className={`tag ${r.apptData.visitType==="walkin_mhc"?"tag-rust":r.apptData.visitType==="mhc"?"tag-lime":"tag-teal"}`} style={{fontSize:10,marginBottom:3,display:"inline-flex"}}>
                      {r.apptData.visitType==="walkin_mhc"?"Walk-in MHC":r.apptData.visitType==="mhc"?"MHC":"Specialist"}
                    </span>}
                    {r.apptData?.primarySpecialty&&r.apptData.visitType==="specialist"&&<div style={{marginTop:2}}><span className="tag tag-teal" style={{fontSize:10}}>{r.apptData.primarySpecialty}</span></div>}
                    {r.apptData?.primaryDoctorName&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>{r.apptData.primaryDoctorName}</div>}
                  </td>
                  <td style={{fontSize:12}}>{r.doctorName?.split(" ").slice(0,3).join(" ")}</td>
                  <td style={{fontSize:12,color:C.muted}}>{fmtDate(r.savedAt)}</td>
                  <td>{r.rx?.riskCategory&&<span className={`risk-badge ${riskClass(r.rx.riskCategory)}`}>{r.rx.riskCategory}</span>}</td>
                  <td><button className="btn btn-ghost" style={{padding:"5px 10px",fontSize:11}} onClick={()=>setModal({type:"his",data:r})}>Export</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>}
      </div>
    </>
  );
}
