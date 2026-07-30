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
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApplicationsService } from './applications.service';
import { ChangeStatusDto } from './dto/change-status.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { DailyStatsQueryDto } from './dto/daily-stats-query.dto';
import { QueryApplicationsDto } from './dto/query-applications.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Post()
  create(
    @CurrentUser('sub') userId: number,
    @Body() dto: CreateApplicationDto,
  ) {
    return this.applications.create(userId, dto);
  }

  @Get()
  findMany(
    @CurrentUser('sub') userId: number,
    @Query() query: QueryApplicationsDto,
  ) {
    return this.applications.findMany(userId, query);
  }

  @Get('stats/daily')
  dailyStats(
    @CurrentUser('sub') userId: number,
    @Query() query: DailyStatsQueryDto,
  ) {
    return this.applications.dailyStats(userId, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.applications.findOne(userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApplicationDto,
  ) {
    return this.applications.update(userId, id, dto);
  }

  @Patch(':id/status')
  changeStatus(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
  ) {
    return this.applications.changeStatus(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.applications.remove(userId, id);
  }
}
