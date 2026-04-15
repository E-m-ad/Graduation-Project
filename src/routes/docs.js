import express from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import openApiDocument from "../docs/openapi.js";

const router = express.Router();

router.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

router.get("/openapi.json", (req, res) => {
  res.status(200).json(openApiDocument);
});

router.use(swaggerUi.serve);

router.get(
  "/",
  swaggerUi.setup(openApiDocument, {
    explorer: true,
    customSiteTitle: "Rental Marketplace API Docs",
    swaggerOptions: {
      persistAuthorization: true,
    },
  }),
);

export default router;
