/**
 * SOC Analyst Dashboard — Client-Side Logic
 * Real-time fetching, Chart.js, tabs, add-log, block-ip, clear-logs.
 */

// ── Globals ──
let chartTraffic = null, chartThreats = null, chartLogins = null, chartTrend = null;
const REFRESH_MS = 5000;
Chart.defaults.color = "#8888aa";
Chart.defaults.borderColor = "rgba(0,229,255,0.06)";
Chart.defaults.font.family = "'Inter',sans-serif";
Chart.defaults.font.size = 11;

// ── Helpers ──
async function apiFetch(url) {
  try {
    const r = await fetch(url);
    if (r.redirected) { window.location.href = r.url; return null; }
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { console.error("API:", url, e); return null; }
}
function sevBadge(s) { const v = (s||"low").toLowerCase(); return `<span class="sev-badge sev-${v}">${v}</span>`; }
function animNum(id, tgt) {
  const el = document.getElementById(id); if (!el) return;
  const cur = parseInt(el.textContent)||0; if (cur===tgt) return;
  const d = tgt-cur, steps=12; let s=0;
  (function t(){ s++; if(s>=steps){el.textContent=tgt;return;} el.textContent=Math.round(cur+(d/steps)*s); requestAnimationFrame(t); })();
}

// ── Tab Nav ──
const TITLES = {dashboard:"Dashboard Overview",logs:"Live Security Logs",alerts:"Security Alerts",incidents:"Active Incidents",search:"IP Address Search",block:"Block Attacker IP"};
document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", () => {
    const tab = item.dataset.tab;
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    item.classList.add("active");
    document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
    const el = document.getElementById("tab-"+tab); if(el) el.classList.add("active");
    document.getElementById("page-title").textContent = TITLES[tab]||"Dashboard";
    document.getElementById("sidebar").classList.remove("open");
    if(tab==="logs") fetchLogs();
    if(tab==="alerts") fetchAlerts();
    if(tab==="incidents") fetchIncidents();
  });
});
document.getElementById("menu-toggle").addEventListener("click",()=>document.getElementById("sidebar").classList.toggle("open"));

// ── Clock ──
function updateClock(){
  document.getElementById("topbar-time").textContent=new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false});
}
setInterval(updateClock,1000); updateClock();

// ── Stats ──
async function fetchStats(){
  const s = await apiFetch("/api/stats"); if(!s) return;
  animNum("val-logs",s.total_logs);
  animNum("val-alerts",s.total_alerts);
  animNum("val-incidents",s.total_incidents);
  animNum("val-blocked",s.blocked_ips);
  updateTrafficChart(s.traffic);
  updateThreatsChart(s.threats);
  updateLoginsChart(s.login_attempts);
  updateTrendChart(s.trend);
  fetchDashAlerts();
}

// ── Charts ──
function grad(ctx,r,g,b){const gr=ctx.createLinearGradient(0,0,0,240);gr.addColorStop(0,`rgba(${r},${g},${b},.35)`);gr.addColorStop(1,`rgba(${r},${g},${b},.02)`);return gr;}

