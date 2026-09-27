import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '@astryxdesign/core';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { CHART_HUES } from '../../kit/chart-hues';
import { formatDuration, parseDuration, type TimerConfig } from '../../../shared/widgets/timer';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import styles from './timer.module.css';

type Mode = 'timer' | 'stopwatch';

interface TimerState {
  /** Remaining (timer) or elapsed (stopwatch) seconds at last tick. */
  seconds: number;
  running: boolean;
  mode: Mode;
  /** epoch ms when running started, for drift-free ticking. */
  startedAt: number | null;
}

function loadState(key: string, defaultSeconds: number): TimerState {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const s = JSON.parse(raw) as Partial<TimerState> & { notes?: string };
      if (typeof s.seconds === 'number' && (s.mode === 'timer' || s.mode === 'stopwatch')) {
        return {
          seconds: s.seconds,
          running: s.running === true,
          mode: s.mode,
          startedAt: s.running === true && typeof s.startedAt === 'number' ? s.startedAt : null,
        };
      }
    }
  } catch {
    // corrupted state — fall through to defaults
  }
  return { seconds: defaultSeconds, running: false, mode: 'timer', startedAt: null };
}

/** Circle geometry — viewBox 100x100, r=44 leaves room for the stroke. */
const R = 44;
const CIRC = 2 * Math.PI * R;

const RING_STYLE = { '--ring-hue': CHART_HUES.cyan } as React.CSSProperties;

function loadNotes(key: string): string {
  try {
    return localStorage.getItem(`${key}.notes`) ?? '';
  } catch {
    return '';
  }
}

function persist(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable — the timer just won't persist
  }
}

/** A stopped state at the start of `mode`: the configured duration for the
 *  countdown, zero for the stopwatch. Switching mode and Reset are the same
 *  move, so they share it. */
function idle(mode: Mode, defaultSeconds: number): TimerState {
  return { seconds: mode === 'timer' ? defaultSeconds : 0, running: false, mode, startedAt: null };
}

/** Drift-free tick: seconds are always derived from `startedAt`, so a late
 *  interval costs no accuracy. A countdown that hits zero stops itself. */
function advance(prev: TimerState): TimerState {
  if (prev.startedAt === null) return prev;
  const elapsed = (Date.now() - prev.startedAt) / 1000;
  if (prev.mode === 'timer') {
    const next = Math.max(0, prev.seconds - elapsed);
    return next <= 0 ? { ...prev, seconds: 0, running: false, startedAt: null } : { ...prev, seconds: next };
  }
  return { ...prev, seconds: prev.seconds + elapsed, startedAt: Date.now() };
}

/** Pause folds the elapsed time into `seconds`; a spent countdown that is not
 *  being retyped restarts from the configured duration. */
function toggled(prev: TimerState, defaultSeconds: number, editing: boolean): TimerState {
  if (prev.running) {
    const elapsed = prev.startedAt !== null ? (Date.now() - prev.startedAt) / 1000 : 0;
    const next =
      prev.mode === 'timer' ? Math.max(0, prev.seconds - elapsed) : prev.seconds + elapsed;
    return { ...prev, seconds: next, running: false, startedAt: null };
  }
  if (prev.mode === 'timer' && prev.seconds <= 0 && !editing) {
    return { ...prev, seconds: defaultSeconds, running: true, startedAt: Date.now() };
  }
  return { ...prev, running: true, startedAt: Date.now() };
}

/** Fraction of the countdown left, 0-1. A stopwatch has no arc, so it reads 0. */
function ringFraction(state: TimerState, defaultSeconds: number): number {
  if (state.mode !== 'timer') return 0;
  const total = Math.max(defaultSeconds, state.seconds);
  return total > 0 ? Math.max(0, Math.min(1, state.seconds / total)) : 0;
}

function ModeTabs({ mode, onSelect }: { mode: Mode; onSelect: (mode: Mode) => void }) {
  return (
    <div className={styles.modeRow} role="tablist" aria-label="Timer mode">
      {(['timer', 'stopwatch'] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="tab"
          aria-selected={mode === m}
          className={mode === m ? `${styles.modeTab} ${styles.modeTabActive}` : styles.modeTab}
          onClick={() => onSelect(m)}
        >
          {m[0].toUpperCase() + m.slice(1)}
        </button>
      ))}
    </div>
  );
}

/** The dial itself — identical whether the seconds are on display or being
 *  typed, so the two wrappers share it. */
