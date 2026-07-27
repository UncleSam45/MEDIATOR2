const fallbackImage = "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1200&q=85";
const defaults = {
  characters: [
    {id:"c1",name:"Vaelora Ashwyn",subtitle:"The Last Starborn",meta:"LEVEL 47",description:"Bearer of a dying constellation, Vaelora walks the boundary between the old world and whatever comes after.",image:"https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=85",relations:["l1","l2"],progress:86},
    {id:"c2",name:"Kael Voss",subtitle:"Riftwalker",meta:"LEVEL 32",description:"A quiet pathfinder who can hear the ancient gates calling through stone.",image:"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=85",relations:["l2"],progress:72},
    {id:"c3",name:"Nyra Sol",subtitle:"Ember Oracle",meta:"LEVEL 29",description:"The oracle of a vanished sun, searching the realm for its final spark.",image:"https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=1200&q=85",relations:["l1"],progress:64}
  ],
  locations: [
    {id:"l1",name:"Aetherfall Citadel",subtitle:"Ancient Stronghold",meta:"THE HIGHLANDS",description:"A fortress suspended where the mountains meet the stars. Its dormant engines still hum beneath the frost.",image:"https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1400&q=85",progress:91},
    {id:"l2",name:"The Glass Wastes",subtitle:"Forbidden Expanse",meta:"EASTERN REACH",description:"A radiant desert formed when the sky broke. Every shard reflects a different version of the past.",image:"https://images.unsplash.com/photo-1509316785289-025f5b846b35?auto=format&fit=crop&w=1400&q=85",progress:78},
    {id:"l3",name:"Orryn Hollow",subtitle:"Hidden Settlement",meta:"LOWLANDS",description:"Lanterns burn through the endless mist, guarding a community the empire forgot.",image:"https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=1400&q=85",progress:53}
  ]
};
let state = JSON.parse(localStorage.getItem("mediator-universe") || "null") || structuredClone(defaults);
let currentPage="home", currentDetail=null, searchTerm="";
const $=s=>document.querySelector(s), view=$("#view");
const escapeHTML=s=>String(s??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const save=()=>{localStorage.setItem("mediator-universe",JSON.stringify(state));updateCounts()};
const updateCounts=()=>{$("#characterCount").textContent=state.characters.length;$("#locationCount").textContent=state.locations.length};
const img=(url,alt)=>`<img src="${escapeHTML(url||fallbackImage)}" alt="${escapeHTML(alt)}" onerror="this.src='${fallbackImage}'">`;

function home(){
 const c=state.characters[0],l=state.locations[0];
 view.innerHTML=`<div class="intro-row"><div><div class="eyebrow">WELCOME BACK, ARCHITECT</div><h1>Your universe is <em>alive.</em></h1></div><p>Continue shaping The Shattered Realm. Every story, soul, and place you create becomes part of something greater.</p></div>
 <div class="hero-grid">
 ${c?`<article class="featured" data-detail="characters:${c.id}">${img(c.image,c.name)}<div class="feature-content"><span class="tag">FEATURED CHARACTER</span><h2>${escapeHTML(c.name)}</h2><p>${escapeHTML(c.subtitle)} · ${escapeHTML(c.meta)}</p></div></article>`:""}
 ${l?`<article class="location-feature" data-detail="locations:${l.id}">${img(l.image,l.name)}<div class="feature-content"><span class="tag">EXPLORE LOCATION</span><h2>${escapeHTML(l.name)}</h2><p>${escapeHTML(l.meta)}</p></div></article>`:""}</div>
 <div class="dashboard-strip"><article class="quick-card" data-create="characters"><span class="quick-plus">+</span><div><strong>Forge a new character</strong><small>Add another soul to your universe</small></div></article><article class="stat-card"><small>WORLD COMPLETION</small><div class="big">68% <span>▲ 4%</span></div></article><article class="stat-card"><small>UNIVERSE ARCHIVE</small><div class="big">${state.characters.length+state.locations.length} <span>ENTRIES</span></div></article></div>`;
}
function collection(type){
 const title=type==="characters"?"Meet the legends.":"Explore the realm.";
 const copy=type==="characters"?"Every hero, villain, and wanderer shaping the fate of your universe.":"Discover the places where history is written and legends take their first breath.";
 const items=state[type].filter(x=>(x.name+x.subtitle).toLowerCase().includes(searchTerm.toLowerCase()));
 view.innerHTML=`<div class="intro-row"><div><div class="eyebrow">${type.toUpperCase()} ARCHIVE</div><h1>${title}</h1><p>${copy}</p></div><div class="collection-tools"><input class="search-box" id="collectionSearch" value="${escapeHTML(searchTerm)}" placeholder="Search ${type}…"><button class="filter-btn">Latest ↓</button></div></div><div class="collection-grid">${items.map((x,i)=>`<article class="entity-card" data-detail="${type}:${x.id}">${img(x.image,x.name)}<div class="card-content"><span class="mini-tag">${escapeHTML(x.meta)}</span><h3>${escapeHTML(x.name)}</h3><p>${escapeHTML(x.subtitle)}</p><div class="progress"><i style="width:${x.progress||45}%"></i></div></div></article>`).join("")}<article class="empty-card" data-create="${type}"><div><div class="quick-plus">+</div><p>Create ${type.slice(0,-1)}</p></div></article></div>`;
 $("#collectionSearch").addEventListener("input",e=>{searchTerm=e.target.value;collection(type);$("#collectionSearch").focus()});
}
function detail(type,id){
 const item=state[type].find(x=>x.id===id); if(!item){navigate(type);return}
 const related=type==="characters"?state.locations.filter(l=>(item.relations||[]).includes(l.id)):state.characters.filter(c=>(c.relations||[]).includes(item.id));
 view.innerHTML=`<article class="detail-hero">${img(item.image,item.name)}<div class="detail-copy"><div class="eyebrow">${escapeHTML(item.meta)}</div><h1>${escapeHTML(item.name)}</h1><p class="subtitle">${escapeHTML(item.subtitle)}</p><p class="lore">${escapeHTML(item.description||"This archive entry is waiting for its story.")}</p><div class="detail-actions"><button class="create-btn" data-edit="${type}:${id}">Edit profile</button><button class="text-btn" data-delete="${type}:${id}">Archive entry</button></div></div><aside class="connections"><h4>${type==="characters"?"CONNECTED LOCATIONS":"CHARACTERS PRESENT"}</h4>${related.length?related.map(x=>`<div class="connection" data-detail="${type==="characters"?"locations":"characters"}:${x.id}">${img(x.image,x.name)}<strong>${escapeHTML(x.name)}</strong></div>`).join(""):'<small>No connections yet</small>'}</aside></article>`;
}
function navigate(page,detailId){currentPage=page;currentDetail=detailId||null;searchTerm="";$("#pageLabel").textContent=detailId?"ARCHIVE PROFILE":page==="home"?"COMMAND CENTER":page.toUpperCase();document.querySelectorAll(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.page===page));detailId?detail(page,detailId):page==="home"?home():collection(page);window.scrollTo({top:0,behavior:"smooth"})}
function openEditor(type,id){
 const item=id?state[type].find(x=>x.id===id):null, form=$("#editorForm");form.reset();form.elements.type.value=type;form.elements.id.value=id||"";
 $("#modalTitle").textContent=`${id?"Edit":"Create"} ${type.slice(0,-1)}`;$("#modalEyebrow").textContent=type==="characters"?"CHARACTER ARCHIVE":"LOCATION ARCHIVE";
 $("#subtitleLabel").firstChild.textContent=type==="characters"?"Title ":"Location type ";$("#metaLabel").firstChild.textContent=type==="characters"?"Level ":"Region ";
 const rel=$("#relationLabel");rel.hidden=type==="locations";form.elements.relations.innerHTML=state.locations.map(l=>`<option value="${l.id}">${escapeHTML(l.name)}</option>`).join("");
 if(item){["name","subtitle","meta","image","description"].forEach(k=>form.elements[k].value=item[k]||"");[...form.elements.relations.options].forEach(o=>o.selected=(item.relations||[]).includes(o.value))}
 $("#modal").hidden=false;setTimeout(()=>form.elements.name.focus(),50)
}
function closeModal(){$("#modal").hidden=true}function toast(msg){$("#toast").textContent=msg;$("#toast").classList.add("show");setTimeout(()=>$("#toast").classList.remove("show"),2400)}
document.addEventListener("click",e=>{const nav=e.target.closest("[data-page]"),create=e.target.closest("[data-create]"),target=e.target.closest("[data-detail]"),edit=e.target.closest("[data-edit]"),del=e.target.closest("[data-delete]");if(nav)navigate(nav.dataset.page);if(create)openEditor(create.dataset.create);if(target){const [t,id]=target.dataset.detail.split(":");navigate(t,id)}if(edit){const [t,id]=edit.dataset.edit.split(":");openEditor(t,id)}if(del){const [t,id]=del.dataset.delete.split(":");if(confirm("Archive this entry? You can’t undo this action.")){state[t]=state[t].filter(x=>x.id!==id);if(t==="locations")state.characters.forEach(c=>c.relations=(c.relations||[]).filter(r=>r!==id));save();navigate(t);toast("Entry archived")}}});
$("#globalCreate").onclick=()=>openEditor(currentPage==="locations"?"locations":"characters");$("#searchToggle").onclick=()=>{if(currentPage==="home")navigate("characters");setTimeout(()=>$("#collectionSearch")?.focus(),50)};$("#modalClose").onclick=$("#cancelEdit").onclick=closeModal;$("#modal").onclick=e=>{if(e.target===$("#modal"))closeModal()};
$("#editorForm").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),type=f.get("type"),id=f.get("id")||`${type[0]}${Date.now()}`;const old=state[type].find(x=>x.id===id);const item={...old,id,name:f.get("name"),subtitle:f.get("subtitle"),meta:f.get("meta"),image:f.get("image")||fallbackImage,description:f.get("description"),progress:old?.progress||38};if(type==="characters")item.relations=f.getAll("relations");old?Object.assign(old,item):state[type].unshift(item);save();closeModal();navigate(type,id);toast(old?"Archive updated":"New entry added")};
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});updateCounts();navigate("home");
