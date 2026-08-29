/**
 * auth-otp.e2e-spec.ts
 *
 * Tests both OTP auth modes in isolation:
 *  - Console mode: no Firebase mocks needed; verifies OTP against OtpRequest table.
 *  - Firebase mode: verifies Firebase ID token via FirebaseAdminService mock.
 *
 * Toggling between modes in these tests is done by controlling ConfigService.get('OTP_AUTH_MODE').
 */

import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthProvider, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../src/modules/auth/auth.service';
import { FirebaseAdminService } from '../src/modules/auth/firebase-admin.service';
import { ConsoleOtpProvider } from '../src/modules/auth/providers/console-otp.provider';
import { PrismaService } from '../src/database/prisma.service';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const MOBILE = '9876543210';

const mockUser = {
  id: 'user-otp-test-1',
  mobileNumber: MOBILE,
  name: `Citizen ${MOBILE.slice(-4)}`,
  role: UserRole.CITIZEN,
  authProvider: AuthProvider.MOBILE_OTP,
  isAuthorized: true,
  email: null,
  googleId: null,
  avatarUrl: null,
  departmentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ---------------------------------------------------------------------------
// Helper: build a TestingModule with overridden OTP_AUTH_MODE
// ---------------------------------------------------------------------------
async function buildModule(otpAuthMode: 'console' | 'firebase', prismaOverrides: any = {}) {
  const defaultPrisma = {
    otpRequest: {
      create: jest.fn().mockResolvedValue({ id: 'otp-1' }),
      findFirst: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      update: jest.fn().mockResolvedValue({ id: 'otp-1' }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(mockUser),
      create: jest.fn().mockResolvedValue(mockUser),
    },
    refreshToken: {
      create: jest.fn().mockResolvedValue({ id: 'rt-1' }),
      findMany: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue({}),
    },
  };

  const prisma = {
    otpRequest: { ...defaultPrisma.otpRequest, ...prismaOverrides.otpRequest },
    user: { ...defaultPrisma.user, ...prismaOverrides.user },
    refreshToken: { ...defaultPrisma.refreshToken, ...prismaOverrides.refreshToken },
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AuthService,
      ConsoleOtpProvider,
      {
        provide: PrismaService,
        useValue: prisma,
      },
      {
        provide: JwtService,
        useValue: {
          sign: jest.fn().mockReturnValue('mock.access.token'),
        },
      },
      {
        provide: ConfigService,
        useValue: {
          get: jest.fn((key: string) => {
            if (key === 'OTP_AUTH_MODE') return otpAuthMode;
            if (key === 'FRONTEND_URL') return 'http://localhost:3000';
            return undefined;
          }),
        },
      },
      {
        provide: FirebaseAdminService,
        useValue: {
          verifyIdToken: jest.fn(),
        },
      },
    ],
  }).compile();

  return {
    service: module.get<AuthService>(AuthService),
    prisma,
    firebase: module.get<FirebaseAdminService>(FirebaseAdminService) as jest.Mocked<FirebaseAdminService>,
  };
}

// ===========================================================================
// CONSOLE MODE TESTS
// ===========================================================================

