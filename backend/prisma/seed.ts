import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Achievement.threshold criteria are interpreted by GamificationService's
// ACHIEVEMENT_METRIC map — keep codes in sync with that file.
const achievements = [
  {
    code: 'FIRST_APPLICATION',
    name: 'Premier pas',
    description: 'Ajoute ta toute première candidature.',
    icon: '▤',
    xpReward: 20,
    threshold: 1,
  },
  {
    code: 'TEN_APPLICATIONS',
    name: 'Sur la brèche',
    description: 'Atteins 10 candidatures.',
    icon: '▤',
    xpReward: 50,
    threshold: 10,
  },
  {
    code: 'TWENTY_FIVE_APPLICATIONS',
    name: 'Persévérance',
    description: 'Atteins 25 candidatures.',
    icon: '▤',
    xpReward: 100,
    threshold: 25,
  },
  {
    code: 'FIRST_OFFER',
    name: 'Première offre',
    description: 'Reçois ta première offre.',
    icon: '✦',
    xpReward: 80,
    threshold: 1,
  },
  {
    code: 'OFFER_ACCEPTED',
    name: 'Objectif atteint',
    description: 'Accepte une offre.',
    icon: '✦',
    xpReward: 150,
    threshold: 1,
  },
  {
    code: 'STREAK_7',
    name: 'Une semaine de suite',
    description: "Reste actif·ve 7 jours d'affilée.",
    icon: '🔥',
    xpReward: 40,
    threshold: 7,
  },
  {
    code: 'STREAK_30',
    name: 'Un mois de discipline',
    description: "Reste actif·ve 30 jours d'affilée.",
    icon: '🔥',
    xpReward: 120,
    threshold: 30,
  },
  {
    code: 'LEVEL_5',
    name: 'Niveau 5',
    description: 'Atteins le niveau 5.',
    icon: '▲',
    xpReward: 0,
    threshold: 5,
  },
  {
    code: 'LEVEL_10',
    name: 'Niveau 10',
    description: 'Atteins le niveau 10.',
    icon: '▲',
    xpReward: 0,
    threshold: 10,
  },
];

async function main() {
  for (const achievement of achievements) {
    await prisma.achievement.upsert({
      where: { code: achievement.code },
      create: achievement,
      update: achievement,
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
