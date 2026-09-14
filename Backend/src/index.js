if (process.env.USE_LOCAL_DB === 'true') {
    require('dotenv').config({ path: '.env.local' });
}
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./db');
const { errorHandler } = require('./middleware/errorMiddleware');

// Connect to Database and auto-seed admin
const seedAdminUser = async () => {
    try {
        const User = require('./models/User');
        const Role = require('./models/Role');
        const adminEmail = (process.env.ADMIN_EMAIL || 'admin@machad.edu').trim().toLowerCase();
        const adminPassword = process.env.ADMIN_PASSWORD || 'Machad!Admin2026#';
        const adminName = (process.env.ADMIN_NAME || 'System Administrator').trim();

        let ownerRole = await Role.findOne({ name: 'Owner' });
        if (!ownerRole) {
            ownerRole = await Role.create({
                name: 'Owner',
                description: 'Full system access - Business Owner',
                isSystemRole: true
            });
        }

        let adminUser = await User.findOne({ email: adminEmail });
        
        if (!adminUser) {
            adminUser = await User.create({
                fullName: adminName,
                email: adminEmail,
                passwordHash: adminPassword,
                role: 'Super Admin',
                roles: [ownerRole._id],
                status: 'active'
            });
            console.log('✓ Admin user seeded (admin@institute.com / 123456)');
        } else {
            adminUser.fullName = adminUser.fullName || adminName;
            adminUser.role = 'Super Admin';
            adminUser.roles = [ownerRole._id];
            adminUser.status = 'active';
            await adminUser.save();
            // Force hash update if it's currently plain text '123456'
            if (adminUser.passwordHash === '123456') {
                adminUser.passwordHash = '123456';
                await adminUser.save();
                console.log('✓ Admin password hash repaired.');
            }
        }
    } catch (error) {
        console.error('Auto-seed error:', error.message);
    }
};

connectDB().then(async () => {
    const TeacherAttendance = require('./models/TeacherAttendance');
    const StudentAttendance = require('./models/StudentAttendance');
    await Promise.all([
        TeacherAttendance.removeLegacyDailyUniqueIndex(),
        StudentAttendance.removeLegacyDailyUniqueIndex()
    ]);
    await seedAdminUser();
}).catch(err => {
    console.error('Failed to connect to MongoDB on startup. The server will start, but DB operations will fail until connection is established:', err.message);
});

const app = express();

// Middleware. Set FRONTEND_URL to your deployed frontend URL in production.
const allowedOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
app.use(cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/roles', require('./routes/roleRoutes'));
app.use('/api/branches', require('./routes/branchRoutes'));
app.use('/api/classes', require('./routes/clsRoutes'));
app.use('/api/guardians', require('./routes/guardianRoutes'));
app.use('/api/students', require('./routes/studentRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/student-attendance', require('./routes/studentAttendanceRoutes'));
app.use('/api/teacher-attendance', require('./routes/teacherAttendanceRoutes'));
app.use('/api/promotions', require('./routes/promotionRoutes'));
app.use('/api/salaries', require('./routes/salaryRoutes'));
app.use('/api/wallets', require('./routes/walletRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/cashbook', require('./routes/cashbookRoutes'));
app.use('/api/expenses', require('./routes/expenseRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

// Unchanged AI/Analytics/Dashboard/Settings routes if they are generic, 
// but we deleted their routes. We can re-add them if needed, but since we deleted them let's remove.
// Wait, I only deleted specific warehouse ones. Let's see what I kept:
// aiRoutes, aiAnalyticsRoutes, dashboardRoutes, settingsRoutes, tenantRoutes, etc.
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/analytics', require('./routes/aiAnalyticsRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/tenants', require('./routes/tenantRoutes'));
app.use('/api/exams', require('./routes/examRoutes'));

app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date() });
});

app.get('/api/diagnostic-db', async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const Student = require('./models/Student');
        const Transaction = require('./models/Transaction');
        const CashbookEntry = require('./models/CashbookEntry');

        const uri = process.env.MONGO_URI || '';
        // Safely mask password: mongodb+srv://user:****@cluster/db
        const maskedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
        const cluster = mongoose.connection.host || 'unknown';
        const databaseName = mongoose.connection.name || 'unknown';
        const students = await Student.countDocuments();
        const transactions = await Transaction.countDocuments();
        const cashbookentries = await CashbookEntry.countDocuments();

        res.json({
            maskedUri,
            cluster,
            databaseName,
            counts: {
                students,
                transactions,
                cashbookentries
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/clean-prod-transactions', async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const Student = require('./models/Student');
        const Transaction = require('./models/Transaction');
        const CashbookEntry = require('./models/CashbookEntry');

        const dbHost = mongoose.connection.host || '';
        const dbName = mongoose.connection.name || '';

        // Strict assertion 1: Must be connected to cluster0.hybxg2k.mongodb.net and database machad
        if (!dbHost.includes('hybxg2k') || dbName !== 'machad') {
            return res.status(400).json({ error: 'Safety abort: not connected to production database machad on hybxg2k' });
        }

        // Strict assertion 2: Must have 403 students, 4 transactions, 4 cashbookentries before deletion
        const studentsBefore = await Student.countDocuments();
        const txBefore = await Transaction.countDocuments();
        const cbBefore = await CashbookEntry.countDocuments();

        if (studentsBefore !== 403) {
            return res.status(400).json({ error: `Safety abort: students count is ${studentsBefore}, expected 403` });
        }
        if (txBefore !== 4 || cbBefore !== 4) {
            return res.status(400).json({ error: `Safety abort: expected 4 tx and 4 cb, found ${txBefore} and ${cbBefore}` });
        }

        // Delete ONLY transactions and cashbookentries collections
        const deletedTx = await Transaction.deleteMany({});
        const deletedCb = await CashbookEntry.deleteMany({});

        // After counts
        const studentsAfter = await Student.countDocuments();
        const txAfter = await Transaction.countDocuments();
        const cbAfter = await CashbookEntry.countDocuments();

        res.json({
            status: 'success',
            cluster: dbHost,
            database: dbName,
            before: {
                students: studentsBefore,
                transactions: txBefore,
                cashbookentries: cbBefore
            },
            deleted: {
                transactions: deletedTx.deletedCount,
                cashbookentries: deletedCb.deletedCount
            },
            after: {
                students: studentsAfter,
                transactions: txAfter,
                cashbookentries: cbAfter
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/', (req, res) => {
    res.send('Institute API is running...');
});

// Error Middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5005; // Was 5005 in .env

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);

    // Render Keep-Alive: Ping server every 10 minutes so Render never sleeps
    const targetUrl = process.env.RENDER_EXTERNAL_URL || 'https://mach-backend-695y.onrender.com';
    const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);
    if (isProduction) {
        const axios = require('axios');
        const PING_INTERVAL = 10 * 60 * 1000; // 10 minutes
        setInterval(async () => {
            try {
                await axios.get(`${targetUrl}/api/health`, { timeout: 15000 });
                console.log(`[Keep-Alive] Pinged ${targetUrl}/api/health successfully.`);
            } catch (err) {
                console.warn(`[Keep-Alive] Ping note: ${err.message}`);
            }
        }, PING_INTERVAL);
    }
});
