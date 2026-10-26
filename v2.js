/* LEARN v2：段落內嵌練習 + 間隔複習（localStorage） */
(function(){
  const V=window.V2; if(!V) return;
  const KEY=`${V.subj}/v2-srs${V.mode==='private'?'-private':''}`;
  const DAY=864e5, IV=[0,1,3,7,14,30,60]; // Leitner 盒子間隔（天）
  const load=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{}}catch{return{}}};
  const save=s=>localStorage.setItem(KEY,JSON.stringify(s));
  let S=load();
  const esc=x=>String(x).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const slots=[...document.querySelectorAll('.v2-quiz')];
  // 每題所在段落的閱讀順序
  const qOrder={}; slots.forEach((el,i)=>{(el.dataset.qids||'').split(',').filter(Boolean).forEach(id=>qOrder[id]=i)});
  function record(id,ok){
    const r=S[id]||{box:0,n:0,c:0};
    r.n++; if(ok){r.c++; r.box=Math.min(r.box+1,IV.length-1);} else r.box=1;
    r.last=Date.now(); r.due=Date.now()+(ok?IV[r.box]:0.0)*DAY + (ok?0:10*60e3);
    S[id]=r; save(S); stats();
  }
  function dueReviews(beforeIdx,exclude,n){
    const now=Date.now();
    return Object.keys(S).filter(id=>V.q[id] && qOrder[id]!==undefined && qOrder[id]<beforeIdx && !exclude.has(id) && S[id].due<=now)
      .sort((a,b)=>(S[a].box-S[b].box)||(S[a].due-S[b].due)).slice(0,n);
  }
  function renderQ(id,review){
    const q=V.q[id]; const d=document.createElement('div'); d.className='v2-q'; d.dataset.id=id;
    d.innerHTML=`<div class="v2-qt">${review?'<span class="v2-rv">複習</span>':''}${esc(q.question)}</div>`+
      Object.entries(q.options).map(([k,v])=>`<button class="v2-opt" data-k="${k}"><b>${k}</b>${esc(v)}</button>`).join('');
    d.addEventListener('click',e=>{
      const b=e.target.closest('.v2-opt'); if(!b||b.disabled) return;
      const ok=b.dataset.k===q.answer;
      d.querySelectorAll('.v2-opt').forEach(x=>{x.disabled=true; if(x.dataset.k===q.answer) x.classList.add('ok');});
      if(!ok) b.classList.add('bad');
      const ex=document.createElement('div'); ex.className='v2-exp';
      ex.innerHTML=`<span class="r ${ok?'ok':'bad'}">${ok?'✔ 答對':'✘ 答錯，正解 '+q.answer}</span>　${esc(q.explanation)} <button class="v2-redo">重做</button>`;
      ex.querySelector('.v2-redo').onclick=()=>{d.replaceWith(renderQ(id,review));};
      d.appendChild(ex); record(id,ok);
    });
    return d;
  }
  // 章末：最後一個 slot 視為章末，若本章沒有任何題，只放複習
  const lastOfChapter={}; slots.forEach((el,i)=>lastOfChapter[el.dataset.chapter]=i);
  const used=new Set();
  slots.forEach((el,i)=>{
    const own=(el.dataset.qids||'').split(',').filter(Boolean).filter(id=>V.q[id]);
    own.forEach(id=>used.add(id));
    const isEnd=lastOfChapter[el.dataset.chapter]===i;
    const nrev= own.length? Math.min(2,Math.ceil(own.length/2)) : (isEnd?3:0);
    const rev=nrev?dueReviews(i,used,nrev):[]; rev.forEach(id=>used.add(id));
    if(!own.length && !rev.length) return;
    const card=document.createElement('div'); card.className='v2-card';
    const label= own.length ? (isEnd?'章末練習':'本段練習') : '章末複習';
    card.innerHTML=`<div class="v2-card-h"><span>✏️ ${label}</span><span class="v2-tag">${own.length?own.length+' 題本段':''}${rev.length?(own.length?' · ':'')+rev.length+' 題複習':''}</span></div>`;
    own.forEach(id=>card.appendChild(renderQ(id,false)));
    rev.forEach(id=>card.appendChild(renderQ(id,true)));
    el.appendChild(card);
  });
  function stats(){
    const box=document.getElementById('v2-stats'); if(!box) return;
    const ids=Object.keys(V.q), done=ids.filter(id=>S[id]), now=Date.now();
    const due=done.filter(id=>S[id].due<=now).length;
    const acc=done.reduce((a,id)=>a+S[id].c,0), tot=done.reduce((a,id)=>a+S[id].n,0);
    box.innerHTML=`練習：已做 <b>${done.length}</b>/${ids.length} 題 · 正確率 <b>${tot?Math.round(acc*100/tot):0}%</b><br>待複習 <b>${due}</b> 題（讀到後面段落時會自動穿插）`;
  }
  stats();
  // 手機浮動圖釘：直接觸發原本的「標記」按鈕，行為與桌機相同
  const setBtn=document.getElementById('set-bookmark-btn');
  if(setBtn){ const f=document.createElement('button'); f.className='v2-fab'; f.title='標記目前位置（圖釘）'; f.setAttribute('aria-label','標記目前位置'); f.textContent='📍'; f.onclick=()=>setBtn.click(); document.body.appendChild(f); }
})();
