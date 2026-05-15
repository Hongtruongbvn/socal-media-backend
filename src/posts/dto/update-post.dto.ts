import { IsEnum, IsNotEmpty, IsOptional, IsString, IsArray } from 'class-validator';
import { PostVisibility } from '../schemas/post.schema';

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsEnum(PostVisibility)
  visibility?: PostVisibility;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaUrls?: string[];
}
