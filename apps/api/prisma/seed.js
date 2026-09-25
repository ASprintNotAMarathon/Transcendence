"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const node_path_1 = require("node:path");
const argon2_1 = __importDefault(require("argon2"));
const adapter_pg_1 = require("@prisma/adapter-pg");
const client_1 = require("../src/generated/prisma/client");
(0, dotenv_1.config)({ path: (0, node_path_1.join)(__dirname, '..', '..', '..', '.env') });
const PASSWORD_MIN_LENGTH = 8;
const DISPLAY_NAME_PATTERN = /^[A-Za-z0-9_-]{3,20}$/;
const SEED_USERS = [
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
const FINISHED_MATCH_MOVES = [
    { by: 0, row: 7, col: 3 },
    { by: 1, row: 8, col: 3 },
    { by: 0, row: 7, col: 4 },
    { by: 1, row: 8, col: 4 },
    { by: 0, row: 7, col: 5 },
    { by: 1, row: 8, col: 5 },
    { by: 0, row: 7, col: 6 },
    { by: 1, row: 8, col: 6 },
    { by: 0, row: 7, col: 7 },
];
const ACTIVE_MATCH_MOVES = [
    { by: 0, row: 7, col: 7 },
    { by: 1, row: 7, col: 8 },
    { by: 0, row: 8, col: 8 },
];
function assertValid(user) {
    if (user.password.length < PASSWORD_MIN_LENGTH) {
        throw new Error(`${user.email}: password must be at least ${PASSWORD_MIN_LENGTH} characters`);
    }
    if (!DISPLAY_NAME_PATTERN.test(user.displayName)) {
        throw new Error(`${user.email}: displayName must be 3-20 characters of A-Z a-z 0-9 _ -`);
    }
    if (user.email !== user.email.toLowerCase()) {
        throw new Error(`${user.email}: email must be lowercase`);
    }
}
function toMoveRows(moves) {
    return moves.map((move, index) => ({
        moveNumber: index + 1,
        by: move.by,
        payload: { row: move.row, col: move.col },
    }));
}
async function seedUsers(prisma) {
    const idsByName = new Map();
    for (const user of SEED_USERS) {
        assertValid(user);
        const passwordHash = await argon2_1.default.hash(user.password, {
            type: argon2_1.default.argon2id,
        });
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
async function clearSeedMatches(prisma, userIds) {
    const { count } = await prisma.match.deleteMany({
        where: { player0Id: { in: userIds }, player1Id: { in: userIds } },
    });
    if (count > 0) {
        console.log(`removed ${count} match(es) from a previous seed run`);
    }
}
async function seedMatches(prisma, ids) {
    const alice = ids.get('alice');
    const bob = ids.get('bob');
    const charlie = ids.get('charlie');
    const dana = ids.get('dana');
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
async function main() {
    const databaseUrl = process.env['DATABASE_URL'];
    if (!databaseUrl) {
        throw new Error('DATABASE_URL is not set — copy .env.example to .env first');
    }
    const prisma = new client_1.PrismaClient({
        adapter: new adapter_pg_1.PrismaPg({ connectionString: databaseUrl }),
    });
    try {
        const ids = await seedUsers(prisma);
        await clearSeedMatches(prisma, [...ids.values()]);
        await seedMatches(prisma, ids);
        console.log('seed complete');
    }
    finally {
        await prisma.$disconnect();
    }
}
main().catch((error) => {
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=seed.js.map