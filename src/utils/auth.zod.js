import zod from "zod";

const registerSchema = zod
  .object({
    name: zod
      .string("Please enter your name")
      .min(3, "Name must be at least 3 characters long"),
    email: zod.email("Invalid email address"),
    password: zod
      .string("Password is required")
      .min(6, "Password must be at least 6 characters long")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter"),
    confirmPassword: zod
      .string("Confirm Password is required")
      .min(6, "Confirm Password must be at least 6 characters long"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const loginSchema = zod.object({
  email: zod.email("Invalid email address"),
  password: zod.string("Password is required"),
});

const forgotPasswordSchema = zod.object({
  email: zod.email("Invalid email address"),
});

const resetPasswordSchema = zod
  .object({
    token: zod
      .string("Reset token is required")
      .min(1, "Reset token is required"),
    password: zod
      .string("Password is required")
      .min(6, "Password must be at least 6 characters long")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter"),
    confirmPassword: zod
      .string("Confirm Password is required")
      .min(6, "Confirm Password must be at least 6 characters long"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const envProcessSchema = zod.object({
  JWT_SECRET: zod.string("JWT_SECRET is required"),
  REFRESH_TOKEN_SECRET: zod.string("REFRESH_TOKEN_SECRET is required"),
  ACCESS_TOKEN_EXPIRATION: zod.string("ACCESS_TOKEN_EXPIRATION is required"),
  REFRESH_TOKEN_EXPIRATION: zod.string("REFRESH_TOKEN_EXPIRATION is required"),
});

export default {
  envProcessSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
};
