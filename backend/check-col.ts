import { prisma } from "./src/config/database.js";
const rows = await prisma.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_name = 'teacher_registration_requests' AND column_name = 'rejectionMode'");
console.log(JSON.stringify(rows));
const allCols = await prisma.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_name = 'teacher_registration_requests'");
console.log("All columns:", allCols.map((r: any) => r.column_name).join(", "));
await prisma.$disconnect();
