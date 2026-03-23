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

const updateProfileSchema = zod
  .object({
    name: zod
      .string()
      .trim()
      .min(3, "Name must be at least 3 characters long")
      .max(100, "Name must be at most 100 characters long")
      .optional(),
    phone: zod
      .string()
      .max(15, "Phone number must be at most 15 characters long")
      .transform((val) => val.replace(/\s+/g, ""))
      .refine((val) => /^01[0125][0-9]{8}$/.test(val), {
        message: "Invalid Egyptian phone number",
      })
      .optional(),
    city: zod.string().trim().min(10).max(100).optional(),
    address: zod.string().trim().min(10).max(200).optional(),
    bio: zod.string().trim().max(200).optional(),
  })
  .refine((data) => Object.values(data).some((key) => key !== undefined), {
    message: "At least one field must be provided",
  });

const changePasswordSchema = zod
  .object({
    currentPassword: zod.string("Current password is required").min(6),
    newPassword: zod
      .string("New password is required")
      .min(6, "New password must be at least 6 characters long")
      .regex(/[0-9]/, "New password must contain at least one number")
      .regex(
        /[A-Z]/,
        "New password must contain at least one uppercase letter",
      ),
    confirmNewPassword: zod
      .string("Confirm new password is required")
      .min(6, "Confirm new password must be at least 6 characters long"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "New passwords do not match",
    path: ["confirmNewPassword"],
  });

export default {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  changePasswordSchema,
  envProcessSchema,
};
