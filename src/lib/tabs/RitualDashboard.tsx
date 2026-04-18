import React, { useState, useRef, useEffect } from "react";
import { useSYNK, Memory, Goal, GoalType } from "../Store";
import ThreeBackground from "../ThreeBackground";
import { motion, AnimatePresence, useMotionValue, useTransform } from "motion/react";
import { cn } from "../utils";
import { 
  Layout, 
  Notebook, 
  Users, 
  Activity, 
  ExternalLink, 
  Image as ImageIcon, 
  Plus, 
  Trash2, 
  Box, 
  X,
  ChevronLeft,
  ChevronRight,
  Tag,
  Check
} from "lucide-react";

export default function RitualDashboard() {
  const { 
    stats, completionRate, goals, bias, setBias, roomAtmosphere,
    decorations, addDecoration, removeDecoration, memories, completeGoal
  } = useSYNK();

  // Replicate metadata storage to match GoalVault
  const [dateById] = useLocalStorageState<Record<string, string>>("synkify.dateById", {});
  const [scheduleById] = useLocalStorageState<Record<string, string>>("synkify.scheduleById", {});
  const [priorityById] = useLocalStorageState<Record<string, string>>("synkify.priorityById", {});

  const [showDesigner, setShowDesigner] = useState(false);
  const [focusedMemory, setFocusedMemory] = useState<Memory | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isPressing, setIsPressing] = useState<string | null>(null);

  const handlePointerDown = (memory: Memory) => {
    setIsPressing(memory.id);
    longPressTimerRef.current = setTimeout(() => {
      setFocusedMemory(memory);
      setIsPressing(null);
    }, 600);
  };

  const handlePointerUp = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    setIsPressing(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.src = reader.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 400;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          addDecoration(compressedDataUrl, 'image');
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const activeGoals = React.useMemo(() => {
    const priorityMap: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return [...goals]
      .filter(g => !g.completed)
      .sort((a, b) => {
        const pA = priorityMap[priorityById[a.id] || "medium"];
        const pB = priorityMap[priorityById[b.id] || "medium"];
        if (pA !== pB) return pA - pB;
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      })
      .slice(0, 5);
  }, [goals, priorityById]);

  return (
    <div className="w-full h-full flex flex-col p-6 lg:p-10 pb-32 overflow-y-auto custom-scrollbar overflow-x-hidden bg-white text-zinc-900">
      <div className="max-w-6xl mx-auto w-full flex flex-col gap-10">
        
        {/* Minimalist Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-zinc-100 pb-8">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-extrabold tracking-tighter">Home</h1>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Ritual Sync Center</p>
          </div>
          
          <div className="flex gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Resonance</span>
              <span className="text-xl font-bold">{Math.round(completionRate * 100)}%</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Status</span>
              <span className="text-xl font-bold">OPTIMIZED</span>
            </div>
          </div>
        </header>

        {/* Minimalist Room View */}
        <section className="minimal-card p-6 md:p-8 relative flex flex-col items-center justify-center min-h-[400px] overflow-hidden group">
          <div className="absolute inset-0 bg-zinc-50/50 pointer-events-none" />
          
          {/* Decorations Layer */}
          <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden select-none">
            <AnimatePresence>
              {memories.map((memory, index) => {
                const x = (index * 23) % 80 + 10;
                const y = (index * 37) % 60 + 20;
                const scale = 0.6 + ((index * 0.1) % 0.3);
                return (
                  <motion.div
                    key={memory.id}
                    drag
                    onPointerDown={() => handlePointerDown(memory)}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ 
                      opacity: 1, 
                      scale: isPressing === memory.id ? scale * 1.1 : scale,
                      y: [0, -10, 0],
                    }}
                    transition={{
                      opacity: { duration: 1 },
                      y: { duration: 8 + (index % 5), repeat: Infinity, ease: "easeInOut" }
                    }}
                    style={{ left: `${x}%`, top: `${y}%`, position: 'absolute' }}
                    className="group pointer-events-auto cursor-grab active:cursor-grabbing"
                  >
                    <div className="bg-white p-1 rounded-lg shadow-sm border border-zinc-200 w-24 h-32 flex flex-col gap-1 transition-all group-hover:shadow-md">
                      <div className="flex-1 w-full bg-zinc-100 rounded-md overflow-hidden relative">
                        {memory.media[0]?.type === 'image' && (
                          <img src={memory.media[0].url} className="w-full h-full object-cover transition-all duration-500" referrerPolicy="no-referrer" />
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {decorations.map((dec) => (
                <motion.div
                  key={dec.id}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: dec.scale, y: [0, -20, 0] }}
                  transition={{
                    opacity: { duration: 0.5 },
                    y: { duration: 6 + Math.random() * 2, repeat: Infinity, ease: "easeInOut" }
                  }}
                  style={{ left: `${dec.x}%`, top: `${dec.y}%`, position: 'absolute' }}
                  className="group pointer-events-auto cursor-grab"
                >
                  {dec.type === 'image' ? (
                    <div className="p-1 bg-white border border-zinc-200 shadow-sm rounded-lg group-hover:scale-110 transition-transform">
                      <img src={dec.image} className="w-20 md:w-28 h-auto rounded-md" referrerPolicy="no-referrer" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center text-white scale-75 group-hover:scale-100 transition-transform shadow-md">
                      <Box className="w-4 h-4" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="absolute inset-0 z-0 overflow-hidden opacity-50 contrast-[0.8] grayscale">
            <ThreeBackground completionRate={completionRate} />
          </div>
          
          <div className="absolute top-6 left-6 z-20 pointer-events-none">
            <span className="text-sm font-bold tracking-tight text-zinc-800">
              Agent resonance actively syncing...
            </span>
          </div>
          
          <button 
            onClick={() => setShowDesigner(true)}
            className="absolute bottom-6 right-6 z-20 px-4 py-1.5 bg-white border border-zinc-200 rounded-full text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:bg-zinc-50 transition-all shadow-sm"
          >
            Spatial Config
          </button>
        </section>

        {/* Focused Memory Modal */}
        <AnimatePresence>
          {focusedMemory && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setFocusedMemory(null)} className="absolute inset-0 bg-white/80 backdrop-blur-sm" />
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative z-10 w-full max-w-sm pointer-events-none">
                <div className="pointer-events-auto bg-white border border-zinc-200 rounded-3xl p-4 shadow-2xl flex flex-col gap-4">
                  <div className="aspect-[4/5] w-full bg-zinc-100 rounded-2xl overflow-hidden">
                    {focusedMemory.media[0]?.type === 'image' ? (
                      <img src={focusedMemory.media[0].url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <video src={focusedMemory.media[0]?.url} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold uppercase text-zinc-400 tracking-wider">Reference Log</span>
                    <p className="text-sm font-medium leading-relaxed italic text-zinc-800">"{focusedMemory.caption || "resonance_captured"}"</p>
                  </div>
                  <button onClick={() => setFocusedMemory(null)} className="minimal-button w-full mt-2">Close</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
          {/* Minimalist Cards */}
          <div className="minimal-card p-6 flex flex-col gap-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-100 pb-2">Directives</h4>
            <div className="flex flex-col gap-2">
              {activeGoals.map(g => (
                <CompactDirectiveRow 
                  key={g.id} 
                  goal={g} 
                  onComplete={() => completeGoal(g.id)}
                  scheduledDate={dateById[g.id] || ""}
                  scheduledTime={scheduleById[g.id] || "09:00:00"}
                />
              ))}
              {activeGoals.length === 0 && <span className="text-xs text-zinc-300 italic">No active protocols.</span>}
            </div>
          </div>

          <div className="minimal-card p-6 flex flex-col gap-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-100 pb-2">Analytics</h4>
            <div className="flex items-end gap-1.5 h-20">
              {[0.4, 0.7, 0.5, 0.8, 0.3, 0.6, 0.9, 0.5, 0.8, 0.4].map((h, i) => (
                <div key={i} className="flex-1 bg-zinc-100 rounded-sm hover:bg-zinc-200 transition-colors" style={{ height: `${h * 100}%` }} />
              ))}
            </div>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-auto">Sync Status: Optimal</p>
          </div>

          <div className="minimal-card p-6 flex flex-col gap-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-100 pb-2">Resonance Member</h4>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full overflow-hidden border border-zinc-100">
                <img src={`https://picsum.photos/seed/${bias}/100/100`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold uppercase tracking-wider">{bias === 'None' ? 'Default' : bias}</span>
                <span className="text-[10px] text-zinc-400 font-bold uppercase">Linked</span>
              </div>
            </div>
          </div>
        </div>

        {/* Spatial Designer Modal */}
        <AnimatePresence>
          {showDesigner && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDesigner(false)} className="fixed inset-0 bg-white/60 backdrop-blur-sm z-[100]" />
              <motion.div initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }} className="fixed top-0 right-0 w-full max-w-sm h-full bg-white border-l border-zinc-200 z-[110] flex flex-col p-10 overflow-y-auto">
                <header className="mb-10">
                  <h3 className="text-xl font-bold tracking-tight">Spatial Config</h3>
                  <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest mt-1">Universe Editor</p>
                </header>
                <div className="flex flex-col gap-8 flex-1">
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex flex-col items-center justify-center aspect-video border border-zinc-100 rounded-xl hover:bg-zinc-50 cursor-pointer">
                      <ImageIcon className="w-5 h-5 text-zinc-300" />
                      <span className="text-[10px] font-bold uppercase tracking-widest mt-2">Shard</span>
                      <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                    </label>
                    <button onClick={() => addDecoration('', 'crystal')} className="flex flex-col items-center justify-center aspect-video border border-zinc-100 rounded-xl hover:bg-zinc-50">
                      <Box className="w-5 h-5 text-zinc-300" />
                      <span className="text-[10px] font-bold uppercase tracking-widest mt-2">Aura</span>
                    </button>
                  </div>
                  <div className="flex flex-col gap-4">
                    <h4 className="text-[10px] font-bold uppercase text-zinc-300 border-b border-zinc-50 pb-2">Active Artifacts</h4>
                    <div className="flex flex-col gap-3">
                      {decorations.map((dec) => (
                        <div key={dec.id} className="flex items-center gap-4 bg-zinc-50/50 p-2 rounded-xl">
                          <div className="w-10 h-10 rounded-lg overflow-hidden border border-zinc-100">
                            {dec.type === 'image' && <img src={dec.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                          </div>
                          <span className="text-xs font-bold text-zinc-500 uppercase flex-1">{dec.type} shard</span>
                          <button onClick={() => removeDecoration(dec.id)} className="text-zinc-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowDesigner(false)} className="minimal-button w-full mt-10">Close Editor</button>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Bias Selection Integrated */}
        <section className="minimal-card p-10 flex flex-col gap-10">
          <header>
            <h4 className="text-sm font-bold uppercase tracking-widest">Resonance Selection</h4>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Link your consciousness</p>
          </header>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-8 place-items-center">
            {(['None', 'Karina', 'Winter', 'Giselle', 'Ningning'] as const).map(m => (
              <button key={m} onClick={() => setBias(m)} className="flex flex-col items-center gap-4 group">
                <div className={cn("w-16 h-16 rounded-full border p-1 transition-all", bias === m ? "border-black" : "border-zinc-100 hover:border-zinc-300")}>
                  <img src={`https://picsum.photos/seed/${m === 'None' ? 'group' : m}/100/100`} className={cn("w-full h-full rounded-full transition-all")} referrerPolicy="no-referrer" />
                </div>
                <span className={cn("text-[10px] font-bold uppercase tracking-widest", bias === m ? "text-black" : "text-zinc-300")}>{m === 'None' ? 'Default' : m}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function CompactDirectiveRow({ 
  goal, 
  onComplete, 
  scheduledDate, 
  scheduledTime 
}: { 
  goal: Goal, 
  onComplete: () => void,
  scheduledDate: string,
  scheduledTime: string,
  key?: string
}) {
  const swipeX = useMotionValue(0);
  const swipeBg = useTransform(swipeX, [0, 80], ["rgba(0,0,0,0)", "rgba(34, 197, 94, 0.1)"]);
  const successOpacity = useTransform(swipeX, [20, 80], [0, 1]);
  const iconScale = useTransform(swipeX, [0, 60], [0.5, 1.2]);
  const iconRotate = useTransform(swipeX, [0, 80], [-45, 0]);
  const hintOpacity = useTransform(swipeX, [0, 40], [1, 0]);

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > 80 && !goal.completed) {
      onComplete();
    }
    swipeX.set(0);
  };

  const goalTypeMeta = {
    pulse: { label: "PULSE", color: "text-zinc-400 bg-white" },
    orbit: { label: "ORBIT", color: "text-zinc-600 bg-white" },
    galaxy: { label: "GALAXY", color: "text-black bg-white" }
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-50 shadow-sm">
      <motion.div
        drag={goal.completed ? false : "x"}
        dragConstraints={{ left: 0, right: 120 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x: swipeX, backgroundColor: swipeBg }}
        className={cn(
          "bg-white px-3 py-2 flex items-center gap-3 relative z-10 cursor-grab active:cursor-grabbing transition-opacity",
          goal.completed && "opacity-40"
        )}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-zinc-100 shrink-0" />

        <div className={cn(
          "px-1 py-0.5 rounded text-[7px] font-black uppercase tracking-widest shrink-0 border border-zinc-50",
          goalTypeMeta[goal.type as GoalType]?.color
        )}>
          {goal.type}
        </div>

        <div className="flex-1 min-w-0">
          <p className={cn("text-[11px] font-bold text-zinc-800 truncate leading-tight", goal.completed && "line-through")}>
            {goal.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {scheduledDate && (
              <span className="text-[7px] font-bold text-zinc-400 uppercase tracking-tighter">
                {new Date(scheduledDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            )}
            {scheduledTime && (
              <span className="text-[7px] font-bold text-zinc-400 uppercase tracking-tighter">
                {scheduledTime.slice(0, 5)}
              </span>
            )}
          </div>
        </div>

        {/* Swipe Hint */}
        {!goal.completed && (
          <motion.div style={{ opacity: hintOpacity }} className="flex items-center gap-0.5 opacity-20 pointer-events-none transition-opacity">
            <span className="text-[6px] font-black tracking-widest text-zinc-300 uppercase">SWIPE</span>
            <ChevronRight className="w-2.5 h-2.5 text-zinc-100" />
          </motion.div>
        )}
      </motion.div>

      {/* Swipe Success Background */}
      <motion.div 
        style={{ opacity: successOpacity }}
        className="absolute inset-0 bg-green-50/50 flex items-center px-4 pointer-events-none"
      >
        <motion.div style={{ scale: iconScale, rotate: iconRotate }} className="mr-2">
          <Check className="w-4 h-4 text-green-600" />
        </motion.div>
        <span className="text-[8px] font-black text-green-600 uppercase tracking-[0.3em]">COMPLETE &gt;&gt;</span>
      </motion.div>
    </div>
  );
}

function useLocalStorageState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue] as const;
}

