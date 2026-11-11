import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownLeft,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Trash2,
  Users,
  X,
  TrendingUp,
  Pencil,
  Mail,
  Clock,
  MapPin,
} from "lucide-react";
import "./style.css";
import "./workspace.css";
import "./public.css";
type User = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "teacher" | "student";
  joined?: string;
};
type Class = {
  id: number;
  name: string;
  subject: string;
  room: string;
  schedule: string;
  teacher_id: number;
  teacher_name: string;
  student_count: number;
  color: string;
};
type Result = {
  id: number;
  class_id: number;
  student_id: number;
  student_name: string;
  class_name: string;
  title: string;
  score: number;
  total: number;
  date: string;
  feedback: string;
};
type Notice = {
  id: number;
  title: string;
  body: string;
  author_name: string;
  created: string;
};
type Overview = {
  classes: Class[];
  students: number;
  teachers?: number;
  attendance: { status: string; count: number }[];
  results: Result[];
  announcements: Notice[];
};
async function api<T = unknown>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch("/api" + url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const initials = (s: string) =>
  s
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
const prettyDate = (s: string) =>
  new Date(s.slice(0, 10) + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
const nav = [
  { key: "Overview", icon: LayoutDashboard },
  { key: "People", icon: Users },
  { key: "Classes", icon: BookOpen },
  { key: "Attendance", icon: ClipboardCheck },
  { key: "Results", icon: TrendingUp },
  { key: "Announcements", icon: Bell },
];
function App() {
  const [publicView, setPublicView] = useState(() =>
    window.location.hash === "#login"
      ? "login"
      : window.location.hash === "#workspace"
        ? "workspace"
        : "landing",
  );
  function navigate(view: string) {
    setPublicView(view);
    window.location.hash = view === "landing" ? "home" : view;
    window.scrollTo(0, 0);
  }
  useEffect(() => {
    const update = () =>
      setPublicView(
        window.location.hash === "#login"
          ? "login"
          : window.location.hash === "#workspace"
            ? "workspace"
            : "landing",
      );
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);

  const [user, setUser] = useState<User | null>(null),
    [boot, setBoot] = useState(true),
    [page, setPage] = useState("Overview"),
    [overview, setOverview] = useState<Overview | null>(null),
    [people, setPeople] = useState<User[]>([]),
    [results, setResults] = useState<Result[]>([]),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [loading, setLoading] = useState(false),
    [mobile, setMobile] = useState(false),
    [modal, setModal] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [personEditing, setPersonEditing] = useState<User | null>(null),
    [personRole, setPersonRole] = useState("student"),
    [activeClass, setActiveClass] = useState(""),
    [attendanceDate, setAttendanceDate] = useState(today()),
    [roster, setRoster] = useState<User[]>([]),
    [marks, setMarks] = useState<Record<number, string>>({}),
    [editing, setEditing] = useState<Class | null>(null),
    [confirm, setConfirm] = useState<{ message: string; url: string } | null>(
      null,
    );
  useEffect(() => {
    api<User>("/me")
      .then(setUser)
      .catch(() => {})
      .finally(() => setBoot(false));
  }, []);
  async function refresh() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const [o, p, r] = await Promise.all([
        api<Overview>("/overview"),
        user.role === "student" ? Promise.resolve([]) : api<User[]>("/people"),
        api<Result[]>("/results"),
      ]);
      setOverview(o);
      setPeople(p);
      setResults(r);
      setActiveClass((current) =>
        o.classes.some((c) => String(c.id) === current)
          ? current
          : String(o.classes[0]?.id || ""),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, [user]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!user || !activeClass) return;
    let cancelled = false;
    setRoster([]);
    setMarks({});
    Promise.all([
      api<User[]>(`/classes/${activeClass}/students`),
      api<{ student_id: number; status: string }[]>(
        `/attendance?class_id=${activeClass}&date=${attendanceDate}`,
      ),
    ])
      .then(([students, records]) => {
        if (cancelled) return;
        setRoster(students);
        setMarks(
          Object.fromEntries(records.map((r) => [r.student_id, r.status])),
        );
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [activeClass, attendanceDate, user, overview]);
  useEffect(() => {
    if (!modal && !confirm) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,select,textarea,[tabindex="0"]',
        ) || [],
      );
    focusable()[0]?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        setModal(null);
        setConfirm(null);
      }
      if (e.key === "Tab") {
        const items = focusable(),
          first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [modal, confirm, busy]);
  useEffect(() => {
    setSearch("");
    setMobile(false);
  }, [page]);
  async function action(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    try {
      await fn();
      setModal(null);
      setConfirm(null);
      setToast(message);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    let url = "",
      method = "POST",
      payload: Record<string, unknown> = f;
    if (modal === "person") {
      url = "/people" + (personEditing ? "/" + personEditing.id : "");
      method = personEditing ? "PUT" : "POST";
    }
    if (modal === "class") {
      url = "/classes" + (editing ? "/" + editing.id : "");
      method = editing ? "PUT" : "POST";
      payload = { ...f, teacher_id: Number(f.teacher_id) };
    }
    if (modal === "enrol") {
      url = `/classes/${activeClass}/enrolments`;
      payload = { student_id: Number(f.student_id) };
    }
    if (modal === "result") {
      url = "/results";
      payload = {
        ...f,
        class_id: Number(activeClass),
        student_id: Number(f.student_id),
        score: Number(f.score),
        total: Number(f.total),
      };
    }
    if (modal === "notice") url = "/announcements";
    await action(
      () => api(url, { method, body: JSON.stringify(payload) }),
      "Changes saved successfully.",
    );
  }
  if (boot)
    return (
      <div className="boot">
        <GraduationCap size={40} />
        <p>Opening Cedar…</p>
      </div>
    );
  if (publicView === "landing")
    return (
      <Landing
        signedIn={!!user}
        onEnter={() => navigate(user ? "workspace" : "login")}
      />
    );
  if (!user)
    return (
      <Login
        onLogin={(u) => {
          setUser(u);
          navigate("workspace");
        }}
        onBack={() => navigate("landing")}
      />
    );
  const classes = overview?.classes || [];
  const admin = user.role === "admin",
    canTeach = user.role !== "student";
  const totalAttendance =
    overview?.attendance.reduce((n, a) => n + a.count, 0) || 0;
  const present =
    overview?.attendance
      .filter((a) => a.status !== "absent")
      .reduce((n, a) => n + a.count, 0) || 0;
  const attendanceRate = totalAttendance
    ? Math.round((present / totalAttendance) * 100)
    : null;
  const average = results.length
    ? Math.round(
        results.reduce((n, r) => n + (r.score / r.total) * 100, 0) /
          results.length,
      )
    : null;
  const openClass = (c?: Class) => {
    setEditing(c || null);
    setModal("class");
    setError("");
  };
  return (
    <div className="app">
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("Overview");
          }}
        >
          <span className="brand-icon">
            <GraduationCap size={28} />
          </span>
          CEDAR<span className="brand-dot"> / SIS</span>
        </a>
        <div className="workspace">
          <span className="school-icon">
            <GraduationCap size={20} />
          </span>
          <div>
            <strong>Cedar Academy</strong>
            <small>School workspace</small>
          </div>
          <span className="workspace-indicator" />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav>
          {nav
            .filter((n) => user.role !== "student" || n.key !== "People")
            .map((n) => (
              <button
                key={n.key}
                className={page === n.key ? "selected" : ""}
                onClick={() => setPage(n.key)}
              >
                <n.icon size={19} />
                {n.key}
                {n.key === "Announcements" && (
                  <span className="nav-count">
                    {overview?.announcements.length || 0}
                  </span>
                )}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="semester">
            <span className="semester-dot" /> SCHOOL OPERATIONS
            <p>
              One workspace.
              <br />
              Your entire school.
            </p>
            <CalendarDays size={26} />
          </div>
          <div className="profile">
            <span className="avatar">{initials(user.name)}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.role} account</small>
            </div>
            <button
              title="Sign out"
              aria-label="Sign out"
              onClick={() =>
                action(async () => {
                  await api("/logout", { method: "POST" });
                  setUser(null);
                  setOverview(null);
                  setPage("Overview");
                  navigate("landing");
                }, "Signed out.")
              }
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          aria-label="Close navigation"
          className="scrim"
          onClick={() => setMobile(false)}
        />
      )}
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-toggle icon-button"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={22} />
            </button>
            <button
              className="workspace-home"
              onClick={() => navigate("landing")}
            >
              School home
            </button>
            <ChevronRight size={14} />
            <strong>{page}</strong>
          </div>
          <div className="topbar-right">
            <span className="date-label">
              <CalendarDays size={15} />
              {new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <span className="top-divider" />
            <button
              className="icon-button notification"
              title="Announcements"
              aria-label="View announcements"
              onClick={() => setPage("Announcements")}
            >
              <Bell size={19} />
              <i />
            </button>
            <span className="avatar small">{initials(user.name)}</span>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                CEDAR ACADEMY <span>/</span> {user.role.toUpperCase()} PORTAL
              </div>
              <h1>
                {page === "Overview"
                  ? `Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, ${user.name.split(" ")[0]}`
                  : page === "People"
                    ? "School directory"
                    : page === "Classes"
                      ? "Classes & enrolment"
                      : page === "Attendance"
                        ? "Attendance register"
                        : page === "Results"
                          ? "Assessment results"
                          : "Announcements"}
                {page === "Overview" && <span className="greeting-dot">.</span>}
              </h1>
              <p>
                {page === "Overview"
                  ? "Your school overview: enrolment, attendance, and academic performance."
                  : page === "People"
                    ? "Manage student and teacher records across your school."
                    : page === "Classes"
                      ? "Assign teachers, organise classes, and manage student enrolment."
                      : page === "Attendance"
                        ? "Select a class and date to view or update attendance."
                        : page === "Results"
                          ? "Record assessments and review student performance."
                          : "School-wide notices and administrative updates."}
              </p>
            </div>
            {admin && (
              <button
                className="button primary"
                onClick={() => {
                  if (page === "Classes") openClass();
                  else {
                    setError("");
                    setPersonEditing(null);
                    setModal(page === "People" ? "person" : "notice");
                  }
                }}
              >
                <Plus size={17} />
                {page === "People"
                  ? "Add person"
                  : page === "Classes"
                    ? "Create class"
                    : "New announcement"}
              </button>
            )}
          </div>
          {error && (
            <div role="alert" className="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}
          {loading && !overview && (
            <div className="empty">Loading your school…</div>
          )}
          {page === "Overview" && overview && (
            <>
              <section className="workspace-summary">
                <div>
                  <span className="summary-kicker">
                    SCHOOL INFORMATION SYSTEM
                  </span>
                  <h2>Your school. In focus.</h2>
                  <p>
                    Manage classes, monitor attendance, and track academic
                    performance from one workspace.
                  </p>
                  <div className="summary-actions">
                    <button
                      className="button"
                      onClick={() => setPage("Attendance")}
                    >
                      <ClipboardCheck size={16} />
                      Open attendance
                      <ArrowRight size={16} />
                    </button>
                    <button
                      className="summary-link"
                      onClick={() => setPage("Classes")}
                    >
                      Class directory
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
                <div className="summary-graphic" aria-hidden="true">
                  <div className="graphic-label">
                    <GraduationCap size={23} />
                    <span>CEDAR ACADEMY</span>
                  </div>
                  <div className="graphic-grid">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
                      <span key={i} />
                    ))}
                  </div>
                  <span className="graphic-caption">
                    CLASSES / PEOPLE / PROGRESS
                  </span>
                </div>
              </section>
              <div className="stats">
                <Stat
                  label={
                    user.role === "student" ? "My classes" : "Enrolled students"
                  }
                  value={
                    user.role === "student" ? classes.length : overview.students
                  }
                  icon={<Users size={20} />}
                  detail={
                    user.role === "student"
                      ? "Your learning spaces"
                      : "Across your classes"
                  }
                  color="green"
                />
                <Stat
                  label="Active classes"
                  value={classes.length}
                  icon={<BookOpen size={20} />}
                  detail={
                    admin
                      ? `${overview.teachers} teachers making it happen`
                      : "Learning in good company"
                  }
                  color="purple"
                />
                <Stat
                  label="Attendance rate"
                  value={attendanceRate === null ? "—" : `${attendanceRate}%`}
                  icon={<ClipboardCheck size={20} />}
                  detail="Present or late · all recorded days"
                  color="orange"
                />
                <Stat
                  label="Average result"
                  value={average === null ? "—" : `${average}%`}
                  icon={<TrendingUp size={20} />}
                  detail={`${results.length} recorded assessments`}
                  color="blue"
                />
              </div>
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>
                        Your classes{" "}
                        <span className="count">{classes.length}</span>
                      </h2>
                      <p>Assigned teachers, rooms, and class schedules.</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setPage("Classes")}
                    >
                      View all <ArrowRight size={15} />
                    </button>
                  </div>
                  <div className="class-list">
                    {classes.slice(0, 4).map((c) => (
                      <button
                        className="class-row"
                        key={c.id}
                        onClick={() => {
                          setActiveClass(String(c.id));
                          setPage("Classes");
                        }}
                      >
                        <span className={"subject-icon " + c.color}>
                          <BookOpen size={20} />
                        </span>
                        <div>
                          <strong>{c.name}</strong>
                          <span>
                            {c.teacher_name} <i>·</i> {c.room}
                          </span>
                        </div>
                        <div className="class-row-right">
                          <strong>{c.student_count} students</strong>
                          <span>{c.schedule}</span>
                        </div>
                        <ChevronRight size={16} />
                      </button>
                    ))}
                    {!classes.length && (
                      <Empty message="No classes have been assigned yet." />
                    )}
                  </div>
                  <div className="panel-footer">
                    <span className="live-dot" />{" "}
                    {admin ? "All school classes" : "Your assigned classes"}{" "}
                    <span>Class directory</span>
                  </div>
                </section>
                <section className="panel notices-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Noticeboard</h2>
                      <p>Latest school announcements.</p>
                    </div>
                    <Bell size={18} />
                  </div>
                  {overview.announcements.slice(0, 2).map((a, i) => (
                    <article className="mini-notice" key={a.id}>
                      <span
                        className={"notice-tag " + (i ? "purple" : "green")}
                      >
                        {i ? "COMMUNITY" : "SCHOOL UPDATE"}
                      </span>
                      <h3>{a.title}</h3>
                      <p>{a.body}</p>
                      <div>
                        {prettyDate(a.created)}
                        <span>{a.author_name}</span>
                      </div>
                    </article>
                  ))}
                  {!overview.announcements.length && (
                    <Empty message="All quiet on the noticeboard." />
                  )}
                  <button
                    className="notice-link"
                    onClick={() => setPage("Announcements")}
                  >
                    All announcements <ArrowRight size={15} />
                  </button>
                </section>
                <section className="panel results-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Recent progress</h2>
                      <p>Latest recorded assessments.</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setPage("Results")}
                    >
                      View results <ArrowRight size={15} />
                    </button>
                  </div>
                  <ResultTable
                    results={overview.results.slice(0, 4)}
                    student={user.role === "student"}
                  />
                </section>
                <section className="growth-card">
                  <span className="growth-icon">
                    <ClipboardCheck size={23} />
                  </span>
                  <span className="summary-kicker">DAILY OPERATIONS</span>
                  <h3>Attendance register</h3>
                  <p>
                    Review class attendance and keep student records up to date.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => setPage("Attendance")}
                  >
                    Open register <ArrowRight size={16} />
                  </button>
                </section>
              </div>
            </>
          )}
          {page === "People" && (
            <section className="panel">
              <div className="toolbar">
                <div className="tabs">
                  {["student", "teacher"].map((r) => (
                    <button
                      className={personRole === r ? "active" : ""}
                      key={r}
                      onClick={() => setPersonRole(r)}
                    >
                      {r === "student" ? "Students" : "Teachers"}{" "}
                      <span>{people.filter((p) => p.role === r).length}</span>
                    </button>
                  ))}
                </div>
                <SearchBox
                  value={search}
                  onChange={setSearch}
                  placeholder="Search people…"
                />
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email address</th>
                      <th>Role</th>
                      <th>Joined</th>
                      {admin && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {people
                      .filter(
                        (p) =>
                          p.role === personRole &&
                          `${p.name} ${p.email}`
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                      )
                      .map((p) => (
                        <tr key={p.id}>
                          <td>
                            <span className="person-cell">
                              <span className="avatar pastel">
                                {initials(p.name)}
                              </span>
                              <strong>{p.name}</strong>
                            </span>
                          </td>
                          <td>{p.email}</td>
                          <td>
                            <span className="badge">{p.role}</span>
                          </td>
                          <td>{p.joined ? prettyDate(p.joined) : "—"}</td>
                          {admin && (
                            <td>
                              <button
                                className="icon-button"
                                aria-label={`Edit ${p.name}`}
                                onClick={() => {
                                  setPersonEditing(p);
                                  setModal("person");
                                }}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                className="icon-button danger"
                                aria-label={`Remove ${p.name}`}
                                onClick={() =>
                                  setConfirm({
                                    message: `Remove ${p.name}? Their enrolments, attendance, and results will also be deleted. Teachers with classes must be reassigned first.`,
                                    url: "/people/" + p.id,
                                  })
                                }
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                  </tbody>
                </table>
                {!people.some(
                  (p) =>
                    p.role === personRole &&
                    `${p.name} ${p.email}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                ) && <Empty message="No people match this view." />}
              </div>
              <div className="panel-footer">
                {admin
                  ? "School directory"
                  : "Students in your assigned classes"}
                <span>
                  Email format is checked; email ownership is not verified.
                </span>
              </div>
            </section>
          )}
          {page === "Classes" && (
            <>
              <div className="section-tools">
                <span>{classes.length} learning spaces</span>
                <SearchBox
                  value={search}
                  onChange={setSearch}
                  placeholder="Search classes…"
                />
              </div>
              <div className="class-grid">
                {classes
                  .filter((c) =>
                    `${c.name} ${c.subject} ${c.teacher_name}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((c) => (
                    <section className="panel class-card" key={c.id}>
                      <div className="class-card-top">
                        <span className={"subject-icon " + c.color}>
                          <BookOpen size={24} />
                        </span>
                        <span className="badge">{c.subject}</span>
                        {admin && (
                          <button
                            className="icon-button"
                            title="Edit class"
                            onClick={() => openClass(c)}
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                      </div>
                      <h2>{c.name}</h2>
                      <p className="teacher-name">with {c.teacher_name}</p>
                      <p className="class-detail">
                        <Clock size={16} />
                        {c.schedule}
                      </p>
                      <p className="class-detail">
                        <MapPin size={16} />
                        {c.room}
                      </p>
                      <div className="class-card-bottom">
                        <span>
                          <Users size={16} /> {c.student_count} enrolled
                        </span>
                        <button
                          className="text-button"
                          onClick={() => {
                            setActiveClass(String(c.id));
                            setModal("roster");
                          }}
                        >
                          View class <ArrowRight size={16} />
                        </button>
                      </div>
                    </section>
                  ))}
              </div>
              {!classes.filter((c) =>
                `${c.name} ${c.subject} ${c.teacher_name}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              ).length && (
                <Empty message="No classes found. Create a class to get started." />
              )}
            </>
          )}
          {page === "Attendance" && (
            <section className="panel">
              <div className="toolbar">
                <div className="filter-group">
                  <label>
                    Class
                    <select
                      value={activeClass}
                      onChange={(e) => setActiveClass(e.target.value)}
                    >
                      <option value="" disabled>
                        Select a class
                      </option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Date
                    <input
                      type="date"
                      value={attendanceDate}
                      max={today()}
                      onChange={(e) => setAttendanceDate(e.target.value)}
                    />
                  </label>
                </div>
                {canTeach && (
                  <button
                    className="button secondary"
                    disabled={!roster.length || busy}
                    onClick={() =>
                      setMarks(
                        Object.fromEntries(
                          roster.map((s) => [s.id, "present"]),
                        ),
                      )
                    }
                  >
                    <Check size={16} />
                    Mark all present
                  </button>
                )}
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Email</th>
                      <th>Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <span className="person-cell">
                            <span className="avatar pastel">
                              {initials(s.name)}
                            </span>
                            <strong>{s.name}</strong>
                          </span>
                        </td>
                        <td>{s.email}</td>
                        <td>
                          {canTeach ? (
                            <div className="attendance-options">
                              {["present", "late", "absent"].map((status) => (
                                <button
                                  key={status}
                                  className={
                                    marks[s.id] === status
                                      ? status + " active"
                                      : ""
                                  }
                                  onClick={() =>
                                    setMarks({ ...marks, [s.id]: status })
                                  }
                                >
                                  {status}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className={"badge " + (marks[s.id] || "")}>
                              {marks[s.id] || "Not recorded"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!roster.length && (
                  <Empty message="Select a class with enrolled students to view attendance." />
                )}
              </div>
              <div className="attendance-footer">
                <p>
                  {Object.keys(marks).length} of {roster.length} students marked
                  <span>
                    Changes are saved when you select Save attendance.
                  </span>
                </p>
                {canTeach && (
                  <button
                    className="button primary"
                    disabled={
                      busy || !roster.length || roster.some((s) => !marks[s.id])
                    }
                    onClick={() =>
                      action(
                        () =>
                          api("/attendance", {
                            method: "PUT",
                            body: JSON.stringify({
                              class_id: Number(activeClass),
                              date: attendanceDate,
                              records: roster.map((s) => ({
                                student_id: s.id,
                                status: marks[s.id],
                              })),
                            }),
                          }),
                        "Attendance saved.",
                      )
                    }
                  >
                    <Check size={16} />
                    {busy ? "Saving…" : "Save attendance"}
                  </button>
                )}
              </div>
            </section>
          )}
          {page === "Results" && (
            <section className="panel">
              <div className="toolbar">
                <SearchBox
                  value={search}
                  onChange={setSearch}
                  placeholder="Search assessments…"
                />
                {canTeach && (
                  <button
                    className="button primary"
                    disabled={!classes.length}
                    onClick={() => {
                      setError("");
                      setModal("result");
                    }}
                  >
                    <Plus size={16} />
                    Add result
                  </button>
                )}
              </div>
              <ResultTable
                results={results.filter((r) =>
                  `${r.student_name} ${r.title} ${r.class_name}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )}
                student={user.role === "student"}
                onDelete={
                  canTeach
                    ? (r) =>
                        setConfirm({
                          message: `Delete ${r.title} for ${r.student_name}? This result cannot be recovered.`,
                          url: "/results/" + r.id,
                        })
                    : undefined
                }
              />
            </section>
          )}
          {page === "Announcements" && (
            <div className="notice-grid">
              {overview?.announcements.map((a) => (
                <article className="panel full-notice" key={a.id}>
                  <div className="notice-top">
                    <span className="notice-tag green">SCHOOL UPDATE</span>
                    {admin && (
                      <button
                        className="icon-button danger"
                        aria-label={`Delete ${a.title}`}
                        onClick={() =>
                          setConfirm({
                            message: "Delete this announcement permanently?",
                            url: "/announcements/" + a.id,
                          })
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <h2>{a.title}</h2>
                  <p>{a.body}</p>
                  <footer>
                    <span className="avatar small pastel">
                      {initials(a.author_name || "Cedar")}
                    </span>
                    <strong>{a.author_name}</strong>
                    <span>{prettyDate(a.created)}</span>
                  </footer>
                </article>
              ))}
              {!overview?.announcements.length && (
                <Empty message="No announcements yet. Check back soon." />
              )}
            </div>
          )}
          <footer className="page-footer">
            <span>
              <GraduationCap size={15} /> Cedar School Information System
            </span>
            <span>Academic operations workspace</span>
          </footer>
        </div>
      </main>
      {toast && (
        <div role="status" className="toast">
          <Check size={18} />
          {toast}
        </div>
      )}
      {(modal || confirm) && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) {
              setModal(null);
              setConfirm(null);
            }
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">CEDAR WORKSPACE</span>
                <h2 id="modal-title">
                  {confirm
                    ? "Please confirm"
                    : modal === "person"
                      ? personEditing
                        ? "Edit profile"
                        : "Add person"
                      : modal === "class"
                        ? editing
                          ? "Edit class"
                          : "Create class"
                        : modal === "roster"
                          ? classes.find((c) => String(c.id) === activeClass)
                              ?.name
                          : modal === "enrol"
                            ? "Enrol a student"
                            : modal === "result"
                              ? "Record assessment"
                              : "Share an update"}
                </h2>
              </div>
              <button
                className="icon-button"
                disabled={busy}
                aria-label="Close dialog"
                onClick={() => {
                  setModal(null);
                  setConfirm(null);
                }}
              >
                <X size={20} />
              </button>
            </div>
            {error && (
              <div role="alert" className="alert">
                {error}
              </div>
            )}
            {confirm ? (
              <>
                <p>{confirm.message}</p>
                <div className="modal-actions">
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => setConfirm(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="button destructive"
                    disabled={busy}
                    onClick={() =>
                      action(
                        () => api(confirm.url, { method: "DELETE" }),
                        "Record removed.",
                      )
                    }
                  >
                    {busy ? "Removing…" : "Remove"}
                  </button>
                </div>
              </>
            ) : modal === "roster" ? (
              <>
                <div className="roster-heading">
                  <p>{roster.length} students enrolled</p>
                  {admin && (
                    <button
                      className="button primary"
                      onClick={() => setModal("enrol")}
                    >
                      <Plus size={16} />
                      Enrol student
                    </button>
                  )}
                </div>
                {roster.map((s) => (
                  <div className="roster-row" key={s.id}>
                    <span className="avatar pastel">{initials(s.name)}</span>
                    <div>
                      <strong>{s.name}</strong>
                      <small>{s.email}</small>
                    </div>
                    {admin && (
                      <button
                        className="icon-button danger"
                        aria-label={`Unenrol ${s.name}`}
                        onClick={() => {
                          setModal(null);
                          setConfirm({
                            message: `Unenrol ${s.name}? Attendance and results for this class will also be removed.`,
                            url: `/classes/${activeClass}/enrolments/${s.id}`,
                          });
                        }}
                      >
                        <X size={17} />
                      </button>
                    )}
                  </div>
                ))}
                {!roster.length && (
                  <Empty message="No students enrolled yet." />
                )}
                {admin && (
                  <div className="modal-actions">
                    <button
                      className="button destructive"
                      onClick={() => {
                        setModal(null);
                        setConfirm({
                          message:
                            "Delete this class, its enrolments, attendance and results? This cannot be undone.",
                          url: "/classes/" + activeClass,
                        });
                      }}
                    >
                      Delete class
                    </button>
                  </div>
                )}
              </>
            ) : (
              <form onSubmit={submit} key={modal}>
                {modal === "person" && (
                  <>
                    <Field
                      label="Full name"
                      name="name"
                      maxLength={80}
                      defaultValue={personEditing?.name}
                    />
                    <Field
                      label="Email address"
                      name="email"
                      type="email"
                      maxLength={160}
                      defaultValue={personEditing?.email}
                    />
                    {!personEditing && (
                      <>
                        <label>
                          Role
                          <select name="role">
                            <option value="student">Student</option>
                            <option value="teacher">Teacher</option>
                          </select>
                        </label>
                        <Field
                          label="Initial password"
                          name="password"
                          type="password"
                          minLength={10}
                          maxLength={128}
                        />
                        <p className="form-note">
                          Use at least 10 characters. Share credentials directly
                          with this person; no email is sent.
                        </p>
                      </>
                    )}
                  </>
                )}
                {modal === "class" && (
                  <>
                    <Field
                      label="Class name"
                      name="name"
                      defaultValue={editing?.name}
                      placeholder="e.g. Mathematics · 10A"
                    />
                    <Field
                      label="Subject"
                      name="subject"
                      defaultValue={editing?.subject}
                    />
                    <div className="form-grid">
                      <Field
                        label="Room"
                        name="room"
                        defaultValue={editing?.room}
                      />
                      <Field
                        label="Schedule"
                        name="schedule"
                        defaultValue={editing?.schedule}
                        placeholder="Mon, Wed · 09:00–10:30"
                      />
                    </div>
                    <label>
                      Teacher
                      <select
                        name="teacher_id"
                        required
                        defaultValue={editing?.teacher_id || ""}
                      >
                        <option value="" disabled>
                          Select a teacher
                        </option>
                        {people
                          .filter((p) => p.role === "teacher")
                          .map((p) => (
                            <option value={p.id} key={p.id}>
                              {p.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    {!people.some((p) => p.role === "teacher") && (
                      <p className="form-note">
                        Add a teacher in People before creating a class.
                      </p>
                    )}
                  </>
                )}
                {modal === "enrol" && (
                  <label>
                    Student
                    <select name="student_id" required defaultValue="">
                      <option value="" disabled>
                        Select a student
                      </option>
                      {people
                        .filter(
                          (p) =>
                            p.role === "student" &&
                            !roster.some((s) => s.id === p.id),
                        )
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                {modal === "result" && (
                  <>
                    <label>
                      Class
                      <select
                        value={activeClass}
                        onChange={(e) => setActiveClass(e.target.value)}
                      >
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Student
                      <select
                        name="student_id"
                        required
                        key={activeClass}
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Select a student
                        </option>
                        {roster.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Field label="Assessment title" name="title" />
                    <div className="form-grid">
                      <Field
                        label="Score"
                        name="score"
                        type="number"
                        min="0"
                        step="0.01"
                      />
                      <Field
                        label="Out of"
                        name="total"
                        type="number"
                        min="0.01"
                        step="0.01"
                        defaultValue="100"
                      />
                    </div>
                    <Field
                      label="Assessment date"
                      name="date"
                      type="date"
                      defaultValue={today()}
                    />
                    <label>
                      Feedback <span className="optional">optional</span>
                      <textarea name="feedback" maxLength={1000} rows={3} />
                    </label>
                  </>
                )}
                {modal === "notice" && (
                  <>
                    <Field label="Title" name="title" />
                    <label>
                      Message
                      <textarea
                        required
                        name="body"
                        maxLength={2000}
                        rows={5}
                        placeholder="What would you like the school to know?"
                      />
                    </label>
                  </>
                )}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="button secondary"
                    disabled={busy}
                    onClick={() => setModal(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="button primary"
                    disabled={busy}
                  >
                    {busy
                      ? "Saving…"
                      : modal === "enrol"
                        ? "Enrol student"
                        : "Save changes"}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label>
      {label}
      <input required maxLength={120} {...props} />
    </label>
  );
}
function Empty({ message }: { message: string }) {
  return (
    <div className="empty">
      <BookOpen size={26} />
      <p>{message}</p>
    </div>
  );
}
function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="search-box">
      <Search size={17} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function Stat({
  label,
  value,
  icon,
  detail,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  detail: string;
  color: string;
}) {
  return (
    <section className="stat">
      <div>
        <span>{label}</span>
        <span className={"stat-icon " + color}>{icon}</span>
      </div>
      <strong>{value}</strong>
      <p>
        <ArrowDownLeft size={13} />
        {detail}
      </p>
    </section>
  );
}
function ResultTable({
  results,
  student,
  onDelete,
}: {
  results: Result[];
  student: boolean;
  onDelete?: (r: Result) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{student ? "Class" : "Student"}</th>
            <th>Assessment</th>
            <th>Score</th>
            <th>Date</th>
            {onDelete && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.id}>
              <td>
                <strong>{student ? r.class_name : r.student_name}</strong>
                {!student && (
                  <small className="cell-secondary">{r.class_name}</small>
                )}
              </td>
              <td>
                {r.title}
                {r.feedback && (
                  <small className="cell-secondary feedback">
                    {r.feedback}
                  </small>
                )}
              </td>
              <td>
                <span
                  className={
                    "score " +
                    (r.score / r.total >= 0.8
                      ? "green"
                      : r.score / r.total >= 0.6
                        ? "orange"
                        : "red")
                  }
                >
                  {r.score}
                  <span> / {r.total}</span>
                </span>
              </td>
              <td>{prettyDate(r.date)}</td>
              {onDelete && (
                <td>
                  <button
                    className="icon-button danger"
                    aria-label={`Delete ${r.title} for ${r.student_name}`}
                    onClick={() => onDelete(r)}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!results.length && <Empty message="No assessments recorded yet." />}
    </div>
  );
}
function Landing({
  signedIn,
  onEnter,
}: {
  signedIn: boolean;
  onEnter: () => void;
}) {
  const features = [
    {
      icon: GraduationCap,
      title: "Connected classrooms",
      body: "Students, teachers, and classes. One organised school community.",
      color: "teal",
    },
    {
      icon: BookOpen,
      title: "Learning that matters",
      body: "Explore core subjects and build a strong foundation for what comes next.",
      color: "gold",
    },
    {
      icon: Users,
      title: "Teachers who guide",
      body: "Class assignments and feedback that keep learning moving forward.",
      color: "cyan",
    },
    {
      icon: ClipboardCheck,
      title: "Progress you can see",
      body: "Attendance and assessment results, accessible in your school portal.",
      color: "pink",
    },
  ];
  const subjects = [
    {
      name: "Mathematics",
      type: "THINK & SOLVE",
      image:
        "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=700&q=85",
      description: "Patterns, problems, and the power of logical thinking.",
      color: "cyan",
    },
    {
      name: "English literature",
      type: "READ & DISCOVER",
      image:
        "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=700&q=85",
      description:
        "Explore stories, perspectives, and ideas that stay with you.",
      color: "gold",
    },
    {
      name: "Science",
      type: "ASK & EXPLORE",
      image:
        "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=700&q=85",
      description: "Get curious about the world and how it works.",
      color: "teal",
    },
  ];
  return (
    <div className="school-home">
      <div className="school-utility">
        <span>CEDAR ACADEMY</span>
        <span>A place for curiosity. A foundation for the future.</span>
        <button onClick={onEnter}>
          {signedIn ? "Open workspace" : "Student & staff portal"}
          <ArrowRight size={13} />
        </button>
      </div>
      <header className="school-nav">
        <a href="#home" className="school-logo">
          <span>
            <GraduationCap size={30} />
          </span>
          <div>
            CEDAR<small>ACADEMY</small>
          </div>
        </a>
        <nav aria-label="School navigation">
          <a href="#about-school">Our school</a>
          <a href="#learning">Learning</a>
          <a href="#school-community">Our community</a>
        </nav>
        <button className="portal-button" onClick={onEnter}>
          {signedIn ? "My workspace" : "Sign in"}
          <ArrowRight size={16} />
        </button>
      </header>
      <main className="school-main">
        <section className="school-hero">
          <img
            src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1600&q=85"
            alt="Students collaborating on their studies"
          />
          <div className="hero-shade" />
          <div className="school-hero-content">
            <span className="public-eyebrow">WELCOME TO CEDAR ACADEMY</span>
            <h1>
              Take the first step.
              <br />
              <em>Make your future.</em>
            </h1>
            <p>
              A school community built on curiosity, connection, and the
              confidence to go further.
            </p>
            <a className="hero-button" href="#learning">
              Discover our learning
              <ArrowRight size={17} />
            </a>
            <span className="hero-footnote">
              LEARN WITH PURPOSE. GROW WITH CONFIDENCE.
            </span>
          </div>
          <div className="hero-side-label">A NEW PERSPECTIVE STARTS HERE</div>
        </section>
        <section className="school-features" aria-label="The Cedar experience">
          {features.map((f) => (
            <article className={"school-feature " + f.color} key={f.title}>
              <f.icon size={31} strokeWidth={1.5} />
              <h2>{f.title}</h2>
              <p>{f.body}</p>
            </article>
          ))}
        </section>
        <section id="learning" className="school-section">
          <div className="public-section-title">
            <div>
              <span className="public-eyebrow">A WORLD OF POSSIBILITIES</span>
              <h2>Room for every kind of mind.</h2>
              <p>
                Strong foundations. Fresh perspectives. Discover our learning
                areas.
              </p>
            </div>
            <span className="section-number">01 / LEARNING</span>
          </div>
          <div className="subject-grid">
            {subjects.map((s) => (
              <article className="subject-card" key={s.name}>
                <div className="subject-image">
                  <img
                    src={s.image}
                    alt={
                      s.name === "Mathematics"
                        ? "Mathematical equations on a chalkboard"
                        : s.name === "Science"
                          ? "Scientific laboratory equipment"
                          : "Bookshelves in a library"
                    }
                    loading="lazy"
                  />
                  <span className={s.color}>{s.type}</span>
                </div>
                <div>
                  <h3>{s.name}</h3>
                  <p>{s.description}</p>
                  <button onClick={onEnter}>
                    Open school portal
                    <ArrowRight size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section id="about-school" className="school-about">
          <div className="about-visual">
            <img
              src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1000&q=85"
              alt="Students working together around a study table"
              loading="lazy"
            />
            <span className="about-stamp">
              <GraduationCap size={32} />
              <span>
                LEARNING
                <br />
                TOGETHER.
              </span>
            </span>
          </div>
          <div>
            <span className="public-eyebrow">MORE THAN A CLASSROOM</span>
            <h2>
              Good education starts
              <br />
              with connection.
            </h2>
            <p>
              Learning works best when students feel supported and teachers have
              the tools to guide them. Cedar brings the everyday school
              experience together, from the classroom to the school portal.
            </p>
            <ul>
              <li>
                <Check size={17} />A shared space for students and teachers
              </li>
              <li>
                <Check size={17} />
                Clear attendance and academic records
              </li>
              <li>
                <Check size={17} />
                School updates in one accessible place
              </li>
            </ul>
            <button className="portal-button" onClick={onEnter}>
              Explore the portal
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
        <section id="school-community" className="school-cta">
          <div>
            <span className="public-eyebrow">YOUR SCHOOL DAY, SIMPLIFIED</span>
            <h2>Already part of the community?</h2>
            <p>
              Your classes, attendance, results, and school announcements are
              waiting in your portal.
            </p>
          </div>
          <button onClick={onEnter}>
            {signedIn ? "Open my workspace" : "Sign in to the portal"}
            <ArrowRight size={18} />
          </button>
        </section>
      </main>
      <footer className="school-footer">
        <a className="school-logo" href="#home">
          <span>
            <GraduationCap size={27} />
          </span>
          <div>
            CEDAR<small>ACADEMY</small>
          </div>
        </a>
        <span>Learn with purpose. Grow with confidence.</span>
        <p>School management demo · Sample academy</p>
      </footer>
    </div>
  );
}
function Login({
  onLogin,
  onBack,
}: {
  onLogin: (u: User) => void;
  onBack: () => void;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ user: User }>("/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      onLogin(result.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <button className="back-home" onClick={onBack}>
        <ArrowRight size={16} />
        Back to school home
      </button>
      <section className="login-story">
        <div className="brand">
          <span className="brand-icon">
            <GraduationCap size={30} />
          </span>
          cedar.
        </div>
        <div>
          <span className="banner-label">CEDAR SCHOOL INFORMATION SYSTEM</span>
          <h1>
            Your school.
            <br />
            Your people.
            <br />
            <em>One workspace.</em>
          </h1>
          <p>
            Access classes, attendance, and academic results.
            <br />
            Built around your school day.
          </p>
          <div className="login-illustration" aria-hidden="true">
            <BookOpen size={100} strokeWidth={1} />
            <span>✦</span>
            <GraduationCap size={70} strokeWidth={1.3} />
          </div>
        </div>
        <small>CEDAR ACADEMY · STUDENT & STAFF PORTAL</small>
      </section>
      <section className="login-form">
        <div>
          <span className="eyebrow">WELCOME TO YOUR WORKSPACE</span>
          <h2>Welcome to your portal.</h2>
          <p>Sign in to your Cedar account.</p>
          <form onSubmit={login}>
            <label>
              Email address
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.edu"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </label>
            {error && (
              <div className="alert" role="alert">
                {error}
              </div>
            )}
            <button className="button primary" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="demo-box">
            <strong>Take a look around</strong>
            <p>Choose a demo role to fill in the login details.</p>
            <div>
              {["admin", "teacher", "student"].map((role) => (
                <button
                  type="button"
                  disabled={busy}
                  key={role}
                  onClick={() => {
                    setEmail(role + "@cedar.demo");
                    setPassword("CedarDemo123!");
                    setError("");
                  }}
                >
                  {role}
                </button>
              ))}
            </div>
            <small>Local demo accounts · sample school data</small>
          </div>
          <span className="login-foot">
            <Mail size={14} /> Need an account? Ask your school administrator.
          </span>
        </div>
      </section>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
