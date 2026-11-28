import { useCallback, useEffect, useMemo, useState, type FormEvent, type CSSProperties } from 'react';
import {
  Activity, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Bell, Check,
  ChevronDown, CircleHelp, LayoutDashboard, LogOut, Menu, MessageCircle,
  Paperclip, Plus, RefreshCw, Send, Settings, ShieldCheck, Trash2, Users, Wallet, X
} from 'lucide-react';
import { isSupabaseConfigured, supabase, simulatorAction } from './lib/supabase';


type Profile = { id: string; role: 'admin' | 'customer'; display_name: string; email: string | null; avatar_url?: string | null; avatar_display_url?: string | null; phone?: string | null; address?: string | null; country_name?: string | null; country_code?: string | null; demo_pin_set_at?: string | null; welcome_seen_at?: string | null };
type Account = { id: string; user_id: string; created_at?: string; display_account_name: string; bank_display_name: string; bank_logo_url?: string | null; bank_banner_url?: string | null; brand_primary_color?: string; brand_secondary_color?: string; currency_code: string; country_name?: string; country_code?: string; simulated_balance: number; account_suffix: string; account_number?: string | null; account_type?: string; account_status?: string; transfer_approved?: boolean; branch_name?: string | null; branch_address?: string | null; support_phone?: string | null; support_email?: string | null; website_url?: string | null; cardholder_name?: string | null; card_last4?: string | null; card_expiry?: string | null; card_status?: string; card_image_url?: string | null };
type Tx = { id: string; description: string; amount: number; direction: 'in'|'out'; status: string; occurred_at: string; currency_code?: string };
type Notice = { id: string; title: string; body: string; read_at: string | null; created_at: string };
type Conversation = { id: string; customer_id: string; status: string; last_message_at: string; customer?: Profile };
type Message = { id: string; sender_id: string; body: string; created_at: string; attachment_path?: string | null; attachment_mime_type?: string | null; attachment_name?: string | null; attachment_url?: string | null };
const money = (amount: number, currency = 'NGN') => {
  const code = /^[A-Z]{3}$/.test(currency) ? currency : 'NGN';
  try { return new Intl.NumberFormat('en-NG', { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(Number(amount || 0)); }
  catch { return code + ' ' + new Intl.NumberFormat('en-NG', { maximumFractionDigits: 2 }).format(Number(amount || 0)); }
};
const dateText = (value: string) => new Date(value).toLocaleString();
const isValidIban = (value: string) => {
  const iban = value.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const digits = /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
};

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
  const [brandName, setBrandName] = useState('Your Bank');
  const [brandLogoUrl, setBrandLogoUrl] = useState('');
  const [brandPrimary, setBrandPrimary] = useState('#163b55');
  const [brandSecondary, setBrandSecondary] = useState('#287078');
  const [language, setLanguage] = useState(() => localStorage.getItem('simulator-language') || 'en');
  const [newCustomerLogo, setNewCustomerLogo] = useState<File | null>(null);
  const [welcomeNotice, setWelcomeNotice] = useState({ title: 'Welcome', message: 'Welcome. Your account information and recent activity are available below.' });
  const [transferNotice, setTransferNotice] = useState({ title: 'Transfer information', message: 'Review the recipient and amount carefully before confirming.' });
  const [transferEnabled, setTransferEnabled] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [newCustomer, setNewCustomer] = useState({ display_name: '', email: '', phone: '', address: '', country_name: 'Nigeria', country_code: 'NG', currency_code: 'NGN', account_type: 'Everyday Account', bank_display_name: '', brand_primary_color: '#163b55', brand_secondary_color: '#287078', transfer_approved: false, admin_pin: '' });
  const [createdCredentials, setCreatedCredentials] = useState<{email:string;password:string}|null>(null);
  const [editingCustomerId, setEditingCustomerId] = useState('');
  const [customerForm, setCustomerForm] = useState<any>({});
  const [adjust, setAdjust] = useState({ customer_id: '', amount: '', direction: 'in', description: 'Admin balance adjustment' });
  const [transfer, setTransfer] = useState({ transfer_type: 'domestic', recipient_name: '', recipient_bank: '', recipient_account: '', recipient_country: '', recipient_currency: '', swift_bic: '', amount: '', description: '', pin: '' });
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [chatText, setChatText] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const entryRole = window.location.pathname.startsWith('/admin') ? 'admin' : window.location.pathname.startsWith('/user') ? 'customer' : null;
  const t = (label: string) => {
    const dictionaries: Record<string, Record<string,string>> = {
      fr: {'Overview':'Vue d’ensemble','Customers':'Clients','Balance controls':'Gestion des soldes','Support inbox':'Boîte de support','Settings':'Paramètres','Activity':'Activité','Transfers':'Virements','Transactions':'Transactions','Notifications':'Notifications','Customer care':'Service client','Security':'Sécurité','Sign out':'Déconnexion','Workspace':'Espace de travail','Sign in to continue':'Connectez-vous pour continuer','Use the login details provided by your administrator.':'Utilisez les identifiants fournis par votre administrateur.','Email address':'Adresse e-mail','Password':'Mot de passe','Sign in':'Se connecter','Make a transfer':'Effectuer un virement','View activity':'Voir l’activité','Transfer money':'Envoyer de l’argent','Get support':'Contacter le support','Recent transactions':'Transactions récentes','View all':'Tout voir','Account settings':'Paramètres du compte','Personal information':'Informations personnelles','Account preferences':'Préférences du compte','Security and support':'Sécurité et assistance','Domestic transfer':'Virement national','International transfer':'Virement international','Transfer passcode':'Code secret du virement','Continue':'Continuer','Cancel':'Annuler'},
      es: {'Overview':'Resumen','Customers':'Clientes','Balance controls':'Control de saldos','Support inbox':'Bandeja de soporte','Settings':'Configuración','Activity':'Actividad','Transfers':'Transferencias','Transactions':'Transacciones','Notifications':'Notificaciones','Customer care':'Atención al cliente','Security':'Seguridad','Sign out':'Cerrar sesión','Workspace':'Espacio de trabajo','Sign in to continue':'Inicia sesión para continuar','Use the login details provided by your administrator.':'Usa los datos de acceso proporcionados por tu administrador.','Email address':'Correo electrónico','Password':'Contraseña','Sign in':'Iniciar sesión','Make a transfer':'Hacer una transferencia','View activity':'Ver actividad','Transfer money':'Transferir dinero','Get support':'Obtener ayuda','Recent transactions':'Transacciones recientes','View all':'Ver todo','Account settings':'Configuración de la cuenta','Personal information':'Información personal','Account preferences':'Preferencias de cuenta','Security and support':'Seguridad y soporte','Domestic transfer':'Transferencia nacional','International transfer':'Transferencia internacional','Transfer passcode':'Código de transferencia','Continue':'Continuar','Cancel':'Cancelar'},
      pt: {'Overview':'Visão geral','Customers':'Clientes','Balance controls':'Controlo de saldos','Support inbox':'Caixa de suporte','Settings':'Definições','Activity':'Atividade','Transfers':'Transferências','Transactions':'Transações','Notifications':'Notificações','Customer care':'Apoio ao cliente','Security':'Segurança','Sign out':'Terminar sessão','Workspace':'Área de trabalho','Sign in to continue':'Inicie sessão para continuar','Use the login details provided by your administrator.':'Use os dados fornecidos pelo administrador.','Email address':'Endereço de e-mail','Password':'Palavra-passe','Sign in':'Entrar','Make a transfer':'Fazer transferência','View activity':'Ver atividade','Transfer money':'Transferir dinheiro','Get support':'Obter apoio','Recent transactions':'Transações recentes','View all':'Ver tudo','Account settings':'Definições da conta','Personal information':'Informações pessoais','Account preferences':'Preferências da conta','Security and support':'Segurança e apoio','Domestic transfer':'Transferência nacional','International transfer':'Transferência internacional','Transfer passcode':'Código de transferência','Continue':'Continuar','Cancel':'Cancelar'},
      ar: {'Overview':'نظرة عامة','Customers':'العملاء','Balance controls':'إدارة الأرصدة','Support inbox':'صندوق الدعم','Settings':'الإعدادات','Activity':'النشاط','Transfers':'التحويلات','Transactions':'المعاملات','Notifications':'الإشعارات','Customer care':'خدمة العملاء','Security':'الأمان','Sign out':'تسجيل الخروج','Workspace':'مساحة العمل','Sign in to continue':'سجّل الدخول للمتابعة','Use the login details provided by your administrator.':'استخدم بيانات الدخول التي وفرها المسؤول.','Email address':'البريد الإلكتروني','Password':'كلمة المرور','Sign in':'تسجيل الدخول','Make a transfer':'إجراء تحويل','View activity':'عرض النشاط','Transfer money':'تحويل الأموال','Get support':'الحصول على الدعم','Recent transactions':'المعاملات الأخيرة','View all':'عرض الكل','Account settings':'إعدادات الحساب','Personal information':'المعلومات الشخصية','Account preferences':'تفضيلات الحساب','Security and support':'الأمان والدعم','Domestic transfer':'تحويل محلي','International transfer':'تحويل دولي','Transfer passcode':'رمز التحويل','Continue':'متابعة','Cancel':'إلغاء'}
    };
    return dictionaries[language]?.[label] || label;
  };
  const customerBankName = profile?.role === 'customer' ? (account?.bank_display_name || 'Your Bank') : brandName;
  const customerBankLogo = profile?.role === 'customer' ? (account?.bank_logo_url || '') : brandLogoUrl;
  const activeBrandPrimary = profile?.role === 'customer' && /^#[0-9A-Fa-f]{6}$/.test(account?.brand_primary_color || '') ? account!.brand_primary_color! : brandPrimary;
  const activeBrandSecondary = profile?.role === 'customer' && /^#[0-9A-Fa-f]{6}$/.test(account?.brand_secondary_color || '') ? account!.brand_secondary_color! : brandSecondary;

  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 3500); };
  const loadSettings = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from('app_settings').select('key,value');
    for (const item of data || []) {
      if (item.key === 'brand_config') { setBrandName(item.value?.name || 'Your Bank'); setBrandLogoUrl(item.value?.logo_url || ''); setBrandPrimary(/^#[0-9A-Fa-f]{6}$/.test(item.value?.primary_color || '') ? item.value.primary_color : '#163b55'); setBrandSecondary(/^#[0-9A-Fa-f]{6}$/.test(item.value?.secondary_color || '') ? item.value.secondary_color : '#287078'); }
      if (item.key === 'welcome_notice') setWelcomeNotice(item.value || welcomeNotice);
      if (item.key === 'transfer_notice') setTransferNotice(item.value || transferNotice);
      if (item.key === 'transfer_config') setTransferEnabled(item.value?.enabled !== false);
    }
  }, []);
  const addAvatarDisplayUrl = useCallback(async (person: Profile): Promise<Profile> => {
    if (!supabase || !person.avatar_url) return { ...person, avatar_display_url: null };
    const { data } = await supabase.storage.from('customer-profile-assets').createSignedUrl(person.avatar_url, 604800);
    return { ...person, avatar_display_url: data?.signedUrl || null };
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
      supabase.from('profiles').select('id,role,display_name,email,avatar_url,phone,address,country_name,country_code,demo_pin_set_at,welcome_seen_at,created_at').eq('role','customer').order('created_at',{ascending:false}),
      supabase.from('demo_accounts').select('*'),
      supabase.from('support_conversations').select('*').order('last_message_at',{ascending:false}),
    ]);
    if (p.error) throw p.error; if (a.error) throw a.error; if (c.error) throw c.error;
    const accounts = a.data || [];
    const profilesWithAvatars = await Promise.all((p.data || []).map((person:any) => addAvatarDisplayUrl(person as Profile)));
    setCustomers(profilesWithAvatars.map((person:any) => ({ ...person, account: accounts.find((x:any) => x.user_id === person.id) })));
    const convos = c.data || [];
    const ids = [...new Set(convos.map((x:any) => x.customer_id))];
    const names = ids.length ? await supabase.from('profiles').select('id,display_name,email,role').in('id', ids) : { data: [] as any[] };
    setConversations(convos.map((x:any) => ({ ...x, customer: (names.data || []).find((n:any) => n.id === x.customer_id) })));
  }, [addAvatarDisplayUrl]);
  const loadMessages = useCallback(async (conversationId: string) => {
    if (!supabase || !conversationId) return;
    const { data, error: e } = await supabase.from('support_messages').select('*').eq('conversation_id', conversationId).order('created_at');
    if (e) throw e;
    const hydrated = await Promise.all((data || []).map(async (message:any) => {
      if (!message.attachment_path) return message;
      const { data: signed } = await supabase!.storage.from('support-attachments').createSignedUrl(message.attachment_path, 3600);
      return { ...message, attachment_url: signed?.signedUrl || null };
    }));
    setMessages(hydrated as Message[]);
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
        const { data: p, error: e } = await supabase!.from('profiles').select('id,role,display_name,email,avatar_url,phone,address,country_name,country_code,demo_pin_set_at,welcome_seen_at,created_at').eq('id', user.id).maybeSingle();
        if (e) setError(e.message);
        else if (p && entryRole && p.role !== entryRole) { await supabase!.auth.signOut(); setSessionUser(null); setError(`This link is for ${entryRole === 'admin' ? 'administrators' : 'customers'} only. Sign in with the correct account.`); }
        else if (p) { const displayProfile = await addAvatarDisplayUrl(p as Profile); setProfile(displayProfile); await refresh(p as Profile); if (!p.welcome_seen_at && p.role === 'customer') setShowWelcome(true); }
      }
      setBooting(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUser(session?.user || null);
      if (!session) { setProfile(null); setAccount(null); setTransactions([]); setNotifications([]); }
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, [refresh, addAvatarDisplayUrl]);
  useEffect(() => { document.title = profile?.role === 'customer' ? `${account?.bank_display_name || 'Account'} | Digital Banking Simulator` : 'Digital Banking Simulator'; }, [brandName, profile, account?.bank_display_name]);
  useEffect(() => { localStorage.setItem('simulator-language', language); document.documentElement.lang = language; document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'; }, [language]);
  useEffect(() => {
    if (!profile || !supabase) return;
    const channel = supabase.channel('simulator-live-'+profile.id)
      .on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:'user_id=eq.'+profile.id},()=>loadCustomerData(profile.id))
      .on('postgres_changes',{event:'*',schema:'public',table:'demo_accounts',filter:'user_id=eq.'+profile.id},()=>profile.role==='customer' && loadCustomerData(profile.id))
      .on('postgres_changes',{event:'*',schema:'public',table:'profiles',filter:'id=eq.'+profile.id},async()=>{if(profile.role==='customer'){const {data}=await supabase!.from('profiles').select('id,role,display_name,email,avatar_url,phone,address,country_name,country_code,demo_pin_set_at,welcome_seen_at,created_at').eq('id',profile.id).maybeSingle();if(data)setProfile(await addAvatarDisplayUrl(data as Profile));}})
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
      const { data: p, error: pErr } = await supabase.from('profiles').select('id,role,display_name,email,avatar_url,phone,address,country_name,country_code,demo_pin_set_at,welcome_seen_at,created_at').eq('id', data.user.id).single();
      if (pErr) throw pErr;
      if (entryRole && p.role !== entryRole) { await supabase.auth.signOut(); throw new Error(`This link is for ${entryRole === 'admin' ? 'administrators' : 'customers'} only. Sign in with the correct account.`); }
      const displayProfile = await addAvatarDisplayUrl(p as Profile); setProfile(displayProfile); await refresh(p as Profile); setTab('overview');
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
        body: { ...newCustomer, bank_display_name: newCustomer.bank_display_name.trim() || 'Your Bank' },
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
      if (newCustomerLogo && supabase) {
        try {
          const ext = newCustomerLogo.type === 'image/png' ? 'png' : newCustomerLogo.type === 'image/webp' ? 'webp' : 'jpg';
          const path = `customers/${data.customer.id}/bank-logo-${Date.now()}.${ext}`;
          const { error: uploadError } = await supabase.storage.from('brand-assets').upload(path,newCustomerLogo,{contentType:newCustomerLogo.type,upsert:false,cacheControl:'3600'});
          if (uploadError) throw uploadError;
          const { data: publicLogo } = supabase.storage.from('brand-assets').getPublicUrl(path);
          const { error: logoSaveError } = await supabase.from('demo_accounts').update({bank_logo_url:publicLogo.publicUrl}).eq('user_id',data.customer.id);
          if (logoSaveError) throw logoSaveError;
        } catch (logoError:any) { setError('Customer created successfully, but the logo could not be saved: '+logoError.message); }
      }
      setCreatedCredentials({ email: data.customer.email, password: data.temporary_password });
      setNewCustomerLogo(null);
      setNewCustomer({ display_name: '', email: '', phone: '', address: '', country_name: 'Nigeria', country_code: 'NG', currency_code: 'NGN', account_type: 'Everyday Account', bank_display_name: '', brand_primary_color: '#163b55', brand_secondary_color: '#287078', transfer_approved: false, admin_pin: '' }); await loadAdminData(); flash('Customer account created with its own bank identity. Save the temporary password now.');
    } catch (err:any) { setError(err.message); }
    finally { setBusy(false); }
  };

  const startEditCustomer = (customer: Profile & { account?: Account }) => {
    const a = customer.account;
    setEditingCustomerId(customer.id);
    setCustomerForm({
      display_name: customer.display_name || '', email: customer.email || '',
      phone: customer.phone || '', address: customer.address || '',
      country_name: a?.country_name || customer.country_name || 'Nigeria',
      country_code: a?.country_code || customer.country_code || 'NG',
      currency_code: a?.currency_code || 'NGN',
      avatar_url: customer.avatar_url || '', avatar_preview_url: customer.avatar_display_url || '',
      display_account_name: a?.display_account_name || 'Everyday account',
      bank_display_name: a?.bank_display_name || 'Your Bank',
      brand_primary_color: a?.brand_primary_color || '#163b55', brand_secondary_color: a?.brand_secondary_color || '#287078',
      bank_logo_url: a?.bank_logo_url || '', bank_banner_url: a?.bank_banner_url || '',
      account_number: a?.account_number || String(a?.account_suffix || '').padStart(10, '0'),
      account_type: a?.account_type || 'Everyday Account',
      account_status: a?.account_status || 'Active',
      branch_name: a?.branch_name || '', branch_address: a?.branch_address || '', support_phone: a?.support_phone || '', support_email: a?.support_email || '', website_url: a?.website_url || '',
      cardholder_name: a?.cardholder_name || customer.display_name || '',
      card_last4: a?.card_last4 || '', card_expiry: a?.card_expiry || '',
      card_status: a?.card_status || 'Inactive', card_image_url: a?.card_image_url || '',
      transfer_approved: Boolean(a?.transfer_approved), admin_pin: '',
    });
    setError('');
  };
  const uploadCustomerImage = async (field: 'avatar_url'|'bank_logo_url'|'bank_banner_url'|'card_image_url', file?: File) => {
    if (!supabase || !editingCustomerId || !file) return;
    if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Choose a PNG, JPG or WebP image smaller than 5 MB.');
      return;
    }
    try {
      setBusy(true);
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const path = 'customers/' + editingCustomerId + '/' + field + '-' + Date.now() + '.' + ext;
      const bucket = field === 'avatar_url' ? 'customer-profile-assets' : 'brand-assets';
      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false, cacheControl: '3600' });
      if (uploadError) throw uploadError;
      if (field === 'avatar_url') {
        const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 604800);
        setCustomerForm((old: any) => ({ ...old, avatar_url: path, avatar_preview_url: data?.signedUrl || '' }));
      } else {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        setCustomerForm((old: any) => ({ ...old, [field]: data.publicUrl }));
      }
      flash('Image uploaded. Save the customer profile to publish the change.');
    } catch (err: any) { setError(err.message || 'Image upload failed.'); }
    finally { setBusy(false); }
  };
  const saveCustomerProfile = async (e: FormEvent) => {
    e.preventDefault(); setError('');
    if (!supabase || !editingCustomerId) return;
    const countryCode = String(customerForm.country_code || '').trim().toUpperCase();
    const currencyCode = String(customerForm.currency_code || '').trim().toUpperCase();
    const cardLast4 = String(customerForm.card_last4 || '').replace(/\D/g, '');
    if (!/^[A-Z]{2}$/.test(countryCode)) { setError('Country code must contain two letters, for example NG or GB.'); return; }
    if (!/^[A-Z]{3}$/.test(currencyCode)) { setError('Currency must be a three-letter ISO code, for example NGN, USD or GBP.'); return; }
    if (cardLast4 && !/^\d{4}$/.test(cardLast4)) { setError('Enter exactly four display digits. Never enter a full card number.'); return; }
    try {
      setBusy(true);
      const { error: profileError } = await supabase.from('profiles').update({
        display_name: customerForm.display_name.trim(), phone: customerForm.phone.trim() || null,
        address: customerForm.address.trim() || null, country_name: customerForm.country_name.trim() || null,
        country_code: countryCode, avatar_url: customerForm.avatar_url || null,
      }).eq('id', editingCustomerId);
      if (profileError) throw profileError;
      const { error: accountError } = await supabase.from('demo_accounts').update({
        display_account_name: customerForm.display_account_name.trim(),
        bank_display_name: customerForm.bank_display_name.trim() || 'Your Bank',
        brand_primary_color: /^#[0-9A-Fa-f]{6}$/.test(customerForm.brand_primary_color) ? customerForm.brand_primary_color : '#163b55',
        brand_secondary_color: /^#[0-9A-Fa-f]{6}$/.test(customerForm.brand_secondary_color) ? customerForm.brand_secondary_color : '#287078',
        bank_logo_url: customerForm.bank_logo_url || null, bank_banner_url: customerForm.bank_banner_url || null,
        country_name: customerForm.country_name.trim(), country_code: countryCode, currency_code: currencyCode,
        account_number: String(customerForm.account_number || '').replace(/\D/g, '') || null,
        account_suffix: String(customerForm.account_number || '').replace(/\D/g, '').slice(-4) || '0000',
        account_type: customerForm.account_type.trim(), account_status: customerForm.account_status,
        transfer_approved: Boolean(customerForm.transfer_approved), support_phone: customerForm.support_phone.trim() || null, support_email: customerForm.support_email.trim() || null, website_url: customerForm.website_url.trim() || null,
        cardholder_name: customerForm.cardholder_name.trim() || customerForm.display_name.trim(),
        card_last4: cardLast4 || null, card_expiry: customerForm.card_expiry.trim() || null,
        card_status: customerForm.card_status, card_image_url: customerForm.card_image_url || null,
      }).eq('user_id', editingCustomerId);
      if (accountError) throw accountError;
      const { error: logError } = await supabase.from('activity_logs').insert({
        admin_id: profile?.id, action: 'customer_profile_updated', target_user_id: editingCustomerId,
        details: { country_code: countryCode, currency_code: currencyCode, simulator_only: true },
      });
      if (logError) console.warn('Profile saved but activity log failed:', logError.message);
      await loadAdminData();
      setEditingCustomerId('');
      flash('Customer profile and account presentation saved.');
    } catch (err: any) { setError(err.message || 'Unable to save customer profile.'); }
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
  const issueAdminPin = async () => {
    setError('');
    if (!editingCustomerId) return;
    if (!/^\d{4,6}$/.test(String(customerForm.admin_pin || ''))) { setError('Enter a 4–6 digit PIN to issue to this customer.'); return; }
    try {
      setBusy(true);
      await act({ action:'admin_set_pin', customer_id:editingCustomerId, pin:String(customerForm.admin_pin) });
      setCustomerForm((old:any)=>({...old,admin_pin:''}));
      await loadAdminData();
      flash('Administrator-issued simulator PIN saved. Share it securely with the customer.');
    } catch(err:any) { setError(err.message); }
    finally { setBusy(false); }
  };
  const makeTransfer = async (e: FormEvent) => {
    e.preventDefault(); setError('');
    const accountIdentifier = transfer.recipient_account.replace(/\s/g,'').toUpperCase();
    const validIdentifier = transfer.transfer_type === 'international' ? /^[A-Z0-9]{8,34}$/.test(accountIdentifier) : /^\d{8,20}$/.test(accountIdentifier);
    if (!transfer.recipient_name.trim() || !transfer.recipient_bank.trim() || !validIdentifier) { setError(transfer.transfer_type === 'international' ? 'Enter the beneficiary name, bank and a valid IBAN or international account identifier.' : 'Enter the recipient name, bank and a valid account number.'); return; }
    if (transfer.transfer_type === 'international' && (!/^[A-Z]{2}$/.test(transfer.recipient_country.trim().toUpperCase()) || !/^[A-Z]{3}$/.test(transfer.recipient_currency.trim().toUpperCase()) || !/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(transfer.swift_bic.trim().toUpperCase()) || (/^[A-Z]{2}\d{2}/.test(accountIdentifier) && !isValidIban(accountIdentifier)))) { setError('Check the destination country, ISO currency, SWIFT/BIC format and IBAN checksum.'); return; }
    if (!Number.isFinite(Number(transfer.amount)) || Number(transfer.amount) <= 0 || !transfer.description.trim()) { setError('Enter a valid amount and transfer description.'); return; }
    if (!account?.transfer_approved) { setError('Your administrator has not approved transfers for this simulator account yet.'); return; }
    if (!profile?.demo_pin_set_at) { setError('An administrator must issue your simulator passcode before you can continue.'); return; }
    setTransfer(old => ({ ...old, pin: '' })); setShowPinPrompt(true);
  };
  const verifyTransferPin = async () => {
    setError('');
    if (!/^\d{4,6}$/.test(transfer.pin)) { setError('Enter the 4–6 digit passcode issued by your administrator.'); return; }
    try { const result:any = await act({ action:'verify_transfer_pin', pin:transfer.pin }); if (!result?.valid) { setError('Wrong passcode. Please check it and try again.'); return; } if (result.notice) setTransferNotice(result.notice); setShowPinPrompt(false); setShowTransferConfirm(true); }
    catch(err:any) { setError(err.message || 'Passcode verification failed.'); }
  };
  const confirmTransfer = async () => {
    setError('');
    if (!account?.transfer_approved || !profile?.demo_pin_set_at) { setError('Transfer access is not enabled for this simulator account.'); return; }
    try {
      const maskedIdentifier = '••••' + transfer.recipient_account.replace(/\s/g,'').slice(-4);
      const description = (transfer.transfer_type.toUpperCase() + ' ' + transfer.recipient_name.trim() + ' ' + transfer.recipient_bank.trim() + ' ' + (transfer.recipient_country || 'DOM') + ' ' + (transfer.recipient_currency || account?.currency_code || '') + ' ' + (transfer.swift_bic || '') + ' ' + maskedIdentifier + ' ' + transfer.description.trim()).slice(0,160);
      await act({ action:'simulate_transfer', amount:Number(transfer.amount), description, pin:transfer.pin });
      setTransfer({transfer_type:'domestic',recipient_name:'',recipient_bank:'',recipient_account:'',recipient_country:'',recipient_currency:'',swift_bic:'',amount:'',description:'',pin:''}); setShowTransferConfirm(false); setShowPinPrompt(false);
      if(profile) await loadCustomerData(profile.id); flash('Simulated transfer recorded. No real payment was sent.');
    } catch(err:any) { setError(err.message); }
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
  const sendChatImage = async (file?: File) => {
    if (!supabase || !profile || !activeConversation || !file) return;
    if (!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type) || file.size < 1 || file.size > 5 * 1024 * 1024) {
      setError('Choose a JPG, PNG, WebP or GIF image up to 5 MB.'); return;
    }
    const convo = conversations.find(c=>c.id===activeConversation);
    const customerId = profile.role==='customer' ? profile.id : convo?.customer_id;
    if (!customerId) { setError('Choose a support conversation first.'); return; }
    try {
      setBusy(true);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100) || 'image';
      const path = customerId + '/' + activeConversation + '/' + Date.now() + '-' + safeName;
      const { error: uploadError } = await supabase.storage.from('support-attachments').upload(path,file,{contentType:file.type,upsert:false,cacheControl:'3600'});
      if (uploadError) throw uploadError;
      const { error: messageError } = await supabase.from('support_messages').insert({
        conversation_id:activeConversation,customer_id:customerId,sender_id:profile.id,body:'Image attachment',
        attachment_path:path,attachment_mime_type:file.type,attachment_name:safeName,attachment_size_bytes:file.size
      });
      if (messageError) { await supabase.storage.from('support-attachments').remove([path]); throw messageError; }
      await loadMessages(activeConversation); flash('Image sent to customer support.');
    } catch(err:any) { setError(err.message || 'Image could not be sent.'); }
    finally { setBusy(false); }
  };
  const deleteConversation = async () => {
    if (!supabase || !activeConversation || !profile) return;
    if (!window.confirm('Delete this support conversation and its messages? This cannot be undone.')) return;
    try {
      setBusy(true);
      const { data: attachments, error: listError } = await supabase.from('support_messages').select('attachment_path').eq('conversation_id',activeConversation).not('attachment_path','is',null);
      if (listError) throw listError;
      const paths = (attachments || []).map((x:any)=>x.attachment_path).filter(Boolean);
      if (paths.length) { const { error: removeError } = await supabase.storage.from('support-attachments').remove(paths); if (removeError) throw removeError; }
      const { error: deleteError } = await supabase.from('support_conversations').delete().eq('id',activeConversation);
      if (deleteError) throw deleteError;
      setMessages([]); setActiveConversation('');
      if (profile.role==='admin') await loadAdminData(); else await loadCustomerData(profile.id);
      flash('Conversation deleted.');
    } catch(err:any) { setError(err.message || 'Conversation could not be deleted.'); }
    finally { setBusy(false); }
  };
  const uploadBankBrandLogo = async (file?: File) => {
    if (!supabase || !file) return;
    if (!['image/png','image/jpeg','image/webp','image/svg+xml'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError('Choose a PNG, JPG, WebP or SVG logo smaller than 5 MB.'); return; }
    try {
      setBusy(true);
      const ext = file.type === 'image/svg+xml' ? 'svg' : file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const path = 'bank-brand/logo-' + Date.now() + '.' + ext;
      const { error: uploadError } = await supabase.storage.from('brand-assets').upload(path, file, { contentType: file.type, upsert: false, cacheControl: '3600' });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('brand-assets').getPublicUrl(path);
      setBrandLogoUrl(data.publicUrl);
      flash('Logo uploaded. Save bank identity to publish it.');
    } catch (err:any) { setError(err.message || 'Logo upload failed.'); }
    finally { setBusy(false); }
  };
  const saveNotice = async (key:string,value:unknown) => {
    if(!supabase)return;
    try { const {error:e}=await supabase.from('app_settings').upsert({key,value,updated_at:new Date().toISOString()},{onConflict:'key'}); if(e)throw e; flash('Settings saved.'); }
    catch(err:any){setError(err.message);}
  };
  const unread = notifications.filter(n=>!n.read_at).length;
  const nav = profile?.role==='admin'
    ? [{id:'overview',label:'Overview',icon:LayoutDashboard},{id:'customers',label:'Customers',icon:Users},{id:'balances',label:'Balance controls',icon:Wallet},{id:'support',label:'Support inbox',icon:MessageCircle},{id:'settings',label:'Settings',icon:Settings},{id:'activity',label:'Activity',icon:Activity}]
    : [{id:'overview',label:'Overview',icon:LayoutDashboard},{id:'transfer',label:'Transfers',icon:ArrowLeftRight},{id:'transactions',label:'Transactions',icon:Activity},{id:'notifications',label:'Notifications',icon:Bell},{id:'support',label:'Customer care',icon:MessageCircle},{id:'security',label:'Security',icon:ShieldCheck},{id:'settings',label:'Settings',icon:Settings}];
  const selectedCustomer = customers.find(c=>c.id===adjust.customer_id);
  const totalSimulated = useMemo(()=>customers.reduce((sum,c)=>sum+Number(c.account?.simulated_balance||0),0),[customers]);

  if (booting) return <div className="center-screen"><div className="spinner"/><p>Loading secure simulator…</p></div>;
  if (!isSupabaseConfigured) return <div className="center-screen"><div className="login-card"><Brand name={brandName} logoUrl={brandLogoUrl}/><h1>Connection setup needed</h1><p>The application files are ready, but the Supabase connection details must be present as Vercel environment variables.</p><p className="muted">Required: <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>. Use the existing project URL and public publishable/anon key only. Never use a service-role key in this browser app.</p><SimulatorDisclosure/></div></div>;
  if (!sessionUser || !profile) return <div style={{'--brand-primary': brandPrimary, '--brand-secondary': brandSecondary} as CSSProperties} className={entryRole === "customer" ? "auth-page customer-auth" : "auth-page"}><div className="auth-main generic-auth-main"><div className="auth-neutral-heading"><span className="auth-secure-label"><ShieldCheck size={22}/> SECURE ACCESS</span><label className="language-picker"><span>Language</span><select value={language} onChange={e=>setLanguage(e.target.value)} aria-label="Interface language"><option value="en">English</option><option value="fr">Français</option><option value="es">Español</option><option value="pt">Português</option><option value="ar">العربية</option></select></label></div><form className="login-card" onSubmit={login}><div className="eyebrow">WELCOME BACK</div><h2>{t('Sign in to continue')}</h2><p className="muted">{t('Use the login details provided by your administrator.')}</p>{error&&<div className="alert error">{error}</div>}<label>{t('Email address')}<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="username"/></label><label>{t('Password')}<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" required autoComplete="current-password"/></label><button className="primary full" disabled={loginBusy}>{loginBusy?'Signing in…':t('Sign in')} <ChevronDown size={17}/></button><p className="login-help"><ShieldCheck size={15}/> Customer accounts are created by the administrator.</p><div className="auth-signboard"><ShieldCheck size={16}/><span>Fictional simulator only. No real bank, real funds or payment processing.</span></div></form></div></div>;

  return <div style={{'--brand-primary': activeBrandPrimary, '--brand-secondary': activeBrandSecondary} as CSSProperties} className={"app-shell " + (profile.role === "customer" ? "customer-app" : "admin-app")}><aside className={`sidebar ${mobileNav?'open':''}`}><div className="side-brand"><Brand name={customerBankName} logoUrl={customerBankLogo}/><button className="icon-btn mobile-close" onClick={()=>setMobileNav(false)}><X/></button></div><div className="profile-mini">{profile.avatar_display_url?<img className="profile-avatar-image" src={profile.avatar_display_url} alt=""/>:<div className="avatar">{profile.display_name?.slice(0,1).toUpperCase()||'U'}</div>}<div><strong>{profile.display_name}</strong><small>{profile.role==='admin'?'Administrator':'Customer account'}</small></div></div><div className="nav-label">{t('Workspace').toUpperCase()}</div><nav>{nav.map(item=>{const Icon=item.icon;return <button key={item.id} className={`nav-item ${tab===item.id?'active':''}`} onClick={()=>{setTab(item.id);setMobileNav(false);setError('');}}><Icon size={18}/>{t(item.label)}{item.id==='notifications'&&unread>0&&<span className="nav-count">{unread}</span>}</button>;})}</nav><div className="sidebar-bottom">{profile.role==='admin'&&<div className="side-disclosure"><ShieldCheck size={17}/><span>Simulator environment<br/><b>No real money movement</b></span></div>}<button className="nav-item" onClick={logout}><LogOut size={18}/> Sign out</button></div></aside><main className="main-area"><header className="topbar"><button className="icon-btn menu-toggle" onClick={()=>setMobileNav(true)}><Menu/></button><div><div className="breadcrumb">{t('Workspace')} <span>/</span> {t(nav.find(n=>n.id===tab)?.label||'Overview')}</div><h1>{t(nav.find(n=>n.id===tab)?.label||'Overview')}</h1></div><div className="top-actions"><label className="language-picker" aria-label="Interface language"><span>Language</span><select value={language} onChange={e=>setLanguage(e.target.value)}><option value="en">English</option><option value="fr">Français</option><option value="es">Español</option><option value="pt">Português</option><option value="ar">العربية</option></select></label><button className="icon-btn notification-btn" onClick={()=>setTab(profile.role==='admin'?'support':'notifications')}><Bell size={19}/>{unread>0&&<i/>}</button><div className="top-user">{profile.avatar_display_url?<img className="profile-avatar-image small" src={profile.avatar_display_url} alt=""/>:<div className="avatar small">{profile.display_name?.slice(0,1).toUpperCase()}</div>}<span>{profile.display_name}</span></div></div></header><div className="content">{profile.role==='admin'&&<div className="sim-banner"><ShieldCheck size={17}/><span><b>SIMULATOR ENVIRONMENT</b> — No real money is held or moved.</span></div>}{error&&<div className="alert error global-alert"><span>{error}</span><button onClick={()=>setError('')}><X size={16}/></button></div>}

  {tab==='overview'&&profile.role==='admin'&&<><div className="welcome-row"><div><div className="eyebrow">ADMINISTRATOR CONSOLE</div><h2>Good day, {profile.display_name.split(' ')[0]}</h2><p className="muted">Manage simulator customers, fictional balances and support.</p></div><button className="primary" onClick={()=>setTab('customers')}><Plus size={17}/> Add customer</button></div><div className="stats-grid"><Stat icon={Users} label="Total customers" value={String(customers.length)} hint="Admin-created accounts"/><Stat icon={Wallet} label="Simulated funds" value={money(totalSimulated)} hint="Fictional balances only"/><Stat icon={MessageCircle} label="Open conversations" value={String(conversations.filter(c=>['open','pending'].includes(c.status)).length)} hint="Customer support"/><Stat icon={Activity} label="System status" value="Active" hint="Connected to Supabase"/></div><div className="panel"><div className="panel-heading"><div><h3>Recent customers</h3><p>Latest accounts created in the simulator</p></div><button className="text-btn" onClick={()=>setTab('customers')}>View all</button></div><CustomerTable rows={customers.slice(0,5)} onSelect={id=>{const customer=customers.find(c=>c.id===id);if(customer)startEditCustomer(customer);}}/></div></>}
  {tab==='overview'&&profile.role==='customer'&&<>
    <section className="customer-welcome">
      <div className="customer-welcome-bank-brand">{customerBankLogo?<img src={customerBankLogo} alt={customerBankName+' logo'}/>:<span>{customerBankName.slice(0,1).toUpperCase()}</span>}<b>{customerBankName}</b></div>
      <div className="customer-welcome-identity">{profile.avatar_display_url?<img className="customer-profile-photo" src={profile.avatar_display_url} alt="Profile"/>:<div className="customer-profile-photo customer-profile-fallback">{profile.display_name?.slice(0,1).toUpperCase()||'U'}</div>}<div><div className="eyebrow">YOUR FINANCIAL SPACE</div><h2>Good {new Date().getHours()<12?'morning':new Date().getHours()<18?'afternoon':'evening'}, {profile.display_name.split(' ')[0]}</h2><p>Here’s what’s happening with your account today.</p></div></div>
      <div className="welcome-date"><span>ACCOUNT STATUS</span><b><i/> {(account?.account_status||'Active')}</b></div>
    </section>
    <section className="customer-hero">
      <div className="hero-orbit hero-orbit-one"/><div className="hero-orbit hero-orbit-two"/>
      <div className="hero-copy">
        <div className="hero-brandline">{customerBankLogo?<img src={customerBankLogo} alt={customerBankName}/>:<span className="hero-brand-monogram">{customerBankName.slice(0,1)}</span>}<span>{customerBankName}<small>PERSONAL ACCOUNT</small></span></div>
        <div className="hero-balance-label">TOTAL AVAILABLE BALANCE <span>·</span> {account?.currency_code||'NGN'}</div>
        <div className="hero-balance-value">{money(Number(account?.simulated_balance||0),account?.currency_code||'NGN')}</div>
        <div className="hero-account-line"><span>{account?.display_account_name||'Everyday account'}</span><b>{account?.account_number||String(account?.account_suffix||'').padStart(10,'0')}</b></div>
        <div className="hero-actions"><button onClick={()=>setTab('transfer')}><ArrowUpRight size={17}/> {t('Make a transfer')}</button><button onClick={()=>setTab('transactions')}><Activity size={17}/> {t('View activity')}</button></div>
      </div>
      <div className="hero-visual" aria-hidden="true"><div className="hero-glass-card"><div className="glass-card-top"><span>{customerBankName}</span><span>DEBIT</span></div><div className="glass-chip"/><div className="glass-card-number">•••• &nbsp; •••• &nbsp; •••• &nbsp; {account?.card_last4||'0000'}</div><div className="glass-card-bottom"><span>{account?.cardholder_name||profile.display_name}</span><span>{account?.card_expiry||'--/--'}</span></div></div><div className="hero-visual-caption">A clearer view of your money</div></div>
    </section>
    <section className="customer-quick-strip">
      <button onClick={()=>setTab('transfer')}><span className="quick-icon"><ArrowLeftRight/></span><span><b>{t('Transfer money')}</b><small>{language==='fr'?'Effectuer un virement dans cette simulation':language==='es'?'Mover fondos en esta demostración':language==='pt'?'Mover fundos nesta demonstração':language==='ar'?'تحويل الأموال في هذه المحاكاة':'Move funds in this demo'}</small></span><ChevronDown/></button>
      <button onClick={()=>setTab('transactions')}><span className="quick-icon"><Activity/></span><span><b>{t('Transactions')}</b><small>{language==='fr'?'Consulter les opérations':language==='es'?'Revisar la actividad de la cuenta':language==='pt'?'Consultar a atividade da conta':language==='ar'?'مراجعة نشاط الحساب':'Review account activity'}</small></span><ChevronDown/></button>
      <button onClick={()=>setTab('support')}><span className="quick-icon"><MessageCircle/></span><span><b>{t('Get support')}</b><small>{language==='fr'?'Nous sommes là pour vous aider':language==='es'?'Estamos aquí para ayudarte':language==='pt'?'Estamos aqui para ajudar':language==='ar'?'نحن هنا للمساعدة':"We're here to help"}</small></span><ChevronDown/></button>
    </section>
    <section className="customer-overview-grid">
      <div className="customer-main-column">
        <div className="customer-section-heading"><div><span>{language==='fr'?'ACTIVITÉ DU COMPTE':language==='es'?'ACTIVIDAD DE LA CUENTA':language==='pt'?'ATIVIDADE DA CONTA':language==='ar'?'نشاط الحساب':'ACCOUNT ACTIVITY'}</span><h3>{t('Recent transactions')}</h3></div><button onClick={()=>setTab('transactions')}>{t('View all')} <ArrowUpRight size={15}/></button></div>
        <div className="customer-transactions">
          {transactions.length===0?<Empty text="Your recent account activity will appear here."/>:transactions.slice(0,5).map(tx=><div className="customer-transaction-row" key={tx.id}><span className={`customer-tx-icon ${tx.direction}`}>{tx.direction==='in'?<ArrowDownLeft/>:<ArrowUpRight/>}</span><span className="customer-tx-description"><b>{tx.description}</b><small>{dateText(tx.occurred_at)}</small></span><span className="customer-tx-amount"><b className={tx.direction}>{tx.direction==='in'?'+':'−'}{money(Number(tx.amount),tx.currency_code||account?.currency_code||'NGN')}</b><small>{tx.status||'Completed'}</small></span></div>)}
        </div>
      </div>
      <aside className="customer-side-column">
        <div className="customer-side-heading"><span>YOUR ACCOUNT</span><h3>Account details</h3></div>
        <div className="customer-detail-line"><span>Account type</span><b>{account?.account_type||'Everyday Account'}</b></div>
        <div className="customer-detail-line"><span>Account number</span><b>{account?.account_number||String(account?.account_suffix||'—')}</b></div>
        <div className="customer-detail-line"><span>Country</span><b>{account?.country_name||profile.country_name||'Not set'}</b></div>
        
        <div className="customer-side-footer"><ShieldCheck size={16}/><span>Your account information is managed by the administrator.</span></div>
      </aside>
    </section>
    {account?.bank_banner_url&&<img className="customer-bank-banner" src={account.bank_banner_url} alt="Bank information banner"/>}
  </>}

  {tab==='customers'&&profile.role==='admin'&&<><div className="section-intro"><div><h2>Customer accounts</h2><p>Create and manage access for simulator customers.</p></div></div><div className="two-col"><div className="panel"><div className="panel-heading"><div><h3>Create customer</h3><p>A temporary password is generated automatically.</p></div><Users size={20}/></div><form className="stack-form" onSubmit={createCustomer}><label>Customer full name<input value={newCustomer.display_name} onChange={e=>setNewCustomer({...newCustomer,display_name:e.target.value})} minLength={2} maxLength={80} required placeholder="Enter full name"/></label><label>Email address<input type="email" value={newCustomer.email} onChange={e=>setNewCustomer({...newCustomer,email:e.target.value})} required placeholder="customer@example.com"/></label><div className="profile-field-grid"><label>Phone number<input value={newCustomer.phone} onChange={e=>setNewCustomer({...newCustomer,phone:e.target.value})} placeholder="+234…"/></label><label>Country<input value={newCustomer.country_name} onChange={e=>setNewCustomer({...newCustomer,country_name:e.target.value})} required placeholder="Country name"/></label><label>Country code (2 letters)<input value={newCustomer.country_code} onChange={e=>setNewCustomer({...newCustomer,country_code:e.target.value.toUpperCase()})} maxLength={40} placeholder="NG — leave blank to use country default"/></label><label>Currency code (3 letters)<input value={newCustomer.currency_code} onChange={e=>setNewCustomer({...newCustomer,currency_code:e.target.value.toUpperCase()})} maxLength={40} placeholder="NGN — leave blank to use country default"/></label></div><label>Residential / contact address<textarea rows={2} value={newCustomer.address} onChange={e=>setNewCustomer({...newCustomer,address:e.target.value})} placeholder="Customer address"/></label><label>Bank name for this customer<input value={newCustomer.bank_display_name} onChange={e=>setNewCustomer({...newCustomer,bank_display_name:e.target.value})} maxLength={80} required placeholder="e.g. Bubu Bank"/></label><div className="brand-color-controls"><label>Primary bank colour<input type="color" value={newCustomer.brand_primary_color} onChange={e=>setNewCustomer({...newCustomer,brand_primary_color:e.target.value})}/></label><label>Secondary bank colour<input type="color" value={newCustomer.brand_secondary_color} onChange={e=>setNewCustomer({...newCustomer,brand_secondary_color:e.target.value})}/></label></div><label>Bank logo (optional)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const file=e.target.files?.[0];if(file&&(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024)){setError('Choose a PNG, JPG or WebP logo up to 5 MB.');return;}setNewCustomerLogo(file||null);}}/>{newCustomerLogo&&<small>{newCustomerLogo.name}</small>}</label><label>Account type<input value={newCustomer.account_type} onChange={e=>setNewCustomer({...newCustomer,account_type:e.target.value})} required placeholder="Everyday Account"/></label><h4>Initial transfer access</h4><div className="setting-row"><div><b>Approve simulated transfers</b><p>Apply this permission as soon as the customer account is created.</p></div><input aria-label="Approve simulated transfers on creation" type="checkbox" checked={newCustomer.transfer_approved} onChange={e=>setNewCustomer({...newCustomer,transfer_approved:e.target.checked})}/></div><label>Administrator-issued passcode (optional)<input type="password" inputMode="numeric" minLength={4} maxLength={6} value={newCustomer.admin_pin} onChange={e=>setNewCustomer({...newCustomer,admin_pin:e.target.value.replace(/\D/g,'').slice(0,6)})} placeholder="Enter 4–6 digits"/></label><p className="form-note">If you set a passcode here, it is securely hashed during account creation. You do not need to open Edit customer afterward. Share the passcode privately.</p><button className="primary" disabled={busy}><Plus size={17}/>{busy?'Creating…':'Create customer'}</button><p className="form-note">Country and currency are set independently for this customer and can be changed later. Currency changes affect display only; they do not convert the simulated balance. No customer self-registration is enabled.</p></form></div><div className="panel pale-panel"><ShieldCheck size={25}/><h3>Account safety</h3><p>Only administrator accounts can create customers. Share temporary passwords privately and ask customers to change them after their first sign-in.</p><p>Never ask customers to provide real banking passwords, card numbers, OTPs or PINs.</p></div></div>{editingCustomerId&&<div className="panel customer-editor"><div className="panel-heading"><div><h3>Edit customer presentation</h3><p>Everything entered here is shown on that customer's simulator dashboard.</p></div><button type="button" className="text-btn" onClick={()=>setEditingCustomerId('')}>Cancel</button></div><form className="stack-form" onSubmit={saveCustomerProfile}>
  <h4>Customer profile</h4><div className="profile-field-grid"><label>Full name<input required value={customerForm.display_name||''} onChange={e=>setCustomerForm({...customerForm,display_name:e.target.value})}/></label><label>Email address<input type="email" value={customerForm.email||''} disabled/></label><label>Phone number<input value={customerForm.phone||''} onChange={e=>setCustomerForm({...customerForm,phone:e.target.value})}/></label><label>Country name<input required value={customerForm.country_name||''} onChange={e=>setCustomerForm({...customerForm,country_name:e.target.value})}/></label><label>Country code (ISO 3166-1 alpha-2)<input required maxLength={2} value={customerForm.country_code||''} onChange={e=>setCustomerForm({...customerForm,country_code:e.target.value.toUpperCase()})}/></label><label>Currency code (ISO 4217)<input required maxLength={3} value={customerForm.currency_code||''} onChange={e=>setCustomerForm({...customerForm,currency_code:e.target.value.toUpperCase()})}/></label></div><p className="form-note">Country and currency are independently configurable. Changing currency changes the display format only; it does not convert or change the simulated balance.</p><label>Address<textarea rows={2} value={customerForm.address||''} onChange={e=>setCustomerForm({...customerForm,address:e.target.value})}/></label>
  <h4>Bank identity for this customer</h4><label>Bank display name<input required maxLength={80} value={customerForm.bank_display_name||''} onChange={e=>setCustomerForm({...customerForm,bank_display_name:e.target.value})} placeholder="Enter this customer's bank name"/></label><div className="brand-color-controls"><label>Primary bank colour<input type="color" value={customerForm.brand_primary_color||'#163b55'} onChange={e=>setCustomerForm({...customerForm,brand_primary_color:e.target.value})}/></label><label>Secondary bank colour<input type="color" value={customerForm.brand_secondary_color||'#287078'} onChange={e=>setCustomerForm({...customerForm,brand_secondary_color:e.target.value})}/></label></div><h4>Profile and bank images</h4><div className="profile-field-grid"><label>Customer profile photo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>uploadCustomerImage('avatar_url',e.target.files?.[0])}/>{customerForm.avatar_preview_url&&<img className="admin-image-preview" src={customerForm.avatar_preview_url} alt="Customer profile preview"/>}</label><label>Bank logo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>uploadCustomerImage('bank_logo_url',e.target.files?.[0])}/>{customerForm.bank_logo_url&&<img className="admin-image-preview logo-preview" src={customerForm.bank_logo_url} alt="Bank logo preview"/>}</label><label>Dashboard banner<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>uploadCustomerImage('bank_banner_url',e.target.files?.[0])}/>{customerForm.bank_banner_url&&<img className="admin-image-preview banner-preview" src={customerForm.bank_banner_url} alt="Bank banner preview"/>}</label><label>Simulated card design<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>uploadCustomerImage('card_image_url',e.target.files?.[0])}/>{customerForm.card_image_url&&<img className="admin-image-preview banner-preview" src={customerForm.card_image_url} alt="Simulated card preview"/>}</label></div>
  <h4>Account information</h4><div className="profile-field-grid"><label>Account display name<input value={customerForm.display_account_name||''} onChange={e=>setCustomerForm({...customerForm,display_account_name:e.target.value})}/></label><label>Account number<input value={customerForm.account_number||''} onChange={e=>setCustomerForm({...customerForm,account_number:e.target.value})} placeholder="0000000000"/></label><label>Account type<input value={customerForm.account_type||''} onChange={e=>setCustomerForm({...customerForm,account_type:e.target.value})}/></label><label>Account status<select value={customerForm.account_status||'Active'} onChange={e=>setCustomerForm({...customerForm,account_status:e.target.value})}><option>Active</option><option>Inactive</option><option>Restricted</option><option>Closed</option></select></label></div><h4>Transfer permissions and PIN</h4><div className="setting-row"><div><b>Approve simulated transfers</b><p>Allow this customer to submit simulator transfers after a PIN has been issued.</p></div><input aria-label="Approve simulated transfers" type="checkbox" checked={Boolean(customerForm.transfer_approved)} onChange={e=>setCustomerForm({...customerForm,transfer_approved:e.target.checked})}/></div><label>Issue or replace simulator PIN<input type="password" inputMode="numeric" maxLength={6} minLength={4} value={customerForm.admin_pin||''} onChange={e=>setCustomerForm({...customerForm,admin_pin:e.target.value.replace(/\D/g,'').slice(0,6)})} placeholder="Set 4–6 digits"/></label><button type="button" className="outline" onClick={issueAdminPin} disabled={busy}>{busy?'Saving…':'Issue PIN to customer'}</button><p className="form-note">The PIN is securely hashed by the backend. It is not displayed again after saving. Share it with the customer through a private channel. Save transfer approval separately with the customer profile.</p><h4>Bank customer service</h4><div className="profile-field-grid"><label>Support phone<input value={customerForm.support_phone||''} onChange={e=>setCustomerForm({...customerForm,support_phone:e.target.value})}/></label><label>Support email<input type="email" value={customerForm.support_email||''} onChange={e=>setCustomerForm({...customerForm,support_email:e.target.value})}/></label><label>Website<input value={customerForm.website_url||''} onChange={e=>setCustomerForm({...customerForm,website_url:e.target.value})} placeholder="https://example.test"/></label></div>
  <h4>Simulated debit card</h4><div className="profile-field-grid"><label>Cardholder name<input value={customerForm.cardholder_name||''} onChange={e=>setCustomerForm({...customerForm,cardholder_name:e.target.value})}/></label><label>Last four display digits only<input inputMode="numeric" maxLength={4} value={customerForm.card_last4||''} onChange={e=>setCustomerForm({...customerForm,card_last4:e.target.value.replace(/\D/g,'').slice(0,4)})} placeholder="1234"/></label><label>Expiry display (MM/YY)<input maxLength={5} value={customerForm.card_expiry||''} onChange={e=>setCustomerForm({...customerForm,card_expiry:e.target.value})} placeholder="MM/YY"/></label><label>Card status<select value={customerForm.card_status||'Inactive'} onChange={e=>setCustomerForm({...customerForm,card_status:e.target.value})}><option>Inactive</option><option>Active (simulated)</option><option>Blocked (simulated)</option></select></label></div><p className="form-note">Never enter or store a full payment card number, CVV, PIN or OTP. Card details here are visual simulator data only.</p>
  <button className="primary" disabled={busy}>{busy?'Saving…':'Save customer presentation'}</button>
