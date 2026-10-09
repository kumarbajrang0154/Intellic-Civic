import { test, expect, Page } from '@playwright/test';
import { SignJWT } from 'jose';
import prisma from '../src/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'intellicivic-super-secret-jwt-key-2026');

interface OverflowElement {
  page: string;
  viewport: number;
  selector: string;
  tag: string;
  classes: string;
  textSnippet: string;
  elementWidth: number;
  parentWidth: number;
  diff: number;
}

async function findOverflowingElements(
  page: Page,
  pageName: string,
  viewportWidth: number,
): Promise<{ documentOverflow: boolean; scrollWidth: number; innerWidth: number; overflows: OverflowElement[] }> {
  return page.evaluate(({ pageName, viewportWidth }) => {
    const overflows: any[] = [];
    const docScrollWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const winWidth = window.innerWidth;
    const documentOverflow = docScrollWidth > winWidth;

    const allElements = Array.from(document.querySelectorAll<HTMLElement>('*'));

    for (const el of allElements) {
      if (!el.offsetParent && el.tagName !== 'BODY' && el.tagName !== 'HTML') continue;
      const rect = el.getBoundingClientRect();
      const parent = el.parentElement;
      if (!parent) continue;
      const parentRect = parent.getBoundingClientRect();

      const style = window.getComputedStyle(el);
      const parentStyle = window.getComputedStyle(parent);

      if (
        style.overflowX === 'auto' ||
        style.overflowX === 'scroll' ||
        parentStyle.overflowX === 'auto' ||
        parentStyle.overflowX === 'scroll' ||
        el.closest('.overflow-x-auto') !== null
      ) {
        continue;
      }

      if (
        el.closest('.leaflet-container') ||
        el.classList.contains('leaflet-tile') ||
        el.classList.contains('leaflet-proxy')
      ) {
        continue;
      }

      // Element exceeding its parent card
      if (rect.right > parentRect.right + 2 && rect.width > 30 && parentRect.width > 50) {
        const isCardOrContainer =
          parent.classList.contains('rounded-2xl') ||
          parent.classList.contains('rounded-xl') ||
          parent.classList.contains('card') ||
          parent.tagName === 'DIV' ||
          parent.tagName === 'SECTION' ||
          parent.tagName === 'MAIN';
        if (isCardOrContainer) {
          overflows.push({
            page: pageName,
            viewport: viewportWidth,
            selector: el.id
              ? `#${el.id}`
              : el.className
                ? `.${el.className.toString().split(' ').slice(0, 3).join('.')}`
                : el.tagName.toLowerCase(),
            tag: el.tagName.toLowerCase(),
            classes: el.className?.toString() || '',
            textSnippet: (el.innerText || el.textContent || '').trim().slice(0, 50),
            elementWidth: Math.round(rect.width),
            parentWidth: Math.round(parentRect.width),
            diff: Math.round(rect.right - parentRect.right),
          });
        }
      } else if (rect.right > winWidth + 2) {
        overflows.push({
          page: pageName,
          viewport: viewportWidth,
          selector: el.id
            ? `#${el.id}`
            : el.className
              ? `.${el.className.toString().split(' ').slice(0, 3).join('.')}`
              : el.tagName.toLowerCase(),
          tag: el.tagName.toLowerCase(),
          classes: el.className?.toString() || '',
          textSnippet: (el.innerText || el.textContent || '').trim().slice(0, 50),
          elementWidth: Math.round(rect.width),
          parentWidth: winWidth,
          diff: Math.round(rect.right - winWidth),
        });
      }
    }

    return {
      documentOverflow,
      scrollWidth: docScrollWidth,
      innerWidth: winWidth,
      overflows,
    };
  }, { pageName, viewportWidth });
}

