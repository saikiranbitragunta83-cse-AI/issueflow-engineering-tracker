import { STATUSES, STATUS_LABELS, PRIORITIES, normalizeTask, nextId, metrics, filterTasks, sortUpdated, isOverdue, toCSV, parseBackup, demoData } from './core.js';
import { CloudStore, cloudConfigured } from './cloud.js';

const STORAGE_KEY='issueflow.workspace.v1';
const THEME_KEY='issueflow.theme';
const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const dateShort=iso=>{if(!iso)return 'No due date';const [y,m,d]=iso.split('-');return `${new Date(`${y}-${m}-${d}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`};
const dateTime=iso=>new Date(iso).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const colors={critical:'critical',high:'high',medium:'medium',low:'low'};
const statusColors={backlog:'neutral',progress:'blue',review:'purple',done:'green'};
const initial=()=>{try{const raw=localStorage.getItem(STORAGE_KEY);if(raw){const parsed=parseBackup(raw);return parsed}}catch(e){console.warn('Workspace could not load:',e)}return demoData()};
let state=initial();
let activeView='overview';
let editingId=null;
let activeSearch='';
let activePriority='all';
let activeStatus='all';
let toastTimer;
let cloud=null;
let authUser=null;
let currentWorkspace=null;
let knownWorkspaces=[];
let cloudBusy=false;
let refreshBusy=false;
let accountReady=false;
let sessionQueue=Promise.resolve();
function enqueueSession(session){sessionQueue=sessionQueue.catch(console.error).then(()=>applySession(session));return sessionQueue;}

const isCloudMode=()=>Boolean(cloud && authUser && currentWorkspace);
function renderCloudUI(){
  const configured=cloudConfigured();
  $('#cloud-indicator').textContent=isCloudMode()?'Cloud sync active':authUser?'Select a workspace':configured?'Guest demo · Cloud available':'Local demo · Cloud not configured';
  $('#top-cloud-label').textContent=isCloudMode()?'Team cloud workspace':'Guest demo';
  $('#cloud-storage-label').textContent=isCloudMode()?'Shared cloud workspace':'Local-first workspace';
  $('#cloud-storage-info').textContent=isCloudMode()?'Synced across signed-in devices':'Saved in this browser';
  $('#workspace-name').textContent=isCloudMode()?currentWorkspace.name:'Studio Workspace';
  $('#workspace-note').textContent=isCloudMode()?'Online team project':'Personal project board';
  $('#account-button').textContent=authUser?`☁ ${authUser.user_metadata?.user_name||'Account'}`:'☁ Cloud / Login';
  $('#cloud-warning').hidden=!isCloudMode();
  $('#account-loggedout').hidden=Boolean(authUser);
  $('#account-loggedin').hidden=!authUser;
  $('#cloud-unavailable').hidden=configured;
  $('#github-login').disabled=!configured;
  if(authUser){
    $('#signedin-as').textContent=authUser.email||authUser.user_metadata?.user_name||'Signed in';
    const selection=$('#workspace-picker');
    selection.replaceChildren(...knownWorkspaces.map(w=>{const option=document.createElement('option');option.value=w.id;option.textContent=w.name;option.selected=w.id===currentWorkspace?.id;return option;}));
    $('#invite-code').textContent=currentWorkspace?.invite_code||'Create a workspace first';
    $('#invite-copy').disabled=!currentWorkspace;
  }
}
async function loadWorkspaceList(preferred){
  knownWorkspaces=await cloud.workspaces();
  if(!knownWorkspaces.length){
    const id=await cloud.createWorkspace('My workspace');
    knownWorkspaces=await cloud.workspaces();
    preferred=id;
  }
  const selected=knownWorkspaces.find(w=>w.id===preferred) || knownWorkspaces[0];
  await selectWorkspace(selected?.id);
}
async function selectWorkspace(id){
  currentWorkspace=knownWorkspaces.find(w=>w.id===id)||null;
  if(!currentWorkspace){state={tasks:[],activity:[]};render();renderCloudUI();return;}
  localStorage.setItem(`issueflow.workspaceFor.${authUser.id}`,currentWorkspace.id);
  await syncCloud();renderCloudUI();
}
async function syncCloud(silent=false){
  if(!isCloudMode()||refreshBusy)return;
  if($('#issue-dialog').open || cloudBusy)return;
  refreshBusy=true;
  try{state=await cloud.load(currentWorkspace.id);render();if(!silent)notify('Workspace synchronized');}
  catch(err){if(!silent)notify(`Sync failed: ${err.message}`,true);console.error(err)}
  finally{refreshBusy=false;}
}
async function applySession(session){
  const user=session?.user||null;
  if(user?.id===authUser?.id && accountReady)return;
  accountReady=false;
  authUser=user;
  if(!authUser){currentWorkspace=null;knownWorkspaces=[];state=initial();render();renderCloudUI();accountReady=true;return;}
  try{
    const previous=localStorage.getItem(`issueflow.workspaceFor.${authUser.id}`);
    await loadWorkspaceList(previous);
    notify('Signed in · Workspace ready');
  }catch(err){console.error(err);notify(`Cloud setup error: ${err.message}`,true)}
  finally{accountReady=true;renderCloudUI();}
}
async function initializeCloud(){
  renderCloudUI();
  if(!cloudConfigured())return;
  try{
    cloud=await CloudStore.connect();
    cloud.client.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>enqueueSession(session),0)});
    await enqueueSession(await cloud.session());
  }catch(err){console.error(err);cloud=null;notify(`Cloud unavailable: ${err.message}`,true);renderCloudUI();}
}
async function cloudOperation(operation){
  if(cloudBusy)return;
  cloudBusy=true;
  $('#save-issue').disabled=true;
  try{await operation();state=await cloud.load(currentWorkspace.id);render();return true;}
  catch(err){notify(`Cloud error: ${err.message}`,true);return false;}
  finally{cloudBusy=false;$('#save-issue').disabled=false;}
}


function persist(){if(isCloudMode())return true;try{localStorage.setItem(STORAGE_KEY,JSON.stringify({schemaVersion:1,tasks:state.tasks,activity:state.activity.slice(0,100)}));return true}catch(e){notify('Storage unavailable. Export a backup to keep your changes.',true);console.error(e);return false}}
function record(message){state.activity.unshift({message,date:new Date().toISOString()});state.activity=state.activity.slice(0,100)}
function notify(message,error=false){const el=$('#toast');el.textContent=message;el.classList.toggle('error',error);el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.hidden=true},4200)}
function badge(priority){return `<span class="priority-pill ${colors[priority]}"><span class="pill-dot"></span>${escapeHTML(priority)}</span>`}
function statusBadge(status){return `<span class="status-pill ${statusColors[status]}"><span class="pill-dot"></span>${escapeHTML(STATUS_LABELS[status])}</span>`}
function initials(name){const parts=name.trim().split(/\s+/).filter(Boolean);return (parts.length?parts.slice(0,2).map(p=>p[0]).join(''):'?').toUpperCase()}
function person(name){return name?`<span class="person"><span class="person-avatar">${escapeHTML(initials(name))}</span>${escapeHTML(name)}</span>`:'<span class="muted">Unassigned</span>'}
function taskTags(tags){return tags.slice(0,2).map(t=>`<span class="tag">${escapeHTML(t)}</span>`).join('')}
function filtered(status='all'){return filterTasks(state.tasks,{query:activeSearch,priority:activePriority,status})}
function setView(view){if(!['overview','board','issues','activity'].includes(view))return;activeView=view;$$('.view').forEach(el=>el.classList.toggle('active-view',el.id===`${view}-view`));$$('.nav-item[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===view));const info={overview:['Overview','Project overview','A clear view of the work that matters most.'],board:['Kanban board','Engineering board','Keep work moving with an actionable, drag-and-drop workflow.'],issues:['All issues','Issue explorer','Search, prioritize and manage every issue in one place.'],activity:['Activity log','Workspace activity','Review recent actions in your current workspace.']};$('#breadcrumb-view').textContent=info[view][0];$('#page-title').innerHTML=escapeHTML(info[view][1])+'<span class="title-dot">.</span>';$('#page-subtitle').textContent=info[view][2];closeSidebar();render()}
function render(){renderOverview();renderBoard();renderIssues();renderActivity()}
function renderOverview(){const m=metrics(state.tasks);$('#stat-total').textContent=m.total;$('#stat-progress').textContent=m.statuses.progress;$('#stat-done').textContent=m.statuses.done;$('#stat-overdue').textContent=m.overdue;$('#completion-value').textContent=`${m.completion}%`;$('#completion-bar').style.width=`${m.completion}%`;
  $('#status-distribution').innerHTML=STATUSES.map(s=>`<div class="status-item"><span><i class="status-swatch ${statusColors[s]}"></i>${STATUS_LABELS[s]}</span><strong>${m.statuses[s]}</strong></div>`).join('');const max=Math.max(1,...Object.values(m.priorities));$('#priority-breakdown').innerHTML=PRIORITIES.map(p=>`<div class="priority-row"><div class="priority-title">${badge(p)}<strong>${m.priorities[p]}</strong></div><div class="priority-rail"><div class="priority-rail-fill ${p}" style="width:${m.priorities[p]/max*100}%"></div></div></div>`).join('');$('#recent-table').innerHTML=renderTable(sortUpdated(state.tasks).slice(0,6),true)}
function renderTable(tasks,isRecent=false){if(!tasks.length)return `<div class="empty-state"><div class="empty-icon">◇</div><h3>Nothing here yet</h3><p>Create an issue or adjust your filters to see results.</p><button class="secondary-button empty-create">Create issue</button></div>`;return `<div class="table-scroll"><table class="issues-table"><thead><tr><th>ISSUE</th><th>STATUS</th><th>PRIORITY</th><th>ASSIGNEE</th><th>${isRecent?'UPDATED':'DUE DATE'}</th></tr></thead><tbody>${tasks.map(t=>`<tr class="issue-row" data-id="${escapeHTML(t.id)}" tabindex="0" aria-label="Open ${escapeHTML(t.title)}"><td><span class="issue-key">${escapeHTML(t.id)}</span><span class="issue-title">${escapeHTML(t.title)}</span></td><td>${statusBadge(t.status)}</td><td>${badge(t.priority)}</td><td>${person(t.assignee)}</td><td><span class="${isOverdue(t)?'due-overdue':'muted'}">${isRecent?escapeHTML(dateTime(t.updatedAt)):escapeHTML(dateShort(t.due))}${!isRecent&&isOverdue(t)?' · Overdue':''}</span></td></tr>`).join('')}</tbody></table></div>`}
function renderBoard(){const items=filtered();$('#board-columns').innerHTML=STATUSES.map(status=>{const tasks=sortUpdated(items.filter(t=>t.status===status));return `<section class="board-column" data-status="${status}" aria-label="${STATUS_LABELS[status]}"><div class="column-head"><div><span class="column-dot ${statusColors[status]}"></span><h2>${STATUS_LABELS[status]}</h2><span class="column-count">${tasks.length}</span></div><button class="add-column" data-add-status="${status}" aria-label="Add issue to ${STATUS_LABELS[status]}">＋</button></div><div class="column-body">${tasks.length?tasks.map(t=>`<article class="issue-card" draggable="true" tabindex="0" role="button" data-id="${escapeHTML(t.id)}" aria-label="Edit ${escapeHTML(t.title)}"><div class="card-top"><span class="issue-key">${escapeHTML(t.id)}</span>${badge(t.priority)}</div><h3>${escapeHTML(t.title)}</h3><div class="card-tags">${taskTags(t.tags)}</div><div class="card-footer"><span class="card-due ${isOverdue(t)?'due-overdue':''}">◷ ${escapeHTML(dateShort(t.due))}</span><span class="person-avatar" title="${escapeHTML(t.assignee||'Unassigned')}">${escapeHTML(initials(t.assignee))}</span></div></article>`).join(''):'<div class="column-empty">Drop an issue here</div>'}</div></section>`}).join('')}
function renderIssues(){$('#issues-table').innerHTML=renderTable(sortUpdated(filtered(activeStatus)))}
function renderActivity(){const items=state.activity;$('#activity-list').innerHTML=items.length?items.map(a=>`<div class="activity-entry"><div class="activity-mark">↗</div><div><p>${escapeHTML(a.message)}</p><time>${escapeHTML(dateTime(a.date))}</time></div></div>`).join(''):'<div class="empty-state"><p>No activity yet.</p></div>'}
function openEditor(id=null,defaultStatus='backlog'){editingId=id;const task=id?state.tasks.find(t=>t.id===id):null;if(id&&!task)return;const form=$('#issue-form');form.reset();$('#dialog-error').hidden=true;$('#dialog-title').textContent=task?`Edit ${task.id}`:'Create issue';$('#save-issue').textContent=task?'Save changes':'Create issue';$('#delete-issue').hidden=!task;$('#issue-title').value=task?.title||'';$('#issue-description').value=task?.description||'';$('#issue-status').value=task?.status||defaultStatus;$('#issue-priority').value=task?.priority||'medium';$('#issue-assignee').value=task?.assignee||'';$('#issue-due').value=task?.due||'';$('#issue-tags').value=task?.tags.join(', ')||'';$('#issue-dialog').showModal();$('#issue-title').focus()}
function closeEditor(){$('#issue-dialog').close();editingId=null}
async function saveEditor(ev){
 ev.preventDefault();
 try{
  const raw=Object.fromEntries(new FormData($('#issue-form')));
  const old=editingId?state.tasks.find(t=>t.id===editingId):null;
  const date=new Date().toISOString();
  const issue=normalizeTask({...raw,id:old?.id||nextId(state.tasks),tags:raw.tags,createdAt:old?.createdAt||date,updatedAt:date},old?.id||nextId(state.tasks));
  if(isCloudMode()){
    const ok=await cloudOperation(()=>cloud.save(issue,old?.id,currentWorkspace.id,authUser.id));
    if(ok){closeEditor();notify(old?'Cloud issue updated':'Cloud issue created');}
  }else{
    if(old){state.tasks=state.tasks.map(t=>t.id===old.id?issue:t);record(`Updated ${issue.id}: ${issue.title}`)}
    else{state.tasks.unshift(issue);record(`Created ${issue.id}: ${issue.title}`)}
    persist();render();closeEditor();notify(old?'Issue updated':'Issue created');
  }
 }catch(err){$('#dialog-error').textContent=err.message;$('#dialog-error').hidden=false;}
}
async function deleteEditor(){
 const task=state.tasks.find(t=>t.id===editingId);if(!task)return;
 if(!confirm(`Permanently delete ${task.id}: ${task.title}?`))return;
 if(isCloudMode()){
   const ok=await cloudOperation(()=>cloud.remove(task,currentWorkspace.id,authUser.id));
   if(ok){closeEditor();notify('Cloud issue deleted');}
 }else{state.tasks=state.tasks.filter(t=>t.id!==task.id);record(`Deleted ${task.id}: ${task.title}`);persist();render();closeEditor();notify('Issue deleted');}
}
async function moveIssue(id,status){
 if(!STATUSES.includes(status))return;
 const task=state.tasks.find(t=>t.id===id);if(!task||task.status===status)return;
 if(isCloudMode()){
   const ok=await cloudOperation(()=>cloud.move(task,status,currentWorkspace.id,authUser.id));
   if(ok)notify(`${id} moved to ${STATUS_LABELS[status]} · Synced`);
 }else{
   const from=task.status;task.status=status;task.updatedAt=new Date().toISOString();
   record(`Moved ${id} from ${STATUS_LABELS[from]} to ${STATUS_LABELS[status]}`);
   persist();render();notify(`${id} moved to ${STATUS_LABELS[status]}`);
 }
}
function downloadFile(filename,text,type){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500)}
function exportBackup(){downloadFile('issueflow-backup.json',JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),tasks:state.tasks,activity:state.activity},null,2),'application/json');notify('JSON backup downloaded')}
async function importBackup(ev){const file=ev.target.files?.[0];ev.target.value='';if(!file)return;try{if(isCloudMode())throw Error('Backups can only be imported in guest demo mode. Sign out to import locally.');if(file.size>2_000_000)throw Error('Backup file is too large');const parsed=parseBackup(await file.text());if(!confirm(`Replace this workspace with ${parsed.tasks.length} issue(s) from the backup? This overwrites local data.`))return;state=parsed;persist();render();notify('Backup imported successfully')}catch(err){notify(err.message||'Backup import failed',true)}}
function closeSidebar(){$('#sidebar').classList.remove('sidebar-open');$('#sidebar-overlay').hidden=true}
function bind(){
 $('#account-button').addEventListener('click',()=>{renderCloudUI();$('#account-dialog').showModal()});
 $('#account-close').addEventListener('click',()=>$('#account-dialog').close());
 $('#github-login').addEventListener('click',async()=>{
   try{if(!cloud)cloud=await CloudStore.connect();await cloud.loginGitHub();}
   catch(err){notify(`GitHub sign-in failed: ${err.message}`,true);}
 });
 $('#account-signout').addEventListener('click',async()=>{
   try{await cloud.signOut();await applySession(null);$('#account-dialog').close();notify('Signed out · Demo workspace loaded');}
   catch(err){notify(err.message,true)}
 });
 $('#workspace-picker').addEventListener('change',async e=>{
   try{await selectWorkspace(e.target.value);notify('Workspace changed');}
   catch(err){notify(err.message,true)}
 });
 $('#workspace-create').addEventListener('click',async()=>{
   const name=$('#workspace-new-name').value.trim();
   if(name.length<2){notify('Enter a workspace name of at least 2 characters',true);return;}
   try{const id=await cloud.createWorkspace(name);$('#workspace-new-name').value='';knownWorkspaces=await cloud.workspaces();await selectWorkspace(id);notify('Workspace created');}
   catch(err){notify(err.message,true)}
 });
 $('#workspace-join').addEventListener('click',async()=>{
   const code=$('#workspace-join-code').value.trim();
   if(!code){notify('Enter a workspace invite code',true);return;}
   try{const id=await cloud.joinWorkspace(code);$('#workspace-join-code').value='';knownWorkspaces=await cloud.workspaces();await selectWorkspace(id);notify('Joined shared workspace');}
   catch(err){notify(err.message,true)}
 });
 $('#invite-copy').addEventListener('click',async()=>{
   if(!currentWorkspace)return;
   try{await navigator.clipboard.writeText(currentWorkspace.invite_code);notify('Invite code copied. Share it privately.');}
   catch{notify('Copy the invite code shown above',true)}
 });
 $('#sync-now').addEventListener('click',async()=>{await syncCloud();});
 $('#install-app').addEventListener('click',async()=>{
   if(window.issueflowInstallPrompt){
     window.issueflowInstallPrompt.prompt();
     await window.issueflowInstallPrompt.userChoice;
     window.issueflowInstallPrompt=null;
   }else{notify('Use your browser menu → Install app / Add to Home Screen.');}
 });
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();window.issueflowInstallPrompt=event;$('#install-app').hidden=false;});
 if('serviceWorker' in navigator && window.isSecureContext){
   window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(console.warn));
 }
 setInterval(()=>{if(isCloudMode() && document.visibilityState==='visible')syncCloud(true);},12000);

 $$('.nav-item[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
 $('#new-issue').addEventListener('click',()=>openEditor());$('#view-all-issues').addEventListener('click',()=>setView('issues'));
 $('#issue-form').addEventListener('submit',saveEditor);$('#delete-issue').addEventListener('click',deleteEditor);$('#close-dialog').addEventListener('click',closeEditor);$('#cancel-dialog').addEventListener('click',closeEditor);
 $('#issue-dialog').addEventListener('click',e=>{if(e.target===$('#issue-dialog'))closeEditor()});
 $('#open-help').addEventListener('click',()=>$('#help-dialog').showModal());$('#close-help').addEventListener('click',()=>$('#help-dialog').close());$('#help-done').addEventListener('click',()=>$('#help-dialog').close());
 $('#export-json').addEventListener('click',exportBackup);$('#import-json').addEventListener('click',()=>$('#backup-file').click());$('#backup-file').addEventListener('change',importBackup);$('#export-csv').addEventListener('click',()=>{downloadFile('issueflow-issues.csv',toCSV(state.tasks),'text/csv;charset=utf-8');notify('CSV downloaded')});
 $$('.issue-search').forEach(el=>el.addEventListener('input',e=>{activeSearch=e.target.value;$$('.issue-search').forEach(other=>{if(other!==e.target)other.value=activeSearch});renderBoard();renderIssues()}));
 $$('.priority-filter').forEach(el=>el.addEventListener('change',e=>{activePriority=e.target.value;$$('.priority-filter').forEach(other=>other.value=activePriority);renderBoard();renderIssues()}));
 $('#status-filter').addEventListener('change',e=>{activeStatus=e.target.value;renderIssues()});
 $('#reset-board-filters').addEventListener('click',()=>{activeSearch='';activePriority='all';$$('.issue-search').forEach(el=>el.value='');$$('.priority-filter').forEach(el=>el.value='all');renderBoard();renderIssues()});
 ['#recent-table','#issues-table','#board-columns'].forEach(sel=>$(sel).addEventListener('click',e=>{const add=e.target.closest('[data-add-status]');if(add){openEditor(null,add.dataset.addStatus);return}if(e.target.closest('.empty-create')){openEditor();return}const task=e.target.closest('[data-id]');if(task)openEditor(task.dataset.id)}));
 ['#recent-table','#issues-table','#board-columns'].forEach(sel=>$(sel).addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-id]')){e.preventDefault();openEditor(e.target.dataset.id)}}));
 $('#board-columns').addEventListener('dragstart',e=>{const card=e.target.closest('.issue-card');if(card){e.dataTransfer.setData('text/plain',card.dataset.id);e.dataTransfer.effectAllowed='move'}});
 $('#board-columns').addEventListener('dragover',e=>{const col=e.target.closest('.board-column');if(col){e.preventDefault();e.dataTransfer.dropEffect='move';col.classList.add('drag-over')}});
 $('#board-columns').addEventListener('dragleave',e=>{const col=e.target.closest('.board-column');if(col&&!col.contains(e.relatedTarget))col.classList.remove('drag-over')});
 $('#board-columns').addEventListener('drop',e=>{const col=e.target.closest('.board-column');$$('.board-column').forEach(c=>c.classList.remove('drag-over'));if(col){e.preventDefault();moveIssue(e.dataTransfer.getData('text/plain'),col.dataset.status)}});
 document.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='n'&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)&&!$('#issue-dialog').open&&!$('#help-dialog').open){e.preventDefault();openEditor()}});
 $('#mobile-menu').addEventListener('click',()=>{$('#sidebar').classList.toggle('sidebar-open');$('#sidebar-overlay').hidden=!$('#sidebar').classList.contains('sidebar-open')});$('#sidebar-overlay').addEventListener('click',closeSidebar);
 $('#theme-toggle').addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=next;try{localStorage.setItem(THEME_KEY,next)}catch{}});
}
try{const theme=localStorage.getItem(THEME_KEY);if(theme==='light')document.documentElement.dataset.theme='light'}catch{}
persist();bind();setView('overview');initializeCloud();
