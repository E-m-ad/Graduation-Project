import zod from "zod";
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

const getPublicProfile = zod.object({
  id: zod.uuid("Invalid user ID format"),
});
export default { changePasswordSchema, updateProfileSchema, getPublicProfile };