async function createToken(userId: string, role: string, name: string, email: string) {
  return new SignJWT({
    sub: userId,
    role,
    name,
    email,
    isAuthorized: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

test.describe('Mobile Viewport (375px & 360px) Overflow Diagnostic for Field Worker & Admin Nav Pages', () => {
  test.setTimeout(120000);

  let saToken: string;
  let fwToken: string;
  let testComplaintId: string;
  let testCitizenId: string;

  test.beforeAll(async () => {
    const mun = await prisma.municipality.findFirst();
    const superAdmin = await prisma.user.findFirst({ where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } } });
    const fieldWorker = await prisma.user.findFirst({ where: { role: 'FIELD_WORKER' } });

    if (!superAdmin || !fieldWorker) throw new Error('Required roles not found in DB');

    saToken = await createToken(superAdmin.id, superAdmin.role || 'SUPER_ADMIN', superAdmin.name, superAdmin.email || 'admin@test.gov');
    fwToken = await createToken(fieldWorker.id, 'FIELD_WORKER', fieldWorker.name, fieldWorker.email || 'fw@test.gov');

    // Create realistic long data row
    const timestamp = Date.now();
    const citizen = await prisma.user.create({
      data: {
        id: `c_long_${timestamp}`,
        name: 'Thiru Balasubramaniam Ramasamy Thirunavukkarasu',
        email: `bala.long.${timestamp}@smartcity.gov.in`,
        mobileNumber: `91${timestamp.toString().slice(-8)}`,
        address: 'No 452, Main Trunk Road, Near Anna Flyover, Coimbatore, Tamil Nadu',
        role: 'CITIZEN',
        authProvider: 'MOBILE_OTP',
        isAuthorized: true,
      },
    });
    testCitizenId = citizen.id;

    const longUrl = 'https://smartcity.gov.in/portal/evidence/inspections/photographic-records/VERY_LONG_UNBROKEN_URL_PATH_' + 'Z'.repeat(120);
    const complaint = await prisma.complaint.create({
      data: {
        ticketId: `TCK-LONG-${timestamp}`,
        citizenId: citizen.id,
        title: 'குடிநீர் விநியோக குழாய் உடைப்பு மற்றும் சாலை சீரமைப்பு - உடனடியாக நடவடிக்கை தேவை',
        titleEn: 'Drinking water pipeline rupture and road repair - immediate action required',
        description: `Damage reported: ${longUrl}. Urgent repair required on North Circular Road.`,
        status: 'ASSIGNED',
        priority: 'CRITICAL',
        municipalityId: mun?.id,
        assignedFieldWorkerId: fieldWorker.id,
      },
    });
    testComplaintId = complaint.id;
  });

  test.afterAll(async () => {
    if (testComplaintId) {
      await prisma.complaint.delete({ where: { id: testComplaintId } }).catch(() => {});
    }
    if (testCitizenId) {
      await prisma.user.delete({ where: { id: testCitizenId } }).catch(() => {});
    }
  });

  const viewports = [375, 360];

  const fwPages = [
    '/field-worker',
    '/field-worker/profile',
  ];

  const adminPages = [
    '/admin',
    '/admin/complaints',
    '/admin/departments',
    '/admin/users/citizens',
    '/admin/staff',
    '/admin/analytics',
    '/admin/notifications',
    '/admin/security',
    '/admin/system',
    '/admin/settings',
    '/admin/profile',
  ];

  for (const vp of viewports) {
    test(`Diagnostic: Field Worker pages at ${vp}px`, async ({ page, context }) => {
      await page.setViewportSize({ width: vp, height: 740 });
      await context.addCookies([{ name: 'ic_access_token', value: fwToken, domain: 'localhost', path: '/' }]);

      const findings: any[] = [];

      for (const p of fwPages) {
        await page.goto(p, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(800);
        const res = await findOverflowingElements(page, p, vp);
        if (res.documentOverflow || res.overflows.length > 0) {
          findings.push({ path: p, ...res });
        }
      }

      console.log(`\n=== FIELD WORKER OVERFLOW FINDINGS AT ${vp}px ===`);
      console.log(JSON.stringify(findings, null, 2));

      for (const f of findings) {
        expect(f.scrollWidth, `Page ${f.path} scrollWidth must be <= ${vp}`).toBeLessThanOrEqual(f.innerWidth);
        expect(f.overflows.length, `Page ${f.path} has ${f.overflows.length} overflowing elements`).toBe(0);
      }
    });

    test(`Diagnostic: Admin / Super Admin pages at ${vp}px`, async ({ page, context }) => {
      await page.setViewportSize({ width: vp, height: 740 });
      await context.addCookies([{ name: 'ic_access_token', value: saToken, domain: 'localhost', path: '/' }]);

      const findings: any[] = [];

      for (const p of adminPages) {
        await page.goto(p, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(800);
        const res = await findOverflowingElements(page, p, vp);
        if (res.documentOverflow || res.overflows.length > 0) {
          findings.push({ path: p, ...res });
        }
      }

      console.log(`\n=== ADMIN / SUPER ADMIN OVERFLOW FINDINGS AT ${vp}px ===`);
      console.log(JSON.stringify(findings, null, 2));

      for (const f of findings) {
        expect(f.scrollWidth, `Page ${f.path} scrollWidth must be <= ${vp}`).toBeLessThanOrEqual(f.innerWidth);
        expect(f.overflows.length, `Page ${f.path} has ${f.overflows.length} overflowing elements`).toBe(0);
      }
    });
  }
});
