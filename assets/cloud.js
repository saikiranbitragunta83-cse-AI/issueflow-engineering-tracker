/** Hosted collaboration adapter. No private Supabase keys belong in this repository. */
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';
import { normalizeTask } from './core.js';

export const cloudConfigured = () => /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL.trim()) && SUPABASE_PUBLISHABLE_KEY.trim().length > 20;
const throwIfError = response => { if(response.error) throw new Error(response.error.message); return response.data; };
export const publicAppURL = () => `${location.origin}${location.pathname}`;

export function fromRow(row) {
  return normalizeTask({
    id:`IF-${row.id}`, title:row.title, description:row.description || '',
    status:row.status, priority:row.priority, assignee:row.assignee || '',
    due:row.due_date || '', tags:row.tags || [], createdAt:row.created_at,
    updatedAt:row.updated_at,
  },`IF-${row.id}`);
}
export function toRow(task, workspaceId) {
  return {
    workspace_id:workspaceId, title:task.title, description:task.description,
    status:task.status, priority:task.priority, assignee:task.assignee,
    due_date:task.due || null, tags:task.tags,
  };
}
export function rowNumber(issueId) {
  if(!/^IF-\d{1,8}$/.test(issueId)) throw new Error('Invalid issue ID');
  return Number(issueId.slice(3));
}

export class CloudStore {
  static async connect(){
    if(!cloudConfigured()) throw new Error('Cloud backend has not been configured');
    // Lazy loading preserves a working, CDN-free guest demonstration.
    if(!window.supabase?.createClient){
      await new Promise((resolve,reject)=>{
        const el=document.createElement('script');
        el.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        el.async=true;
        el.onload=resolve;
        el.onerror=()=>reject(new Error('Could not load the cloud authentication library'));
        document.head.append(el);
      });
    }
    const createClient=window.supabase?.createClient;
    if(!createClient)throw new Error('Cloud library failed to initialize');
    return new CloudStore(createClient(SUPABASE_URL.trim(), SUPABASE_PUBLISHABLE_KEY.trim(), {
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    }));
  }
  constructor(client){this.client=client;}
  async session(){return throwIfError(await this.client.auth.getSession())?.session ?? null;}
  async loginGitHub(){return throwIfError(await this.client.auth.signInWithOAuth({provider:'github',options:{redirectTo:publicAppURL()}}));}
  async signOut(){throwIfError(await this.client.auth.signOut());}
  async workspaces(){return throwIfError(await this.client.from('issueflow_workspaces').select('id,name,invite_code,created_by').order('created_at',{ascending:true}));}
  async createWorkspace(name){return throwIfError(await this.client.rpc('issueflow_create_workspace',{p_name:name}));}
  async joinWorkspace(code){return throwIfError(await this.client.rpc('issueflow_join_workspace',{p_code:code}));}
  async load(workspaceId){
    const [issues,events] = await Promise.all([
      this.client.from('issueflow_issues').select('id,title,description,status,priority,assignee,due_date,tags,created_at,updated_at').eq('workspace_id',workspaceId).order('updated_at',{ascending:false}).limit(500),
      this.client.from('issueflow_events').select('message,created_at').eq('workspace_id',workspaceId).order('created_at',{ascending:false}).limit(100)
    ]);
    return {tasks:throwIfError(issues).map(fromRow),activity:throwIfError(events).map(e=>({message:e.message,date:e.created_at}))};
  }
  async log(workspaceId,message,userId){
    const result=await this.client.from('issueflow_events').insert({workspace_id:workspaceId,user_id:userId,message:message.slice(0,220)});
    if(result.error) console.warn('Issue updated; activity log could not be written:',result.error.message);
  }
  async save(task,oldId,workspaceId,userId){
    const base=toRow(task,workspaceId);
    if(oldId){
      const id=rowNumber(oldId);
      const updated=await this.client.from('issueflow_issues').update({...base,updated_at:new Date().toISOString()}).eq('id',id).eq('workspace_id',workspaceId).select('id').single();
      throwIfError(updated);
      await this.log(workspaceId,`Updated IF-${id}: ${task.title}`,userId);
    }else{
      const created=throwIfError(await this.client.from('issueflow_issues').insert({...base,created_by:userId}).select('id').single());
      await this.log(workspaceId,`Created IF-${created.id}: ${task.title}`,userId);
    }
  }
  async remove(issue,workspaceId,userId){
    const id=rowNumber(issue.id);
    throwIfError(await this.client.from('issueflow_issues').delete().eq('id',id).eq('workspace_id',workspaceId).select('id').single());
    await this.log(workspaceId,`Deleted ${issue.id}: ${issue.title}`,userId);
  }
  async move(issue,status,workspaceId,userId){
    const id=rowNumber(issue.id);
    throwIfError(await this.client.from('issueflow_issues').update({status,updated_at:new Date().toISOString()}).eq('id',id).eq('workspace_id',workspaceId).select('id').single());
    await this.log(workspaceId,`Moved ${issue.id} to ${status}`,userId);
  }
}
