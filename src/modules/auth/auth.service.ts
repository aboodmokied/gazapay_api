import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async validateUser(phone: string, pass: string): Promise<any> {
    const user = await this.usersService.findOneByPhone(phone);
    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async validateToken(token: string) {
    try {
      const decodedToken = this.jwtService.verify(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });
      const user = await this.usersService.findOneById(decodedToken.sub);
      if (!user) {
        return null;
      }
      return user;
    } catch (error) {
      return null;
    }
  }

  async login(user: any) {
    const payload = { phone: user.phone, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async register(createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  // forgot password
  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const user = await this.usersService.findOneByPhone(resetPasswordDto.phone);
    if (!user) throw new NotFoundException('User not found');

    const code = '123456'; // For testing, usually generated: Math.floor(100000 + Math.random() * 900000).toString()
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

    await this.prisma.passwordReset.create({
      data: {
        phone: resetPasswordDto.phone,
        passwordResetCode: hashedCode,
        passwordResetExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        passwordResetVerified: false,
      },
    });

    console.log(`Reset code for ${resetPasswordDto.phone}: ${code}`);
    return { message: 'Reset password code sent to your phone' };
  }

  async verifyResetCode(phone: string, code: string) {
    const resetCode = await this.prisma.passwordReset.findFirst({
      where: {
        phone,
        passwordResetVerified: false,
        passwordResetExpires: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!resetCode) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
    if (resetCode.passwordResetCode !== hashedCode) {
      throw new UnauthorizedException('Invalid code');
    }

    await this.prisma.passwordReset.update({
      where: { id: resetCode.id },
      data: { passwordResetVerified: true },
    });

    const token = this.jwtService.sign(
      { phone, type: 'password_reset' },
      {
        secret: this.configService.get<string>('jwt.secret'),
        expiresIn: '10m',
      },
    );
    return { token, message: 'Code verified successfully' };
  }

  async changePassword(token: string, changePasswordDto: ChangePasswordDto) {
    let payload;
    try {
      payload = await this.jwtService.verify(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    if (payload.type !== 'password_reset' || payload.phone !== changePasswordDto.phone) {
      throw new UnauthorizedException('Invalid reset token');
    }

    const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);
    const user = await this.usersService.findOneByPhone(changePasswordDto.phone);
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { phone: changePasswordDto.phone },
      data: { password: hashedPassword },
    });

    return { message: 'Password changed successfully' };
  }
}
