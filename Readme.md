# User Profile Service – Architecture Document

## Overview
The **User Profile Service** is a full-stack application with:
- **Backend**: Express.js, MySQL
- **Frontend**: React + React Router
- **Auth**: JWT-based authentication
- **Security**: Password hashing (bcrypt), audit logging

It supports user registration, login, profile viewing, and updating, with a focus on security, auditability, and maintainability.

---

## Security Choices

### JWT Authentication
- JWT tokens are issued on successful login/registration.
- Tokens include `id` and `email`, signed with `JWT_SECRET`, valid for 1 hour.
- Backend `authenticate` middleware validates tokens and attaches decoded info to `req.user`.
- Benefits:
  - Stateless authentication
  - Easy integration with REST APIs
  - Expiration limits risk of token compromise

### Password Hashing
- User passwords are hashed using **bcrypt** (10 salt rounds) before database storage.
- `comparePassword` verifies user credentials on login.
- No plaintext passwords are stored, protecting against data breaches.

### Audit Logging
- Critical actions (`register`, `login`, `profile_view`, `profile_update`) are logged in `audit_logs`.
- Each entry includes `user_id`, `action`, `details`, `IP`, and `timestamp`.
- Provides traceability and aids in detecting suspicious activity.

---

## Data Flow

### Registration
1. Frontend collects `email`, `password`, `first_name`, `last_name`.
2. `POST /api/auth/register` validates input, hashes password, inserts user.
3. Generates JWT and logs registration in `audit_logs`.

### Login
1. Frontend sends `email` and `password`.
2. `POST /api/auth/login` validates credentials and generates JWT.
3. Logs successful login in `audit_logs`.

### Profile Access & Update
- `GET /api/profile` returns user info; logs `profile_view`.
- `PUT /api/profile` updates first/last name within a database transaction; logs `profile_update`.
- Frontend tracks changes and only enables updates when data is modified.

---

## Database Schema

### `users`
| Column        | Type           | Description                  |
|---------------|---------------|------------------------------|
| id            | BIGINT PK AI   | Unique user ID               |
| email         | VARCHAR(255)   | Unique email                |
| password_hash | VARCHAR(255)   | Hashed password             |
| first_name    | VARCHAR(100)   | First name                  |
| last_name     | VARCHAR(100)   | Last name                   |
| created_at    | TIMESTAMP      | Account creation timestamp  |
| updated_at    | TIMESTAMP      | Last update timestamp       |

### `audit_logs`
| Column     | Type           | Description                                  |
|------------|---------------|----------------------------------------------|
| id         | BIGINT PK AI   | Unique log ID                                |
| user_id    | BIGINT         | References `users.id`                        |
| action     | VARCHAR(100)   | Action type (`register`, `login`, `profile_update`, etc.) |
| details    | TEXT           | Description of the action                    |
| ip         | VARCHAR(45)    | Client IP address                             |
| created_at | TIMESTAMP      | Log creation timestamp                        |

---

## Frontend Integration
- React components (`Profile`, `LoginForm`, `RegisterForm`, `LogoutButton`) consume REST APIs.
- Auth context stores JWT in `localStorage` and protects routes.
- Forms handle validation, error/success messages, and conditional updates.
- Axios includes JWT in `Authorization` headers for protected endpoints.

---

## Unit Testing
- **Backend**: Auth endpoints (`/register`, `/login`) tested with `supertest`.
- **Frontend**: `Profile` and `LogoutButton` components tested with `@testing-library/react`.
- Ensures authentication, profile management, and logout work as expected.

---

## Summary
The architecture enforces:
- **Secure authentication** with JWT
- **Encrypted passwords** via bcrypt
- **Auditable actions** in `audit_logs`
- **Frontend-backend communication** protected by JWT
- **Scalable and maintainable database schema**



## Performance Optimization
A database index was added on the email column of the users table to optimize search and login queries.

Example:
CREATE UNIQUE INDEX users_email_unique ON users(email);

This improves performance for queries like:
SELECT * FROM users WHERE email = ?

By indexing the email column, MySQL can use a B-tree lookup instead of scanning the entire table, resulting in significantly faster query performance — especially as the number of users grows.

