import {
    Injectable,
    ConflictException,
    UnauthorizedException,
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { MailerService } from '@nestjs-modules/mailer';
import { randomBytes, createHash } from 'crypto';

@Injectable()
export class AuthService {
    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private jwtService: JwtService,
        private readonly mailerService: MailerService,
    ) {}

    async register(createUserDto: CreateUserDto): Promise<Omit<User, 'password'>> {
        const { username, email, password } = createUserDto;

        const reservedUsernames = [
            'admin',
            'moderator',
            'support',
            'root',
            'administrator',
        ];
        if (reservedUsernames.includes(username.toLowerCase())) {
            throw new ConflictException('Tên người dùng này không được phép sử dụng.');
        }

        const existingUser = await this.userModel.findOne({
            $or: [{ email }, { username }]
        });

        if (existingUser) {
            if (existingUser.email === email) {
                throw new ConflictException('Email đã được sử dụng.');
            }
            if (existingUser.username === username) {
                throw new ConflictException('Tên người dùng đã tồn tại.');
            }
        }

        const salt = await bcrypt.genSalt();
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new this.userModel({
            username,
            email,
            password: hashedPassword,
            isEmailVerified: false,
        });

        const result = await newUser.save();
        await this.sendVerificationEmail(result);

        const { password: _, ...user } = result.toObject();
        return user;
    }

    async sendVerificationEmail(user: UserDocument) {
        const verificationToken = this.jwtService.sign(
            {
                sub: user._id,
                email: user.email,
            },
            {
                expiresIn: '1d',
                secret: process.env.JWT_SECRET || 'your-secret-key',
            },
        );

        // URL gọi API backend để xác thực
        const apiVerificationUrl = `${process.env.API_URL || 'http://localhost:3000'}/auth/verify-email?token=${verificationToken}`;

        const htmlEmail = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Xác thực Email</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        margin: 0;
                        padding: 20px;
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .container {
                        max-width: 500px;
                        width: 100%;
                        margin: 0 auto;
                    }
                    .card {
                        background: white;
                        border-radius: 20px;
                        padding: 40px;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                        text-align: center;
                        animation: fadeIn 0.5s ease-in;
                    }
                    @keyframes fadeIn {
                        from {
                            opacity: 0;
                            transform: translateY(-20px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }
                    .icon {
                        font-size: 64px;
                        margin-bottom: 20px;
                    }
                    h1 {
                        color: #333;
                        margin-bottom: 16px;
                        font-size: 28px;
                    }
                    p {
                        color: #666;
                        line-height: 1.6;
                        margin-bottom: 20px;
                    }
                    .btn {
                        display: inline-block;
                        padding: 14px 28px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        text-decoration: none;
                        border-radius: 40px;
                        font-weight: 600;
                        margin-top: 20px;
                        margin-bottom: 20px;
                        transition: transform 0.2s, box-shadow 0.2s;
                        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                    }
                    .btn:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
                    }
                    .footer {
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #eee;
                        font-size: 12px;
                        color: #999;
                    }
                    .note {
                        background: #f7f7f7;
                        padding: 12px;
                        border-radius: 8px;
                        font-size: 13px;
                        margin-top: 20px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="card">
                        <div class="icon">📧</div>
                        <h1>Xác thực Email của bạn</h1>
                        <p>Xin chào <strong>${user.username}</strong>!</p>
                        <p>Cảm ơn bạn đã đăng ký tài khoản. Vui lòng bấm nút bên dưới để xác thực địa chỉ email của bạn.</p>
                        <a href="${apiVerificationUrl}" class="btn">✅ Xác thực Email</a>
                        <div class="note">
                            <strong>⏰ Link này sẽ hết hạn sau 24 giờ</strong><br>
                            Nếu bạn không yêu cầu xác thực, vui lòng bỏ qua email này.
                        </div>
                        <div class="footer">
                            <p>© 2024 Your App Name. Tất cả các quyền được bảo lưu.</p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        await this.mailerService.sendMail({
            to: user.email,
            subject: 'Chào mừng! Vui lòng xác thực email của bạn',
            html: htmlEmail,
        });
    }

    async verifyEmail(token: string): Promise<{ message: string; redirectUrl?: string }> {
        
            const payload = this.jwtService.verify(token, {
                secret: process.env.JWT_SECRET || 'your-secret-key',
            });
            
            const user = await this.userModel.findById(payload.sub);
            
            if (!user) {
                throw new BadRequestException('Người dùng không tồn tại.');
            }
            
            if (user.isEmailVerified) {
                return { 
                    message: 'Email đã được xác thực trước đó!',
                    redirectUrl: '/login'
                };
            }
            
            await this.userModel.updateOne(
                { _id: payload.sub },
                { isEmailVerified: true },
            );
            
            return { 
                message: 'Xác thực email thành công!',
                redirectUrl: '/login'
            };
    
    }

    async resendVerificationEmail(email: string): Promise<{ message: string }> {
        const user = await this.userModel.findOne({ email });
        
        if (!user) {
            throw new NotFoundException('Không tìm thấy người dùng với email này.');
        }
        
        if (user.isEmailVerified) {
            throw new BadRequestException('Email này đã được xác thực.');
        }
        
        await this.sendVerificationEmail(user);
        
        return { message: 'Email xác thực đã được gửi lại. Vui lòng kiểm tra hộp thư của bạn.' };
    }

    async login(loginUserDto: LoginUserDto): Promise<{ accessToken: string; isEmailVerified: boolean }> {
        const { email, password } = loginUserDto;

        const user = await this.userModel.findOne({ email }).select('+password');

        if (!user) {
            throw new UnauthorizedException('Email hoặc mật khẩu không chính xác.');
        }

        if (!user.isEmailVerified) {
            throw new UnauthorizedException('Vui lòng xác thực email trước khi đăng nhập.');
        }

        const isPasswordMatched = await bcrypt.compare(password, user.password);

        if (!isPasswordMatched) {
            throw new UnauthorizedException('Email hoặc mật khẩu không chính xác.');
        }

        const payload = { sub: user._id, username: user.username, email: user.email };
        const accessToken = this.jwtService.sign(payload);

        return { accessToken, isEmailVerified: user.isEmailVerified };
    }

    async forgotPassword(email: string): Promise<{ message: string }> {
        const user = await this.userModel.findOne({ email });
        if (!user) {
            throw new NotFoundException('Không tìm thấy người dùng với email này.');
        }

        const resetToken = randomBytes(32).toString('hex');
        user.passwordResetToken = createHash('sha256')
            .update(resetToken)
            .digest('hex');
        user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();

        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

        await this.mailerService.sendMail({
            to: user.email,
            subject: 'Yêu cầu Đặt lại Mật khẩu',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Đặt lại mật khẩu</h2>
                    <p>Xin chào <strong>${user.username}</strong>,</p>
                    <p>Bạn đã yêu cầu đặt lại mật khẩu. Vui lòng bấm nút bên dưới để tiếp tục:</p>
                    <a href="${resetUrl}" style="display:inline-block; padding:12px 24px; background:#667eea; color:white; text-decoration:none; border-radius:8px; font-weight:bold;">Đặt lại mật khẩu</a>
                    <p style="margin-top:20px;">Link này sẽ hết hạn sau 10 phút.</p>
                    <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
                </div>
            `,
        });

        return { message: 'Email đặt lại mật khẩu đã được gửi.' };
    }

    async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
        const hashedToken = createHash('sha256').update(token).digest('hex');

        const user = await this.userModel.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() },
        });

        if (!user) {
            throw new BadRequestException('Token không hợp lệ hoặc đã hết hạn.');
        }

        const salt = await bcrypt.genSalt();
        user.password = await bcrypt.hash(newPassword, salt);
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        return { message: 'Đặt lại mật khẩu thành công.' };
    }
}