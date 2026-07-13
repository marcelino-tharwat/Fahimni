import { PrismaClient } from "./src/generated/prisma/client.js";

const p = new PrismaClient();
const stages = await p.stage.findMany({ orderBy: { sortOrder: "asc" } });
console.log(JSON.stringify(stages.map(x => ({ id: x.id, name: x.name, sortOrder: x.sortOrder })), null, 2));
await p.$disconnect();
