import { useEffect, useRef, useState } from 'react';
import { Button, TextInput } from '@astryxdesign/core';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Pencil, Trash2 } from 'lucide-react';
import { todoSchema } from '../../../shared/widgets/todo';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import styles from './todo.module.css';

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

function load(key: string): TodoItem[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (t): t is TodoItem =>
          typeof t === 'object' &&
          t !== null &&
          typeof (t as TodoItem).text === 'string',
      )
      .map((t) => ({
        id: typeof t.id === 'string' ? t.id : crypto.randomUUID(),
        text: t.text,
        done: t.done === true,
      }));
  } catch {
    return [];
  }
}

export function Todo({ config }: WidgetComponentProps) {
  const cfg = todoSchema.parse(config);
  const storageKey = `glimpse.todo.${cfg.id ?? 'default'}`;
  const [items, setItems] = useState<TodoItem[]>(() => load(storageKey));
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // storage unavailable — todo just won't persist
    }
  }, [items, storageKey]);

  const add = () => {
    const t = text.trim();
    if (!t) return;
    setItems((prev) => [...prev, { id: crypto.randomUUID(), text: t, done: false }]);
    setText('');
    inputRef.current?.focus();
  };

  const toggle = (id: string) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));

  const remove = (id: string) =>
    setItems((prev) => prev.filter((i) => i.id !== id));

  const startEdit = (item: TodoItem) => {
    setEditingId(item.id);
    setEditText(item.text);
  };

  const commitEdit = () => {
    const t = editText.trim();
    if (t && editingId) {
      setItems((prev) => prev.map((i) => (i.id === editingId ? { ...i, text: t } : i)));
    }
    setEditingId(null);
  };

  return (
    <WidgetChrome title={cfg.title} titleUrl={cfg['title-url']} hideHeader={cfg['hide-header']} cssClass={cfg['css-class']}>
      <div className={styles.form}>
        <TextInput
          ref={inputRef}
          label="New task"
          isLabelHidden
          value={text}
          onChange={setText}
          placeholder="Add a task…"
          onEnter={add}
          hasClear
        />
        <Button label="Add" size="sm" onClick={add} />
      </div>
      {items.length === 0 ? (
        <div className={styles.empty}>No tasks yet.</div>
      ) : (
        items.map((item) => (
          <div key={item.id} className={styles.item}>
            <CheckboxInput
              value={item.done}
              onChange={() => toggle(item.id)}
              label={item.text}
              isLabelHidden
            />
            {editingId === item.id ? (
              <TextInput
                label="Edit task"
                isLabelHidden
                value={editText}
                onChange={setEditText}
                onEnter={commitEdit}
                hasAutoFocus
                className={styles.editInput}
              />
            ) : (
              <span className={`${styles.itemText} ${item.done ? styles.done : ''}`}>
                {item.text}
              </span>
            )}
            <button
              type="button"
              className={styles.iconBtn}
              aria-label={`Edit ${item.text}`}
              onClick={() => (editingId === item.id ? commitEdit() : startEdit(item))}
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              aria-label={`Delete ${item.text}`}
              onClick={() => remove(item.id)}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))
      )}
    </WidgetChrome>
  );
}

registerWidgetComponent('todo', Todo);
