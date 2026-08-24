import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '@astryxdesign/core';
import { Pause, Play, RotateCcw } from 'lucide-react';
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

export function Timer({ config, isLoading, error }: WidgetComponentProps) {
  const cfg = config as unknown as TimerConfig;
  const storageKey = `glimpse.timer.${cfg.id ?? 'default'}`;
  const defaultSeconds = useMemo(() => parseDuration(cfg.duration ?? '25m'), [cfg.duration]);

  const [state, setState] = useState<TimerState>(() => loadState(storageKey, defaultSeconds));
  const [notes, setNotes] = useState<string>(() => {
    try {
      return localStorage.getItem(`${storageKey}.notes`) ?? '';
    } catch {
      return '';
    }
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const draftRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // storage unavailable — timer just won't persist
    }
  }, [state, storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(`${storageKey}.notes`, notes);
    } catch {
      // storage unavailable
    }
  }, [notes, storageKey]);

  // Drift-free tick: derive seconds from startedAt each interval.
  useEffect(() => {
    if (!state.running || state.startedAt === null) return;
    const id = window.setInterval(() => {
      setState((prev) => {
        if (prev.startedAt === null) return prev;
        const elapsed = (Date.now() - prev.startedAt) / 1000;
        if (prev.mode === 'timer') {
          const next = Math.max(0, prev.seconds - elapsed);
          return next <= 0 ? { ...prev, seconds: 0, running: false, startedAt: null } : { ...prev, seconds: next };
        }
        return { ...prev, seconds: prev.seconds + elapsed, startedAt: Date.now() };
      });
    }, 250);
    return () => window.clearInterval(id);
  }, [state.running, state.startedAt, state.mode]);

  const toggle = useCallback(() => {
    setState((prev) => {
      if (prev.running) {
        // pause: fold elapsed into seconds
        const elapsed = prev.startedAt !== null ? (Date.now() - prev.startedAt) / 1000 : 0;
        const next =
          prev.mode === 'timer' ? Math.max(0, prev.seconds - elapsed) : prev.seconds + elapsed;
        return { ...prev, seconds: next, running: false, startedAt: null };
      }
      if (prev.mode === 'timer' && prev.seconds <= 0 && !editing) {
        return { ...prev, seconds: defaultSeconds, running: true, startedAt: Date.now() };
      }
      return { ...prev, running: true, startedAt: Date.now() };
    });
  }, [defaultSeconds, editing]);

  const reset = useCallback(() => {
    setState((prev) => ({
      ...prev,
      seconds: prev.mode === 'timer' ? defaultSeconds : 0,
      running: false,
      startedAt: null,
    }));
  }, [defaultSeconds]);

  const setMode = useCallback((mode: Mode) => {
    setState(() => ({ seconds: mode === 'timer' ? defaultSeconds : 0, running: false, mode, startedAt: null }));
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

  const displayTotal = state.mode === 'timer' ? Math.max(defaultSeconds, state.seconds) : 0;
  const fraction =
    state.mode === 'timer'
      ? displayTotal > 0
        ? Math.max(0, Math.min(1, state.seconds / displayTotal))
        : 0
      : 0;

  const startEdit = () => {
    setDraft(formatDuration(state.mode === 'timer' ? state.seconds : state.seconds));
    setEditing(true);
    setTimeout(() => draftRef.current?.select(), 0);
  };

  return (
    <WidgetChrome
      title={cfg.title}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
      isLoading={isLoading}
      error={error}
    >
      <div className={styles.wrap} data-testid="timer-widget" data-mode={state.mode}>
        <div className={styles.modeRow} role="tablist" aria-label="Timer mode">
          {(['timer', 'stopwatch'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={state.mode === m}
              className={state.mode === m ? `${styles.modeTab} ${styles.modeTabActive}` : styles.modeTab}
              onClick={() => setMode(m)}
            >
              {m[0].toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>

        <button
          type="button"
          className={styles.ringButton}
          onClick={editing ? undefined : startEdit}
          aria-label={editing ? undefined : 'Edit duration'}
          data-testid="timer-ring"
        >
          <svg viewBox="0 0 100 100" className={styles.ring} aria-hidden="true">
            <circle cx="50" cy="50" r={R} className={styles.ringTrack} />
            {state.mode === 'timer' ? (
              <circle
                cx="50"
                cy="50"
                r={R}
                className={`${styles.ringValue} ${state.seconds <= 0 ? styles.ringDone : ''}`}
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - fraction)}
              />
            ) : null}
          </svg>
          {editing ? (
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
          ) : (
            <span className={styles.timeText} data-testid="timer-display">
              {formatDuration(state.seconds)}
            </span>
          )}
        </button>

        <div className={styles.controls}>
          <Button label={state.running ? 'Pause' : 'Start'} onClick={toggle} data-testid="timer-toggle">
            {state.running ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
            {state.running ? 'Pause' : 'Start'}
          </Button>
          <Button label="Reset" isIconOnly onClick={reset} aria-label="Reset" data-testid="timer-reset">
            <RotateCcw size={14} aria-hidden="true" />
          </Button>
        </div>

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
