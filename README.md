Karnova Enterprise - Production Documentation

📂 Project File Structure

Ensure all these files are in the same folder before running the application:
karnova-enterprise/
├── .env (Contains your API Keys & MongoDB URI)
├── package.json (Node dependencies)
├── server.js (The powerful Backend API)
├── index.html (The Farmer / User Portal)
├── officer.html (The Krishi Officer Portal)
├── admin.html (The Super Admin Portal)
└── README.md (This file)

🚀 How to Run the Application

Open your terminal in the project folder.

Ensure dependencies are installed: npm install

Start the backend server: node server.js
(Wait to see "✅ MongoDB Connected" and "✅ Default Admin Seeded")

Open the respective HTML files in your browser (e.g., double-click them or use Live Server).

🛡️ Admin Portal (admin.html)

The Admin Portal is an ultra-secure environment for the Super Admin to provision and manage the state's Krishi Officers.

How to Login:

Username (Email): Karnova.admin@gov.in

Password: Ha28@oihdb#233
(Note: No OTP is required for the Super Admin).

Admin Functionalities:

Provision Officers: Enter the officer's details (Name, Email, Phone, District, Salary, and a Temporary Password).

Officer Network: View a real-time list of all active Krishi Officers assigned across Karnataka.

When an officer is created, the system immediately emails/texts the officer their new official "Krishi ID" using Brevo/VerifyWay.

⚙️ Officer Portal (officer.html)

This is the command center for authorized Krishi Officers to manage agricultural data and assist farmers.

How to Login:

Use the Email or Phone and the Temporary Password that the Admin assigned during provisioning.
(Note: No OTP is required for Officers).

Officer Functionalities:

Manage Schemes: Create official government schemes. You must input the Scheme Number, Title, Benefits, Terms & Conditions, and active dates.

Review Applications: View all farmers who have applied for specific schemes. The officer can review their details and click "Verify" or "Reject".

Issue Land Records (Bhoomi): Input verified survey numbers, acreage, and the exact Aadhar Number of the landowner. This anchors the record securely in the database.

Resolve Queries (Helpdesk): A real-time chat interface. When a farmer raises an issue, it appears here. The officer selects the ticket and chats directly with the farmer. Every reply sends an immediate WhatsApp/Email notification to the farmer.

🌾 Farmer Portal (index.html)

The public-facing portal for citizens of Karnataka.

How to Login / Register:

Farmers register using their Aadhar, Phone, Photo (Base64 < 1MB), and District details.

A strict 4-digit OTP (sent via Email and WhatsApp) is required for both Registration and Login.

Farmer Functionalities:

Smart Card: Automatically generates a digital Krishi Pehchan card using their uploaded photo.

Sync Land Records: Clicking "Sync via Aadhar" scans the database for any official land records issued by an officer that match their exact Aadhar number.

Apply for Schemes: Views all active schemes published by officers. Clicking "Apply" sends the application to the Officer portal for review. The status (Pending, Verified, Rejected) updates in real-time.

Live Weather: Uses the OpenWeatherMap API to show humidity, wind, and conditions based on their registered district.

Helpdesk: A robust, real-time chat interface to speak directly with an assigned Krishi Officer.