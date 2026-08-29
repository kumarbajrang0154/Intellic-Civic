import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { UserRole, AuthProvider } from '@prisma/client';
import { AuthService } from '../src/modules/auth/auth.service';
import { FirebaseAdminService } from '../src/modules/auth/firebase-admin.service';
import { PrismaService } from '../src/database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('OAuth Single-Use Exchange Code & Firebase Auth Security', () => {
  let authService: AuthService;

  const mockAuthorizedStaffUser = {
    id: 'staff-user-uuid-1',
    email: 'staff.head@city.gov',
    googleId: 'google-12345',
    name: 'Staff Department Head',
    role: UserRole.DEPARTMENT_HEAD,
    isAuthorized: true,
    departmentId: 'dept-sanitation-1',
  };

  const mockExistingCitizenUser = {
    id: 'citizen-user-uuid-101',
    mobileNumber: '9876543210',
    name: 'Citizen 3210',
    role: UserRole.CITIZEN,
    authProvider: AuthProvider.MOBILE_OTP,
    isAuthorized: true,
  };

  const firebaseAdminServiceMock = {
    verifyIdToken: jest.fn().mockImplementation((token: string) => {
      if (token === 'valid_firebase_token_existing') {
        return Promise.resolve({ uid: 'fb_1', phone_number: '+919876543210' });
      }
      if (token === 'valid_firebase_token_new') {
        return Promise.resolve({ uid: 'fb_2', phone_number: '+919999988888' });
      }
      if (token.startsWith('mock_fb_token_')) {
        const num = token.replace('mock_fb_token_', '');
        return Promise.resolve({ uid: `fb_${num}`, phone_number: `+91${num}` });
      }
      throw new Error('Invalid or expired Firebase ID token');
    }),
  };

  beforeEach(async () => {
    const prismaServiceMock = {
      user: {
        findFirst: jest.fn().mockResolvedValue(mockAuthorizedStaffUser),
        findUnique: jest.fn().mockImplementation(({ where }: any) => {
          if (where.id === mockAuthorizedStaffUser.id) return Promise.resolve(mockAuthorizedStaffUser);
          if (where.mobileNumber === '9876543210') return Promise.resolve(mockExistingCitizenUser);
          return Promise.resolve(null);
        }),
        create: jest.fn().mockImplementation(({ data }: any) => {
          return Promise.resolve({
            id: 'citizen-new-uuid',
            ...data,
          });
        }),
      },
      refreshToken: {
        create: jest.fn().mockResolvedValue({ id: 'rt-1' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
        {
          provide: FirebaseAdminService,
          useValue: firebaseAdminServiceMock,
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mocked-jwt-access-token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'FRONTEND_URL') return 'http://localhost:3000';
              if (key === 'JWT_SECRET') return 'secret';
              return null;
            }),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  it('1. Google callback returns ONLY an opaque single-use code in redirectUrl (no JWT leakage)', async () => {
    const result = await authService.handleGoogleCallback({
      email: mockAuthorizedStaffUser.email,
      googleId: mockAuthorizedStaffUser.googleId,
      name: mockAuthorizedStaffUser.name,
    });

    expect(result.status).toBe('AUTHORIZED');
    expect(result.redirectUrl).toContain('http://localhost:3000/auth/callback?code=auth_code_');
    expect(result.redirectUrl).not.toContain('token=');
    expect(result.redirectUrl).not.toContain('refreshToken=');
  });

  it('2. Single-Use Enforcement: Code can be exchanged ONCE, second exchange fails with 401', async () => {
    const callbackResult = await authService.handleGoogleCallback({
      email: mockAuthorizedStaffUser.email,
      googleId: mockAuthorizedStaffUser.googleId,
      name: mockAuthorizedStaffUser.name,
    });

    const url = new URL(callbackResult.redirectUrl);
    const code = url.searchParams.get('code')!;
    expect(code).toBeDefined();

    const firstExchange = await authService.exchangeCode({ code });
    expect(firstExchange).toHaveProperty('accessToken');
    expect(firstExchange).toHaveProperty('refreshToken');
    expect(firstExchange.user.email).toBe(mockAuthorizedStaffUser.email);

    await expect(authService.exchangeCode({ code })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('3. Firebase Phone Auth: Valid token for existing citizen issues JWT session', async () => {
    const result = await authService.verifyCitizenOtp({
      idToken: 'valid_firebase_token_existing',
    });

    expect(result).toHaveProperty('accessToken', 'mocked-jwt-access-token');
    expect(result).toHaveProperty('refreshToken');
    expect(result.user.mobileNumber).toBe('9876543210');
    expect(result.user.role).toBe(UserRole.CITIZEN);
  });

  it('4. Firebase Phone Auth: Valid token for new citizen auto-creates Citizen User record', async () => {
    const result = await authService.verifyCitizenOtp({
      idToken: 'valid_firebase_token_new',
    });

    expect(result).toHaveProperty('accessToken', 'mocked-jwt-access-token');
    expect(result.user.mobileNumber).toBe('9999988888');
    expect(result.user.role).toBe(UserRole.CITIZEN);
  });

  it('5. Firebase Phone Auth: Invalid or expired Firebase ID token is rejected with UnauthorizedException', async () => {
    await expect(
      authService.verifyCitizenOtp({
        idToken: 'invalid_expired_token',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
