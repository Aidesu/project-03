import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CompanyReviewsService } from './company-reviews.service';
import { DiscoverService } from './discover.service';
import { QueryDiscoverDto } from './dto/query-discover.dto';
import { SubmitReviewDto } from './dto/submit-review.dto';

@Controller('discover')
export class DiscoverController {
  constructor(
    private readonly discover: DiscoverService,
    private readonly reviews: CompanyReviewsService,
  ) {}

  // Narrow, intentional exception to this app's per-user data scoping:
  // no @CurrentUser() at all on these two routes.
  @Get()
  findMany(@Query() query: QueryDiscoverDto) {
    return this.discover.findMany(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.discover.findOne(id);
  }

  // Everything below is ownership-scoped, same as the rest of the app.
  @Get(':id/my-review')
  getMyReview(@CurrentUser('sub') userId: number, @Param('id', ParseUUIDPipe) id: string) {
    return this.reviews.getMyReviewContext(userId, id);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':id/reviews')
  submitReview(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitReviewDto,
  ) {
    return this.reviews.upsertReview(userId, id, dto);
  }
}
