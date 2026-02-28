import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const bearerToken = request.headers.authorization;
    if (bearerToken && bearerToken.startsWith('Bearer')) {
      const token = bearerToken.split(' ')[1];
      if (token) {
        const user = await this.authService.validateToken(token);
        if (user) {
          request.user = user;
          return true;
        }
      }
    }
    throw new UnauthorizedException('Invalid token');
  }
}