</form></div>}<div className="panel"><div className="panel-heading"><div><h3>All customers</h3><p>{customers.length} registered simulator customer(s)</p></div><button className="icon-btn" onClick={loadAdminData}><RefreshCw size={17}/></button></div><CustomerTable rows={customers} onSelect={id=>{const customer=customers.find(c=>c.id===id);if(customer)startEditCustomer(customer);}}/></div>{createdCredentials&&<div className="modal-backdrop"><div className="modal"><button className="modal-close" onClick={()=>setCreatedCredentials(null)}><X/></button><div className="success-mark"><Check/></div><h2>Customer created</h2><p>Copy these login details now. The temporary password is shown only once.</p><div className="credential"><small>Email</small><b>{createdCredentials.email}</b></div><div className="credential"><small>Temporary password</small><b>{createdCredentials.password}</b><button className="text-btn" onClick={()=>navigator.clipboard.writeText(createdCredentials.password)}>Copy</button></div><button className="primary full" onClick={()=>{navigator.clipboard.writeText(`Email: ${createdCredentials.email}\nTemporary password: ${createdCredentials.password}`);flash('Login details copied.');}}>Copy login details</button><p className="form-note">Send these details securely to the customer. Do not post them publicly.</p></div></div>}</>}

  {tab==='balances'&&profile.role==='admin'&&<><div className="section-intro"><div><h2>Balance controls</h2><p>Add or subtract fictional funds from a customer's simulator account.</p></div></div><div className="two-col"><div className="panel"><div className="panel-heading"><div><h3>Adjust simulated balance</h3><p>Every adjustment is recorded in transaction history.</p></div><Wallet/></div><form className="stack-form" onSubmit={adjustBalance}><label>Customer<select value={adjust.customer_id} onChange={e=>setAdjust({...adjust,customer_id:e.target.value})} required><option value="">Select a customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.display_name} — {c.email}</option>)}</select></label>{selectedCustomer?.account&&<div className="selected-balance"><span>Current balance</span><b>{money(Number(selectedCustomer.account.simulated_balance),selectedCustomer.account.currency_code)}</b></div>}<label>Adjustment type<select value={adjust.direction} onChange={e=>setAdjust({...adjust,direction:e.target.value})}><option value="in">Add simulated funds</option><option value="out">Subtract simulated funds</option></select></label><label>Amount<input type="number" min="0.01" step="0.01" value={adjust.amount} onChange={e=>setAdjust({...adjust,amount:e.target.value})} required placeholder="0.00"/></label><label>Description<input value={adjust.description} onChange={e=>setAdjust({...adjust,description:e.target.value})} required maxLength={120}/></label><button className="primary" disabled={busy||!customers.length}>{busy?'Saving…':'Apply adjustment'}</button></form></div><div className="panel pale-panel"><ShieldCheck size={24}/><h3>Audit trail</h3><p>Each balance change is processed by a protected server-side function. The system checks administrator permissions before it changes a simulated balance.</p><p>These operations never connect to a payment processor or banking network.</p></div></div></>}

  {tab==='transfer'&&profile.role==='customer'&&<><div className="section-intro"><div><h2>Transfers</h2><p>Send money to a recipient using their account details.</p></div><span className={`status ${account?.transfer_approved?'good':'pending'}`}>{account?.transfer_approved?'Transfer access approved':'Awaiting administrator approval'}</span></div>{!transferEnabled||(account?.account_status||'Active').toLowerCase()!=='active'?<div className="panel empty-state"><ShieldCheck/><h3>{!transferEnabled?'Transfers are currently paused':'This simulator account is not active'}</h3><p>{!transferEnabled?'Your administrator has temporarily disabled simulated transfers.':'Contact the administrator if you believe this account status is incorrect.'}</p></div>:<div className="two-col"><div className="panel transfer-form-panel"><div className="panel-heading"><div><h3>Make a transfer</h3><p>Enter the recipient and payment details.</p></div><ArrowLeftRight/></div><div className="selected-balance"><span>Available balance</span><b>{money(Number(account?.simulated_balance||0),account?.currency_code||'NGN')}</b></div><form className="stack-form" onSubmit={makeTransfer}><label>Transfer type<select value={transfer.transfer_type} onChange={e=>setTransfer({...transfer,transfer_type:e.target.value,recipient_account:'',recipient_country:'',recipient_currency:'',swift_bic:''})}><option value="domestic">{t('Domestic transfer')}</option><option value="international">{t('International transfer')}</option></select></label><label>Beneficiary full name<input value={transfer.recipient_name} onChange={e=>setTransfer({...transfer,recipient_name:e.target.value})} required placeholder="Name on recipient account"/></label><label>Beneficiary bank<input value={transfer.recipient_bank} onChange={e=>setTransfer({...transfer,recipient_bank:e.target.value})} required placeholder="Enter recipient bank"/></label>{transfer.transfer_type==='international'&&<><div className="profile-field-grid"><label>Destination country code<input value={transfer.recipient_country} onChange={e=>setTransfer({...transfer,recipient_country:e.target.value.toUpperCase().slice(0,2)})} required maxLength={2} placeholder="GB"/></label><label>Destination currency code<input value={transfer.recipient_currency} onChange={e=>setTransfer({...transfer,recipient_currency:e.target.value.toUpperCase().slice(0,3)})} required maxLength={3} placeholder="GBP"/></label></div><label>SWIFT / BIC<input value={transfer.swift_bic} onChange={e=>setTransfer({...transfer,swift_bic:e.target.value.toUpperCase().replace(/\s/g,'').slice(0,11)})} required maxLength={11} placeholder="8 or 11 characters"/></label></>}<label>{transfer.transfer_type==='international'?'IBAN / international account number':'Recipient account number'}<input inputMode={transfer.transfer_type==='international'?'text':'numeric'} value={transfer.recipient_account} onChange={e=>setTransfer({...transfer,recipient_account:transfer.transfer_type==='international'?e.target.value.toUpperCase().slice(0,34):e.target.value.replace(/\D/g,'').slice(0,20)})} required minLength={8} maxLength={transfer.transfer_type==='international'?34:20} placeholder={transfer.transfer_type==='international'?'Enter IBAN / account identifier':'Enter account number'}/></label><label>Amount ({account?.currency_code||'NGN'})<input type="number" min="0.01" step="0.01" value={transfer.amount} onChange={e=>setTransfer({...transfer,amount:e.target.value})} required placeholder="0.00"/></label><label>Payment reference<input value={transfer.description} onChange={e=>setTransfer({...transfer,description:e.target.value})} required maxLength={80} placeholder="What is this transfer for?"/></label>{transfer.transfer_type==='international'&&<p className="form-note">International details are collected for the simulator workflow only. No FX conversion, SWIFT message or cross-border payment is sent.</p>}<button className="primary" disabled={busy}>{busy?'Please wait…':'Transfer'} <ArrowUpRight size={17}/></button></form></div><div className="panel pale-panel"><ShieldCheck size={24}/><h3>Transfer information</h3><p>{transferNotice.message}</p><div className="setting-row"><div><b>Transfer authorisation</b><p>Administrator-issued PIN and account approval are required.</p></div></div><p className="form-note">The confirmation step explains the simulator action before any fictional account record is created.</p></div></div>}</>}

  {tab==='transactions'&&profile.role==='customer'&&<div className="panel"><div className="panel-heading"><div><h3>Transaction history</h3><p>Your account activity.</p></div><button className="icon-btn" onClick={()=>profile&&loadCustomerData(profile.id)}><RefreshCw size={17}/></button></div><TransactionTable rows={transactions} currency={account?.currency_code||'NGN'}/></div>}
  {tab==='notifications'&&profile.role==='customer'&&<div className="panel"><div className="panel-heading"><div><h3>Notifications</h3><p>Important account updates and messages.</p></div><Bell/></div>{notifications.length===0?<Empty text="You do not have any notifications yet."/>:<div className="notification-list">{notifications.map(n=><div className={`notification-row ${n.read_at?'':'unread'}`} key={n.id}><div className="notice-dot"/><div><b>{n.title}</b><p>{n.body}</p><small>{dateText(n.created_at)}</small></div>{!n.read_at&&<button className="text-btn" onClick={async()=>{try{await act({action:'mark_notification_read',notification_id:n.id});setNotifications(old=>old.map(x=>x.id===n.id?{...x,read_at:new Date().toISOString()}:x));}catch(err:any){setError(err.message);}}}>Mark read</button>}</div>)}</div>}</div>}

  {tab==='settings'&&profile.role==='customer'&&<><div className="section-intro"><div><h2>{t('Account settings')}</h2><p>Review your profile, account preferences and available support.</p></div></div><div className="two-col"><div className="panel language-settings-panel"><div className="panel-heading"><div><h3>Language</h3><p>Translate interface labels and guidance. Bank names, transaction details and customer-entered information remain unchanged.</p></div><Settings/></div><label>Interface language<select value={language} onChange={e=>setLanguage(e.target.value)}><option value="en">English</option><option value="fr">Français</option><option value="es">Español</option><option value="pt">Português</option><option value="ar">العربية</option></select></label></div><div className="panel"><div className="panel-heading"><div><h3>{t('Personal information')}</h3><p>Details maintained by your account administrator.</p></div><Users/></div><div className="account-details-list"><div><span>Full name</span><b>{profile.display_name}</b></div><div><span>Email address</span><b>{profile.email||'Not provided'}</b></div><div><span>Phone number</span><b>{profile.phone||'Not provided'}</b></div><div><span>Country</span><b>{account?.country_name||profile.country_name||'Not provided'}</b></div></div></div><div className="panel"><div className="panel-heading"><div><h3>{t('Account preferences')}</h3><p>Your current simulator account configuration.</p></div><Settings/></div><div className="account-details-list"><div><span>Account type</span><b>{account?.account_type||'Everyday Account'}</b></div><div><span>Account number</span><b>{account?.account_number||'Not assigned'}</b></div><div><span>Display currency</span><b>{account?.currency_code||'NGN'}</b></div><div><span>Account status</span><b>{account?.account_status||'Active'}</b></div></div></div><div className="panel settings-action-panel"><h3>{t('Security and support')}</h3><p>Keep your sign-in details secure and contact the support team if your account information needs to change.</p><div className="settings-action-row"><button className="outline" onClick={()=>setTab('security')}><ShieldCheck size={16}/> Security & password</button><button className="outline" onClick={()=>setTab('notifications')}><Bell size={16}/> Notifications</button><button className="outline" onClick={()=>setTab('support')}><MessageCircle size={16}/> Contact support</button></div></div></div></>}

  {tab==='security'&&profile.role==='customer'&&<div className="two-col"><div className="panel"><div className="panel-heading"><div><h3>Security & access</h3><p>Manage sign-in credentials and review administrator-issued transfer access.</p></div><ShieldCheck/></div><div className="setting-row"><div><b>Simulator transfer PIN</b><p>{profile.demo_pin_set_at?'An administrator has issued a PIN for this account.':'No PIN has been issued yet. Contact customer support.'}</p></div><span className={`status ${profile.demo_pin_set_at?'good':'pending'}`}>{profile.demo_pin_set_at?'Issued by admin':'Not issued'}</span></div><Divider/><form className="stack-form" onSubmit={changePassword}><h4>Change account password</h4><label>New password<input type="password" minLength={10} value={newPassword} onChange={e=>setNewPassword(e.target.value)} required placeholder="At least 10 characters" autoComplete="new-password"/></label><label>Confirm new password<input type="password" minLength={10} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required placeholder="Enter it again" autoComplete="new-password"/></label><button className="outline">Update password</button></form></div><div className="panel pale-panel"><ShieldCheck size={25}/><h3>Your security</h3><p>Your transfer PIN is issued and managed by the administrator. Customer accounts cannot create or change it.</p><p>Never share your sign-in password or administrator-issued simulator PIN.</p></div></div>}

  {tab==='support'&&<div className="support-layout"><div className="panel support-list"><div className="panel-heading"><div><h3>{profile.role==='admin'?'Support inbox':'Your conversations'}</h3><p>{profile.role==='admin'?'Select a customer conversation':'Talk to customer support'}</p></div><MessageCircle/></div>{profile.role==='customer'?<button className="primary full" onClick={startChat}><Plus size={16}/> Open customer care chat</button>:null}{(profile.role==='admin'?conversations:conversations.filter(c=>c.customer_id===profile.id)).map(c=><button key={c.id} className={`conversation-item ${activeConversation===c.id?'chosen':''}`} onClick={async()=>{setActiveConversation(c.id);await loadMessages(c.id);}}><span className="avatar">{(c.customer?.display_name||'C').slice(0,1)}</span><span><b>{profile.role==='admin'?c.customer?.display_name||'Customer':'Customer care'}</b><small>{c.status} · {dateText(c.last_message_at)}</small></span></button>)}{(profile.role==='admin'?conversations.length:conversations.filter(c=>c.customer_id===profile.id).length)===0&&<Empty text="No conversations yet."/>}</div><div className="panel chat-panel"><div className="chat-heading"><div><h3>{activeConversation?(profile.role==='admin'?conversations.find(c=>c.id===activeConversation)?.customer?.display_name:'Customer care'):'Conversation'}</h3><p>Messages are visible only to the customer and authorized administrators.</p></div>{activeConversation?<button type="button" className="icon-btn danger" title="Delete conversation" onClick={deleteConversation} disabled={busy}><Trash2 size={17}/></button>:<CircleHelp/>}</div><div className="chat-messages">{!activeConversation?<Empty text={profile.role==='admin'?'Choose a conversation to reply.':'Open a chat to contact customer care.'}/>:messages.map(m=><div key={m.id} className={`message-bubble ${m.sender_id===profile.id?'mine':''}`}>{m.attachment_url&&<a href={m.attachment_url} target="_blank" rel="noreferrer"><img className="chat-attachment" src={m.attachment_url} alt={m.attachment_name||"Chat attachment"}/></a>}{m.body!=='Image attachment'&&<p>{m.body}</p>}<small>{dateText(m.created_at)}</small></div>)}</div>{activeConversation&&<form className="chat-compose" onSubmit={sendMessage}><input value={chatText} onChange={e=>setChatText(e.target.value)} placeholder="Write a message…" maxLength={4000}/><label className="chat-attach" title="Send image"><Paperclip size={18}/><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>{sendChatImage(e.target.files?.[0]);e.currentTarget.value="";}} disabled={busy}/></label><button className="primary" disabled={!chatText.trim()||busy}><Send size={17}/></button></form>}</div></div>}

  {tab==='settings'&&profile.role==='admin'&&<><div className="section-intro"><div><h2>Application settings</h2><p>Control the display name and customer-facing notices.</p></div></div><div className="two-col"><div className="panel"><div className="panel-heading"><div><h3>Brand and notices</h3><p>Changes apply to the simulator interface.</p></div><Settings/></div><form className="stack-form" onSubmit={e=>{e.preventDefault();saveNotice('brand_config',{name:brandName.trim(),logo_url:brandLogoUrl || null,primary_color:brandPrimary,secondary_color:brandSecondary});}}><label>Bank name<input value={brandName} onChange={e=>setBrandName(e.target.value)} maxLength={60} required placeholder="Enter the bank name"/></label><div className="brand-color-controls"><label>Primary brand colour<input type="color" value={brandPrimary} onChange={e=>setBrandPrimary(e.target.value)}/><small>Main colour for the account board and navigation.</small></label><label>Secondary brand colour<input type="color" value={brandSecondary} onChange={e=>setBrandSecondary(e.target.value)}/><small>Supporting colour for gradients and highlights.</small></label></div><label>Bank logo<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={e=>uploadBankBrandLogo(e.target.files?.[0])}/>{brandLogoUrl&&<img className="admin-image-preview logo-preview" src={brandLogoUrl} alt="Current bank logo"/>}</label><button className="outline" disabled={busy}>Save bank identity</button></form><Divider/><form className="stack-form" onSubmit={e=>{e.preventDefault();saveNotice('welcome_notice',welcomeNotice);}}><h4>Welcome notice</h4><label>Title<input value={welcomeNotice.title} onChange={e=>setWelcomeNotice({...welcomeNotice,title:e.target.value})}/></label><label>Message<textarea rows={3} value={welcomeNotice.message} onChange={e=>setWelcomeNotice({...welcomeNotice,message:e.target.value})}/></label><button className="outline">Save welcome notice</button></form><Divider/><form className="stack-form" onSubmit={e=>{e.preventDefault();saveNotice('transfer_notice',transferNotice);}}><h4>Transfer notice</h4><label>Title<input value={transferNotice.title} onChange={e=>setTransferNotice({...transferNotice,title:e.target.value})}/></label><label>Message<textarea rows={3} value={transferNotice.message} onChange={e=>setTransferNotice({...transferNotice,message:e.target.value})}/></label><button className="outline">Save transfer notice</button></form></div><div className="panel"><div className="panel-heading"><div><h3>Transfer controls</h3><p>Enable or pause simulated transfers.</p></div><ArrowLeftRight/></div><div className="setting-row"><div><b>Allow simulated transfers</b><p>Customers can create fictional outgoing transfers.</p></div><button className={`toggle ${transferEnabled?'on':''}`} onClick={()=>{const next=!transferEnabled;setTransferEnabled(next);saveNotice('transfer_config',{enabled:next,require_demo_pin:true});}} aria-label="Toggle simulated transfers"><span/></button></div><div className="callout"><ShieldCheck/><p>The transfer engine uses the protected Supabase function and a simulator-only PIN check. No external payment provider is configured.</p></div></div></div></>}
  {tab==='activity'&&profile.role==='admin'&&<div className="panel"><div className="panel-heading"><div><h3>Recent activity</h3><p>Administrative actions recorded by the simulator.</p></div><Activity/></div><ActivityList/></div>}
  </div></main>{toast&&<div className="toast"><Check size={17}/>{toast}</div>}{showPinPrompt&&<div className="modal-backdrop"><div className="modal"><button className="modal-close" onClick={()=>{setShowPinPrompt(false);setError('');}}><X/></button><div className="success-mark"><ShieldCheck/></div><h2>{t('Transfer passcode')}</h2>{error&&<div className="alert error">{error}</div>}<p>Enter the administrator-issued passcode to continue with this simulated transfer.</p><label>Transfer passcode<input autoFocus inputMode="numeric" type="password" maxLength={6} value={transfer.pin} onChange={e=>setTransfer({...transfer,pin:e.target.value.replace(/\D/g,'')})} placeholder="Enter your passcode"/></label><button className="primary full" disabled={busy||!/^\d{4,6}$/.test(transfer.pin)} onClick={verifyTransferPin}>{busy?'Checking…':t('Continue')}</button><button className="outline full" onClick={()=>{setShowPinPrompt(false);setError('');}}>{t('Cancel')}</button></div></div>}{showTransferConfirm&&<div className="modal-backdrop"><div className="modal"><button className="modal-close" onClick={()=>{setShowTransferConfirm(false);setError('');}}><X/></button><div className="success-mark"><ArrowLeftRight/></div><h2>{transferNotice.title||'Transfer confirmation'}</h2>{error&&<div className="alert error">{error}</div>}<p>{transferNotice.message}</p><p className="form-note">Fictional simulator only. No real bank transfer or payment will occur. Continuing records a simulated transaction and updates the fictional balance only.</p><div className="credential"><small>Recipient</small><b>{transfer.recipient_name}</b></div><div className="credential"><small>Bank and account</small><b>{transfer.recipient_bank} · {transfer.recipient_account}</b></div>{transfer.transfer_type==='international'&&<><div className="credential"><small>Destination</small><b>{transfer.recipient_country} · {transfer.recipient_currency}</b></div><div className="credential"><small>SWIFT / BIC</small><b>{transfer.swift_bic}</b></div></>}<div className="credential"><small>Amount</small><b>{money(Number(transfer.amount),account?.currency_code||'NGN')}</b></div><button className="primary full" disabled={busy} onClick={confirmTransfer}>{busy?'Processing…':'Confirm simulated transfer'}</button><button className="outline full" onClick={()=>setShowTransferConfirm(false)}>Cancel</button></div></div>}{showWelcome&&<div className="modal-backdrop"><div className="modal"><div className="success-mark"><ShieldCheck/></div><h2>{welcomeNotice.title}</h2><p>{welcomeNotice.message}</p><button className="primary full" onClick={async()=>{setShowWelcome(false);try{await act({action:'mark_welcome_seen'});if(profile){setProfile({...profile,welcome_seen_at:new Date().toISOString()});}}catch(err:any){setError(err.message);}}}>Continue</button></div></div>}</div>;
}

