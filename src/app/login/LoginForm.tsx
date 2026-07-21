"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"SIGN_IN" | "FIRST_LOGIN">("SIGN_IN");
  const [accountType, setAccountType] = useState<"STUDENT" | "STAFF">("STUDENT");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleFirstLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/first-login/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountType, identifier }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to request verification code.");
      }

      setMessage(data.message || "Verification code sent if account is eligible.");
      
      sessionStorage.setItem("first_login_account_type", accountType);
      sessionStorage.setItem("first_login_identifier", identifier);
      
      router.push("/auth/verify-otp");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountType, identifier, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to sign in with the provided credentials.");
      }
      
      // Clean up session storage on successful login
      sessionStorage.removeItem("first_login_account_type");
      sessionStorage.removeItem("first_login_identifier");

      // Use window.location.href to ensure a full refresh and proper server state sync
      window.location.href = data.redirectTo || "/";
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-10 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
        
        <div>
          <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Welcome to ACE
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            {mode === "SIGN_IN" ? "Sign in to your account" : "First-time account setup"}
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex justify-center space-x-4 mb-4 border-b border-gray-200 dark:border-gray-700 pb-4">
          <button
            type="button"
            onClick={() => { setMode("SIGN_IN"); setError(""); setMessage(""); setPassword(""); }}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              mode === "SIGN_IN"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode("FIRST_LOGIN"); setError(""); setMessage(""); setPassword(""); }}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              mode === "FIRST_LOGIN"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            First-Time Login
          </button>
        </div>

        {/* Account Type Toggle */}
        <div className="flex justify-center space-x-4 mb-6">
          <button
            type="button"
            onClick={() => { setAccountType("STUDENT"); setIdentifier(""); setError(""); setMessage(""); }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              accountType === "STUDENT"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            Student
          </button>
          <button
            type="button"
            onClick={() => { setAccountType("STAFF"); setIdentifier(""); setError(""); setMessage(""); }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              accountType === "STAFF"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            Staff
          </button>
        </div>

        <form className="mt-8 space-y-6" onSubmit={mode === "SIGN_IN" ? handleSignInSubmit : handleFirstLoginSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {accountType === "STUDENT" ? "Roll Number" : "Approved Email"}
              </label>
              <input
                id="identifier"
                name="identifier"
                type={accountType === "STUDENT" ? "text" : "email"}
                required
                className="appearance-none relative block w-full px-3 py-3 mt-1 border border-gray-300 dark:border-gray-600 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-700 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm transition-colors"
                placeholder={accountType === "STUDENT" ? "e.g., 24AG1A05F7" : "name@example.com"}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={loading}
              />
            </div>

            {mode === "SIGN_IN" && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Password
                </label>
                <div className="relative mt-1">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    className="appearance-none block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-700 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm transition-colors pr-10"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                    tabIndex={-1}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 dark:bg-red-900/20 py-2 rounded-md border border-red-100 dark:border-red-800">
              {error}
            </div>
          )}
          {message && (
            <div className="text-green-600 text-sm text-center bg-green-50 dark:bg-green-900/20 py-2 rounded-md border border-green-100 dark:border-green-800">
              {message}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading || !identifier.trim() || (mode === "SIGN_IN" && !password.trim())}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {loading
                ? mode === "SIGN_IN"
                  ? "Signing in..."
                  : "Sending..."
                : mode === "SIGN_IN"
                ? "Sign In"
                : "Send Verification Code"}
            </button>
          </div>
          
          {mode === "SIGN_IN" && (
            <div className="text-center mt-4">
              <button
                type="button"
                disabled
                className="text-sm text-gray-400 dark:text-gray-500 cursor-not-allowed"
                title="Forgot password recovery is unavailable"
              >
                Forgot your password?
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
