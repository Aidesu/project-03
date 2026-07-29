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
import { CreateInterviewDto } from './dto/create-interview.dto';
import { QueryInterviewsDto } from './dto/query-interviews.dto';
import { UpdateInterviewDto } from './dto/update-interview.dto';
import { InterviewsService } from './interviews.service';

@Controller('interviews')
export class InterviewsController {
  constructor(private readonly interviews: InterviewsService) {}

  @Post()
  create(@CurrentUser('sub') userId: number, @Body() dto: CreateInterviewDto) {
    return this.interviews.create(userId, dto);
  }

  @Get()
  findMany(
    @CurrentUser('sub') userId: number,
    @Query() query: QueryInterviewsDto,
  ) {
    return this.interviews.findMany(userId, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.interviews.findOne(userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInterviewDto,
  ) {
    return this.interviews.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.interviews.remove(userId, id);
  }
}
