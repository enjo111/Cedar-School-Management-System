import express from "express";
import { DatabaseSync } from "node:sqlite";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const schoolDate = (value = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hash = (value, salt = randomBytes(16).toString("hex")) =>
  `${salt}:${scryptSync(value, salt, 64).toString("hex")}`;
const matches = (value, stored) => {
  const [salt, digest] = stored.split(":");
  return timingSafeEqual(
    Buffer.from(digest, "hex"),
    scryptSync(value, salt, 64),
  );
};
export function createApp(filename = path.join(root, "data", "school.db")) {
  if (filename !== ":memory:")
    mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','teacher','student')), joined TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS classes(id INTEGER PRIMARY KEY, name TEXT NOT NULL, subject TEXT NOT NULL, room TEXT NOT NULL, schedule TEXT NOT NULL, teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT, color TEXT DEFAULT 'green');
    CREATE TABLE IF NOT EXISTS enrolments(class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE, student_id INTEGER REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(class_id, student_id));
    CREATE TABLE IF NOT EXISTS attendance(class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE, student_id INTEGER REFERENCES users(id) ON DELETE CASCADE, date TEXT NOT NULL, status TEXT CHECK(status IN ('present','absent','late')), PRIMARY KEY(class_id,student_id,date));
    CREATE TABLE IF NOT EXISTS results(id INTEGER PRIMARY KEY, class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE, student_id INTEGER REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, score REAL NOT NULL, total REAL NOT NULL, date TEXT NOT NULL, feedback TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS announcements(id INTEGER PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, author_id INTEGER REFERENCES users(id), created TEXT DEFAULT CURRENT_TIMESTAMP);`);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const get = (sql, ...args) => db.prepare(sql).get(...args);
  if (!get("SELECT id FROM users LIMIT 1")) {
    const password = hash("CedarDemo123!");
    const people = [
      ["Alex Morgan", "admin@cedar.demo", "admin"],
      ["Sarah Chen", "teacher@cedar.demo", "teacher"],
      ["James Wilson", "james@cedar.demo", "teacher"],
      ["Amara Okafor", "student@cedar.demo", "student"],
      ["Oliver Bennett", "oliver@cedar.demo", "student"],
      ["Mia Rodriguez", "mia@cedar.demo", "student"],
      ["Ethan Park", "ethan@cedar.demo", "student"],
      ["Sofia Patel", "sofia@cedar.demo", "student"],
      ["Noah Williams", "noah@cedar.demo", "student"],
      ["Isabella Rossi", "isabella@cedar.demo", "student"],
      ["Lucas Martin", "lucas@cedar.demo", "student"],
    ];
    for (const [name, email, role] of people)
      run(
        "INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)",
        name,
        email,
        password,
        role,
      );
    for (const c of [
      [
        "Mathematics · 10A",
        "Mathematics",
        "Room 201",
        "Mon, Wed · 09:00–10:30",
        2,
        "green",
      ],
      [
        "English literature · 10A",
        "English",
        "Room 104",
        "Tue, Thu · 10:00–11:30",
        3,
        "purple",
      ],
      [
        "Physics · 11B",
        "Science",
        "Science lab",
        "Mon, Fri · 13:00–14:30",
        2,
        "orange",
      ],
      [
        "Creative writing · 11B",
        "English",
        "Room 108",
        "Wed, Fri · 11:00–12:00",
        3,
        "blue",
      ],
    ])
      run(
        "INSERT INTO classes(name,subject,room,schedule,teacher_id,color) VALUES(?,?,?,?,?,?)",
        ...c,
      );
    for (let id = 4; id <= 11; id++) {
      for (const cid of id < 8 ? [1, 2] : [3, 4]) {
        run("INSERT INTO enrolments VALUES(?,?)", cid, id);
        for (let day = 1; day <= 5; day++) {
          const d = new Date();
          d.setDate(d.getDate() - day);
          run(
            "INSERT INTO attendance VALUES(?,?,?,?)",
            cid,
            id,
            schoolDate(d),
            (id + day) % 7 === 0
              ? "absent"
              : (id + day) % 9 === 0
                ? "late"
                : "present",
          );
        }
        run(
          "INSERT INTO results(class_id,student_id,title,score,total,date,feedback) VALUES(?,?,?,?,?,?,?)",
          cid,
          id,
          "Unit 1 assessment",
          72 + ((id * 3) % 28),
          100,
          schoolDate(),
          "Good progress. Keep practising the core concepts.",
        );
      }
    }
    run(
      "INSERT INTO announcements(title,body,author_id) VALUES(?,?,?)",
      "Welcome to a new chapter",
      "Your school day, a little more connected. Check your classes, stay on top of attendance, and celebrate every bit of progress.",
      1,
    );
    run(
      "INSERT INTO announcements(title,body,author_id) VALUES(?,?,?)",
      "A moment for reading",
      "Our reading club meets in the library this Thursday. Bring a book you love and a little curiosity.",
      1,
    );
  }
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    if (req.path.startsWith("/api")) res.setHeader("Cache-Control", "no-store");
    next();
  });
  const fail = (res, status, message) =>
    res.status(status).json({ error: message });
  const text = (value, max = 120) =>
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= max;
  const id = (value) =>
    Number.isSafeInteger(Number(value)) && Number(value) > 0;
  const date = (value) =>
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  const publicUser = (u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    joined: u.joined,
  });
  const attempts = new Map();
  app.use("/api", (req, res, next) => {
    if (
      !["GET", "HEAD"].includes(req.method) &&
      req.headers.origin &&
      req.headers.origin !== `${req.protocol}://${req.get("host")}`
    ) {
      const origin = req.headers.origin;
      if (
        origin !== process.env.CLIENT_ORIGIN &&
        !(
          process.env.NODE_ENV !== "production" &&
          /^http:\/\/(localhost|127\.0\.0\.1):5173$/.test(origin)
        )
      )
        return fail(res, 403, "Request origin is not allowed.");
    }
    next();
  });
  app.post("/api/login", (req, res) => {
    const key = req.ip;
    const now = Date.now();
    let a = attempts.get(key);
    if (!a || now > a.until) {
      a = { count: 0, until: now + 15 * 60 * 1000 };
      attempts.set(key, a);
    }
    if (a.count >= 30)
      return fail(
        res,
        429,
        "Too many attempts. Please try again in 15 minutes.",
      );
    a.count++;
    const { email, password } = req.body;
    if (!text(email) || !text(password, 200))
      return fail(res, 400, "Enter your email and password.");
    const user = get(
      "SELECT * FROM users WHERE email=?",
      email.trim().toLowerCase(),
    );
    if (!user || !matches(password, user.password))
      return fail(res, 401, "Email or password is incorrect.");
    attempts.delete(key);
    const token = randomBytes(32).toString("hex");
    run("DELETE FROM sessions WHERE expires<?", now);
    run("INSERT INTO sessions VALUES(?,?,?)", token, user.id, now + 86400000);
    res.cookie("cedar_session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 86400000,
      path: "/",
    });
    res.json({ user: publicUser(user) });
  });
  app.use("/api", (req, res, next) => {
    const token = req.headers.cookie
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("cedar_session="))
      ?.slice(14);
    const user =
      token &&
      get(
        "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?",
        token,
        Date.now(),
      );
    if (!user) return fail(res, 401, "Please sign in to continue.");
    req.user = user;
    req.session = token;
    next();
  });
  const roles =
    (...allowed) =>
    (req, res, next) =>
      allowed.includes(req.user.role)
        ? next()
        : fail(res, 403, "You do not have permission to do that.");
  const canClass = (user, cid) =>
    user.role === "admin" ||
    (user.role === "teacher"
      ? !!get(
          "SELECT id FROM classes WHERE id=? AND teacher_id=?",
          cid,
          user.id,
        )
      : !!get(
          "SELECT class_id FROM enrolments WHERE class_id=? AND student_id=?",
          cid,
          user.id,
        ));
  const classList = (user) =>
    all(
      `SELECT c.*,u.name teacher_name,(SELECT COUNT(*) FROM enrolments e WHERE e.class_id=c.id) student_count FROM classes c JOIN users u ON u.id=c.teacher_id ${user.role === "admin" ? "" : user.role === "teacher" ? "WHERE c.teacher_id=?" : "WHERE c.id IN (SELECT class_id FROM enrolments WHERE student_id=?)"} ORDER BY c.id`,
      ...(user.role === "admin" ? [] : [user.id]),
    );
  app.get("/api/me", (req, res) => res.json(publicUser(req.user)));
  app.post("/api/logout", (req, res) => {
    run("DELETE FROM sessions WHERE token=?", req.session);
    res.clearCookie("cedar_session", { path: "/" });
    res.json({ ok: true });
  });
  app.get("/api/overview", (req, res) => {
    const classes = classList(req.user);
    const ids = classes.map((c) => c.id);
    const placeholders = ids.map(() => "?").join(",") || "NULL";
    const self = req.user.role === "student";
    const attendance = all(
      `SELECT status,COUNT(*) count FROM attendance WHERE class_id IN (${placeholders}) ${self ? "AND student_id=?" : ""} GROUP BY status`,
      ...ids,
      ...(self ? [req.user.id] : []),
    );
    const results = all(
      `SELECT r.*,u.name student_name,c.name class_name FROM results r JOIN users u ON u.id=r.student_id JOIN classes c ON c.id=r.class_id WHERE r.class_id IN (${placeholders}) ${self ? "AND r.student_id=?" : ""} ORDER BY r.id DESC LIMIT 8`,
      ...ids,
      ...(self ? [req.user.id] : []),
    );
    res.json({
      classes,
      students: self
        ? 1
        : get(
            `SELECT COUNT(DISTINCT student_id) count FROM enrolments WHERE class_id IN (${placeholders})`,
            ...ids,
          ).count,
      teachers:
        req.user.role === "admin"
          ? get("SELECT COUNT(*) count FROM users WHERE role='teacher'").count
          : undefined,
      attendance,
      results,
      announcements: all(
        "SELECT a.*,u.name author_name FROM announcements a LEFT JOIN users u ON u.id=a.author_id ORDER BY a.id DESC LIMIT 20",
      ),
    });
  });
  app.get("/api/people", roles("admin", "teacher"), (req, res) => {
    res.json(
      req.user.role === "admin"
        ? all("SELECT id,name,email,role,joined FROM users ORDER BY name")
        : all(
            "SELECT DISTINCT u.id,u.name,u.email,u.role,u.joined FROM users u JOIN enrolments e ON e.student_id=u.id JOIN classes c ON c.id=e.class_id WHERE c.teacher_id=? ORDER BY u.name",
            req.user.id,
          ),
    );
  });
  app.post("/api/people", roles("admin"), (req, res) => {
    const { name, email, role, password } = req.body;
    if (
      !text(name, 80) ||
      !text(email, 160) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !["student", "teacher"].includes(role) ||
      typeof password !== "string" ||
      password.length < 10 ||
      password.length > 128
    )
      return fail(
        res,
        400,
        "Provide a name, valid email, student/teacher role and a password of 10–128 characters.",
      );
    if (get("SELECT id FROM users WHERE email=?", email.trim().toLowerCase()))
      return fail(res, 409, "This email is already in use.");
    const r = run(
      "INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)",
      name.trim(),
      email.trim().toLowerCase(),
      hash(password),
      role,
    );
    res
      .status(201)
      .json(
        publicUser(
          get("SELECT * FROM users WHERE id=?", Number(r.lastInsertRowid)),
        ),
      );
  });
  app.put("/api/people/:id", roles("admin"), (req, res) => {
    const person = get("SELECT * FROM users WHERE id=?", req.params.id);
    if (!person) return fail(res, 404, "Person not found.");
    if (person.role === "admin")
      return fail(res, 400, "Administrator profiles cannot be edited here.");
    const { name, email } = req.body;
    if (
      !text(name, 80) ||
      !text(email, 160) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    )
      return fail(res, 400, "Enter a name and valid email address.");
    if (
      get(
        "SELECT id FROM users WHERE email=? AND id<>?",
        email.trim().toLowerCase(),
        person.id,
      )
    )
      return fail(res, 409, "This email is already in use.");
    run(
      "UPDATE users SET name=?,email=? WHERE id=?",
      name.trim(),
      email.trim().toLowerCase(),
      person.id,
    );
    res.json(publicUser(get("SELECT * FROM users WHERE id=?", person.id)));
  });
  app.delete("/api/people/:id", roles("admin"), (req, res) => {
    const u = get("SELECT * FROM users WHERE id=?", req.params.id);
    if (!u) return fail(res, 404, "Person not found.");
    if (u.role === "admin")
      return fail(res, 400, "Administrator accounts cannot be removed.");
    if (get("SELECT id FROM classes WHERE teacher_id=?", u.id))
      return fail(
        res,
        409,
        "Reassign this teacher’s classes before removing them.",
      );
    run("DELETE FROM users WHERE id=?", u.id);
    res.json({ ok: true });
  });
  app.get("/api/classes", (req, res) => res.json(classList(req.user)));
  app.post("/api/classes", roles("admin"), (req, res) => {
    const { name, subject, room, schedule, teacher_id } = req.body;
    if (
      ![name, subject, room, schedule].every((v) => text(v)) ||
      !id(teacher_id) ||
      !get("SELECT id FROM users WHERE id=? AND role='teacher'", teacher_id)
    )
      return fail(res, 400, "Complete all fields and select a teacher.");
    const r = run(
      "INSERT INTO classes(name,subject,room,schedule,teacher_id) VALUES(?,?,?,?,?)",
      name.trim(),
      subject.trim(),
      room.trim(),
      schedule.trim(),
      teacher_id,
    );
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  });
  app.put("/api/classes/:id", roles("admin"), (req, res) => {
    const { name, subject, room, schedule, teacher_id } = req.body;
    if (!get("SELECT id FROM classes WHERE id=?", req.params.id))
      return fail(res, 404, "Class not found.");
    if (
      ![name, subject, room, schedule].every((v) => text(v)) ||
      !id(teacher_id) ||
      !get("SELECT id FROM users WHERE id=? AND role='teacher'", teacher_id)
    )
      return fail(res, 400, "Complete all fields and select a teacher.");
    run(
      "UPDATE classes SET name=?,subject=?,room=?,schedule=?,teacher_id=? WHERE id=?",
      name.trim(),
      subject.trim(),
      room.trim(),
      schedule.trim(),
      teacher_id,
      req.params.id,
    );
    res.json({ ok: true });
  });
  app.delete("/api/classes/:id", roles("admin"), (req, res) => {
    const r = run("DELETE FROM classes WHERE id=?", req.params.id);
    if (!r.changes) return fail(res, 404, "Class not found.");
    res.json({ ok: true });
  });
  app.get("/api/classes/:id/students", (req, res) => {
    if (!canClass(req.user, req.params.id))
      return fail(res, 403, "You cannot access this class.");
    if (req.user.role === "student") return res.json([publicUser(req.user)]);
    res.json(
      all(
        "SELECT u.id,u.name,u.email FROM users u JOIN enrolments e ON e.student_id=u.id WHERE e.class_id=? ORDER BY u.name",
        req.params.id,
      ),
    );
  });
  app.post("/api/classes/:id/enrolments", roles("admin"), (req, res) => {
    const { student_id } = req.body;
    if (
      !get("SELECT id FROM classes WHERE id=?", req.params.id) ||
      !id(student_id) ||
      !get("SELECT id FROM users WHERE id=? AND role='student'", student_id)
    )
      return fail(res, 400, "Select an existing class and student.");
    run(
      "INSERT OR IGNORE INTO enrolments VALUES(?,?)",
      req.params.id,
      student_id,
    );
    res.status(201).json({ ok: true });
  });
  app.delete(
    "/api/classes/:id/enrolments/:student",
    roles("admin"),
    (req, res) => {
      db.exec("BEGIN");
      try {
        run(
          "DELETE FROM attendance WHERE class_id=? AND student_id=?",
          req.params.id,
          req.params.student,
        );
        run(
          "DELETE FROM results WHERE class_id=? AND student_id=?",
          req.params.id,
          req.params.student,
        );
        run(
          "DELETE FROM enrolments WHERE class_id=? AND student_id=?",
          req.params.id,
          req.params.student,
        );
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
      res.json({ ok: true });
    },
  );
  app.get("/api/attendance", (req, res) => {
    const cid = req.query.class_id,
      d = req.query.date;
    if (!id(cid) || !date(d))
      return fail(res, 400, "Select a class and valid date.");
    if (!canClass(req.user, cid))
      return fail(res, 403, "You cannot access this class.");
    res.json(
      all(
        `SELECT * FROM attendance WHERE class_id=? AND date=? ${req.user.role === "student" ? "AND student_id=?" : ""}`,
        cid,
        d,
        ...(req.user.role === "student" ? [req.user.id] : []),
      ),
    );
  });
  app.put("/api/attendance", roles("admin", "teacher"), (req, res) => {
    const { class_id, date: d, records } = req.body;
    if (
      !id(class_id) ||
      !date(d) ||
      d > schoolDate() ||
      !Array.isArray(records) ||
      records.length > 500
    )
      return fail(
        res,
        400,
        "Choose a class, a date no later than today, and attendance records.",
      );
    if (!canClass(req.user, class_id))
      return fail(res, 403, "You cannot edit this class.");
    for (const r of records)
      if (
        !id(r.student_id) ||
        !["present", "absent", "late"].includes(r.status) ||
        !get(
          "SELECT * FROM enrolments WHERE class_id=? AND student_id=?",
          class_id,
          r.student_id,
        )
      )
        return fail(
          res,
          400,
          "Every attendance record must belong to an enrolled student.",
        );
    db.exec("BEGIN");
    try {
      for (const r of records)
        run(
          "INSERT INTO attendance VALUES(?,?,?,?) ON CONFLICT(class_id,student_id,date) DO UPDATE SET status=excluded.status",
          class_id,
          r.student_id,
          d,
          r.status,
        );
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    res.json({ ok: true });
  });
  app.get("/api/results", (req, res) => {
    const classes = classList(req.user).map((c) => c.id);
    res.json(
      all(
        `SELECT r.*,u.name student_name,c.name class_name FROM results r JOIN users u ON u.id=r.student_id JOIN classes c ON c.id=r.class_id WHERE r.class_id IN (${classes.map(() => "?").join(",") || "NULL"}) ${req.user.role === "student" ? "AND student_id=?" : ""} ORDER BY r.date DESC,r.id DESC`,
        ...classes,
        ...(req.user.role === "student" ? [req.user.id] : []),
      ),
    );
  });
  app.post("/api/results", roles("admin", "teacher"), (req, res) => {
    const {
      class_id,
      student_id,
      title,
      score,
      total,
      date: d,
      feedback = "",
    } = req.body;
    if (
      !id(class_id) ||
      !id(student_id) ||
      !text(title) ||
      !date(d) ||
      typeof score !== "number" ||
      typeof total !== "number" ||
      !Number.isFinite(score) ||
      !Number.isFinite(total) ||
      score < 0 ||
      total <= 0 ||
      score > total ||
      typeof feedback !== "string" ||
      feedback.length > 1000
    )
      return fail(
        res,
        400,
        "Enter an assessment, valid date and score between zero and the total.",
      );
    if (!canClass(req.user, class_id))
      return fail(res, 403, "You cannot edit this class.");
    if (
      !get(
        "SELECT * FROM enrolments WHERE class_id=? AND student_id=?",
        class_id,
        student_id,
      )
    )
      return fail(res, 400, "The student must be enrolled in this class.");
    run(
      "INSERT INTO results(class_id,student_id,title,score,total,date,feedback) VALUES(?,?,?,?,?,?,?)",
      class_id,
      student_id,
      title.trim(),
      score,
      total,
      d,
      feedback,
    );
    res.status(201).json({ ok: true });
  });
  app.delete("/api/results/:id", roles("admin", "teacher"), (req, res) => {
    const r = get("SELECT * FROM results WHERE id=?", req.params.id);
    if (!r) return fail(res, 404, "Result not found.");
    if (!canClass(req.user, r.class_id))
      return fail(res, 403, "You cannot edit this class.");
    run("DELETE FROM results WHERE id=?", r.id);
    res.json({ ok: true });
  });
  app.post("/api/announcements", roles("admin"), (req, res) => {
    if (!text(req.body.title) || !text(req.body.body, 2000))
      return fail(res, 400, "Enter a title and message.");
    run(
      "INSERT INTO announcements(title,body,author_id) VALUES(?,?,?)",
      req.body.title.trim(),
      req.body.body.trim(),
      req.user.id,
    );
    res.status(201).json({ ok: true });
  });
  app.delete("/api/announcements/:id", roles("admin"), (req, res) => {
    run("DELETE FROM announcements WHERE id=?", req.params.id);
    res.json({ ok: true });
  });
  app.use("/api", (req, res) => fail(res, 404, "Endpoint not found."));
  app.use(express.static(path.join(root, "dist")));
  app.get("/{*path}", (req, res) =>
    res.sendFile(path.join(root, "dist", "index.html")),
  );
  app.use((error, req, res, next) => {
    if (error instanceof SyntaxError)
      return fail(res, 400, "Invalid JSON request.");
    console.error(error);
    fail(res, 500, "Something went wrong. Please try again.");
  });
  return { app, db };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { app } = createApp();
  app.listen(Number(process.env.PORT) || 3001, "127.0.0.1", () =>
    console.log("Cedar API: http://127.0.0.1:3001"),
  );
}
