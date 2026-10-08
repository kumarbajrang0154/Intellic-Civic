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
  let citizenId: string;
  let complaint1Id = '7983541c-2ca8-493b-8669-c98f391599eb';
  let complaint2Id = 'e359ee10-71bb-41e6-b305-d7b25c673d7d';

  test.beforeAll(async () => {
    const c1 = await prisma.complaint.findUnique({ where: { id: complaint1Id } });
    if (c1) {
      citizenId = c1.citizenId;
    } else {
      const c = await prisma.complaint.findFirst();
      if (c) {
        citizenId = c.citizenId;
        complaint1Id = c.id;
      }
    }
  });

  test('Check Real Data Overflow on Citizen Pages at 375px', async ({ page, context }) => {
    const token = await createCitizenJwt(citizenId);
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: token,
        domain: 'localhost',
        path: '/',
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
        await page.waitForSelector('text=Total Reports', { timeout: 10000 });
      } else {
        await page.waitForSelector('text=Complaint Details', { timeout: 10000 });
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
