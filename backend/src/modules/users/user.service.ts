import bcrypt from "bcryptjs";
import { prisma } from "../../config/database.js";
import type { ApiError } from "../../shared/types/common.types.js";
import { UserRepository } from "./user.repository.js";
import { userPublicFields } from "./user.types.js";
import type { CreateUserInput } from "./user.validation.js";

export class UserService {
  constructor(private readonly userRepository = new UserRepository()) {}

  public async listUsers() {
    return this.userRepository.findAll();
  }

  public async createUser(input: CreateUserInput) {
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

    return prisma.user.create({
      data: {
        fullName: input.fullName,
        email: input.email,
        mobile: input.mobile,
        password: hashedPassword,
        role: input.role,
      },
      select: userPublicFields,
    });
  }
}
