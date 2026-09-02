import { test, expect } from '@playwright/test';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Bajrang Kumar 07/.gemini/antigravity-ide/brain/652d066f-b656-4386-bfff-612ab59b8cc2';

async function setAuthCookie(page: any, context: any, id: string, name: string, role: string, email: string) {
  const res = await page.request.post('http://localhost:3000/api/auth/dev-login', {
    data: { id, name, role, email },
  });
  const cookiesHeader = res.headers()['set-cookie'] || '';
  const match = cookiesHeader.match(/ic_access_token=([^;]+)/);
  if (match) {
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: match[1],
        url: 'http://localhost:3000',
      },
    ]);
  }
}

test.describe('Capture Field Worker Portal Screenshots', () => {
  test('1. Screenshot: Field Worker Dashboard', async ({ page, context }) => {
    await setAuthCookie(page, context, 'fw-demo-1', 'Ramesh Kumar', 'FIELD_WORKER', 'fieldworker@intellicivic.gov.in');
    await page.goto('http://localhost:3000/field-worker');
    await page.waitForSelector('text=Field Worker Task Portal', { timeout: 15000 });

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'field_worker_dashboard.png'),
      fullPage: true,
    });
  });

  test('2. Screenshot: Field Worker Detail & Photo Upload Section', async ({ page, context }) => {
    await setAuthCookie(page, context, 'fw-demo-1', 'Ramesh Kumar', 'FIELD_WORKER', 'fieldworker@intellicivic.gov.in');
    await page.goto('http://localhost:3000/field-worker/complaints/cmp-field-assigned');
    await page.waitForSelector('text=Citizen Complaint Details', { timeout: 15000 });

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'field_worker_complaint_detail_upload.png'),
      fullPage: true,
    });
  });

  test('3. Screenshot: Submit for Review & Pre-Submission Checklist', async ({ page, context }) => {
    await setAuthCookie(page, context, 'fw-demo-1', 'Ramesh Kumar', 'FIELD_WORKER', 'fieldworker@intellicivic.gov.in');
    await page.goto('http://localhost:3000/field-worker/complaints/cmp-field-review-ready');
    await page.waitForSelector('text=Work Submitted for Officer Review', { timeout: 15000 });

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'field_worker_submit_review_states.png'),
      fullPage: true,
    });
  });

  test('4. Screenshot: Officer Review Section showing Field Worker Evidence', async ({ page, context }) => {
    await setAuthCookie(page, context, 'officer-demo-1', 'Officer Sharma', 'DEPARTMENT_OFFICER', 'officer@intellicivic.gov.in');
    await page.goto('http://localhost:3000/officer/complaints/cmp-field-review-ready');
    await page.waitForSelector('text=Field Worker Repair Submission Pending Sign-off', { timeout: 15000 });

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'officer_review_field_worker_evidence.png'),
      fullPage: true,
    });
  });
});
