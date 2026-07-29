import { IsString, MaxLength } from 'class-validator';
import { BaseApplicationDto } from './base-application.dto';

export class CreateApplicationDto extends BaseApplicationDto {
  @IsString()
  @MaxLength(200)
  position!: string;
}
