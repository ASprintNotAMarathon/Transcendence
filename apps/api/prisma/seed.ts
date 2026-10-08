/*
 * Seed scripts for the database
 *
 *One command fills an empty database with something to look at:
 *npm run seed        (from the repo root)
 *
 * Creates four users, one finished match (Alice beat Bob) and one match
 * still in progress (Charlie vs Dana). Safe to run twice.
 * Passwords are listed in the root README under "Demo accounts"
 *
 * npm run seed -- --edge-cases creates the unusual matches.
 */

import 'reflect-metadata';
import { config } from 'dotenv'; //for loading environment variables from a .env file
import { join } from 'node:path'; //for joining paths
import { PrismaPg } from '@prisma/adapter-pg'; //for the PrismaPg adapter
import { PrismaClient } from '../src/generated/prisma/client'; //for the PrismaClient type
import { gomoku, replay } from '@transcendence/shared'; //used for replay()
import { PasswordService } from '../src/auth';

// The repo keeps one .env at its root: apps/api/prisma → three levels up.
config({ path: join(__dirname, '..', '..', '..', '.env') });

// auth proposal 1.1, decision 02--
//The entire string must contain only letters, numbers, _, or -, and must be 3–20 characters long
const PASSWORD_MIN_LENGTH = 8;
const DISPLAY_NAME_PATTERN = /^[A-Za-z0-9_-]{3,20}$/;

// `npm run seed -- --edge-cases` also writes the unusual matches
//process is a global object by Node.js
const SEED_EDGE_CASES = process.argv.includes('--edge-cases');

/* ------------------------------------------------------------------ */
/* Seed data                                                          */
/* ------------------------------------------------------------------ */

// Template for one user to be created
interface SeedUser {
	id: string; // fixed so demo URLs survive a reseed
	email: string;
	displayName: string;
	password: string;
}

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
	draw: '00000000-0000-4000-8000-000000000111',
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

