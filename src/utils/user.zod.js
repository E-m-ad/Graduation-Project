import zod from "zod";

function nullableTrimmedString(schema) {
  return zod.preprocess((value) => {
    if (value === null) {
      return null;
    }

    if (typeof value === "string") {
      const trimmedValue = value.trim();
      return trimmedValue === "" ? null : trimmedValue;
    }

    return value;
  }, schema.nullable().optional());
}

const updateProfileSchema = zod
  .object({
    name: zod.preprocess(
      (value) => (typeof value === "string" ? value.trim() : value),
      zod
        .string()
        .min(3, "Name must be at least 3 characters long")
        .max(100, "Name must be at most 100 characters long")
        .optional(),
    ),
    phone: zod.preprocess((value) => {
      if (value === null) {
        return null;
      }

      if (typeof value === "string") {
        const normalizedValue = value.replace(/\s+/g, "");
        return normalizedValue === "" ? null : normalizedValue;
      }

      return value;
    }, zod
      .string()
      .max(15, "Phone number must be at most 15 characters long")
      .refine((val) => /^01[0125][0-9]{8}$/.test(val), {
        message: "Invalid Egyptian phone number",
      })
      .nullable()
      .optional()),
    city: nullableTrimmedString(
      zod
        .string()
        .min(2, "City must be at least 2 characters long")
        .max(100, "City must be at most 100 characters long"),
    ),
    address: nullableTrimmedString(
      zod
        .string()
        .min(5, "Address must be at least 5 characters long")
        .max(200, "Address must be at most 200 characters long"),
    ),
    bio: nullableTrimmedString(
      zod.string().max(200, "Bio must be at most 200 characters long"),
    ),
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
