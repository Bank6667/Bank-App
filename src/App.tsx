import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Activity, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Bell, Check,
  ChevronDown, CircleHelp, LayoutDashboard, LogOut, Menu, MessageCircle,
  Plus, RefreshCw, Send, Settings, ShieldCheck, Users, Wallet, X
} from 'lucide-react';
import { isSupabaseConfigured, supabase, simulatorAction } from './lib/supabase';


type Profile = { id: string; role: 'admin' | 'customer'; display_name: string; email: string | null; demo_pin_set_at?: string | null; welcome_seen_at?: string | null };
type Account = { id: string; user_id: string; display_account_name: string; bank_display_name: string; currency_code: string; simulated_balance: number; account_suffix: string };
type Tx = { id: string; description: string; amount: number; direction: 'in'|'out'; status: string; occurred_at: string };
type Notice = { id: string; title: string; body: string; read_at: string | null; created_at: string };
type Conversation = { id: string; customer_id: string; status: string; last_message_at: string; customer?: Profile };
type Message = { id: string; sender_id: string; body: string; created_at: string };
const money = (amount: number, currency = 'NGN') => new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount || 0));
const dateText = (value: string) => new Date(value).toLocaleString();

export default function App() {
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [booting, setBooting] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');
  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [notifications, setNotifications] = useState<Notice[]>([]);
  const [customers, setCustomers] = useState<(Profile & { account?: Account })[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [brandName, setBrandName] = useState('Northstar Financial');
  const [welcomeNotice, setWelcomeNotice] = useState({ title: 'Welcome', message: 'This is a fictional finance simulator. No real money is held, sent, or received.' });
  const [transferNotice, setTransferNotice] = useState({ title: 'Simulated transfer', message: 'This is a simulation only. No real payment will be sent or received.' });
  const [transferEnabled, setTransferEnabled] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [newCustomer, setNewCustomer] = useState({ display_name: '', email: '' });
  const [createdCredentials, setCreatedCredentials] = useState<{email:string;password:string}|null>(null);
  const [adjust, setAdjust] = useState({ customer_id: '', amount: '', direction: 'in', description: 'Admin balance adjustment' });
  const [transfer, setTransfer] = useState({ amount: '', description: '', pin: '' });
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [chatText, setChatText] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const entryRole = window.location.pathname.startsWith('/admin') ? 'admin' : window.location.pathname.startsWith('/user') ? 'customer' : null;

  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 3500); };
  const loadSettings = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from('app_settings').select('key,value');
    for (const item of data || []) {
      if (item.key === 'brand_config') setBrandName(item.value?.name || 'Northstar Financial');
      if (item.key === 'welcome_notice') setWelcomeNotice(item.value || welcomeNotice);
      if (item.key === 'transfer_notice') setTransferNotice(item.value || transferNotice);
      if (item.key === 'transfer_config') setTransferEnabled(item.value?.enabled !== false);
    }
  }, []);
  const loadCustomerData = useCallback(async (userId: string) => {
    if (!supabase) return;
    const [a, t, n] = await Promise.all([
      supabase.from('demo_accounts').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('demo_transactions').select('*').order('occurred_at', { ascending: false }).limit(30),
      supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(30),
    ]);
    if (a.error) throw a.error; if (t.error) throw t.error; if (n.error) throw n.error;
    setAccount(a.data); setTransactions(t.data || []); setNotifications(n.data || []);
    const { data: ownConversations, error: conversationError } = await supabase.from('support_conversations').select('*').eq('customer_id', userId).order('last_message_at', { ascending: false });
    if (conversationError) throw conversationError;
    setConversations((ownConversations || []) as Conversation[]);
  }, []);
  const loadAdminData = useCallback(async () => {
    if (!supabase) return;
    const [p, a, c] = await Promise.all([
      supabase.from('profiles').select('id,role,display_name,email,demo_pin_set_at,welcome_seen_at').eq('role','customer').order('created_at',{ascending:false}),
      supabase.from('demo_accounts').select('*'),
      supabase.from('support_conversations').select('*').order('last_message_at',{ascending:false}),
    ]);
    if (p.error) throw p.error; if (a.error) throw a.error; if (c.error) throw c.error;
    const accounts = a.data || [];
    setCustomers((p.data || []).map((person:any) => ({ ...person, account: accounts.find((x:any) => x.user_id === person.id) })));
    const convos = c.data || [];
    const ids = [...new Set(convos.map((x:any) => x.customer_id))];
    const names = ids.length ? await supabase.from('profiles').select('id,display_name,email,role').in('id', ids) : { data: [] as any[] };
    setConversations(convos.map((x:any) => ({ ...x, customer: (names.data || []).find((n:any) => n.id === x.customer_id) })));
  }, []);
  const loadMessages = useCallback(async (conversationId: string) => {
    if (!supabase || !conversationId) return;
    const { data, error: e } = await supabase.from('support_messages').select('*').eq('conversation_id', conversationId).order('created_at');
    if (e) throw e; setMessages(data || []);
  }, []);
  const refresh = useCallback(async (current: Profile) => {
    await loadSettings();
    if (current.role === 'admin') await loadAdminData(); else await loadCustomerData(current.id);
  }, [loadSettings, loadAdminData, loadCustomerData]);

  useEffect(() => {
    if (!supabase) { setBooting(false); return; }
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      const user = data.session?.user;
      setSessionUser(user || null);
      if (user) {
        const { data: p, error: e } = await supabase!.from('profiles').select('*').eq('id', user.id).maybeSingle();
        if (e) setError(e.message);
        else if (p && entryRole && p.role !== entryRole) { await supabase!.auth.signOut(); setSessionUser(null); setError(`This link is for ${entryRole === 'admin' ? 'administrators' : 'customers'} only. Sign in with the correct account.`); }
        else if (p) { setProfile(p as Profile); await refresh(p as Profile); if (!p.welcome_seen_at && p.role === 'customer') setShowWelcome(true); }
      }
      setBooting(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUser(session?.user || null);
      if (!session) { setProfile(null); setAccount(null); setTransactions([]); setNotifications([]); }
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, [refresh]);
  useEffect(() => {
    if (!profile || !supabase) return;
    const channel = supabase.channel('simulator-live-'+profile.id)
      .on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:'user_id=eq.'+profile.id},()=>loadCustomerData(profile.id))
      .on('postgres_changes',{event:'*',schema:'public',table:'demo_transactions'},()=>profile.role==='customer' ? loadCustomerData(profile.id) : loadAdminData())
      .on('postgres_changes',{event:'*',schema:'public',table:'support_messages'},()=>activeConversation && loadMessages(activeConversation))
      .subscribe();
    return () => { supabase!.removeChannel(channel); };
  }, [profile, activeConversation, loadCustomerData, loadAdminData, loadMessages]);

  const login = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setLoginBusy(true);
    try {
      if (!supabase) throw new Error('Supabase is not configured yet.');
      const { data, error: e2 } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (e2) throw e2;
      const { data: p, error: pErr } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
      if (pErr) throw pErr;
      if (entryRole && p.role !== entryRole) { await supabase.auth.signOut(); throw new Error(`This link is for ${entryRole === 'admin' ? 'administrators' : 'customers'} only. Sign in with the correct account.`); }
      setProfile(p as Profile); await refresh(p as Profile); setTab('overview');
      if (!p.welcome_seen_at && p.role === 'customer') setShowWelcome(true);
    } catch (err:any) { setError(err.message || 'Unable to sign in'); }
    finally { setLoginBusy(false); }
  };
  const logout = async () => { await supabase?.auth.signOut(); setSessionUser(null); setProfile(null); setTab('overview'); };
  const act = async (body: Record<string, unknown>) => { setBusy(true); try { const result:any = await simulatorAction(body); return result; } finally { setBusy(false); } };
  const createCustomer = async (e: FormEvent) => {
    e.preventDefault(); setError('');
    try {
      if (!supabase) return;
      setBusy(true);
      // Refresh the administrator JWT immediately before the privileged Edge Function call.
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshed.session) {
        throw new Error('Your administrator session has expired. Sign out and sign in again, then retry.');
      }
      const { data, error: invokeError } = await supabase.functions.invoke('create-customer', {
        body: newCustomer,
        headers: { Authorization: `Bearer ${refreshed.session.access_token}` },
      });
      if (invokeError) {
        let detail = invokeError.message || 'Customer creation failed.';
        const context = (invokeError as any).context;
        if (context && typeof context.json === 'function') {
          try {
            const payload = await context.json();
            if (payload?.error) detail = payload.error;
          } catch { /* retain the SDK error message */ }
        }
        throw new Error(detail);
      }
      if (data?.error) throw new Error(data.error);
      setCreatedCredentials({ email: data.customer.email, password: data.temporary_password });
      setNewCustomer({ display_name: '', email: '' }); await loadAdminData(); flash('Customer account created. Save the temporary password now.');
    } catch (err:any) { setError(err.message); }
    finally { setBusy(false); }
  };
  const adjustBalance = async (e: FormEvent) => {
    e.preventDefault(); setError('');
    try {
      await act({ action:'admin_adjust_balance', customer_id:adjust.customer_id, amount:Number(adjust.amount), direction:adjust.direction, description:adjust.description });
      setAdjust({ ...adjust, amount:'' }); await loadAdminData(); flash('Simulated balance updated.');
    } catch (err:any) { setError(err.message); }
  };
  const changePassword = async (e: FormEvent) => {
    e.preventDefault(); setError('');
    if (newPassword.length < 10) { setError('Use at least 10 characters for your password.'); return; }
    if (newPassword !== confirmPassword) { setError('The password entries do not match.'); return; }
    try { const { error: updateError } = await supabase!.auth.updateUser({ password: newPassword }); if (updateError) throw updateError; setNewPassword(''); setConfirmPassword(''); flash('Password updated.'); }
    catch (err:any) { setError(err.message); }
  };
  const setDemoPin = async (e: FormEvent) => {
    e.preventDefault(); setError('');
    if (pin !== pinConfirm) { setError('The PIN entries do not match.'); return; }
    try { await act({ action:'set_pin', pin }); setPin(''); setPinConfirm(''); if (profile) { const {data}=await supabase!.from('profiles').select('*').eq('id',profile.id).single(); if(data)setProfile(data as Profile); } flash('Simulator PIN saved.'); }
    catch(err:any){setError(err.message);}
  };
  const makeTransfer = async (e: FormEvent) => {
    e.preventDefault(); setError('');
    try {
      await act({ action:'simulate_transfer', amount:Number(transfer.amount), description:transfer.description, pin:transfer.pin });
      setTransfer({amount:'',description:'',pin:''}); if(profile) await loadCustomerData(profile.id); flash('The simulated transfer was recorded. No real payment was sent.');
    } catch(err:any){setError(err.message);}
  };
    const startChat = async () => {
    if (!supabase || !profile) return;

    try {
      let existing: Conversation | undefined = conversations.find(
        c =>
          c.customer_id === profile.id &&
          ['open', 'pending'].includes(c.status)
      );

      if (!existing) {
        const { data, error: e } = await supabase
          .from('support_conversations')
          .insert({
            customer_id: profile.id,
            status: 'open'
          })
          .select()
          .single();

        if (e) throw e;
        existing = data as Conversation;
      }

      if (!existing) {
        throw new Error('Unable to open support conversation.');
      }

      setActiveConversation(existing.id);
      await loadMessages(existing.id);
      setTab('support');
    } catch (err: any) {
      setError(err.message);
    }
  };
  const sendMessage = async (e:FormEvent) => {
    e.preventDefault(); if(!supabase || !profile || !activeConversation || !chatText.trim())return;
    try {
      const convo = conversations.find(c=>c.id===activeConversation);
      const customerId = profile.role==='customer' ? profile.id : convo?.customer_id;
      if(!customerId) throw new Error('Choose a support conversation first.');
      const {error:e2}=await supabase.from('support_messages').insert({conversation_id:activeConversation,customer_id:customerId,sender_id:profile.id,body:chatText.trim()});
      if(e2)throw e2; setChatText(''); await loadMessages(activeConversation);
    }catch(err:any){setError(err.message);}
  };
  const saveNotice = async (key:string,value:unknown) => {
    if(!supabase)return;
    try { const {error:e}=await supabase.from('app_settings').upsert({key,value,updated_at:new Date().toISOString()},{onConflict:'key'}); if(e)throw e; flash('Settings saved.'); }
    catch(err:any){setError(err.message);}
  };
  const unread = notifications.filter(n=>!n.read_at).length;
  const nav = profile?.role==='admin'
    ? [{id:'overview',label:'Overview',icon:LayoutDashboard},{id:'customers',label:'Customers',icon:Users},{id:'balances',label:'Balance controls',icon:Wallet},{id:'support',label:'Support inbox',icon:MessageCircle},{id:'settings',label:'Settings',icon:Settings},{id:'activity',label:'Activity',icon:Activity}]
    : [{id:'overview',label:'Overview',icon:LayoutDashboard},{id:'transfer',label:'Transfer simulator',icon:ArrowLeftRight},{id:'transactions',label:'Transactions',icon:Activity},{id:'notifications',label:'Notifications',icon:Bell},{id:'support',label:'Customer care',icon:MessageCircle},{id:'security',label:'Security',icon:ShieldCheck}];
  const selectedCustomer = customers.find(c=>c.id===adjust.customer_id);
  const totalSimulated = useMemo(()=>customers.reduce((sum,c)=>sum+Number(c.account?.simulated_balance||0),0),[customers]);

  if (booting) return <div className="center-screen"><div className="spinner"/><p>Loading secure simulator…</p></div>;
  if (!isSupabaseConfigured) return <div className="center-screen"><div className="login-card"><Brand name={brandName}/><h1>Connection setup needed</h1><p>The application files are ready, but the Supabase connection details must be present as Vercel environment variables.</p><p className="muted">Required: <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>. Use the existing project URL and public publishable/anon key only. Never use a service-role key in this browser app.</p><SimulatorDisclosure/></div></div>;
  if (!sessionUser || !profile) return <div className="auth-page"><div className="auth-art"><div className="auth-art-inner"><Brand name={brandName}/><h1>Clarity for every step.</h1><p>A private, fictional finance experience for learning and demonstration.</p><div className="art-card"><div className="art-card-top"><span>SIMULATED BALANCE</span><Wallet size={20}/></div><strong>₦ 2,450,000.00</strong><div className="art-card-bottom">•••• &nbsp; •••• &nbsp; •••• &nbsp; 2048</div></div></div></div><div className="auth-main"><form className="login-card" onSubmit={login}><div className="eyebrow">WELCOME BACK</div><h2>Sign in to continue</h2><p className="muted">Use the login details provided by your administrator.</p>{error&&<div className="alert error">{error}</div>}<label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="username"/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" required autoComplete="current-password"/></label><button className="primary full" disabled={loginBusy}>{loginBusy?'Signing in…':'Sign in'} <ChevronDown size={17}/></button><p className="login-help"><ShieldCheck size={15}/> Customer accounts are created by the administrator.</p><SimulatorDisclosure/></form></div></div>;

  return <div className="app-shell"><aside className={`sidebar ${mobileNav?'open':''}`}><div className="side-brand"><Brand name={brandName}/><button className="icon-btn mobile-close" onClick={()=>setMobileNav(false)}><X/></button></div><div className="profile-mini"><div className="avatar">{profile.display_name?.slice(0,1).toUpperCase()||'U'}</div><div><strong>{profile.display_name}</strong><small>{profile.role==='admin'?'Administrator':'Customer account'}</small></div></div><div className="nav-label">WORKSPACE</div><nav>{nav.map(item=>{const Icon=item.icon;return <button key={item.id} className={`nav-item ${tab===item.id?'active':''}`} onClick={()=>{setTab(item.id);setMobileNav(false);setError('');}}><Icon size={18}/>{item.label}{item.id==='notifications'&&unread>0&&<span className="nav-count">{unread}</span>}</button>;})}</nav><div className="sidebar-bottom"><div className="side-disclosure"><ShieldCheck size={17}/><span>Simulator environment<br/><b>No real money movement</b></span></div><button className="nav-item" onClick={logout}><LogOut size={18}/> Sign out</button></div></aside><main className="main-area"><header className="topbar"><button className="icon-btn menu-toggle" onClick={()=>setMobileNav(true)}><Menu/></button><div><div className="breadcrumb">Workspace <span>/</span> {nav.find(n=>n.id===tab)?.label||'Overview'}</div><h1>{nav.find(n=>n.id===tab)?.label||'Overview'}</h1></div><div className="top-actions"><button className="icon-btn notification-btn" onClick={()=>setTab(profile.role==='admin'?'support':'notifications')}><Bell size={19}/>{unread>0&&<i/>}</button><div className="top-user"><div className="avatar small">{profile.display_name?.slice(0,1).toUpperCase()}</div><span>{profile.display_name}</span></div></div></header><div className="content"><div className="sim-banner"><ShieldCheck size={17}/><span><b>SIMULATOR ONLY</b> — All balances, accounts and transfers are fictional. No real money is held or moved.</span></div>{error&&<div className="alert error global-alert"><span>{error}</span><button onClick={()=>setError('')}><X size={16}/></button></div>}

  {tab==='overview'&&profile.role==='admin'&&<><div className="welcome-row"><div><div className="eyebrow">ADMINISTRATOR CONSOLE</div><h2>Good day, {profile.display_name.split(' ')[0]}</h2><p className="muted">Manage simulator customers, fictional balances and support.</p></div><button className="primary" onClick={()=>setTab('customers')}><Plus size={17}/> Add customer</button></div><div className="stats-grid"><Stat icon={Users} label="Total customers" value={String(customers.length)} hint="Admin-created accounts"/><Stat icon={Wallet} label="Simulated funds" value={money(totalSimulated)} hint="Fictional balances only"/><Stat icon={MessageCircle} label="Open conversations" value={String(conversations.filter(c=>['open','pending'].includes(c.status)).length)} hint="Customer support"/><Stat icon={Activity} label="System status" value="Active" hint="Connected to Supabase"/></div><div className="panel"><div className="panel-heading"><div><h3>Recent customers</h3><p>Latest accounts created in the simulator</p></div><button className="text-btn" onClick={()=>setTab('customers')}>View all</button></div><CustomerTable rows={customers.slice(0,5)} onSelect={id=>{setAdjust({...adjust,customer_id:id});setTab('balances');}}/></div></>}
  {tab==='overview'&&profile.role==='customer'&&<><div className="welcome-row"><div><div className="eyebrow">YOUR SIMULATOR ACCOUNT</div><h2>Hello, {profile.display_name.split(' ')[0]}</h2><p className="muted">Here is a snapshot of your fictional account.</p></div><button className="outline" onClick={()=>profile.demo_pin_set_at?setTab('transfer'):setTab('security')}><ShieldCheck size={17}/>{profile.demo_pin_set_at?'Transfer demo':'Set simulator PIN'}</button></div><div className="balance-card"><div className="balance-card-head"><div><span>AVAILABLE SIMULATED BALANCE</span><h2>{money(Number(account?.simulated_balance||0),account?.currency_code||'NGN')}</h2></div><div className="balance-icon"><Wallet/></div></div><div className="account-meta"><span>{account?.display_account_name||'Everyday account'}</span><span>•••• {account?.account_suffix||'----'}</span><span>{account?.bank_display_name||brandName}</span></div><div className="balance-watermark">SIMULATION</div></div><div className="quick-actions"><button onClick={()=>setTab('transfer')}><span><ArrowUpRight/></span><b>Transfer demo</b><small>Simulate an outgoing transfer</small></button><button onClick={()=>setTab('transactions')}><span><Activity/></span><b>Transactions</b><small>Review simulated activity</small></button><button onClick={startChat}><span><MessageCircle/></span><b>Customer care</b><small>Talk to the support team</small></button></div><div className="panel"><div className="panel-heading"><div><h3>Recent activity</h3><p>Your latest simulated transactions</p></div><button className="text-btn" onClick={()=>setTab('transactions')}>See all</button></div><TransactionTable rows={transactions.slice(0,5)} currency={account?.currency_code||'NGN'}/></div></>}

  {tab==='customers'&&profile.role==='admin'&&<><div className="section-intro"><div><h2>Customer accounts</h2><p>Create and manage access for simulator customers.</p></div></div><div className="two-col"><div className="panel"><div className="panel-heading"><div><h3>Create customer</h3><p>A temporary password is generated automatically.</p></div><Users size={20}/></div><form className="stack-form" onSubmit={createCustomer}><label>Customer full name<input value={newCustomer.display_name} onChange={e=>setNewCustomer({...newCustomer,display_name:e.target.value})} minLength={2} maxLength={80} required placeholder="Enter full name"/></label><label>Email address<input type="email" value={newCustomer.email} onChange={e=>setNewCustomer({...newCustomer,email:e.target.value})} required placeholder="customer@example.com"/></label><button className="primary" disabled={busy}><Plus size={17}/>{busy?'Creating…':'Create customer'}</button><p className="form-note">The customer receives a login email and one-time temporary password from you. No customer self-registration is enabled.</p></form></div><div className="panel pale-panel"><ShieldCheck size={25}/><h3>Account safety</h3><p>Only administrator accounts can create customers. Share temporary passwords privately and ask customers to change them after their first sign-in.</p><p>Never ask customers to provide real banking passwords, card numbers, OTPs or PINs.</p></div></div><div className="panel"><div className="panel-heading"><div><h3>All customers</h3><p>{customers.length} registered simulator customer(s)</p></div><button className="icon-btn" onClick={loadAdminData}><RefreshCw size={17}/></button></div><CustomerTable rows={customers} onSelect={id=>{setAdjust({...adjust,customer_id:id});setTab('balances');}}/></div>{createdCredentials&&<div className="modal-backdrop"><div className="modal"><button className="modal-close" onClick={()=>setCreatedCredentials(null)}><X/></button><div className="success-mark"><Check/></div><h2>Customer created</h2><p>Copy these login details now. The temporary password is shown only once.</p><div className="credential"><small>Email</small><b>{createdCredentials.email}</b></div><div className="credential"><small>Temporary password</small><b>{createdCredentials.password}</b><button className="text-btn" onClick={()=>navigator.clipboard.writeText(createdCredentials.password)}>Copy</button></div><button className="primary full" onClick={()=>{navigator.clipboard.writeText(`Email: ${createdCredentials.email}\nTemporary password: ${createdCredentials.password}`);flash('Login details copied.');}}>Copy login details</button><p className="form-note">Send these details securely to the customer. Do not post them publicly.</p></div></div>}</>}

  {tab==='balances'&&profile.role==='admin'&&<><div className="section-intro"><div><h2>Balance controls</h2><p>Add or subtract fictional funds from a customer's simulator account.</p></div></div><div className="two-col"><div className="panel"><div className="panel-heading"><div><h3>Adjust simulated balance</h3><p>Every adjustment is recorded in transaction history.</p></div><Wallet/></div><form className="stack-form" onSubmit={adjustBalance}><label>Customer<select value={adjust.customer_id} onChange={e=>setAdjust({...adjust,customer_id:e.target.value})} required><option value="">Select a customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.display_name} — {c.email}</option>)}</select></label>{selectedCustomer?.account&&<div className="selected-balance"><span>Current balance</span><b>{money(Number(selectedCustomer.account.simulated_balance),selectedCustomer.account.currency_code)}</b></div>}<label>Adjustment type<select value={adjust.direction} onChange={e=>setAdjust({...adjust,direction:e.target.value})}><option value="in">Add simulated funds</option><option value="out">Subtract simulated funds</option></select></label><label>Amount<input type="number" min="0.01" step="0.01" value={adjust.amount} onChange={e=>setAdjust({...adjust,amount:e.target.value})} required placeholder="0.00"/></label><label>Description<input value={adjust.description} onChange={e=>setAdjust({...adjust,description:e.target.value})} required maxLength={120}/></label><button className="primary" disabled={busy||!customers.length}>{busy?'Saving…':'Apply adjustment'}</button></form></div><div className="panel pale-panel"><ShieldCheck size={24}/><h3>Audit trail</h3><p>Each balance change is processed by a protected server-side function. The system checks administrator permissions before it changes a simulated balance.</p><p>These operations never connect to a payment processor or banking network.</p></div></div></>}

  {tab==='transfer'&&profile.role==='customer'&&<><div className="section-intro"><div><h2>Transfer simulator</h2><p>Practice a transfer using fictional funds. No payment will be sent.</p></div></div>{!transferEnabled?<div className="panel empty-state"><ShieldCheck/><h3>Transfers are currently paused</h3><p>Your administrator has temporarily disabled simulated transfers.</p></div>:<div className="two-col"><div className="panel"><div className="panel-heading"><div><h3>New simulated transfer</h3><p>Enter a demonstration amount and description.</p></div><ArrowLeftRight/></div><div className="selected-balance"><span>Available simulated balance</span><b>{money(Number(account?.simulated_balance||0),account?.currency_code||'NGN')}</b></div><form className="stack-form" onSubmit={makeTransfer}><label>Amount<input type="number" min="0.01" step="0.01" value={transfer.amount} onChange={e=>setTransfer({...transfer,amount:e.target.value})} required placeholder="0.00"/></label><label>Description<input value={transfer.description} onChange={e=>setTransfer({...transfer,description:e.target.value})} required maxLength={120} placeholder="What is this transfer for?"/></label><label>Simulator PIN<input inputMode="numeric" type="password" maxLength={6} value={transfer.pin} onChange={e=>setTransfer({...transfer,pin:e.target.value.replace(/\D/g,'')})} required placeholder="4–6 digit demo PIN"/></label><button className="primary" disabled={busy||!profile.demo_pin_set_at}>{busy?'Processing…':'Review simulated transfer'}</button>{!profile.demo_pin_set_at&&<p className="form-note">Set a simulator PIN in Security before making a transfer.</p>}</form></div><div className="panel pale-panel"><ShieldCheck size={24}/><h3>Before you continue</h3><p>{transferNotice.message}</p><ul><li>Only the fictional balance is affected.</li><li>A transaction record is added to your history.</li><li>Your simulator PIN is stored as a secure hash, not plain text.</li></ul></div></div>}</>}

  {tab==='transactions'&&profile.role==='customer'&&<div className="panel"><div className="panel-heading"><div><h3>Transaction history</h3><p>All entries are fictional simulator activity.</p></div><button className="icon-btn" onClick={()=>profile&&loadCustomerData(profile.id)}><RefreshCw size={17}/></button></div><TransactionTable rows={transactions} currency={account?.currency_code||'NGN'}/></div>}
  {tab==='notifications'&&profile.role==='customer'&&<div className="panel"><div className="panel-heading"><div><h3>Notifications</h3><p>Updates about your simulator account and support messages.</p></div><Bell/></div>{notifications.length===0?<Empty text="You do not have any notifications yet."/>:<div className="notification-list">{notifications.map(n=><div className={`notification-row ${n.read_at?'':'unread'}`} key={n.id}><div className="notice-dot"/><div><b>{n.title}</b><p>{n.body}</p><small>{dateText(n.created_at)}</small></div>{!n.read_at&&<button className="text-btn" onClick={async()=>{try{await act({action:'mark_notification_read',notification_id:n.id});setNotifications(old=>old.map(x=>x.id===n.id?{...x,read_at:new Date().toISOString()}:x));}catch(err:any){setError(err.message);}}}>Mark read</button>}</div>)}</div>}</div>}

  {tab==='security'&&profile.role==='customer'&&<div className="two-col"><div className="panel"><div className="panel-heading"><div><h3>{profile.demo_pin_set_at?'Update simulator PIN':'Set simulator PIN'}</h3><p>Use a 4–6 digit PIN for simulated transfers.</p></div><ShieldCheck/></div><form className="stack-form" onSubmit={setDemoPin}><label>New simulator PIN<input type="password" inputMode="numeric" maxLength={6} minLength={4} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,''))} required placeholder="4–6 digits"/></label><label>Confirm simulator PIN<input type="password" inputMode="numeric" maxLength={6} minLength={4} value={pinConfirm} onChange={e=>setPinConfirm(e.target.value.replace(/\D/g,''))} required placeholder="Enter it again"/></label><button className="primary" disabled={busy}>{busy?'Saving…':'Save simulator PIN'}</button></form><Divider/><form className="stack-form" onSubmit={changePassword}><h4>Change account password</h4><label>New password<input type="password" minLength={10} value={newPassword} onChange={e=>setNewPassword(e.target.value)} required placeholder="At least 10 characters" autoComplete="new-password"/></label><label>Confirm new password<input type="password" minLength={10} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required placeholder="Enter it again" autoComplete="new-password"/></label><button className="outline">Update password</button></form></div><div className="panel pale-panel"><ShieldCheck size={25}/><h3>Your security</h3><p>This PIN is only for the fictional simulator. It is not a bank PIN and must never match a real banking PIN.</p><p>Use a unique code and do not share it with anyone.</p></div></div>}

  {tab==='support'&&<div className="support-layout"><div className="panel support-list"><div className="panel-heading"><div><h3>{profile.role==='admin'?'Support inbox':'Your conversations'}</h3><p>{profile.role==='admin'?'Select a customer conversation':'Talk to the simulator support team'}</p></div><MessageCircle/></div>{profile.role==='customer'?<button className="primary full" onClick={startChat}><Plus size={16}/> Open customer care chat</button>:null}{(profile.role==='admin'?conversations:conversations.filter(c=>c.customer_id===profile.id)).map(c=><button key={c.id} className={`conversation-item ${activeConversation===c.id?'chosen':''}`} onClick={async()=>{setActiveConversation(c.id);await loadMessages(c.id);}}><span className="avatar">{(c.customer?.display_name||'C').slice(0,1)}</span><span><b>{profile.role==='admin'?c.customer?.display_name||'Customer':'Customer care'}</b><small>{c.status} · {dateText(c.last_message_at)}</small></span></button>)}{(profile.role==='admin'?conversations.length:conversations.filter(c=>c.customer_id===profile.id).length)===0&&<Empty text="No conversations yet."/>}</div><div className="panel chat-panel"><div className="chat-heading"><div><h3>{activeConversation?(profile.role==='admin'?conversations.find(c=>c.id===activeConversation)?.customer?.display_name:'Customer care'):'Conversation'}</h3><p>Messages are visible only to the customer and authorized administrators.</p></div><CircleHelp/></div><div className="chat-messages">{!activeConversation?<Empty text={profile.role==='admin'?'Choose a conversation to reply.':'Open a chat to contact customer care.'}/>:messages.map(m=><div key={m.id} className={`message-bubble ${m.sender_id===profile.id?'mine':''}`}><p>{m.body}</p><small>{dateText(m.created_at)}</small></div>)}</div>{activeConversation&&<form className="chat-compose" onSubmit={sendMessage}><input value={chatText} onChange={e=>setChatText(e.target.value)} placeholder="Write a message…" maxLength={4000}/><button className="primary" disabled={!chatText.trim()}><Send size={17}/></button></form>}</div></div>}

  {tab==='settings'&&profile.role==='admin'&&<><div className="section-intro"><div><h2>Simulator settings</h2><p>Control the display name and customer-facing notices.</p></div></div><div className="two-col"><div className="panel"><div className="panel-heading"><div><h3>Brand and notices</h3><p>Changes apply to the simulator interface.</p></div><Settings/></div><form className="stack-form" onSubmit={e=>{e.preventDefault();saveNotice('brand_config',{name:brandName,logo_url:null});}}><label>Simulator brand name<input value={brandName} onChange={e=>setBrandName(e.target.value)} maxLength={60}/></label><button className="outline">Save brand name</button></form><Divider/><form className="stack-form" onSubmit={e=>{e.preventDefault();saveNotice('welcome_notice',welcomeNotice);}}><h4>Welcome notice</h4><label>Title<input value={welcomeNotice.title} onChange={e=>setWelcomeNotice({...welcomeNotice,title:e.target.value})}/></label><label>Message<textarea rows={3} value={welcomeNotice.message} onChange={e=>setWelcomeNotice({...welcomeNotice,message:e.target.value})}/></label><button className="outline">Save welcome notice</button></form><Divider/><form className="stack-form" onSubmit={e=>{e.preventDefault();saveNotice('transfer_notice',transferNotice);}}><h4>Transfer notice</h4><label>Title<input value={transferNotice.title} onChange={e=>setTransferNotice({...transferNotice,title:e.target.value})}/></label><label>Message<textarea rows={3} value={transferNotice.message} onChange={e=>setTransferNotice({...transferNotice,message:e.target.value})}/></label><button className="outline">Save transfer notice</button></form></div><div className="panel"><div className="panel-heading"><div><h3>Transfer controls</h3><p>Enable or pause simulated transfers.</p></div><ArrowLeftRight/></div><div className="setting-row"><div><b>Allow simulated transfers</b><p>Customers can create fictional outgoing transfers.</p></div><button className={`toggle ${transferEnabled?'on':''}`} onClick={()=>{const next=!transferEnabled;setTransferEnabled(next);saveNotice('transfer_config',{enabled:next,require_demo_pin:true});}} aria-label="Toggle simulated transfers"><span/></button></div><div className="callout"><ShieldCheck/><p>The transfer engine uses the protected Supabase function and a simulator-only PIN check. No external payment provider is configured.</p></div></div></div></>}
  {tab==='activity'&&profile.role==='admin'&&<div className="panel"><div className="panel-heading"><div><h3>Recent activity</h3><p>Administrative actions recorded by the simulator.</p></div><Activity/></div><ActivityList/></div>}
  </div></main>{toast&&<div className="toast"><Check size={17}/>{toast}</div>}{showWelcome&&<div className="modal-backdrop"><div className="modal"><div className="success-mark"><ShieldCheck/></div><h2>{welcomeNotice.title}</h2><p>{welcomeNotice.message}</p><SimulatorDisclosure/><button className="primary full" onClick={async()=>{setShowWelcome(false);try{await act({action:'mark_welcome_seen'});if(profile){setProfile({...profile,welcome_seen_at:new Date().toISOString()});}}catch(err:any){setError(err.message);}}}>Continue</button></div></div>}</div>;
}

