import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import {Strategy} from 'passport-local';
import { Request } from "express";
import { UsersService } from "src/modules/users/users.service";
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy,'local'){
    constructor(private readonly usersService:UsersService){
        super({
            usernameField:'phone',
            passReqToCallback: true
        })
    }
    async validate(req:Request,phone: string, password: string) {
        const user = await this.usersService.validateUser(phone, password);
        if(!user){
            throw new UnauthorizedException('Invalid credentials');
        }
        return user;
    }
}
