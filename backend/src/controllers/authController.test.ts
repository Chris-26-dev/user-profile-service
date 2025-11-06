import dotenv from "dotenv";
dotenv.config({ debug: false });

import request from "supertest";
import { app } from "../app";
import { db } from "../db";
import jwt from "jsonwebtoken";

beforeAll(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterAll(() => {
  (console.log as jest.Mock).mockRestore();
});

describe("AuthController", () => {
  const testUser = {
    email: "testuser@example.com",
    password: "Password123",
    first_name: "Test",
    last_name: "User",
  };

  afterAll(async () => {
    await db.query(
      "DELETE FROM audit_logs WHERE user_id = (SELECT id FROM users WHERE email = ?)",
      [testUser.email]
    );
    await db.query("DELETE FROM users WHERE email = ?", [testUser.email]);
    await db.end();
  });

  describe("POST /api/auth/register", () => {
    it("should register a user successfully", async () => {
      const res = await request(app).post("/api/auth/register").send(testUser);
      expect(res.status).toBe(201);
      expect(res.body.message).toBe("User registered successfully");

      const [rows]: any = await db.query("SELECT * FROM users WHERE email = ?", [testUser.email]);
      expect(rows.length).toBe(1);
      expect(rows[0].password_hash).not.toBe(testUser.password);
    });

    it("should fail if email or password missing", async () => {
      const res = await request(app).post("/api/auth/register").send({ email: "", password: "" });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Email and password are required");
    });

    it("should fail if email is already registered", async () => {
      // First registration succeeds
      await request(app).post("/api/auth/register").send(testUser);

      // Second registration fails
      const res = await request(app).post("/api/auth/register").send(testUser);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Email already registered");
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login successfully with correct credentials", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: testUser.email,
        password: testUser.password,
      });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Login successful");
      expect(res.body.token).toBeDefined();

      const decoded: any = jwt.verify(res.body.token, process.env.JWT_SECRET!);
      expect(decoded).toHaveProperty("id");
      expect(decoded).toHaveProperty("email", testUser.email);

      const [logs]: any = await db.query(
        "SELECT * FROM audit_logs WHERE user_id = ? AND action = 'login'",
        [decoded.id]
      );
      expect(logs.length).toBeGreaterThan(0);
    });

    it("should fail login with wrong password", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: testUser.email,
        password: "wrongpassword",
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid credentials");
    });

    it("should fail login with non-existent email", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "nonexistent@example.com",
        password: "Password123",
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid credentials");
    });
  });
});
