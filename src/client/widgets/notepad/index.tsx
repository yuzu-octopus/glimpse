import { useEffect, useState } from 'react';
import type { NotepadConfig } from '../../../shared/widgets/notepad';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import styles from './notepad.module.css';

export function Notepad({ config }: WidgetComponentProps) {
  const cfg = config as unknown as NotepadConfig;
  const key = `glimpse.notepad.${cfg.id ?? 'default'}`;
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem(key) ?? '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, text);
    } catch {
      // ignore
    }
  }, [key, text]);

  return (
    <WidgetChrome title={cfg.title} titleUrl={cfg['title-url']} hideHeader={cfg['hide-header']} cssClass={cfg['css-class']}>
      <textarea
        className={styles.area}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={cfg.placeholder ?? 'Type here…'}
        aria-label={cfg.title ?? 'Notepad'}
        data-testid="notepad-area"
      />
    </WidgetChrome>
  );
}

registerWidgetComponent('notepad', Notepad);
