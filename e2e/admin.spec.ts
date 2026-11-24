// STUBBED BACKEND: these tests run the built admin against e2e/admin-mock.ts, not a real Supabase project.
// They prove the screens, routing and client-side rules. They do not prove RLS, token signing or TOTP.
import { test, expect } from "@playwright/test";
import { OWNER, PASSWORD, STUB_CODE, installAdminMock, seed } from "./admin-mock";

const shots = process.env.SHOTS === "1";
const shot = (page: import("@playwright/test").Page, name: string, full = true) =>
  shots ? page.screenshot({ path: `test-results/admin-${name}.png`, fullPage: full }) : Promise.resolve();

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("navigation", { name: "Admin" })).toBeVisible();
}

test.describe("desktop", () => {
  test.use({ viewport: { width: 1366, height: 860 } });

  test("sign-in guard, navigation and sign-out", async ({ page }) => {
    const db = seed();
    await installAdminMock(page, db);
    await page.goto("/admin/clients");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible(); // guarded route redirects
    await shot(page, "01-login-desktop", false);

    await page.getByLabel("Email").fill(OWNER.email);
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toHaveText("That email or password isn't right.");

    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("navigation", { name: "Admin" })).toBeVisible();
    await expect(page.getByText(OWNER.email, { exact: true })).toBeVisible();
    await shot(page, "02-dashboard-desktop");

    const nav = page.getByRole("navigation", { name: "Admin" });
    await nav.getByRole("link", { name: "Clients" }).click();
    await expect(page.getByText("Priya Raman").first()).toBeVisible();
    await shot(page, "03-clients-desktop");
    await nav.getByRole("link", { name: "Templates" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Templates" })).toBeVisible();
    await nav.getByRole("link", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
    await shot(page, "04-settings-desktop");

    await page.getByRole("main").getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    expect(db.authCalls.some((c) => c.path === "/logout")).toBe(true);
  });

  test("create a draft, edit, publish, unpublish, archive and restore", async ({ page }) => {
    const db = seed();
    await installAdminMock(page, db, { signedIn: true });
    await page.goto("/admin/deliveries/new");
    await page.getByLabel("Project").selectOption("p1");
    await shot(page, "05-new-delivery-desktop");
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Bakehouse website" })).toBeVisible();
    const row = db.tables.deliveries[0];
    expect(JSON.stringify(row)).not.toContain("Budget 45k"); // internal notes never copied

    await page.getByRole("tab", { name: "Builder" }).click();
    await page.getByLabel("Welcome message").fill("Thank you for trusting us.");
    await expect(page.getByRole("button", { name: "Publish" })).toBeDisabled(); // unsaved changes block publish
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("button", { name: "Publish" })).toBeEnabled();
    await shot(page, "06-editor-desktop");

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByRole("button", { name: "Unpublish" })).toBeVisible();
    await page.getByRole("button", { name: "Unpublish" }).click();
    await expect(page.getByRole("button", { name: "Publish" })).toBeVisible();

    await page.getByRole("button", { name: "Archive", exact: true }).click();
    await page.getByRole("button", { name: "Archive (links are kept)" }).click();
    await expect(page.getByRole("button", { name: "Restore to drafts" })).toBeVisible();
    await shot(page, "07-archived-desktop");
    await page.getByRole("button", { name: "Restore to drafts" }).click();

    const statuses = db.rpcCalls.filter((c) => c.fn === "set_delivery_status").map((c) => c.args.p_status);
    expect(statuses).toEqual(["published", "draft", "archived", "draft"]);
    expect(db.tables.deliveries[0].status).toBe("draft");
  });

  test("preview is same origin and the token stays out of URLs and requests", async ({ page }) => {
    const db = seed();
    await installAdminMock(page, db, { signedIn: true });
    await page.goto("/admin/deliveries/new");
    await page.getByLabel("Project").selectOption("p1");
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Bakehouse website" })).toBeVisible();
    await page.getByRole("tab", { name: "Preview" }).click();
    await page.getByRole("button", { name: "Load preview" }).click();
    const frame = page.locator('iframe[title="Client preview"]');
    await expect(frame).toBeVisible();
    const src = await frame.getAttribute("src");
    expect(src).toMatch(/^\/#[A-Za-z0-9_-]{43}$/); // relative, same origin, token in the fragment only
    const token = src!.slice(2);
    await shot(page, "08-preview-desktop");

    const leaked = db.requests.filter((r) => r.url.includes(token));
    expect(leaked).toEqual([]);
    expect(db.rpcCalls.find((c) => c.fn === "issue_delivery_token")?.args.p_kind).toBe("preview");
  });
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("sign-in and dashboard fit a phone without horizontal scrolling", async ({ page }) => {
    const db = seed();
    await installAdminMock(page, db);
    await page.goto("/login");
    await shot(page, "09-login-mobile");
    const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(await noOverflow()).toBe(true);

    await page.getByLabel("Email").fill(OWNER.email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("navigation", { name: "Admin" })).toBeVisible();
    await page.goto("/admin/deliveries");
    await expect(page.getByRole("navigation", { name: "Admin" })).toBeVisible();
    expect(await noOverflow()).toBe(true);
    await shot(page, "10-deliveries-mobile");
  });
});

test.describe("two-step sign-in (MFA)", () => {
  test.use({ viewport: { width: 1366, height: 860 } });

  test("optional: owner with no factor signs in with password only", async ({ page }) => {
    const db = seed();
    await installAdminMock(page, db);
    await signIn(page);
    expect(db.factors).toEqual([]);
  });

  test("enrol, reject a wrong code, enable, sign in with a code, then turn off", async ({ page }) => {
    const db = seed();
    await installAdminMock(page, db, { signedIn: true });
    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: "Two-step sign-in" })).toBeVisible();
    await page.getByRole("button", { name: "Set up two-step sign-in" }).click();
    const qr = page.getByRole("img", { name: /QR code to add STB Delivery/ });
    await expect(qr).toBeVisible();
    await expect.poll(() => qr.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0); // the image actually loads
    await expect(page.locator("code")).toHaveText("JBSWY3DPEHPK3PXP"); // manual setup key shown
    await shot(page, "11-mfa-setup-desktop");

    await page.getByLabel("Six-digit code from the app").fill("000000");
    await page.getByRole("button", { name: "Turn on", exact: true }).click();
    await expect(page.getByText("That code didn't work.")).toBeVisible();
    expect(db.factors[0].status).toBe("unverified"); // a wrong code leaves two-step sign-in off

    await page.getByLabel("Six-digit code from the app").fill(STUB_CODE);
    await page.getByRole("button", { name: "Turn on", exact: true }).click();
    await expect(page.getByText("Two-step sign-in is on.")).toBeVisible();
    expect(db.factors[0].status).toBe("verified");
    await shot(page, "12-mfa-on-desktop");

    // A new sign-in now needs the code.
    await page.evaluate(() => localStorage.removeItem("stb-delivery-auth"));
    await page.goto("/login");
    await page.getByLabel("Email").fill(OWNER.email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Enter your code" })).toBeVisible();
    await page.getByLabel("Six-digit code").fill("111111");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("alert")).toHaveText("That code didn't work. Enter the current six-digit code from your app.");
    await page.getByLabel("Six-digit code").fill(STUB_CODE);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("navigation", { name: "Admin" })).toBeVisible();

    // Turning off needs the password and a current code.
    await page.goto("/admin/settings");
    await page.getByRole("button", { name: "Turn off two-step sign-in" }).click();
    await page.getByLabel("Password", { exact: true }).fill("wrong-password");
    await page.getByLabel("Six-digit code").fill(STUB_CODE);
    await page.getByRole("button", { name: "Turn off", exact: true }).click();
    await expect(page.getByText("That password isn't right.")).toBeVisible();
    expect(db.factors.length).toBe(1);

    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Six-digit code").fill(STUB_CODE);
    await page.getByRole("button", { name: "Turn off", exact: true }).click();
    await expect(page.getByText("Two-step sign-in is off.")).toBeVisible();
    expect(db.factors).toEqual([]);
    await shot(page, "13-mfa-off-desktop");
  });
});

test.describe("root entry", () => {
  test.use({ viewport: { width: 1366, height: 860 } });

  test("root shows owner sign-in when signed out, dashboard when signed in", async ({ page }) => {
    const db = seed();
    await installAdminMock(page, db);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "This link isn't active" })).toHaveCount(0);
    await signIn(page);
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Admin" })).toBeVisible();
    await expect(page).toHaveURL(/\/admin$/);
  });
});

test("a template preset pre-fills the editor and is saved only when the owner saves", async ({ page }) => {
  const db = seed();
  await installAdminMock(page, db);
  await signIn(page);
  await page.goto("/admin/templates");
  await page.getByRole("heading", { name: "Start from a preset" }).waitFor();
  await page.getByRole("button", { name: "Use Print-minded" }).click();
  await expect(page.getByLabel("Welcome title")).toHaveValue("Your project, delivered");
  await expect(page.getByLabel("Theme")).toHaveValue("ivory");
  expect(db.tables.delivery_templates ?? []).toHaveLength(0);
  await page.getByRole("button", { name: "Save template" }).click();
  await expect(page.getByText(/Saved "Print-minded"/)).toBeVisible();
});
