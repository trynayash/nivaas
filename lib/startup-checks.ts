// Imported by instrumentation.ts in the Node.js runtime only.
const building = process.env.NEXT_PHASE === "phase-production-build";
const hasPassword = !!process.env.ADMIN_PASSWORD?.trim();

if (!building && !hasPassword) {
  if (process.env.NODE_ENV === "production") {
    console.error(
      "\n[nivaas] Refusing to start: ADMIN_PASSWORD is not set.\n" +
        "Set it in the environment (e.g. Vercel → Project → Settings → Environment Variables) and restart.\n"
    );
    process.exit(1);
  } else {
    console.warn("[nivaas] ADMIN_PASSWORD is not set — the Studio login is disabled. Add it to .env.local.");
  }
}

export {};
