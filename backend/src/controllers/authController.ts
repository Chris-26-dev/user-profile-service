import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { hashPassword, comparePassword } from "../utils/hash";

export const register = async (req: Request, res: Response) => {
    try {
        const { email, password, first_name, last_name } = req.body;

        if (!email || !password)
            return res.status(400).json({ message: "Email and password are required" });

        // Check if email already exists
        const [existingUsers]: any = await db.query(
            "SELECT id FROM users WHERE email = ?",
            [email]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ message: "Email already registered" });
        }

        // Hash password
        const password_hash = await hashPassword(password);

        // Insert user
        await db.query(
            "INSERT INTO users (email, password_hash, first_name, last_name) VALUES (?, ?, ?, ?)",
            [email, password_hash, first_name, last_name]
        );

        // Fetch the newly created user
        const [rows]: any = await db.query("SELECT * FROM users WHERE email = ?", [email]);
        const user = rows[0];

        // Generate JWT token
        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET!, {
            expiresIn: "1h",
        });

        await db.query(
            "INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)",
            [user.id, "register", `User ${user.email} registered`]
        );

        return res.status(201).json({ message: "User registered successfully", token });
    } catch (err: any) {
        console.error(err);
        if (err.code === "ER_DUP_ENTRY") {
            return res.status(400).json({ message: "Email already registered" });
        }
        return res.status(500).json({ message: "Registration failed" });
    }
};


export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        const [rows]: any = await db.query("SELECT * FROM users WHERE email = ?", [email]);
        const user = rows[0];

        if (!user) return res.status(400).json({ message: "Invalid credentials" });

        const isValid = await comparePassword(password, user.password_hash);
        if (!isValid) return res.status(400).json({ message: "Invalid credentials" });

        // Generate JWT
        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET!, {
            expiresIn: "1h",
        });

        // Log successful login
        await db.query("INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)", [
            user.id,
            "login",
            `User ${user.email} logged in`,
        ]);

        return res.json({ message: "Login successful", token });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Login failed" });
    }
};
