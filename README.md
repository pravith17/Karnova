# Karnova Enterprise

Karnova Enterprise is a role-based agriculture service portal for Karnataka. It connects farmers, Krishi Officers, and administrators through one web interface and one Node.js backend. The platform supports farmer identity registration, OTP verification, digital Krishi ID cards, land record linking, government scheme applications, officer review workflows, market and job updates, and real-time helpdesk conversations.

This README is written for people who need to understand, install, run, and maintain the project. It does not include any real secret values, private keys, database credentials, or private account access details.

## What the application does

The application has three main user roles.

### Farmers

Farmers use the public portal to create and manage their Krishi identity. A farmer can register with personal and location details, verify the account with a four-digit OTP, sign in, view a digital Krishi card, sync official land records by Aadhaar number, apply for active schemes, track application status, see market and job updates, and raise helpdesk queries.

### Krishi Officers

Krishi Officers use the officer dashboard to manage agricultural services. An officer can publish government schemes, review farmer applications, mark scheme applications as verified or rejected, create official land records, add market price updates, add agricultural job postings, and respond to farmer helpdesk tickets in real time.

### Administrators

Administrators use the admin dashboard to manage the officer network. An administrator can create officer accounts, assign officer details such as name, email, phone, district, and salary, and view the list of active officers. The administrator account is seeded by the backend if it does not already exist, but this README intentionally does not publish its secret credential.

## Project structure

The current project is intentionally small and uses a single frontend file with role-based dashboards.

```text
Karnova-main/
├── index.html          Main browser application for farmers, officers, and administrators
├── server.js           Express, MongoDB, Socket.IO, authentication, and API logic
├── package.json        Node.js project metadata and dependencies
├── package-lock.json   Locked dependency versions
├── README.md           Project documentation
└── redme.txt           Older notes kept in the repository
```

There are no separate `admin.html` or `officer.html` files in the current project. The dashboards are shown from `index.html` after login based on the authenticated user's role.

## Technology stack

The backend uses Node.js with Express. MongoDB is used through Mongoose for persistent data. Socket.IO powers real-time refreshes and helpdesk messaging. JSON Web Tokens are used for authenticated sessions. Bcrypt is used for secure credential hashing. Rate limiting is applied to authentication routes.

The frontend is a plain HTML application that uses Tailwind CSS from a CDN, browser-side JavaScript, Socket.IO client, QR code generation, and HTML-to-PDF support.

External notification services are optional. Brevo can be used for email notifications, and VerifyWay can be used for WhatsApp notifications. If those API keys are not configured, the core application can still run locally, but messages will not be delivered through those services.

## Main features

### Authentication and identity

Farmers register through OTP verification. The OTP expires automatically after a short period. Officers and administrators sign in with credentials created for their accounts. After a successful login, the backend issues a session token.

### Farmer profile and Krishi ID

When a farmer registration succeeds, the system generates a Krishi ID. The frontend uses the farmer profile to display a digital identity card. The card includes the farmer's identity details and can be exported by the browser.

### Land records

Officers can create land records with survey number, Aadhaar number, taluk, panchayat, and area. Farmers can sync land records when the Aadhaar number on the land record matches the Aadhaar number in the farmer profile.

### Government schemes

Officers can create schemes with a scheme number, title, description, benefits, terms, start date, and end date. Farmers can view active schemes and apply. Officers can review submitted applications and update each application status.

### Market and job updates

Officers can add market updates and agricultural job postings. Farmers can see these updates from their dashboard. Updates are saved in MongoDB and refreshed for users through the backend.

### Helpdesk

Farmers can raise helpdesk queries. Officers can view submitted queries, filter them, reply in real time, and mark them as resolved. Socket.IO is used so chat messages and query lists update without requiring a full page reload.

### Notifications

The backend can send OTPs and service updates through email and WhatsApp when the required provider API keys are available. For local development, OTPs are also printed in the server terminal so the developer can complete test flows without a live notification provider.

## Environment variables

Create a `.env` file in the project root before running the backend. Do not commit this file to version control.

Use placeholder values like the following and replace them only in your local environment or deployment platform:

```text
MONGODB_URI=<your MongoDB connection string>
JWT_SECRET=<your long random signing secret>
BREVO_API_KEY=<optional Brevo API key>
VERIFYWAY_API_KEY=<optional VerifyWay API key>
PORT=5001
```

Notes:

- `MONGODB_URI` is optional for local testing if MongoDB is running on `mongodb://127.0.0.1:27017/karnova_enterprise`.
- `JWT_SECRET` should be set in every real deployment.
- `BREVO_API_KEY` is only needed for email delivery.
- `VERIFYWAY_API_KEY` is only needed for WhatsApp delivery.
- Secret values should be stored in environment variables, not in the README, source code comments, screenshots, or chat messages.

## Installation

Install Node.js and MongoDB first. Then open a terminal in the project folder and install dependencies.

```bash
npm install
```

The project does not currently define npm scripts, so the server is started directly with Node.js.

## Running locally

