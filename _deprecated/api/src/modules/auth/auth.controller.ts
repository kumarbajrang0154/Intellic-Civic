import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { ExchangeCodeDto } from './dto/exchange-code.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('citizen/send-otp')
  @HttpCode(HttpStatus.OK)
  async sendCitizenOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.authService.sendCitizenOtp(sendOtpDto);
  }

  @Public()
  @Post('citizen/verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyCitizenOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyCitizenOtp(verifyOtpDto);
  }

  @Public()
  @Get('staff/google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Passport initiates redirect to Google OAuth consent screen
  }

  @Public()
  @Get('staff/google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req: any, @Res() res: Response) {
    const result = await this.authService.handleGoogleCallback(req.user);
    return res.redirect(result.redirectUrl);
  }

  @Public()
  @Post('exchange-code')
  @HttpCode(HttpStatus.OK)
  async exchangeCode(@Body() exchangeCodeDto: ExchangeCodeDto) {
    return this.authService.exchangeCode(exchangeCodeDto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.logout(refreshTokenDto);
  }

  @Get('me')
  async getProfile(@CurrentUser() user: any) {
    return {
      user,
    };
  }
}
