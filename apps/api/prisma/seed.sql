-- TEMP: two players and one empty gomoku match, so there is something to open.

INSERT INTO "User" ("id", "email", "displayName", "passwordHash", "createdAt", "updatedAt")
VALUES
  ('11111111-1111-4111-8111-111111111111', 'ada@seed.local',   'Ada',   'seed-user-cannot-log-in', now(), now()),
  ('22222222-2222-4222-8222-222222222222', 'linus@seed.local', 'Linus', 'seed-user-cannot-log-in', now(), now())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Match" ("id", "game", "status", "player0Id", "player1Id", "createdAt", "updatedAt")
VALUES
  (
    '33333333-3333-4333-8333-333333333333',
    'gomoku',
    'active',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    now(),
    now()
  )
ON CONFLICT ("id") DO NOTHING;

DELETE FROM "Move" WHERE "matchId" = '33333333-3333-4333-8333-333333333333';

UPDATE "Match"
SET "status" = 'active', "winnerId" = NULL, "updatedAt" = now()
WHERE "id" = '33333333-3333-4333-8333-333333333333';
