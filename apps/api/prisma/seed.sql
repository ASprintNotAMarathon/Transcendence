-- TEMP: two players and one empty gomoku match, so there is something to open
-- while nothing in the app creates matches yet. Delete this file, and the seed
-- target in the Makefile, once matchmaking exists.
--
-- Run it with `make seed`, which prints the two URLs to open.
--
-- The ids are fixed rather than generated, so the URLs stay the same across a
-- reseed and can be pasted into notes. ON CONFLICT makes the whole file safe to
-- run twice: it tops the database up instead of failing on the second run.
--
-- passwordHash is deliberately not a real hash. These two cannot log in, and
-- they do not need to: the socket takes its identity from ?as= in the URL while
-- WS_DEV_AUTH is on.

INSERT INTO "User" ("id", "email", "displayName", "passwordHash", "createdAt", "updatedAt")
VALUES
  ('11111111-1111-4111-8111-111111111111', 'ada@seed.local',   'Ada',   'seed-user-cannot-log-in', now(), now()),
  ('22222222-2222-4222-8222-222222222222', 'linus@seed.local', 'Linus', 'seed-user-cannot-log-in', now(), now())
ON CONFLICT ("id") DO NOTHING;

-- Ada is player 0, so Ada moves first.
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

-- A reseed of an already played match would otherwise keep its moves, and the
-- board would come back mid-game. Emptying them is what makes `make seed` mean
-- "give me a fresh board".
DELETE FROM "Move" WHERE "matchId" = '33333333-3333-4333-8333-333333333333';

UPDATE "Match"
SET "status" = 'active', "winnerId" = NULL, "updatedAt" = now()
WHERE "id" = '33333333-3333-4333-8333-333333333333';
