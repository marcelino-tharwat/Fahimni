import bcrypt from "bcryptjs";
import { prisma } from "../../config/database.js";
import type { ApiError } from "../../shared/types/common.types.js";
import { auditLogService } from "../../shared/services/auditLog.service.js";
import { UserRepository } from "./user.repository.js";
import { userPublicFields } from "./user.types.js";
import type { CreateUserInput, ListUsersQuery } from "./user.validation.js";

export class UserService {
  constructor(private readonly userRepository = new UserRepository()) {}

  public async listUsers(query: ListUsersQuery) {
    return this.userRepository.findMany(query);
  }

  /**
   * Create a user. This is an ADMIN-only operation (enforced at the route
   * layer), so the caller-supplied role is trusted here. `actorId` is the
   * authenticated admin performing the action, recorded for the audit trail.
   */
  public async createUser(input: CreateUserInput, actorId: string) {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: input.email }, { mobile: input.mobile }],
      },
    });

    if (existingUser) {
      const error = new Error("Email or mobile number already exists") as ApiError;
      error.status = 409;
      throw error;
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);

    const created = await prisma.user.create({
      data: {
        fullName: input.fullName,
        email: input.email,
        mobile: input.mobile,
        password: hashedPassword,
        role: input.role,
      },
      select: userPublicFields,
    });

    // Non-blocking audit trail for a privileged mutation. Failures are
    // swallowed inside the service, so this never breaks user creation.
    await auditLogService.record({
      action: "USER_CREATED",
      resourceType: "User",
      resourceId: created.id,
      actorId,
      actorType: "ADMIN",
      details: { role: created.role },
    });

    return created;
  }
}
