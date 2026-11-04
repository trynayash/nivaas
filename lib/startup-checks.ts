// Imported by instrumentation.ts in the Node.js runtime only.
const building = process.env.NEXT_PHASE === "phase-production-build";
const password = process.env.ADMIN_PASSWORD?.trim() ?? "";

if (!building) {
  const problems: string[] = [];
  if (!password) problems.push("ADMIN_PASSWORD is not set.");
  else if (password.length < 12) problems.push("ADMIN_PASSWORD must be at least 12 characters.");

  if (process.env.NODE_ENV === "production" && problems.length) {
    console.error(
      "\n[nivaas] Refusing to start:\n  - " +
        problems.join("\n  - ") +
        "\nSet them in the environment (e.g. Vercel → Project → Settings → Environment Variables) and redeploy.\n"
    );
    process.exit(1);
  } else if (!password) {
    console.warn("[nivaas] ADMIN_PASSWORD is not set — the Studio login is disabled. Add it to .env.local.");
  }
}

export {};
