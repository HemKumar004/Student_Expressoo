/**
 * Create an administrator account (use this to bootstrap production).
 *
 *   npm run create-admin                       # interactive prompts
 *   ADMIN_USERNAME=principal ADMIN_EMAIL=office@college.edu ADMIN_NAME="Principal Office" \
 *   ADMIN_PASSWORD='…' npm run create-admin    # non-interactive (CI / containers)
 *
 * Administrator access is never granted through public registration.
 */
const readline = require("readline");
const prisma = require("../src/lib/prisma");
const { createAdmin } = require("../src/validators/people");
const { hashPassword } = require("../src/utils/password");

function ask(rl, question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    if (!hidden) return rl.question(question, (a) => resolve(a.trim()));
    // Mask typed characters for the password prompt.
    const out = rl.output;
    rl.output = { write: (s) => (s.includes(question) ? out.write(s) : out.write("*")) };
    rl.question(question, (a) => {
      rl.output = out;
      out.write("\n");
      resolve(a);
    });
  });
}

async function main() {
  let input = {
    username: process.env.ADMIN_USERNAME,
    email: process.env.ADMIN_EMAIL,
    fullName: process.env.ADMIN_NAME,
    password: process.env.ADMIN_PASSWORD,
    mobile: process.env.ADMIN_MOBILE || undefined,
  };

  if (!input.username || !input.email || !input.fullName || !input.password) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    console.log("Create a Student Expressoo administrator\n");
    input.fullName = input.fullName || (await ask(rl, "Full name: "));
    input.username = input.username || (await ask(rl, "Username: "));
    input.email = input.email || (await ask(rl, "Email: "));
    input.password = input.password || (await ask(rl, "Password (min 8 chars, a letter and a number): ", { hidden: true }));
    rl.close();
  }

  const parsed = createAdmin.safeParse(input);
  if (!parsed.success) {
    console.error("\nCannot create administrator:");
    for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    process.exitCode = 1;
    return;
  }
  const data = parsed.data;
  const clash = await prisma.user.findFirst({ where: { OR: [{ username: data.username }, { email: data.email }] } });
  if (clash) {
    console.error(`\nAn account with that ${clash.username === data.username ? "username" : "email"} already exists.`);
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.create({
    data: { username: data.username, email: data.email, fullName: data.fullName, mobile: data.mobile ?? null, passwordHash: await hashPassword(data.password), role: "ADMIN", status: "ACTIVE" },
  });
  await prisma.auditLog.create({ data: { actorId: null, action: "admin.create", entityType: "user", entityId: String(user.id), summary: `Administrator ${user.fullName} (${user.username}) created from the command line` } });
  console.log(`\n✓ Administrator "${user.username}" created. Sign in at the Admin Console.`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
