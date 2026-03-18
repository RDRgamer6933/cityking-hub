import React, { useState, useEffect, useRef } from 'react';
import { 
  Home, 
  Trophy, 
  PlusCircle, 
  MessageSquare, 
  User, 
  Search, 
  Filter, 
  Copy, 
  Check, 
  Crown, 
  ThumbsUp, 
  Send, 
  LogOut, 
  LogIn,
  Gamepad2,
  ChevronRight,
  ExternalLink,
  RefreshCcw,
  Settings,
  LayoutDashboard,
  Menu,
  X,
  ShieldCheck,
  Play,
  Heart,
  Video as VideoIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc, 
  serverTimestamp, 
  where, 
  limit, 
  setDoc,
  increment,
  getDocs,
  deleteDoc,
  runTransaction
} from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { db, auth, signInWithGoogle, logout, handleFirestoreError, OperationType } from './firebase';
import { Server, ChatMessage, UserProfile, AppScreen, GameMode, Video } from './types';
import { cn, formatNumber } from './lib/utils';

// --- Components ---

const Button = ({ 
  children, 
  className, 
  variant = 'primary', 
  size = 'md', 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'gold';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}) => {
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-900/20',
    secondary: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700',
    outline: 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800',
    ghost: 'text-zinc-400 hover:text-white hover:bg-zinc-800',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    gold: 'bg-gradient-to-r from-amber-400 to-amber-600 text-black font-bold hover:from-amber-500 hover:to-amber-700 shadow-lg shadow-amber-900/20',
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
    icon: 'p-2',
  };

  return (
    <button 
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className, glow = false }: { children: React.ReactNode; className?: string; glow?: boolean }) => (
  <div className={cn(
    'bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-2xl overflow-hidden',
    glow && 'shadow-[0_0_20px_rgba(37,99,235,0.1)] border-blue-900/30',
    className
  )}>
    {children}
  </div>
);

