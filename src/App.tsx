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
