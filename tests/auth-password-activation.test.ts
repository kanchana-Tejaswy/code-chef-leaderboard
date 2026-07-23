import { describe, it, expect } from "vitest";
import { POST as handleSetPassword } from "../src/app/api/auth/set-password/route";

describe("Password Activation Security Route", () => {
  it("Returns 410 Gone for disabled set-password endpoint in Admin-only Auth rebuild", async () => {
    const req = new Request("http://localhost:3000/api/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "Password123!", confirmPassword: "Password123!" })
    });

    const res = await handleSetPassword(req as any);
    expect(res.status).toBe(410);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.message).toBe("Set password wizard is disabled.");
  });
});
