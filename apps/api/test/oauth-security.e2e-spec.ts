import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthService } from '../src/modules/auth/auth.service';
import { PrismaService } from '../src/database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { OTP_PROVIDER_TOKEN } from '../src/modules/auth/interfaces/otp-provider.interface';

describe('OAuth Single-Use Exchange Code Security (Task 2 Security Audit)', () => {
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

  beforeEach(async () => {
    const prismaServiceMock = {
      user: {
        findFirst: jest.fn().mockResolvedValue(mockAuthorizedStaffUser),
        findUnique: jest.fn().mockResolvedValue(mockAuthorizedStaffUser),
        create: jest.fn(),
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
        {
          provide: OTP_PROVIDER_TOKEN,
          useValue: { sendOtp: jest.fn() },
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

    // First exchange attempt: SUCCEEDS
    const firstExchange = await authService.exchangeCode({ code });
    expect(firstExchange).toHaveProperty('accessToken');
    expect(firstExchange).toHaveProperty('refreshToken');
    expect(firstExchange.user.email).toBe(mockAuthorizedStaffUser.email);

    // Second exchange attempt: REJECTED (Single-Use Violation)
    await expect(authService.exchangeCode({ code })).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
