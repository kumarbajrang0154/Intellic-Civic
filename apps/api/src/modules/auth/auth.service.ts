import {
  Injectable,
  HttpException,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthProvider, User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { ConsoleOtpProvider } from './providers/console-otp.provider';
import { ExchangeCodeDto } from './dto/exchange-code.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { FirebaseAdminService } from './firebase-admin.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly oauthExchangeCodes = new Map<
    string,
    { userId: string; expiresAt: number; used: boolean }
  >();

  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly firebaseAdminService: FirebaseAdminService,
    private readonly consoleOtpProvider: ConsoleOtpProvider,
  ) {}

  // ---------------------------------------------------------------------------
  // OTP_AUTH_MODE helper
  // ---------------------------------------------------------------------------
  private get otpAuthMode(): 'console' | 'firebase' {
    const mode = this.configService.get<string>('OTP_AUTH_MODE') || 'firebase';
    return mode === 'console' ? 'console' : 'firebase';
  }

  // ---------------------------------------------------------------------------
  // SEND OTP
  // ---------------------------------------------------------------------------

  /**
   * Console mode: generates a 6-digit OTP, hashes + stores in OtpRequest, logs to console.
   * Firebase mode: returns informational message — delivery is handled client-side.
   */
  async sendCitizenOtp(sendOtpDto: SendOtpDto) {
    if (this.otpAuthMode === 'console') {
      return this.sendConsoleOtp(sendOtpDto.mobileNumber);
    }

    // Firebase mode — OTP delivery is handled by Firebase Phone Auth on the client.
    return {
      message: 'OTP delivery is now handled via Firebase Phone Auth on the client side.',
      expiresInSeconds: 300,
    };
  }

  private async sendConsoleOtp(mobileNumber: string) {
    // Expire any existing unverified OTPs for this number before issuing a new one
    await this.prismaService.otpRequest.updateMany({
      where: {
        mobileNumber,
        isVerified: false,
        expiresAt: { gt: new Date() },
      },
      data: { expiresAt: new Date() }, // expire immediately
    });

    // Generate 6-digit code
    const otpCode = String(crypto.randomInt(100000, 999999));
    const otpHash = await bcrypt.hash(otpCode, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await this.prismaService.otpRequest.create({
      data: {
        mobileNumber,
        otpCode: otpHash,
        expiresAt,
      },
    });

    // Log to console (dev simulator)
    await this.consoleOtpProvider.sendOtp(mobileNumber, otpCode);

    return {
      message: 'OTP sent successfully. Check server console for the code.',
      expiresInSeconds: 300,
    };
  }

  // ---------------------------------------------------------------------------
  // VERIFY OTP
  // ---------------------------------------------------------------------------

  /**
   * Console mode: verifies plain OTP code against hashed value in OtpRequest.
   * Firebase mode: verifies Firebase ID token via FirebaseAdminService.
   * Both paths converge into find-or-create user + generateTokens.
   */
  async verifyCitizenOtp(verifyOtpDto: VerifyOtpDto) {
    if (this.otpAuthMode === 'console') {
      return this.verifyConsoleOtp(verifyOtpDto);
    }
    return this.verifyFirebaseOtp(verifyOtpDto);
  }

  // -- Console path --

  private async verifyConsoleOtp(verifyOtpDto: VerifyOtpDto) {
    const { mobileNumber, otp } = verifyOtpDto;

    if (!mobileNumber) {
      throw new BadRequestException('mobileNumber is required in console OTP mode.');
    }
    if (!otp) {
      throw new BadRequestException('otp code is required in console OTP mode.');
    }

    // Find the latest unexpired, unverified OTP for this number
    const otpRecord = await this.prismaService.otpRequest.findFirst({
      where: {
        mobileNumber,
        isVerified: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new UnauthorizedException('OTP not found or has expired. Please request a new code.');
    }

    // Brute-force guard: max 5 attempts
    if (otpRecord.attempts >= 5) {
      throw new UnauthorizedException('Too many failed attempts. Please request a new OTP.');
    }

    const isMatch = await bcrypt.compare(otp, otpRecord.otpCode);

    if (!isMatch) {
      // Increment attempts on failure
      await this.prismaService.otpRequest.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Incorrect OTP. Please try again.');
    }

    // Mark as verified
    await this.prismaService.otpRequest.update({
      where: { id: otpRecord.id },
      data: { isVerified: true },
    });

    return this.findOrCreateCitizenAndIssueTokens(mobileNumber);
  }

  // -- Firebase path --

  private async verifyFirebaseOtp(verifyOtpDto: VerifyOtpDto) {
    if (!verifyOtpDto.idToken) {
      throw new UnauthorizedException('Firebase idToken is required for citizen verification.');
    }

    let decodedToken;
    try {
      decodedToken = await this.firebaseAdminService.verifyIdToken(verifyOtpDto.idToken);
    } catch (err: any) {
      this.logger.error(`Firebase token verification failed: ${err.message}`);
      throw new UnauthorizedException('Invalid or expired Firebase authentication token.');
    }

    if (!decodedToken || !decodedToken.phone_number) {
      throw new UnauthorizedException(
        'Firebase token verification succeeded but no verified phone number was found.',
      );
    }

    // Standardize to 10-digit mobile number for DB lookup (e.g. +919876543210 -> 9876543210)
    const rawPhone = decodedToken.phone_number.replace(/\D/g, '');
    const mobileNumber = rawPhone.length >= 10 ? rawPhone.slice(-10) : rawPhone;

    return this.findOrCreateCitizenAndIssueTokens(mobileNumber);
  }

  // -- Shared convergence point --

  /**
   * Find or auto-create a citizen user and issue JWT + refresh token.
   * Called by BOTH console and firebase paths after successful verification.
   */
  private async findOrCreateCitizenAndIssueTokens(mobileNumber: string) {
    let user = await this.prismaService.user.findUnique({
      where: { mobileNumber },
    });

    if (!user) {
      user = await this.prismaService.user.create({
        data: {
          mobileNumber,
          name: `Citizen ${mobileNumber.slice(-4)}`,
          role: UserRole.CITIZEN,
          authProvider: AuthProvider.MOBILE_OTP,
          isAuthorized: true,
        },
      });
    }

    const tokens = await this.generateTokens(user);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        name: user.name,
        mobileNumber: user.mobileNumber,
        role: user.role,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // GOOGLE OAUTH (unchanged)
  // ---------------------------------------------------------------------------

  async handleGoogleCallback(profile: {
    email: string;
    googleId: string;
    name: string;
    avatarUrl?: string;
  }) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      this.configService.get<string>('app.frontendUrl') ||
      'http://localhost:3000';

    let user = await this.prismaService.user.findFirst({
      where: {
        OR: [{ email: profile.email }, { googleId: profile.googleId }],
      },
    });

    if (user) {
      if (user.isAuthorized) {
        // SECURITY ENHANCEMENT: Generate a 60-second single-use opaque authorization code instead of passing JWTs in URL
        const code = `auth_code_${crypto.randomBytes(24).toString('hex')}`;
        this.oauthExchangeCodes.set(code, {
          userId: user.id,
          expiresAt: Date.now() + 60000, // 60 seconds
          used: false,
        });

        return {
          status: 'AUTHORIZED',
          redirectUrl: `${frontendUrl}/auth/callback?code=${code}`,
        };
      } else {
        return {
          status: 'DENIED',
          redirectUrl: `${frontendUrl}/auth/denied`,
        };
      }
    }

    // Auto-create staff account with isAuthorized: false, role: null
    user = await this.prismaService.user.create({
      data: {
        email: profile.email,
        googleId: profile.googleId,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        authProvider: AuthProvider.GOOGLE,
        role: null,
        isAuthorized: false,
      },
    });

    return {
      status: 'PENDING',
      redirectUrl: `${frontendUrl}/auth/pending-approval`,
    };
  }

  // ---------------------------------------------------------------------------
  // EXCHANGE CODE (unchanged)
  // ---------------------------------------------------------------------------

  /**
   * Single-use authorization code exchange for secure OAuth token retrieval without URL leakage.
   */
  async exchangeCode(dto: ExchangeCodeDto) {
    const entry = this.oauthExchangeCodes.get(dto.code);

    if (!entry) {
      throw new UnauthorizedException('Invalid or expired authorization code');
    }

    if (entry.expiresAt < Date.now()) {
      this.oauthExchangeCodes.delete(dto.code);
      throw new UnauthorizedException('Authorization code has expired');
    }

    // SINGLE-USE ENFORCEMENT: Reject if code was already exchanged
    if (entry.used) {
      this.oauthExchangeCodes.delete(dto.code);
      throw new UnauthorizedException('Authorization code has already been used');
    }

    // Mark used and remove code from store immediately
    entry.used = true;
    this.oauthExchangeCodes.delete(dto.code);

    const user = await this.prismaService.user.findUnique({
      where: { id: entry.userId },
    });

    if (!user || !user.isAuthorized) {
      throw new UnauthorizedException('User is not authorized for access');
    }

    const tokens = await this.generateTokens(user);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        departmentId: user.departmentId,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // REFRESH / LOGOUT (unchanged)
  // ---------------------------------------------------------------------------

  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    const activeRefreshTokens = await this.prismaService.refreshToken.findMany({
      where: {
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    let matchedTokenRecord = null;
    for (const record of activeRefreshTokens) {
      const isMatch = await bcrypt.compare(refreshTokenDto.refreshToken, record.tokenHash);
      if (isMatch) {
        matchedTokenRecord = record;
        break;
      }
    }

    if (!matchedTokenRecord) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Invalidate used refresh token (rotation)
    await this.prismaService.refreshToken.delete({
      where: { id: matchedTokenRecord.id },
    });

    const user = matchedTokenRecord.user;

    if (user.authProvider === AuthProvider.GOOGLE && !user.isAuthorized) {
      throw new UnauthorizedException('Staff account is not authorized');
    }

    const newTokens = await this.generateTokens(user);

    return {
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
    };
  }

  async logout(refreshTokenDto: RefreshTokenDto) {
    const activeRefreshTokens = await this.prismaService.refreshToken.findMany({
      where: {
        expiresAt: { gt: new Date() },
      },
    });

    for (const record of activeRefreshTokens) {
      const isMatch = await bcrypt.compare(refreshTokenDto.refreshToken, record.tokenHash);
      if (isMatch) {
        await this.prismaService.refreshToken.delete({
          where: { id: record.id },
        });
        break;
      }
    }

    return { message: 'Logged out successfully' };
  }

  // ---------------------------------------------------------------------------
  // TOKEN GENERATION (unchanged)
  // ---------------------------------------------------------------------------

  private async generateTokens(user: User) {
    const payload = {
      sub: user.id,
      role: user.role,
      mobileNumber: user.mobileNumber,
      email: user.email,
    };

    const accessToken = this.jwtService.sign(payload);

    const rawRefreshToken = crypto.randomUUID();
    const tokenHash = await bcrypt.hash(rawRefreshToken, 10);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await this.prismaService.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }
}
