import { IsOptional, IsString, MaxLength } from 'class-validator';
import { BaseApplicationDto } from './base-application.dto';

// All fields optional. Note: `status` is ignored here — change it via PATCH /:id/status.
export class UpdateApplicationDto extends BaseApplicationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  position?: string;
}