function RingDial({ mode, seconds, fraction }: { mode: Mode; seconds: number; fraction: number }) {
  return (
    <svg viewBox="0 0 100 100" className={styles.ring} aria-hidden="true">
      <circle cx="50" cy="50" r={R} className={styles.ringTrack} />
      {mode === 'timer' ? (
        <circle
          cx="50"
          cy="50"
          r={R}
          className={`${styles.ringValue} ${seconds <= 0 ? styles.ringDone : ''}`}
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - fraction)}
        />
      ) : null}
    </svg>
  );
}

function TimerControls({
  running,
  onToggle,
  onReset,
}: {
  running: boolean;
  onToggle: () => void;
  onReset: () => void;
}) {
  return (
    <div className={styles.controls}>
      <Button label={running ? 'Pause' : 'Start'} onClick={onToggle} data-testid="timer-toggle">
        {running ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
        {running ? 'Pause' : 'Start'}
      </Button>
      <Button label="Reset" isIconOnly onClick={onReset} aria-label="Reset" data-testid="timer-reset">
        <RotateCcw size={14} aria-hidden="true" />
      </Button>
    </div>
  );
}

export function Timer({ config }: WidgetComponentProps) {
  const cfg = config as unknown as TimerConfig;
  const storageKey = `glimpse.timer.${cfg.id ?? 'default'}`;
  const defaultSeconds = useMemo(() => parseDuration(cfg.duration ?? '25m'), [cfg.duration]);

  const [state, setState] = useState<TimerState>(() => loadState(storageKey, defaultSeconds));
  const [notes, setNotes] = useState<string>(() => loadNotes(storageKey));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const draftRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    persist(storageKey, JSON.stringify(state));
  }, [state, storageKey]);

  useEffect(() => {
    persist(`${storageKey}.notes`, notes);
  }, [notes, storageKey]);

  // Drift-free tick: derive seconds from startedAt each interval.
  useEffect(() => {
    if (!state.running || state.startedAt === null) return;
    const id = window.setInterval(() => setState(advance), 250);
    return () => window.clearInterval(id);
  }, [state.running, state.startedAt, state.mode]);

  const toggle = useCallback(() => {
    setState((prev) => toggled(prev, defaultSeconds, editing));
  }, [defaultSeconds, editing]);

  const reset = useCallback(() => {
    setState((prev) => idle(prev.mode, defaultSeconds));
  }, [defaultSeconds]);

  const setMode = useCallback((mode: Mode) => {
    setState(() => idle(mode, defaultSeconds));
  }, [defaultSeconds]);

  const commitDraft = () => {
    const parsed = parseDuration(draft);
    if (parsed > 0) {
      setState((prev) => ({ ...prev, seconds: parsed, running: false, startedAt: null }));
    }
    setEditing(false);
  };

  const onDraftKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitDraft();
    if (e.key === 'Escape') setEditing(false);
  };

  const fraction = ringFraction(state, defaultSeconds);

  const startEdit = () => {
    setDraft(formatDuration(state.seconds));
    setEditing(true);
    setTimeout(() => draftRef.current?.select(), 0);
  };

  return (
    <WidgetChrome
      title={cfg.title}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
    >
      <div className={styles.wrap} data-testid="timer-widget" data-mode={state.mode}>
        <ModeTabs mode={state.mode} onSelect={setMode} />

        {editing ? (
          <div
            className={styles.ringButton}
            data-testid="timer-ring"
            style={RING_STYLE}
          >
            <RingDial mode={state.mode} seconds={state.seconds} fraction={fraction} />
            <input
              ref={draftRef}
              className={styles.timeInput}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={onDraftKey}
              aria-label="Duration"
              autoFocus
            />
          </div>
        ) : (
          <button
            type="button"
            className={styles.ringButton}
            onClick={startEdit}
            aria-label="Edit duration"
            data-testid="timer-ring"
            style={RING_STYLE}
          >
            <RingDial mode={state.mode} seconds={state.seconds} fraction={fraction} />
            <span className={styles.timeText} data-testid="timer-display">
              {formatDuration(state.seconds)}
            </span>
          </button>
        )}

        <TimerControls running={state.running} onToggle={toggle} onReset={reset} />

        {cfg.notes ? (
          <textarea
            className={styles.notes}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes…"
            aria-label="Notes"
            data-testid="timer-notes"
            rows={3}
          />
        ) : null}
      </div>
    </WidgetChrome>
  );
}

registerWidgetComponent('timer', Timer);
