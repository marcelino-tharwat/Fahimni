import { prisma } from "../../config/database.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { userPublicFields } from "./user.types.js";
import type { ListUsersQuery } from "./user.validation.js";

export class UserRepository {
  /**
   * Paginated, filterable user listing. Only ever selects `userPublicFields`
   * so password / tokenVersion / refresh tokens can never leak through this
   * path. Returns the page slice plus the total count for pagination metadata.
   */
  public async findMany(query: ListUsersQuery) {
    const { page, limit, role, status, search } = query;

    const where: Prisma.UserWhereInput = {
      ...(role ? { role } : {}),
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { mobile: { contains: search } },
            ],
          }
        : {}),
    };

    const [total, data] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: userPublicFields,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { page, limit, total, totalPages: Math.ceil(total / limit), data };
  }
}
