import { NotFoundException } from '@nestjs/common';
import { InterviewOutcome, XpReason } from '@prisma/client';
import { GamificationService } from '../gamification/gamification.service';
import { PrismaService } from '../prisma/prisma.service';
import { InterviewsService } from './interviews.service';

const OWNER_ID = 1;
const APPLICATION_ID = '11111111-1111-4111-8111-111111111111';
const SCREENING_ID = '22222222-2222-4222-8222-222222222222';
const TECHNICAL_ID = '33333333-3333-4333-8333-333333333333';

const keyFor = (interviewId: string) =>
  `${XpReason.INTERVIEW_COMPLETED}:${interviewId}`;

describe('InterviewsService', () => {
  let prisma: {
    interview: { create: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    jobApplication: { count: jest.Mock };
    contact: { count: jest.Mock };
  };
  let gamification: { award: jest.Mock; syncAchievements: jest.Mock };
  let service: InterviewsService;

  beforeEach(() => {
    prisma = {
      interview: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      jobApplication: { count: jest.fn().mockResolvedValue(1) },
      contact: { count: jest.fn().mockResolvedValue(1) },
    };
    gamification = { award: jest.fn(), syncAchievements: jest.fn() };
    service = new InterviewsService(
      prisma as unknown as PrismaService,
      gamification as unknown as GamificationService,
    );
  });

  /** Drives an interview to a new outcome through the update path. */
  const setOutcome = async (
    id: string,
    from: InterviewOutcome,
    to: InterviewOutcome,
  ) => {
    prisma.interview.findFirst.mockResolvedValue({
      id,
      applicationId: APPLICATION_ID,
      outcome: from,
    });
    await service.update(OWNER_ID, id, { outcome: to });
  };

  const keys = () =>
    gamification.award.mock.calls.map(
      (call) => (call[3] as { dedupeKey: string }).dedupeKey,
    );

  describe('completion XP', () => {
    it('pays once for an interview walked back to PENDING and completed again', async () => {
      await setOutcome(
        SCREENING_ID,
        InterviewOutcome.PENDING,
        InterviewOutcome.PASSED,
      );
      // PASSED → PENDING earns nothing on the way out...
      await setOutcome(
        SCREENING_ID,
        InterviewOutcome.PASSED,
        InterviewOutcome.PENDING,
      );
      // ...and the second completion re-uses the key the first one claimed.
      await setOutcome(
        SCREENING_ID,
        InterviewOutcome.PENDING,
        InterviewOutcome.PASSED,
      );

      expect(keys()).toEqual([keyFor(SCREENING_ID), keyFor(SCREENING_ID)]);
    });

    it('keys per interview, not per application', async () => {
      // A pipeline legitimately holds a screening and a technical round on the
      // same application; keying on the application would swallow the second.
      await setOutcome(
        SCREENING_ID,
        InterviewOutcome.PENDING,
        InterviewOutcome.PASSED,
      );
      await setOutcome(
        TECHNICAL_ID,
        InterviewOutcome.PENDING,
        InterviewOutcome.FAILED,
      );

      expect(keys()).toEqual([keyFor(SCREENING_ID), keyFor(TECHNICAL_ID)]);
    });

    it('keys an interview created already completed on its own id', async () => {
      prisma.interview.create.mockResolvedValue({ id: SCREENING_ID });

      await service.create(OWNER_ID, {
        applicationId: APPLICATION_ID,
        type: 'TECHNICAL',
        outcome: InterviewOutcome.PASSED,
      });

      expect(gamification.award).toHaveBeenCalledWith(
        OWNER_ID,
        XpReason.INTERVIEW_COMPLETED,
        expect.any(Number),
        { applicationId: APPLICATION_ID, dedupeKey: keyFor(SCREENING_ID) },
      );
    });

    it('awards nothing for a still-pending interview but re-syncs achievements', async () => {
      prisma.interview.create.mockResolvedValue({ id: SCREENING_ID });

      await service.create(OWNER_ID, {
        applicationId: APPLICATION_ID,
        type: 'TECHNICAL',
      });

      expect(gamification.award).not.toHaveBeenCalled();
      expect(gamification.syncAchievements).toHaveBeenCalledWith(OWNER_ID);
    });
  });

  describe('ownership', () => {
    it('refuses to update an interview hanging off another user application', async () => {
      prisma.interview.findFirst.mockResolvedValue(null);

      await expect(
        service.update(OWNER_ID, SCREENING_ID, {
          outcome: InterviewOutcome.PASSED,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.interview.update).not.toHaveBeenCalled();
      expect(gamification.award).not.toHaveBeenCalled();
    });

    it('scopes the ownership lookup through the parent application', async () => {
      // Interviews carry no userId of their own — the join is the only thing
      // standing between an id in the URL and someone else's row.
      await setOutcome(
        SCREENING_ID,
        InterviewOutcome.PENDING,
        InterviewOutcome.PASSED,
      );

      expect(prisma.interview.findFirst).toHaveBeenCalledWith({
        where: { id: SCREENING_ID, application: { userId: OWNER_ID } },
      });
    });
  });
});
