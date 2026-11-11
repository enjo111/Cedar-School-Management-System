import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "./index.js";
let server, db, base;
before(async () => {
  const instance = createApp(":memory:");
  db = instance.db;
  server = instance.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
});
async function request(route, method = "GET", body, cookie) {
  const res = await fetch(base + route, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: res.status,
    data: await res.json(),
    cookie: res.headers.get("set-cookie")?.split(";")[0],
  };
}
async function login(role) {
  const r = await request("/login", "POST", {
    email: `${role}@cedar.demo`,
    password: "CedarDemo123!",
  });
  assert.equal(r.status, 200);
  return r.cookie;
}
test("authentication, logout, and protected endpoints", async () => {
  assert.equal((await request("/people")).status, 401);
  assert.equal(
    (
      await request("/login", "POST", {
        email: "admin@cedar.demo",
        password: "incorrect",
      })
    ).status,
    401,
  );
  const c = await login("admin");
  assert.equal((await request("/me", "GET", null, c)).data.role, "admin");
  await request("/logout", "POST", {}, c);
  assert.equal((await request("/me", "GET", null, c)).status, 401);
});
test("students cannot read other students or change school records", async () => {
  const c = await login("student");
  assert.equal((await request("/people", "GET", null, c)).status, 403);
  assert.equal((await request("/classes", "POST", {}, c)).status, 403);
  const results = (await request("/results", "GET", null, c)).data;
  assert.ok(results.length > 0);
  assert.ok(results.every((r) => r.student_id === 4));
  const classes = (await request("/classes", "GET", null, c)).data;
  assert.deepEqual(
    classes.map((x) => x.id),
    [1, 2],
  );
  assert.equal(
    (await request("/classes/3/students", "GET", null, c)).status,
    403,
  );
  const students = (await request("/classes/1/students", "GET", null, c)).data;
  assert.deepEqual(
    students.map((s) => s.id),
    [4],
  );
});
test("teachers cannot operate another teacher’s class", async () => {
  const c = await login("teacher");
  assert.equal(
    (await request("/classes/2/students", "GET", null, c)).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/attendance",
        "PUT",
        { class_id: 2, date: "2026-01-01", records: [] },
        c,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/results",
        "POST",
        {
          class_id: 2,
          student_id: 4,
          title: "Forbidden",
          score: 1,
          total: 10,
          date: "2026-01-01",
        },
        c,
      )
    ).status,
    403,
  );
  assert.equal((await request("/people", "POST", {}, c)).status, 403);
});
test("admin enrolment → teacher attendance and result → student visibility", async () => {
  const admin = await login("admin"),
    teacher = await login("teacher"),
    student = await login("student");
  let r = await request(
    "/classes",
    "POST",
    {
      name: "Integration class",
      subject: "Math",
      room: "3",
      schedule: "Monday 09:00",
      teacher_id: 2,
    },
    admin,
  );
  assert.equal(r.status, 201);
  const cid = r.data.id;
  r = await request(
    `/classes/${cid}/enrolments`,
    "POST",
    { student_id: 4 },
    admin,
  );
  assert.equal(r.status, 201);
  r = await request(
    "/attendance",
    "PUT",
    {
      class_id: cid,
      date: "2026-01-01",
      records: [{ student_id: 4, status: "present" }],
    },
    teacher,
  );
  assert.equal(r.status, 200);
  assert.equal(
    (
      await request(
        `/attendance?class_id=${cid}&date=2026-01-01`,
        "GET",
        null,
        student,
      )
    ).data[0].status,
    "present",
  );
  r = await request(
    "/results",
    "POST",
    {
      class_id: cid,
      student_id: 4,
      title: "Integration exam",
      score: 9,
      total: 10,
      date: "2026-01-01",
      feedback: "Excellent",
    },
    teacher,
  );
  assert.equal(r.status, 201);
  assert.ok(
    (await request("/results", "GET", null, student)).data.some(
      (r) => r.title === "Integration exam",
    ),
  );
  assert.equal(
    (await request(`/classes/${cid}/enrolments/4`, "DELETE", null, admin))
      .status,
    200,
  );
  assert.equal(
    db.prepare("SELECT count(*) n FROM attendance WHERE class_id=?").get(cid).n,
    0,
  );
  assert.equal(
    db.prepare("SELECT count(*) n FROM results WHERE class_id=?").get(cid).n,
    0,
  );
  await request(`/classes/${cid}`, "DELETE", null, admin);
});
test("validation rejects invalid relationships and partial attendance writes", async () => {
  const admin = await login("admin"),
    teacher = await login("teacher");
  assert.equal(
    (
      await request(
        "/classes",
        "POST",
        {
          name: "X",
          subject: "Y",
          room: "Z",
          schedule: "Monday",
          teacher_id: 4,
        },
        admin,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/results",
        "POST",
        {
          class_id: 1,
          student_id: 4,
          title: "Invalid",
          score: 101,
          total: 100,
          date: "2026-01-01",
        },
        teacher,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/attendance",
        "PUT",
        { class_id: 1, date: "2026-02-30", records: [] },
        teacher,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/attendance",
        "PUT",
        {
          class_id: 1,
          date: "2026-01-02",
          records: [
            { student_id: 4, status: "present" },
            { student_id: 8, status: "absent" },
          ],
        },
        teacher,
      )
    ).status,
    400,
  );
  assert.equal(
    db
      .prepare(
        "SELECT count(*) n FROM attendance WHERE class_id=1 AND date='2026-01-02'",
      )
      .get().n,
    0,
  );
  assert.equal((await request("/people/2", "DELETE", null, admin)).status, 409);
});
test("user creation, duplicate protection, class reassignment, notices and deletion", async () => {
  const c = await login("admin");
  const payload = {
    name: "Test Teacher",
    email: "newteacher@example.test",
    role: "teacher",
    password: "StrongPassword123!",
  };
  const teacher = await request("/people", "POST", payload, c);
  assert.equal(teacher.status, 201);
  assert.equal(teacher.data.password, undefined);
  assert.equal((await request("/people", "POST", payload, c)).status, 409);
  const cls = await request(
    "/classes",
    "POST",
    {
      name: "New class",
      subject: "History",
      room: "4",
      schedule: "Friday",
      teacher_id: teacher.data.id,
    },
    c,
  );
  assert.equal(cls.status, 201);
  assert.equal(
    (
      await request(
        `/classes/${cls.data.id}`,
        "PUT",
        {
          name: "Updated class",
          subject: "History",
          room: "4",
          schedule: "Friday",
          teacher_id: 2,
        },
        c,
      )
    ).status,
    200,
  );
  assert.equal(
    (await request(`/people/${teacher.data.id}`, "DELETE", null, c)).status,
    200,
  );
  assert.equal(
    (await request(`/classes/${cls.data.id}`, "DELETE", null, c)).status,
    200,
  );
  assert.equal(
    (
      await request(
        "/announcements",
        "POST",
        { title: "Test notice", body: "Hello, school." },
        c,
      )
    ).status,
    201,
  );
  const notices = (await request("/overview", "GET", null, c)).data
    .announcements;
  assert.equal(notices[0].title, "Test notice");
  assert.equal(
    (await request("/announcements/" + notices[0].id, "DELETE", null, c))
      .status,
    200,
  );
});
test("profile edits are validated and login rejects foreign origins", async () => {
  const c = await login("admin");
  let r = await request("/people", "PUT", {}, c);
  assert.equal(r.status, 404);
  r = await request(
    "/people",
    "POST",
    {
      name: "Edit Me",
      email: "edit@example.test",
      role: "student",
      password: "LongPassword123",
    },
    c,
  );
  assert.equal(r.status, 201);
  const uid = r.data.id;
  assert.equal(
    (
      await request(
        "/people/" + uid,
        "PUT",
        { name: "Edited Student", email: "edited@example.test" },
        c,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        "/people/" + uid,
        "PUT",
        { name: "Invalid", email: "not-an-email" },
        c,
      )
    ).status,
    400,
  );
  await request("/people/" + uid, "DELETE", null, c);
  const foreign = await fetch(base + "/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://foreign.example",
    },
    body: JSON.stringify({
      email: "admin@cedar.demo",
      password: "CedarDemo123!",
    }),
  });
  assert.equal(foreign.status, 403);
});