Start MongoDB on your machine or point `MONGODB_URI` to a reachable MongoDB database.

Start the backend:

```bash
node server.js
```

By default, the backend listens on port `5001`. When the server starts, it connects to MongoDB and creates the default administrator record if it is missing.

Open the frontend in a browser:

```text
index.html
```

For the best local experience, serve the folder with a simple static server or a code editor live server extension instead of opening the file directly. The frontend expects the backend API at `http://localhost:5001/api` and the Socket.IO server at `http://localhost:5001`.

## First-time setup flow

1. Create a `.env` file with the required local configuration.
2. Start MongoDB.
3. Run `npm install` if dependencies are not installed.
4. Start the backend with `node server.js`.
5. Open `index.html` in a browser.
6. Sign in as an administrator using the seeded administrator email and the private credential configured by the project owner or deployment maintainer.
7. Create officer accounts from the admin dashboard.
8. Use an officer account to add schemes, land records, market updates, job posts, and respond to helpdesk queries.
9. Register a farmer account through OTP verification.
10. Use the farmer dashboard to sync land records, apply for schemes, view updates, and raise support requests.

## API overview

The backend exposes these main API groups.

### Authentication

- `POST /api/auth/send-otp` sends an OTP for farmer registration.
- `POST /api/auth/register` creates a farmer account after OTP verification.
- `POST /api/auth/login` signs in users by phone, email, Krishi ID, or Aadhaar depending on the account.
- `POST /api/auth/verify` verifies the OTP for farmer login.
- `POST /api/auth/me` refreshes a session from a known user ID.

### Admin

- `GET /api/admin/officers` returns officer accounts.
- `POST /api/admin/officers` creates a new officer account.

### Officer and farmer land records

- `POST /api/officer/land` creates a land record.
- `GET /api/officer/land` lists land records for officers.
- `POST /api/user/sync-land` links matching land records to a farmer.
- `GET /api/user/land/:userId` lists a farmer's linked land records.

### Schemes and applications

- `POST /api/officer/schemes` creates a scheme.
- `GET /api/schemes` lists active schemes.
- `POST /api/user/apply-scheme` submits a farmer scheme application.
- `GET /api/officer/applications/:schemeId` lists applications for a scheme.
- `POST /api/officer/applications/:appId/status` updates an application status.

### Market and job data

- `GET /api/data/:type` returns data by type, such as market or job.
- `POST /api/data` creates a market or job item.
- `DELETE /api/data/:id` deletes a market or job item.

### Helpdesk queries

- `GET /api/queries` lists farmer or officer query views.
- `POST /api/queries` creates a helpdesk query.
- `POST /api/queries/:id/reply` adds a chat reply.
- `POST /api/queries/:id/status` changes query status.

## Data models

The backend stores these primary collections in MongoDB:

- Users: farmers, officers, and administrators.
- OTP records: temporary verification codes with automatic expiry.
- Land records: official survey and ownership-linked records.
- Schemes: government scheme definitions.
- Scheme applications: farmer applications and review status.
- Helpdesk queries: support tickets and chat messages.
- App data: market updates and job postings.

## Security notes

Do not place real credentials or API keys in this README. Keep them in `.env` for local development and in protected environment settings for deployment.

Use a strong `JWT_SECRET` in every deployed environment. Rotate any credential that was ever shared publicly. The administrator seed should be changed or managed securely before production use. Authentication routes are rate-limited, but production deployments should also use HTTPS, locked-down CORS settings, database access controls, server logging, and regular dependency updates.

Aadhaar and farmer profile data are sensitive. Production deployments should follow applicable privacy rules, limit access to authorized users, and avoid exposing personal data in logs or screenshots.

## Development notes

The current frontend API base is hardcoded for local development. If the backend is deployed to another host, update the frontend API and Socket.IO connection values accordingly.

The backend currently allows broad CORS access for easier local testing. Restrict this to trusted frontend origins before production deployment.

The project does not currently include automated tests or npm scripts. Add scripts such as `start`, `dev`, and `test` as the project matures.

## Troubleshooting

If the server cannot connect to MongoDB, confirm that MongoDB is running and that `MONGODB_URI` is correct.

If OTP delivery does not arrive through email or WhatsApp, confirm that provider API keys are configured. In local development, check the backend terminal output for the generated OTP.

If the browser cannot reach the backend, confirm that `node server.js` is running and that the frontend is using `http://localhost:5001`.

If real-time chat does not update, confirm that Socket.IO is loaded in the browser and that the backend server is reachable.

## Production checklist

Before deploying this application, complete these steps:

- Move all secret values to protected environment settings.
- Replace any development-only administrator seed process with a secure operational process.
- Set a strong `JWT_SECRET`.
- Use HTTPS.
- Restrict CORS to trusted domains.
- Protect MongoDB with authentication, network rules, and backups.
- Review handling of Aadhaar and other personal data.
- Add logging, monitoring, and error tracking.
- Add automated tests for authentication, registration, scheme applications, land sync, and helpdesk flows.
- Keep dependencies updated.
