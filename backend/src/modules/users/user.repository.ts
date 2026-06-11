import { prisma } from "../../config/database.js";
import { userPublicFields } from "./user.types.js";

export class UserRepository {
  public async findAll() {
    return prisma.user.findMany({
      select: userPublicFields,
      orderBy: { createdAt: "desc" },
    });
  }
}
