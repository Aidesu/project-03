import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateEmailTemplateDto } from './dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';
import { EmailTemplatesService } from './email-templates.service';

@Controller('email-templates')
export class EmailTemplatesController {
  constructor(private readonly emailTemplates: EmailTemplatesService) {}

  @Post()
  create(
    @CurrentUser('sub') userId: number,
    @Body() dto: CreateEmailTemplateDto,
  ) {
    return this.emailTemplates.create(userId, dto);
  }

  @Get()
  findMany(@CurrentUser('sub') userId: number) {
    return this.emailTemplates.findMany(userId);
  }

  @Get(':id')
  findOne(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.emailTemplates.findOne(userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmailTemplateDto,
  ) {
    return this.emailTemplates.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.emailTemplates.remove(userId, id);
  }
}
