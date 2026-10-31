import { describe, it, expect } from "vitest";
import { BadRequestError } from "../errors/app-error";
import { fail, ok, toErrorResponse } from "../errors/respond";

describe("response envelope", () => {
  it("ok() wraps data with ok:true", async () => {
    const res = ok({ status: "ok" });
    const body = await res.json();
    expect(body).toEqual({ ok: true, data: { status: "ok" } });
    expect(res.status).toBe(200);
  });

  it("fail() produces the failure envelope with correct status", async () => {
    const res = fail("NOT_FOUND", "nope", 404);
    const body = await res.json();
    expect(body).toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: "nope" },
    });
    expect(res.status).toBe(404);
  });

  it("toErrorResponse() maps AppError to its envelope", async () => {
    const res = toErrorResponse(new BadRequestError("bad"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("toErrorResponse() maps unknown errors to INTERNAL without leaking", async () => {
    const res = toErrorResponse(new Error("secret db string"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL");
    expect(JSON.stringify(body)).not.toContain("secret db string");
  });
});
