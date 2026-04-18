import React, { useMemo, useState } from "react";
import { useSYNK, GoalType, Goal } from "../Store";
import { motion, AnimatePresence } from "motion/react";
import { useMotionValue, useTransform } from "motion/react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, Target, Layout,
  ChevronRight, ChevronLeft, ChevronDown,
  MoreVertical, Trash2, CalendarDays, Upload, Video, X,
  Check,
  Info
} from "lucide-react";
import { cn } from "../utils";

type Priority = "low" | "medium" | "high";
type Proof = {
  kind: "image" | "video";
  name: string;
  url: string;
};
type ScheduleMap = Record<string, string>;
type DateMap = Record<string, string>;
type RecurrenceType = "none" | "weekly" | "monthly";
type RecurrenceMap = Record<string, { type: RecurrenceType; days: number[] }>;

function useLocalStorageState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  React.useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue] as const;
}

export default function GoalVault() {
  const { goals, addGoal, completeGoal, deleteGoal } = useSYNK();
  const [priorityById, setPriorityById] = useLocalStorageState<Record<string, Priority>>("synkify.priorityById", {});
  const [proofById, setProofById] = useLocalStorageState<Record<string, Proof>>("synkify.proofById", {});
  const [scheduleById, setScheduleById] = useLocalStorageState<ScheduleMap>("synkify.scheduleById", {});
  const [dateById, setDateById] = useLocalStorageState<DateMap>("synkify.dateById", {});
  const [recurrenceById, setRecurrenceById] = useLocalStorageState<RecurrenceMap>("synkify.recurrenceById", {});
  const [customOrder, setCustomOrder] = useLocalStorageState<string[]>("synkify.directiveOrder", []);
  const [urgencyFilter, setUrgencyFilter] = useState<Priority | "all">("all");
  const [proofTargetId, setProofTargetId] = useState<string | null>(null);
  const [draggingGoalId, setDraggingGoalId] = useState<string | null>(null);
  const [calendarCollapsed, setCalendarCollapsed] = useState(false);
  const [calendarMonthOffset, setCalendarMonthOffset] = useState(0);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number>(new Date().getDate());
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [draftTaskTitle, setDraftTaskTitle] = useState("");
  const [draftTaskType, setDraftTaskType] = useState<GoalType>("pulse");
  const [draftTaskPriority, setDraftTaskPriority] = useState<Priority>("medium");
  const [draftTaskDate, setDraftTaskDate] = useState<string>(getLocalISODate());
  const [draftTaskTime, setDraftTaskTime] = useState(getLocalTime());
  const [draftRecurrenceType, setDraftRecurrenceType] = useState<RecurrenceType>("none");
  const [draftRecurrenceDays, setDraftRecurrenceDays] = useState<number[]>([]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftTaskTitle.trim()) return;
    
    const newId = await addGoal(draftTaskTitle, draftTaskType);
    if (!newId) return;

    setPriorityById((prev) => ({ ...prev, [newId]: draftTaskPriority }));
    setDateById((prev) => ({ ...prev, [newId]: draftTaskDate }));
    setScheduleById((prev) => ({ ...prev, [newId]: draftTaskTime }));
    setRecurrenceById((prev) => ({
      ...prev,
      [newId]: { type: draftRecurrenceType, days: draftRecurrenceDays },
    }));

    setDraftTaskTitle("");
    setDraftTaskType("pulse");
    setDraftTaskPriority("medium");
    setDraftTaskDate(getLocalISODate());
    setDraftTaskTime(getLocalTime());
    setDraftRecurrenceType("none");
    setDraftRecurrenceDays([]);
    setShowTaskModal(false);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const filteredGoals = useMemo(() => {
    let base = goals;
    if (urgencyFilter !== "all") {
      base = goals.filter((goal) => (priorityById[goal.id] || "medium") === urgencyFilter);
    }
    
    const priorityMap = { high: 0, medium: 1, low: 2 };

    const sorted = [...base].sort((a, b) => {
      const pA = priorityMap[priorityById[a.id] || "medium"];
      const pB = priorityMap[priorityById[b.id] || "medium"];
      
      if (pA !== pB) return pA - pB;
      
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });

    return sorted;
  }, [goals, urgencyFilter, priorityById]);

  const requestCompleteGoal = (id: string) => setProofTargetId(id);

  const completeWithProof = (id: string, proof?: Proof) => {
    if (proof) setProofById((prev) => ({ ...prev, [id]: proof }));
    completeGoal(id);
  };

  const calendarDate = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + calendarMonthOffset, 1);
  }, [calendarMonthOffset]);

  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = 42;
    const cells: Array<{ day: number | null; hasTask: boolean }> = [];

    for (let i = 0; i < totalCells; i += 1) {
      const dayNumber = i - firstWeekday + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) {
        cells.push({ day: null, hasTask: false });
        continue;
      }
      const cellDate = new Date(year, month, dayNumber);
      const hasTask = goals.some((goal) => occursOnDate(goal.id, cellDate, dateById, recurrenceById));
      cells.push({ day: dayNumber, hasTask });
    }
    return cells;
  }, [calendarDate, goals, dateById, recurrenceById]);

  const agendaForSelectedDay = useMemo(() => {
    const daysInMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate();
    const safeDay = Math.min(selectedCalendarDay, daysInMonth);
    const selectedDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), safeDay);
    const dayGoals = filteredGoals
      .filter((goal) => occursOnDate(goal.id, selectedDate, dateById, recurrenceById))
      .sort((a, b) =>
        normalizeScheduleTime(scheduleById[a.id]).localeCompare(normalizeScheduleTime(scheduleById[b.id])),
      );
    return dayGoals;
  }, [calendarDate, selectedCalendarDay, filteredGoals, dateById, recurrenceById, scheduleById]);

  const openModal = () => {
    setDraftTaskDate(getLocalISODate());
    setDraftTaskTime(getLocalTime());
    setShowTaskModal(true);
  };

  return (
    <div className="w-full h-full flex flex-col p-6 lg:p-10 pb-32 overflow-y-auto custom-scrollbar overflow-x-hidden bg-white text-zinc-900">
      <div className="max-w-7xl mx-auto w-full flex flex-col gap-10">
        
        <header className="flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Directives</span>
          <h1 className="text-2xl font-extrabold tracking-tighter">Directives</h1>
        </header>

        <div className="flex flex-col gap-10">
          <section className="flex flex-col gap-6">
            <div className="flex items-center justify-between gap-4 text-zinc-400">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4" />
                <p className="text-[10px] font-bold uppercase tracking-widest">Calendar</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCalendarMonthOffset((prev) => prev - 1)}
                  className="w-8 h-8 rounded-full border border-zinc-100 flex items-center justify-center hover:bg-zinc-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <p className="text-[10px] font-bold uppercase tracking-widest min-w-[130px] text-center text-zinc-900">
                  {calendarDate.toLocaleString(undefined, { month: "long", year: "numeric" })}
                </p>
                <button
                  onClick={() => setCalendarMonthOffset((prev) => prev + 1)}
                  className="w-8 h-8 rounded-full border border-zinc-100 flex items-center justify-center hover:bg-zinc-50 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-4">
              <div className="minimal-card p-4">
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                    <div key={i} className="text-[10px] uppercase font-bold text-zinc-300 text-center py-1">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((cell, idx) => (
                    <button
                      key={idx}
                      disabled={!cell.day}
                      onClick={() => cell.day && setSelectedCalendarDay(cell.day)}
                      className={cn(
                        "h-10 rounded-xl text-xs flex items-center justify-center transition-all",
                        !cell.day && "opacity-0 pointer-events-none",
                        cell.day && "text-zinc-600 hover:bg-zinc-50",
                        cell.hasTask && "font-bold text-black underline underline-offset-4 decoration-2 decoration-zinc-200",
                        cell.day === selectedCalendarDay && "bg-black text-white hover:bg-zinc-900"
                      )}
                    >
                      {cell.day ?? ""}
                    </button>
                  ))}
                </div>
              </div>

              <div className="minimal-card p-6">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-50">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    Agenda • {calendarDate.toLocaleString(undefined, { month: "short" })} {selectedCalendarDay}
                  </p>
                </div>
                <div className="space-y-3">
                  {agendaForSelectedDay.length === 0 && (
                    <p className="text-xs text-zinc-300 italic">No directives scheduled.</p>
                  )}
                  {agendaForSelectedDay.map((goal) => (
                    <div key={goal.id} className="flex gap-4 items-start p-2 hover:bg-zinc-50 rounded-lg transition-colors">
                      <div className="text-[10px] font-bold font-mono text-zinc-300 pt-1 shrink-0">
                        {formatTime(normalizeScheduleTime(scheduleById[goal.id]))}
                      </div>
                      <div className={cn("text-sm font-medium", goal.completed && "line-through text-zinc-300")}>{goal.title}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-6">
            <div className="flex items-center gap-2 text-zinc-400">
              <Target className="w-4 h-4" />
              <p className="text-[10px] font-bold uppercase tracking-widest">Performance</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total', value: goals.length },
                { label: 'Done', value: goals.filter(g => g.completed).length },
                { label: 'Pending', value: goals.filter(g => !g.completed).length },
                { label: 'Rate', value: `${goals.length ? Math.round((goals.filter(g => g.completed).length / goals.length) * 100) : 0}%` }
              ].map(stat => (
                <div key={stat.label} className="minimal-card p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{stat.label}</p>
                  <p className="text-2xl font-extrabold mt-1">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="grid xl:grid-cols-[1.45fr_1fr] gap-4">
              <div className="minimal-card p-6">
                <div className="flex flex-wrap gap-2 justify-between mb-6">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Timeline</p>
                  <div className="flex gap-1.5">
                    {(["all", "high", "medium", "low"] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setUrgencyFilter(filter)}
                        className={cn(
                          "px-3 py-1 text-[9px] font-bold uppercase border rounded-full transition-all",
                          urgencyFilter === filter ? "bg-black text-white border-black" : "border-zinc-100 text-zinc-400 hover:border-zinc-300",
                        )}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>
                {Array.from({ length: 14 }).map((_, idx) => {
                  const hour = idx + 8;
                  const timelineDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), selectedCalendarDay);
                  const tasks = filteredGoals.filter((goal) => {
                    const taskTime = normalizeScheduleTime(scheduleById[goal.id]);
                    return occursOnDate(goal.id, timelineDate, dateById, recurrenceById) && taskTime.startsWith(`${String(hour).padStart(2, "0")}:`);
                  });
                  return (
                    <div
                      key={hour}
                      className="grid grid-cols-[76px_1fr] gap-4 border-t border-zinc-50 py-3"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (!draggingGoalId) return;
                        setScheduleById((prev) => ({ ...prev, [draggingGoalId]: `${String(hour).padStart(2, "0")}:00:00` }));
                        setDateById((prev) => ({ ...prev, [draggingGoalId]: isoForDisplayedDate(calendarDate, selectedCalendarDay) }));
                        setRecurrenceById((prev) => ({ ...prev, [draggingGoalId]: { type: "none", days: [] } }));
                        setDraggingGoalId(null);
                      }}
                    >
                      <div className="text-[10px] font-bold font-mono text-zinc-300">{formatHour(hour)}</div>
                      <div className="flex flex-wrap gap-2">
                        {tasks.map((goal) => (
                          <button
                            key={goal.id}
                            draggable
                            onDragStart={() => setDraggingGoalId(goal.id)}
                            onClick={() => requestCompleteGoal(goal.id)}
                            className={cn(
                              "px-3 py-1.5 text-xs font-medium rounded-xl border transition-all text-left",
                              goal.completed
                                ? "border-zinc-100 bg-zinc-50 text-zinc-300 line-through"
                                : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400 shadow-sm"
                            )}
                          >
                            {goal.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="minimal-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Registry</p>
                  <button
                    onClick={openModal}
                    className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center hover:bg-zinc-800 transition-all font-bold"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <div className="max-h-[500px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {filteredGoals.map((goal) => (
                    <DirectiveCard
                      key={goal.id}
                      goal={goal}
                      priority={priorityById[goal.id] || "medium"}
                      scheduledDate={normalizeTaskDate(dateById[goal.id])}
                      scheduledTime={normalizeScheduleTime(scheduleById[goal.id])}
                      recurrence={recurrenceById[goal.id] ?? { type: "none", days: [] }}
                      onSetPriority={(p) => setPriorityById((prev) => ({ ...prev, [goal.id]: p }))}
                      onSetScheduledDate={(date) => setDateById((prev) => ({ ...prev, [goal.id]: normalizeTaskDate(date) }))}
                      onSetScheduledTime={(time) => setScheduleById((prev) => ({ ...prev, [goal.id]: time }))}
                      onSetRecurrence={(value) => setRecurrenceById((prev) => ({ ...prev, [goal.id]: value }))}
                      onComplete={() => requestCompleteGoal(goal.id)}
                      onDelete={() => deleteGoal(goal.id)}
                    />
                  ))}
                  {goals.length === 0 && <EmptyVault />}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <AnimatePresence>
        {showTaskModal && (
          <TaskCreateModal
            draftTaskTitle={draftTaskTitle}
            setDraftTaskTitle={setDraftTaskTitle}
            draftTaskType={draftTaskType}
            setDraftTaskType={setDraftTaskType}
            draftTaskPriority={draftTaskPriority}
            setDraftTaskPriority={setDraftTaskPriority}
            draftTaskDate={draftTaskDate}
            setDraftTaskDate={setDraftTaskDate}
            draftTaskTime={draftTaskTime}
            setDraftTaskTime={setDraftTaskTime}
            draftRecurrenceType={draftRecurrenceType}
            setDraftRecurrenceType={setDraftRecurrenceType}
            draftRecurrenceDays={draftRecurrenceDays}
            setDraftRecurrenceDays={setDraftRecurrenceDays}
            onCancel={() => setShowTaskModal(false)}
            onSubmit={handleAdd}
          />
        )}
        {proofTargetId && (
          <ProofModal
            onClose={() => setProofTargetId(null)}
            onSubmit={(proof) => {
              completeWithProof(proofTargetId, proof);
              setProofTargetId(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function DirectiveCard({
  goal,
  priority,
  scheduledDate,
  scheduledTime,
  recurrence,
  onSetPriority,
  onSetScheduledDate,
  onSetScheduledTime,
  onSetRecurrence,
  onComplete,
  onDelete
}: {
  goal: Goal,
  priority: Priority,
  scheduledDate: string,
  scheduledTime: string,
  recurrence: { type: RecurrenceType; days: number[] },
  onSetPriority: (p: Priority) => void,
  onSetScheduledDate: (date: string) => void,
  onSetScheduledTime: (time: string) => void,
  onSetRecurrence: (value: { type: RecurrenceType; days: number[] }) => void,
  onComplete: () => void,
  onDelete: () => void,
  key?: string
}) {
  const swipeX = useMotionValue(0);
  const swipeBg = useTransform(swipeX, [0, 80], ["rgba(0,0,0,0)", "rgba(34, 197, 94, 0.1)"]);
  const successOpacity = useTransform(swipeX, [20, 80], [0, 1]);
  const iconScale = useTransform(swipeX, [0, 60], [0.5, 1.2]);
  const iconRotate = useTransform(swipeX, [0, 100], [-45, 0]);
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

  const priorityMeta = {
    high: { label: "!", color: "text-red-500" },
    medium: { label: "•", color: "text-zinc-400" },
    low: { label: "v", color: "text-zinc-200" }
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-50 shadow-sm">
      <motion.div 
        style={{ x: swipeX, backgroundColor: swipeBg }}
        drag={goal.completed ? false : "x"}
        dragConstraints={{ left: 0, right: 120 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        className={cn(
          "bg-white px-3 py-2 flex items-center gap-3 relative z-10 transition-opacity",
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

        <div className="flex-1 flex flex-col min-w-0">
          <h3 className={cn("text-[11px] font-bold tracking-tight text-zinc-800 truncate leading-tight", goal.completed && "line-through")}>
            {goal.title}
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
             <div className="relative group/date">
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => onSetScheduledDate(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <span className="text-[7px] font-bold text-zinc-400 uppercase tracking-tighter hover:text-zinc-900 transition-colors">
                  {new Date(scheduledDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
             </div>
             <div className="relative group/time">
                <input
                  type="time"
                  step={1}
                  value={scheduledTime}
                  onChange={(e) => onSetScheduledTime(e.target.value.length === 5 ? `${e.target.value}:00` : e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <span className="text-[7px] font-bold text-zinc-400 uppercase tracking-tighter hover:text-zinc-900 transition-colors">
                  {formatTime(scheduledTime).slice(0, 5)}
                </span>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <select
            value={priority}
            onChange={(e) => onSetPriority(e.target.value as Priority)}
            className={cn(
              "bg-transparent border-none text-[8px] font-black focus:outline-none cursor-pointer appearance-none px-1",
              priorityMeta[priority]?.color
            )}
          >
            <option value="high">HIGH</option>
            <option value="medium">MED</option>
            <option value="low">LOW</option>
          </select>
          <button onClick={onDelete} className="text-zinc-100 hover:text-red-500 transition-colors p-1">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        {/* Swipe Hint */}
        {!goal.completed && (
          <motion.div 
            style={{ opacity: hintOpacity }}
            className="flex items-center gap-0.5 opacity-20 pointer-events-none transition-opacity"
          >
            <span className="text-[6px] font-black tracking-widest text-zinc-300 uppercase">SWIPE</span>
            <ChevronRight className="w-2.5 h-2.5 text-zinc-100" />
          </motion.div>
        )}
      </motion.div>

      {/* Swipe Success Background */}
      <motion.div 
        style={{ opacity: successOpacity }}
        className="absolute inset-y-0 left-0 w-full bg-green-50/50 flex items-center px-4 pointer-events-none"
      >
         <motion.div style={{ scale: iconScale, rotate: iconRotate }} className="mr-2">
           <Check className="w-4 h-4 text-green-600" />
         </motion.div>
         <span className="text-[8px] font-black text-green-600 uppercase tracking-[0.3em]">COMPLETE &gt;&gt;</span>
      </motion.div>
    </div>
  );
}

function TaskCreateModal({
  draftTaskTitle,
  setDraftTaskTitle,
  draftTaskType,
  setDraftTaskType,
  draftTaskPriority,
  setDraftTaskPriority,
  draftTaskDate,
  setDraftTaskDate,
  draftTaskTime,
  setDraftTaskTime,
  draftRecurrenceType,
  setDraftRecurrenceType,
  draftRecurrenceDays,
  setDraftRecurrenceDays,
  onCancel,
  onSubmit,
}: {
  draftTaskTitle: string;
  setDraftTaskTitle: (v: string) => void;
  draftTaskType: GoalType;
  setDraftTaskType: (v: GoalType) => void;
  draftTaskPriority: Priority;
  setDraftTaskPriority: (v: Priority) => void;
  draftTaskDate: string;
  setDraftTaskDate: (v: string) => void;
  draftTaskTime: string;
  setDraftTaskTime: (v: string) => void;
  draftRecurrenceType: RecurrenceType;
  setDraftRecurrenceType: (v: RecurrenceType) => void;
  draftRecurrenceDays: number[];
  setDraftRecurrenceDays: (v: number[]) => void;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
    >
      <form onSubmit={onSubmit} className="w-full max-w-lg bg-white border border-zinc-200 p-8 rounded-3xl shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-50 pb-4">
          <h3 className="text-xl font-extrabold tracking-tighter">New Directive</h3>
          <button type="button" onClick={onCancel} className="text-zinc-300 hover:text-zinc-900"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex flex-col gap-4">
          <input
            value={draftTaskTitle}
            onChange={(e) => setDraftTaskTitle(e.target.value)}
            placeholder="Protocol title..."
            className="w-full bg-zinc-50 border border-zinc-100 px-4 py-3 text-sm text-zinc-900 rounded-xl focus:outline-none"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[8px] font-bold text-zinc-300 uppercase tracking-widest px-1">PROTOCOL_TYPE</span>
              <select value={draftTaskType} onChange={(e) => setDraftTaskType(e.target.value as GoalType)} className="bg-zinc-50 border border-zinc-100 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 rounded-xl focus:outline-none">
                <option value="pulse">pulse // small-scale</option>
                <option value="orbit" selected>orbit // recurring</option>
                <option value="galaxy">galaxy // expansion</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[8px] font-bold text-zinc-300 uppercase tracking-widest px-1">PRIORITY_LEVEL</span>
              <select value={draftTaskPriority} onChange={(e) => setDraftTaskPriority(e.target.value as Priority)} className="bg-zinc-50 border border-zinc-100 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 rounded-xl focus:outline-none">
                <option value="high">critical</option>
                <option value="medium">stable</option>
                <option value="low">minor</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={draftTaskDate} onChange={(e) => setDraftTaskDate(e.target.value)} className="bg-zinc-50 border border-zinc-100 px-3 py-2 text-xs text-zinc-600 rounded-xl" />
            <input type="time" step={1} value={draftTaskTime} onChange={(e) => setDraftTaskTime(e.target.value.length === 5 ? `${e.target.value}:00` : e.target.value)} className="bg-zinc-50 border border-zinc-100 px-3 py-2 text-xs text-zinc-600 rounded-xl" />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onCancel} className="px-6 py-2 text-xs font-bold uppercase tracking-widest text-zinc-400">Cancel</button>
          <button type="submit" className="minimal-button">Initiate</button>
        </div>
      </form>
    </motion.div>
  );
}

function EmptyVault() {
  return (
    <div className="py-20 flex flex-col items-center gap-4 text-center">
       <Target className="w-10 h-10 text-zinc-100" />
       <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-300">Vault silent.</p>
    </div>
  );
}

function ProofModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (proof?: Proof) => void }) {
  const [preview, setPreview] = useState("");
  const [fileName, setFileName] = useState("");
  const [kind, setKind] = useState<"image" | "video">("image");
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
    >
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-xl bg-white border border-zinc-200 p-8 rounded-3xl shadow-2xl">
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Proof of Sync</p>
            <h3 className="text-xl font-extrabold tracking-tighter">Attach evidence</h3>
          </div>
          <button onClick={onClose} className="text-zinc-300 hover:text-zinc-900"><X className="w-5 h-5" /></button>
        </div>
        <label className="block border-2 border-dashed border-zinc-100 rounded-3xl p-10 text-center cursor-pointer hover:bg-zinc-50 transition-all">
          <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0]; if (!file) return;
              const url = URL.createObjectURL(file); setPreview(url); setFileName(file.name);
              setKind(file.type.startsWith("video") ? "video" : "image");
            }} 
          />
          <div className="flex flex-col items-center gap-3">
            <Upload className="w-8 h-8 text-zinc-200" />
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Upload Media</span>
          </div>
        </label>
        {preview && (
          <div className="mt-6 border border-zinc-100 rounded-2xl overflow-hidden aspect-video">
            {kind === "image" ? <img src={preview} className="w-full h-full object-cover" /> : <video src={preview} controls className="w-full h-full object-cover" />}
          </div>
        )}
        <div className="mt-8 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2 text-xs font-bold uppercase tracking-widest text-zinc-400">Cancel</button>
          <button onClick={() => onSubmit(preview ? { kind, name: fileName, url: preview } : undefined)} className="minimal-button">Save Sync</button>
        </div>
      </motion.div>
    </motion.div>
  );
}


function formatHour(hour24: number) {
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = ((hour24 + 11) % 12) + 1;
  return `${hour12}:00 ${suffix}`;
}

function formatTime(value: string) {
  if (!value) return "--:--:--";
  return value;
}

function normalizeScheduleTime(value: unknown) {
  if (typeof value === "string" && /^\d{2}:\d{2}:\d{2}$/.test(value)) return value;
  if (typeof value === "string" && /^\d{2}:\d{2}$/.test(value)) return `${value}:00`;
  if (typeof value === "number" && Number.isFinite(value)) {
    const hour = Math.min(23, Math.max(0, Math.floor(value)));
    return `${String(hour).padStart(2, "0")}:00:00`;
  }
  // If no time is set, default to 00:00:00 or current time? 
  // User says it returns 9:00am anyway, which is this fallback.
  // Better to fallback to a clean start of day or something neutral, 
  // but if they just created it, it should have been set by handleAdd.
  return "00:00:00";
}

function getLocalISODate() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - (offset * 60 * 1000));
  return local.toISOString().slice(0, 10);
}

function getLocalTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:00`;
}

function todayISODate() {
  return getLocalISODate();
}

function normalizeTaskDate(value: unknown) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return todayISODate();
}

function isoForDisplayedDate(baseMonthDate: Date, day: number) {
  const d = new Date(baseMonthDate.getFullYear(), baseMonthDate.getMonth(), day);
  return d.toISOString().slice(0, 10);
}

function occursOnDate(
  goalId: string,
  date: Date,
  dateById: Record<string, string>,
  recurrenceById: Record<string, { type: RecurrenceType; days: number[] }>,
) {
  const base = normalizeTaskDate(dateById[goalId]);
  const recurrence = recurrenceById[goalId] ?? { type: "none", days: [] };
  const dateISO = date.toISOString().slice(0, 10);
  if (recurrence.type === "none") {
    return base === dateISO;
  }
  if (recurrence.type === "weekly") {
    const weekDays = recurrence.days.length ? recurrence.days : [new Date(base).getDay()];
    return weekDays.includes(date.getDay());
  }
  const monthDays = recurrence.days.length ? recurrence.days : [new Date(base).getDate()];
  return monthDays.includes(date.getDate());
}
