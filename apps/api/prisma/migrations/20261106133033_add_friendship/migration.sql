-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('pending', 'accepted');

-- CreateTable
CREATE TABLE "Friendship" (
    "id" UUID NOT NULL,
    "user0Id" UUID NOT NULL,
    "user1Id" UUID NOT NULL,
    "requesterId" UUID NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Friendship_user1Id_idx" ON "Friendship"("user1Id");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_user0Id_user1Id_key" ON "Friendship"("user0Id", "user1Id");

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_user0Id_fkey" FOREIGN KEY ("user0Id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_user1Id_fkey" FOREIGN KEY ("user1Id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
