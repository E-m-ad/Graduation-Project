import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));


export default app;
``