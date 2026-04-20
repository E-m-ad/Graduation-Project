import express from "express";
import authMiddleWare from "../middlewares/auth.js";
import rental from "../controllers/rental.js";

const router = express.Router();

router.post("/", authMiddleWare.auth, rental.createRental);
router.get("/my-bookings", authMiddleWare.auth, rental.getMyBookings);
router.get("/my-requests", authMiddleWare.auth, rental.getMyRequests);
router.get("/:id/availability", rental.checkRentalAvailability);
router.get("/:id/messages", authMiddleWare.auth, rental.getRentalMessages);
router.post("/:id/messages", authMiddleWare.auth, rental.sendRentalMessage);
router.put("/:id/approve", authMiddleWare.auth, rental.approveRental);
router.put("/:id/reject", authMiddleWare.auth, rental.rejectRental);
router.put("/:id/cancel", authMiddleWare.auth, rental.cancelRental);
router.put("/:id/start", authMiddleWare.auth, rental.startRental);
router.put("/:id/complete", authMiddleWare.auth, rental.completeRental);
router.get("/:id", authMiddleWare.auth, rental.getRentalDetails);

export default router;
