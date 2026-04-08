import {
  PASSWORDS,
  assert,
  createClient,
  expectStatus,
  loginUser,
  makeImagesForm,
  registerUser,
  verifyEmailToken,
  db,
} from "./test-harness.mjs";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export async function createDefaultActors(context) {
  const guest = createClient(context, "guest");
  const authUser = createClient(context, "auth-user");
  const ownerUser = createClient(context, "owner-user");
  const renterUser = createClient(context, "renter-user");
  const adminUser = createClient(context, "admin-user");

  const users = {
    auth: {
      client: authUser,
      email: `${context.runPrefix}-auth@example.com`,
      name: `${context.runPrefix} Auth User`,
    },
    owner: {
      client: ownerUser,
      email: `${context.runPrefix}-owner@example.com`,
      name: `${context.runPrefix} Owner User`,
    },
    renter: {
      client: renterUser,
      email: `${context.runPrefix}-renter@example.com`,
      name: `${context.runPrefix} Renter User`,
    },
    admin: {
      client: adminUser,
      email: `${context.runPrefix}-admin@example.com`,
      name: `${context.runPrefix} Admin User`,
    },
  };

  const registrationResponses = {};

  for (const [label, user] of Object.entries(users)) {
    registrationResponses[label] = await registerUser(guest, {
      label,
      name: user.name,
      email: user.email,
      password: PASSWORDS.primary,
    });

    assert(
      registrationResponses[label]?.verificationToken,
      `Register ${label} user should return a development verification token`,
      registrationResponses[label],
    );
    await verifyEmailToken(
      guest,
      registrationResponses[label].verificationToken,
      `Verify ${label} user email`,
    );
  }

  await db.user.update({
    where: { email: users.admin.email },
    data: { role: "admin" },
  });

  for (const user of Object.values(users)) {
    await loginUser(user.client, user.email, PASSWORDS.primary);
  }

  return {
    guest,
    authUser,
    ownerUser,
    renterUser,
    adminUser,
    authEmail: users.auth.email,
    ownerEmail: users.owner.email,
    renterEmail: users.renter.email,
    adminEmail: users.admin.email,
  };
}

export async function createCategory(adminUser, payload, label = "Create category") {
  const result = await adminUser.request("POST", "/categories", {
    json: payload,
  });
  expectStatus(result, 201, label);
  return result.body?.data;
}

export async function createProduct(ownerUser, payload, label = "Create product") {
  const result = await ownerUser.request("POST", "/products", {
    json: payload,
  });
  expectStatus(result, 201, label);
  return result.body?.data;
}

export async function uploadProductImages(
  ownerUser,
  productId,
  filenames,
  label = "Upload product images",
) {
  const result = await ownerUser.request(
    "POST",
    `/products/${productId}/images`,
    {
      form: makeImagesForm(filenames),
    },
  );

  expectStatus(result, 201, label);
  assert(
    result.body?.data?.images?.length === filenames.length,
    `${label} should return ${filenames.length} uploaded images`,
    result.body,
  );

  return result.body?.data;
}

export async function approveProduct(
  adminUser,
  productId,
  reason = "QA approval for automated tests",
) {
  const result = await adminUser.request(
    "PUT",
    `/admin/products/${productId}/approve`,
    {
      json: { reason },
    },
  );

  expectStatus(result, 200, "Approve product");
  return result.body?.data;
}

export function createRentalWindow(startOffsetDays, endOffsetDays) {
  const now = Date.now();

  return {
    startDate: new Date(now + startOffsetDays * DAY_IN_MS),
    endDate: new Date(now + endOffsetDays * DAY_IN_MS),
  };
}
