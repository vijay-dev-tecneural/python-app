import { useCallback, useEffect, useState } from 'react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_URL || ''

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Request failed (${res.status})`)
  }
  if (res.status === 204) return null
  return res.json()
}

function App() {
  const [todos, setTodos] = useState([])
  const [title, setTitle] = useState('')
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setError('')
    try {
      const [healthData, todoData] = await Promise.all([
        api('/api/health'),
        api('/api/todos'),
      ])
      setHealth(healthData)
      setTodos(todoData)
    } catch (err) {
      setError(err.message || 'Failed to reach API')
      setHealth(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleAdd(e) {
    e.preventDefault()
    const value = title.trim()
    if (!value || busy) return
    setBusy(true)
    setError('')
    try {
      const created = await api('/api/todos', {
        method: 'POST',
        body: JSON.stringify({ title: value }),
      })
      setTodos((prev) => [created, ...prev])
      setTitle('')
    } catch (err) {
      setError(err.message || 'Could not create todo')
    } finally {
      setBusy(false)
    }
  }

  async function toggleTodo(todo) {
    setBusy(true)
    setError('')
    try {
      const updated = await api(`/api/todos/${todo.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: !todo.completed }),
      })
      setTodos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch (err) {
      setError(err.message || 'Could not update todo')
    } finally {
      setBusy(false)
    }
  }

  async function removeTodo(id) {
    setBusy(true)
    setError('')
    try {
      await api(`/api/todos/${id}`, { method: 'DELETE' })
      setTodos((prev) => prev.filter((t) => t.id !== id))
    } catch (err) {
      setError(err.message || 'Could not delete todo')
    } finally {
      setBusy(false)
    }
  }

  const remaining = todos.filter((t) => !t.completed).length

  return (
    <div className="page">
      <header className="header">
        <div>
          <p className="eyebrow">Full-stack demo</p>
          <h1>React + FastAPI + Postgres</h1>
          <p className="subtitle">
            Three containers: frontend, API, and database — wired for local and
            Compose runs.
          </p>
        </div>
        <div className="status-card">
          <span className="status-label">API health</span>
          {health ? (
            <>
              <strong className="ok">{health.status}</strong>
              <span className="muted">DB: {health.database}</span>
            </>
          ) : (
            <strong className="bad">{loading ? 'checking…' : 'unreachable'}</strong>
          )}
          <button type="button" className="ghost" onClick={refresh} disabled={busy}>
            Refresh
          </button>
        </div>
      </header>

      <main className="panel">
        <form className="composer" onSubmit={handleAdd}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a todo…"
            maxLength={255}
            disabled={busy}
            aria-label="Todo title"
          />
          <button type="submit" disabled={busy || !title.trim()}>
            Add
          </button>
        </form>

        {error && <p className="error">{error}</p>}

        {loading ? (
          <p className="muted center">Loading todos…</p>
        ) : todos.length === 0 ? (
          <p className="muted center empty">
            No todos yet. Create one above — it is stored in PostgreSQL.
          </p>
        ) : (
          <ul className="todo-list">
            {todos.map((todo) => (
              <li key={todo.id} className={todo.completed ? 'done' : ''}>
                <label>
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => toggleTodo(todo)}
                    disabled={busy}
                  />
                  <span>{todo.title}</span>
                </label>
                <button
                  type="button"
                  className="ghost danger"
                  onClick={() => removeTodo(todo.id)}
                  disabled={busy}
                  aria-label={`Delete ${todo.title}`}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}

        <footer className="footer">
          <span>
            {todos.length} total · {remaining} remaining
          </span>
          <span className="muted">
            API base: {API_BASE || '/api (proxied / same origin)'}
          </span>
        </footer>
      </main>
    </div>
  )
}

export default App
