"use client";

import { useState, useTransition } from "react";
import { sendMagicLink } from "../auth/actions";

export default function LoginPage() {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await sendMagicLink(formData);
      if (result?.error) setError(result.error);
      else setSent(true);
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="font-serif text-2xl font-bold">Manifest</div>
          <div className="text-inkSoft text-[13px] mt-1">Disposition workspace</div>
        </div>

        {sent ? (
          <div className="border border-hairline rounded-sm p-5 text-center">
            <p className="text-[13.5px]">
              Check <strong>{email}</strong> for a sign-in link. It expires after a few minutes, so use it soon.
            </p>
            <button
              onClick={() => setSent(false)}
              className="text-[12px] text-inkSoft underline underline-offset-2 mt-3"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form action={handleSubmit} className="border border-hairline rounded-sm p-5">
            <label className="block text-[11.5px] text-inkSoft mb-1.5">Work email</label>
            <input
              type="email"
              name="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@brand.com"
              className="w-full border border-hairline rounded-sm p-2.5 text-sm mb-3"
            />
            {error && <div className="text-clay text-[12.5px] mb-3">{error}</div>}
            <button
              type="submit"
              disabled={pending}
              className="w-full bg-denim text-white text-[13px] font-medium py-2.5 rounded-sm disabled:opacity-50"
            >
              {pending ? "Sending…" : "Send sign-in link"}
            </button>
            <p className="text-[11.5px] text-inkSoft mt-3">
              No password to remember — we'll email you a one-time link. You need to already be added as a member
              of your organization for access to load any data (ask whoever set up your workspace).
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
