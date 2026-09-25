/*
 * Seed script for the database. Creates four users and two matches, one finished and one in progress.
 *
 * One command fills an empty database with something to look at:
 *
 *     npm run seed        (from the repo root)
 *
 * Creates four users, one finished match (Alice beat Bob) and one match
 * still in progress (Charlie vs Dana). Safe to run twice.
 * Passwords are listed in the root README under "Demo accounts".
 */

import { config } from 'dotenv';
import { join } from 'node:path';
import argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

// The repo keeps one .env at its root: apps/api/prisma → three levels up.
config({ path: join(__dirname, '..', '..', '..', '.env') });

/* ------------------------------------------------------------------ */
/* Team rules the seed must follow (auth proposal 1.1, decision 02)    */
/* ------------------------------------------------------------------ */

// Same numbers the register form and the register endpoint enforce.
const PASSWORD_MIN_LENGTH = 8;
const DISPLAY_NAME_PATTERN = /^[A-Za-z0-9_-]{3,20}$/;

/* ------------------------------------------------------------------ */
/* Seed data                                                          */
/* ------------------------------------------------------------------ */

// A user as written here, before hashing.
interface SeedUser {
	email: string;
	displayName: string;
	// Plain text only in this file; hashed before it reaches the database.
	password: string;
}

// Keep this list in sync with the "Demo accounts" table in the root README.
const SEED_USERS: SeedUser[] = [
	{
		email: 'alice@example.com',
		displayName: 'alice',
		password: 'alice-1234',
	},
	{ email: 'bob@example.com', displayName: 'bob', password: 'bob-12345' },
	{
		email: 'charlie@example.com',
		displayName: 'charlie',
		password: 'charlie-1234',
	},
	{ email: 'dana@example.com', displayName: 'dana', password: 'dana-1234' },
];

// One move as stored in the Move table. `by` is the PlayerIndex (0 or 1).
interface SeedMove {
	by: 0 | 1;
	row: number;
	col: number;
}

// Finished match: player 0 (Alice) makes five in a row on row 7.
// Moves alternate 0,1,0,1… ; the ninth move completes the line.
const FINISHED_MATCH_MOVES: SeedMove[] = [
	{ by: 0, row: 7, col: 3 },
	{ by: 1, row: 8, col: 3 },
	{ by: 0, row: 7, col: 4 },
	{ by: 1, row: 8, col: 4 },
	{ by: 0, row: 7, col: 5 },
	{ by: 1, row: 8, col: 5 },
	{ by: 0, row: 7, col: 6 },
	{ by: 1, row: 8, col: 6 },
	{ by: 0, row: 7, col: 7 }, // five in a row → Alice wins
];

// In-progress match: three moves played, nobody has won yet.
const ACTIVE_MATCH_MOVES: SeedMove[] = [
	{ by: 0, row: 7, col: 7 },
	{ by: 1, row: 7, col: 8 },
	{ by: 0, row: 8, col: 8 },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

// Stops the script with a clear message if a seed user breaks a team rule.
function assertValid(user: SeedUser): void {
	if (user.password.length < PASSWORD_MIN_LENGTH) {
		throw new Error(
			`${user.email}: password must be at least ${PASSWORD_MIN_LENGTH} characters`,
		);
	}
	if (!DISPLAY_NAME_PATTERN.test(user.displayName)) {
		throw new Error(
			`${user.email}: displayName must be 3-20 characters of A-Z a-z 0-9 _ -`,
		);
	}
	// Decision 02: emails are stored lowercased so Kimia@ and kimia@ are one account.
	if (user.email !== user.email.toLowerCase()) {
		throw new Error(`${user.email}: email must be lowercase`);
	}
}

// Turns the compact move list into rows for Move.createMany.
// moveNumber starts at 1; payload is what the Gomoku engine's parseMove returns.
function toMoveRows(moves: SeedMove[]) {
	return moves.map((move, index) => ({
		moveNumber: index + 1,
		by: move.by,
		payload: { row: move.row, col: move.col },
	}));
}

/* ------------------------------------------------------------------ */
/* Steps                                                              */
/* ------------------------------------------------------------------ */

// Creates (or refreshes) the four users. Returns their ids by displayName.
async function seedUsers(prisma: PrismaClient): Promise<Map<string, string>> {
	const idsByName = new Map<string, string>();

	for (const user of SEED_USERS) {
		assertValid(user);

		// argon2id is the library default. The output carries its own salt,
		// which is why the schema has no salt column.
		// TODO(#20): import the hash helper from the auth module once it is merged,
		// so the seed and the register endpoint can never use different settings.
		const passwordHash = await argon2.hash(user.password, {
			type: argon2.argon2id,
		});

		// upsert = insert, or update if the email already exists.
		// Re-running refreshes the name and hash instead of failing on the unique index.
		const row = await prisma.user.upsert({
			where: { email: user.email },
			update: { displayName: user.displayName, passwordHash },
			create: {
				email: user.email,
				displayName: user.displayName,
				passwordHash,
			},
		});

		idsByName.set(user.displayName, row.id);
		console.log(`user ready: ${user.displayName} <${user.email}>`);
	}

	return idsByName;
}

// Removes matches between seed users from a previous run.
// Moves go with them: the Move → Match relation is onDelete: Cascade.
async function clearSeedMatches(
	prisma: PrismaClient,
	userIds: string[],
): Promise<void> {
	const { count } = await prisma.match.deleteMany({
		where: { player0Id: { in: userIds }, player1Id: { in: userIds } },
	});
	if (count > 0) {
		console.log(`removed ${count} match(es) from a previous seed run`);
	}
}

// Creates one finished and one active match, each with its moves.
async function seedMatches(
	prisma: PrismaClient,
	ids: Map<string, string>,
): Promise<void> {
	// Map.get can return undefined; the seed users were just created, so `!` is safe here.
	const alice = ids.get('alice')!;
	const bob = ids.get('bob')!;
	const charlie = ids.get('charlie')!;
	const dana = ids.get('dana')!;

	// Finished: status + winnerId are set together, as match.service does after a winning move.
	await prisma.match.create({
		data: {
			game: 'gomoku',
			status: 'finished',
			player0Id: alice,
			player1Id: bob,
			winnerId: alice,
			moves: { createMany: { data: toMoveRows(FINISHED_MATCH_MOVES) } },
		},
	});
	console.log('match ready: alice beat bob (finished)');

	// In progress: status stays at its default (active), no winner yet.
	await prisma.match.create({
		data: {
			game: 'gomoku',
			player0Id: charlie,
			player1Id: dana,
			moves: { createMany: { data: toMoveRows(ACTIVE_MATCH_MOVES) } },
		},
	});
	console.log('match ready: charlie vs dana (in progress)');
}

/* ------------------------------------------------------------------ */
/* Entry point                                                        */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
	const databaseUrl = process.env['DATABASE_URL'];
	if (!databaseUrl) {
		throw new Error(
			'DATABASE_URL is not set — copy .env.example to .env first',
		);
	}

	// Same adapter setup as PrismaService, without the Nest wrapper:
	// this script runs on its own, outside the API.
	const prisma = new PrismaClient({
		adapter: new PrismaPg({ connectionString: databaseUrl }),
	});

	try {
		const ids = await seedUsers(prisma);
		await clearSeedMatches(prisma, [...ids.values()]);
		await seedMatches(prisma, ids);
		console.log('seed complete');
	} finally {
		// Always close the connection, even if a step threw, or the process hangs.
		await prisma.$disconnect();
	}
}

main().catch((error: unknown) => {
	console.error(error);
	process.exit(1);
});
