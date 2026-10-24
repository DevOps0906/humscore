import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseScore } from "./score-schema";

describe("supabase/seed.sql", () => {
  it("시드 악보 JSON 은 모두 scoreSchema 를 통과한다", () => {
    const sql = readFileSync("supabase/seed.sql", "utf8");
    const blobs = [...sql.matchAll(/\$json\$([\s\S]*?)\$json\$/g)].map((m) => JSON.parse(m[1]));
    expect(blobs.length).toBe(2);
    for (const b of blobs) expect(parseScore(b)).not.toBeNull();
    expect(blobs.some((b) => b.dynamics?.length && b.marks?.length)).toBe(true);
  });
});
