import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Param,
  Get,
  Query,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { UseGuards } from '@nestjs/common'; // Thêm Get và UseGuards vào import
import { JwtAuthGuard } from './guards/jwt-auth.guard'; // Import JwtAuthGuard
import { GetUser } from './decorators/get-user.decorator'; // Import GetUser decorator
import { UserDocument } from './schemas/user.schema'; // Import UserDocument

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() createUserDto: CreateUserDto) {
    const user = await this.authService.register(createUserDto);
    return { message: 'Đăng ký thành công!', user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginUserDto: LoginUserDto) {
    return this.authService.login(loginUserDto);
  }

  @Post('forgot-password')
  forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Post('reset-password/:token')
  resetPassword(
    @Param('token') token: string,
    @Body('password') password: string,
  ) {
    return this.authService.resetPassword(token, password);
  }

    @Get('verify-email')
    async verifyEmail(@Query('token') token: string) {
        const result = await this.authService.verifyEmail(token);
        // Trả về HTML thay vì JSON để hiển thị trực tiếp
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Xác thực Email</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 20px;
                    }
                    .container { max-width: 500px; width: 100%; }
                    .card {
                        background: white;
                        border-radius: 20px;
                        padding: 40px;
                        text-align: center;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                        animation: fadeIn 0.5s ease-in;
                    }
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(-20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    .icon { font-size: 64px; margin-bottom: 20px; }
                    h2 { color: #333; margin-bottom: 16px; font-size: 28px; }
                    p { color: #666; line-height: 1.6; margin-bottom: 20px; }
                    .btn {
                        display: inline-block;
                        padding: 12px 24px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        text-decoration: none;
                        border-radius: 40px;
                        font-weight: 600;
                        margin-top: 20px;
                        transition: transform 0.2s;
                    }
                    .btn:hover { transform: translateY(-2px); }
                    .success { color: #10b981; }
                    .error { color: #ef4444; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="card">
                        <div class="icon">${result.message.includes('thành công') ? '✅' : 'ℹ️'}</div>
                        <h2 style="color: ${result.message.includes('thành công') ? '#10b981' : '#f59e0b'}">
                            ${result.message.includes('thành công') ? 'Xác thực thành công!' : 'Thông báo'}
                        </h2>
                        <p>${result.message}</p>
                        <a href="${process.env.FRONTEND_URL}${result.redirectUrl || '/login'}" class="btn">
                            🔐 Đến trang đăng nhập
                        </a>
                    </div>
                </div>
            </body>
            </html>
        `;
    }


  @UseGuards(JwtAuthGuard) // Bảo vệ route này, yêu cầu phải có token hợp lệ
  @Get('me')
  getMe(@GetUser() user: UserDocument) {
    // Decorator @GetUser sẽ lấy user đã được xác thực từ token
    // Trả về thông tin user (không bao gồm mật khẩu)
    const { password, ...result } = user.toObject();
    return result;
  }
}
