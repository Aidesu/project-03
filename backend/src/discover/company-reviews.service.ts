import { ForbiddenException, Injectable } from '@nestjs/common';
import { ApplicationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitReviewDto } from './dto/submit-review.dto';

// A review requires an application that was actually sent — grounds the
// signal in a real outcome instead of an unsubstantiated opinion. Confirmed
// with the product owner: WISHLIST/DRAFT (never submitted) don't count.
const NOT_YET_APPLIED: ApplicationStatus[] = [
  ApplicationStatus.WISHLIST,
  ApplicationStatus.DRAFT,
];

const RESPONDED_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.SCREENING,
  ApplicationStatus.INTERVIEW,
  ApplicationStatus.TECHNICAL_TEST,
  ApplicationStatus.OFFER,
  ApplicationStatus.ACCEPTED,
  ApplicationStatus.REJECTED,
];

/** Frontend pre-fill only — the user can still override at submission time. */
function suggestDidRespond(status: ApplicationStatus): boolean | null {
  if (RESPONDED_STATUSES.includes(status)) return true;
  if (status === ApplicationStatus.GHOSTED) return false;
  return null; // APPLIED/WITHDRAWN with no further signal yet: no opinion either way
}

export interface MyReviewContext {
  eligible: boolean;
  suggestedDidRespond: boolean | null;
  existingReview: { rating: number; didRespond: boolean } | null;
}

/**
 * Write path for company reviews — strictly userId-scoped (author) plus the
 * has-applied gate. Never queries Company.notes or Contact, and never
 * returns another user's review.
 */
@Injectable()
export class CompanyReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyReviewContext(
    userId: number,
    directoryCompanyId: string,
  ): Promise<MyReviewContext> {
    const [application, existing] = await this.prisma.$transaction([
      this.prisma.jobApplication.findFirst({
        where: {
          userId,
          company: { directoryCompanyId },
          status: { notIn: NOT_YET_APPLIED },
        },
        select: { status: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.companyReview.findUnique({
        where: { userId_directoryCompanyId: { userId, directoryCompanyId } },
        select: { rating: true, didRespond: true },
      }),
    ]);

    return {
      eligible: application !== null,
      suggestedDidRespond: application
        ? suggestDidRespond(application.status)
        : null,
      existingReview: existing,
    };
  }

  async upsertReview(
    userId: number,
    directoryCompanyId: string,
    dto: SubmitReviewDto,
  ) {
    const eligible = await this.prisma.jobApplication.findFirst({
      where: {
        userId,
        company: { directoryCompanyId },
        status: { notIn: NOT_YET_APPLIED },
      },
      select: { id: true },
    });
    if (!eligible) {
      throw new ForbiddenException(
        'Ajoute une candidature réellement envoyée à cette entreprise pour pouvoir la noter.',
      );
    }

    return this.prisma.companyReview.upsert({
      where: { userId_directoryCompanyId: { userId, directoryCompanyId } },
      create: {
        userId,
        directoryCompanyId,
        rating: dto.rating,
        didRespond: dto.didRespond,
      },
      update: { rating: dto.rating, didRespond: dto.didRespond },
    });
  }
}
