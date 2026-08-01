import { ForbiddenException } from '@nestjs/common';
import { ApplicationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyReviewsService } from './company-reviews.service';

describe('CompanyReviewsService', () => {
  let prisma: {
    $transaction: jest.Mock;
    jobApplication: { findFirst: jest.Mock };
    companyReview: { findUnique: jest.Mock; upsert: jest.Mock };
  };
  let service: CompanyReviewsService;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      jobApplication: { findFirst: jest.fn() },
      companyReview: { findUnique: jest.fn(), upsert: jest.fn() },
    };
    service = new CompanyReviewsService(prisma as unknown as PrismaService);
  });

  describe('upsertReview', () => {
    it('rejects with ForbiddenException when the user never applied to this company', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue(null);

      await expect(
        service.upsertReview(1, 'dc-1', { rating: 5, didRespond: true }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.companyReview.upsert).not.toHaveBeenCalled();
    });

    it('excludes WISHLIST/DRAFT applications from the eligibility check', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue(null);

      await expect(
        service.upsertReview(1, 'dc-1', { rating: 3, didRespond: false }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prisma.jobApplication.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 1,
            company: { directoryCompanyId: 'dc-1' },
            status: {
              notIn: [ApplicationStatus.WISHLIST, ApplicationStatus.DRAFT],
            },
          }),
        }),
      );
    });

    it('upserts (never duplicate-inserts) once the user has an eligible application', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue({ id: 'app-1' });
      prisma.companyReview.upsert.mockResolvedValue({
        id: 'rev-1',
        rating: 4,
        didRespond: true,
      });

      await service.upsertReview(1, 'dc-1', { rating: 4, didRespond: true });

      expect(prisma.companyReview.upsert).toHaveBeenCalledWith({
        where: {
          userId_directoryCompanyId: { userId: 1, directoryCompanyId: 'dc-1' },
        },
        create: {
          userId: 1,
          directoryCompanyId: 'dc-1',
          rating: 4,
          didRespond: true,
        },
        update: { rating: 4, didRespond: true },
      });
    });

    it('a second submission for the same user+company still goes through upsert with the same key', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue({ id: 'app-1' });
      prisma.companyReview.upsert.mockResolvedValue({ id: 'rev-1' });

      await service.upsertReview(1, 'dc-1', { rating: 4, didRespond: true });
      await service.upsertReview(1, 'dc-1', { rating: 2, didRespond: false });

      expect(prisma.companyReview.upsert).toHaveBeenCalledTimes(2);
      for (const call of prisma.companyReview.upsert.mock.calls) {
        expect(call[0].where).toEqual({
          userId_directoryCompanyId: { userId: 1, directoryCompanyId: 'dc-1' },
        });
      }
    });
  });

  describe('getMyReviewContext', () => {
    it('is ineligible with no suggestion when there is no qualifying application', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue(null);
      prisma.companyReview.findUnique.mockResolvedValue(null);

      const ctx = await service.getMyReviewContext(1, 'dc-1');

      expect(ctx).toEqual({
        eligible: false,
        suggestedDidRespond: null,
        existingReview: null,
      });
    });

    it.each([
      [ApplicationStatus.SCREENING, true],
      [ApplicationStatus.INTERVIEW, true],
      [ApplicationStatus.TECHNICAL_TEST, true],
      [ApplicationStatus.OFFER, true],
      [ApplicationStatus.ACCEPTED, true],
      [ApplicationStatus.REJECTED, true],
      [ApplicationStatus.GHOSTED, false],
      [ApplicationStatus.APPLIED, null],
      [ApplicationStatus.WITHDRAWN, null],
    ])('suggests didRespond=%s for status %s', async (status, expected) => {
      prisma.jobApplication.findFirst.mockResolvedValue({ status });
      prisma.companyReview.findUnique.mockResolvedValue(null);

      const ctx = await service.getMyReviewContext(1, 'dc-1');

      expect(ctx.eligible).toBe(true);
      expect(ctx.suggestedDidRespond).toBe(expected);
    });

    it('surfaces the existing review when the user already rated this company', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue({
        status: ApplicationStatus.INTERVIEW,
      });
      prisma.companyReview.findUnique.mockResolvedValue({
        rating: 5,
        didRespond: true,
      });

      const ctx = await service.getMyReviewContext(1, 'dc-1');

      expect(ctx.existingReview).toEqual({ rating: 5, didRespond: true });
    });
  });
});
