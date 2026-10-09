import { test, expect, Page } from '@playwright/test';
import { SignJWT } from 'jose';
import prisma from '../src/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'intellicivic-dev-jwt-secret-key-32bytes!');

async function createCitizenJwt(citizenId: string) {
  return new SignJWT({
    sub: citizenId,
    role: 'CITIZEN',
    name: 'Citizen Meenakshi Sundaram',
    email: 'meenakshi.citizen@smartcity.gov.in',
    isAuthorized: true,
    isProfileComplete: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

interface OverflowElement {
  page: string;
  viewport: number;
  selector: string;
  tag: string;
  classes: string;
  textSnippet: string;
  elementWidth: number;
  parentWidth: number;
  parentTag: string;
  diff: number;
}

async function findOverflowingElements(page: Page, pageName: string, viewportWidth: number): Promise<{ documentOverflow: boolean; scrollWidth: number; innerWidth: number; overflows: OverflowElement[] }> {
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
      if (style.overflowX === 'auto' || style.overflowX === 'scroll' || parentStyle.overflowX === 'auto' || parentStyle.overflowX === 'scroll') {
        continue;
      }

      if (el.closest('.leaflet-container') || el.classList.contains('leaflet-tile') || el.classList.contains('leaflet-proxy')) {
        continue;
      }

      if (rect.right > parentRect.right + 2 && rect.width > 30 && parentRect.width > 50) {
        const isCardOrContainer = parent.classList.contains('rounded-2xl') || parent.classList.contains('rounded-xl') || parent.classList.contains('card') || parent.tagName === 'DIV' || parent.tagName === 'SECTION' || parent.tagName === 'MAIN';
        if (isCardOrContainer) {
          overflows.push({
            page: pageName,
            viewport: viewportWidth,
            selector: el.id ? `#${el.id}` : el.className ? `.${el.className.split(' ').slice(0, 3).join('.')}` : el.tagName.toLowerCase(),
            tag: el.tagName.toLowerCase(),
            classes: el.className || '',
            textSnippet: (el.innerText || el.textContent || '').trim().slice(0, 50),
            elementWidth: Math.round(rect.width),
            parentWidth: Math.round(parentRect.width),
            parentTag: parent.tagName.toLowerCase(),
            diff: Math.round(rect.right - parentRect.right),
          });
        }
      } else if (rect.right > winWidth + 2) {
        overflows.push({
          page: pageName,
          viewport: viewportWidth,
          selector: el.id ? `#${el.id}` : el.className ? `.${el.className.split(' ').slice(0, 3).join('.')}` : el.tagName.toLowerCase(),
          tag: el.tagName.toLowerCase(),
          classes: el.className || '',
          textSnippet: (el.innerText || el.textContent || '').trim().slice(0, 50),
          elementWidth: Math.round(rect.width),
          parentWidth: winWidth,
          parentTag: 'window',
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

test.describe('Real Data Mobile Overflow Diagnostic at 375px', () => {
  test.setTimeout(60000);
  let citizenId: string;
  let complaint1Id: string;
  let complaint2Id: string;

  test.beforeAll(async () => {
    const mun = await prisma.municipality.findFirst();
    const timestamp = Date.now();

    const citizen = await prisma.user.create({
      data: {
        name: `Real Mobile Overflow Citizen ${timestamp}`,
        email: `overflow_test_${timestamp}@smartcity.gov.in`,
        mobileNumber: `98${timestamp.toString().slice(-8)}`,
        address: '123 Civil Lines, Test City',
        role: 'CITIZEN',
        authProvider: 'MOBILE_OTP',
        isAuthorized: true,
        isSuspended: false,
        municipalityId: mun?.id,
      },
    });
    citizenId = citizen.id;

    const title150 = 'Road Crater & Severe Pavement Subsidence on Outer Ring Road Near Junction 42 Causing Disruption to Peak Hour Traffic and Heavy Transport Vehicles Daily!';
    const longUrl600 = 'https://smartcity.gov.in/portal/evidence/inspections/photographic-records/' + 'A'.repeat(500);

    const c1 = await prisma.complaint.create({
      data: {
        ticketId: `TCK-OVF-150-${timestamp}`,
        citizenId: citizen.id,
        title: title150,
        titleEn: title150,
        description: longUrl600,
        status: 'IN_PROGRESS',
        priority: 'CRITICAL',
        municipalityId: mun?.id,
      },
    });
    complaint1Id = c1.id;

    const tamilTitle = 'குடிநீர் விநியோக குழாய் உடைப்பு - உடனடியாக சரிசெய்யவும்';
    const tamilDesc = 'மெயின் ரோட்டில் குடிநீர் குழாய் உடைந்து தண்ணீர் வீணாக செல்கிறது. உடனடியாக சரிசெய்ய நடவடிக்கை எடுக்கவும்.';

    const c2 = await prisma.complaint.create({
      data: {
        ticketId: `TCK-OVF-TML-${timestamp}`,
        citizenId: citizen.id,
        title: tamilTitle,
        titleEn: 'Drinking water pipeline burst - repair immediately',
        description: tamilDesc,
        status: 'RESOLVED',
        priority: 'HIGH',
        municipalityId: mun?.id,
      },
    });
    complaint2Id = c2.id;
  });

  test.afterAll(async () => {
    try {
      if (citizenId) {
        await prisma.complaint.deleteMany({ where: { citizenId } });
        await prisma.user.delete({ where: { id: citizenId } });
      }
    } catch (e) {
      console.error('Error during cleanup in real-mobile-overflow.spec.ts:', e);
    }
  });

  test('Check Real Data Overflow on Citizen Pages at 375px', async ({ page, context }) => {
    const token = await createCitizenJwt(citizenId);
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: token,
        url: 'http://localhost:3000',
      },
    ]);

    const pages = [
      { name: 'Dashboard_RealData', path: '/citizen' },
      { name: 'ComplaintDetail_150Title_600Url', path: `/citizen/complaints/${complaint1Id}` },
      { name: 'ComplaintDetail_TamilTitle', path: `/citizen/complaints/${complaint2Id}` },
    ];

    const results: any[] = [];

    for (const p of pages) {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(p.path, { waitUntil: 'domcontentloaded' });
      if (p.path === '/citizen') {
        await page.waitForSelector('text=Total Reports', { timeout: 30000 });
      } else {
        await page.waitForSelector('text=Complaint Details', { timeout: 30000 });
      }
      await page.waitForTimeout(500);

      const check = await findOverflowingElements(page, p.name, 375);
      results.push({ page: p.name, ...check });
    }

    console.log('--- REAL DATA OVERFLOW DIAGNOSTIC RESULTS ---');
    console.log(JSON.stringify(results, null, 2));

    for (const res of results) {
      expect(res.scrollWidth).toBeLessThanOrEqual(res.innerWidth);
      expect(res.overflows.length).toBe(0);
    }
  });
});
