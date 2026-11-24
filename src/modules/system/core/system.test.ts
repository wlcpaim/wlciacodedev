import { describe, expect, it } from "vitest";
import { plan } from "./cognitive";
import { applyEditBody, changeState, diagnose, listDir, normalizePath, renderTree, searchFiles, type WsFile } from "./workspace";
import { execute } from "./executor";
import { CONFIRM_RE, CANCEL_RE } from "../services/system-chat.server";

const f = (path: string, content: string, base: string | null = content, deleted = false): WsFile =>
  ({ id: path, path, content, base_content: base, deleted, updated_at: "t" });

describe("terminal parser", () => {
  it.each([
    ["ls src", "LIST_FILES"], ["tree", "TREE"], ["read src/a.ts", "READ_FILE"], ["search foo bar", "SEARCH"],
    ["analyze", "ANALYZE"], ["diagnose", "DIAGNOSE"], ["fix", "FIX"], ["diff", "DIFF"], ["status", "STATUS"],
    ["help", "HELP"], ["projects", "PROJECTS"], ["use meu app", "USE_PROJECT"],
  ])("%s -> %s", (cmd, intent) => expect(plan(cmd).intent).toBe(intent));

  it("destructive commands require confirmation", () => {
    for (const c of ["delete a.ts", "rename a.ts b.ts", "edit a.ts\nx", "commit msg", "test", "run npm test"]) expect(plan(c).needsConfirm).toBe(true);
    for (const c of ["ls", "read a.ts", "create a.ts\nx", "search x"]) expect(plan(c).needsConfirm).toBe(false);
  });
  it("keeps body lines for create/edit", () => {
    const p = plan("create src/n.ts\nexport const a = 1;\nexport const b = 2;");
    expect(p.params).toEqual({ path: "src/n.ts", body: "export const a = 1;\nexport const b = 2;" });
  });
  it("missing args become a usage error, not an action", () => {
    expect(plan("read").intent).toBe("UNKNOWN");
    expect(plan("rename a.ts").intent).toBe("UNKNOWN");
  });
  it("accepts a prompt prefix and Portuguese phrases", () => {
    expect(plan("wlc:~$ ls").intent).toBe("LIST_FILES");
    expect(plan("renomear a.ts para b.ts").params).toEqual({ from: "a.ts", to: "b.ts" });
  });
  it("natural language becomes a plan without confirmation", () => {
    const p = plan("modernize todo o sistema de login");
    expect(p.intent).toBe("MUTATE_SYSTEM");
    expect(p.needsConfirm).toBe(false);
  });
  it("confirm/cancel words", () => {
    expect(CONFIRM_RE.test("confirmar")).toBe(true);
    expect(CANCEL_RE.test("cancelar")).toBe(true);
    expect(CONFIRM_RE.test("confirmar tudo agora")).toBe(false);
  });
});

describe("workspace rules", () => {
  const files = [f("src/a.ts", 'import { b } from "./b";\nimport x from "./missing";'), f("src/b.ts", "export const b = 1;"), f("package.json", "{bad"), f("old.ts", "", "x", true)];
  it("lists folders first and hides deleted files", () => {
    expect(listDir(files, "")).toEqual(["src/", "package.json"]);
    expect(renderTree(files)).toContain("└── b.ts");
  });
  it("rejects path traversal", () => {
    expect(normalizePath("../etc/passwd")).toBeNull();
    expect(normalizePath("./src//a.ts")).toBe("src/a.ts");
  });
  it("diagnose finds broken imports and invalid JSON only", () => {
    const msgs = diagnose(files).map((i) => `${i.path}:${i.line}`);
    expect(msgs).toEqual(["src/a.ts:2", "package.json:1"]);
  });
  it("search returns path and line", () => {
    expect(searchFiles(files, "export const")).toEqual([{ path: "src/b.ts", line: 1, text: "export const b = 1;" }]);
  });
  it("change states distinguish local changes", () => {
    expect(changeState(f("a", "1", "1"))).toBe("unchanged");
    expect(changeState(f("a", "2", "1"))).toBe("modified");
    expect(changeState(f("a", "1", null))).toBe("created");
    expect(changeState(f("a", "1", "1", true))).toBe("deleted");
  });
  it("edit blocks apply surgically and fail on missing snippet", () => {
    expect(applyEditBody("a\nb\nc", "<<<\nb\n===\nB\n>>>")).toBe("a\nB\nc");
    expect(() => applyEditBody("a", "<<<\nzzz\n===\ny\n>>>")).toThrow();
    expect(applyEditBody("old", "new full")).toBe("new full");
  });
});

describe("executor", () => {
  it("never claims file operations without data access", async () => {
    const r = await execute(plan("ls"), { userId: "u" });
    expect(r.ok).toBe(false);
  });
  it("deploy is not faked", async () => {
    expect((await execute(plan("deploy"), { userId: "u", confirmed: true })).ok).toBe(false);
  });
});

describe("diff", () => {
  it("shows removal before addition and no phantom line for new files", async () => {
    const { lineDiff } = await import("./workspace");
    expect(lineDiff("a\nb", "a\nB")).toBe("- b\n+ B");
    expect(lineDiff("", "x")).toBe("+ x");
  });
});