function Brand({name,logoUrl}:{name:string;logoUrl?:string}){return <div className="brand">{logoUrl?<img className="brand-logo-image" src={logoUrl} alt={name+' logo'}/>:<div className="brand-mark"><span>{name.slice(0,1).toUpperCase()}</span></div>}<div><b>{name}</b><small>DIGITAL BANKING</small></div></div>}
function SimulatorDisclosure(){return <div className="disclosure"><ShieldCheck size={15}/><span>Fictional simulator only. No real bank, real funds, or real payment processing.</span></div>}
function Stat({icon:Icon,label,value,hint}:{icon:any;label:string;value:string;hint:string}){return <div className="stat-card"><div className="stat-top"><span>{label}</span><Icon size={19}/></div><strong>{value}</strong><small>{hint}</small></div>}
function CustomerTable({rows,onSelect}:{rows:(Profile&{account?:Account})[];onSelect?:(id:string)=>void}){return rows.length===0?<Empty text="No customers have been created yet."/>:<div className="table-wrap"><table><thead><tr><th>Customer</th><th>Email</th><th>Simulated balance</th><th>PIN status</th><th></th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><div className="table-person">{r.avatar_display_url?<img className="table-avatar-image" src={r.avatar_display_url} alt=""/>:<span className="avatar">{r.display_name?.slice(0,1)}</span>}<b>{r.display_name}</b></div></td><td>{r.email||'—'}</td><td>{r.account?money(Number(r.account.simulated_balance),r.account.currency_code):'Account pending'}</td><td><span className={`status ${r.demo_pin_set_at?'good':'pending'}`}>{r.demo_pin_set_at?'PIN set':'PIN not set'}</span></td><td>{onSelect&&<button className="text-btn" onClick={()=>onSelect(r.id)}>Manage</button>}</td></tr>)}</tbody></table></div>}
function TransactionTable({rows,currency}:{rows:Tx[];currency:string}){return rows.length===0?<Empty text="No simulated transactions yet."/>:<div className="table-wrap"><table><thead><tr><th>Description</th><th>Date</th><th>Status</th><th className="right">Amount</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><div className="transaction-name"><span className={`tx-icon ${r.direction}`} >{r.direction==='in'?<ArrowDownLeft size={17}/>:<ArrowUpRight size={17}/>}</span><b>{r.description}</b></div></td><td>{dateText(r.occurred_at)}</td><td><span className="status good">{r.status||'Simulated'}</span></td><td className={`right amount ${r.direction}`}>{r.direction==='in'?'+':'−'}{money(Number(r.amount),r.currency_code||currency)}</td></tr>)}</tbody></table></div>}
function Empty({text}:{text:string}){return <div className="empty-state"><div className="empty-icon"><Activity/></div><p>{text}</p></div>}
function Divider(){return <div className="section-divider"/>}
function ActivityList(){const [items,setItems]=useState<any[]>([]);const [loading,setLoading]=useState(true);useEffect(()=>{if(!supabase)return;supabase.from('activity_logs').select('*').order('created_at',{ascending:false}).limit(30).then(({data})=>{setItems(data||[]);setLoading(false);});},[]);if(loading)return <Empty text="Loading activity…"/>;return items.length===0?<Empty text="No administrative activity recorded yet."/>:<div className="activity-list">{items.map(x=><div key={x.id}><span className="activity-dot"/><div><b>{String(x.action).replaceAll('_',' ')}</b><p>{x.details?.display_name||x.details?.email||'Simulator management action'}</p><small>{dateText(x.created_at)}</small></div></div>)}</div>}