/* Case-page film player. Shared by every /work/<project>/ page.
   Loading stages, so a page costs little until the visitor asks for more:
   1. poster image (in the HTML)
   2. a 3-second silent loop, only while the film is on screen, and never with reduced motion or data saver
   3. the full film with sound, only after Play, a chapter or the timeline is pressed
   Media files: <name>-loop.{av1,h264}.mp4, <name>-1080.{av1,hevc}.mp4, <name>-720.h264.mp4, <name>-en.vtt, <name>-scrub.webp (8x5 frames, one every 0.5 s)
   To move video to R2 or another host later, change data-media on the script tag. */
(function(){
  var me=document.currentScript,base=me.dataset.media,name=me.dataset.name,dur=+me.dataset.dur;
  var chapters=JSON.parse(me.dataset.chapters||'[]');
  var $=function(id){return document.getElementById(id)};
  var film=$('film'),loop=$('loop'),full=$('full'),play=$('play'),scrub=$('scrub'),prog=$('prog'),head=$('head'),peek=$('peek');
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saver=!!(navigator.connection&&navigator.connection.saveData);
  var src=function(v,list){v.innerHTML=list.map(function(s){return '<source src="'+base+s[0]+'" type=\''+s[1]+'\''+(s[2]?' media="'+s[2]+'"':'')+'>'}).join('')};
  var fmt=function(t){t=Math.max(0,Math.round(t));return Math.floor(t/60)+':'+('0'+t%60).slice(-2)};

  /* 2. ambient loop */
  if(!reduce&&!saver&&loop){
    var started=false;
    new IntersectionObserver(function(es){es.forEach(function(e){
      if(film.classList.contains('playing'))return;
      if(e.isIntersecting){
        if(!started){started=true;src(loop,[[name+'-loop.av1.mp4','video/mp4; codecs="av01.0.04M.08"'],[name+'-loop.h264.mp4','video/mp4; codecs="avc1.64001E"']]);loop.load();loop.addEventListener('playing',function(){loop.classList.add('on')},{once:true})}
        var p=loop.play();if(p&&p.catch)p.catch(function(){});
      }else loop.pause();
    })},{threshold:.35}).observe(film);
  }

  /* 3. full film, loaded on demand */
  var ready=false;
  function load(){
    if(ready)return;ready=true;
    src(full,[
      [name+'-1080.av1.mp4','video/mp4; codecs="av01.0.08M.10"','(min-width: 700px)'],
      [name+'-1080.hevc.mp4','video/mp4; codecs="hvc1.1.6.L120.90"','(min-width: 700px)'],
      [name+'-720.h264.mp4','video/mp4; codecs="avc1.64001F"']
    ]);
    var tr=document.createElement('track');tr.kind='captions';tr.srclang='en';tr.label='English';tr.src=base+name+'-en.vtt';full.appendChild(tr);
    full.load();
  }
  function start(t){
    load();film.classList.add('playing');if(loop)loop.pause();
    var go=function(){if(t!=null)full.currentTime=t;full.muted=false;var p=full.play();if(p&&p.catch)p.catch(function(){})};
    if(full.readyState>=1)go();else full.addEventListener('loadedmetadata',go,{once:true});
    full.focus({preventScroll:true});
  }
  play.addEventListener('click',function(){start(null)});
  /* warm the connection when the visitor reaches for play, without downloading the film */
  play.addEventListener('pointerenter',function(){if(!ready)full.preload='metadata'},{once:true});

  /* chapters */
  var ch=$('chapters');
  if(ch){
    ch.innerHTML=chapters.map(function(c,i){return '<button type="button" data-i="'+i+'"><span>'+fmt(c[0])+'</span>'+c[1]+'</button>'}).join('');
    ch.addEventListener('click',function(e){var b=e.target.closest('button');if(b)start(chapters[+b.dataset.i][0])});
  }
  document.querySelectorAll('.beat .at').forEach(function(b){b.addEventListener('click',function(){start(+b.dataset.t);film.scrollIntoView({behavior:reduce?'auto':'smooth',block:'center'})})});

  /* timeline: chapter segments, a progress bar and a preview of the frame under the pointer */
  if(scrub){
    chapters.forEach(function(c,i){var n=chapters[i+1],s=document.createElement('div');s.className='seg';s.style.left=(c[0]/dur*100)+'%';s.style.width=(((n?n[0]:dur)-c[0])/dur*100)+'%';scrub.insertBefore(s,prog)});
    var pic=peek.querySelector('i'),cap=peek.querySelector('em'),spriteOn=false;
    var at=function(x){var r=scrub.getBoundingClientRect();return Math.min(1,Math.max(0,(x-r.left)/r.width))};
    var show=function(f){
      if(!spriteOn){spriteOn=true;pic.style.backgroundImage='url('+base+name+'-scrub.webp)'}
      var t=f*dur,i=Math.min(39,Math.floor(t*2)),c=i%8,r=Math.floor(i/8),w=scrub.offsetWidth;
      pic.style.backgroundPosition=(c/7*100)+'% '+(r/4*100)+'%';
      cap.textContent=fmt(t)+'  '+(chapters.filter(function(k){return k[0]<=t}).pop()||['',''])[1];
      var x=f*w;peek.style.left=Math.min(w-104,Math.max(104,x))+'px';head.style.left=x+'px';
    };
    scrub.addEventListener('pointerenter',function(){scrub.classList.add('hover')});
    scrub.addEventListener('pointerleave',function(){scrub.classList.remove('hover')});
    scrub.addEventListener('pointermove',function(e){show(at(e.clientX))});
    scrub.addEventListener('pointerdown',function(e){scrub.classList.add('hover');show(at(e.clientX));scrub.setPointerCapture(e.pointerId)});
    scrub.addEventListener('pointerup',function(e){var f=at(e.clientX);start(f*dur);if(e.pointerType!=='mouse')setTimeout(function(){scrub.classList.remove('hover')},500)});
    scrub.addEventListener('keydown',function(e){
      var t=full.currentTime||0,k=e.key;
      if(k==='ArrowRight'||k==='ArrowLeft'){e.preventDefault();start(Math.min(dur,Math.max(0,t+(k==='ArrowRight'?2:-2))))}
      else if(k==='Enter'||k===' '){e.preventDefault();if(full.paused)start(null);else full.pause()}
    });
    full.addEventListener('timeupdate',function(){
      var t=full.currentTime;prog.style.width=(t/dur*100)+'%';
      scrub.setAttribute('aria-valuenow',Math.round(t));scrub.setAttribute('aria-valuetext',fmt(t));
      if(ch){var cur=-1;chapters.forEach(function(c,i){if(c[0]<=t)cur=i});ch.querySelectorAll('button').forEach(function(b,i){b.setAttribute('aria-current',i===cur)})}
    });
  }

  /* stills open full size */
  var view=$('view');
  if(view){
    var vi=view.querySelector('img');
    document.querySelectorAll('.stills button').forEach(function(b){b.addEventListener('click',function(){vi.src=b.dataset.full;vi.alt=b.querySelector('img').alt;view.showModal()})});
    $('viewX').onclick=function(){view.close()};
    view.addEventListener('click',function(e){if(e.target===view)view.close()});
  }
})();
