## React + Storion

Integrate the `@storion/storion` client‑side database with a React application.

---

### Installation

```bash
npm install @storion/storion
```

or

```bash
yarn add @storion/storion
```

---

### Basic usage in React

Create a simple hook that initializes a database and exposes a typed API to your components.

```tsx
import { useEffect, useState } from 'react';
import { createDatabase } from '@storion/storion';

export function useStorionDb() {
  const [db, setDb] = useState<any | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const instance = await createDatabase({
        name: 'react-demo',
        storage: 'localStorage',
      });

      if (!cancelled) {
        setDb(instance);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return db;
}
```

Use the hook inside a component to create a table, insert rows, and query data:

```tsx
import { useEffect, useState } from 'react';
import { useStorionDb } from './useStorionDb';

type Todo = {
  id: number;
  title: string;
  done: boolean;
};

export function TodoList() {
  const db = useStorionDb();
  const [todos, setTodos] = useState<Todo[]>([]);

  useEffect(() => {
    if (!db) return;

    (async () => {
      await db.createTable('todos', [
        { name: 'id', type: 'int' },
        { name: 'title', type: 'string' },
        { name: 'done', type: 'boolean' },
      ]);

      const rows = await db.fetch('todos');
      setTodos(rows);
    })();
  }, [db]);

  const addTodo = async () => {
    if (!db) return;
    await db.insert('todos', { title: 'New todo', done: false });
    const rows = await db.fetch('todos');
    setTodos(rows);
  };

  if (!db) {
    return <p>Loading Storion…</p>;
  }

  return (
    <div>
      <h2>Todos</h2>
      <button onClick={addTodo}>Add todo</button>
      <ul>
        {todos.map((t) => (
          <li key={t.id}>
            {t.title} {t.done ? '✅' : '⬜️'}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

### React + Storion patterns

- **Single shared database instance**: create the `Database` once (for example, in a context provider) and pass it down or access via a custom hook.
- **Subscriptions for live UIs**: use `db.subscribe('todos', handler)` inside a `useEffect` to update React state whenever data changes.
- **Config‑driven schema**: for more complex apps, define your schema as JSON and use `createDatabase({ name, storage, config })`.

For full API details, see the main Storion docs.
