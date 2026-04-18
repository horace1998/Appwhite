import { motion, AnimatePresence } from "motion/react";
import React, { useEffect, useState } from "react";
import { Fingerprint, Sparkles, Loader2, ChevronRight } from "lucide-react";
import { cn } from "./utils";
import { auth, db, OperationType, handleFirestoreError, signInAnonymously, GoogleAuthProvider, signInWithPopup } from "../firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { useSYNK, MemberBias } from "./Store";

const ONBOARDING_QUESTIONS = [
  {
    id: "bias",
    question: "選擇你的共鳴導師",
    sub: "WHO WILL GUIDE YOUR AURA REFINEMENT?",
    options: [
      { label: "KARINA / 核心視覺", value: "Karina", color: "bg-blue-600" },
      { label: "WINTER / 系統動力", value: "Winter", color: "bg-cyan-400" },
      { label: "GISELLE / 數位語境", value: "Giselle", color: "bg-synk-pink" },
      { label: "NINGNING / 藝術編碼", value: "Ningning", color: "bg-purple-600" }
    ]
  },
  {
    id: "directive",
    question: "啟動主導協定",
    sub: "WHICH SYSTEM MODULE IS YOUR MISSION PRIORITY?",
    options: [
      { label: "TASK_DIRECTIVE / 目標歸檔", value: "Vault", color: "bg-zinc-900" },
      { label: "RITUAL_SYNC / 共鳴儀式", value: "Dashboard", color: "bg-zinc-400" },
      { label: "ORACLE_STREAM / 數位神諭", value: "Oracle", color: "bg-zinc-100" }
    ]
  },
  {
    id: "frequency",
    question: "識別共鳴頻率",
    sub: "CALIBRATE THE COLOR SPACE OF YOUR PORTAL.",
    options: [
      { label: "NEON_CYAN / 數位頻率", value: "Electric", color: "bg-black" },
      { label: "MINIMAL_ZINC / 極簡頻率", value: "Minimal", color: "bg-zinc-500" },
      { label: "LAVENDER_ETHER / 以太頻率", value: "Aurora", color: "bg-zinc-200" },
      { label: "DEEP_MAGENTA / 深層頻率", value: "Ether", color: "bg-zinc-800" }
    ]
  },
  {
    id: "atmosphere",
    question: "選擇同步環境",
    sub: "DETERMINE THE STABILIZATION DEPTH.",
    options: [
      { label: "STANDARD / 標準同步", value: "Standard", color: "bg-zinc-100" },
      { label: "NEON / 增強同步", value: "Neon", color: "bg-zinc-200" },
      { label: "VOID / 深度虛空", value: "Void", color: "bg-zinc-900" },
      { label: "DREAM / 夢境過濾", value: "Dream", color: "bg-zinc-50" }
    ]
  }
];