function updateTrafficChart(d){
  const el=document.getElementById("chart-traffic");if(!el)return;
  if(chartTraffic){chartTraffic.data.labels=d.labels;chartTraffic.data.datasets[0].data=d.data;chartTraffic.update("none");return;}
  chartTraffic=new Chart(el,{type:"line",data:{labels:d.labels,datasets:[{label:"Events",data:d.data,borderColor:"#00e5ff",backgroundColor:grad(el.getContext("2d"),0,229,255),fill:true,tension:.4,borderWidth:2,pointRadius:3,pointBackgroundColor:"#00e5ff"}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,grid:{color:"rgba(0,229,255,.04)"}}}}});
}
function updateThreatsChart(d){
  const el=document.getElementById("chart-threats");if(!el)return;
  const c=["#00e5ff","#ff00c8","#00ff95","#ffaa00","#ff2d55","#7c4dff"];
  if(chartThreats){chartThreats.data.labels=d.labels;chartThreats.data.datasets[0].data=d.data;chartThreats.data.datasets[0].backgroundColor=c.slice(0,d.labels.length);chartThreats.update("none");return;}
  chartThreats=new Chart(el,{type:"doughnut",data:{labels:d.labels,datasets:[{data:d.data,backgroundColor:c.slice(0,d.labels.length),borderWidth:0,hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"bottom",labels:{padding:12,usePointStyle:true,pointStyleWidth:8}}},cutout:"65%"}});
}
function updateLoginsChart(d){
  const el=document.getElementById("chart-logins");if(!el)return;
  if(chartLogins){chartLogins.data.labels=d.labels;chartLogins.data.datasets[0].data=d.data;chartLogins.update("none");return;}
  chartLogins=new Chart(el,{type:"bar",data:{labels:d.labels,datasets:[{label:"Attempts",data:d.data,backgroundColor:"rgba(255,0,200,.5)",borderColor:"#ff00c8",borderWidth:1,borderRadius:4,barPercentage:.6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{maxRotation:45,font:{size:9}}},y:{beginAtZero:true,grid:{color:"rgba(255,0,200,.04)"}}}}});
}
function updateTrendChart(d){
  const el=document.getElementById("chart-trend");if(!el)return;
  if(chartTrend){chartTrend.data.labels=d.labels;chartTrend.data.datasets[0].data=d.data;chartTrend.update("none");return;}
  chartTrend=new Chart(el,{type:"line",data:{labels:d.labels,datasets:[{label:"Incidents",data:d.data,borderColor:"#00ff95",backgroundColor:grad(el.getContext("2d"),0,255,149),fill:true,tension:.4,borderWidth:2,pointRadius:4,pointBackgroundColor:"#00ff95"}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,grid:{color:"rgba(0,255,149,.04)"}}}}});
}

// ── Dashboard Alerts ──
async function fetchDashAlerts(){
  const a=await apiFetch("/api/alerts");if(!a)return;
  const tb=document.getElementById("dashboard-alerts-body");if(!tb)return;
  tb.innerHTML=a.slice(-6).reverse().map(a=>`<tr><td>${a.timestamp||""}</td><td>${a.source_ip||""}</td><td>${a.event_type||""}</td><td>${sevBadge(a.severity)}</td><td style="white-space:normal;max-width:300px;font-family:'Inter',sans-serif;font-size:12px">${a.message||""}</td></tr>`).join("");
}

// ── Logs ──
async function fetchLogs(){
  const l=await apiFetch("/api/logs");if(!l)return;
  const tb=document.getElementById("logs-body");if(!tb)return;
  tb.innerHTML=l.slice(-60).reverse().map(l=>`<tr><td>${l.id}</td><td>${l.timestamp||""}</td><td>${l.source_ip||""}</td><td>${l.destination_ip||""}</td><td>${l.event_type||""}</td><td>${sevBadge(l.severity)}</td><td>${l.tool||""}</td><td>${l.port||""}</td><td>${l.status||""}</td></tr>`).join("");
}

// ── Alerts ──
async function fetchAlerts(){
  const a=await apiFetch("/api/alerts");if(!a)return;
  const tb=document.getElementById("alerts-body");if(!tb)return;
  tb.innerHTML=a.slice(-60).reverse().map(a=>`<tr><td>${a.id}</td><td>${a.timestamp||""}</td><td>${a.source_ip||""}</td><td>${a.event_type||""}</td><td>${sevBadge(a.severity)}</td><td style="white-space:normal;max-width:280px;font-family:'Inter',sans-serif;font-size:12px">${a.message||""}</td><td><button class="action-btn btn-red btn-sm" onclick="blockIP('${a.source_ip}')"><i class="fas fa-ban"></i> Block</button></td></tr>`).join("");
}

// ── Incidents ──
async function fetchIncidents(){
  const inc=await apiFetch("/api/incidents");if(!inc)return;
  const tb=document.getElementById("incidents-body");if(!tb)return;
  tb.innerHTML=inc.map(i=>`<tr><td>${i.incident_id}</td><td>${i.source_ip}</td><td>${i.event_type}</td><td>${sevBadge(i.severity)}</td><td>${i.count}</td><td>${i.first_seen}</td><td>${i.last_seen}</td><td>${i.blocked?'<span class="sev-badge sev-critical">BLOCKED</span>':'<span class="sev-badge sev-low">ACTIVE</span>'}</td></tr>`).join("");
}

