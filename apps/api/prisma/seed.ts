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
import { gomoku, replay } from '@transcendence/shared'; //used for replay()

// The repo keeps one .env at its root: apps/api/prisma → three levels up.
config({ path: join(__dirname, '..', '..', '..', '.env') });

/* ------------------------------------------------------------------ */
/* Team rules the seed must follow (auth proposal 1.1, decision 02)    */
/* ------------------------------------------------------------------ */

// Same numbers the register form and the register endpoint enforce.
const PASSWORD_MIN_LENGTH = 8;
const DISPLAY_NAME_PATTERN = /^[A-Za-z0-9_-]{3,20}$/;

// `npm run seed -- --edge-cases` also writes the unusual matches,
// so the default demo data stays clean (review #45).
const SEED_EDGE_CASES = process.argv.includes('--edge-cases');

/* ------------------------------------------------------------------ */
/* Seed data                                                          */
/* ------------------------------------------------------------------ */

// Template for one user to be created. The seed script hashes the password before it reaches the database.
interface SeedUser {
	id: string; // fixed so demo URLs survive a reseed
	email: string;
	displayName: string;
	password: string;
}
//
const SEED_USERS: SeedUser[] = [
	{
		id: '00000000-0000-4000-8000-000000000001',
		email: 'alice@example.com',
		displayName: 'alice',
		password: 'alice-1234',
	},
	{
		id: '00000000-0000-4000-8000-000000000002',
		email: 'bob@example.com',
		displayName: 'bob',
		password: 'bob-12345',
	},
	{
		id: '00000000-0000-4000-8000-000000000003',
		email: 'charlie@example.com',
		displayName: 'charlie',
		password: 'charlie-1234',
	},
	{
		id: '00000000-0000-4000-8000-000000000004',
		email: 'dana@example.com',
		displayName: 'dana',
		password: 'dana-1234',
	},
];

// Fixed match ids so they dont reset every time.
const MATCH_IDS = {
	finished: '00000000-0000-4000-8000-000000000101',
	active: '00000000-0000-4000-8000-000000000102',
	resigned: '00000000-0000-4000-8000-000000000103',
	activeWithWin: '00000000-0000-4000-8000-000000000104',
	gapInHistory: '00000000-0000-4000-8000-000000000105',
	doubleMove: '00000000-0000-4000-8000-000000000106',
	occupiedPoint: '00000000-0000-4000-8000-000000000107',
	offBoard: '00000000-0000-4000-8000-000000000108',
	moveAfterWin: '00000000-0000-4000-8000-000000000109',
	badWinner: '00000000-0000-4000-8000-000000000110',
} as const;

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

