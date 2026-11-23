/** Pure business logic, independent of the DOM. */
export const STATUSES = ["backlog", "progress", "review", "done"];
export const STATUS_LABELS = { backlog:"Backlog", progress:"In progress", review:"In review", done:"Done" };
export const PRIORITIES = ["critical", "high", "medium", "low"];

export function safeString(v, max=250) { return typeof v === "string" ? v.slice(0,max).trim() : ""; }
export function normalizeTask(raw, fallbackId) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid issue record");
  const title=safeString(raw.title,120);
  if(!title) throw new Error("Issue title cannot be empty");
  const id=safeString(raw.id,32) || fallbackId;
  if(!/^IF-\d{1,8}$/.test(id)) throw new Error("Invalid issue identifier");
  const status=STATUSES.includes(raw.status)?raw.status:"backlog";
  const priority=PRIORITIES.includes(raw.priority)?raw.priority:"medium";
  const due=typeof raw.due==="string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.due) && !Number.isNaN(new Date(raw.due+'T12:00:00').valueOf())?raw.due:"";
  const tags=Array.isArray(raw.tags)?raw.tags:typeof raw.tags==="string"?raw.tags.split(","):[];
  return {
    id,title,description:safeString(raw.description,2000),status,priority,
    assignee:safeString(raw.assignee,60),due,
    tags:[...new Set(tags.map(t=>safeString(t,30).toLowerCase()).filter(Boolean))].slice(0,6),
    createdAt:validISO(raw.createdAt)||new Date().toISOString(),
    updatedAt:validISO(raw.updatedAt)||new Date().toISOString(),
  };
}
function validISO(v){return typeof v==='string'&&!Number.isNaN(Date.parse(v))?new Date(v).toISOString():'';}
export function nextId(tasks){let greatest=0; for(const task of tasks){const n=Number((task.id||"").split("-")[1]);if(Number.isInteger(n))greatest=Math.max(greatest,n);}return `IF-${String(greatest+1).padStart(3,"0")}`;}
export function isOverdue(task,today=new Date().toISOString().slice(0,10)){return task.status!=="done"&&Boolean(task.due)&&task.due<today;}
export function metrics(tasks,today){const statuses=Object.fromEntries(STATUSES.map(s=>[s,0]));const priorities=Object.fromEntries(PRIORITIES.map(p=>[p,0]));for(const t of tasks){statuses[t.status]=(statuses[t.status]||0)+1;priorities[t.priority]=(priorities[t.priority]||0)+1;}return {total:tasks.length,statuses,priorities,overdue:tasks.filter(t=>isOverdue(t,today)).length,completion:tasks.length?Math.round(statuses.done/tasks.length*100):0};}
export function filterTasks(tasks,{query="",priority="all",status="all"}={}){const q=query.trim().toLowerCase();return tasks.filter(t=>(priority==="all"||t.priority===priority)&&(status==="all"||t.status===status)&&(!q||[t.id,t.title,t.description,t.assignee,...t.tags].join(" ").toLowerCase().includes(q)));}
export function sortUpdated(tasks){return [...tasks].sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt)||a.id.localeCompare(b.id));}
export function csvEscape(input){let v=String(input??""); if(/^[\s]*[=+@\-\t\r]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"';}
export function toCSV(tasks){const columns=["id","title","description","status","priority","assignee","due","tags","createdAt","updatedAt"];const rows=tasks.map(t=>columns.map(c=>csvEscape(c==="tags"?t.tags.join("; "):t[c])).join(","));return [columns.join(","),...rows].join("\r\n")+"\r\n";}
export function parseBackup(text){if(text.length>2_000_000)throw new Error("Backup file is too large");let data;try{data=JSON.parse(text)}catch{throw new Error("The file is not valid JSON")};if(!data||data.schemaVersion!==1||!Array.isArray(data.tasks)||!Array.isArray(data.activity))throw new Error("Not an IssueFlow backup");if(data.tasks.length>1500||data.activity.length>3000)throw new Error("Backup has too many records");const tasks=data.tasks.map((t,i)=>normalizeTask(t,`IF-${i+1}`));if(new Set(tasks.map(t=>t.id)).size!==tasks.length)throw new Error("Duplicate issue IDs in backup");const activity=data.activity.slice(0,100).filter(a=>a&&typeof a==="object").map(a=>({message:safeString(a.message,220),date:validISO(a.date)||new Date().toISOString()}));return {tasks,activity};}
export function demoData(){const now=new Date();const day=offset=>{const d=new Date(now);d.setDate(d.getDate()+offset);return d.toISOString().slice(0,10)};const seed=[
["Define acceptance criteria for account settings","backlog","medium","Jordan Lee",7,["planning","product"]],
["Investigate slow analytics endpoint","progress","critical","Avery Chen",-2,["api","performance"]],
["Implement keyboard shortcuts","progress","high","Casey Taylor",5,["frontend","accessibility"]],
["Review accessibility of navigation","review","high","Morgan Patel",1,["ux","accessibility"]],
["Add regression tests for search","backlog","medium","Riley Kim",10,["testing"]],
["Fix task due-date timezone handling","done","high","Sam Rivera",-4,["bug","backend"]],
["Create release documentation","review","low","Jordan Lee",3,["docs","release"]],
["Optimize dashboard rendering","done","medium","Avery Chen",-7,["frontend","performance"]],
["Add new issue validation","backlog","high","Casey Taylor",-1,["validation","bug"]],
["Design mobile board layout","progress","medium","Morgan Patel",6,["mobile","ux"]],
];const tasks=seed.map((r,i)=>normalizeTask({id:`IF-${String(i+1).padStart(3,"0")}`,title:r[0],status:r[1],priority:r[2],assignee:r[3],due:day(r[4]),tags:r[5],description:"Demonstration issue for the IssueFlow engineering workflow.",createdAt:new Date(now.getTime()-(15-i)*86400000).toISOString(),updatedAt:new Date(now.getTime()-(10-i)*3600000).toISOString()},`IF-${i+1}`));return {tasks,activity:[{message:"Demo workspace initialized with sample issues",date:new Date().toISOString()}]};}
