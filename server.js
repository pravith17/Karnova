require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);

// ═══════════════════════════════════════
// WEBSOCKET (SOCKET.IO) CONFIGURATION
// ═══════════════════════════════════════
const io = new Server(server, { cors: { origin: '*' } });
app.set('io', io);

io.on('connection', (socket) => {
  socket.on('join_query', (queryId) => socket.join(queryId));
});

// ═══════════════════════════════════════
// MIDDLEWARE & SECURITY
// ═══════════════════════════════════════
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '5mb' }));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: "Too many requests. Try again later." });
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/verify', loginLimiter);
app.use('/api/auth/send-otp', loginLimiter);

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_karnova_key_2026';

// ═══════════════════════════════════════
// MONGODB CONNECTION & SCHEMAS
// ═══════════════════════════════════════
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/karnova_enterprise')
  .then(() => {
    console.log('✅ MongoDB Connected Securely');
    seedAdmin(); 
  })
  .catch(err => console.error('❌ MongoDB Error:', err));

const userSchema = new mongoose.Schema({
  krishiId: { type: String, unique: true },
  role: { type: String, enum: ['user', 'officer', 'admin'], default: 'user' },
  firstName: String, middleName: String, lastName: String,
  email: { type: String, sparse: true },
  phone: { type: String, sparse: true },
  aadhar: { type: String, sparse: true },
  dob: String, state: { type: String, default: 'Karnataka' },
  district: String, taluk: String, panchayat: String,
  photo: String, 
  password: { type: String, required: true },
  salary: String 
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

const querySchema = new mongoose.Schema({
  queryNumber: { type: String, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  officerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  topic: String,
  status: { type: String, enum: ['Open', 'In Progress', 'Resolved'], default: 'Open' },
  messages: [{ senderRole: String, text: String, timestamp: { type: Date, default: Date.now } }]
}, { timestamps: true });

const landRecordSchema = new mongoose.Schema({
  surveyNumber: { type: String, required: true },
  aadharNumber: { type: String, required: true }, 
  taluk: { type: String, required: true },
  panchayat: { type: String, required: true },
  area: { type: String, required: true },
  addedByOfficer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  linkedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null } 
}, { timestamps: true });

const schemeSchema = new mongoose.Schema({
  schemeNumber: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: String, benefits: String, terms: String,
  startDate: Date, endDate: Date,
  addedByOfficer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const schemeApplicationSchema = new mongoose.Schema({
  schemeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Scheme' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['Pending', 'Verified', 'Rejected'], default: 'Pending' }
}, { timestamps: true });

const appDataSchema = new mongoose.Schema({
  type: String, // 'market' or 'job'
  title: String, description: String, value1: String, value2: String
}, { timestamps: true });

const OTP = mongoose.model('OTP', new mongoose.Schema({ phone: String, code: String, createdAt: { type: Date, default: Date.now, expires: 300 } }));

const User = mongoose.model('User', userSchema);
const Query = mongoose.model('Query', querySchema);
const LandRecord = mongoose.model('LandRecord', landRecordSchema);
const Scheme = mongoose.model('Scheme', schemeSchema);
const SchemeApplication = mongoose.model('SchemeApplication', schemeApplicationSchema);
const AppData = mongoose.model('AppData', appDataSchema);

// --- SEED ADMIN ---
async function seedAdmin() {
  const adminEmail = 'Karnova.admin@gov.in';
  try {
    const existingAdmin = await User.findOne({ email: new RegExp('^' + adminEmail + '$', 'i') });
    if (!existingAdmin) {
      await User.create({
        krishiId: 'ADMIN-001', role: 'admin', firstName: 'Super', lastName: 'Admin',
        email: adminEmail, password: 'Ha28@oihdb#233', phone: '0000000000'
      });
      console.log('✅ Default Admin Seeded');
    }
  } catch (e) {
    console.log('Admin verification complete.');
  }
}

// ═══════════════════════════════════════
// OTP & NOTIFICATION SERVICES
// ═══════════════════════════════════════
async function sendNotification(phone, email, subject, textMsg, htmlMsg) {
  const promises = [];
  
  if (email && process.env.BREVO_API_KEY) {
    promises.push(axios.post("https://api.brevo.com/v3/smtp/email", {
      sender: { name: "Karnova Enterprise", email: "wafflewhisk.otp@gmail.com" }, 
      to: [{ email: email }], subject: subject, htmlContent: htmlMsg
    }, { headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' } })
    .then(() => console.log(`✅ Email sent to ${email}`))
    .catch((err) => console.error('❌ Brevo Error:', err.message)));
  }

  if (phone && process.env.VERIFYWAY_API_KEY && phone !== '0000000000') {
    const waNumber = phone.startsWith("91") ? phone : "91" + phone;
    promises.push(axios.post("https://api.verifyway.com/api/v1/", {
      recipient: waNumber, type: "text", message: textMsg, channel: "whatsapp"
    }, { headers: { 'Authorization': `Bearer ${process.env.VERIFYWAY_API_KEY}`, 'Content-Type': 'application/json' } })
    .then(() => console.log(`✅ WhatsApp sent to ${waNumber}`))
    .catch((err) => console.error('❌ VerifyWay Error:', err.message)));
  }
  await Promise.all(promises);
}

async function generateAndSendOTP(phone, email) {
  const generatedCode = Math.floor(1000 + Math.random() * 9000).toString();
  await OTP.findOneAndUpdate({ phone: phone }, { code: generatedCode, createdAt: Date.now() }, { upsert: true, new: true });

  console.log(`\n========================================================`);
  console.log(`🔐 DEV ALERT: YOUR OTP CODE IS [ ${generatedCode} ]`);
  console.log(`========================================================\n`);

  const emailTemplate = `
  <div style="background-color: #f4f7f6; padding: 40px; font-family: Arial, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
      <div style="background-color: #0B4A26; padding: 20px; text-align: center;">
         <h1 style="color: white; margin: 0;">Karnova Enterprise</h1>
      </div>
      <div style="padding: 40px; text-align: center;">
        <p style="font-size: 16px; color: #2c3e50;">Your secure verification code is:</p>
        <div style="font-size: 48px; color: #D4A017; font-weight: bold; margin: 20px 0; letter-spacing: 4px;">${generatedCode}</div>
        <p style="font-size: 14px; color: #7f8c8d;">This code will expire in 5 minutes. Do not share it.</p>
      </div>
    </div>
  </div>`;

  await sendNotification(phone, email, `Your Karnova OTP is ${generatedCode}`, `Your Karnova Enterprise OTP is: ${generatedCode}. Do not share this code.`, emailTemplate);
  return generatedCode;
}

// ═══════════════════════════════════════
// AUTHENTICATION ENDPOINTS
// ═══════════════════════════════════════
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access Denied' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); } 
  catch (err) { res.status(400).json({ error: 'Invalid Token' }); }
};

app.post('/api/auth/me', async (req, res) => {
  try {
    const user = await User.findById(req.body.userId).select('-password');
    if (user) res.json({ success: true, user, token: jwt.sign({ id: user._id, role: user.role }, JWT_SECRET) });
    else res.status(401).json({ error: 'Session invalid' });
  } catch(e) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { phone, email } = req.body;
    const cleanPhone = phone.trim();
    if (!cleanPhone) return res.status(400).json({ error: 'Phone is required.' });
    
    const existingUser = await User.findOne({ phone: cleanPhone });
    if (existingUser) return res.status(400).json({ error: 'Mobile number already registered.' });
    
    await generateAndSendOTP(cleanPhone, email);
    res.json({ success: true, message: 'OTP sent' });
  } catch (err) { res.status(500).json({ error: 'Server error sending OTP' }); }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { otp, phone, ...userData } = req.body;
    const cleanPhone = phone.trim();
    
    const validOTP = await OTP.findOneAndDelete({ phone: cleanPhone, code: otp });
    if (!validOTP) return res.status(400).json({ error: 'Invalid or expired OTP' });

    const krishiId = 'KA-' + new Date().getFullYear() + '-' + Math.floor(10000 + Math.random() * 90000);
    const newUser = await User.create({ ...userData, krishiId, phone: cleanPhone, role: 'user' });

    await sendNotification(cleanPhone, userData.email, "Welcome to Karnova", `Namaste! Your official Krishi-ID is ${krishiId}.`, `<p>Your official Krishi-ID is <strong>${krishiId}</strong>.</p>`);
    res.json({ success: true, user: newUser });
  } catch (err) { res.status(500).json({ error: 'Registration failed. Aadhar or Phone may already exist.' }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { loginId, password } = req.body;
    const cleanId = loginId.trim();

    const user = await User.findOne({ 
      $or: [
        { phone: cleanId }, 
        { email: new RegExp(`^${cleanId}$`, 'i') }, 
        { krishiId: new RegExp(`^${cleanId}$`, 'i') }, 
        { aadhar: cleanId }
      ]
    });
    
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    let isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch && password === user.password) { 
        user.password = password; 
        await user.save(); 
        isMatch = true; 
    }
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    if (user.role === 'admin' || user.role === 'officer') {
      const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
      return res.json({ success: true, verified: true, user, token });
    }

    await generateAndSendOTP(user.phone, user.email);
    res.json({ success: true, verified: false, phone: user.phone });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/auth/verify', async (req, res) => {
  const { phone, otp } = req.body;
  const valid = await OTP.findOneAndDelete({ phone: phone.trim(), code: otp });
  if (!valid) return res.status(400).json({ error: 'Invalid or Expired OTP' });
  
  const user = await User.findOne({ phone: phone.trim() }).select('-password');
  const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ success: true, user, token });
});

// ═══════════════════════════════════════
// LAND RECORDS & APP DATA (REAL-TIME)
// ═══════════════════════════════════════
app.get('/api/data/:type', async (req, res) => {
  const data = await AppData.find({ type: req.params.type }).sort('-createdAt');
  res.json(data);
});

app.post('/api/data', async (req, res) => {
  const newData = await AppData.create(req.body);
  req.app.get('io').emit('refresh_data', { type: req.body.type });
  res.json(newData);
});

app.delete('/api/data/:id', async (req, res) => {
  const doc = await AppData.findByIdAndDelete(req.params.id);
  if (doc) req.app.get('io').emit('refresh_data', { type: doc.type });
  res.json({ success: true });
});

app.post('/api/officer/land', async (req, res) => {
  try {
    const newLand = await LandRecord.create(req.body);
    req.app.get('io').emit('refresh_land');
    res.json({ success: true, land: newLand });
  } catch (e) { res.status(500).json({ error: 'Failed to issue land record' }); }
});

app.get('/api/officer/land', async (req, res) => {
  res.json(await LandRecord.find().populate('linkedUserId', 'firstName lastName krishiId').sort('-createdAt'));
});

app.post('/api/user/sync-land', async (req, res) => {
  try {
    const { userId, aadharNumber } = req.body;
    if (!aadharNumber) return res.status(400).json({ error: 'Aadhar missing from profile.' });
    await LandRecord.updateMany({ aadharNumber: aadharNumber, linkedUserId: null }, { linkedUserId: userId });
    req.app.get('io').emit('refresh_land');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed to sync lands' }); }
});

app.get('/api/user/land/:userId', async (req, res) => {
  res.json(await LandRecord.find({ linkedUserId: req.params.userId }));
});

// ═══════════════════════════════════════
// SCHEMES & APPLICATIONS
// ═══════════════════════════════════════
app.post('/api/officer/schemes', async (req, res) => {
  try {
    const scheme = await Scheme.create(req.body);
    res.json({ success: true, scheme });
  } catch (e) { res.status(500).json({ error: 'Failed to create scheme. Number must be unique.' }); }
});

app.get('/api/schemes', async (req, res) => {
  const schemes = await Scheme.find({ isActive: true }).sort('-createdAt');
  if (req.query.userId) {
    const applications = await SchemeApplication.find({ userId: req.query.userId });
    const schemesWithStatus = schemes.map(s => {
      const app = applications.find(a => a.schemeId.toString() === s._id.toString());
      return { ...s.toObject(), applicationStatus: app ? app.status : null };
    });
    return res.json(schemesWithStatus);
  }
  res.json(schemes);
});

app.post('/api/user/apply-scheme', async (req, res) => {
  try {
    const { schemeId, userId } = req.body;
    const existing = await SchemeApplication.findOne({ schemeId, userId });
    if(existing) return res.status(400).json({ error: 'Already applied' });
    await SchemeApplication.create({ schemeId, userId });
    res.json({ success: true, message: 'Application submitted successfully' });
  } catch(e) { res.status(500).json({ error: 'Application failed' }); }
});

app.get('/api/officer/applications/:schemeId', async (req, res) => {
  const apps = await SchemeApplication.find({ schemeId: req.params.schemeId }).populate('userId', 'firstName lastName krishiId phone');
  res.json(apps);
});

app.post('/api/officer/applications/:appId/status', async (req, res) => {
  try {
    const { status } = req.body;
    const app = await SchemeApplication.findByIdAndUpdate(req.params.appId, { status }, { new: true }).populate('userId').populate('schemeId');
    await sendNotification(app.userId.phone, app.userId.email, `Update on Scheme Application`, `Your application for ${app.schemeId.title} is now ${status}.`, `<p>Your application for the scheme <strong>${app.schemeId.title}</strong> has been marked as: <strong>${status}</strong>.</p>`);
    res.json({ success: true, app });
  } catch(e) { res.status(500).json({ error: 'Failed to update status' }); }
});

// ═══════════════════════════════════════
// QUERIES / HELPDESK (REAL-TIME)
// ═══════════════════════════════════════
app.get('/api/queries', async (req, res) => {
  const { userId, role } = req.query;
  const queries = role === 'user' 
    ? await Query.find({ userId }).populate('officerId', 'firstName lastName').sort('-createdAt')
    : await Query.find().populate('userId', 'firstName lastName phone krishiId district email photo').sort('-createdAt');
  res.json(queries);
});

app.post('/api/queries', async (req, res) => {
  const { userId, topic, text } = req.body;
  const queryNumber = 'QRY-' + Math.floor(100000 + Math.random() * 900000);
  const q = await Query.create({ queryNumber, userId, topic, messages: [{ senderRole: 'user', text }] });
  
  req.app.get('io').emit('refresh_queries');
  res.json(q);
});

app.post('/api/queries/:id/reply', async (req, res) => {
  const { senderRole, text, officerId } = req.body;
  const q = await Query.findById(req.params.id).populate('userId').populate('officerId');
  if (!q) return res.status(404).json({ error: "Not found" });

  if (officerId && !q.officerId) q.officerId = officerId;
  if (senderRole === 'officer' && q.status === 'Open') q.status = 'In Progress';
  
  q.messages.push({ senderRole, text });
  await q.save();

  req.app.get('io').emit('refresh_queries');
  req.app.get('io').to(req.params.id).emit('new_message', { queryId: req.params.id });

  if (senderRole === 'officer' && q.userId) {
    await sendNotification(q.userId.phone, q.userId.email, `Update on Query ${q.queryNumber}`, `Karnova Officer replied to Query ${q.queryNumber}. Log in to view.`, `<p>An Officer replied to your query <strong>${q.queryNumber}</strong>.</p>`);
  }
  res.json({ success: true });
});

// ADDED: API Endpoint to mark a query as resolved
app.post('/api/queries/:id/status', async (req, res) => {
  try {
    const q = await Query.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    req.app.get('io').emit('refresh_queries');
    res.json({ success: true, query: q });
  } catch(e) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// ═══════════════════════════════════════
// ADMIN PORTAL
// ═══════════════════════════════════════
app.get('/api/admin/officers', async (req, res) => {
  const officers = await User.find({ role: 'officer' }).select('-password -photo');
  res.json(officers);
});

app.post('/api/admin/officers', async (req, res) => {
  try {
    const krishiId = 'OFF-' + Math.floor(1000 + Math.random() * 9000);
    const officer = await User.create({ ...req.body, role: 'officer', krishiId });
    await sendNotification(officer.phone, officer.email, "Officer Provisioning Complete", `Welcome Officer. Your Krishi ID is ${krishiId}.`, `<p>Your account is created. <strong>Krishi ID:</strong> ${krishiId}</p>`);
    res.json({ success: true, officer });
  } catch (err) { res.status(400).json({ error: 'Failed to create officer.' }); }
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`🚀 Secure Karnova Backend running on port ${PORT}`));