// Resigned: finished with a winner but nobody has five in a row
const RESIGNED_MATCH_MOVES: SeedMove[] = [
	{ by: 0, row: 3, col: 3 },
	{ by: 1, row: 4, col: 4 },
	{ by: 0, row: 3, col: 4 },
	{ by: 1, row: 5, col: 5 },
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
				id: user.id,
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

// Removes seed users and their matches from a previous run, so the fixed
// ids always apply cleanly. Matches first because a user with matches cannot be
// deleted. Moves go with the matches because of the foreign key constraint.
async function clearSeedData(prisma: PrismaClient): Promise<void> {
	//store the emails of the seed users in a variable
	const emails = SEED_USERS.map((user) => user.email);
	// Find the ids of any existing users with those emails
	const existing = await prisma.user.findMany({
		where: { email: { in: emails } },
		select: { id: true },
	});
	// store the ids of the existing users in a variable
	const oldIds = existing.map((user) => user.id);
	//delete rows from the match table where either player0Id or player1Id is in the list of oldIds
	const { count } = await prisma.match.deleteMany({
		where: { player0Id: { in: oldIds }, player1Id: { in: oldIds } },
	});
	if (count > 0) {
		console.log(`removed ${count} match(es) from a previous seed run`);
	}
	//delete the users with the oldIds
	await prisma.user.deleteMany({ where: { id: { in: oldIds } } });
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
	// Replay re-validates every move; a typo in the list fails here,
	// at seed time, instead of when someone opens the match.
	const finishedRows = toMoveRows(FINISHED_MATCH_MOVES);
	if (replay(gomoku, finishedRows).outcome === null) {
		throw new Error('seed bug: FINISHED_MATCH_MOVES does not end in a win');
	}
	await prisma.match.create({
		data: {
			id: MATCH_IDS.finished,
			game: 'gomoku',
			status: 'finished',
			player0Id: alice,
			player1Id: bob,
			winnerId: alice,
			moves: { createMany: { data: finishedRows } },
		},
	});
	console.log('match ready: alice beat bob (finished)');

	// In progress: status stays at its default (active), no winner yet.
	const activeRows = toMoveRows(ACTIVE_MATCH_MOVES);
	//replay here catches a typo in the move list and missing moves
	if (replay(gomoku, activeRows).outcome !== null) {
		throw new Error(
			'seed bug: ACTIVE_MATCH_MOVES already contains a finished game',
		);
	}
	await prisma.match.create({
		data: {
			id: MATCH_IDS.active,
			game: 'gomoku',
			player0Id: charlie,
			player1Id: dana,
			moves: { createMany: { data: activeRows } },
		},
	});
	console.log('match ready: charlie vs dana (in progress)');
}

// Unusual and deliberately broken matches for testing the match page.
// Written only when --edge-cases is passed.
async function seedEdgeCases(
	prisma: PrismaClient,
	ids: Map<string, string>,
): Promise<void> {
	console.log('=== EDGE CASES: seeding unusual + broken matches ===');
	const alice = ids.get('alice')!;
	const bob = ids.get('bob')!;
	const charlie = ids.get('charlie')!;
	const dana = ids.get('dana')!;

	// Resigned: finished + winner, but the board shows no five in a row.
	const resignedRows = toMoveRows(RESIGNED_MATCH_MOVES);
	if (replay(gomoku, resignedRows).outcome !== null) {
		throw new Error(
			'seed bug: RESIGNED_MATCH_MOVES must not contain a win',
		);
	}
	await prisma.match.create({
		data: {
			id: MATCH_IDS.resigned,
			game: 'gomoku',
			status: 'finished',
			player0Id: dana,
			player1Id: bob,
			winnerId: dana,
			moves: { createMany: { data: resignedRows } },
		},
	});
	console.log('edge match ready: dana beat bob by resignation');

	// Never closed: the moves contain a win, but status stays 'active'.
	await prisma.match.create({
		data: {
			id: MATCH_IDS.activeWithWin,
			game: 'gomoku',
			player0Id: alice,
			player1Id: charlie,
			moves: { createMany: { data: toMoveRows(FINISHED_MATCH_MOVES) } },
		},
	});
	console.log(
		'edge match ready: alice vs charlie (won on board, never closed)',
	);
	// Broken histories: rows legal play could never produce. Inserted raw,
	// on purpose without replay() — the point is to see how the match page
	// copes (today: loads forever). All between alice and bob so cleanup finds them.
	const brokenMatches = [
		{
			id: MATCH_IDS.gapInHistory,
			label: 'gap in moveNumber (1, 2, 4)',
			rows: [
				{ moveNumber: 1, by: 0, payload: { row: 0, col: 0 } },
				{ moveNumber: 2, by: 1, payload: { row: 1, col: 1 } },
				{ moveNumber: 4, by: 0, payload: { row: 2, col: 2 } },
			],
		},
		{
			id: MATCH_IDS.doubleMove,
			label: 'two moves in a row by player 0',
			rows: [
				{ moveNumber: 1, by: 0, payload: { row: 0, col: 0 } },
				{ moveNumber: 2, by: 0, payload: { row: 1, col: 1 } },
			],
		},
		{
			id: MATCH_IDS.occupiedPoint,
			label: 'second move on an occupied point',
			rows: [
				{ moveNumber: 1, by: 0, payload: { row: 5, col: 5 } },
				{ moveNumber: 2, by: 1, payload: { row: 5, col: 5 } },
			],
		},
		{
			id: MATCH_IDS.offBoard,
			label: 'move off the board (99, 99)',
			rows: [{ moveNumber: 1, by: 0, payload: { row: 99, col: 99 } }],
		},
		{
			id: MATCH_IDS.moveAfterWin,
			label: 'a move after the game was won',
			rows: [
				...toMoveRows(FINISHED_MATCH_MOVES),
				{ moveNumber: 10, by: 1, payload: { row: 0, col: 0 } },
			],
		},
	];

	for (const broken of brokenMatches) {
		await prisma.match.create({
			data: {
				id: broken.id,
				game: 'gomoku',
				player0Id: alice,
				player1Id: bob,
				moves: { createMany: { data: broken.rows } },
			},
		});
		console.log(`edge match ready (broken): ${broken.label}`);
	}

	// Finished match whose winnerId is a real user — but not one of its players.
	await prisma.match.create({
		data: {
			id: MATCH_IDS.badWinner,
			game: 'gomoku',
			status: 'finished',
			player0Id: alice,
			player1Id: bob,
			winnerId: charlie,
			moves: { createMany: { data: toMoveRows(RESIGNED_MATCH_MOVES) } },
		},
	});
	console.log('edge match ready (broken): winnerId is not a player');
}

/* ------------------------------------------------------------------ */
/* seed function                                                       */
/* ------------------------------------------------------------------ */

async function runSeed(): Promise<void> {
	const databaseUrl = process.env['DATABASE_URL'];
	if (!databaseUrl) {
		throw new Error(
			'DATABASE_URL is not set — copy .env.example to .env first',
		);
	}
	// this script runs on its own, outside the API.
	const prisma = new PrismaClient({
		adapter: new PrismaPg({ connectionString: databaseUrl }),
	});

	try {
		await clearSeedData(prisma);
		const ids = await seedUsers(prisma);
		await seedMatches(prisma, ids);
		if (SEED_EDGE_CASES) {
			await seedEdgeCases(prisma, ids);
		}
		console.log('seed complete');
	} finally {
		// Always close the connection, even if a step threw, or the process hangs.
		await prisma.$disconnect();
	}
}

//call the seed function, if fails- return error and exit with code 1
runSeed().catch((error: unknown) => {
	console.error(error);
	process.exit(1);
});