const WelcomeScreen: React.FC<{ onComplete?: () => void }> = ({ onComplete }) => {
  const { user, loading: authLoading, hasProfile } = useSYNK();
  const [phase, setPhase] = useState<"intro" | "pact" | "questions" | "auth" | "loading" | "success">("intro");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<{ bias: MemberBias | null, atmosphere: string | null, directive: string | null, frequency: string | null }>({
    bias: null,
    atmosphere: null,
    directive: null,
    frequency: null
  });
  const [tempSelection, setTempSelection] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isHolding) {
      interval = setInterval(() => {
        setHoldProgress(prev => {
          if (prev >= 100) {
            handleStartOnboarding();
            setIsHolding(false);
            return 100;
          }
          return prev + 1.25; // Completes 100% in 1200ms (1.2s) at 15ms interval
        });
      }, 15);
    } else {
      setHoldProgress(0);
    }
    return () => clearInterval(interval);
  }, [isHolding]);

  useEffect(() => {
    if (user && phase === "auth") {
      handleFinalizeProfile();
    }
  }, [user, phase]);

  const handleStartOnboarding = () => {
    setPhase("pact");
  };

  const handleAcceptPact = () => {
    if (user && hasProfile) {
      handleFinalizeProfile();
    } else {
      setPhase("questions");
    }
  };

  const handleAnswerClick = (value: string) => {
    setTempSelection(value);
  };

  const handleNextStep = () => {
    if (!tempSelection) return;
    
    const currentId = ONBOARDING_QUESTIONS[currentQuestion].id;
    const updatedAnswers = { ...answers, [currentId]: tempSelection };
    setAnswers(updatedAnswers);

    if (currentQuestion < ONBOARDING_QUESTIONS.length - 1) {
      const nextQuestion = currentQuestion + 1;
      const nextId = ONBOARDING_QUESTIONS[nextQuestion].id;
      setCurrentQuestion(nextQuestion);
      // Pre-set temp selection if user is moving back and forth
      setTempSelection((updatedAnswers as any)[nextId] || null);
    } else {
      setPhase("auth");
    }
  };

  const handlePrevStep = () => {
    if (currentQuestion > 0) {
      const prevQuestion = currentQuestion - 1;
      const prevId = ONBOARDING_QUESTIONS[prevQuestion].id;
      setCurrentQuestion(prevQuestion);
      setTempSelection((answers as any)[prevId] || null);
    } else {
      setPhase("pact");
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Google Auth error:", err);
      setLoading(false);
      if (err.code === 'auth/popup-closed-by-user') {
        // Silently handle
      } else if (err.code === 'auth/popup-blocked') {
        setError("Sign-in popup was blocked by your browser. Please OPEN THE APP IN A NEW TAB using the icon in the top right.");
      } else {
        setError(err.message || "Google sign-in failed. Please try again.");
      }
    }
  };

  const handleGuestSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("Initiating Guest Access...");
      await signInAnonymously(auth);
      console.log("Guest Access successful");
    } catch (err: any) {
      console.error("Guest Auth error:", err);
      setLoading(false);
      if (err.code === 'auth/admin-restricted-operation') {
        setError("Guest Access is disabled in the Firebase Console. Please enable 'Anonymous' authentication in the Firebase Auth settings.");
      } else {
        setError(err.message || "Guest access failed. Please try again.");
      }
    }
  };

  const handleFinalizeProfile = async () => {
    if (!auth.currentUser) return;
    setPhase("loading");
    setLoading(true);
    
    const userRef = doc(db, 'users', auth.currentUser.uid);
    try {
      console.log("Checking if profile exists...");
      const docSnap = await getDoc(userRef);
      if (!docSnap.exists()) {
        console.log("Creating new profile...");
        // Create new profile
        await setDoc(userRef, {
          uid: auth.currentUser.uid,
          email: auth.currentUser.email || "guest@synkify.local",
          displayName: auth.currentUser.displayName || "GUEST_AGENT",
          photoURL: auth.currentUser.photoURL || null,
          isAnonymous: auth.currentUser.isAnonymous,
          bias: answers.bias || 'None',
          roomAtmosphere: answers.atmosphere || 'Standard',
          directive: answers.directive || 'Dashboard',
          frequency: answers.frequency || 'Electric',
          stats: {
            level: 1,
            experience: 0,
            crystals: 10,
            completed_goals: 0
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      console.log("Profile ready, showing success phase");
      setPhase("success");
      setTimeout(() => onComplete?.(), 2000);
    } catch (e: any) {
      console.error("Finalize profile error:", e);
      setPhase("auth");
      setError(e.message || "Failed to finalize profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white text-zinc-900 overflow-hidden tracking-widest px-6 md:px-8">
      {/* Background elements - more subtle for light mode */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(0,0,0,0.03),transparent)] pointer-events-none" />
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        className="absolute inset-[-100%] opacity-[0.03] pointer-events-none flex items-center justify-center"
      >
        <div className="w-[80%] h-[80%] border-[1px] border-black rounded-full" />
        <div className="absolute w-[60%] h-[60%] border-[1px] border-black rounded-full opacity-50" />
      </motion.div>

      <div className="relative z-10 w-full max-w-4xl flex flex-col items-center justify-center min-h-[70vh]">
        <AnimatePresence mode="wait">
          {phase === "intro" && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, filter: "blur(20px)" }}
              className="flex flex-col items-center text-center gap-12"
            >
              <div className="flex flex-col gap-4 w-full px-4">
                <span className="text-[10px] tracking-[0.6em] text-zinc-300 uppercase text-center font-bold">ESTABLISHED CONNECTION</span>
                <h1 className="text-7xl font-black tracking-tighter text-zinc-900 text-center w-full">SYNKIFY</h1>
                <p className="text-[10px] sm:text-[11px] tracking-[0.4em] text-zinc-400 uppercase text-center mt-2 font-bold">探索你的數位共鳴中心 / FIND YOUR RESONANCE</p>
              </div>

              <motion.div
                onPointerDown={() => setIsHolding(true)}
                onPointerUp={() => setIsHolding(false)}
                onPointerLeave={() => setIsHolding(false)}
                onContextMenu={(e) => e.preventDefault()}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group flex flex-col items-center gap-6 mt-8 relative z-50 bg-transparent border-none cursor-pointer touch-none select-none"
              >
                <div className="relative w-24 h-24 flex items-center justify-center">
                  {/* Progress Ring */}
                  <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
                    <circle cx="48" cy="48" r="46" stroke="currentColor" strokeWidth="1" fill="transparent" className="text-zinc-100" />
                    <motion.circle
                      cx="48" cy="48" r="46" stroke="currentColor" strokeWidth="2" fill="transparent"
                      strokeDasharray="290"
                      strokeDashoffset={290 - (290 * holdProgress) / 100}
                      className="text-black"
                    />
                  </svg>
                  
                  {/* Center core */}
                  <div className="absolute inset-4 rounded-full bg-white border border-zinc-100 shadow-sm flex items-center justify-center overflow-hidden transition-all group-hover:border-zinc-300">
                    <motion.div
                      animate={{
                        scale: isHolding ? 1.1 : 1,
                        opacity: isHolding ? [1, 0.5, 1] : 1,
                      }}
                    >
                      <Fingerprint className={cn("w-8 h-8 transition-colors duration-500", isHolding ? "text-black" : "text-zinc-200")} />
                    </motion.div>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2 items-center">
                  <motion.span 
                    animate={{ 
                      opacity: isHolding ? 1 : [0.4, 0.7, 0.4],
                    }}
                    className="text-[10px] font-bold uppercase tracking-[0.6em] text-zinc-900"
                  >
                    {isHolding ? "RECOGNIZING..." : "HOLD TO START"}
                  </motion.span>
                </div>
              </motion.div>
            </motion.div>
          )}
          
          {phase === "pact" && (
            <motion.div
              key="pact"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, filter: "blur(20px)" }}
              className="flex flex-col items-center text-center gap-10 md:gap-14 max-w-xl"
            >
              <div className="flex flex-col gap-6">
                <span className="text-[10px] tracking-[0.6em] text-zinc-300 uppercase font-bold">AFFIRMATION_PACT // 誓約</span>
                <h2 className="text-5xl font-black tracking-tighter text-zinc-900 uppercase">BECOME YOUR TRUE SELF</h2>
                <div className="w-12 h-[1px] bg-zinc-100 mx-auto" />
                <p className="font-serif text-[16px] md:text-[18px] text-zinc-600 leading-relaxed italic px-4">
                  「我承諾相信自己的力量，<br />
                  跨越數碼與現實的邊界，<br />
                  在共鳴中找回真實的自我。」
                </p>
                <p className="text-[10px] tracking-[0.4em] text-zinc-400 uppercase mt-4 font-bold">
                  I PROMISE TO BELIEVE IN MY OWN STRENGTH <br />
                  AND EVOLVE INTO MY AUTHENTIC SELF.
                </p>
              </div>

              <button
                onClick={handleAcceptPact}
                className="minimal-button py-5 px-16 text-[11px] tracking-[0.3em] font-black uppercase shadow-lg shadow-black/5"
              >
                ACCEPT PACT / 接受誓約
              </button>
            </motion.div>
          )}

          {phase === "questions" && (
            <motion.div
              key="questions"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="w-full max-w-md flex flex-col items-center py-4 px-4 h-full"
            >
              <div className="flex flex-col items-center text-center gap-3 mb-6 shrink-0">
                <span className="text-[10px] tracking-[0.5em] text-zinc-300 uppercase font-bold">NODE {currentQuestion + 1} // {ONBOARDING_QUESTIONS.length}</span>
                <h2 className="text-3xl font-black tracking-tighter text-zinc-900 px-2 uppercase min-h-[3.5rem] flex items-center text-center justify-center">
                  {ONBOARDING_QUESTIONS[currentQuestion].question}
                </h2>
                <p className="text-[9px] md:text-[10px] tracking-[0.4em] text-zinc-400 uppercase px-4 leading-relaxed font-bold">
                  {ONBOARDING_QUESTIONS[currentQuestion].sub}
                </p>
              </div>

              <div className="flex flex-col gap-3 w-full overflow-y-auto custom-scrollbar pr-1 max-h-[40vh] py-2">
                {ONBOARDING_QUESTIONS[currentQuestion].options.map((opt) => {
                  const isSelected = tempSelection === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleAnswerClick(opt.value)}
                      className={cn(
                        "group relative min-h-[64px] border rounded-2xl transition-all text-left px-8 flex items-center justify-between overflow-hidden shrink-0",
                        isSelected 
                          ? "border-black bg-zinc-50 shadow-sm" 
                          : "border-zinc-100 hover:border-zinc-300 bg-white"
                      )}
                    >
                       <div className={cn(
                         "absolute left-0 bottom-0 w-[4px] transition-all duration-500", 
                         opt.color,
                         isSelected ? "h-full" : "h-0 group-hover:h-[40%]"
                       )} />
                       <div className="flex flex-col">
                         <span className={cn(
                           "text-[12px] md:text-[13px] uppercase tracking-[0.3em] font-bold transition-all",
                           isSelected ? "text-zinc-900 translate-x-1" : "text-zinc-400 group-hover:text-zinc-900"
                         )}>
                           {opt.label.split(' / ')[0]}
                         </span>
                         <span className="text-[8px] tracking-[0.2em] text-zinc-300 mt-1 uppercase italic font-bold">
                           {opt.label.split(' / ')[1] || ""}
                         </span>
                       </div>
                       {isSelected && (
                         <motion.div layoutId="check" className="w-2 h-2 rounded-full bg-black" />
                       )}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between w-full mt-8 mb-4 shrink-0">
                <button
                  onClick={handlePrevStep}
                  className="text-[10px] tracking-[0.4em] text-zinc-300 hover:text-zinc-900 uppercase transition-colors py-4 px-2 font-bold"
                >
                  [ BACK ]
                </button>
                <button
                  onClick={handleNextStep}
                  disabled={!tempSelection}
                  className={cn(
                    "minimal-button px-10 py-4 text-[10px] tracking-[0.3em] flex items-center gap-2",
                    !tempSelection && "opacity-20 grayscale"
                  )}
                >
                  NEXT STEP
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          )}

          {phase === "auth" && (
            <motion.div
              key="auth"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, filter: "blur(20px)" }}
              className="flex flex-col items-center text-center gap-8 md:gap-12"
            >
              <div className="flex flex-col gap-5">
                <span className="text-[10px] tracking-[0.6em] text-zinc-300 uppercase font-bold">SYNCHRONIZATION PROFILE</span>
                <h2 className="text-5xl font-black tracking-tighter text-zinc-900 uppercase">IDENTIFY YOURSELF</h2>
                
                <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto mt-4 px-4">
                  {[
                    { label: "BIAS", val: answers.bias },
                    { label: "DIRECTIVE", val: answers.directive },
                    { label: "FREQUENCY", val: answers.frequency },
                    { label: "PLANE", val: answers.atmosphere }
                  ].map((tag, i) => (
                    <motion.div 
                      key={tag.label} 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-100 flex flex-col items-start gap-1"
                    >
                      <span className="text-[7px] tracking-widest text-zinc-400 uppercase font-bold">{tag.label}</span>
                      <span className="text-[9px] tracking-[0.2em] text-zinc-900 uppercase font-black truncate w-full">{tag.val}</span>
                    </motion.div>
                  ))}
                </div>

                <p className="text-[10px] tracking-[0.4em] text-zinc-400 uppercase max-w-xs leading-relaxed mx-auto mt-4 font-bold">
                  請使用 GOOGLE 帳戶進行最終身分授權以儲存您的宇宙軌跡。<br />
                  AUTHORIZE IDENTITY TO ARCHIVE YOUR RESONANCE.
                </p>
              </div>

                <div className="flex flex-col gap-4 w-full items-center">
                  <button
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="minimal-button w-full max-w-sm py-5 text-[10px] tracking-[0.3em] shadow-lg shadow-black/5 flex items-center justify-center gap-3"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>AUTHORIZE VIA GOOGLE // 谷歌登錄</>
                    )}
                  </button>

                  <button
                    onClick={handleGuestSignIn}
                    disabled={loading}
                    className="w-full max-w-sm flex items-center justify-center gap-4 px-12 py-4 bg-transparent border border-zinc-100 text-zinc-400 text-[9px] font-bold uppercase tracking-[0.3em] hover:bg-zinc-50 hover:text-zinc-900 rounded-full transition-all disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>INITIALIZE GUEST SESSION // 訪客進入</>
                    )}
                  </button>
                </div>
              
      {error && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 w-full max-w-sm border border-black/10 bg-white/80 backdrop-blur-md overflow-hidden flex flex-col items-stretch text-left shadow-2xl rounded-2xl"
        >
          <div className="bg-zinc-900 px-4 py-2 flex items-center justify-between">
            <span className="text-[9px] font-bold text-white tracking-[0.3em] uppercase">SYSTEM_DIAGNOSTICS // auth_error</span>
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            </div>
          </div>
          
          <div className="p-5 flex flex-col gap-4">
            <p className="text-[10px] tracking-[0.1em] text-zinc-600 leading-relaxed font-bold uppercase">
              {error.includes("OPENING THE APP IN A NEW TAB") ? (
                <>
                  RESONANCE INTERRUPTED BY BROWSER SECURITY POLICIES.<br />
                  IFRAME RESTRICTIONS DETECTED.
                </>
              ) : (
                `STATION_ERROR: ${error}`
              )}
            </p>
            
            <div className="flex flex-col gap-2 pt-2 border-t border-zinc-100">
              <span className="text-[8px] tracking-[0.2em] text-zinc-400 uppercase font-bold">REPAIR_PROTOCOLS:</span>
              <ul className="flex flex-col gap-1.5">
                <li className="text-[9px] tracking-[0.1em] text-zinc-500 flex items-start gap-2">
                  <span className="text-zinc-900 font-black">01</span>
                  <span>OPEN THE APP IN A NEW TAB (USE THE TOP-RIGHT ICON). THIS RESOLVES 90% OF AUTH ISSUES.</span>
                </li>
                <li className="text-[9px] tracking-[0.1em] text-zinc-500 flex items-start gap-2">
                  <span className="text-zinc-900 font-black">02</span>
                  <span>IF SEEING "PROJECT NOT FOUND": YOUR FIREBASE CONSENT SCREEN MAY BE SET TO "INTERNAL". SET TO "EXTERNAL" IN CLOUD CONSOLE.</span>
                </li>
                <li className="text-[9px] tracking-[0.1em] text-zinc-500 flex items-start gap-2">
                  <span className="text-zinc-900 font-black">03</span>
                  <span>ADD YOUR DOMAIN TO FIREBASE "AUTHORIZED DOMAINS" LIST.</span>
                </li>
              </ul>
            </div>

            <button 
              onClick={() => { setError(null); setLoading(false); }}
              className="mt-2 text-[9px] tracking-[0.4em] text-zinc-900 hover:text-white uppercase font-black py-3 border border-zinc-200 hover:bg-zinc-900 transition-all text-center rounded-xl"
            >
              [ RESET_TERMINAL ]
            </button>
          </div>
        </motion.div>
      )}
            </motion.div>
          )}

          {(phase === "loading" || authLoading) && (phase !== "success") && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-8"
            >
              <div className="relative w-16 h-16 flex items-center justify-center">
                <Loader2 className="w-full h-full text-zinc-900 animate-spin" />
                <div className="absolute inset-0 border-2 border-zinc-50 rounded-full" />
              </div>
              <div className="flex flex-col gap-2 items-center">
                <span className="text-[10px] uppercase tracking-[0.6em] text-zinc-900 font-bold">SYNCHRONIZING CORE...</span>
                <span className="text-[8px] tracking-[0.3em] text-zinc-300 uppercase font-bold">UPLOADING RESISTANCE DATA</span>
              </div>
            </motion.div>
          )}

          {phase === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, filter: "blur(20px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              className="flex flex-col items-center gap-8 text-center"
            >
              <motion.div 
                initial={{ scale: 0, rotate: 0 }}
                animate={{ scale: 1, rotate: [0, 90, 0] }}
                transition={{ 
                  scale: { type: "spring", damping: 12 },
                  rotate: { duration: 1.5, ease: "easeInOut" }
                }}
                className="w-24 h-24 rounded-full bg-zinc-900 flex items-center justify-center relative shadow-xl"
              >
                 <Sparkles className="w-10 h-10 text-white" />
              </motion.div>
              <div className="flex flex-col gap-2">
                <h2 className="text-3xl font-black tracking-tighter text-zinc-900 uppercase">ACCESS GRANTED</h2>
                <span className="text-[10px] tracking-[0.5em] text-zinc-400 uppercase font-bold">同步完成，特工 {(auth.currentUser?.displayName?.split(' ')[0] || "PROTAGONIST").toUpperCase()}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Meta */}
      <div className="absolute bottom-12 left-0 w-full px-12 flex justify-between items-end opacity-20 pointer-events-none text-zinc-900 font-bold">
         <div className="flex flex-col gap-1">
            <span className="text-[8px] uppercase tracking-widest">STATUS: {loading ? 'FETCHING' : 'IDLE'}</span>
            <span className="text-[8px] uppercase tracking-widest">SESSION: {Math.random().toString(16).slice(2, 10)}</span>
         </div>
         <span className="text-[8px] uppercase tracking-[0.5em]">SYNK V4.2.1-BETA</span>
      </div>
    </div>
  );
};

export default WelcomeScreen;