// ── Search ──
document.getElementById("search-ip-btn").addEventListener("click",searchIP);
document.getElementById("search-ip-input").addEventListener("keydown",e=>{if(e.key==="Enter")searchIP()});
async function searchIP(){
  const ip=document.getElementById("search-ip-input").value.trim();if(!ip)return;
  const l=await apiFetch("/api/search?ip="+encodeURIComponent(ip));if(!l)return;
  const tb=document.getElementById("search-body");if(!tb)return;
  if(!l.length){tb.innerHTML=`<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:24px">No logs for IP: ${ip}</td></tr>`;return;}
  tb.innerHTML=l.reverse().map(l=>`<tr><td>${l.id}</td><td>${l.timestamp||""}</td><td>${l.source_ip||""}</td><td>${l.destination_ip||""}</td><td>${l.event_type||""}</td><td>${sevBadge(l.severity)}</td><td style="white-space:normal;max-width:280px;font-family:'Inter',sans-serif;font-size:12px">${l.message||""}</td></tr>`).join("");
}

// ── Block IP ──
document.getElementById("block-ip-btn").addEventListener("click",()=>{const ip=document.getElementById("block-ip-input").value.trim();if(ip)blockIP(ip);});
document.getElementById("block-ip-input").addEventListener("keydown",e=>{if(e.key==="Enter"){const ip=document.getElementById("block-ip-input").value.trim();if(ip)blockIP(ip);}});
async function blockIP(ip){
  try{
    const r=await fetch("/api/block-ip",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ip})});
    const d=await r.json();const el=document.getElementById("block-result");
    if(d.success){el.className="result-msg success";el.innerHTML=`<i class="fas fa-check-circle"></i> ${d.message} (Total: ${d.blocked.length})`;}
    else{el.className="result-msg error";el.innerHTML=`<i class="fas fa-times-circle"></i> ${d.error||"Failed."}`;}
    fetchStats();
  }catch(e){console.error("Block:",e);}
}

// ── Add Log Modal ──
const modal=document.getElementById("modal-overlay");
document.getElementById("btn-add-log").addEventListener("click",()=>modal.classList.add("open"));
document.getElementById("modal-close").addEventListener("click",()=>modal.classList.remove("open"));
document.getElementById("modal-cancel").addEventListener("click",()=>modal.classList.remove("open"));
modal.addEventListener("click",e=>{if(e.target===modal)modal.classList.remove("open")});

document.getElementById("add-log-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const p={source_ip:document.getElementById("log-source-ip").value.trim(),destination_ip:document.getElementById("log-dest-ip").value.trim(),event_type:document.getElementById("log-event-type").value,severity:document.getElementById("log-severity").value,port:parseInt(document.getElementById("log-port").value)||0,status:document.getElementById("log-status").value,message:document.getElementById("log-message").value.trim()};
  const res=document.getElementById("add-log-result");
  if(!p.source_ip){res.className="result-msg error";res.textContent="Source IP required.";return;}
  try{
    const r=await fetch("/api/add-log",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(p)});
    const d=await r.json();
    if(d.success){
      res.className="result-msg success";res.innerHTML=`<i class="fas fa-check-circle"></i> Log #${d.log.id} added.`;
      refreshAll();
      setTimeout(()=>{document.getElementById("add-log-form").reset();res.className="result-msg";res.textContent="";modal.classList.remove("open");},1200);
    }else{res.className="result-msg error";res.textContent=d.error||"Failed.";}
  }catch(err){res.className="result-msg error";res.textContent="Network error.";}
});

// ── Clear Logs ──
const confirmModal=document.getElementById("confirm-overlay");
document.getElementById("btn-clear-logs").addEventListener("click",()=>confirmModal.classList.add("open"));
document.getElementById("confirm-no").addEventListener("click",()=>confirmModal.classList.remove("open"));
confirmModal.addEventListener("click",e=>{if(e.target===confirmModal)confirmModal.classList.remove("open")});
document.getElementById("confirm-yes").addEventListener("click",async()=>{
  try{await fetch("/api/clear-logs",{method:"POST"});confirmModal.classList.remove("open");refreshAll();}catch(e){console.error(e);}
});

// ── Refresh ──
document.getElementById("btn-refresh").addEventListener("click",refreshAll);
function refreshAll(){
  fetchStats();
  const at=document.querySelector(".nav-item.active");
  if(at){const t=at.dataset.tab;if(t==="logs")fetchLogs();if(t==="alerts")fetchAlerts();if(t==="incidents")fetchIncidents();}
}

// ── Auto-Refresh ──
fetchStats();
setInterval(()=>{
  fetchStats();
  const at=document.querySelector(".nav-item.active");
  if(at){const t=at.dataset.tab;if(t==="logs")fetchLogs();if(t==="alerts")fetchAlerts();if(t==="incidents")fetchIncidents();}
},REFRESH_MS);
