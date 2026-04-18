import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { 
  Camera, 
  Plus, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Play, 
  Pause, 
  Tag, 
  Image as ImageIcon,
  Film,
  Sparkles,
  Trash2,
  MoreVertical,
  Check,
  RotateCcw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useSYNK, Memory, MemoryMedia } from "../Store";
import { cn } from "../utils";

export default function SynkOracle() {
  const { memories, goals, addMemory, deleteMemory, user, stats, bias } = useSYNK();
  const [showCreate, setShowCreate] = useState(false);
  const [caption, setCaption] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [pendingMedia, setPendingMedia] = useState<MemoryMedia[]>([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [showFlash, setShowFlash] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [zoomCapabilities, setZoomCapabilities] = useState<{ min: number, max: number } | null>(null);
  const [reviewMedia, setReviewMedia] = useState<MemoryMedia | null>(null);
  const [useFrame, setUseFrame] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pinchStartDistRef = useRef<number | null>(null);
  const dragStartYRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(1);

  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (isCameraActive) {
      const getMedia = async () => {
        try {
          // Stop old stream before starting new one
          if (activeStream) {
            activeStream.getTracks().forEach(track => track.stop());
            setActiveStream(null);
          }

          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: facingMode, 
              width: { ideal: 640 }, 
              height: { ideal: 480 } 
            }, 
            audio: false 
          });

          // Check for zoom capabilities
          const track = stream.getVideoTracks()[0];
          const capabilities = (track as any).getCapabilities?.();
          if (capabilities && capabilities.zoom) {
            setZoomCapabilities({
              min: capabilities.zoom.min,
              max: capabilities.zoom.max
            });
            setZoom(capabilities.zoom.min);
          } else {
            setZoomCapabilities(null);
          }

          setActiveStream(stream);
        } catch (err) {
          console.error("Camera error:", err);
          setIsCameraActive(false);
          alert("Could not access camera. Please check permissions.");
        }
      };
      getMedia();
    } else if (!isCameraActive && activeStream) {
      activeStream.getTracks().forEach(track => track.stop());
      setActiveStream(null);
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCameraActive, facingMode]);

  useEffect(() => {
    if (activeStream && videoRef.current) {
      videoRef.current.srcObject = activeStream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch(console.error);
      };
    }
  }, [activeStream, videoRef.current]);

  useEffect(() => {
    if (activeStream && zoomCapabilities) {
      const track = activeStream.getVideoTracks()[0];
      if (track && (track as any).applyConstraints) {
        (track as any).applyConstraints({
          advanced: [{ zoom: zoom }]
        }).catch((e: Error) => console.error("Zoom constraint failed:", e));
      }
    }
  }, [zoom, activeStream, zoomCapabilities]);

  const handleStartCamera = () => {
    setFacingMode('environment');
    setIsCameraActive(true);
  };
  const handleStopCamera = () => {
    setIsCameraActive(false);
    setFacingMode('environment'); // Reset to back camera when closing
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      pinchStartDistRef.current = dist;
      initialZoomRef.current = zoom;
    } else if (e.touches.length === 1) {
      dragStartYRef.current = e.touches[0].pageY;
      initialZoomRef.current = zoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDistRef.current && zoomCapabilities) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      const zoomFactor = dist / pinchStartDistRef.current;
      const newZoom = Math.min(
        zoomCapabilities.max,
        Math.max(zoomCapabilities.min, initialZoomRef.current * zoomFactor)
      );
      setZoom(newZoom);
    } else if (e.touches.length === 1 && dragStartYRef.current && zoomCapabilities) {
      const deltaY = dragStartYRef.current - e.touches[0].pageY; // Up is positive
      const zoomSense = 0.005; // Sensitivity
      const newZoom = Math.min(
        zoomCapabilities.max,
        Math.max(zoomCapabilities.min, initialZoomRef.current + (deltaY * zoomSense))
      );
      setZoom(newZoom);
    }
  };

  const handleTouchEnd = () => {
    pinchStartDistRef.current = null;
    dragStartYRef.current = null;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remainingSlots = 10 - pendingMedia.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots) as File[];

    filesToProcess.forEach(async (file: File) => {
      const isVideo = file.type.startsWith('video/');
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (event.target?.result) {
          let url = event.target?.result as string;
          
          if (!isVideo) {
            // High fidelity: 720p and 0.85 quality
            url = await compressImage(url, 720, 720, 0.85);
          }
          
          setPendingMedia(prev => [...prev, { 
            type: isVideo ? 'video' : 'image', 
            url 
          }]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const compressImage = (base64Str: string, maxWidth = 720, maxHeight = 720, quality = 0.5): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
    });
  };

  const startRecording = () => {
    if (!activeStream || pendingMedia.length >= 10) return;
    
    setIsRecording(true);
    setRecordingTime(0);
    chunksRef.current = [];
    
    const recorder = new MediaRecorder(activeStream, { mimeType: 'video/webm' });
    mediaRecorderRef.current = recorder;
    
    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      // Pre-check size
      if (blob.size > 800000) {
        alert("Video too large for neural resonance. Try a shorter capture (max 1MB).");
        setIsRecording(false);
        setRecordingTime(0);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result) {
          setReviewMedia({ type: 'video', url: reader.result as string });
        }
      };
      reader.readAsDataURL(blob);
      setIsRecording(false);
      setRecordingTime(0);
    };
    
    recorder.start();
    
    recordingIntervalRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev >= 10) { // Reduced from 30 to fit Firestore limits
          stopRecording();
          return 10;
        }
        return prev + 0.1;
      });
    }, 100);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (pendingMedia.length >= 10) return;
    
    pressTimerRef.current = setTimeout(() => {
      startRecording();
      pressTimerRef.current = null;
    }, 400); // threshold for long press
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
      // It was a short press -> capture photo
      captureSnapshot();
    } else if (isRecording) {
      stopRecording();
    }
  };

  const captureSnapshot = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    // Scale down for speed (720p)
    const maxDim = 720;
    let width = video.videoWidth;
    let height = video.videoHeight;

    if (width <= 0 || height <= 0) return;

    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 100);
    
    if (width > height) {
      if (width > maxDim) {
        height *= maxDim / width;
        width = maxDim;
      }
    } else {
      if (height > maxDim) {
        width *= maxDim / height;
        height = maxDim;
      }
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, width, height);
      const url = canvas.toDataURL('image/jpeg', 0.85); // High fidelity snapshot
      
      if (url && url.length > 500) {
        setReviewMedia({ type: 'image', url });
      }
    }
  };

  const handleAcceptMedia = async () => {
    if (!reviewMedia) return;

    let finalUrl = reviewMedia.url;

    // If it's an image and user wants the frame, we embed it
    if (reviewMedia.type === 'image' && useFrame && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Redraw image first (it might have been scaled or cleared)
        const img = new Image();
        img.src = reviewMedia.url;
        await new Promise(resolve => img.onload = resolve);
        
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Draw HUD Frame
        ctx.strokeStyle = '#cyan';
        ctx.lineWidth = 2;
        const p = 20; // padding
        
        // Corners
        ctx.beginPath();
        const s = 40; // corner size
        // Top Left
        ctx.moveTo(p, p + s); ctx.lineTo(p, p); ctx.lineTo(p + s, p);
        // Top Right
        ctx.moveTo(canvas.width - p - s, p); ctx.lineTo(canvas.width - p, p); ctx.lineTo(canvas.width - p, p + s);
        // Bottom Right
        ctx.moveTo(canvas.width - p, canvas.height - p - s); ctx.lineTo(canvas.width - p, canvas.height - p); ctx.lineTo(canvas.width - p - s, canvas.height - p);
        // Bottom Left
        ctx.moveTo(p + s, canvas.height - p); ctx.lineTo(p, canvas.height - p); ctx.lineTo(p, canvas.height - p - s);
        ctx.stroke();

        // Label
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px monospace';
        ctx.fillText('SYNK_OS // NEURAL_LINK', p + 10, p + 20);
        
        // Bottom Metadata
        const dateStr = new Date().toISOString().split('T')[0];
        const timeStr = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' });
        const locationStr = "KWUN TONG // DISTRICT_09";
        const identityStr = bias !== 'None' ? `ID: ${bias.toUpperCase()}_UNIT` : "ID: GUEST_AGENT";
        
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`${dateStr} ${timeStr}`, p + 10, canvas.height - p - 10);
        ctx.fillText(locationStr, canvas.width - p - 150, p + 20);
        ctx.textAlign = 'right';
        ctx.fillText(identityStr, canvas.width - p - 10, canvas.height - p - 10);

        finalUrl = canvas.toDataURL('image/jpeg', 0.85);
      }
    }

    setPendingMedia(prev => {
      if (prev.length >= 10) return prev;
      return [...prev, { type: reviewMedia.type, url: finalUrl }];
    });
    setReviewMedia(null);
    setUseFrame(false);
  };

  const handleDiscardMedia = () => {
    setReviewMedia(null);
    setUseFrame(false);
  };

  const handleCreatePost = async () => {
    if (pendingMedia.length === 0 || !user || isUploading) return;
    
    // Check total estimated size (Firestore limit is 1MB)
    const totalSize = JSON.stringify(pendingMedia).length;
    if (totalSize > 1000000) {
      alert("Asset limit exceeded. Please remove some items or reduce quality to stay within the 1MB neural resonance limit.");
      return;
    }

    setIsUploading(true);
    try {
      const taggedTask = goals.find(g => g.id === selectedTaskId);
      
      await addMemory({
        caption,
        media: pendingMedia,
        ...(selectedTaskId ? { taggedTaskId: selectedTaskId } : {}),
        ...(taggedTask?.title ? { taggedTaskTitle: taggedTask.title } : {})
      });
      
      // Reset state
      setCaption("");
      setPendingMedia([]);
      setSelectedTaskId(null);
      setShowCreate(false);
      handleStopCamera();
    } catch (err: any) {
      console.error("Failed to create post:", err);
      alert("Neural sync failure: " + (err?.message || "Check network/storage limits"));
    } finally {
      setIsUploading(false);
    }
  };

  const removePendingMedia = (index: number) => {
    setPendingMedia(prev => prev.filter((_, i) => i !== index));
  };

  // Stats for the header
  const totalMemories = memories.length;
  const totalTagged = memories.filter(m => m.taggedTaskId).length;

  return (
    <div className="w-full h-full flex flex-col p-6 lg:p-10 pb-32 overflow-y-auto custom-scrollbar overflow-x-hidden bg-white text-zinc-900">
      <div className="max-w-6xl mx-auto w-full flex flex-col gap-10">
        
        {/* Minimalist Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-zinc-100 pb-8">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-extrabold tracking-tighter uppercase font-mono">Channel // ORACLE</h1>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Neural Resonance Feed</p>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex gap-8">
              <div className="flex flex-col text-right">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Memories</span>
                <span className="text-xl font-bold">{totalMemories}</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Synced</span>
                <span className="text-xl font-bold text-zinc-900">{totalTagged}</span>
              </div>
            </div>
            <button 
              onClick={() => setShowCreate(true)}
              className="w-12 h-12 rounded-full bg-black flex items-center justify-center text-white hover:bg-zinc-800 transition-all shadow-sm active:scale-95"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
        </header>

        {/* Memory Grid/Feed */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <AnimatePresence mode="popLayout">
            {memories.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="col-span-1 md:col-span-2 py-20 flex flex-col items-center text-center gap-4 opacity-30"
              >
                <Sparkles className="w-12 h-12" />
                <p className="text-xs tracking-[0.3em] uppercase">No resonance memories detected.<br/>Start capturing your journey.</p>
              </motion.div>
            ) : (
              memories.map((memory) => (
                <MemoryPost key={memory.id} memory={memory} onDelete={() => deleteMemory(memory.id)} />
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Create Modal Overlay */}
      <AnimatePresence>
        {showCreate && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4 md:p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={cn(
                "w-full h-full flex flex-col md:flex-row overflow-y-auto md:overflow-hidden relative bg-white",
                isCameraActive ? "bg-black z-[110]" : "md:max-w-5xl md:h-[85vh] rounded-3xl border border-zinc-100 shadow-2xl"
              )}
            >
              {/* Left Side: Media Picker / Full Screen Camera */}
              <div className={cn(
                "flex flex-col relative transition-all duration-500",
                isCameraActive ? "w-full h-full z-[120] fixed inset-0" : "w-full md:w-1/2 min-h-[350px] md:min-h-0 bg-zinc-50 border-b md:border-b-0 md:border-r border-zinc-100"
              )}>
                {isCameraActive ? (
                  <div 
                    className="flex-1 relative overflow-hidden bg-black"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                  >
                     {reviewMedia ? (
                        <div className="absolute inset-0 z-[70] bg-black flex flex-col">
                           <div className="flex-1 relative overflow-hidden group">
                              {reviewMedia.type === 'image' ? (
                                <div className="w-full h-full relative">
                                   <img src={reviewMedia.url} className="w-full h-full object-cover" />
                                   {useFrame && (
                                     <div className="absolute inset-0 border-[1px] border-white/30 m-6 pointer-events-none">
                                        <div className="absolute top-0 left-0 w-8 h-8 border-t-[1px] border-l-[1px] border-white" />
                                        <div className="absolute top-0 right-0 w-8 h-8 border-t-[1px] border-r-[1px] border-white" />
                                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[1px] border-l-[1px] border-white" />
                                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[1px] border-r-[1px] border-white" />
                                        <div className="absolute top-2 left-4 text-[8px] font-bold text-white bg-black/40 px-2 rounded-full tracking-widest">SYNK // HUD</div>
                                     </div>
                                   )}
                                </div>
                              ) : (
                                <video src={reviewMedia.url} controls autoPlay loop className="w-full h-full object-cover" />
                              )}
                           </div>
                           
                           {/* Review Controls */}
                           <div className="p-8 bg-zinc-900 border-t border-white/5 flex flex-col gap-6 relative overflow-hidden">
                              <div className="flex justify-between items-center px-2 relative z-10">
                                 <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Review Manifestation</span>
                                 {reviewMedia.type === 'image' && (
                                   <button 
                                     onClick={() => setUseFrame(!useFrame)}
                                     className={cn(
                                       "px-6 py-2.5 rounded-full border text-[10px] font-bold uppercase tracking-widest transition-all",
                                       useFrame ? "bg-white border-white text-black" : "bg-white/10 border-white/20 text-white/60"
                                     )}
                                   >
                                     {useFrame ? "FRAME: ACTIVE" : "ADD FRAME"}
                                   </button>
                                 )}
                              </div>
                              <div className="flex gap-4 relative z-10">
                                 <button 
                                   onClick={handleDiscardMedia}
                                   className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-white/40 text-[10px] font-bold uppercase tracking-widest hover:bg-red-900/40 hover:text-red-300 transition-all"
                                 >
                                    DISCARD
                                 </button>
                                 <button 
                                   onClick={handleAcceptMedia}
                                   className="flex-1 py-4 rounded-2xl bg-white text-black text-[10px] font-bold uppercase tracking-widest hover:scale-[1.02] transition-all shadow-xl"
                                 >
                                    ACCEPT
                                 </button>
                              </div>
                           </div>
                        </div>
                     ) : (
                       <>
                         <video 
                          ref={videoRef} 
                          autoPlay 
                          playsInline 
                          muted
                          className="absolute inset-0 w-full h-full object-cover grayscale-[0.2]"
                        />
                        
                        {/* Shutter Flash */}
                        <AnimatePresence>
                          {showFlash && (
                            <motion.div 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="absolute inset-0 bg-white z-[60] pointer-events-none"
                            />
                          )}
                        </AnimatePresence>
                        
                        {/* Immersive HUD */}
                        <div className="absolute inset-0 pointer-events-none border-[1px] border-white/10 m-4 flex flex-col justify-between p-4">
                           <div className="flex justify-between items-start">
                              <div className="flex flex-col gap-1">
                                 <div className="flex items-center gap-2">
                                    <div className={cn("w-2 h-2 rounded-full", isRecording ? "bg-red-500 animate-pulse" : "bg-white")} />
                                    <span className="text-[10px] font-bold tracking-widest uppercase text-white/50">
                                       {isRecording ? "REC" : "STBY"}
                                    </span>
                                 </div>
                                 {isRecording && (
                                    <span className="text-2xl font-bold text-white pl-4">
                                       00:{Math.floor(recordingTime).toString().padStart(2, '0')}
                                    </span>
                                 )}
                                 {zoomCapabilities && (
                                    <div className="mt-2 bg-black/40 backdrop-blur-md px-2 py-1 rounded border border-white/5 flex items-center gap-2">
                                       <span className="text-[8px] font-bold text-white/40 tracking-tighter">ZOOM</span>
                                       <span className="text-xs font-bold text-white">{zoom.toFixed(1)}x</span>
                                    </div>
                                 )}
                              </div>
                              <div className="text-[8px] font-bold text-white/20 text-right uppercase tracking-tighter">
                                 SYNK // OPTIC<br/>
                                 V-RES: 720P<br/>
                                 {new Date().toISOString().slice(0, 10)}
                              </div>
                           </div>
                           
                           <div className="flex justify-between items-end">
                              <div className="text-[8px] font-bold text-white/20 uppercase tracking-widest">
                                 LINK_ESTABLISHED
                              </div>
                              <div className="flex gap-1">
                                 {Array.from({length: 10}).map((_, i) => (
                                    <div key={i} className={cn("w-1 h-3 border border-white/10", i < pendingMedia.length ? "bg-white border-white" : "")} />
                                 ))}
                              </div>
                           </div>
                        </div>

                        {/* Camera Controls */}
                        <div className="absolute inset-x-0 bottom-12 flex justify-center items-center gap-12 z-50">
                           <button onClick={handleStopCamera} className="w-12 h-12 rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-white/40 flex items-center justify-center hover:bg-white/10 hover:text-white transition-all">
                              <X className="w-6 h-6" />
                           </button>

                           <div className="relative flex items-center justify-center">
                              {isRecording && (
                                 <svg className="absolute w-[100px] h-[100px] -rotate-90 pointer-events-none">
                                    <circle 
                                      cx="50" cy="50" r="46" 
                                      fill="transparent" 
                                      stroke="rgba(239, 68, 68, 0.4)" 
                                      strokeWidth="4" 
                                    />
                                    <motion.circle 
                                      cx="50" cy="50" r="46" 
                                      fill="transparent" 
                                      stroke="#ef4444" 
                                      strokeWidth="4"
                                      strokeDasharray={289}
                                      animate={{ strokeDashoffset: 289 - (recordingTime / 10) * 289 }}
                                      transition={{ duration: 0.1, ease: "linear" }}
                                    />
                                 </svg>
                              )}
                              <button 
                                onPointerDown={handlePointerDown}
                                onPointerUp={handlePointerUp}
                                onPointerLeave={handlePointerUp}
                                className={cn(
                                  "w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-all duration-300 active:scale-90",
                                  isRecording ? "border-red-500 scale-110" : ""
                                )}
                              >
                                 <div className={cn(
                                   "transition-all duration-300",
                                   isRecording ? "w-8 h-8 rounded-lg bg-red-500 shadow-[0_0_20px_#ef4444]" : "w-14 h-14 rounded-full bg-white/20"
                                 )} />
                              </button>
                           </div>

                           <button 
                             onClick={toggleCamera} 
                             className="w-12 h-12 rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-white/40 flex items-center justify-center hover:bg-white/10 hover:text-white transition-all"
                           >
                              <RotateCcw className="w-6 h-6" />
                           </button>
                        </div>

                        {/* Interaction Hint */}
                        {!isRecording && (
                           <div className="absolute inset-x-0 bottom-32 flex justify-center pointer-events-none">
                              <span className="text-[9px] uppercase tracking-widest text-white/40 font-bold bg-black/40 px-6 py-2.5 rounded-full backdrop-blur-md text-center border border-white/5">
                                 TAP PHOTO // HOLD VIDEO
                              </span>
                           </div>
                        )}
                       </>
                     )}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-6 p-10 min-h-[350px]">
                      {pendingMedia.length > 0 ? (
                        <div className="flex flex-col gap-6 w-full p-4 h-full md:overflow-y-auto custom-scrollbar">
                           <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                              {pendingMedia.map((m, i) => (
                                <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-zinc-100 group/item bg-zinc-50">
                                   {m.type === 'image' ? (
                                      <img src={m.url} className="w-full h-full object-cover grayscale transition-all group-hover/item:grayscale-0 group-hover/item:scale-105" />
                                   ) : (
                                      <video src={m.url} className="w-full h-full object-cover grayscale transition-all group-hover/item:grayscale-0" />
                                   ) }
                                   <button 
                                     onClick={() => removePendingMedia(i)}
                                     className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white text-zinc-900 flex items-center justify-center shadow-lg opacity-0 group-hover/item:opacity-100 transition-all border border-zinc-100"
                                   >
                                     <X className="w-4 h-4" />
                                   </button>
                                   <div className="absolute bottom-3 left-3 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-md text-[8px] font-bold text-white uppercase tracking-widest">
                                      {m.type}
                                   </div>
                                </div>
                              ))}
                              {pendingMedia.length < 10 && (
                                <button 
                                  onClick={() => fileInputRef.current?.click()}
                                  className="aspect-square rounded-2xl border border-dashed border-zinc-200 flex flex-col items-center justify-center gap-3 text-zinc-300 hover:text-zinc-600 hover:border-zinc-400 transition-all bg-zinc-50"
                                >
                                  <Plus className="w-6 h-6" />
                                  <span className="text-[8px] uppercase font-bold tracking-[0.2em]">ADD ASSET</span>
                                </button>
                              )}
                           </div>
                        </div>
                     ) : (
                        <div className="flex flex-col items-center gap-10 px-4 text-center">
                           <div className="w-20 h-20 rounded-full border border-dashed border-zinc-200 flex items-center justify-center text-zinc-200">
                              <Sparkles className="w-8 h-8" />
                           </div>
                           <div className="flex flex-col items-center gap-4">
                              <div className="flex flex-col sm:flex-row gap-4">
                                <button 
                                  onClick={handleStartCamera}
                                  className="px-8 py-4 rounded-full bg-black text-white text-[10px] font-extrabold uppercase tracking-[0.2em] hover:bg-zinc-800 transition-all shadow-lg"
                                >
                                  OPEN CAMERA
                                </button>
                                <button 
                                  onClick={() => fileInputRef.current?.click()}
                                  className="px-8 py-4 rounded-full bg-white border border-zinc-100 text-zinc-900 text-[10px] font-extrabold uppercase tracking-[0.2em] hover:bg-zinc-50 transition-all shadow-sm"
                                >
                                  UPLOAD MEDIA
                                </button>
                              </div>
                              <span className="text-[10px] text-zinc-300 uppercase tracking-[0.3em] font-bold mt-2">CAPTURE OR SELECT ASSETS</span>
                           </div>
                        </div>
                     )}
                  </div>
                )}
                
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  multiple 
                  accept="image/*,video/*"
                  onChange={handleFileUpload} 
                />
                <canvas ref={canvasRef} className="hidden" />
              </div>

              {/* Right Side: Details */}
              <div className="w-full md:w-1/2 p-10 flex flex-col gap-10 bg-white md:overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-extrabold tracking-tighter uppercase">NEW MOMENT</h3>
                  <button onClick={() => setShowCreate(false)} className="text-zinc-300 hover:text-zinc-600 transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-3">
                   <label className="text-[10px] text-zinc-400 uppercase tracking-widest block font-bold">REFLECTION</label>
                   <textarea 
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Write a reflection..."
                    className="w-full h-24 bg-zinc-50 border border-zinc-100 rounded-2xl p-4 text-sm focus:border-zinc-300 outline-none transition-colors resize-none"
                   />
                </div>

                <div className="space-y-4">
                   <label className="text-[10px] text-zinc-400 uppercase tracking-widest block font-bold">TAG DIRECTIVE</label>
                   <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                      {goals.length === 0 ? (
                        <p className="text-[10px] text-zinc-300 italic">No active directives found.</p>
                      ) : (
                        goals.map(goal => (
                          <button 
                            key={goal.id}
                            onClick={() => setSelectedTaskId(selectedTaskId === goal.id ? null : goal.id)}
                            className={cn(
                              "flex items-center gap-3 p-4 rounded-2xl border text-left transition-all",
                              selectedTaskId === goal.id 
                                ? "bg-zinc-900 border-zinc-900 text-white" 
                                : "bg-zinc-50 border-zinc-100 text-zinc-500 hover:border-zinc-300"
                            )}
                          >
                            <div className={cn(
                              "w-4 h-4 rounded border flex items-center justify-center transition-all",
                              selectedTaskId === goal.id ? "bg-white border-white" : "border-zinc-300"
                            )}>
                               {selectedTaskId === goal.id && <Check className="w-3 h-3 text-black" />}
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest truncate">{goal.title}</span>
                          </button>
                        ))
                      )}
                   </div>
                </div>

                <div className="mt-auto pt-6 border-t border-zinc-100 flex flex-col gap-4">
                   {isUploading && (
                     <div className="w-full h-1 bg-zinc-100 rounded-full overflow-hidden relative mb-2">
                        <motion.div 
                          className="absolute inset-y-0 left-0 bg-black"
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{ duration: 1.5, ease: "easeInOut" }}
                        />
                     </div>
                   )}
                   <button 
                    onClick={handleCreatePost}
                    disabled={pendingMedia.length === 0 || isUploading}
                    className="w-full h-14 rounded-full bg-black text-white text-[10px] font-extrabold uppercase tracking-[0.4em] disabled:opacity-20 transition-all hover:bg-zinc-800 shadow-lg"
                   >
                     {isUploading ? "PROCESS..." : "MANIFEST POST"}
                   </button>
                   <p className="text-[10px] text-center text-zinc-300 uppercase tracking-widest font-bold">
                     {pendingMedia.length} / 10 ASSETS SELECTED
                   </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MemoryPost({ memory, onDelete }: { memory: Memory, onDelete: () => void, key?: React.Key }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const totalMedia = memory.media.length;

  const handleScroll = () => {
    if (scrollRef.current) {
      const scrollLeft = scrollRef.current.scrollLeft;
      const width = scrollRef.current.clientWidth;
      const index = Math.round(scrollLeft / width);
      setCurrentIdx(index);
    }
  };

  const scrollTo = (index: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        left: index * scrollRef.current.clientWidth,
        behavior: 'smooth'
      });
    }
  };

  return (
    <>
      <motion.article 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group flex flex-col minimal-card p-3 transition-all hover:shadow-md h-fit"
    >
      {/* Media Carousel - Photocard Cutout Style */}
      <div 
        className="relative aspect-[4/5] w-full bg-zinc-50 overflow-hidden rounded-xl border border-zinc-100 cursor-zoom-in"
        onClick={() => setIsZoomed(true)}
      >
         <div 
           ref={scrollRef}
           onScroll={handleScroll}
           className="flex h-full overflow-x-auto snap-x snap-mandatory no-scrollbar"
         >
           {memory.media.map((item, i) => (
             <div key={i} className="flex-none w-full h-full snap-center relative">
               {item.type === 'image' ? (
                 <img 
                   src={item.url} 
                   className="w-full h-full object-cover" 
                   alt={`Memory ${i}`}
                   referrerPolicy="no-referrer"
                 />
               ) : (
                 <video 
                   src={item.url} 
                   className="w-full h-full object-cover" 
                   autoPlay 
                   loop 
                   muted 
                   playsInline
                 />
               )}
             </div>
           ))}
         </div>

         {/* Navigation Indicators */}
         {totalMedia > 1 && (
           <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1 z-10">
              {memory.media.map((_, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "w-1 h-1 rounded-full transition-all duration-300",
                    i === currentIdx ? "bg-black scale-125 shadow-sm" : "bg-black/20"
                  )} 
                />
              ))}
           </div>
         )}

         {/* Arrow Navigation (Desktop/Hover) */}
         {totalMedia > 1 && (
           <>
            <button 
              onClick={() => scrollTo(currentIdx > 0 ? currentIdx - 1 : totalMedia - 1)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 border border-zinc-100 backdrop-blur-md flex items-center justify-center text-zinc-400 hover:text-zinc-900 transition-all opacity-0 group-hover:opacity-100"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={() => scrollTo(currentIdx < totalMedia - 1 ? currentIdx + 1 : 0)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 border border-zinc-100 backdrop-blur-md flex items-center justify-center text-zinc-400 hover:text-zinc-900 transition-all opacity-0 group-hover:opacity-100"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
           </>
         )}

         {/* Paging indicator top right */}
         <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-white/80 border border-zinc-100 backdrop-blur-md text-[8px] font-bold tracking-widest text-zinc-400">
            {currentIdx + 1} / {totalMedia}
         </div>
      </div>

      {/* Photocard Footer */}
      <div className="mt-4 flex flex-col gap-3 px-1 pb-2">
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <span className="text-[12px] font-extrabold tracking-tighter text-zinc-900 uppercase italic">RESONANCE // {currentIdx + 1}</span>
            <span className="text-[8px] text-zinc-400 font-bold tracking-tighter uppercase font-mono">
              {new Date(memory.createdAt?.seconds * 1000 || Date.now()).toISOString().split('T')[0]} @ {memory.id.slice(0, 8)}
            </span>
          </div>
          <button onClick={onDelete} className="text-zinc-100 hover:text-red-500 transition-colors p-1">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
           {memory.taggedTaskTitle && (
              <div className="flex items-center gap-2 px-2 py-0.5 rounded bg-zinc-50 border border-zinc-100 w-fit">
                 <Tag className="w-2.5 h-2.5 text-zinc-400" />
                 <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest leading-none">{memory.taggedTaskTitle}</span>
              </div>
           )}
           
           <p className="text-[10px] text-zinc-600 leading-tight font-medium italic">
              "{memory.caption || "captured_resonance"}"
            </p>
         </div>
       </div>
    </motion.article>

    {/* Lightbox Overlay */}
    <AnimatePresence>
      {isZoomed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4 md:p-10"
          onClick={() => setIsZoomed(false)}
        >
          <button 
            className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors z-[210]"
            onClick={() => setIsZoomed(false)}
          >
            <X className="w-8 h-8" />
          </button>

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative w-full h-full flex items-center justify-center pointer-events-none"
            onClick={(e) => e.stopPropagation()}
          >
            {memory.media[currentIdx].type === 'image' ? (
              <img 
                src={memory.media[currentIdx].url} 
                className="max-w-full max-h-full object-contain pointer-events-auto"
                alt="Zoomed"
                referrerPolicy="no-referrer"
              />
            ) : (
              <video 
                src={memory.media[currentIdx].url} 
                className="max-w-full max-h-full object-contain pointer-events-auto"
                autoPlay 
                loop 
                controls
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
