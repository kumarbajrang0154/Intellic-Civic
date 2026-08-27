import {
  Injectable,
  Inject,
  HttpException,
  HttpStatus,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthProvider, User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OTP_PROVIDER_TOKEN, OtpProvider } from './interfaces/otp-provider.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(OTP_PROVIDER_TOKEN) private readonly otpProvider: OtpProvider,
  ) {}

  async sendCitizenOtp(sendOtpDto: SendOtpDto) {
    const mobileNumber = sendOtpDto.mobileNumber.trim();
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    // Rate limit check: max 3 requests per 10 minutes
    const recentRequestsCount = await this.prismaService.otpRequest.count({
      where: {
        mobileNumber,
        createdAt: { gte: tenMinutesAgo },
      },
    });

    if (recentRequestsCount >= 3) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Maximum 3 OTP requests allowed per 10 minutes for this mobile number.',
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Generate 6-digit OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otpCode, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

    // Save OTP request in DB
    await this.prismaService.otpRequest.create({
      data: {
        mobileNumber,
        otpCode: hashedOtp,
        expiresAt,
      },
    });

    // Send OTP via pluggable provider
    await this.otpProvider.sendOtp(mobileNumber, otpCode);

    return {
      message: 'OTP sent successfully',
      expiresInSeconds: 300,
    };
  }

  async verifyCitizenOtp(verifyOtpDto: VerifyOtpDto) {
    const mobileNumber = verifyOtpDto.mobileNumber.trim();

    // Fetch latest non-verified, non-expired OTP request
    const otpRequest = await this.prismaService.otpRequest.findFirst({
      where: {
        mobileNumber,
        isVerified: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRequest) {
      throw new UnauthorizedException('OTP invalid or expired. Please request a new OTP.');
    }

    if (otpRequest.attempts >= 5) {
      throw new UnauthorizedException(
        'Maximum OTP verification attempts exceeded. Please request a new OTP.',
      );
    }

    const isMatch = await bcrypt.compare(verifyOtpDto.otp, otpRequest.otpCode);

    if (!isMatch) {
      const updated = await this.prismaService.otpRequest.update({
        where: { id: otpRequest.id },
        data: { attempts: { increment: 1 } },
      });

      const remainingAttempts = Math.max(0, 5 - updated.attempts);
      throw new UnauthorizedException(
        `Invalid OTP code. ${remainingAttempts} attempt(s) remaining.`,
      );
    }

    // Mark OTP verified
    await this.prismaService.otpRequest.update({
      where: { id: otpRequest.id },
      data: { isVerified: true },
    });

    // Fetch or auto-create Citizen user
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
        const tokens = await this.generateTokens(user);
        return {
          status: 'AUTHORIZED',
          redirectUrl: `${frontendUrl}/auth/callback?token=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`,
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