function Brand({name}:{name:string}){return <div className="brand"><div className="brand-mark"><span>N</span></div><div><b>{name}</b><small>FINANCIAL SIMULATOR</small></div></div>}
function SimulatorDisclosure(){return <div className="disclosure"><ShieldCheck size={15}/><span>Fictional simulator only. No real bank, real funds, or real payment processing.</span></div>}
function Stat({icon:Icon,label,value,hint}:{icon:any;label:string;value:string;hint:string}){return <div className="stat-card"><div className="stat-top"><span>{label}</span><Icon size={19}/></div><strong>{value}</strong><small>{hint}</small></div>}
function CustomerTable({rows,onSelect}:{rows:(Profile&{account?:Account})[];onSelect?:(id:string)=>void}){return rows.length===0?<Empty text="No customers have been created yet."/>:<div className="table-wrap"><table><thead><tr><th>Customer</th><th>Email</th><th>Simulated balance</th><th>PIN status</th><th></th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><div className="table-person"><span className="avatar">{r.display_name?.slice(0,1)}</span><b>{r.display_name}</b></div></td><td>{r.email||'—'}</td><td>{r.account?money(Number(r.account.simulated_balance),r.account.currency_code):'Account pending'}</td><td><span className={`status ${r.demo_pin_set_at?'good':'pending'}`}>{r.demo_pin_set_at?'PIN set':'PIN not set'}</span></td><td>{onSelect&&<button className="text-btn" onClick={()=>onSelect(r.id)}>Manage</button>}</td></tr>)}</tbody></table></div>}
function TransactionTable({rows,currency}:{rows:Tx[];currency:string}){return rows.length===0?<Empty text="No simulated transactions yet."/>:<div className="table-wrap"><table><thead><tr><th>Description</th><th>Date</th><th>Status</th><th className="right">Amount</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><div className="transaction-name"><span className={`tx-icon ${r.direction}`} >{r.direction==='in'?<ArrowDownLeft size={17}/>:<ArrowUpRight size={17}/>}</span><b>{r.description}</b></div></td><td>{dateText(r.occurred_at)}</td><td><span className="status good">{r.status||'Simulated'}</span></td><td className={`right amount ${r.direction}`}>{r.direction==='in'?'+':'−'}{money(Number(r.amount),currency)}</td></tr>)}</tbody></table></div>}
function Empty({text}:{text:string}){return <div className="empty-state"><div className="empty-icon"><Activity/></div><p>{text}</p></div>}
function Divider(){return <div className="section-divider"/>}
function ActivityList(){const [items,setItems]=useState<any[]>([]);const [loading,setLoading]=useState(true);useEffect(()=>{if(!supabase)return;supabase.from('activity_logs').select('*').order('created_at',{ascending:false}).limit(30).then(({data})=>{setItems(data||[]);setLoading(false);});},[]);if(loading)return <Empty text="Loading activity…"/>;return items.length===0?<Empty text="No administrative activity recorded yet."/>:<div className="activity-list">{items.map(x=><div key={x.id}><span className="activity-dot"/><div><b>{String(x.action).replaceAll('_',' ')}</b><p>{x.details?.display_name||x.details?.email||'Simulator management action'}</p><small>{dateText(x.created_at)}</small></div></div>)}</div>}