const Badge = ({ children, className, variant = 'default' }: { children: React.ReactNode; className?: string; variant?: 'default' | 'gold' | 'blue' | 'green' }) => {
  const variants = {
    default: 'bg-zinc-800 text-zinc-400',
    gold: 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
    blue: 'bg-blue-500/10 text-blue-500 border border-blue-500/20',
    green: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
  };
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider', variants[variant], className)}>
      {children}
    </span>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeScreen, setActiveScreen] = useState<AppScreen>('home');
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<string>('All');

  useEffect(() => {
    (window as any).setActiveScreen = setActiveScreen;
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          if (!userDoc.exists()) {
            const newProfile: UserProfile = {
              uid: u.uid,
              displayName: u.displayName || 'Gamer',
              email: u.email || '',
              photoURL: u.photoURL || '',
              role: u.email === 'rihadahmedsunny@gmail.com' ? 'admin' : 'user'
            };
            await setDoc(doc(db, 'users', u.uid), newProfile);
            setProfile(newProfile);
          } else {
            const existingProfile = userDoc.data() as UserProfile;
            if (u.email === 'rihadahmedsunny@gmail.com' && existingProfile.role !== 'admin') {
              await updateDoc(doc(db, 'users', u.uid), { role: 'admin' });
              setProfile({ ...existingProfile, role: 'admin', uid: u.uid });
            } else {
              setProfile({ uid: u.uid, ...existingProfile });
            }
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${u.uid}`);
        }
      } else {
        setProfile(null);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'servers'), orderBy('votes', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const serverData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Server));
      setServers(serverData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'servers');
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user && !loading && (servers.length === 0 || !servers.some(s => s.isOfficial))) {
      seedOfficialServer();
    }
  }, [user, servers, loading]);

  // One-time status update and vote reset for CityKing Network as requested
  useEffect(() => {
    const updateCityKing = async () => {
      const cityKing = servers.find(s => s.name === 'CityKing Network');
      if (cityKing) {
        const needsStatusUpdate = cityKing.motd !== 'Coming Soon';
        const needsVoteReset = cityKing.votes > 0;

        if (needsStatusUpdate || needsVoteReset) {
          try {
            await updateDoc(doc(db, 'servers', cityKing.id), { 
              ...(needsStatusUpdate && {
                motd: 'Coming Soon',
                motdColor: '#ef4444', // Red-500
                description: 'CityKing Network is COMING SOON! Stay tuned for the ultimate survival experience.'
              }),
              ...(needsVoteReset && { votes: 0 })
            });
            console.log('CityKing Network updated successfully');
          } catch (err) {
            console.error('Error updating CityKing:', err);
          }
        }
      }
    };
    if (servers.length > 0) {
      updateCityKing();
    }
  }, [servers]);

  const seedOfficialServer = async () => {
    if (!auth.currentUser) return;
    
    try {
      const q = query(collection(db, 'servers'), where('isOfficial', '==', true));
      const snap = await getDocs(q);
      if (snap.empty) {
        await addDoc(collection(db, 'servers'), {
          name: 'CityKing Network',
          javaIp: 'play.cityking.net',
          bedrockIp: 'play.cityking.net',
          mode: 'Survival',
          version: '1.20.x',
          motd: 'Coming Soon',
          motdColor: '#ef4444',
          description: 'CityKing Network is COMING SOON! Stay tuned for the ultimate survival experience.',
          votes: 0,
          isOfficial: true,
          createdBy: auth.currentUser.uid,
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error('Error seeding official server:', err);
      // Log but don't throw to avoid breaking app mount
      try {
        handleFirestoreError(err, OperationType.WRITE, 'servers');
      } catch (e) {
        // Silent catch for the throw in handleFirestoreError
      }
    }
  };

  const filteredServers = servers.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.javaIp.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (s.bedrockIp && s.bedrockIp.toLowerCase().includes(searchQuery.toLowerCase()));
    const modes = Array.isArray(s.mode) ? s.mode : [s.mode];
    const matchesMode = filterMode === 'All' || modes.includes(filterMode as any);
    return matchesSearch && matchesMode;
  });

  const officialServer = servers.find(s => s.isOfficial);
  const otherServers = filteredServers.filter(s => !s.isOfficial);

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-zinc-800 px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20 overflow-hidden border border-zinc-800">
            <img 
              src="https://cdn.discordapp.com/attachments/1383875664142401617/1451219928966369280/20251218_202925.png?ex=69bb5fa1&is=69ba0e21&hm=e0ced0bd86987032565e8ecae5946a236183f979635fa7ec2cef16760085f136" 
              alt="CityKing Logo" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex flex-col -space-y-1">
            <h1 className="text-xl font-black tracking-tighter uppercase italic leading-none">
              CityKing <span className="text-blue-500">Hub</span>
            </h1>
            <span className="text-[10px] font-bold text-zinc-500 tracking-[0.2em] uppercase pl-0.5">Gaming Network</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <a 
            href="https://discord.gg/GuHjbRS3vN" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-lg shadow-[#5865F2]/20 active:scale-95"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Join Discord</span>
          </a>
          {user ? (
            <button 
              onClick={() => setActiveScreen('profile')}
              className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-full pl-1 pr-3 py-1 hover:border-zinc-700 transition-colors"
            >
              <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} className="w-6 h-6 rounded-full" alt="User" />
              <span className="text-xs font-bold truncate max-w-[80px]">{user.displayName?.split(' ')[0]}</span>
            </button>
          ) : (
            <Button size="sm" onClick={signInWithGoogle}>
              <LogIn className="w-4 h-4 mr-2" />
              Login
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 pb-24 px-4 max-w-md mx-auto">
        <AnimatePresence mode="wait">
          {activeScreen === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Featured Server */}
              {officialServer && (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Featured Server</h2>
                    <Badge variant="gold">Official</Badge>
                  </div>
                  <ServerCard server={officialServer} featured user={user} />
                </section>
              )}

              {/* Discord Join Banner */}
              <motion.a 
                href="https://discord.gg/GuHjbRS3vN"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="block p-4 bg-gradient-to-r from-[#5865F2] to-[#4752C4] rounded-2xl shadow-xl shadow-[#5865F2]/20 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:scale-110 transition-transform">
                  <MessageSquare className="w-24 h-24 -rotate-12" />
                </div>
                <div className="relative z-10 flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-lg font-black uppercase italic tracking-tight text-white leading-tight">Join Our Community</h3>
                    <p className="text-white/80 text-xs font-medium">Get exclusive updates, giveaways & more!</p>
                  </div>
                  <div className="bg-white text-[#5865F2] px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg">
                    Join Now
                  </div>
                </div>
              </motion.a>

              {/* Search & Filter */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input 
                    type="text" 
                    placeholder="Search servers..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <select 
                  value={filterMode}
                  onChange={(e) => setFilterMode(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                >
                  <option>All</option>
                  <option>Anarchy</option>
                  <option>Bedwars</option>
                  <option>BoxPvP</option>
                  <option>Build Battle</option>
                  <option>Cobblemon</option>
                  <option>Creative</option>
                  <option>Duels</option>
                  <option>Earth</option>
                  <option>Eggwars</option>
                  <option>Factions</option>
                  <option>Gens</option>
                  <option>Hardcore</option>
                  <option>Hide and Seek</option>
                  <option>KitPvP</option>
                  <option>Lifesteal</option>
                  <option>Minigames</option>
                  <option>Modded</option>
                  <option>Murder Mystery</option>
                  <option>OneBlock</option>
                  <option>Parkour</option>
                  <option>Pixelmon</option>
                  <option>Practice</option>
                  <option>Prison</option>
                  <option>PvP</option>
                  <option>Roleplay</option>
                  <option>Skyblock</option>
                  <option>Skywars</option>
                  <option>Slimefun</option>
                  <option>SMP</option>
                  <option>Speedrun</option>
                  <option>Survival</option>
                  <option>Survival Games</option>
                  <option>TNT Run</option>
                  <option>Towny</option>
                  <option>UHC</option>
                  <option>Vanilla</option>
                </select>
              </div>

              {/* Server List */}
              <section className="space-y-4">
                <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Server Finder</h2>
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-zinc-500 text-sm">Loading servers...</p>
                  </div>
                ) : otherServers.length > 0 ? (
                  otherServers.map(server => (
                    <ServerCard key={server.id} server={server} user={user} />
                  ))
                ) : (
                  <div className="text-center py-12 bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-800">
                    <p className="text-zinc-500 text-sm">No servers found matching your criteria.</p>
                  </div>
                )}
              </section>
            </motion.div>
          )}

          {activeScreen === 'leaderboard' && <Leaderboard servers={servers} />}
          {activeScreen === 'upload' && <UploadScreen user={user} onComplete={() => setActiveScreen('home')} />}
          {activeScreen === 'videos' && <VideosScreen user={user} profile={profile} />}
          {activeScreen === 'chat' && <ChatScreen user={user} />}
          {activeScreen === 'profile' && <ProfileScreen user={user} profile={profile} onLogout={() => setActiveScreen('home')} onNavigate={setActiveScreen} />}
          {activeScreen === 'admin' && profile?.role === 'admin' && <AdminPanel servers={servers} user={user} />}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-t border-zinc-800 px-6 h-20 flex items-center justify-between">
        <NavButton icon={<Home />} label="Home" active={activeScreen === 'home'} onClick={() => setActiveScreen('home')} />
        <NavButton icon={<Trophy />} label="Top" active={activeScreen === 'leaderboard'} onClick={() => setActiveScreen('leaderboard')} />
        <NavButton icon={<PlusCircle />} label="Add" active={activeScreen === 'upload'} onClick={() => setActiveScreen('upload')} />
        <NavButton icon={<VideoIcon />} label="Videos" active={activeScreen === 'videos'} onClick={() => setActiveScreen('videos')} />
        <NavButton icon={<MessageSquare />} label="Chat" active={activeScreen === 'chat'} onClick={() => setActiveScreen('chat')} />
      </nav>
    </div>
  );
}

// --- Sub-Screens & Components ---

const NavButton = ({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={cn(
      'flex flex-col items-center gap-1 transition-all',
      active ? 'text-blue-500 scale-110' : 'text-zinc-500 hover:text-zinc-300'
    )}
  >
    {React.cloneElement(icon as React.ReactElement, { className: 'w-6 h-6' } as any)}
    <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
  </button>
);

const ServerCard = ({ server, featured = false, user }: { server: Server; featured?: boolean; user: FirebaseUser | null }) => {
  const [copiedJava, setCopiedJava] = useState(false);
  const [copiedBedrock, setCopiedBedrock] = useState(false);
  const [copiedPort, setCopiedPort] = useState(false);
  const [voting, setVoting] = useState(false);

  const handleResetVotes = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || user.email !== 'rihadahmedsunny@gmail.com') return;
    
    if (!confirm(`Are you sure you want to reset votes for ${server.name}?`)) return;

    try {
      await updateDoc(doc(db, 'servers', server.id), {
        votes: 0
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `servers/${server.id}`));
      alert('Votes reset successfully!');
    } catch (err) {
      console.error('Reset error:', err);
    }
  };

  const copyJava = () => {
    navigator.clipboard.writeText(server.javaIp);
    setCopiedJava(true);
    setTimeout(() => setCopiedJava(false), 2000);
  };

  const copyBedrock = () => {
    if (server.bedrockIp) {
      navigator.clipboard.writeText(server.bedrockIp);
      setCopiedBedrock(true);
      setTimeout(() => setCopiedBedrock(false), 2000);
    }
  };

  const copyPort = () => {
    if (server.bedrockPort) {
      navigator.clipboard.writeText(server.bedrockPort.toString());
      setCopiedPort(true);
      setTimeout(() => setCopiedPort(false), 2000);
    }
  };

  const handleVote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      alert('Please login to vote!');
      return;
    }
    
    setVoting(true);
    try {
      // Check for daily vote limit (rolling 24 hours)
      const voteDocRef = doc(db, 'votes', user.uid);
      const voteDoc = await getDoc(voteDocRef).catch(err => handleFirestoreError(err, OperationType.GET, `votes/${user.uid}`));
      
      if (voteDoc && voteDoc.exists()) {
        const lastVote = voteDoc.data().timestamp?.toDate();
        if (lastVote) {
          const now = new Date();
          const diff = now.getTime() - lastVote.getTime();
          const hoursLeft = Math.ceil((24 * 60 * 60 * 1000 - diff) / (60 * 60 * 1000));
          
          if (diff < 24 * 60 * 60 * 1000) {
            alert(`You can only vote once every 24 hours! Please wait ${hoursLeft} more hour(s).`);
            setVoting(false);
            return;
          }
        }
      }

      await setDoc(doc(db, 'votes', user.uid), {
        userId: user.uid,
        serverId: server.id,
        timestamp: serverTimestamp()
      }).catch(err => handleFirestoreError(err, OperationType.WRITE, `votes/${user.uid}`));

      await updateDoc(doc(db, 'servers', server.id), {
        votes: increment(1)
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `servers/${server.id}`));
      
      alert('Vote cast successfully!');
    } catch (err) {
      console.error('Vote error:', err);
    } finally {
      setVoting(false);
    }
  };

  return (
    <Card glow={featured} className={cn('group relative', featured && 'border-blue-500/30 bg-gradient-to-br from-blue-950/20 to-black')}>
      {featured && (
        <div className="absolute top-0 right-0 p-4">
          <Crown className="w-6 h-6 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
        </div>
      )}
      
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
              {server.name}
              {server.isOfficial && <ShieldCheck className="w-4 h-4 text-blue-500" />}
            </h3>
            <div className="flex flex-wrap gap-1.5 mt-1">
              <span className="flex items-center gap-1 text-xs font-medium text-zinc-500 mr-1">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                {server.version}
              </span>
              {(Array.isArray(server.mode) ? server.mode : [server.mode]).map(m => (
                <span key={m} className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded-md text-[9px] font-bold uppercase tracking-wider">
                  {m}
                </span>
              ))}
            </div>
            {server.motd && (
              <p 
                className="text-[10px] font-bold uppercase tracking-widest mt-2 italic opacity-90"
                style={{ color: server.motdColor || '#60a5fa' }}
              >
                "{server.motd}"
              </p>
            )}
          </div>
          <div className="text-right flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              {user?.email === 'rihadahmedsunny@gmail.com' && (
                <button 
                  onClick={handleResetVotes}
                  className="p-1 text-zinc-600 hover:text-red-500 transition-colors"
                  title="Reset Votes"
                >
                  <RefreshCcw className="w-3 h-3" />
                </button>
              )}
              <div className="text-xl font-black text-blue-500">{formatNumber(server.votes)}</div>
            </div>
            <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Votes</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-black/50 border border-zinc-800 rounded-xl px-3 py-2 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Java IP</span>
                <code className="text-xs font-mono text-zinc-300 truncate">{server.javaIp}</code>
              </div>
              <button onClick={copyJava} className="text-zinc-500 hover:text-white transition-colors">
                {copiedJava ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
              {server.discordUrl && (
                <a 
                  href={server.discordUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="ml-2 p-1.5 bg-[#5865F2]/10 hover:bg-[#5865F2]/20 text-[#5865F2] rounded-lg transition-colors"
                  title="Join Discord"
                >
                  <MessageSquare className="w-4 h-4" />
                </a>
              )}
            </div>
            <Button 
              variant={featured ? 'gold' : 'primary'} 
              size="sm" 
              className="rounded-xl h-10"
              onClick={handleVote}
              disabled={voting}
            >
              {voting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <ThumbsUp className="w-4 h-4 mr-2" />
              )}
              Vote
            </Button>
          </div>

          {server.bedrockIp && (
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-black/50 border border-zinc-800 rounded-xl px-3 py-2 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Bedrock IP</span>
                  <code className="text-xs font-mono text-zinc-300 truncate">{server.bedrockIp}</code>
                </div>
                <button onClick={copyBedrock} className="text-zinc-500 hover:text-white transition-colors" title="Copy IP">
                  {copiedBedrock ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              {server.bedrockPort && (
                <div className="bg-black/50 border border-zinc-800 rounded-xl px-3 py-2 flex items-center justify-between min-w-[80px]">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Port</span>
                    <code className="text-xs font-mono text-zinc-300">{server.bedrockPort}</code>
                  </div>
                  <button onClick={copyPort} className="text-zinc-500 hover:text-white transition-colors ml-2" title="Copy Port">
                    {copiedPort ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {server.description && (
          <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
            {server.description}
          </p>
        )}
      </div>
    </Card>
  );
};

const Leaderboard = ({ servers }: { servers: Server[] }) => {
  const topServers = [...servers].sort((a, b) => b.votes - a.votes).slice(0, 10);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-3">
        <Trophy className="w-8 h-8 text-amber-500" />
        <div>
          <h2 className="text-xl font-black uppercase italic tracking-tighter">Global Leaderboard</h2>
          <p className="text-xs text-zinc-500 font-medium">Top 10 servers ranked by community votes</p>
        </div>
      </div>

      <div className="space-y-3">
        {topServers.map((server, index) => (
          <div 
            key={server.id}
            className={cn(
              "flex items-center gap-4 p-4 rounded-2xl border transition-all",
              index === 0 ? "bg-amber-500/10 border-amber-500/30" : 
              index === 1 ? "bg-zinc-400/10 border-zinc-400/30" :
              index === 2 ? "bg-amber-700/10 border-amber-700/30" :
              "bg-zinc-900/50 border-zinc-800"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm italic",
              index === 0 ? "bg-amber-500 text-black" : 
              index === 1 ? "bg-zinc-400 text-black" :
              index === 2 ? "bg-amber-700 text-white" :
              "bg-zinc-800 text-zinc-500"
            )}>
              {index + 1}
            </div>
            
            <div className="flex-1">
              <h3 className="font-bold text-sm flex items-center gap-2">
                {server.name}
                {server.isOfficial && <Crown className="w-3 h-3 text-amber-500" />}
              </h3>
              <p className="text-[10px] text-zinc-500 font-mono">{server.javaIp}</p>
            </div>

            <div className="text-right">
              <div className="text-sm font-black text-blue-500">{formatNumber(server.votes)}</div>
              <div className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Votes</div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

const GAME_MODES = [
  'Anarchy', 'Bedwars', 'BoxPvP', 'Build Battle', 'Cobblemon', 'Creative', 'Duels', 'Earth', 'Eggwars', 
  'Factions', 'FFA', 'Gens', 'Hardcore', 'Hide and Seek', 'KitPvP', 'Lifesteal', 'Minigames', 'Modded', 
  'Murder Mystery', 'OneBlock', 'Parkour', 'Pixelmon', 'Practice', 'Prison', 'PvP', 'Roleplay', 
  'Skyblock', 'Skywars', 'Slimefun', 'SMP', 'Speedrun', 'Survival', 'Survival Games', 'TNT Run', 
  'Towny', 'UHC', 'Vanilla'
];

const UploadScreen = ({ user, onComplete }: { user: FirebaseUser | null; onComplete: () => void }) => {
  const [formData, setFormData] = useState({
    name: '',
    javaIp: '',
    bedrockIp: '',
    bedrockPort: '',
    motd: '',
    motdColor: '#3b82f6',
    discordUrl: '',
    mode: [] as GameMode[],
    version: '1.20.x',
    description: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const toggleMode = (m: GameMode) => {
    setFormData(prev => {
      const isSelected = prev.mode.includes(m);
      if (isSelected) {
        return { ...prev, mode: prev.mode.filter(item => item !== m) };
      } else {
        if (prev.mode.length >= 5) return prev; // Limit to 5 modes
        return { ...prev, mode: [...prev.mode, m] };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return alert('Please login to add a server!');
    if (formData.mode.length === 0) return alert('Please select at least one game mode!');
    
    setSubmitting(true);
    try {
      const dataToSubmit = {
        ...formData,
        bedrockPort: formData.bedrockPort ? parseInt(formData.bedrockPort) : undefined,
        votes: 0,
        isOfficial: false,
        createdBy: user.uid,
        createdAt: serverTimestamp()
      };
      await addDoc(collection(db, 'servers'), dataToSubmit);
      onComplete();
    } catch (err) {
      console.error('Upload error:', err);
      handleFirestoreError(err, OperationType.CREATE, 'servers');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
        <div className="w-16 h-16 bg-zinc-900 rounded-3xl flex items-center justify-center border border-zinc-800">
          <LogIn className="w-8 h-8 text-zinc-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold">Login Required</h2>
          <p className="text-zinc-500 text-sm max-w-[240px]">You need to be logged in to submit your Minecraft server.</p>
        </div>
        <Button onClick={signInWithGoogle}>Sign in with Google</Button>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="space-y-1">
        <h2 className="text-2xl font-black tracking-tighter uppercase italic">Add Your Server</h2>
        <p className="text-sm text-zinc-500">Share your world with the CityKing community.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Server Name</label>
          <input 
            required
            type="text" 
            placeholder="e.g. Hypixel"
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Java IP</label>
          <input 
            required
            type="text" 
            placeholder="e.g. mc.hypixel.net"
            value={formData.javaIp}
            onChange={e => setFormData({...formData, javaIp: e.target.value})}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Bedrock IP (Optional)</label>
            <input 
              type="text" 
              placeholder="e.g. bedrock.hypixel.net"
              value={formData.bedrockIp}
              onChange={e => setFormData({...formData, bedrockIp: e.target.value})}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Bedrock Port</label>
            <input 
              type="number" 
              placeholder="19132"
              value={formData.bedrockPort}
              onChange={e => setFormData({...formData, bedrockPort: e.target.value})}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Server MOTD (Short Catchphrase)</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="e.g. The best SMP experience!"
              value={formData.motd}
              onChange={e => setFormData({...formData, motd: e.target.value})}
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              style={{ color: formData.motdColor }}
            />
            <div className="flex items-center gap-1.5 px-2 bg-zinc-900 border border-zinc-800 rounded-xl">
              {['#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4'].map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, motdColor: color })}
                  className={cn(
                    "w-5 h-5 rounded-full border-2 transition-transform hover:scale-110",
                    formData.motdColor === color ? "border-white scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Discord Invite Link (Optional)</label>
          <input 
            type="url" 
            placeholder="e.g. https://discord.gg/yourserver"
            value={formData.discordUrl}
            onChange={e => setFormData({...formData, discordUrl: e.target.value})}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Game Modes (Select up to 5)</label>
            <span className="text-[10px] font-bold text-blue-500">{formData.mode.length}/5</span>
          </div>
          <div className="flex flex-wrap gap-2 p-3 bg-zinc-900/50 border border-zinc-800 rounded-2xl max-h-48 overflow-y-auto custom-scrollbar">
            {GAME_MODES.map(m => {
              const gameMode = m as GameMode;
              const isSelected = formData.mode.includes(gameMode);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMode(gameMode)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border",
                    isSelected 
                      ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20" 
                      : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"
                  )}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Version</label>
          <input 
            required
            type="text" 
            placeholder="e.g. 1.20.x"
            value={formData.version}
            onChange={e => setFormData({...formData, version: e.target.value})}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Description</label>
          <textarea 
            placeholder="Tell us about your server..."
            rows={4}
            value={formData.description}
            onChange={e => setFormData({...formData, description: e.target.value})}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none"
          />
        </div>

        <Button type="submit" className="w-full py-4 text-base" disabled={submitting}>
          {submitting ? 'Uploading...' : 'Submit Server'}
        </Button>
      </form>
    </motion.div>
  );
};

const VideosScreen = ({ user, profile }: { user: FirebaseUser | null; profile: UserProfile | null }) => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [likedVideos, setLikedVideos] = useState<string[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'videos'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const videoData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Video));
      setVideos(videoData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'videos');
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user) {
      const q = query(collection(db, 'videoLikes'), where('userId', '==', user.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const likedIds = snapshot.docs.map(doc => doc.data().videoId);
        setLikedVideos(likedIds);
      });
      return unsubscribe;
    }
  }, [user]);

  const handleLike = async (videoId: string) => {
    if (!user) return alert('Please login to like videos!');
    
    const isLiked = likedVideos.includes(videoId);
    const likeId = `${user.uid}_${videoId}`;
    
    try {
      await runTransaction(db, async (transaction) => {
        const videoRef = doc(db, 'videos', videoId);
        const likeRef = doc(db, 'videoLikes', likeId);
        
        const videoDoc = await transaction.get(videoRef);
        if (!videoDoc.exists()) throw new Error("Video does not exist!");

        if (isLiked) {
          transaction.delete(likeRef);
          transaction.update(videoRef, { likes: increment(-1) });
        } else {
          transaction.set(likeRef, { userId: user.uid, videoId });
          transaction.update(videoRef, { likes: increment(1) });
        }
      });
    } catch (err) {
      console.error('Like error:', err);
      handleFirestoreError(err, OperationType.UPDATE, `videos/${videoId}`);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="space-y-6 pb-12"
    >
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-black tracking-tighter uppercase italic flex items-center gap-2">
            <VideoIcon className="w-8 h-8 text-blue-500" />
            Video Hub
          </h2>
          <p className="text-sm text-zinc-500 font-medium">Community highlights and trailers.</p>
        </div>
        <Button size="sm" onClick={() => setShowUpload(true)}>
          <PlusCircle className="w-4 h-4 mr-2" />
          Upload
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm font-medium">Loading videos...</p>
        </div>
      ) : videos.length > 0 ? (
        <div className="grid grid-cols-1 gap-6">
          {videos.map(video => (
            <Card key={video.id} className="overflow-hidden group">
              <div className="relative aspect-video bg-zinc-900 flex items-center justify-center">
                {video.thumbnailUrl ? (
                  <img 
                    src={video.thumbnailUrl} 
                    alt={video.title} 
                    className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <VideoIcon className="w-12 h-12 text-zinc-800" />
                )}
                <a 
                  href={video.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-2xl shadow-blue-900/40 transform group-hover:scale-110 transition-transform">
                    <Play className="w-8 h-8 text-white fill-white ml-1" />
                  </div>
                </a>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="font-bold text-lg leading-tight">{video.title}</h3>
                    <p className="text-xs text-zinc-500 font-medium flex items-center gap-1">
                      by <span className="text-zinc-300 font-bold">{video.authorName}</span>
                    </p>
                  </div>
                  <button 
                    onClick={() => handleLike(video.id)}
                    className={cn(
                      "flex flex-col items-center gap-1 transition-colors",
                      likedVideos.includes(video.id) ? "text-red-500" : "text-zinc-500 hover:text-white"
                    )}
                  >
                    <Heart className={cn("w-6 h-6", likedVideos.includes(video.id) && "fill-current")} />
                    <span className="text-[10px] font-black">{formatNumber(video.likes)}</span>
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-zinc-900/50 rounded-3xl border border-dashed border-zinc-800 space-y-4">
          <VideoIcon className="w-12 h-12 text-zinc-800 mx-auto" />
          <div className="space-y-1">
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">No videos yet</p>
            <p className="text-zinc-600 text-[10px]">Be the first to share a highlight!</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowUpload(true)}>Upload Now</Button>
        </div>
      )}

      {showUpload && (
        <VideoUploadModal 
          user={user} 
          profile={profile} 
          onClose={() => setShowUpload(false)} 
        />
      )}
    </motion.div>
  );
};

const VideoUploadModal = ({ user, profile, onClose }: { user: FirebaseUser | null; profile: UserProfile | null; onClose: () => void }) => {
  const [formData, setFormData] = useState({
    title: '',
    url: '',
    thumbnailUrl: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return alert('Please login to upload!');
    
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'videos'), {
        ...formData,
        likes: 0,
        createdBy: user.uid,
        authorName: profile.displayName,
        createdAt: serverTimestamp()
      });
      alert('Video uploaded successfully!');
      onClose();
    } catch (err) {
      console.error('Upload error:', err);
      handleFirestoreError(err, OperationType.CREATE, 'videos');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <Card className="w-full max-w-md p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-zinc-900 rounded-3xl flex items-center justify-center border border-zinc-800 mx-auto">
            <LogIn className="w-8 h-8 text-zinc-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold">Login Required</h2>
            <p className="text-zinc-500 text-sm">You need to be logged in to upload videos.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={signInWithGoogle}>Sign in</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-xl">
              <VideoIcon className="w-5 h-5 text-blue-500" />
            </div>
            <h2 className="text-xl font-black uppercase italic tracking-tighter">Upload Video</h2>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Video Title</label>
              <input 
                required
                type="text" 
                maxLength={100}
                placeholder="e.g. Epic Factions Raid"
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Video URL</label>
              <input 
                required
                type="url" 
                placeholder="YouTube, Vimeo, etc."
                value={formData.url}
                onChange={e => setFormData({...formData, url: e.target.value})}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Thumbnail URL (Optional)</label>
              <input 
                type="url" 
                placeholder="https://example.com/thumb.jpg"
                value={formData.thumbnailUrl}
                onChange={e => setFormData({...formData, thumbnailUrl: e.target.value})}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? 'Uploading...' : 'Share Video'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const ChatScreen = ({ user }: { user: FirebaseUser | null }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'chat'), orderBy('timestamp', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage)).reverse();
      setMessages(msgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'chat');
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newMessage.trim()) return;

    const text = newMessage.trim();
    setNewMessage('');
    
    try {
      await addDoc(collection(db, 'chat'), {
        userId: user.uid,
        userName: user.displayName || 'Gamer',
        text,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.error('Chat error:', err);
      handleFirestoreError(err, OperationType.CREATE, 'chat');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-[calc(100vh-12rem)]"
    >
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
        {messages.map((msg) => (
          <div key={msg.id} className={cn("flex flex-col", msg.userId === user?.uid ? "items-end" : "items-start")}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{msg.userName}</span>
            </div>
            <div className={cn(
              "px-4 py-2 rounded-2xl text-sm max-w-[80%]",
              msg.userId === user?.uid ? "bg-blue-600 text-white rounded-tr-none" : "bg-zinc-900 text-zinc-200 rounded-tl-none border border-zinc-800"
            )}>
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      <form onSubmit={sendMessage} className="mt-4 flex gap-2">
        <input 
          type="text" 
          placeholder={user ? "Type a message..." : "Login to chat"}
          disabled={!user}
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
        />
        <Button type="submit" size="icon" disabled={!user || !newMessage.trim()} className="w-12 h-12">
          <Send className="w-5 h-5" />
        </Button>
      </form>
    </motion.div>
  );
};

const EditProfileModal = ({ profile, onClose }: { profile: UserProfile; onClose: () => void }) => {
  const [formData, setFormData] = useState({
    displayName: profile.displayName,
    photoURL: profile.photoURL || ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.displayName.trim()) return alert('Display name cannot be empty!');
    
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        displayName: formData.displayName.trim(),
        photoURL: formData.photoURL.trim() || null
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`));
      alert('Profile updated successfully!');
      onClose();
    } catch (err) {
      console.error('Update error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-xl">
              <User className="w-5 h-5 text-blue-500" />
            </div>
            <h2 className="text-xl font-black uppercase italic tracking-tighter">Edit Profile</h2>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Display Name</label>
              <input 
                required
                type="text" 
                value={formData.displayName}
                onChange={e => setFormData({...formData, displayName: e.target.value})}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Your display name"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Avatar URL (Optional)</label>
              <input 
                type="url" 
                value={formData.photoURL}
                onChange={e => setFormData({...formData, photoURL: e.target.value})}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="https://example.com/avatar.png"
              />
              <p className="text-[10px] text-zinc-600 ml-1">Leave empty to use default avatar.</p>
            </div>
          </div>

          <div className="flex gap-4">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const ProfileScreen = ({ user, profile, onLogout, onNavigate }: { user: FirebaseUser | null; profile: UserProfile | null; onLogout: () => void; onNavigate: (screen: AppScreen) => void }) => {
  const [isEditing, setIsEditing] = useState(false);
  if (!user || !profile) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="space-y-8"
    >
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="relative">
          <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-blue-600 to-amber-500">
            <img 
              src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
              className="w-full h-full rounded-full border-4 border-black object-cover" 
              alt="Avatar" 
            />
          </div>
          {profile.role === 'admin' && (
            <div className="absolute -bottom-1 -right-1 bg-amber-500 text-black p-1.5 rounded-full shadow-lg">
              <ShieldCheck className="w-4 h-4" />
            </div>
          )}
        </div>
        
        <div>
          <h2 className="text-2xl font-black tracking-tighter uppercase italic">{profile.displayName}</h2>
          <p className="text-zinc-500 text-sm">{profile.email}</p>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <Badge variant={profile.role === 'admin' ? 'gold' : 'blue'}>
            {profile.role.toUpperCase()}
          </Badge>
          <Badge variant="default">LEVEL 1</Badge>
          <a 
            href="https://discord.gg/GuHjbRS3vN" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-[#5865F2]/10 text-[#5865F2] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-[#5865F2]/20 hover:bg-[#5865F2]/20 transition-colors"
          >
            <MessageSquare className="w-3 h-3" />
            Discord
          </a>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Account Actions</h3>
        <Card className="divide-y divide-zinc-800">
          {profile.role === 'admin' && (
            <button 
              onClick={() => onNavigate('admin')}
              className="w-full px-4 py-4 flex items-center justify-between hover:bg-amber-500/10 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard className="w-5 h-5 text-amber-500" />
                <span className="text-sm font-medium text-amber-500">Owner Panel</span>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-500" />
            </button>
          )}
          <button 
            onClick={() => setIsEditing(true)}
            className="w-full px-4 py-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-zinc-400" />
              <span className="text-sm font-medium">Edit Profile</span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-600" />
          </button>
          <button className="w-full px-4 py-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-zinc-400" />
              <span className="text-sm font-medium">Security Settings</span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-600" />
          </button>
          <button 
            onClick={() => { logout(); onLogout(); }}
            className="w-full px-4 py-4 flex items-center justify-between hover:bg-red-500/10 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <LogOut className="w-5 h-5 text-red-500" />
              <span className="text-sm font-medium text-red-500">Logout</span>
            </div>
          </button>
        </Card>
      </div>

      {isEditing && (
        <EditProfileModal 
          profile={profile} 
          onClose={() => setIsEditing(false)} 
        />
      )}
    </motion.div>
  );
};

const EditServerModal = ({ server, onClose }: { server: Server; onClose: () => void }) => {
  const [formData, setFormData] = useState({
    name: server.name,
    javaIp: server.javaIp,
    bedrockIp: server.bedrockIp || '',
    bedrockPort: server.bedrockPort?.toString() || '',
    motd: server.motd || '',
    motdColor: server.motdColor || '#3b82f6',
    discordUrl: server.discordUrl || '',
    mode: server.mode || [] as GameMode[],
    version: server.version,
    description: server.description || '',
    isOfficial: server.isOfficial || false
  });
  const [submitting, setSubmitting] = useState(false);

  const toggleMode = (m: GameMode) => {
    setFormData(prev => {
      const isSelected = prev.mode.includes(m);
      if (isSelected) {
        return { ...prev, mode: prev.mode.filter(item => item !== m) };
      } else {
        if (prev.mode.length >= 5) return prev;
        return { ...prev, mode: [...prev.mode, m] };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const dataToUpdate = {
        ...formData,
        bedrockPort: formData.bedrockPort ? parseInt(formData.bedrockPort) : null,
      };
      await updateDoc(doc(db, 'servers', server.id), dataToUpdate).catch(err => handleFirestoreError(err, OperationType.UPDATE, `servers/${server.id}`));
      alert('Server updated successfully!');
      onClose();
    } catch (err) {
      console.error('Update error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-xl">
              <Settings className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase italic tracking-tighter">Edit Server</h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{server.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Server Name</label>
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Java IP</label>
                <input 
                  required
                  type="text" 
                  value={formData.javaIp}
                  onChange={e => setFormData({...formData, javaIp: e.target.value})}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Bedrock IP</label>
                  <input 
                    type="text" 
                    value={formData.bedrockIp}
                    onChange={e => setFormData({...formData, bedrockIp: e.target.value})}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Port</label>
                  <input 
                    type="number" 
                    value={formData.bedrockPort}
                    onChange={e => setFormData({...formData, bedrockPort: e.target.value})}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Version</label>
                <input 
                  required
                  type="text" 
                  value={formData.version}
                  onChange={e => setFormData({...formData, version: e.target.value})}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-3 p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
                <input 
                  type="checkbox"
                  id="isOfficial"
                  checked={formData.isOfficial}
                  onChange={e => setFormData({...formData, isOfficial: e.target.checked})}
                  className="w-5 h-5 rounded border-zinc-800 bg-zinc-900 text-blue-500 focus:ring-blue-500"
                />
                <label htmlFor="isOfficial" className="text-sm font-bold text-zinc-300 cursor-pointer">Official Server Status</label>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">MOTD</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={formData.motd}
                    onChange={e => setFormData({...formData, motd: e.target.value})}
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    style={{ color: formData.motdColor }}
                  />
                  <input 
                    type="color"
                    value={formData.motdColor}
                    onChange={e => setFormData({...formData, motdColor: e.target.value})}
                    className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-xl p-1 cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Discord URL</label>
                <input 
                  type="url" 
                  value={formData.discordUrl}
                  onChange={e => setFormData({...formData, discordUrl: e.target.value})}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Description</label>
                <textarea 
                  rows={4}
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Game Modes</label>
            <div className="flex flex-wrap gap-2 p-3 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
              {GAME_MODES.map(m => {
                const gameMode = m as GameMode;
                const isSelected = formData.mode.includes(gameMode);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleMode(gameMode)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border",
                      isSelected 
                        ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20" 
                        : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"
                    )}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const AdminPanel = ({ servers, user }: { servers: Server[]; user: FirebaseUser | null }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingServer, setEditingServer] = useState<Server | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'users'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(userData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });
    return unsubscribe;
  }, []);

  const totalVotes = servers.reduce((acc, s) => acc + s.votes, 0);

  const deleteServer = async (id: string) => {
    if (!confirm('Are you sure you want to delete this server?')) return;
    try {
      await deleteDoc(doc(db, 'servers', id)).catch(err => handleFirestoreError(err, OperationType.DELETE, `servers/${id}`));
      alert('Server deleted successfully!');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8 pb-12"
    >
      <div className="space-y-2">
        <h2 className="text-2xl font-black tracking-tighter uppercase italic flex items-center gap-2">
          <ShieldCheck className="w-8 h-8 text-amber-500" />
          Owner Panel
        </h2>
        <p className="text-zinc-500 text-sm font-medium">Manage your network and community.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 bg-blue-600/10 border-blue-500/20">
          <div className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-1">Total Servers</div>
          <div className="text-2xl font-black text-white">{servers.length}</div>
        </Card>
        <Card className="p-4 bg-amber-500/10 border-amber-500/20">
          <div className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">Total Votes</div>
          <div className="text-2xl font-black text-white">{formatNumber(totalVotes)}</div>
        </Card>
      </div>

      {/* Server Management */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Server Management</h3>
          <Badge variant="default">{servers.length}</Badge>
        </div>
        <Card className="divide-y divide-zinc-800">
          {servers.map(server => (
            <div key={server.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center font-black text-zinc-500">
                  {server.name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-bold flex items-center gap-1">
                    {server.name}
                    {server.isOfficial && <ShieldCheck className="w-3 h-3 text-blue-500" />}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono">{server.javaIp}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right mr-2">
                  <div className="text-sm font-black text-blue-500">{formatNumber(server.votes)}</div>
                  <div className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Votes</div>
                </div>
                <button 
                  onClick={() => deleteServer(server.id)}
                  className="p-2 text-zinc-500 hover:text-red-500 transition-colors"
                  title="Delete Server"
                >
                  <X className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setEditingServer(server)}
                  className="p-2 text-zinc-500 hover:text-white transition-colors"
                  title="Edit Server"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </Card>
      </div>

      {editingServer && (
        <EditServerModal 
          server={editingServer} 
          onClose={() => setEditingServer(null)} 
        />
      )}

      {/* User Management */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Recent Users</h3>
          <Badge variant="default">{users.length}</Badge>
        </div>
        <Card className="divide-y divide-zinc-800">
          {loading ? (
            <div className="p-8 text-center text-zinc-500 text-sm">Loading users...</div>
          ) : users.map(u => (
            <div key={u.uid} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} className="w-8 h-8 rounded-full" alt="User" />
                <div>
                  <div className="text-sm font-bold">{u.displayName}</div>
                  <div className="text-[10px] text-zinc-500">{u.email}</div>
                </div>
              </div>
              <Badge variant={u.role === 'admin' ? 'gold' : 'default'}>
                {u.role.toUpperCase()}
              </Badge>
            </div>
          ))}
        </Card>
      </div>
    </motion.div>
  );
};
