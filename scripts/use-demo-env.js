/**
 * Copies `frontend/.env.demo` to `frontend/.env.local`.
 *
 * `.env.local` is gitignored — correctly, since it is where real keys go — so a
 * fresh clone has no demo configuration until this runs. Plain Node rather than
 * a shell one-liner because `cp` and `copy` disagree across the platforms this
 * repository is developed on.
 *
 * Refuses to clobber an existing `.env.local`: that file may hold a real
 * deployment's addresses, and silently overwriting it to run a demo would be a
 * bad trade. It says what to do instead.
 */

const fs = require("node:fs");
const path = require("node:path");

const frontend = path.join(__dirname, "..", "frontend");
const source = path.join(frontend, ".env.demo");
const target = path.join(frontend, ".env.local");

if (!fs.existsSync(source)) {
  console.error(`Missing ${path.relative(process.cwd(), source)}.`);
  process.exit(1);
}

if (fs.existsSync(target)) {
  const current = fs.readFileSync(target, "utf8");

  if (/^\s*NEXT_PUBLIC_DEMO_MODE\s*=\s*true\s*$/m.test(current)) {
    console.log("frontend/.env.local already has demo mode enabled — leaving it alone.");
    process.exit(0);
  }

  console.error(
    "frontend/.env.local exists and does not enable demo mode.\n" +
      "Not overwriting it. Either add NEXT_PUBLIC_DEMO_MODE=true to that file,\n" +
      "or move it aside and run this again.",
  );
  process.exit(1);
}

fs.copyFileSync(source, target);
console.log("Wrote frontend/.env.local from frontend/.env.demo — demo mode is on.");
