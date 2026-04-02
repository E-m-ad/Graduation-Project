import {
  assert,
  createTestContext,
  expectStatus,
  makeImageForm,
  withTestServer,
  db,
} from "./testing/test-harness.mjs";
import {
  approveProduct,
  createCategory,
  createDefaultActors,
  createProduct,
  createRentalWindow,
} from "./testing/scenario-helpers.mjs";

async function run() {
  const context = createTestContext("system-smoke");

  await withTestServer(context, async (runtime) => {
    const docsJsonResponse = await fetch(`${runtime.baseUrl}/docs/openapi.json`);
    assert(
      docsJsonResponse.status === 200,
      "OpenAPI JSON should be reachable",
      { status: docsJsonResponse.status },
    );
    const docsJson = await docsJsonResponse.json();
    assert(
      docsJson?.openapi === "3.0.3" && docsJson?.paths?.["/products"],
      "OpenAPI JSON should expose the documented paths",
      docsJson,
    );

    const docsHtmlResponse = await fetch(`${runtime.baseUrl}/docs`);
    const docsHtml = await docsHtmlResponse.text();
    assert(
      docsHtmlResponse.status === 200 && docsHtml.includes("swagger-ui"),
      "Swagger UI should be reachable",
      { status: docsHtmlResponse.status, body: docsHtml.slice(0, 200) },
    );

    const actors = await createDefaultActors(runtime);

    const category = await createCategory(
      actors.adminUser,
      {
        name: `${runtime.runPrefix} Smoke Category`,
        description: "Category used for smoke validation",
        iconUrl: "https://example.com/icon-smoke.png",
        sortOrder: 1,
        isActive: true,
      },
      "Create smoke category",
    );

    const product = await createProduct(
      actors.ownerUser,
      {
        categoryId: category.id,
        title: `${runtime.runPrefix} Smoke Product`,
        description: "A product created for the critical end-to-end smoke path.",
        pricePerDay: 220,
        securityDeposit: 180,
        city: "Cairo",
        locationAddress: "10 Smoke Street, Cairo",
        condition: "excellent",
        minRentalPeriod: 1,
        maxRentalPeriod: 14,
        tags: ["qa", "smoke"],
      },
      "Create smoke product",
    );

    const uploadImageResult = await actors.ownerUser.request(
      "POST",
      `/products/${product.id}/images`,
      {
        form: makeImageForm("images", `${runtime.runPrefix}-smoke-image.png`),
      },
    );
    expectStatus(uploadImageResult, 201, "Upload smoke product image");

    const ownerRecord = await db.user.findUnique({
      where: { email: actors.ownerEmail },
      select: { id: true, role: true },
    });
    assert(
      ownerRecord?.role === "both",
      "Owner should be promoted to both after creating a listing",
      ownerRecord,
    );

    const approvedProduct = await approveProduct(
      actors.adminUser,
      product.id,
      "Smoke approval for the happy-path journey",
    );
    assert(
      approvedProduct?.isApproved === true,
      "Approved smoke product should be marked approved",
      approvedProduct,
    );

    const publicProducts = await actors.guest.request("GET", "/products", {
      useCookies: false,
      useAccessToken: false,
    });
    expectStatus(publicProducts, 200, "List public products");
    assert(
      publicProducts.body?.data?.products?.some((item) => item.id === product.id),
      "Public product listing should include the smoke product",
      publicProducts.body,
    );

    const availabilityWindow = createRentalWindow(7, 9);
    const availabilityResult = await actors.guest.request(
      "GET",
      `/rentals/${product.id}/availability?startDate=${encodeURIComponent(
        availabilityWindow.startDate.toISOString(),
      )}&endDate=${encodeURIComponent(
        availabilityWindow.endDate.toISOString(),
      )}&rentalPeriodType=daily&quantity=1`,
      {
        useCookies: false,
        useAccessToken: false,
      },
    );
    expectStatus(availabilityResult, 200, "Check smoke rental availability");
    assert(
      availabilityResult.body?.data?.isAvailable === true,
      "Smoke product should be available for booking",
      availabilityResult.body,
    );

    const createRental = await actors.renterUser.request("POST", "/rentals", {
      json: {
        productId: product.id,
        startDate: availabilityWindow.startDate.toISOString(),
        endDate: availabilityWindow.endDate.toISOString(),
        rentalPeriodType: "daily",
        quantity: 1,
        renterNotes: "Smoke booking request",
      },
    });
    expectStatus(createRental, 201, "Create smoke rental");
    const rentalId = createRental.body?.data?.id;

    const approveRental = await actors.ownerUser.request("PUT", `/rentals/${rentalId}/approve`);
    expectStatus(approveRental, 200, "Approve smoke rental");

    await db.rental.update({
      where: { id: rentalId },
      data: {
        startDate: new Date(Date.now() - 2 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const startRental = await actors.ownerUser.request("PUT", `/rentals/${rentalId}/start`);
    expectStatus(startRental, 200, "Start smoke rental");

    const completeRental = await actors.ownerUser.request("PUT", `/rentals/${rentalId}/complete`);
    expectStatus(completeRental, 200, "Complete smoke rental");

    const createReview = await actors.renterUser.request("POST", "/reviews", {
      json: {
        rentalId,
        rating: 5,
        comment: "Smoke flow completed successfully",
      },
    });
    expectStatus(createReview, 201, "Create smoke review");

    const ownerNotifications = await actors.ownerUser.request("GET", "/notifications");
    expectStatus(ownerNotifications, 200, "Get owner notifications");
    assert(
      ownerNotifications.body?.data?.notifications?.length >= 1,
      "Owner should receive notifications during the smoke journey",
      ownerNotifications.body,
    );

    const adminDashboard = await actors.adminUser.request("GET", "/admin/dashboard");
    expectStatus(adminDashboard, 200, "Admin dashboard");

    runtime.log("Smoke suite completed successfully");
  });
}

let exitCode = 0;

try {
  await run();
} catch (error) {
  exitCode = 1;
  console.error("[system-smoke] FAILURE");
  console.error(error);
} finally {
  await db.$disconnect();
}

process.exit(exitCode);
