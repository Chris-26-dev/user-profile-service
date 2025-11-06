import express from "express";
import { authenticate, AuthRequest } from "../middleware/authMiddleware";
import { db } from "../db";

const router = express.Router();

router.get("/", authenticate, async (req: AuthRequest, res) => {
    try {
        const [rows]: any = await db.query("SELECT id, email, first_name, last_name, created_at FROM users WHERE id = ?", [req.user.id]);
        const user = rows[0];

        if (!user) return res.status(404).json({ message: "User not found" });

        // Log audit
        await db.query("INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)", [
            user.id,
            "profile_view",
            `User ${user.email} viewed profile`,
        ]);

        res.json({ user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load profile" });
    }
});

router.put("/", authenticate, async (req: AuthRequest, res) => {
    const { first_name, last_name } = req.body;
    const userId = req.user.id;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Update user profile
        await connection.query(
            "UPDATE users SET first_name = ?, last_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [first_name, last_name, userId]
        );

        // Insert audit log (atomic with update)
        await connection.query(
            "INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)",
            [userId, "profile_update", `Updated name to ${first_name} ${last_name}`]
        );

        await connection.commit();
        res.json({ message: "Profile updated successfully" });
    } catch (error) {
        await connection.rollback();
        console.error("Update failed:", error);
        res.status(500).json({ message: "Profile update failed" });
    } finally {
        connection.release();
    }
});


export default router;
