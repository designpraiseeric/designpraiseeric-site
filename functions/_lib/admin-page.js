// The owner's newsletter desk (served at /brand/newsletter/ after the /brand sign-in).
// Kept as a String.raw template: the page script must not use backticks or "${".
export const ADMIN_HTML = String.raw`<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Newsletter — DesignPraise</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<script>try{var t=localStorage.getItem("dp-theme");document.documentElement.dataset.theme=t==="light"?"light":"dark"}catch(e){}</script>
<style>
@font-face{font-family:"DesignPraise Sans";src:url(/fonts/DesignPraiseSans.woff2) format("woff2");font-weight:100 900;font-display:swap}
@font-face{font-family:"Google Sans Code";src:url(/fonts/GoogleSansCode.woff2) format("woff2");font-weight:300 800;font-display:swap}
:root{--out:cubic-bezier(.16,1,.3,1);--sig:cubic-bezier(.7,0,.2,1);--sans:"DesignPraise Sans","Segoe UI",system-ui,sans-serif;--mono:"Google Sans Code",ui-monospace,Menlo,monospace;--violet:#6403ee;--amber:#ffa800;--volt:#03ee63}
:root[data-theme=light]{color-scheme:light;--bg:#f7f5fc;--card:#fff;--card2:#f1ebff;--ink:#1a0d3e;--mute:#5a5278;--line:#e8e3f3;--accent:#6403ee;--bad:#c8235a}
:root[data-theme=dark]{color-scheme:dark;--bg:#0e0820;--card:#170b3a;--card2:#24135a;--ink:#f4f0ff;--mute:#b4a9dc;--line:#2c1f5c;--accent:#a57bff;--bad:#ff6a8a}
*{box-sizing:border-box;min-width:0}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 var(--sans);-webkit-font-smoothing:antialiased}
.wrap{max-width:1180px;margin:0 auto;padding:22px clamp(16px,4vw,40px) 60px}
header{display:flex;align-items:center;gap:14px;margin-bottom:26px}
header h1{font-size:24px;letter-spacing:-.02em;margin:0}
header .sp{flex:1}
a{color:var(--accent)}
.pill{font:500 12px var(--mono);padding:5px 10px;border-radius:99px;box-shadow:inset 0 0 0 1px var(--line);color:var(--mute);white-space:nowrap}
.pill.ok{color:var(--volt);box-shadow:inset 0 0 0 1px rgba(3,238,99,.4)}
.pill.warn{color:var(--amber);box-shadow:inset 0 0 0 1px rgba(255,168,0,.45)}
.grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:20px;align-items:start}
@media(max-width:920px){.grid{grid-template-columns:1fr}}
.card{background:var(--card);border-radius:16px;padding:20px;box-shadow:0 0 0 1px var(--line);margin-bottom:20px;animation:rise .5s var(--out) both}
@keyframes rise{from{opacity:0;transform:translateY(8px)}}
.card h2{font-size:16px;margin:0 0 14px;letter-spacing:-.01em;display:flex;align-items:center;gap:8px}
.card h2:before{content:"";width:9px;height:9px;border-radius:2.5px;background:var(--accent);transform:rotate(45deg)}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.stat{background:var(--card2);border-radius:12px;padding:12px 14px}
.stat b{display:block;font-size:26px;letter-spacing:-.03em;line-height:1.1}
.stat span{font:500 11px var(--mono);color:var(--mute)}
.topics{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;font:500 12px var(--mono);color:var(--mute)}
label{display:grid;gap:6px;font-weight:600;font-size:13px;margin-bottom:12px}
input,select,textarea{font:15px var(--sans);color:var(--ink);background:var(--bg);border:0;border-radius:10px;padding:11px 12px;box-shadow:inset 0 0 0 1.5px var(--line);outline:0;width:100%}
input:focus,select:focus,textarea:focus{box-shadow:inset 0 0 0 2px var(--accent)}
textarea{min-height:260px;resize:vertical;font:14px/1.55 var(--mono)}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 16px;border-radius:10px;border:0;background:var(--violet);color:#fff;font:600 14px var(--sans);cursor:pointer;text-decoration:none}
.btn:hover{filter:brightness(1.12)}
.btn.line{background:transparent;color:var(--ink);box-shadow:inset 0 0 0 1.5px var(--line)}
.btn.line:hover{box-shadow:inset 0 0 0 1.5px var(--accent)}
.btn[disabled]{opacity:.5;cursor:default;filter:none}
.help{font-size:13px;color:var(--mute)}
.help code,.mono{font:12px var(--mono)}
.msg{font-size:14px;min-height:1.4em;margin-top:10px}
.msg.err{color:var(--bad)}
iframe{width:100%;height:620px;border:0;border-radius:12px;background:#f7f5fc}
table{width:100%;border-collapse:collapse;font-size:13px}
td,th{text-align:left;padding:8px 6px;border-bottom:1px solid var(--line);vertical-align:top}
th{font:500 11px var(--mono);color:var(--mute)}
.rel{display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--line);font-weight:400;margin:0;cursor:pointer}
.rel input{width:auto;margin-top:4px;box-shadow:none;accent-color:var(--violet)}
.rel small{display:block;color:var(--mute)}
.bar{height:8px;border-radius:99px;background:var(--card2);overflow:hidden;margin-top:12px}
.bar i{display:block;height:100%;width:0;background:var(--accent);transition:width .4s var(--out)}
.setup ol{margin:8px 0 0;padding-left:20px}
.setup li{margin-bottom:6px}
[hidden]{display:none!important}
</style>
</head>
<body>
<div class="wrap">
<header>
  <h1>Newsletter</h1><span class="pill" id="mailPill">…</span><span class="sp"></span>
  <a class="btn line" href="/brand/">Brand area</a><a class="btn line" href="/" target="_blank" rel="noopener">Site</a>
</header>

<div class="card setup" id="setup" hidden>
  <h2>Turn on sending</h2>
  <p class="help" style="margin:0">Sign-ups already work and are saved. To send confirmation emails and newsletters, give the site a way to send mail. With your Gmail (free, about 500 recipients a day):</p>
  <ol class="help">
    <li>Google Account → Security → turn on 2-Step Verification (if it isn’t already).</li>
    <li>Google Account → search “App passwords” → create one named “designpraise site”. Copy the 16-letter password.</li>
    <li>Cloudflare → Workers &amp; Pages → designpraiseeric → Settings → Variables and secrets → Add → type <b>Secret</b>, name <code>SMTP_PASS</code>, value: that password. Save, then redeploy (Deployments → ⋯ → Retry deployment).</li>
    <li>Come back here and press “Check connection”, then “Send confirmations” for anyone who signed up while sending was off.</li>
  </ol>
  <p class="help">Sending from: <span class="mono" id="fromAddr"></span>. To use another provider later, also set <code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USER</code> and <code>NEWSLETTER_FROM</code>.</p>
</div>

<div class="grid">
<div>
  <div class="card">
    <h2>Write</h2>
    <div class="row" style="gap:12px;align-items:end">
      <label style="flex:1 1 200px">Send to<select id="topic"></select></label>
      <label style="flex:2 1 260px">Subject<input id="subject" maxlength="200" placeholder="What’s new"></label>
    </div>
    <label>Message<textarea id="body" spellcheck="true" placeholder="Write as you’d speak to one person."></textarea></label>
    <p class="help" style="margin-top:-4px">Format: <code># Heading</code> · <code>## Smaller</code> · <code>- list</code> · <code>&gt; quote</code> · <code>**bold**</code> · <code>*italic*</code> · <code>[link](https://…)</code> · <code>![image](https://…jpg)</code> · <code>[[Button](https://…)]</code> · <code>---</code> divider. Leave a blank line between paragraphs. Your draft is kept in this browser.</p>
    <div class="row">
      <button class="btn line" id="testBtn" type="button">Send a test to me</button>
      <button class="btn" id="sendBtn" type="button">Send</button>
      <button class="btn line" id="clearBtn" type="button">Clear</button>
    </div>
    <div class="bar" id="bar" hidden><i id="barFill"></i></div>
    <p class="msg" id="msg" role="status"></p>
  </div>
  <div class="card">
    <h2>Preview</h2>
    <iframe id="preview" title="Email preview" sandbox=""></iframe>
  </div>
</div>

<div>
  <div class="card">
    <h2>Subscribers</h2>
    <div class="stats">
      <div class="stat"><b id="nConfirmed">–</b><span>confirmed</span></div>
      <div class="stat"><b id="nPending">–</b><span>awaiting confirmation</span></div>
      <div class="stat"><b id="nUnsub">–</b><span>unsubscribed</span></div>
    </div>
    <div class="topics" id="byTopic"></div>
    <div class="row" style="margin-top:14px">
      <button class="btn line" id="confirmBtn" type="button">Send confirmations</button>
      <button class="btn line" id="checkBtn" type="button">Check connection</button>
      <a class="btn line" href="api/export.csv">Export CSV</a>
    </div>
    <p class="msg" id="subMsg" role="status"></p>
  </div>

  <div class="card">
    <h2>Suggestions</h2>
    <div id="season" class="help"></div>
    <div id="rels"></div>
    <div class="row" style="margin-top:12px" id="relBtns" hidden>
      <button class="btn line" id="draftRel" type="button">Draft announcement</button>
      <button class="btn line" id="markRel" type="button">Mark as announced</button>
    </div>
  </div>

  <div class="card">
    <h2>Sent</h2>
    <table><thead><tr><th>Subject</th><th>To</th><th>Delivered</th><th>Date</th></tr></thead><tbody id="sent"></tbody></table>
  </div>

  <div class="card">
    <h2>Latest sign-ups</h2>
    <table><thead><tr><th>Email</th><th>Topics</th><th>Status</th></tr></thead><tbody id="recent"></tbody></table>
  </div>
</div>
</div>
</div>

<script src="/js/seasons.js"></script>
<script>
(function(){
  "use strict";
  var $=function(id){return document.getElementById(id)},data=null,busy=false;
  var NAMES={all:"Everyone"};
  function api(path,body){
    return fetch("api/"+path,body===undefined?{}:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
      .then(function(r){return r.json().catch(function(){return{}}).then(function(j){if(!r.ok)throw new Error(j.error||("Error "+r.status));return j})});
  }
  function say(el,text,err){el.textContent=text||"";el.className="msg"+(err?" err":"")}
  function td(tr,text){var c=document.createElement("td");c.textContent=text;tr.appendChild(c);return c}
  function date(ms){return ms?new Date(ms).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"}):""}

  // Draft lives in this browser so nothing is lost on reload.
  ["subject","body","topic"].forEach(function(k){try{var v=localStorage.getItem("dp-news-"+k);if(v!==null)$(k).value=v}catch(e){}});
  function save(){["subject","body","topic"].forEach(function(k){try{localStorage.setItem("dp-news-"+k,$(k).value)}catch(e){}})}

  var t=null,announce=null;
  function preview(){clearTimeout(t);t=setTimeout(function(){save();api("preview",{subject:$("subject").value,body:$("body").value}).then(function(j){$("preview").srcdoc=j.html}).catch(function(){})},300)}
  ["subject","body"].forEach(function(k){$(k).addEventListener("input",preview)});
  $("topic").addEventListener("change",function(){save();sendLabel()});

  function audience(){var v=$("topic").value;return v==="all"?(data?data.counts.confirmed||0:0):(data?data.byTopic[v]||0:0)}
  function sendLabel(){var n=audience();$("sendBtn").textContent="Send to "+n+(n===1?" person":" people");$("sendBtn").disabled=busy||!n||!(data&&data.mail.ready)}

  function render(d){
    data=d;
    $("mailPill").textContent=d.mail.ready?"Sending on":"Sending off";
    $("mailPill").className="pill "+(d.mail.ready?"ok":"warn");
    $("setup").hidden=d.mail.ready; $("fromAddr").textContent=d.mail.from;
    $("nConfirmed").textContent=d.counts.confirmed||0; $("nPending").textContent=d.counts.pending||0; $("nUnsub").textContent=d.counts.unsubscribed||0;
    var bt=$("byTopic");bt.innerHTML="";
    var sel=$("topic"),cur=sel.value||(function(){try{return localStorage.getItem("dp-news-topic")}catch(e){return""}})()||"all";sel.innerHTML="";
    var o=document.createElement("option");o.value="all";o.textContent="Everyone ("+(d.counts.confirmed||0)+")";sel.appendChild(o);
    Object.keys(d.byTopic).forEach(function(k){
      NAMES[k]=d.topicNames[k];
      var s=document.createElement("span");s.className="pill";s.textContent=d.topicNames[k]+": "+d.byTopic[k];bt.appendChild(s);
      var op=document.createElement("option");op.value=k;op.textContent=d.topicNames[k]+" ("+d.byTopic[k]+")";sel.appendChild(op);
    });
    sel.value=cur; if(!sel.value)sel.value="all";
    $("confirmBtn").disabled=!d.mail.ready||!(d.counts.pending);
    $("testBtn").disabled=!d.mail.ready; $("checkBtn").disabled=!d.mail.ready;
    sendLabel();

    var sb=$("sent");sb.innerHTML="";
    if(!d.campaigns.length){var r0=document.createElement("tr");td(r0,"Nothing sent yet.").colSpan=4;sb.appendChild(r0)}
    d.campaigns.forEach(function(c){var r=document.createElement("tr");td(r,c.subject);td(r,NAMES[c.topic]||c.topic);
      td(r,c.sent+" / "+c.total+(c.failed?" ("+c.failed+" failed)":"")+(c.status!=="sent"?" · unfinished":""));td(r,date(c.finished_at||c.created_at));
      if(c.status!=="sent"){var b=document.createElement("button");b.className="btn line";b.style.minHeight="30px";b.textContent="Resume";b.onclick=function(){run(c.id,c.total)};r.children[2].appendChild(document.createElement("br"));r.children[2].appendChild(b)}
      sb.appendChild(r)});

    var rb=$("recent");rb.innerHTML="";
    if(!d.recent.length){var r1=document.createElement("tr");td(r1,"No sign-ups yet.").colSpan=3;rb.appendChild(r1)}
    d.recent.forEach(function(s){var r=document.createElement("tr");td(r,s.email);td(r,s.topics.split(",").map(function(k){return d.topicNames[k]||k}).join(", "));td(r,s.status);rb.appendChild(r)});

    // Tool releases not yet announced
    var rels=$("rels");rels.innerHTML="";
    var R=d.releases||{};
    if(R.error){rels.textContent=R.error}
    else if(R.pending&&R.pending.length){
      var h=document.createElement("p");h.className="help";h.style.margin="10px 0 4px";
      h.textContent=R.firstRun?"These are the tool versions live now. Mark them as announced to start fresh, or draft an email about them.":"Tool releases not yet announced:";
      rels.appendChild(h);
      R.pending.forEach(function(x){var l=document.createElement("label");l.className="rel";var c=document.createElement("input");c.type="checkbox";c.value=x.id;c.checked=!R.firstRun;
        var s=document.createElement("span");s.textContent=x.name+" "+x.version;var sm=document.createElement("small");sm.textContent=x.changelog;s.appendChild(sm);l.appendChild(c);l.appendChild(s);rels.appendChild(l)});
      $("relBtns").hidden=false;
    } else { var p=document.createElement("p");p.className="help";p.style.margin="10px 0 0";p.textContent="Every tool release has been announced.";rels.appendChild(p);$("relBtns").hidden=true }
  }
  function load(){return api("overview").then(render).catch(function(e){say($("msg"),e.message,true)})}

  // Upcoming greeting (from the same calendar the site and tools use)
  (function(){
    if(typeof DPSeasons==="undefined")return;
    var d=new Date(),seen={};
    for(var i=0;i<45;i++){var day=new Date(d.getFullYear(),d.getMonth(),d.getDate()+i,12);var s=DPSeasons.get(day);
      if(s&&!seen[s.id]){seen[s.id]=1;
        var box=$("season"),p=document.createElement("p");p.style.margin="0 0 8px";
        p.textContent=(i===0?"Today: ":"Coming up "+day.toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short"})+": ")+s.title+" ";
        var b=document.createElement("button");b.className="btn line";b.style.minHeight="30px";b.textContent="Draft a greeting";
        (function(s){b.onclick=function(){
          if($("body").value.trim()&&!confirm("Replace the current draft?"))return;
          $("subject").value=s.title.replace(/ · week \d+/,"");
          var key=s.id==="advent"?"advent-"+Math.max(1,Math.min(4,s.week||1)):s.id;
          $("body").value="!["+s.title+"]("+location.origin+"/img/seasons/"+key+".jpg)\n\n# "+s.title.replace(/ · week \d+/,"")+"\n\n"+s.line+"\n\n> "+s.verse+"\n> — "+s.ref+" (KJV)\n\n[Write a personal note here.]\n\nWith thanks,\nDivinepraise";
          announce=null;preview()}})(s);
        p.appendChild(b);box.appendChild(p);
        if(Object.keys(seen).length>=2)break;}
    }
  })();

  function chosen(){return Array.prototype.slice.call(document.querySelectorAll("#rels input:checked")).map(function(c){return c.value})}
  $("draftRel").onclick=function(){
    var ids=chosen(),list=(data.releases.pending||[]).filter(function(x){return ids.indexOf(x.id)>=0});
    if(!list.length){say($("msg"),"Tick at least one tool.",true);return}
    if($("body").value.trim()&&!confirm("Replace the current draft?"))return;
    $("topic").value="tools";
    $("subject").value=list.length===1?list[0].name+" "+list[0].version+" is out":"New versions of "+list.length+" tools";
    var origin=location.origin,b=["Here’s what’s new in my After Effects tools.",""];
    list.forEach(function(x){b.push("## "+x.name+" "+x.version,"",x.changelog||"","","["+"See "+x.name+"]("+origin+x.page+")","")});
    b.push("If you use Baerista, the updates are waiting in the bar: open it and press Update. Standalone copies show an Update button at the bottom of the panel.","","Thanks for using them,","Divinepraise");
    $("body").value=b.join("\n");announce={};list.forEach(function(x){announce[x.id]=x.version});
    save();sendLabel();preview();say($("msg"),"Draft ready. It will mark these versions as announced once it’s sent.");
  };
  $("markRel").onclick=function(){var ids=chosen();if(!ids.length){say($("msg"),"Tick at least one tool.",true);return}
    api("mark-announced",{ids:ids}).then(function(){say($("msg"),"Marked as announced.");load()}).catch(function(e){say($("msg"),e.message,true)})};
  $("body").addEventListener("input",function(){if(!$("body").value.trim())announce=null});

  $("clearBtn").onclick=function(){if(!confirm("Clear the draft?"))return;$("subject").value="";$("body").value="";announce=null;save();preview()};
  $("testBtn").onclick=function(){var b=this;b.disabled=true;say($("msg"),"Sending a test…");
    api("test",{subject:$("subject").value,body:$("body").value}).then(function(j){say($("msg"),"Test sent to "+j.to+".")}).catch(function(e){say($("msg"),e.message,true)}).then(function(){b.disabled=false})};
  $("checkBtn").onclick=function(){say($("subMsg"),"Connecting…");api("smtp-check",{}).then(function(j){say($("subMsg"),j.ok?"Connected and signed in to the mail server.":j.error,!j.ok)}).catch(function(e){say($("subMsg"),e.message,true)})};
  $("confirmBtn").onclick=function(){var b=this;b.disabled=true;say($("subMsg"),"Sending confirmations…");
    (function next(total){api("resend-confirm",{}).then(function(j){total+=j.sent;if(j.remaining&&j.sent){say($("subMsg"),total+" sent…");next(total)}else{say($("subMsg"),total+" confirmation email"+(total===1?"":"s")+" sent.");load()}})
      .catch(function(e){say($("subMsg"),e.message,true);b.disabled=false})})(0)};

  function run(id,total){
    busy=true;sendLabel();$("bar").hidden=false;$("barFill").style.width="0";
    (function step(){api("send-batch",{id:id}).then(function(j){
      var done=j.sent+j.failed;$("barFill").style.width=(total?Math.round(done/total*100):100)+"%";
      say($("msg"),"Sent "+j.sent+" of "+total+(j.failed?" · "+j.failed+" failed":""));
      if(j.stopped){say($("msg"),"Paused: the mail server hit its limit ("+j.stopped+"). Press Resume under Sent later.",true);busy=false;load();return}
      if(j.done){say($("msg"),"Done. Sent to "+j.sent+(j.failed?", "+j.failed+" failed":"")+".");busy=false;
        $("subject").value="";$("body").value="";announce=null;save();preview();load();return}
      step();
    }).catch(function(e){say($("msg"),e.message+" — press Resume under Sent to continue.",true);busy=false;load()})})();
  }
  $("sendBtn").onclick=function(){
    var n=audience(),subj=$("subject").value.trim();
    if(!subj||!$("body").value.trim()){say($("msg"),"Add a subject and a message.",true);return}
    if(!confirm("Send “"+subj+"” to "+n+(n===1?" person":" people")+" ("+NAMES[$("topic").value]+")? This can’t be undone."))return;
    api("campaign",{subject:subj,body:$("body").value,topic:$("topic").value,announce:announce}).then(function(j){run(j.id,j.total)}).catch(function(e){say($("msg"),e.message,true)});
  };

  load().then(preview);
})();
</script>
</body>
</html>`;
