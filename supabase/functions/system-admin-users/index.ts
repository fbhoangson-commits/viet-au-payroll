import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors={ 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, x-supabase-api-version','Access-Control-Allow-Methods':'POST, OPTIONS' };
const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
 if(req.method!=='POST') return reply(405,{error:'METHOD_NOT_ALLOWED'});
 try{
  const url=Deno.env.get('SUPABASE_URL')||'', anon=Deno.env.get('SUPABASE_ANON_KEY')||'', service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  if(!url||!anon||!service||!token) return reply(401,{error:'UNAUTHORIZED'});
  const caller=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await caller.auth.getUser(token);
  if(authError||!user) return reply(401,{error:'INVALID_SESSION'});
  const {data:isAdmin,error:roleError}=await caller.rpc('system_is_admin');
  if(roleError||isAdmin!==true) return reply(403,{error:'SUPER_ADMIN_REQUIRED'});
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const body=await req.json(), action=String(body.action||'list');
  if(action==='list'){
   const {data,error}=await admin.auth.admin.listUsers({page:1,perPage:1000}); if(error) throw error;
   const users=data.users||[], ids=users.map(x=>x.id);
   if(!ids.length) return reply(200,{users:[]});
   const [{data:roles,error:re},{data:profiles,error:pe}]=await Promise.all([
    admin.from('system_user_roles').select('user_id,system_roles(code,name)').in('user_id',ids),
    admin.from('system_user_profiles').select('user_id,display_name,is_active').in('user_id',ids)
   ]); if(re) throw re;if(pe) throw pe;
   return reply(200,{users:users.map(u=>({id:u.id,email:u.email,created_at:u.created_at,last_sign_in_at:u.last_sign_in_at,confirmed_at:u.email_confirmed_at,role:(roles||[]).find(r=>r.user_id===u.id)?.system_roles||null,profile:(profiles||[]).find(p=>p.user_id===u.id)||null}))});
  }
  if(action==='create_user'){
   const email=String(body.email||'').trim().toLowerCase(), display=String(body.display_name||'').trim(), password=String(body.password||'');
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!display||password.length<10) return reply(400,{error:'VALID_EMAIL_NAME_AND_PASSWORD_MIN_10_REQUIRED'});
   const {data:existing}=await admin.auth.admin.listUsers({page:1,perPage:1000});
   if((existing?.users||[]).some(x=>x.email?.toLowerCase()===email)) return reply(409,{error:'EMAIL_ALREADY_EXISTS'});
   const {data:role,error:roleErr}=await admin.from('system_roles').select('id').eq('code','PAYROLL_ACCOUNTANT').single();if(roleErr) throw roleErr;
   const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:display,display_name:display},app_metadata:{must_change_password:true}});if(error) throw error;
   try{
    const {error:assignErr}=await admin.from('system_user_roles').upsert({user_id:data.user.id,role_id:role.id,assigned_by:user.id},{onConflict:'user_id,role_id'});if(assignErr) throw assignErr;
    const {error:profileErr}=await admin.from('system_user_profiles').upsert({user_id:data.user.id,display_name:display,is_active:true},{onConflict:'user_id'});if(profileErr) throw profileErr;
    const {error:logErr}=await admin.from('system_activity_logs').insert({actor_id:user.id,actor_email:user.email,module:'user-permissions',action:'CREATE_USER',entity_type:'auth.users',entity_id:data.user.id,description:`Tạo tài khoản ${email} với vai trò Kế toán tiền lương`});if(logErr) throw logErr;
   }catch(err){await admin.auth.admin.deleteUser(data.user.id);throw err;}
   return reply(200,{user_id:data.user.id,email});
  }
  if(action==='complete_password_change'){
   const {data:current,error:currentErr}=await admin.auth.admin.getUserById(user.id);if(currentErr) throw currentErr;
   const appMeta={...(current.user.app_metadata||{}),must_change_password:false};
   const {error:updateErr}=await admin.auth.admin.updateUserById(user.id,{app_metadata:appMeta});if(updateErr) throw updateErr;
   await admin.from('system_activity_logs').insert({actor_id:user.id,actor_email:user.email,module:'user-permissions',action:'CHANGE_PASSWORD',entity_type:'auth.users',entity_id:user.id,description:'Người dùng đổi mật khẩu thành công'});
   return reply(200,{ok:true});
  }
  if(action==='deactivate'){
   const id=String(body.user_id||'');if(!id) return reply(400,{error:'USER_ID_REQUIRED'});
   const {data:target,error:targetErr}=await admin.auth.admin.getUserById(id);if(targetErr) throw targetErr;
   if(target.user.email?.toLowerCase()==='fbhoangson@gmail.com') return reply(409,{error:'CANNOT_DEACTIVATE_PRIMARY_SUPER_ADMIN'});
   const {error}=await admin.from('system_user_profiles').upsert({user_id:id,display_name:String(body.display_name||target.user.user_metadata?.display_name||target.user.email||''),is_active:false},{onConflict:'user_id'});if(error) throw error;
   const {error:banErr}=await admin.auth.admin.updateUserById(id,{ban_duration:'876000h'});if(banErr) throw banErr;
   await admin.from('system_activity_logs').insert({actor_id:user.id,actor_email:user.email,module:'user-permissions',action:'DEACTIVATE_USER',entity_type:'auth.users',entity_id:id,description:`Khóa tài khoản ${target.user.email}`});
   return reply(200,{ok:true});
  }
  return reply(400,{error:'UNKNOWN_ACTION'});
 }catch(e){console.error(e);return reply(500,{error:e instanceof Error?e.message:String(e)});}
});
