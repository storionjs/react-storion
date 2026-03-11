import './App.css'
import { useEffect, useMemo, useState } from 'react'
import { createDatabase, type Database, type StorionChangeEvent } from 'storion'

type Todo = {
  id: number
  title: string
  completed: boolean
}

type LogEntry = {
  message: string
  response: StorionChangeEvent
  time: string
}

const TABLE_NAME = 'todos'

async function initDatabase(): Promise<Database> {
  const db = await createDatabase({
    name: 'react-storion-todos',
    storage: 'localStorage',
  })

  const tables = await db.listTables()
  if (!tables.includes(TABLE_NAME)) {
    await db.createTable(TABLE_NAME, [
      { name: 'id', type: 'int' },
      { name: 'title', type: 'string' },
      { name: 'completed', type: 'boolean' },
    ])
  }

  return db
}

function App() {
  const [db, setDb] = useState<Database | null>(null)
  const [todos, setTodos] = useState<Todo[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])

  const completedCount = useMemo(
    () => todos.filter((t) => t.completed).length,
    [todos],
  )
  const activeCount = useMemo(
    () => todos.filter((t) => !t.completed).length,
    [todos],
  )

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | null = null

    ;(async () => {
      try {
        const database = await initDatabase()
        if (cancelled) return
        setDb(database)
        await refreshTodos(database, setTodos)

        // Subscribe to todos table so any change (from this component or others sharing the DB)
        // triggers a refresh and a new log entry.
        unsubscribe = database.subscribe('todos', async (event) => {
          if (cancelled) return
          setLogEntries((entries) => [
            ...entries,
            {
              message: `todos: ${event.type}${
                event.rowId != null ? ` (id=${event.rowId})` : ''
              }`,
              response: event,
              time: new Date().toLocaleTimeString(),
            },
          ])
          await refreshTodos(database, setTodos)
        })
      } catch (e) {
        console.error('Storion init failed', e)
        if (!cancelled) setError('Failed to initialize database.')
      } finally {
        if (!cancelled) setIsReady(true)
      }
    })()

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  if (!isReady) {
    return (
      <div className="app-root">
        <h1>React Storion TODOs</h1>
        <p>Initializing database...</p>
      </div>
    )
  }

  if (!db) {
    return (
      <div className="app-root">
        <h1>React Storion TODOs</h1>
        <p>Database not available.</p>
      </div>
    )
  }

  const handleAdd = async () => {
    const title = newTitle.trim()
    if (!title) return
    await db.insert(TABLE_NAME, { title, completed: false })
    setNewTitle('')
    await refreshTodos(db, setTodos)
  }

  const startEdit = (todo: Todo) => {
    setEditingId(todo.id)
    setEditTitle(todo.title)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditTitle('')
  }

  const saveEdit = async () => {
    if (editingId == null) return
    const title = editTitle.trim()
    if (title) {
      await db.update(TABLE_NAME, editingId, { title })
      await refreshTodos(db, setTodos)
    }
    cancelEdit()
  }

  const toggleCompleted = async (todo: Todo) => {
    await db.update(TABLE_NAME, todo.id, { completed: !todo.completed })
    await refreshTodos(db, setTodos)
  }

  const remove = async (todo: Todo) => {
    await db.delete(TABLE_NAME, todo.id)
    await refreshTodos(db, setTodos)
  }

  return (
    <div className="app-root">
      <h1>React Storion TODOs</h1>

      {error && <div className="error">{error}</div>}

      <div className="side-by-side">
        <section className="todo-view">
          <div className="component-box">
            <div className="todo-input">
              <input
                type="text"
                placeholder="What needs to be done?"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    await handleAdd()
                  }
                }}
              />
              <button onClick={handleAdd}>Add</button>
            </div>

            <ul className="todo-list">
              {todos.map((todo) => {
                const isEditing = editingId === todo.id
                return (
                  <li key={todo.id} className={todo.completed ? 'completed' : ''}>
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={async () => {
                        await toggleCompleted(todo)
                      }}
                    />

                    {isEditing ? (
                      <input
                        className="edit-input"
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            await saveEdit()
                          } else if (e.key === 'Escape') {
                            e.preventDefault()
                            cancelEdit()
                          }
                        }}
                      />
                    ) : (
                      <span className="title">{todo.title}</span>
                    )}

                    <div className="actions">
                      {isEditing ? (
                        <>
                          <button onClick={saveEdit}>Save</button>
                          <button onClick={cancelEdit}>Cancel</button>
                        </>
                      ) : (
                        <button onClick={() => startEdit(todo)}>Edit</button>
                      )}
                      <button className="danger" onClick={() => remove(todo)}>
                        Delete
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>

            <footer className="footer">
              <span>{activeCount} active</span>
              <span>{completedCount} completed</span>
            </footer>

            <div className="component-label">Component 1</div>
          </div>
        </section>

        <aside className="log-view">
          <div className="component-box">
            <h2 className="log-title">Todos table changes</h2>
            <p className="log-hint">
              Events from <code>db.subscribe(&apos;todos&apos;, …)</code> — each change is
              logged below.
            </p>
            <ul className="log-list">
              {logEntries.length > 0 ? (
                logEntries.map((entry) => (
                  <li key={entry.time + entry.message} className="log-item">
                    <span className="log-time">{entry.time}</span>
                    <span className="log-message">{entry.message}</span>
                    <pre className="log-response">
                      {JSON.stringify(entry.response, null, 2)}
                    </pre>
                  </li>
                ))
              ) : (
                <li className="log-empty">
                  No events yet. Add, edit, or delete a todo to see events here.
                </li>
              )}
            </ul>

            <div className="component-label">Component 2</div>
          </div>
        </aside>
      </div>
    </div>
  )
}

async function refreshTodos(
  db: Database,
  setTodos: (todos: Todo[]) => void,
): Promise<void> {
  const { rows } = await db.query(TABLE_NAME, {
    orderBy: [{ field: 'id', direction: 'asc' }],
  })
  setTodos((rows as unknown as Todo[]).slice())
}

export default App