// Drawn match: all 225 points filled, nobody ever gets five in a row.
// Generated from the pattern color(r,c) = ((c + 2r) % 4 < 2), which caps every
// line (row, column, both diagonals) at runs of two; verified with replay().
const DRAW_MATCH_MOVES: SeedMove[] = [
	{ by: 0, row: 0, col: 0 },
	{ by: 1, row: 0, col: 2 },
	{ by: 0, row: 0, col: 1 },
	{ by: 1, row: 0, col: 3 },
	{ by: 0, row: 0, col: 4 },
	{ by: 1, row: 0, col: 6 },
	{ by: 0, row: 0, col: 5 },
	{ by: 1, row: 0, col: 7 },
	{ by: 0, row: 0, col: 8 },
	{ by: 1, row: 0, col: 10 },
	{ by: 0, row: 0, col: 9 },
	{ by: 1, row: 0, col: 11 },
	{ by: 0, row: 0, col: 12 },
	{ by: 1, row: 0, col: 14 },
	{ by: 0, row: 0, col: 13 },
	{ by: 1, row: 1, col: 0 },
	{ by: 0, row: 1, col: 2 },
	{ by: 1, row: 1, col: 1 },
	{ by: 0, row: 1, col: 3 },
	{ by: 1, row: 1, col: 4 },
	{ by: 0, row: 1, col: 6 },
	{ by: 1, row: 1, col: 5 },
	{ by: 0, row: 1, col: 7 },
	{ by: 1, row: 1, col: 8 },
	{ by: 0, row: 1, col: 10 },
	{ by: 1, row: 1, col: 9 },
	{ by: 0, row: 1, col: 11 },
	{ by: 1, row: 1, col: 12 },
	{ by: 0, row: 1, col: 14 },
	{ by: 1, row: 1, col: 13 },
	{ by: 0, row: 2, col: 0 },
	{ by: 1, row: 2, col: 2 },
	{ by: 0, row: 2, col: 1 },
	{ by: 1, row: 2, col: 3 },
	{ by: 0, row: 2, col: 4 },
	{ by: 1, row: 2, col: 6 },
	{ by: 0, row: 2, col: 5 },
	{ by: 1, row: 2, col: 7 },
	{ by: 0, row: 2, col: 8 },
	{ by: 1, row: 2, col: 10 },
	{ by: 0, row: 2, col: 9 },
	{ by: 1, row: 2, col: 11 },
	{ by: 0, row: 2, col: 12 },
	{ by: 1, row: 2, col: 14 },
	{ by: 0, row: 2, col: 13 },
	{ by: 1, row: 3, col: 0 },
	{ by: 0, row: 3, col: 2 },
	{ by: 1, row: 3, col: 1 },
	{ by: 0, row: 3, col: 3 },
	{ by: 1, row: 3, col: 4 },
	{ by: 0, row: 3, col: 6 },
	{ by: 1, row: 3, col: 5 },
	{ by: 0, row: 3, col: 7 },
	{ by: 1, row: 3, col: 8 },
	{ by: 0, row: 3, col: 10 },
	{ by: 1, row: 3, col: 9 },
	{ by: 0, row: 3, col: 11 },
	{ by: 1, row: 3, col: 12 },
	{ by: 0, row: 3, col: 14 },
	{ by: 1, row: 3, col: 13 },
	{ by: 0, row: 4, col: 0 },
	{ by: 1, row: 4, col: 2 },
	{ by: 0, row: 4, col: 1 },
	{ by: 1, row: 4, col: 3 },
	{ by: 0, row: 4, col: 4 },
	{ by: 1, row: 4, col: 6 },
	{ by: 0, row: 4, col: 5 },
	{ by: 1, row: 4, col: 7 },
	{ by: 0, row: 4, col: 8 },
	{ by: 1, row: 4, col: 10 },
	{ by: 0, row: 4, col: 9 },
	{ by: 1, row: 4, col: 11 },
	{ by: 0, row: 4, col: 12 },
	{ by: 1, row: 4, col: 14 },
	{ by: 0, row: 4, col: 13 },
	{ by: 1, row: 5, col: 0 },
	{ by: 0, row: 5, col: 2 },
	{ by: 1, row: 5, col: 1 },
	{ by: 0, row: 5, col: 3 },
	{ by: 1, row: 5, col: 4 },
	{ by: 0, row: 5, col: 6 },
	{ by: 1, row: 5, col: 5 },
	{ by: 0, row: 5, col: 7 },
	{ by: 1, row: 5, col: 8 },
	{ by: 0, row: 5, col: 10 },
	{ by: 1, row: 5, col: 9 },
	{ by: 0, row: 5, col: 11 },
	{ by: 1, row: 5, col: 12 },
	{ by: 0, row: 5, col: 14 },
	{ by: 1, row: 5, col: 13 },
	{ by: 0, row: 6, col: 0 },
	{ by: 1, row: 6, col: 2 },
	{ by: 0, row: 6, col: 1 },
	{ by: 1, row: 6, col: 3 },
	{ by: 0, row: 6, col: 4 },
	{ by: 1, row: 6, col: 6 },
	{ by: 0, row: 6, col: 5 },
	{ by: 1, row: 6, col: 7 },
	{ by: 0, row: 6, col: 8 },
	{ by: 1, row: 6, col: 10 },
	{ by: 0, row: 6, col: 9 },
	{ by: 1, row: 6, col: 11 },
	{ by: 0, row: 6, col: 12 },
	{ by: 1, row: 6, col: 14 },
	{ by: 0, row: 6, col: 13 },
	{ by: 1, row: 7, col: 0 },
	{ by: 0, row: 7, col: 2 },
	{ by: 1, row: 7, col: 1 },
	{ by: 0, row: 7, col: 3 },
	{ by: 1, row: 7, col: 4 },
	{ by: 0, row: 7, col: 6 },
	{ by: 1, row: 7, col: 5 },
	{ by: 0, row: 7, col: 7 },
	{ by: 1, row: 7, col: 8 },
	{ by: 0, row: 7, col: 10 },
	{ by: 1, row: 7, col: 9 },
	{ by: 0, row: 7, col: 11 },
	{ by: 1, row: 7, col: 12 },
	{ by: 0, row: 7, col: 14 },
	{ by: 1, row: 7, col: 13 },
	{ by: 0, row: 8, col: 0 },
	{ by: 1, row: 8, col: 2 },
	{ by: 0, row: 8, col: 1 },
	{ by: 1, row: 8, col: 3 },
	{ by: 0, row: 8, col: 4 },
	{ by: 1, row: 8, col: 6 },
	{ by: 0, row: 8, col: 5 },
	{ by: 1, row: 8, col: 7 },
	{ by: 0, row: 8, col: 8 },
	{ by: 1, row: 8, col: 10 },
	{ by: 0, row: 8, col: 9 },
	{ by: 1, row: 8, col: 11 },
	{ by: 0, row: 8, col: 12 },
	{ by: 1, row: 8, col: 14 },
	{ by: 0, row: 8, col: 13 },
	{ by: 1, row: 9, col: 0 },
	{ by: 0, row: 9, col: 2 },
	{ by: 1, row: 9, col: 1 },
	{ by: 0, row: 9, col: 3 },
	{ by: 1, row: 9, col: 4 },
	{ by: 0, row: 9, col: 6 },
	{ by: 1, row: 9, col: 5 },
	{ by: 0, row: 9, col: 7 },
	{ by: 1, row: 9, col: 8 },
	{ by: 0, row: 9, col: 10 },
	{ by: 1, row: 9, col: 9 },
	{ by: 0, row: 9, col: 11 },
	{ by: 1, row: 9, col: 12 },
	{ by: 0, row: 9, col: 14 },
	{ by: 1, row: 9, col: 13 },
	{ by: 0, row: 10, col: 0 },
	{ by: 1, row: 10, col: 2 },
	{ by: 0, row: 10, col: 1 },
	{ by: 1, row: 10, col: 3 },
	{ by: 0, row: 10, col: 4 },
	{ by: 1, row: 10, col: 6 },
	{ by: 0, row: 10, col: 5 },
	{ by: 1, row: 10, col: 7 },
	{ by: 0, row: 10, col: 8 },
	{ by: 1, row: 10, col: 10 },
	{ by: 0, row: 10, col: 9 },
	{ by: 1, row: 10, col: 11 },
	{ by: 0, row: 10, col: 12 },
	{ by: 1, row: 10, col: 14 },
	{ by: 0, row: 10, col: 13 },
	{ by: 1, row: 11, col: 0 },
	{ by: 0, row: 11, col: 2 },
	{ by: 1, row: 11, col: 1 },
	{ by: 0, row: 11, col: 3 },
	{ by: 1, row: 11, col: 4 },
	{ by: 0, row: 11, col: 6 },
	{ by: 1, row: 11, col: 5 },
	{ by: 0, row: 11, col: 7 },
	{ by: 1, row: 11, col: 8 },
	{ by: 0, row: 11, col: 10 },
	{ by: 1, row: 11, col: 9 },
	{ by: 0, row: 11, col: 11 },
	{ by: 1, row: 11, col: 12 },
	{ by: 0, row: 11, col: 14 },
	{ by: 1, row: 11, col: 13 },
	{ by: 0, row: 12, col: 0 },
	{ by: 1, row: 12, col: 2 },
	{ by: 0, row: 12, col: 1 },
	{ by: 1, row: 12, col: 3 },
	{ by: 0, row: 12, col: 4 },
	{ by: 1, row: 12, col: 6 },
	{ by: 0, row: 12, col: 5 },
	{ by: 1, row: 12, col: 7 },
	{ by: 0, row: 12, col: 8 },
	{ by: 1, row: 12, col: 10 },
	{ by: 0, row: 12, col: 9 },
	{ by: 1, row: 12, col: 11 },
	{ by: 0, row: 12, col: 12 },
	{ by: 1, row: 12, col: 14 },
	{ by: 0, row: 12, col: 13 },
	{ by: 1, row: 13, col: 0 },
	{ by: 0, row: 13, col: 2 },
	{ by: 1, row: 13, col: 1 },
	{ by: 0, row: 13, col: 3 },
	{ by: 1, row: 13, col: 4 },
	{ by: 0, row: 13, col: 6 },
	{ by: 1, row: 13, col: 5 },
	{ by: 0, row: 13, col: 7 },
	{ by: 1, row: 13, col: 8 },
	{ by: 0, row: 13, col: 10 },
	{ by: 1, row: 13, col: 9 },
	{ by: 0, row: 13, col: 11 },
	{ by: 1, row: 13, col: 12 },
	{ by: 0, row: 13, col: 14 },
	{ by: 1, row: 13, col: 13 },
	{ by: 0, row: 14, col: 0 },
	{ by: 1, row: 14, col: 2 },
	{ by: 0, row: 14, col: 1 },
	{ by: 1, row: 14, col: 3 },
	{ by: 0, row: 14, col: 4 },
	{ by: 1, row: 14, col: 6 },
	{ by: 0, row: 14, col: 5 },
	{ by: 1, row: 14, col: 7 },
	{ by: 0, row: 14, col: 8 },
	{ by: 1, row: 14, col: 10 },
	{ by: 0, row: 14, col: 9 },
	{ by: 1, row: 14, col: 11 },
	{ by: 0, row: 14, col: 12 },
	{ by: 1, row: 14, col: 14 },
	{ by: 0, row: 14, col: 13 },
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
// Takes an array of SeedMove objects and converts each one
// into rows for later insertion in the database.
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
	const passwords = new PasswordService();

	for (const user of SEED_USERS) {
		assertValid(user);

		// Hashing goes through the auth module's PasswordService, so the seed
		// and the register endpoint can never use different settings.
		const passwordHash = await passwords.hash(user.password);

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
	//delete rows from the match table where both players are in the oldIds list/seed users
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
	// Drawn match: board completely full, finished, no winner.
	const drawRows = toMoveRows(DRAW_MATCH_MOVES);
	if (replay(gomoku, drawRows).outcome?.kind !== 'draw') {
		throw new Error('seed bug: DRAW_MATCH_MOVES must end in a draw');
	}
	await prisma.match.create({
		data: {
			id: MATCH_IDS.draw,
			game: 'gomoku',
			status: 'finished',
			player0Id: charlie,
			player1Id: dana,
			moves: { createMany: { data: drawRows } },
		},
	});
	console.log('edge match ready: charlie vs dana drew the full board');
}

/* ------------------------------------------------------------------ */
/* seed function                                                       */
/* ------------------------------------------------------------------ */

async function runSeed(): Promise<void> {
	//store database url given by Node.js
	const databaseUrl = process.env['DATABASE_URL'];
	if (!databaseUrl) {
		throw new Error(
			'DATABASE_URL is not set — copy .env.example to .env first',
		);
	}
	// Create a new PrismaClient instance and configure it to connect to the database.
	// PrismaClient is the main class for interacting with the database.
	// PrismaPg is the PostgreSQL adapter used by PrismaClient.
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
