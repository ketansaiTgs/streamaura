const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const { getDatabase } = require('./database/init');

// Load environment variables
dotenv.config();

// Initialize database
getDatabase();

// Import routes
const authRoutes = require('./routes/auth.routes');
const channelRoutes = require('./routes/channel.routes'); 
const streamRoutes = require('./routes/stream.routes');
const viewerRoutes = require('./routes/viewer.routes');
const chatRoutes = require('./routes/chat.routes');
const statsRoutes = require('./routes/stats.routes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/streams', streamRoutes);
app.use('/api/viewers', viewerRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/stats', statsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;