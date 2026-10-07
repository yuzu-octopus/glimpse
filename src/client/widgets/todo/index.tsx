import { Button, CheckboxInput, IconButton, Stack, Text, TextInput } from "@astryxdesign/core";
import { Pencil, Trash2 } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { localStateKey } from "../../../shared/widgets/local-state";
import type { TodoConfig } from "../../../shared/widgets/todo";
import { WidgetChrome } from "../../components/WidgetChrome";
import { registerWidgetComponent, type WidgetComponentProps } from "../registry";
import styles from "./todo.module.css";

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
					typeof t === "object" && t !== null && typeof (t as TodoItem).text === "string",
			)
			.map((t) => ({
				id: typeof t.id === "string" ? t.id : crypto.randomUUID(),
				text: t.text,
				done: t.done === true,
			}));
	} catch {
		return [];
	}
}

export function Todo({ config }: WidgetComponentProps) {
	const cfg = config as unknown as TodoConfig;
	const storageKey = localStateKey("todo", cfg.id);
	const [items, setItems] = useState<TodoItem[]>(() => load(storageKey));
	const [text, setText] = useState("");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editText, setEditText] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);
	const editRefs = useRef<Array<HTMLButtonElement | null>>([]);

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
		setText("");
		inputRef.current?.focus();
	};

	/** Ctrl+Enter (or Cmd+Enter) prepends to the top (glance parity). */
	const addTop = () => {
		const t = text.trim();
		if (!t) return;
		setItems((prev) => [{ id: crypto.randomUUID(), text: t, done: false }, ...prev]);
		setText("");
		inputRef.current?.focus();
	};

	/** Enter appends; Ctrl/Cmd+Enter prepends; ArrowDown jumps to the last
	 * item's edit button so the list stays keyboard-reachable. */
	const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			if (e.ctrlKey || e.metaKey) {
				e.preventDefault();
				addTop();
			} else {
				add();
			}
		} else if (e.key === "ArrowDown" && items.length > 0) {
			e.preventDefault();
			editRefs.current[items.length - 1]?.focus();
		}
	};

	const toggle = (id: string) =>
		setItems((prev) => prev.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));

	const remove = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

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
		<WidgetChrome
			title={cfg.title}
			titleUrl={cfg["title-url"]}
			hideHeader={cfg["hide-header"]}
			cssClass={cfg["css-class"]}
		>
			<Stack direction="horizontal" gap={2} vAlign="center" className={styles.form}>
				<TextInput
					ref={inputRef}
					label="New task"
					isLabelHidden
					size="sm"
					value={text}
					onChange={setText}
					placeholder="Add a task…"
					onKeyDown={handleInputKeyDown}
					width="100%"
				/>
				<Button label="Add" size="sm" onClick={add} />
			</Stack>
			{items.length === 0 ? (
				<Text type="supporting" className={styles.empty}>
					No tasks yet.
				</Text>
			) : (
				items.map((item, i) => (
					<Stack
						key={item.id}
						direction="horizontal"
						gap={2}
						vAlign="center"
						className={`${styles.item} ${i === 0 ? "" : styles.itemDivided}`}
					>
						<CheckboxInput
							label={item.text}
							isLabelHidden
							value={item.done}
							onChange={() => toggle(item.id)}
							size="md"
						/>
						{editingId === item.id ? (
							<TextInput
								label="Edit task"
								isLabelHidden
								size="sm"
								value={editText}
								onChange={setEditText}
								hasAutoFocus
								onKeyDown={(e) => {
									if (e.key === "Enter") commitEdit();
									if (e.key === "Escape") setEditingId(null);
								}}
								width="100%"
							/>
						) : (
							<Text
								type="body"
								hasStrikethrough={item.done}
								color={item.done ? "secondary" : "primary"}
								data-testid="todo-item-text"
								className={styles.itemText}
							>
								{item.text}
							</Text>
						)}
						<IconButton
							ref={(el) => {
								editRefs.current[i] = el;
							}}
							label={`Edit ${item.text}`}
							icon={<Pencil size={13} />}
							onClick={() => (editingId === item.id ? commitEdit() : startEdit(item))}
							size="sm"
							variant="ghost"
						/>
						<IconButton
							label={`Delete ${item.text}`}
							icon={<Trash2 size={13} />}
							onClick={() => remove(item.id)}
							size="sm"
							variant="ghost"
						/>
					</Stack>
				))
			)}
		</WidgetChrome>
	);
}

registerWidgetComponent("todo", Todo);
