const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    title: {type: String, required: true},
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
  });


  const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
