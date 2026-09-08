-- CreateEnum
CREATE TYPE "GameName" AS ENUM ('gomoku', 'reversi');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('active', 'finished');

-- CreateTable
CREATE TABLE "Match" (
    "id" UUID NOT NULL,
    "game" "GameName" NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'active',
    "player0Id" UUID NOT NULL,
    "player1Id" UUID NOT NULL,
    "winnerId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Move" (
    "id" UUID NOT NULL,
    "matchId" UUID NOT NULL,
    "moveNumber" INTEGER NOT NULL,
    "by" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Move_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Match_player0Id_idx" ON "Match"("player0Id");

-- CreateIndex
CREATE INDEX "Match_player1Id_idx" ON "Match"("player1Id");

-- CreateIndex
CREATE UNIQUE INDEX "Move_matchId_moveNumber_key" ON "Move"("matchId", "moveNumber");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_player0Id_fkey" FOREIGN KEY ("player0Id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_player1Id_fkey" FOREIGN KEY ("player1Id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Move" ADD CONSTRAINT "Move_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
