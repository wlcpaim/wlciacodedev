import { describe, expect, it } from "vitest";
import { isMenuPath } from "./nav-items";

describe("isMenuPath", () => {
  it("shows the footer on each menu screen", () => {
    for (const p of ["/chat", "/chat/", "/code", "/wlcia", "/settings", "/settings/database"]) expect(isMenuPath(p)).toBe(true);
  });
  it("hides the footer inside opened screens", () => {
    for (const p of ["/chat/abc", "/code/abc", "/wlcia/abc"]) expect(isMenuPath(p)).toBe(false);
  });
});
