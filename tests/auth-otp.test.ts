import { describe, it, expect } from "vitest";
import { POST as handleRequestOtp } from "../src/app/api/auth/first-login/request-otp/route";
import { POST as handleVerifyOtp } from "../src/app/api/auth/first-login/verify-otp/route";

describe("Disabled OTP Authentication Endpoints", () => {
  it("Returns 410 Gone for disabled request-otp endpoint", async () => {
    const res = await handleRequestOtp();
    expect(res.status).toBe(410);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.message).toBe("First-login OTP authentication is disabled.");
  });

  it("Returns 410 Gone for disabled verify-otp endpoint", async () => {
    const res = await handleVerifyOtp();
    expect(res.status).toBe(410);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.message).toBe("OTP verification is disabled.");
  });
});
