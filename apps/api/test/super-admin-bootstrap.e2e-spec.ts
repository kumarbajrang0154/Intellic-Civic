/**
 * super-admin-bootstrap.e2e-spec.ts
 *
 * Tests the SUPER_ADMIN_BOOTSTRAP_EMAIL behaviour in AuthService.handleGoogleCallback:
 *  - First login creates the user with role=ADMIN and isAuthorized=true.
 *  - Subsequent logins (user already exists) re-upsert to role=ADMIN / isAuthorized=true.
 *  - An audit log is written each time with action=SUPER_ADMIN_BOOTSTRAP_LOGIN.
 *  - The bootstrap email receives an AUTHORIZED redirect (never PENDING / DENIED).
 *  - Non-bootstrap emails are unaffected and follow the normal approval flow.
 *  - The check is case-insensitive on the email.
 *  - Bootstrap email with accidentally-demoted role self-corrects back to ADMIN.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole, AuthProvider } from '@prisma/client';
import { AuthService } from '../src/modules/auth/auth.service';
import { FirebaseAdminService } from '../src/modules/auth/firebase-admin.service';
import { ConsoleOtpProvider } from '../src/modules/auth/providers/console-otp.provider';
import { PrismaService } from '../src/database/prisma.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BOOTSTRAP_EMAIL = 'kumarbajrang325@gmail.com';
const BOOTSTRAP_GOOGLE_ID = 'google-super-admin-001';

const mockBootstrapUser = {
  id: 'super-admin-uuid-1',
  email: BOOTSTRAP_EMAIL,
  googleId: BOOTSTRAP_GOOGLE_ID,
  name: 'Bajrang Kumar',
  avatarUrl: null,
  role: UserRole.ADMIN,
  isAuthorized: true,
  authProvider: AuthProvider.GOOGLE,
  mobileNumber: null,
  departmentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockNormalStaff = {
  id: 'staff-pending-uuid-1',
  email: 'officer@city.gov',
  googleId: 'google-officer-001',
  name: 'City Officer',
  role: null,
  isAuthorized: false,
  authProvider: AuthProvider.GOOGLE,
  mobileNumber: null,
  departmentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ---------------------------------------------------------------------------
// Helper: build a fresh TestingModule for each test
// ---------------------------------------------------------------------------

async function buildModule(prismaOverrides: Partial<typeof mockPrismaBase> = {}) {
  const mockPrisma = { ...mockPrismaBase, ...prismaOverrides };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AuthService,
      ConsoleOtpProvider,
      {
        provide: PrismaService,
        useValue: mockPrisma,
      },
      {
        provide: JwtService,
        useValue: {
          sign: jest.fn().mockReturnValue('mock.jwt.access.token'),
        },
      },
      {
        provide: ConfigService,
        useValue: {
          get: jest.fn((key: string) => {
            if (key === 'FRONTEND_URL') return 'http://localhost:3000';
            if (key === 'SUPER_ADMIN_BOOTSTRAP_EMAIL') return BOOTSTRAP_EMAIL;
            if (key === 'OTP_AUTH_MODE') return 'console';
            return null;
          }),
        },
      },
      {
        provide: FirebaseAdminService,
        useValue: { verifyIdToken: jest.fn() },
      },
    ],
  }).compile();

  return {
    service: module.get<AuthService>(AuthService),
    prisma: mockPrisma,
  };
}

const mockPrismaBase = {
  user: {
    upsert: jest.fn().mockResolvedValue(mockBootstrapUser),
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    update: jest.fn(),
  },
  auditLog: {
    create: jest.fn().mockResolvedValue({ id: 'audit-bootstrap-1' }),
  },
  refreshToken: {
    create: jest.fn().mockResolvedValue({ id: 'rt-1' }),
    findMany: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue({}),
  },
  otpRequest: {
    create: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
  },
};

// ===========================================================================
// BOOTSTRAP TESTS
// ===========================================================================

describe('AuthService — Super Admin Bootstrap (SUPER_ADMIN_BOOTSTRAP_EMAIL)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset upsert to always return the bootstrap user unless overridden
    mockPrismaBase.user.upsert.mockResolvedValue(mockBootstrapUser);
    mockPrismaBase.auditLog.create.mockResolvedValue({ id: 'audit-1' });
  });

  it('1. First login: creates user with role=ADMIN and isAuthorized=true via upsert', async () => {
    const { service, prisma } = await buildModule();

    const result = await service.handleGoogleCallback({
      email: BOOTSTRAP_EMAIL,
      googleId: BOOTSTRAP_GOOGLE_ID,
      name: 'Bajrang Kumar',
    });

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: BOOTSTRAP_EMAIL },
        create: expect.objectContaining({
          email: BOOTSTRAP_EMAIL,
          role: UserRole.ADMIN,
          isAuthorized: true,
          authProvider: AuthProvider.GOOGLE,
        }),
        update: expect.objectContaining({
          role: UserRole.ADMIN,
          isAuthorized: true,
        }),
      }),
    );

    // Should redirect to authorized callback, not pending-approval
    expect(result.status).toBe('AUTHORIZED');
    expect(result.redirectUrl).toMatch(/\/auth\/callback\?code=auth_code_/);
  });

  it('2. Subsequent login (user already exists): re-upserts role=ADMIN and isAuthorized=true', async () => {
    const { service, prisma } = await buildModule();

    // Simulate user already existing with correct role
    prisma.user.upsert.mockResolvedValue(mockBootstrapUser);

    const result = await service.handleGoogleCallback({
      email: BOOTSTRAP_EMAIL,
      googleId: BOOTSTRAP_GOOGLE_ID,
      name: 'Bajrang Kumar',
    });

    expect(result.status).toBe('AUTHORIZED');
    // Upsert must be called (not just findFirst + isAuthorized check)
    expect(prisma.user.upsert).toHaveBeenCalledTimes(1);
  });

  it('3. Self-correction: if role was accidentally demoted, bootstrap login restores ADMIN', async () => {
    const demotedUser = {
      ...mockBootstrapUser,
      role: UserRole.DEPARTMENT_OFFICER, // accidentally demoted
      isAuthorized: false, // also stripped
    };

    const { service, prisma } = await buildModule();
    // upsert will call the update branch and fix the role
    prisma.user.upsert.mockResolvedValue({
      ...demotedUser,
      role: UserRole.ADMIN,
      isAuthorized: true,
    });

    const result = await service.handleGoogleCallback({
      email: BOOTSTRAP_EMAIL,
      googleId: BOOTSTRAP_GOOGLE_ID,
      name: 'Bajrang Kumar',
    });

    expect(result.status).toBe('AUTHORIZED');
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          role: UserRole.ADMIN,
          isAuthorized: true,
        }),
      }),
    );
  });

  it('4. Audit log is written with action=SUPER_ADMIN_BOOTSTRAP_LOGIN on every login', async () => {
    const { service, prisma } = await buildModule();

    await service.handleGoogleCallback({
      email: BOOTSTRAP_EMAIL,
      googleId: BOOTSTRAP_GOOGLE_ID,
      name: 'Bajrang Kumar',
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'SUPER_ADMIN_BOOTSTRAP_LOGIN',
          entityType: 'USER',
          entityId: mockBootstrapUser.id,
          metadata: expect.objectContaining({
            email: BOOTSTRAP_EMAIL,
            role: UserRole.ADMIN,
            isAuthorized: true,
          }),
        }),
      }),
    );
  });

  it('5. Audit log is written on EVERY login (idempotent, not just first time)', async () => {
    const { service, prisma } = await buildModule();

    // Login twice
    await service.handleGoogleCallback({
      email: BOOTSTRAP_EMAIL,
      googleId: BOOTSTRAP_GOOGLE_ID,
      name: 'Bajrang Kumar',
    });
    await service.handleGoogleCallback({
      email: BOOTSTRAP_EMAIL,
      googleId: BOOTSTRAP_GOOGLE_ID,
      name: 'Bajrang Kumar',
    });

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(2);
    expect(prisma.auditLog.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ action: 'SUPER_ADMIN_BOOTSTRAP_LOGIN' }),
      }),
    );
  });

  it('6. Bootstrap email check is case-insensitive', async () => {
    const { service, prisma } = await buildModule();

    const result = await service.handleGoogleCallback({
      email: BOOTSTRAP_EMAIL.toUpperCase(), // uppercase variant
      googleId: BOOTSTRAP_GOOGLE_ID,
      name: 'Bajrang Kumar',
    });

    expect(result.status).toBe('AUTHORIZED');
    expect(prisma.user.upsert).toHaveBeenCalled();
  });

  it('7. Bootstrap email never redirects to /auth/pending-approval', async () => {
    const { service } = await buildModule();

    const result = await service.handleGoogleCallback({
      email: BOOTSTRAP_EMAIL,
      googleId: BOOTSTRAP_GOOGLE_ID,
      name: 'Bajrang Kumar',
    });

    expect(result.redirectUrl).not.toContain('pending-approval');
    expect(result.redirectUrl).not.toContain('denied');
  });

  it('8. Auth code in redirectUrl is single-use opaque code (no JWT in URL)', async () => {
    const { service } = await buildModule();

    const result = await service.handleGoogleCallback({
      email: BOOTSTRAP_EMAIL,
      googleId: BOOTSTRAP_GOOGLE_ID,
      name: 'Bajrang Kumar',
    });

    expect(result.redirectUrl).not.toContain('token=');
    expect(result.redirectUrl).not.toContain('accessToken');
    expect(result.redirectUrl).toContain('code=auth_code_');
  });
});

// ===========================================================================
// NON-BOOTSTRAP ISOLATION TESTS
// ===========================================================================

describe('AuthService — Non-bootstrap emails unaffected by bootstrap logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaBase.auditLog.create.mockResolvedValue({ id: 'audit-1' });
  });

  it('9. Non-bootstrap authorized staff redirects to /auth/callback (normal flow)', async () => {
    const authorizedStaff = {
      ...mockNormalStaff,
      isAuthorized: true,
      role: UserRole.DEPARTMENT_HEAD,
    };

    const { service, prisma } = await buildModule();
    prisma.user.findFirst.mockResolvedValue(authorizedStaff);

    const result = await service.handleGoogleCallback({
      email: authorizedStaff.email,
      googleId: authorizedStaff.googleId,
      name: authorizedStaff.name,
    });

    expect(result.status).toBe('AUTHORIZED');
    // Should use findFirst path, NOT upsert
    expect(prisma.user.upsert).not.toHaveBeenCalled();
    // No bootstrap audit log
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('10. Non-bootstrap new staff goes to PENDING (not auto-approved)', async () => {
    const { service, prisma } = await buildModule();
    prisma.user.findFirst.mockResolvedValue(null); // new user
    prisma.user.create.mockResolvedValue(mockNormalStaff);

    const result = await service.handleGoogleCallback({
      email: 'newstaff@city.gov',
      googleId: 'google-new-staff',
      name: 'New Staff',
    });

    expect(result.status).toBe('PENDING');
    expect(result.redirectUrl).toContain('pending-approval');
    expect(prisma.user.upsert).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('11. Non-bootstrap unauthorized staff redirects to /auth/denied', async () => {
    const { service, prisma } = await buildModule();
    prisma.user.findFirst.mockResolvedValue(mockNormalStaff); // isAuthorized: false

    const result = await service.handleGoogleCallback({
      email: mockNormalStaff.email,
      googleId: mockNormalStaff.googleId,
      name: mockNormalStaff.name,
    });

    expect(result.status).toBe('DENIED');
    expect(result.redirectUrl).toContain('auth/denied');
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// APPROVE ENDPOINT VERIFICATION (UsersService.approveUser)
// ===========================================================================

import { UsersService } from '../src/modules/users/users.service';
import { UsersController } from '../src/modules/users/users.controller';

describe('UsersService — PATCH /users/:id/approve supports all staff roles + departmentId', () => {
  let usersService: UsersService;
  let prismaService: any;

  const mockAdmin = { id: 'admin-uuid-1', role: UserRole.ADMIN };

  const mockPendingOfficer = {
    id: 'officer-uuid-1',
    email: 'officer@city.gov',
    name: 'John Officer',
    role: null,
    isAuthorized: false,
    departmentId: null,
  };

  beforeEach(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn().mockResolvedValue(mockPendingOfficer),
        update: jest.fn().mockImplementation(({ data }) => ({
          ...mockPendingOfficer,
          ...data,
          departmentId: data.departmentId ?? mockPendingOfficer.departmentId,
        })),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    usersService = module.get<UsersService>(UsersService);
  });

  it('12. approveUser sets role=DEPARTMENT_OFFICER + departmentId + isAuthorized=true', async () => {
    const result = await usersService.approveUser(
      'officer-uuid-1',
      { role: UserRole.DEPARTMENT_OFFICER, departmentId: 'dept-sanitation-1' },
      mockAdmin.id,
    );

    expect(prismaService.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isAuthorized: true,
          role: UserRole.DEPARTMENT_OFFICER,
          departmentId: 'dept-sanitation-1',
        }),
      }),
    );
    expect(prismaService.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'USER_APPROVED_BY_ADMIN' }),
      }),
    );
  });

  it('13. approveUser sets role=DEPARTMENT_HEAD + departmentId', async () => {
    await usersService.approveUser(
      'officer-uuid-1',
      { role: UserRole.DEPARTMENT_HEAD, departmentId: 'dept-water-2' },
      mockAdmin.id,
    );

    expect(prismaService.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: UserRole.DEPARTMENT_HEAD,
          departmentId: 'dept-water-2',
          isAuthorized: true,
        }),
      }),
    );
  });

  it('14. approveUser sets role=ADMIN without requiring departmentId', async () => {
    await usersService.approveUser(
      'officer-uuid-1',
      { role: UserRole.ADMIN },
      mockAdmin.id,
    );

    expect(prismaService.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: UserRole.ADMIN,
          isAuthorized: true,
          departmentId: null, // ADMIN has no department
        }),
      }),
    );
  });

  it('15. approveUser throws BadRequestException if departmentId missing for staff role', async () => {
    const { BadRequestException } = await import('@nestjs/common');

    await expect(
      usersService.approveUser(
        'officer-uuid-1',
        { role: UserRole.DEPARTMENT_OFFICER }, // no departmentId
        mockAdmin.id,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