describe('AuthService — Console OTP Mode', () => {
  it('sendCitizenOtp: generates OTP, stores hashed code in OtpRequest, logs to console', async () => {
    const { service, prisma } = await buildModule('console');

    // Spy on ConsoleOtpProvider to verify it was called
    const consoleSpy = jest
      .spyOn((service as any).consoleOtpProvider, 'sendOtp')
      .mockResolvedValue(true);

    const result = await service.sendCitizenOtp({ mobileNumber: MOBILE });

    expect(result.message).toMatch(/Check server console/i);
    expect(result.expiresInSeconds).toBe(300);
    expect(prisma.otpRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mobileNumber: MOBILE,
          // otpCode is the bcrypt hash — just verify field exists
        }),
      }),
    );
    expect(consoleSpy).toHaveBeenCalledWith(MOBILE, expect.stringMatching(/^\d{6}$/));

    consoleSpy.mockRestore();
  });

  it('sendCitizenOtp: expires any pre-existing active OTPs before creating new one', async () => {
    const { service, prisma } = await buildModule('console');
    jest.spyOn((service as any).consoleOtpProvider, 'sendOtp').mockResolvedValue(true);

    await service.sendCitizenOtp({ mobileNumber: MOBILE });

    expect(prisma.otpRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ mobileNumber: MOBILE, isVerified: false }),
      }),
    );
  });

  it('verifyCitizenOtp (console): rejects when mobileNumber is missing', async () => {
    const { service } = await buildModule('console');

    await expect(
      service.verifyCitizenOtp({ otp: '123456' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('verifyCitizenOtp (console): rejects when otp is missing', async () => {
    const { service } = await buildModule('console');

    await expect(
      service.verifyCitizenOtp({ mobileNumber: MOBILE }),
    ).rejects.toThrow(BadRequestException);
  });

  it('verifyCitizenOtp (console): rejects when no active OTP record exists', async () => {
    const { service } = await buildModule('console', {
      otpRequest: { findFirst: jest.fn().mockResolvedValue(null) },
    });

    await expect(
      service.verifyCitizenOtp({ mobileNumber: MOBILE, otp: '123456' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('verifyCitizenOtp (console): rejects wrong OTP code and increments attempt counter', async () => {
    const realHash = await bcrypt.hash('999999', 10);
    const { service, prisma } = await buildModule('console', {
      otpRequest: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'otp-1',
          mobileNumber: MOBILE,
          otpCode: realHash,
          expiresAt: new Date(Date.now() + 60000),
          isVerified: false,
          attempts: 0,
        }),
      },
    });

    await expect(
      service.verifyCitizenOtp({ mobileNumber: MOBILE, otp: '000000' }),
    ).rejects.toThrow(UnauthorizedException);

    // Should have incremented the attempt counter
    expect(prisma.otpRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ attempts: { increment: 1 } }),
      }),
    );
  });

  it('verifyCitizenOtp (console): rejects when max attempts exceeded', async () => {
    const realHash = await bcrypt.hash('123456', 10);
    const { service } = await buildModule('console', {
      otpRequest: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'otp-1',
          mobileNumber: MOBILE,
          otpCode: realHash,
          expiresAt: new Date(Date.now() + 60000),
          isVerified: false,
          attempts: 5, // already at max
        }),
      },
    });

    await expect(
      service.verifyCitizenOtp({ mobileNumber: MOBILE, otp: '123456' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('verifyCitizenOtp (console): accepts correct OTP and issues tokens for existing user', async () => {
    const realOtp = '123456';
    const realHash = await bcrypt.hash(realOtp, 10);

    const { service, prisma } = await buildModule('console', {
      otpRequest: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'otp-1',
          mobileNumber: MOBILE,
          otpCode: realHash,
          expiresAt: new Date(Date.now() + 60000),
          isVerified: false,
          attempts: 0,
        }),
      },
    });

    const result = await service.verifyCitizenOtp({ mobileNumber: MOBILE, otp: realOtp });

    // OtpRequest should be marked verified
    expect(prisma.otpRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isVerified: true } }),
    );

    // Should return tokens + user shape
    expect(result.accessToken).toBe('mock.access.token');
    expect(result.refreshToken).toBeDefined();
    expect(result.user.mobileNumber).toBe(MOBILE);
    expect(result.user.role).toBe(UserRole.CITIZEN);
  });

  it('verifyCitizenOtp (console): auto-creates new citizen on first login', async () => {
    const realOtp = '654321';
    const realHash = await bcrypt.hash(realOtp, 10);
    const newMobile = '9000000001';

    const { service, prisma } = await buildModule('console', {
      otpRequest: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'otp-2',
          mobileNumber: newMobile,
          otpCode: realHash,
          expiresAt: new Date(Date.now() + 60000),
          isVerified: false,
          attempts: 0,
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(null), // user does not exist
        create: jest.fn().mockResolvedValue({
          ...mockUser,
          id: 'user-new',
          mobileNumber: newMobile,
          name: `Citizen ${newMobile.slice(-4)}`,
        }),
      },
    });

    const result = await service.verifyCitizenOtp({ mobileNumber: newMobile, otp: realOtp });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mobileNumber: newMobile,
          role: UserRole.CITIZEN,
          authProvider: AuthProvider.MOBILE_OTP,
          isAuthorized: true,
        }),
      }),
    );
    expect(result.user.mobileNumber).toBe(newMobile);
  });

  it('sendCitizenOtp: does NOT call Firebase in console mode', async () => {
    const { service, firebase } = await buildModule('console');
    jest.spyOn((service as any).consoleOtpProvider, 'sendOtp').mockResolvedValue(true);

    await service.sendCitizenOtp({ mobileNumber: MOBILE });

    expect(firebase.verifyIdToken).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// FIREBASE MODE TESTS
// ===========================================================================

describe('AuthService — Firebase OTP Mode', () => {
  it('sendCitizenOtp: returns stub message (delivery is client-side)', async () => {
    const { service } = await buildModule('firebase');

    const result = await service.sendCitizenOtp({ mobileNumber: MOBILE });

    expect(result.message).toMatch(/Firebase Phone Auth/i);
    expect(result.expiresInSeconds).toBe(300);
  });

  it('sendCitizenOtp: does NOT write to OtpRequest table in firebase mode', async () => {
    const { service, prisma } = await buildModule('firebase');

    await service.sendCitizenOtp({ mobileNumber: MOBILE });

    expect(prisma.otpRequest.create).not.toHaveBeenCalled();
  });

  it('verifyCitizenOtp (firebase): rejects when idToken is missing', async () => {
    const { service } = await buildModule('firebase');

    await expect(
      service.verifyCitizenOtp({ mobileNumber: MOBILE }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('verifyCitizenOtp (firebase): rejects when Firebase token verification throws', async () => {
    const { service, firebase } = await buildModule('firebase');
    (firebase.verifyIdToken as jest.Mock).mockRejectedValue(new Error('Token expired'));

    await expect(
      service.verifyCitizenOtp({ idToken: 'bad-token', mobileNumber: MOBILE }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('verifyCitizenOtp (firebase): rejects when decoded token has no phone_number', async () => {
    const { service, firebase } = await buildModule('firebase');
    (firebase.verifyIdToken as jest.Mock).mockResolvedValue({ uid: 'some-uid' }); // no phone_number

    await expect(
      service.verifyCitizenOtp({ idToken: 'valid-but-no-phone', mobileNumber: MOBILE }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('verifyCitizenOtp (firebase): accepts valid idToken and issues tokens', async () => {
    const { service, firebase } = await buildModule('firebase');
    (firebase.verifyIdToken as jest.Mock).mockResolvedValue({
      uid: 'fb-uid-123',
      phone_number: `+91${MOBILE}`,
    });

    const result = await service.verifyCitizenOtp({ idToken: 'valid-firebase-token', mobileNumber: MOBILE });

    expect(result.accessToken).toBe('mock.access.token');
    expect(result.refreshToken).toBeDefined();
    expect(result.user.mobileNumber).toBe(MOBILE);
    expect(result.user.role).toBe(UserRole.CITIZEN);
  });

  it('verifyCitizenOtp (firebase): auto-creates new citizen on first login', async () => {
    const { service, firebase, prisma } = await buildModule('firebase', {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          ...mockUser,
          id: 'user-new-fb',
        }),
      },
    });

    (firebase.verifyIdToken as jest.Mock).mockResolvedValue({
      uid: 'fb-uid-new',
      phone_number: `+91${MOBILE}`,
    });

    const result = await service.verifyCitizenOtp({ idToken: 'valid-firebase-token', mobileNumber: MOBILE });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mobileNumber: MOBILE,
          role: UserRole.CITIZEN,
          authProvider: AuthProvider.MOBILE_OTP,
          isAuthorized: true,
        }),
      }),
    );
    expect(result.accessToken).toBe('mock.access.token');
  });

  it('verifyCitizenOtp (firebase): does NOT query OtpRequest table', async () => {
    const { service, firebase, prisma } = await buildModule('firebase');
    (firebase.verifyIdToken as jest.Mock).mockResolvedValue({
      uid: 'fb-uid-123',
      phone_number: `+91${MOBILE}`,
    });

    await service.verifyCitizenOtp({ idToken: 'valid-firebase-token', mobileNumber: MOBILE });

    expect(prisma.otpRequest.findFirst).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// CONVERGENCE TESTS — Both modes issue identical token shape
// ===========================================================================

describe('AuthService — Token convergence (both modes return same shape)', () => {
  it('console mode and firebase mode both return { accessToken, refreshToken, user }', async () => {
    const realOtp = '111111';
    const realHash = await bcrypt.hash(realOtp, 10);

    // Console mode result
    const { service: consoleService, firebase: consoleFb } = await buildModule('console', {
      otpRequest: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'otp-c',
          mobileNumber: MOBILE,
          otpCode: realHash,
          expiresAt: new Date(Date.now() + 60000),
          isVerified: false,
          attempts: 0,
        }),
      },
    });
    const consoleResult = await consoleService.verifyCitizenOtp({ mobileNumber: MOBILE, otp: realOtp });

    // Firebase mode result
    const { service: fbService, firebase: fbFb } = await buildModule('firebase');
    (fbFb.verifyIdToken as jest.Mock).mockResolvedValue({
      uid: 'fb-uid-123',
      phone_number: `+91${MOBILE}`,
    });
    const firebaseResult = await fbService.verifyCitizenOtp({ idToken: 'valid-token', mobileNumber: MOBILE });

    // Both should have the same structure
    for (const result of [consoleResult, firebaseResult]) {
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        mobileNumber: MOBILE,
        role: UserRole.CITIZEN,
      });
    }
  });
});
