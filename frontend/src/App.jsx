import React, { useEffect, useMemo, useState } from "react";

const API = "http://localhost:3000/todos";

const statusLabels = {
  todo: "To Do",
  "in-progress": "In Progress",
  done: "Done",
};

const apiStatuses = {
  todo: "TODO",
  "in-progress": "IN_PROGRESS",
  done: "DONE",
};

function normalizeTodo(todo) {
  const statuses = {
    TODO: "todo",
    todo: "todo",
    IN_PROGRESS: "in-progress",
    "in-progress": "in-progress",
    DONE: "done",
    done: "done",
  };
  const status = statuses[todo.status];

  if (todo.id == null || typeof todo.title !== "string" || !status) {
    throw new Error("The server returned a task with an invalid format.");
  }

  return {
    id: String(todo.id),
    title: todo.title,
    status,
    priority: Boolean(todo.priority),
  };
}

async function getTodos(signal) {
  const response = await fetch(API, { signal });
  if (!response.ok) {
    throw new Error(`Unable to load tasks (HTTP ${response.status}).`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("The server returned an invalid task list.");
  }
  return data.map(normalizeTodo);
}

function Icon({ name, size = 18, strokeWidth = 1.8 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  const paths = {
    check: <><path d="m5 12 4 4L19 6" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    star: <><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" /></>,
    inbox: <><path d="M4 4h16v16H4z" /><path d="M4 13h4l2 3h4l2-3h4" /></>,
    circle: <><circle cx="12" cy="12" r="8" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    chevron: <><path d="m9 18 6-6-6-6" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    trash: <><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" /></>,
    grip: <><circle cx="9" cy="5" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="19" r="1" /><circle cx="15" cy="19" r="1" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" /><path d="m19 14 1.1 2.9L23 18l-2.9 1.1L19 22l-1.1-2.9L15 18l2.9-1.1L19 14Z" /></>,
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function App() {
  const [todos, setTodos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [modal, setModal] = useState(null);
  const [draggedId, setDraggedId] = useState(null);
  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date()).toUpperCase();

  useEffect(() => {
    const controller = new AbortController();

    getTodos(controller.signal)
      .then(setTodos)
      .catch((error) => {
        if (error.name !== "AbortError") {
          setRequestError(error.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, []);

  const counts = useMemo(
    () => ({
      all: todos.length,
      todo: todos.filter((todo) => todo.status === "todo").length,
      "in-progress": todos.filter((todo) => todo.status === "in-progress")
        .length,
      done: todos.filter((todo) => todo.status === "done").length,
      starred: todos.filter((todo) => todo.priority).length,
    }),
    [todos],
  );

  const filteredTodos = useMemo(() => {
    const query = search.trim().toLowerCase();
    return todos.filter((todo) => {
      const matchesFilter =
        activeFilter === "all" ||
        (activeFilter === "starred"
          ? todo.priority
          : todo.status === activeFilter);
      return matchesFilter && todo.title.toLowerCase().includes(query);
    });
  }, [activeFilter, search, todos]);

  const completedPercent =
    counts.all === 0 ? 0 : Math.round((counts.done / counts.all) * 100);
  const selectedVisible = filteredTodos.every((todo) =>
    selectedIds.includes(todo.id),
  );

  function toggleSelection(id) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  }

  function toggleSelectVisible() {
    if (selectedVisible) {
      const visibleIds = new Set(filteredTodos.map((todo) => todo.id));
      setSelectedIds((current) =>
        current.filter((id) => !visibleIds.has(id)),
      );
    } else {
      setSelectedIds((current) => [
        ...new Set([...current, ...filteredTodos.map((todo) => todo.id)]),
      ]);
    }
  }

  function deleteTodos(ids) {
    const deletedIds = new Set(ids);
    setTodos((current) => current.filter((todo) => !deletedIds.has(todo.id)));
    setSelectedIds((current) => current.filter((id) => !deletedIds.has(id)));
  }

  async function saveTodo(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const title = String(formData.get("title")).trim();
    const status = String(formData.get("status"));
    const priority = formData.get("priority") === "on";

    if (!title) return;

    if (modal?.mode === "edit") {
      setTodos((current) =>
        current.map((todo) =>
          todo.id === modal.todo.id
            ? { ...todo, title, status, priority }
            : todo,
        ),
      );
      setModal(null);
      return;
    }

    setIsSaving(true);
    setRequestError("");
    try {
      const response = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, status: apiStatuses[status] }),
      });
      if (!response.ok) {
        throw new Error(`Unable to create task (HTTP ${response.status}).`);
      }

      try {
        const createdTodo = normalizeTodo(await response.json());
        setTodos((current) => [createdTodo, ...current]);
      } catch (error) {
        if (error instanceof SyntaxError) {
          setTodos(await getTodos());
        } else {
          throw error;
        }
      }
      setModal(null);
    } catch (error) {
      setRequestError(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  function moveTodo(targetId) {
    if (!draggedId || draggedId === targetId) return;
    setTodos((current) => {
      const next = [...current];
      const sourceIndex = next.findIndex((todo) => todo.id === draggedId);
      const targetIndex = next.findIndex((todo) => todo.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const [movedTodo] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, movedTodo);
      return next;
    });
    setDraggedId(null);
  }

  const filterItems = [
    { id: "all", label: "All tasks", icon: "inbox", count: counts.all },
    { id: "todo", label: "To do", icon: "circle", count: counts.todo },
    {
      id: "in-progress",
      label: "In progress",
      icon: "calendar",
      count: counts["in-progress"],
    },
    { id: "done", label: "Completed", icon: "check", count: counts.done },
  ];

  const pageTitle =
    activeFilter === "starred"
      ? "Starred"
      : activeFilter === "all"
        ? "All tasks"
        : activeFilter === "todo"
          ? "To do"
          : activeFilter === "in-progress"
            ? "In progress"
            : "Completed";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="Daylight home">
          <span className="brand-mark"><Icon name="check" size={18} strokeWidth={2.5} /></span>
          <span>daylight<span className="brand-period">.</span></span>
        </a>

        <div className="workspace-label">WORKSPACE</div>
        <div className="workspace-switcher">
          <span className="workspace-avatar">D</span>
          <span className="workspace-name">Personal space</span>
          <span className="workspace-chevron">⌄</span>
        </div>

        <div className="nav-section-label">YOUR TASKS</div>
        <nav className="task-nav" aria-label="Task filters">
          {filterItems.map((item) => (
            <button
              className={`nav-item ${activeFilter === item.id ? "active" : ""}`}
              key={item.id}
              onClick={() => setActiveFilter(item.id)}
              type="button"
            >
              <Icon name={item.icon} size={17} />
              <span>{item.label}</span>
              <span className="nav-count">{item.count}</span>
            </button>
          ))}
          <button
            className={`nav-item ${activeFilter === "starred" ? "active" : ""}`}
            onClick={() => setActiveFilter("starred")}
            type="button"
          >
            <Icon name="star" size={17} />
            <span>Starred</span>
            <span className="nav-count">{counts.starred}</span>
          </button>
        </nav>

        <div className="sidebar-note">
          <span className="note-icon"><Icon name="spark" size={18} /></span>
          <p>A little progress each day adds up to big results.</p>
          <span className="note-caption">YOU’VE GOT THIS</span>
        </div>

        <div className="profile-card">
          <div className="profile-avatar">TD</div>
          <div className="profile-copy">
            <strong>Thavy Diep</strong>
            <span>Personal account</span>
          </div>
          <button className="icon-button profile-more" type="button" aria-label="Account options">
            <Icon name="more" size={19} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">My workspace <Icon name="chevron" size={13} /> <span>Tasks</span></div>
          <div className="topbar-right">
            <span className="today-label"><span className="today-dot" /> Your personal task space</span>
            <div className="top-avatar" aria-label="Thavy Diep">TD</div>
          </div>
        </header>

        <div className="content-wrap">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">{today}</p>
              <h1>Good things take <span>time.</span></h1>
              <p className="welcome-subtitle">One step at a time, Thavy. You’re doing great.</p>
            </div>
            <button className="primary-button" onClick={() => setModal({ mode: "create" })} type="button">
              <Icon name="plus" size={18} strokeWidth={2.2} />
              New task
            </button>
          </section>

          <section className="progress-card" aria-label="Task progress">
            <div className="progress-copy">
              <span className="progress-icon"><Icon name="spark" size={18} /></span>
              <div>
                <strong>Your daily progress</strong>
                <span>{counts.done} of {counts.all} tasks completed</span>
              </div>
            </div>
            <div className="progress-track" role="progressbar" aria-valuenow={completedPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Tasks completed">
              <span style={{ width: `${completedPercent}%` }} />
            </div>
            <strong className="progress-percent">{completedPercent}%</strong>
          </section>

          <section className="tasks-section">
            <div className="section-heading">
              <div>
                <h2>{pageTitle}<span className="heading-count">{filteredTodos.length}</span></h2>
                <p>Keep your focus on what matters most.</p>
              </div>
              <label className="search-field">
                <Icon name="search" size={17} />
                <input
                  aria-label="Search tasks by title"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search tasks"
                  type="search"
                  value={search}
                />
                <kbd>/</kbd>
              </label>
            </div>

            <div className="list-toolbar">
              <div className="list-label">
                <label className="checkbox-wrap">
                  <input
                    aria-label="Select all visible tasks"
                    checked={filteredTodos.length > 0 && selectedVisible}
                    onChange={toggleSelectVisible}
                    type="checkbox"
                  />
                  <span className="custom-checkbox"><Icon name="check" size={12} strokeWidth={3} /></span>
                </label>
                <span>Task</span>
              </div>
              <div className="column-labels">
                <span>STATUS</span>
                <span>PRIORITY</span>
                <span className="actions-heading">ACTIONS</span>
              </div>
            </div>

            {selectedIds.length > 0 && (
              <div className="bulk-toolbar">
                <span><strong>{selectedIds.length}</strong> selected</span>
                <select
                  aria-label="Change status for selected tasks"
                  defaultValue=""
                  onChange={(event) => {
                    if (!event.target.value) return;
                    const status = event.target.value;
                    setTodos((current) =>
                      current.map((todo) =>
                        selectedIds.includes(todo.id) ? { ...todo, status } : todo,
                      ),
                    );
                    event.target.value = "";
                  }}
                >
                  <option value="" disabled>Change status</option>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <button className="bulk-delete" onClick={() => deleteTodos(selectedIds)} type="button">
                  <Icon name="trash" size={15} /> Delete selected
                </button>
                <button className="clear-selection" onClick={() => setSelectedIds([])} type="button">Clear</button>
              </div>
            )}

            <div className="todo-list">
              {requestError && (
                <p className="request-error" role="alert">{requestError}</p>
              )}
              {isLoading && <p className="loading-message">Loading tasks…</p>}
              {filteredTodos.map((todo) => (
                <article
                  className={`todo-row ${todo.status === "done" ? "is-done" : ""} ${draggedId === todo.id ? "is-dragged" : ""}`}
                  draggable
                  key={todo.id}
                  onDragEnd={() => setDraggedId(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDragStart={() => setDraggedId(todo.id)}
                  onDrop={() => moveTodo(todo.id)}
                >
                  <div className="todo-main">
                    <label className="checkbox-wrap">
                      <input
                        aria-label={`Select ${todo.title}`}
                        checked={selectedIds.includes(todo.id)}
                        onChange={() => toggleSelection(todo.id)}
                        type="checkbox"
                      />
                      <span className="custom-checkbox"><Icon name="check" size={12} strokeWidth={3} /></span>
                    </label>
                    <span className="drag-handle" aria-label="Drag to reorder">
                      <Icon name="grip" size={16} />
                    </span>
                    <button
                      className="todo-title"
                      onClick={() => setModal({ mode: "edit", todo })}
                      type="button"
                    >
                      {todo.title}
                    </button>
                  </div>
                  <div className="todo-controls">
                    <label className="status-select-wrap">
                      <span className={`status-dot status-${todo.status}`} />
                      <select
                        aria-label={`Status for ${todo.title}`}
                        className={`status-select status-text-${todo.status}`}
                        onChange={(event) =>
                          setTodos((current) =>
                            current.map((item) =>
                              item.id === todo.id
                                ? { ...item, status: event.target.value }
                                : item,
                            ),
                          )
                        }
                        value={todo.status}
                      >
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      aria-label={todo.priority ? `Remove priority from ${todo.title}` : `Mark ${todo.title} as priority`}
                      aria-pressed={todo.priority}
                      className={`priority-button ${todo.priority ? "is-priority" : ""}`}
                      onClick={() =>
                        setTodos((current) =>
                          current.map((item) =>
                            item.id === todo.id
                              ? { ...item, priority: !item.priority }
                              : item,
                          ),
                        )
                      }
                      type="button"
                    >
                      <Icon name="star" size={17} />
                    </button>
                    <div className="row-actions">
                      <button
                        aria-label={`Edit ${todo.title}`}
                        className="icon-button"
                        onClick={() => setModal({ mode: "edit", todo })}
                        type="button"
                      >
                        <span className="edit-pencil">↗</span>
                      </button>
                      <button
                        aria-label={`Delete ${todo.title}`}
                        className="icon-button delete-button"
                        onClick={() => deleteTodos([todo.id])}
                        type="button"
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
              {!isLoading && filteredTodos.length === 0 && (
                <div className="empty-state">
                  <span className="empty-icon"><Icon name={search ? "search" : "check"} size={22} /></span>
                  <strong>{search ? "No tasks found" : "Nothing on your list"}</strong>
                  <span>{search ? "Try another search or clear your filters." : "Enjoy the breathing room, or add a new task."}</span>
                  {!search && <button onClick={() => setModal({ mode: "create" })} type="button"><Icon name="plus" size={15} /> Add a task</button>}
                </div>
              )}
            </div>

            <button className="add-task-link" onClick={() => setModal({ mode: "create" })} type="button">
              <span><Icon name="plus" size={17} /></span>
              Add a task
            </button>
            <p className="reorder-hint"><Icon name="grip" size={14} /> Drag and drop tasks to reorder them</p>
          </section>

          <footer className="page-footer">
            <span>Made for your next little win <span className="footer-heart">✳</span></span>
            <span>All progress is good progress.</span>
          </footer>
        </div>
      </main>

      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModal(null);
          }}
        >
          <form className="task-modal" onSubmit={saveTodo}>
            <div className="modal-heading">
              <div>
                <span className="modal-kicker">{modal.mode === "edit" ? "MAKE A CHANGE" : "A FRESH START"}</span>
                <h2>{modal.mode === "edit" ? "Edit task" : "Create a task"}</h2>
              </div>
              <button aria-label="Close dialog" className="icon-button" onClick={() => setModal(null)} type="button">
                <Icon name="close" size={19} />
              </button>
            </div>
            <label className="form-label" htmlFor="task-title">Task title</label>
            <input
              autoFocus
              className="title-input"
              defaultValue={modal.todo?.title ?? ""}
              id="task-title"
              maxLength={120}
              name="title"
              placeholder="What would you like to get done?"
              required
            />
            <label className="form-label" htmlFor="task-status">Status</label>
            <select className="form-select" defaultValue={modal.todo?.status ?? "todo"} id="task-status" name="status">
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <label className="priority-check">
              <input defaultChecked={modal.todo?.priority ?? false} name="priority" type="checkbox" />
              <Icon name="star" size={17} />
              Mark as a priority
            </label>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setModal(null)} type="button">Cancel</button>
              <button className="primary-button" disabled={isSaving} type="submit">
                {modal.mode === "edit" ? "Save changes" : <><Icon name="plus" size={17} /> Create task</>}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;
